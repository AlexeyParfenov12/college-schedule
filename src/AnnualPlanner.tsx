import PolishedSelect from './PolishedSelect';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, Play, Search, SlidersHorizontal, Trash2, Users, WandSparkles, X } from 'lucide-react';
import { DAYS, GROUPS, ROOMS, TEACHERS } from './data';
import type { Lesson, CalendarEvent } from './data';
import { MiniSchedule, LoadBars } from './ScheduleVisuals';
import { defaultAnnualConfig, streamKey, teacherRule } from './yearSolver';
import { academicGroupStats, demoAcademicDemands, demoAcademicHorizon, DEMO_SEMESTERS } from './academicPlanning';
import type { AnnualConfig, AnnualVariant, TeacherPreference } from './yearSolver';
import { lessonDate } from './plannerDomain';
import { useProductionCalendarState, getProductionSnapshot } from './productionCalendarSync';
import { getCollegeDayOverrides, useCollegeOverrideRevision } from './collegeDayOverrides';
import { ACADEMIC_START, ACADEMIC_END, LEGACY_WEEK_OFFSET } from './weekTimeline';
import { assessRoomFit } from './roomPolicy';
import { effectiveGroupRules } from './scheduleConstraints';
import { practicePeriodsFromKug } from './kugPractice';
import type { ScopeOverride } from './scheduleConstraints';

type Props={lessons:Lesson[];calendar:CalendarEvent[];onApply:(variant:AnnualVariant,weeks:number,workweek:5|6)=>void;notify:(s:string)=>void};
type Tab='load'|'teachers'|'scope'|'rooms'|'groups'|'distance'|'results';
const tabs:{id:Tab;name:string}[]=[
 {id:'load',name:'Нагрузка'},{id:'teachers',name:'Преподаватели'},{id:'scope',name:'Правила групп'},{id:'rooms',name:'Кабинеты'},
 {id:'groups',name:'Потоки и подгруппы'},
 {id:'distance',name:'Дистант и дорога'},{id:'results',name:'4 варианта'}
];
const F=({name,children}:{name:string;children:React.ReactNode})=><label className="year-field"><span>{name}</span>{children}</label>;
/** Preserve existing planning preferences but ignore obsolete manually entered practice blocks. */
const read=():AnnualConfig=>{try{
 const modern=localStorage.getItem('college-year-preferences-v3');
 if(modern){const saved=JSON.parse(modern) as AnnualConfig&{practiceBlocks?:unknown};delete saved.practiceBlocks;return {...defaultAnnualConfig(),...saved}}
 const legacy=localStorage.getItem('college-year-preferences-v2');
 if(legacy){
  const old=JSON.parse(legacy) as Partial<AnnualConfig>;
  const saved=old as Partial<AnnualConfig>&{practiceBlocks?:unknown};delete saved.practiceBlocks;
  return {...defaultAnnualConfig(),...saved};
 }
}catch{}return defaultAnnualConfig()};
const key=(name:string,subject:string)=>streamKey(name,subject);
const periodOptions=(weeks:number)=>Array.from({length:weeks},(_,w)=><option key={w} value={w}>{w+1}-я · {w===0?ACADEMIC_START:lessonDate(w,0)}</option>);
export default function AnnualPlanner({lessons,calendar,onApply,notify}:Props){
 const production=useProductionCalendarState();
 const collegeRevision=useCollegeOverrideRevision();
 const horizon=useMemo(()=>demoAcademicHorizon(calendar),[calendar]);
 const [cfg,setCfg]=useState<AnnualConfig>(()=>({...read(),weeks:demoAcademicHorizon(calendar)}));
 const backlog=useMemo(()=>{
  try{
   const current=localStorage.getItem('college-year-unplaced-v2');
   const legacy=current?null:localStorage.getItem('college-year-unplaced-v1');
   const source=current||legacy;
   if(!source)return null;
   const record=JSON.parse(source) as {at:string;weeks:number;unplaced:{group:string;subject:string;reason:string;week?:number}[];practiceIssues:{group:string;week:number;reason:string}[]};
   if(!legacy)return record;
   // Historical reports remain readable. Old week indexes are translated only in memory.
   return {...record,weeks:53,
    unplaced:record.unplaced.map(x=>({...x,...(x.week===undefined?{}:{week:x.week+LEGACY_WEEK_OFFSET})})),
    practiceIssues:record.practiceIssues.map(x=>({...x,week:x.week+LEGACY_WEEK_OFFSET}))};
  }catch{return null}
 },[]);
 const [tab,setTab]=useState<Tab>('load');
 const demands=useMemo(()=>demoAcademicDemands(calendar,cfg.days,cfg.weeks),[calendar,cfg.days,cfg.weeks,production.revision,collegeRevision]);
 const kugPractice=useMemo(()=>practicePeriodsFromKug(calendar,cfg.weeks,cfg.days),[calendar,cfg.weeks,cfg.days,production.revision,collegeRevision]);
 const [teacher,setTeacher]=useState(TEACHERS[0]),[teacherSearch,setTeacherSearch]=useState('');
 const [scopeType,setScopeType]=useState<'college'|'department'|'group'>('college');
 const [scopeDepartment,setScopeDepartment]=useState(GROUPS[0].department);
 const [scopeGroup,setScopeGroup]=useState(GROUPS[0].id);
 const [roomSearch,setRoomSearch]=useState(''),[group,setGroup]=useState('П-21');
 const [variants,setVariants]=useState<AnnualVariant[]>([]),[active,setActive]=useState(0);
 const [viewWeek,setViewWeek]=useState(0),[viewGroup,setViewGroup]=useState('П-21'),[issueSearch,setIssueSearch]=useState('');
 const [working,setWorking]=useState(false),[progress,setProgress]=useState('');
 const worker=useRef<Worker|null>(null);
 const lastProductionRevision=useRef(production.revision+'-'+collegeRevision);
 const [calculationRevision,setCalculationRevision]=useState<string|null>(null);
 const change=(next:(config:AnnualConfig)=>AnnualConfig)=>{
  setCfg(current=>{const value=next(current);try{localStorage.setItem('college-year-preferences-v3',JSON.stringify(value))}catch{}return value});
  setVariants([]);
 };
 useEffect(()=>()=>{worker.current?.terminate()},[]);
 useEffect(()=>{
  const updated=production.revision+'-'+collegeRevision;
  if(lastProductionRevision.current===updated)return;
  lastProductionRevision.current=updated;
  worker.current?.terminate();worker.current=null;
  setWorking(false);setVariants([]);setCalculationRevision(null);
  setProgress('Производственный календарь обновлён. Пересчитайте варианты расписания.');
 },[production.revision,collegeRevision]);
 useEffect(()=>{
  if(cfg.weeks!==horizon)change(current=>({...current,weeks:horizon}));
 },[cfg.weeks,horizon]);
 const rule=teacherRule(cfg,teacher);
 const ruleTarget:ScopeOverride=scopeType==='college'?cfg.collegeRules||{}:
  scopeType==='department'?cfg.departmentRules?.[scopeDepartment]||{}:cfg.groupRules?.[scopeGroup]||{};
 const targetGroup=scopeType==='group'?scopeGroup:
  GROUPS.find(g=>g.department===scopeDepartment)?.id||scopeGroup;
 const previewConfig:AnnualConfig=scopeType==='college'?{...cfg,departmentRules:{},groupRules:{}}:
  scopeType==='department'?{...cfg,groupRules:{}}:cfg;
 const parentConfig:AnnualConfig=scopeType==='college'?{...cfg,collegeRules:{},departmentRules:{},groupRules:{}}:
  scopeType==='department'?{...cfg,departmentRules:{},groupRules:{}}:{...cfg,groupRules:{}};
 const inheritedGroup=effectiveGroupRules(previewConfig,targetGroup);
 const parentRule=effectiveGroupRules(parentConfig,targetGroup).rule;
 const scopeDays=ruleTarget.daysOff||[];
 const applyScope=(patch:Partial<ScopeOverride>)=>change(c=>{
  if(scopeType==='college')return {...c,collegeRules:{...c.collegeRules,...patch}};
  if(scopeType==='department')return {...c,departmentRules:{...c.departmentRules,[scopeDepartment]:{...c.departmentRules?.[scopeDepartment],...patch}}};
  return {...c,groupRules:{...c.groupRules,[scopeGroup]:{...c.groupRules?.[scopeGroup],...patch}}};
 });
 const clearScope=()=>change(c=>{
  if(scopeType==='college')return {...c,collegeRules:{}};
  if(scopeType==='department'){
   const next={...c.departmentRules};delete next[scopeDepartment];return {...c,departmentRules:next};
  }
  const next={...c.groupRules};delete next[scopeGroup];return {...c,groupRules:next};
 });
 const teacherOptions=TEACHERS.filter(x=>x.toLowerCase().includes(teacherSearch.toLowerCase()));
 const activeRooms=ROOMS.filter(r=>r.active&&cfg.activeRooms.includes(r.id));
 const subjectGroups=useMemo(()=>{
  const map=new Map<string,{teacher:string;subject:string;groups:string[]}>();
  for(const d of demands){
   const id=key(d.teacher,d.subject);const item=map.get(id);
   if(item){if(!item.groups.includes(d.group))item.groups.push(d.group)}
   else map.set(id,{teacher:d.teacher,subject:d.subject,groups:[d.group]});
  }
  return [...map.entries()].filter(([,v])=>v.groups.length>1);
 },[demands]);
 const selectedDemands=demands.filter(x=>x.group===group);
 const groupStats=academicGroupStats(demands,group);
 const selected=variants[active];
 const issues=(selected?.unplaced||[]).filter(x=>(x.group+x.subject+x.teacher+x.reason).toLowerCase().includes(issueSearch.toLowerCase()));
 const totalHours=demands.reduce((s,d)=>s+d.requiredPairs*2,0);
 const applyTeacher=(changes:Partial<TeacherPreference>)=>change(c=>({
  ...c,teacherPreferences:{...c.teacherPreferences,[teacher]:{
   ...(c.teacherPreferences[teacher]||{daysOff:[],fromSlot:1,toSlot:6,forbidden:[],preferDays:[],maxOnlinePct:c.defaultOnlinePct}),
   ...changes
  }}
 }));
 const run=()=>{
  worker.current?.terminate();setWorking(true);setProgress('Вычисление вариантов...');setVariants([]);setCalculationRevision(production.revision+':'+collegeRevision);setTab('results');
  const w=new Worker(new URL('./yearPlanner.worker.ts',import.meta.url),{type:'module'});worker.current=w;
  w.onmessage=(e:MessageEvent<{type:string;current?:number;name?:string;variants?:AnnualVariant[];message?:string}>)=>{
   if(e.data.type==='progress')setProgress('Вариант '+e.data.current+'/4: '+e.data.name);
   if(e.data.type==='result'){setVariants(e.data.variants||[]);setActive(0);setWorking(false);setProgress('Готово');w.terminate();worker.current=null}
   if(e.data.type==='error'){setProgress(e.data.message||'Ошибка расчёта');setWorking(false);notify(e.data.message||'Ошибка расчёта');w.terminate();worker.current=null}
  };
  w.onerror=e=>{setWorking(false);setProgress('Ошибка запуска расчёта');notify(e.message);w.terminate();worker.current=null};
  w.postMessage({demands,config:cfg,calendar,locked:lessons.filter(l=>l.status==='held'),production:getProductionSnapshot(),collegeOverrides:getCollegeDayOverrides()});
 };
 const stop=()=>{worker.current?.terminate();worker.current=null;setWorking(false);setProgress('Расчёт остановлен')};
 const exportVariant=()=>{
  if(!selected)return;
  const blob=new Blob([JSON.stringify({kind:'college-annual-demo-v1',variant:selected,configuration:cfg},null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='college-year-'+selected.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
 };
 const applyVariant=()=>{
  if(!selected)return;
  if(calculationRevision!==production.revision+':'+collegeRevision)return notify('Производственный календарь изменился. Сначала пересчитайте 4 варианта.');
  const gaps=selected.unplaced.length,practice=selected.practiceIssues.length;
  const details=gaps||practice
   ?'ВНИМАНИЕ: вариант неполный. Неразмещённых назначений: '+gaps+'. Проблем практики: '+practice+'. Они сохранятся для разбора учебной частью. '
   :'По рассчитанной демонстрационной нагрузке неразмещённых назначений нет. ';
  if(!window.confirm(details+'Применить расписание на '+cfg.weeks+' недель к черновику? Проведённые занятия сохраняются, предыдущий вариант можно восстановить.'))return;
  onApply(selected,cfg.weeks,cfg.days);
 };
 const nextTab=()=>{const i=tabs.findIndex(t=>t.id===tab);setTab(tabs[Math.min(i+1,tabs.length-1)].id)};
 return <div className="year-planner" data-testid="year-planner">
  <div className="year-hero"><div><span>Мастер учебной части · демо-решатель</span><h2>Годовое расписание всех групп</h2><p>Построй четыре альтернативы на основе нагрузок, пожеланий преподавателей, рабочих кабинетов, подгрупп, данных КУГ и дистанта.</p></div>
   <button className="year-primary" onClick={run} disabled={working}><Play size={15}/> Рассчитать 4 варианта</button></div>
  {backlog&&backlog.unplaced.length+backlog.practiceIssues.length>0&&
   <div className="year-note" role="status"><strong>Остатки после последнего применения:</strong> {backlog.unplaced.length} назначений и {backlog.practiceIssues.length} проблем практики.
   Они сохранены в этом браузере и требуют решения учебной части. Пересчитай план после изменения ограничений.</div>}
  <div className="year-kpis"><div><b>{GROUPS.length}</b><small>групп</small></div><div><b>{demands.length}</b><small>дисциплин / назначений</small></div><div><b>{totalHours.toLocaleString('ru-RU')}</b><small>часов по демо-учебным назначениям</small></div><div><b>{activeRooms.length}</b><small>кабинетов</small></div><div><b>{kugPractice.length}</b><small>периодов практики из КУГ</small></div></div>
  <div className="year-note" role="status"><strong>Практика из КУГ:</strong> {kugPractice.length} группо-недель УП, ПП и ПДП загружено автоматически. Изменение дат и типов — в учебном календаре. Руководители, места и кабинеты должны поступать из Academic Core; без назначений система покажет предупреждения, а не вымышленные занятия.</div>
  <div className="year-tabs" role="tablist" aria-label="Настройка годового расписания">{tabs.map(x=><button role="tab" aria-selected={tab===x.id} className={tab===x.id?'active':''} key={x.id} onClick={()=>setTab(x.id)}>{x.name}</button>)}</div>
  {tab==='load'&&<div className="year-cols"><section className="year-card"><h3><BookOpen size={16}/> Требования к учебным часам</h3>
   <p>Демонстрационные учебные планы и назначения преподавателей заданы отдельно от готовых занятий. Часы берутся из тестовых записей учебных планов, а доступные недели — из учебного календаря каждой группы. Это <strong>не утверждённые часы реального колледжа</strong>: позже здесь будет подключён Academic Core.</p>
   <div className="year-fields">
    <F name="Период определяется автоматически"><div className="year-auto-period" role="status">
      <strong>{cfg.weeks} недель календарного горизонта</strong>
      <small>{ACADEMIC_START} — {ACADEMIC_END}</small>
     </div></F>
    <F name="Группа"><PolishedSelect value={group} onChange={e=>setGroup(e.target.value)}>{GROUPS.map(g=><option key={g.id} value={g.id}>{g.id}</option>)}</PolishedSelect></F>
   </div>
   <div className="year-auto-stats">
    <span>{groupStats.assignments} учебных назначений</span>
    <span>{groupStats.teachingWeeks} учебных недель у группы</span>
    <span>{groupStats.plannedHours} академических часов по демоплану</span>
   </div>
   <div className="year-table-scroll"><table><thead><tr>
    <th>Дисциплина</th><th>Преподаватель</th><th>Осень, ч</th><th>Весна, ч</th><th>Всего, ч</th>
   </tr></thead><tbody>{selectedDemands.map(d=><tr key={d.id}>
    <td>{d.subject}</td><td>{d.teacher}</td><td>{(d.semesters?.autumnPairs||0)*2}</td>
    <td>{(d.semesters?.springPairs||0)*2}</td><td><strong>{d.requiredPairs*2}</strong></td>
   </tr>)}</tbody></table></div>
   <div className="year-note">Часы не редактируются в расписании: изменения утверждённого учебного плана выполняются в Academic Core. Демонстрационные назначения охватывают {DEMO_SEMESTERS.length} учебных периода; периоды можно настроить в учебном календаре.</div>
   </section><section className="year-card"><h3><Clock3 size={16}/> Общие ограничения</h3><div className="year-fields">
    <F name="Учебных дней"><PolishedSelect value={cfg.days} onChange={e=>change(c=>({...c,days:Number(e.target.value) as 5|6}))}><option value={5}>Пн–Пт</option><option value={6}>Пн–Сб</option></PolishedSelect></F>
    <F name="Пар в день"><PolishedSelect value={cfg.slotsPerDay} onChange={e=>change(c=>({...c,slotsPerDay:Number(e.target.value)}))}>{[3,4,5,6].map(x=><option key={x} value={x}>{x}</option>)}</PolishedSelect></F></div>
    <div className="year-rules"><span><Check size={14}/> Группа и преподаватель не дублируются во времени</span><span><Check size={14}/> Кабинет проверяется по занятости и местам</span><span><Check size={14}/> Учебные периоды исключают запрещённые даты</span><span><Check size={14}/> Периоды практики автоматически учитываются из КУГ</span></div><button className="year-next" onClick={nextTab}>Настроить преподавателей <ArrowRight size={14}/></button></section></div>}
  {tab==='teachers'&&<div className="year-cols"><section className="year-card"><h3><Users size={16}/> Преподаватели</h3>
   <div className="year-search"><Search size={14}/><input aria-label="Поиск преподавателя для правил" placeholder="Найти…" value={teacherSearch} onChange={e=>setTeacherSearch(e.target.value)}/></div>
   <div className="year-list">{TEACHERS.filter(t=>t.toLowerCase().includes(teacherSearch.toLowerCase())).map(t=><button key={t} className={teacher===t?'chosen':''} onClick={()=>setTeacher(t)}>{t}{cfg.teacherPreferences[t]&&<Check size={13}/>}</button>)}</div>
   </section><section className="year-card"><h3><SlidersHorizontal size={16}/> {teacher}</h3><p>Жёсткие запреты не нарушаются при расчёте. Предпочтения помогают сократить окна.</p>
    <h4>Не ставить занятия в дни</h4><div className="year-day-choices">{DAYS.slice(0,cfg.days).map((d,i)=><label key={d} className={rule.daysOff.includes(i)?'chosen':''}><input type="checkbox" checked={rule.daysOff.includes(i)} onChange={e=>applyTeacher({daysOff:e.target.checked?[...rule.daysOff,i]:rule.daysOff.filter(x=>x!==i)})}/>{d}</label>)}</div>
    <div className="year-fields"><F name="Начиная с пары"><PolishedSelect value={rule.fromSlot} onChange={e=>applyTeacher({fromSlot:Number(e.target.value)})}>{[1,2,3,4,5,6].map(x=><option key={x} value={x}>{x}</option>)}</PolishedSelect></F>
    <F name="Не позже пары"><PolishedSelect value={rule.toSlot} onChange={e=>applyTeacher({toSlot:Number(e.target.value)})}>{[1,2,3,4,5,6].map(x=><option key={x} value={x}>{x}</option>)}</PolishedSelect></F></div>
    <h4>Запретить отдельные пары</h4>
    <div className="year-forbidden">{DAYS.slice(0,cfg.days).map((d,day)=><div key={d}><span>{d}</span>{Array.from({length:cfg.slotsPerDay},(_,i)=>i+1).map(slot=>{
     const banned=rule.forbidden.some(x=>x.day===day&&slot>=x.from&&slot<=x.to);
     return <button key={slot} className={banned?'off':''} title={banned?'Запрещено':'Допустимо'} onClick={()=>applyTeacher({forbidden:banned?rule.forbidden.filter(x=>!(x.day===day&&slot>=x.from&&slot<=x.to)):[...rule.forbidden,{day,from:slot,to:slot}]})}>{slot}</button>;
    })}</div>)}</div>
    <F name="Максимальное количество пар в день"><PolishedSelect aria-label="Максимум пар преподавателя в день" value={rule.maxPairsPerDay||cfg.slotsPerDay} onChange={e=>applyTeacher({maxPairsPerDay:Number(e.target.value)})}>{Array.from({length:cfg.slotsPerDay},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} {n===1?'пара':'пар'}</option>)}</PolishedSelect></F>
    <F name={'Максимум дистанционных пар: '+rule.maxOnlinePct+'%'}><input type="range" min={0} max={100} step={5} value={rule.maxOnlinePct} onChange={e=>applyTeacher({maxOnlinePct:Number(e.target.value)})}/></F>
    <h4>Предпочтительные дни</h4><div className="year-day-choices">{DAYS.slice(0,cfg.days).map((d,i)=><label key={d} className={rule.preferDays.includes(i)?'preferred':''}><input type="checkbox" checked={rule.preferDays.includes(i)} onChange={e=>applyTeacher({preferDays:e.target.checked?[...rule.preferDays,i]:rule.preferDays.filter(x=>x!==i)})}/>{d}</label>)}</div>
   <button className="year-next" onClick={nextTab}>Настроить правила групп <ArrowRight size={14}/></button></section></div>}
  {tab==='scope'&&<div className="year-cols">
   <section className="year-card"><h3><SlidersHorizontal size={16}/> Общие и индивидуальные правила</h3>
    <p>Настраивай условия для всего колледжа, отделения или одной группы. Жёсткие запреты вышестоящего уровня нельзя отменить отдельной группе: это исключает противоречивое расписание.</p>
    <div className="year-fields">
     <F name="Для кого правило"><PolishedSelect aria-label="Уровень правил" value={scopeType} onChange={e=>setScopeType(e.target.value as typeof scopeType)}>
      <option value="college">Весь колледж</option><option value="department">Отделение</option><option value="group">Конкретная группа</option>
     </PolishedSelect></F>
     {scopeType==='department'&&<F name="Отделение"><PolishedSelect aria-label="Отделение ограничений" value={scopeDepartment} onChange={e=>setScopeDepartment(e.target.value)}>
       {[...new Set(GROUPS.map(g=>g.department))].map(id=><option key={id}>{id}</option>)}</PolishedSelect></F>}
     {scopeType==='group'&&<F name="Группа"><PolishedSelect aria-label="Группа ограничений" value={scopeGroup} onChange={e=>setScopeGroup(e.target.value)}>
       {GROUPS.map(g=><option key={g.id} value={g.id}>{g.id} · {g.department}</option>)}</PolishedSelect></F>}
    </div>
    <div className="year-note"><strong>Откуда получено правило:</strong> {scopeType==='college'?'Общие правила колледжа':
      scopeType==='department'?'Колледж → '+scopeDepartment:inheritedGroup.origin.join(' → ')}</div>
    <div className="year-rule-summary">
     <span>Рабочих дней: {cfg.days}</span><span>Пар по сетке: {cfg.slotsPerDay}</span>
     <span>Исключено дней: {inheritedGroup.rule.daysOff.length}</span>
     <span>Лимит группы: {inheritedGroup.rule.maxPairsPerDay} пар/день</span>
    </div>
    <button type="button" className="year-rule-reset" onClick={clearScope}>
     Вернуть {scopeType==='college'?'настройки по умолчанию':'унаследованные правила'}
    </button>
   </section>
   <section className="year-card"><h3>Ограничения выбранной области</h3>
    <p>Отмеченные дни и пары исключаются из расчёта. Индивидуальные правила дополняют общие ограничения, не отменяя их.</p>
    <h4>Не ставить занятия в дни</h4>
    <div className="year-day-choices">{DAYS.slice(0,cfg.days).map((d,day)=>
     <label key={d} className={scopeDays.includes(day)||parentRule.daysOff.includes(day)?'chosen':''}
      title={parentRule.daysOff.includes(day)?'Запрещено вышестоящими правилами':'Индивидуальное ограничение'}>
      <input type="checkbox" checked={scopeDays.includes(day)||parentRule.daysOff.includes(day)}
       disabled={parentRule.daysOff.includes(day)} onChange={e=>applyScope({
       daysOff:e.target.checked?[...scopeDays,day]:scopeDays.filter(x=>x!==day)
      })}/>{d}
     </label>)}</div>
    <div className="year-fields">
     <F name="Не раньше пары"><PolishedSelect aria-label="Начало диапазона правил" value={inheritedGroup.rule.fromSlot}
      onChange={e=>applyScope({fromSlot:Number(e.target.value)})}>{Array.from({length:cfg.slotsPerDay},(_,i)=>i+1).map(n=><option key={n} value={n} disabled={n<parentRule.fromSlot}>{n}</option>)}</PolishedSelect></F>
     <F name="Не позже пары"><PolishedSelect aria-label="Конец диапазона правил" value={inheritedGroup.rule.toSlot}
      onChange={e=>applyScope({toSlot:Number(e.target.value)})}>{Array.from({length:cfg.slotsPerDay},(_,i)=>i+1).map(n=><option key={n} value={n} disabled={n>parentRule.toSlot}>{n}</option>)}</PolishedSelect></F>
     <F name="Максимум пар в день"><PolishedSelect aria-label="Максимум пар группы" value={inheritedGroup.rule.maxPairsPerDay}
      onChange={e=>applyScope({maxPairsPerDay:Number(e.target.value)})}>{Array.from({length:cfg.slotsPerDay},(_,i)=>i+1).map(n=><option key={n} value={n} disabled={n>parentRule.maxPairsPerDay}>{n} пар</option>)}</PolishedSelect></F>
    </div>
    <h4>Запретить отдельные пары</h4>
    <div className="year-forbidden">{DAYS.slice(0,cfg.days).map((d,day)=><div key={d}><span>{d}</span>
     {Array.from({length:cfg.slotsPerDay},(_,i)=>i+1).map(slot=>{
      const inheritedBan=parentRule.forbidden.some(x=>x.day===day&&slot>=x.from&&slot<=x.to);
      const banned=(ruleTarget.forbidden||[]).some(x=>x.day===day&&slot>=x.from&&slot<=x.to);
      return <button type="button" key={slot} className={banned||inheritedBan?'off':''}
       disabled={inheritedBan}
       aria-label={'Ограничения '+d+' '+slot+' пара'} title={inheritedBan?'Наследуется от вышестоящего уровня':banned?'Запрещено':'Допустимо'}
       onClick={()=>applyScope({forbidden:banned?(ruleTarget.forbidden||[]).filter(x=>!(x.day===day&&slot>=x.from&&slot<=x.to)):
        [...(ruleTarget.forbidden||[]),{day,from:slot,to:slot}]})}>{slot}</button>;
     })}</div>)}</div>
    <div className="year-note">Проверяются занятость группы, правила колледжа и отделения, индивидуальные ограничения, учебный календарь и максимальная нагрузка.</div>
    <button className="year-next" onClick={nextTab}>Настроить кабинеты <ArrowRight size={14}/></button>
   </section></div>}
  {tab==='rooms'&&<div className="year-cols"><section className="year-card"><h3>Работающие аудитории</h3><div className="year-search"><Search size={14}/><input aria-label="Найти аудиторию для годового плана" placeholder="Номер, корпус, тип..." value={roomSearch} onChange={e=>setRoomSearch(e.target.value)}/></div>
    <div className="year-list rooms">{ROOMS.filter(r=>(r.id+' '+r.kind+' '+r.building).toLowerCase().includes(roomSearch.toLowerCase())).map(r=><label key={r.id}><input type="checkbox" checked={cfg.activeRooms.includes(r.id)} onChange={e=>change(c=>({...c,activeRooms:e.target.checked?[...c.activeRooms,r.id]:c.activeRooms.filter(x=>x!==r.id)}))}/><b>{r.id}</b><small>{r.kind} · {r.pc?r.pc+' ПК':r.capacity+' мест'} · корпус {r.building}</small></label>)}</div>
   </section><section className="year-card"><h3>Доступный фонд</h3><div className="year-room-kpis"><div><b>{activeRooms.length}</b><small>всего</small></div><div><b>{activeRooms.filter(r=>r.pc>0).length}</b><small>компьютерных</small></div><div><b>{activeRooms.filter(r=>r.capacity>=60).length}</b><small>больших залов</small></div></div><p>Закрытая аудитория исключается из подбора. Ресурсы практик будут резервироваться по утверждённым назначениям Academic Core, не по повторно введённым блокам.</p><button className="year-next" onClick={nextTab}>Потоки и подгруппы <ArrowRight size={14}/></button></section></div>}
  {tab==='groups'&&<div className="year-cols"><section className="year-card"><h3>Разрешённые потоки</h3><p>Настрой, какие общие лекции разрешено объединять. Для потоков обязательны один преподаватель и дисциплина, а также аудитория на всех участников. Годовой решатель может объединять совместимые назначения в одно занятие нескольких групп, учитывая учебные часы каждой группы.</p>
    <div className="year-list">{[...new Map(demands.map(d=>[streamKey(d.teacher,d.subject),{teacher:d.teacher,subject:d.subject}])).values()].filter(v=>demands.filter(d=>d.teacher===v.teacher&&d.subject===v.subject).length>1).map(v=>{const code=streamKey(v.teacher,v.subject);return <label key={code}><input type="checkbox" checked={cfg.allowStreams.includes(code)} onChange={e=>change(c=>({...c,allowStreams:e.target.checked?[...c.allowStreams,code]:c.allowStreams.filter(x=>x!==code)}))}/><span>{v.subject} · {v.teacher}</span></label>})}</div>
   </section><section className="year-card"><h3>Подгруппы и сопровождающие</h3><p>При необходимости разреши подгруппы и назначь сопровождающего. Сначала проверь возможность работы по 2–3 человека за компьютером: нехватка персональных ПК не означает обязательного разделения.</p>
   <div className="year-list">{GROUPS.map(g=><div className="year-group-row" key={g.id}><b>{g.id} · {g.count} человек</b><label><input type="checkbox" checked={cfg.allowSubgroups.includes(g.id)} onChange={e=>change(c=>({...c,allowSubgroups:e.target.checked?[...c.allowSubgroups,g.id]:c.allowSubgroups.filter(x=>x!==g.id)}))}/> Делить</label><label><input type="checkbox" checked={cfg.assistedSubgroups.includes(g.id)} onChange={e=>change(c=>({...c,assistedSubgroups:e.target.checked?[...c.assistedSubgroups,g.id]:c.assistedSubgroups.filter(x=>x!==g.id)}))}/> Сопровождение</label></div>)}</div>
    <button className="year-next" onClick={nextTab}>Дистант и дорога <ArrowRight size={14}/></button></section></div>}
  {tab==='distance'&&<div className="year-cols"><section className="year-card"><h3>Дистант из дома и дорога</h3><div className="year-rule"><CheckCircle2 size={15}/> Студент и преподаватель не могут одновременно быть дома и в колледже</div><div className="year-rule"><CheckCircle2 size={15}/> Между очной и онлайн-парой — обязательный свободный промежуток для дороги</div><div className="year-rule"><CheckCircle2 size={15}/> Чередование колледж → дом → колледж в один день запрещено</div>
   <div className="year-fields"><F name="Обязательный запас на дорогу"><PolishedSelect value={cfg.commuteGap} onChange={e=>change(c=>({...c,commuteGap:Number(e.target.value) as 1|2}))}><option value={1}>1 свободная пара</option><option value={2}>2 свободные пары</option></PolishedSelect></F>
   <F name={'Дистант по умолчанию: до '+cfg.defaultOnlinePct+'%'}><input type="range" min={0} max={100} step={5} value={cfg.defaultOnlinePct} onChange={e=>change(c=>({...c,defaultOnlinePct:Number(e.target.value)}))}/></F></div>
   </section><section className="year-card"><h3>Критерии качества</h3>
    <div className="year-fields"><F name={'Штраф за окна у групп: '+cfg.groupGapWeight}><input type="range" min={0} max={100} step={5} value={cfg.groupGapWeight} onChange={e=>change(c=>({...c,groupGapWeight:Number(e.target.value)}))}/></F>
     <F name={'Штраф за окна у преподавателей: '+cfg.teacherGapWeight}><input type="range" min={0} max={100} step={5} value={cfg.teacherGapWeight} onChange={e=>change(c=>({...c,teacherGapWeight:Number(e.target.value)}))}/></F></div>
    <div className="year-note">В итоговом рейтинге сначала учитывается закрытие учебных часов, затем окна и пожелания. «Идеальным» вариант считается только при полном покрытии без нарушений обязательных ограничений.</div>
    <button className="year-next" onClick={run}><WandSparkles size={15}/> Рассчитать варианты</button>
   </section></div>}
  {tab==='results'&&<div className="year-results">
   {working?<section className="year-card"><h3>Расчёт выполняется отдельно от интерфейса</h3><p>{progress}</p><button className="year-next" onClick={stop}>Остановить</button></section>:!variants.length?<section className="year-card"><h3>Сравни четыре варианта до применения</h3><p>Расчёт пока не выполнен. Измени настройки или запусти подбор вариантов.</p><button className="year-next" onClick={run}><Play size={14}/> Рассчитать</button></section>:<>
    <div className="year-variants">{variants.map((v,i)=><button key={v.id} className={active===i?'chosen':''} onClick={()=>setActive(i)}><b>{v.name}</b><span>{Math.round(v.coveredHours/Math.max(1,v.requiredHours)*100)}% часов закрыто</span><small>{v.groupWindows} окон у групп · {v.teacherWindows} у преподавателей · {v.onlinePercent}% онлайн</small><small>{kugPractice.length} периодов практики из КУГ · {v.practiceIssues.length} требуют назначения</small><em>{v.unplaced.length||v.practiceIssues.length?'Требует доработки':'Нет неразмещённых назначений'}</em></button>)}</div>
    <div className="year-cols"><section className="year-card">
     <h3>Выбранный вариант: {selected?.name}</h3>
     <div className="year-result-kpis"><div><b>{selected?.coveredHours.toLocaleString('ru-RU')}</b><small>размещено часов</small></div><div><b>{selected?.requiredHours.toLocaleString('ru-RU')}</b><small>требуется</small></div><div><b>{selected?.unplaced.length}</b><small>неполных назначений</small></div><div><b>{selected?.practiceIssues.length}</b><small>назначений практик для проверки</small></div></div>
     <div className="year-fields"><F name="Группа"><PolishedSelect value={viewGroup} onChange={e=>setViewGroup(e.target.value)}>{GROUPS.map(g=><option key={g.id} value={g.id}>{g.id}</option>)}</PolishedSelect></F><F name="Неделя"><PolishedSelect value={viewWeek} onChange={e=>setViewWeek(Number(e.target.value))}>{periodOptions(cfg.weeks)}</PolishedSelect></F></div>
     <MiniSchedule lessons={selected?.lessons||[]} week={viewWeek} group={viewGroup} title={'Предложенное расписание · '+viewGroup}/>
     <LoadBars lessons={selected?.lessons||[]} week={viewWeek} group={viewGroup}/>
     <button className="year-next" onClick={exportVariant}><Download size={14}/> Экспорт полного варианта в JSON</button>
    </section><section className="year-card"><h3>Что не удалось распределить и почему</h3>
     <div className="year-search"><Search size={14}/><input aria-label="Поиск неразмещённых часов" value={issueSearch} placeholder="Группа, предмет, преподаватель..." onChange={e=>setIssueSearch(e.target.value)}/></div>
     <div className="year-list issues">{issues.slice(0,100).map(x=><div key={x.id}><b>{x.group} · {x.subject}</b><small>{x.teacher}</small><span>{x.reason}</span></div>)}
      {selected?.practiceIssues.slice(0,50).map((x,i)=><div key={i}><b>{x.group} · практика · неделя {x.week+1}</b><span>{x.reason}</span></div>)}
      {!issues.length&&!selected?.practiceIssues.length&&<div className="year-success"><CheckCircle2 size={16}/> Для рассчитанной демонстрационной нагрузки ошибок покрытия не обнаружено</div>}</div>
     <div className="year-note">Исправь ограничения, оборудование, практики или часы в настройках и пересчитай. Это эвристические варианты, а не доказательство глобального оптимума.</div>
     <button className="year-primary" disabled={!selected} onClick={applyVariant}><Check size={15}/> Применить весь вариант к демочерновику</button>
    </section></div>
   </>}
  </div>}
  <p className="year-footer">Демонстрационный модуль работает на синтетических данных и не изменяет Academic Core. При массовом применении изменяется только черновик в браузере; проведённые занятия сохраняются. Полные требования, тарифные правила и аудит требуют серверного решателя.</p>
 </div>;
}
