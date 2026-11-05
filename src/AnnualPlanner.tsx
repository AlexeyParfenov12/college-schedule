import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, Play, Search, SlidersHorizontal, Trash2, Users, WandSparkles, X } from 'lucide-react';
import { DAYS, GROUPS, ROOMS, TEACHERS } from './data';
import type { Lesson, CalendarEvent } from './data';
import { MiniSchedule, LoadBars } from './ScheduleVisuals';
import { defaultAnnualConfig, deriveAnnualDemands, streamKey, teacherRule, practiceWeekActive } from './yearSolver';
import type { AnnualConfig, AnnualVariant, YearDemand, PracticeBlock, TeacherPreference } from './yearSolver';
import { lessonDate } from './plannerDomain';

type Props={lessons:Lesson[];calendar:CalendarEvent[];onApply:(variant:AnnualVariant,weeks:number)=>void;notify:(s:string)=>void};
type Tab='load'|'teachers'|'rooms'|'groups'|'practice'|'distance'|'results';
const tabs:{id:Tab;name:string}[]=[
 {id:'load',name:'Нагрузка'},{id:'teachers',name:'Преподаватели'},{id:'rooms',name:'Кабинеты'},
 {id:'groups',name:'Потоки и подгруппы'},{id:'practice',name:'Практика'},
 {id:'distance',name:'Дистант и дорога'},{id:'results',name:'4 варианта'}
];
const F=({name,children}:{name:string;children:React.ReactNode})=><label className="year-field"><span>{name}</span>{children}</label>;
const read=():AnnualConfig=>{try{const data=localStorage.getItem('college-year-preferences-v2');if(data)return {...defaultAnnualConfig(),...JSON.parse(data)}}catch{}return defaultAnnualConfig()};
const key=(name:string,subject:string)=>streamKey(name,subject);
const periodOptions=(weeks:number)=>Array.from({length:weeks},(_,w)=><option key={w} value={w}>{w+1}-я · {lessonDate(w,0)}</option>);
export default function AnnualPlanner({lessons,calendar,onApply,notify}:Props){
 const [cfg,setCfg]=useState<AnnualConfig>(read);
 const [tab,setTab]=useState<Tab>('load');
 const [demands,setDemands]=useState<YearDemand[]>(()=>deriveAnnualDemands(lessons,40,4));
 const [teacher,setTeacher]=useState(TEACHERS[0]),[teacherSearch,setTeacherSearch]=useState('');
 const [roomSearch,setRoomSearch]=useState(''),[group,setGroup]=useState('П-21');
 const [practiceGroup,setPracticeGroup]=useState('П-21'),[practiceKind,setPracticeKind]=useState<'college'|'company'>('college');
 const [practiceStart,setPracticeStart]=useState(5),[practiceWeeks,setPracticeWeeks]=useState(2);
 const [practiceRoom,setPracticeRoom]=useState('109'),[practiceTeacher,setPracticeTeacher]=useState(TEACHERS[0]);
 const [practiceFrom,setPracticeFrom]=useState(1),[practiceTo,setPracticeTo]=useState(4),[practiceTitle,setPracticeTitle]=useState('Учебная практика');
 const [practiceDays,setPracticeDays]=useState([0,1,2,3,4]);
 const [variants,setVariants]=useState<AnnualVariant[]>([]),[active,setActive]=useState(0);
 const [viewWeek,setViewWeek]=useState(0),[viewGroup,setViewGroup]=useState('П-21'),[issueSearch,setIssueSearch]=useState('');
 const [working,setWorking]=useState(false),[progress,setProgress]=useState('');
 const worker=useRef<Worker|null>(null);
 const change=(next:(config:AnnualConfig)=>AnnualConfig)=>{
  setCfg(current=>{const value=next(current);try{localStorage.setItem('college-year-preferences-v2',JSON.stringify(value))}catch{}return value});
  setVariants([]);
 };
 useEffect(()=>()=>{worker.current?.terminate()},[]);
 const rule=teacherRule(cfg,teacher);
 const teacherOptions=TEACHERS.filter(x=>x.toLowerCase().includes(teacherSearch.toLowerCase()));
 const activeRooms=ROOMS.filter(r=>r.active&&cfg.activeRooms.includes(r.id));
 const practiceRooms=activeRooms.filter(r=>r.capacity>=(GROUPS.find(g=>g.id===practiceGroup)?.count||0));
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
 const selected=variants[active];
 const issues=(selected?.unplaced||[]).filter(x=>(x.group+x.subject+x.teacher+x.reason).toLowerCase().includes(issueSearch.toLowerCase()));
 const totalHours=demands.reduce((s,d)=>s+d.requiredPairs*2,0);
 const applyTeacher=(changes:Partial<TeacherPreference>)=>change(c=>({...c,teacherPreferences:{...c.teacherPreferences,[teacher]:{...teacherRule(c,teacher),...changes}}}));
 const run=()=>{
  worker.current?.terminate();setWorking(true);setProgress('Вычисление вариантов...');setVariants([]);setTab('results');
  const w=new Worker(new URL('./yearPlanner.worker.ts',import.meta.url),{type:'module'});worker.current=w;
  w.onmessage=(e:MessageEvent<{type:string;current?:number;name?:string;variants?:AnnualVariant[];message?:string}>)=>{
   if(e.data.type==='progress')setProgress('Вариант '+e.data.current+'/4: '+e.data.name);
   if(e.data.type==='result'){setVariants(e.data.variants||[]);setActive(0);setWorking(false);setProgress('Готово');w.terminate();worker.current=null}
   if(e.data.type==='error'){setProgress(e.data.message||'Ошибка расчёта');setWorking(false);notify(e.data.message||'Ошибка расчёта');w.terminate();worker.current=null}
  };
  w.onerror=e=>{setWorking(false);setProgress('Ошибка запуска расчёта');notify(e.message);w.terminate();worker.current=null};
  w.postMessage({demands,config:cfg,calendar,locked:lessons.filter(l=>l.status==='held')});
 };
 const stop=()=>{worker.current?.terminate();worker.current=null;setWorking(false);setProgress('Расчёт остановлен')};
 const addPractice=()=>{
  const groupData=GROUPS.find(g=>g.id===practiceGroup);
  const room=ROOMS.find(r=>r.id===practiceRoom);
  if(practiceStart+practiceWeeks>cfg.weeks)return notify('Длительность выходит за пределы учебного года');
  if(practiceKind==='college'&&(!room||!cfg.activeRooms.includes(practiceRoom)||room.capacity<(groupData?.count||0)))return notify('Выбери действующий кабинет достаточной вместимости');
  if(cfg.practiceBlocks.some(p=>p.group===practiceGroup&&
   practiceStart<p.startWeek+p.durationWeeks&&p.startWeek<practiceStart+practiceWeeks))return notify('У группы уже есть практика в эти недели');
  const block:PracticeBlock={id:'p-'+Date.now().toString(36),group:practiceGroup,
   kind:practiceKind,title:practiceTitle.trim()||'Учебная практика',teacher:practiceTeacher,
   startWeek:practiceStart,durationWeeks:practiceWeeks,days:practiceDays,
   fromSlot:practiceFrom,toSlot:practiceTo,room:practiceKind==='college'?practiceRoom:''};
  change(c=>({...c,practiceBlocks:[...c.practiceBlocks,block]}));notify('Непрерывная практика добавлена в годовой план');
 };
 const exportVariant=()=>{
  if(!selected)return;
  const blob=new Blob([JSON.stringify({kind:'college-annual-demo-v1',variant:selected,configuration:cfg},null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='college-year-'+selected.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
 };
 const applyVariant=()=>{
  if(!selected)return;
  if(!window.confirm('Заменить черновое расписание '+cfg.weeks+' недель для всех групп выбранным вариантом? Проведённые занятия сохраняются. Продолжить?'))return;
  onApply(selected,cfg.weeks);
 };
 const nextTab=()=>{const i=tabs.findIndex(t=>t.id===tab);setTab(tabs[Math.min(i+1,tabs.length-1)].id)};
 return <div className="year-planner" data-testid="year-planner">
  <div className="year-hero"><div><span>Мастер учебной части · демо-решатель</span><h2>Годовое расписание всех групп</h2><p>Построй четыре альтернативы на основе нагрузок, пожеланий преподавателей, рабочих кабинетов, подгрупп, практик и домашнего дистанта.</p></div>
   <button className="year-primary" onClick={run} disabled={working}><Play size={15}/> Рассчитать 4 варианта</button></div>
  <div className="year-kpis"><div><b>{GROUPS.length}</b><small>групп</small></div><div><b>{demands.length}</b><small>дисциплин / назначений</small></div><div><b>{totalHours.toLocaleString('ru-RU')}</b><small>плановых часов</small></div><div><b>{activeRooms.length}</b><small>кабинетов</small></div><div><b>{cfg.practiceBlocks.length}</b><small>блоков практики</small></div></div>
  <div className="year-tabs" role="tablist" aria-label="Настройка годового расписания">{tabs.map(x=><button role="tab" aria-selected={tab===x.id} className={tab===x.id?'active':''} key={x.id} onClick={()=>setTab(x.id)}>{x.name}</button>)}</div>
  {tab==='load'&&<div className="year-cols"><section className="year-card"><h3><BookOpen size={16}/> Требования к учебным часам</h3>
   <p>В демоверсии предметы и плановые часы восстановлены из примеров расписания. В реальной системе сюда подключаются учебные планы, TeachingAssignment и подтверждённые нагрузки Academic Core.</p>
   <div className="year-fields"><F name="Период"><select value={cfg.weeks} onChange={e=>{const weeks=Number(e.target.value);change(c=>({...c,weeks,practiceBlocks:c.practiceBlocks.filter(p=>p.startWeek+p.durationWeeks<=weeks)}));setDemands(d=>d.map(x=>({...x,requiredPairs:x.pairsPerWeek*weeks})))}}><option value={16}>16 недель</option><option value={32}>32 недели</option><option value={40}>40 недель · учебный год</option></select></F>
   <F name="Группа"><select value={group} onChange={e=>setGroup(e.target.value)}>{GROUPS.map(g=><option key={g.id} value={g.id}>{g.id}</option>)}</select></F></div>
   <div className="year-table-scroll"><table><thead><tr><th>Дисциплина</th><th>Преподаватель</th><th>Пар за год</th></tr></thead><tbody>{selectedDemands.map(d=><tr key={d.id}><td>{d.subject}</td><td>{d.teacher}</td><td><input type="number" min={0} max={600} aria-label={'Пар за год '+d.subject} value={d.requiredPairs} onChange={e=>{setDemands(old=>old.map(x=>x.id===d.id?{...x,requiredPairs:Math.max(0,Number(e.target.value)||0)}:x));setVariants([])}}/></td></tr>)}</tbody></table></div>
   </section><section className="year-card"><h3><Clock3 size={16}/> Общие ограничения</h3><div className="year-fields">
    <F name="Учебных дней"><select value={cfg.days} onChange={e=>change(c=>({...c,days:Number(e.target.value) as 5|6}))}><option value={5}>Пн–Пт</option><option value={6}>Пн–Сб</option></select></F>
    <F name="Пар в день"><select value={cfg.slotsPerDay} onChange={e=>change(c=>({...c,slotsPerDay:Number(e.target.value)}))}>{[3,4,5,6].map(x=><option key={x} value={x}>{x}</option>)}</select></F></div>
    <div className="year-rules"><span><Check size={14}/> Группа и преподаватель не дублируются во времени</span><span><Check size={14}/> Кабинет проверяется по занятости и местам</span><span><Check size={14}/> Учебные периоды исключают запрещённые даты</span><span><Check size={14}/> Практики закрепляют аудитории на недели</span></div><button className="year-next" onClick={nextTab}>Настроить преподавателей <ArrowRight size={14}/></button></section></div>}
  {tab==='teachers'&&<div className="year-cols"><section className="year-card"><h3><Users size={16}/> Преподаватели</h3>
   <div className="year-search"><Search size={14}/><input aria-label="Поиск преподавателя для правил" placeholder="Найти…" value={teacherSearch} onChange={e=>setTeacherSearch(e.target.value)}/></div>
   <div className="year-list">{TEACHERS.filter(t=>t.toLowerCase().includes(teacherSearch.toLowerCase())).map(t=><button key={t} className={teacher===t?'chosen':''} onClick={()=>setTeacher(t)}>{t}{cfg.teacherPreferences[t]&&<Check size={13}/>}</button>)}</div>
   </section><section className="year-card"><h3><SlidersHorizontal size={16}/> {teacher}</h3><p>Жёсткие запреты не нарушаются при расчёте. Предпочтения помогают сократить окна.</p>
    <h4>Не ставить занятия в дни</h4><div className="year-day-choices">{DAYS.slice(0,cfg.days).map((d,i)=><label key={d} className={rule.daysOff.includes(i)?'chosen':''}><input type="checkbox" checked={rule.daysOff.includes(i)} onChange={e=>applyTeacher({daysOff:e.target.checked?[...rule.daysOff,i]:rule.daysOff.filter(x=>x!==i)})}/>{d}</label>)}</div>
    <div className="year-fields"><F name="Начиная с пары"><select value={rule.fromSlot} onChange={e=>applyTeacher({fromSlot:Number(e.target.value)})}>{[1,2,3,4,5,6].map(x=><option key={x} value={x}>{x}</option>)}</select></F>
    <F name="Не позже пары"><select value={rule.toSlot} onChange={e=>applyTeacher({toSlot:Number(e.target.value)})}>{[1,2,3,4,5,6].map(x=><option key={x} value={x}>{x}</option>)}</select></F></div>
    <h4>Запретить отдельные пары</h4>
    <div className="year-forbidden">{DAYS.slice(0,cfg.days).map((d,day)=><div key={d}><span>{d}</span>{Array.from({length:cfg.slotsPerDay},(_,i)=>i+1).map(slot=>{
     const banned=rule.forbidden.some(x=>x.day===day&&slot>=x.from&&slot<=x.to);
     return <button key={slot} className={banned?'off':''} title={banned?'Запрещено':'Допустимо'} onClick={()=>applyTeacher({forbidden:banned?rule.forbidden.filter(x=>!(x.day===day&&slot>=x.from&&slot<=x.to)):[...rule.forbidden,{day,from:slot,to:slot}]})}>{slot}</button>;
    })}</div>)}</div>
    <F name={'Максимум дистанционных пар: '+rule.maxOnlinePct+'%'}><input type="range" min={0} max={100} step={5} value={rule.maxOnlinePct} onChange={e=>applyTeacher({maxOnlinePct:Number(e.target.value)})}/></F>
    <h4>Предпочтительные дни</h4><div className="year-day-choices">{DAYS.slice(0,cfg.days).map((d,i)=><label key={d} className={rule.preferDays.includes(i)?'preferred':''}><input type="checkbox" checked={rule.preferDays.includes(i)} onChange={e=>applyTeacher({preferDays:e.target.checked?[...rule.preferDays,i]:rule.preferDays.filter(x=>x!==i)})}/>{d}</label>)}</div>
   <button className="year-next" onClick={nextTab}>Настроить кабинеты <ArrowRight size={14}/></button></section></div>}
  {tab==='rooms'&&<div className="year-cols"><section className="year-card"><h3>Работающие аудитории</h3><div className="year-search"><Search size={14}/><input aria-label="Найти аудиторию для годового плана" placeholder="Номер, корпус, тип..." value={roomSearch} onChange={e=>setRoomSearch(e.target.value)}/></div>
    <div className="year-list rooms">{ROOMS.filter(r=>(r.id+' '+r.kind+' '+r.building).toLowerCase().includes(roomSearch.toLowerCase())).map(r=><label key={r.id}><input type="checkbox" checked={cfg.activeRooms.includes(r.id)} onChange={e=>change(c=>({...c,activeRooms:e.target.checked?[...c.activeRooms,r.id]:c.activeRooms.filter(x=>x!==r.id)}))}/><b>{r.id}</b><small>{r.kind} · {r.pc?r.pc+' ПК':r.capacity+' мест'} · корпус {r.building}</small></label>)}</div>
   </section><section className="year-card"><h3>Доступный фонд</h3><div className="year-room-kpis"><div><b>{activeRooms.length}</b><small>всего</small></div><div><b>{activeRooms.filter(r=>r.pc>0).length}</b><small>компьютерных</small></div><div><b>{activeRooms.filter(r=>r.capacity>=60).length}</b><small>больших залов</small></div></div><p>Закрытая аудитория исключается из подбора. Зарезервированные под практику кабинеты будут недоступны другим группам в закреплённые пары всех недель практики.</p><button className="year-next" onClick={nextTab}>Потоки и подгруппы <ArrowRight size={14}/></button></section></div>}
  {tab==='groups'&&<div className="year-cols"><section className="year-card"><h3>Разрешённые потоки</h3><p>Настрой, какие общие лекции разрешено объединять. Для потоков обязательны один преподаватель и дисциплина, а также аудитория на всех участников. В прототипе это пока разрешения для будущего решателя: фактическая автоматическая группировка потоков не выполняется.</p>
    <div className="year-list">{[...new Map(demands.map(d=>[streamKey(d.teacher,d.subject),{teacher:d.teacher,subject:d.subject}])).values()].filter(v=>demands.filter(d=>d.teacher===v.teacher&&d.subject===v.subject).length>1).map(v=>{const code=streamKey(v.teacher,v.subject);return <label key={code}><input type="checkbox" checked={cfg.allowStreams.includes(code)} onChange={e=>change(c=>({...c,allowStreams:e.target.checked?[...c.allowStreams,code]:c.allowStreams.filter(x=>x!==code)}))}/><span>{v.subject} · {v.teacher}</span></label>})}</div>
   </section><section className="year-card"><h3>Подгруппы и сопровождающие</h3><p>Для практики с недостаточным количеством компьютеров разреши разделение группы и наличие сопровождающего. Только тогда предлагаются два кабинета одновременно.</p>
   <div className="year-list">{GROUPS.map(g=><div className="year-group-row" key={g.id}><b>{g.id} · {g.count} человек</b><label><input type="checkbox" checked={cfg.allowSubgroups.includes(g.id)} onChange={e=>change(c=>({...c,allowSubgroups:e.target.checked?[...c.allowSubgroups,g.id]:c.allowSubgroups.filter(x=>x!==g.id)}))}/> Делить</label><label><input type="checkbox" checked={cfg.assistedSubgroups.includes(g.id)} onChange={e=>change(c=>({...c,assistedSubgroups:e.target.checked?[...c.assistedSubgroups,g.id]:c.assistedSubgroups.filter(x=>x!==g.id)}))}/> Сопровождение</label></div>)}</div>
    <button className="year-next" onClick={nextTab}>Закрепить практики <ArrowRight size={14}/></button></section></div>}
  {tab==='practice'&&<div className="year-cols"><section className="year-card"><h3><BookOpen size={16}/> Непрерывная практика · 1–несколько недель</h3>
    <p>Группа работает в одном закреплённом кабинете весь выбранный период. В эти недели обычные занятия группы не назначаются. Другие группы не могут занять кабинет в закреплённое время. Для производственной практики на предприятии кабинет колледжа не требуется.</p>
    <div className="year-fields"><F name="Группа"><select value={practiceGroup} onChange={e=>setPracticeGroup(e.target.value)}>{GROUPS.map(g=><option key={g.id} value={g.id}>{g.id} · {g.count} чел.</option>)}</select></F>
    <F name="Тип практики"><select value={practiceKind} onChange={e=>setPracticeKind(e.target.value as 'college'|'company')}><option value="college">Учебная · в колледже</option><option value="company">Производственная · на предприятии</option></select></F>
    <F name="Название практики"><input value={practiceTitle} onChange={e=>setPracticeTitle(e.target.value)}/></F>
    <F name="Руководитель"><select value={practiceTeacher} onChange={e=>setPracticeTeacher(e.target.value)}>{TEACHERS.map(t=><option key={t} value={t}>{t}</option>)}</select></F>
    <F name="Первая неделя"><select value={practiceStart} onChange={e=>setPracticeStart(Number(e.target.value))}>{periodOptions(cfg.weeks)}</select></F>
    <F name="Продолжительность"><input type="number" min={1} max={cfg.weeks} value={practiceWeeks} onChange={e=>setPracticeWeeks(Math.max(1,Math.min(cfg.weeks,Number(e.target.value)||1)))}/></F>
    {practiceKind==='college'&&<F name="Закреплённая аудитория на весь период"><select value={practiceRoom} onChange={e=>setPracticeRoom(e.target.value)}><option value="">Выбери кабинет</option>{practiceRooms.map(r=><option value={r.id} key={r.id}>{r.id} · {r.kind} · {r.capacity} мест · {r.pc} ПК</option>)}</select></F>}
    <div className="year-fields"><F name="С пары"><select value={practiceFrom} onChange={e=>setPracticeFrom(Number(e.target.value))}>{[1,2,3,4,5,6].map(x=><option key={x} value={x}>{x}</option>)}</select></F><F name="По пару"><select value={practiceTo} onChange={e=>setPracticeTo(Number(e.target.value))}>{[1,2,3,4,5,6].map(x=><option key={x} value={x}>{x}</option>)}</select></F></div>
    <div className="year-day-choices">{DAYS.slice(0,cfg.days).map((d,i)=><label key={d} className={practiceDays.includes(i)?'chosen':''}><input type="checkbox" checked={practiceDays.includes(i)} onChange={e=>setPracticeDays(old=>e.target.checked?[...old,i]:old.filter(x=>x!==i))}/>{d}</label>)}</div>
    <button className="year-next" disabled={!practiceDays.length||practiceFrom>practiceTo||practiceStart+practiceWeeks>cfg.weeks} onClick={addPractice}>Закрепить практику <Check size={14}/></button>
   </section><section className="year-card"><h3>Календарь закреплённых практик</h3>
    <div className="year-practice-timeline">{cfg.practiceBlocks.map(p=><div className="year-practice-item" key={p.id}><div><b>{p.group} · {p.title}</b><small>{p.kind==='college'?'Каб. '+p.room:'Предприятие'} · недели {p.startWeek+1}–{p.startWeek+p.durationWeeks} · пары {p.fromSlot}–{p.toSlot}</small></div><button aria-label={'Удалить практику '+p.group} onClick={()=>change(c=>({...c,practiceBlocks:c.practiceBlocks.filter(x=>x.id!==p.id)}))}><Trash2 size={14}/></button></div>)}
    {!cfg.practiceBlocks.length&&<p>Пока нет закреплённых блоков практики. Добавь первую практику слева.</p>}</div>
    <div className="year-practice-weeks">{Array.from({length:cfg.weeks},(_,w)=><div key={w} className={cfg.practiceBlocks.some(p=>p.group===practiceGroup&&practiceWeekActive(p,w))?'booked':''} title={'Неделя '+(w+1)}>{w+1}</div>)}</div>
    <p>Цветные недели означают, что выбранная группа закреплена на практике. Практика резервирует ресурсы автоматически при годовом расчёте.</p>
    <button className="year-next" onClick={nextTab}>Дистант и дорога <ArrowRight size={14}/></button></section></div>}
  {tab==='distance'&&<div className="year-cols"><section className="year-card"><h3>Дистант из дома и дорога</h3><div className="year-rule"><CheckCircle2 size={15}/> Студент и преподаватель не могут одновременно быть дома и в колледже</div><div className="year-rule"><CheckCircle2 size={15}/> Между очной и онлайн-парой — обязательный свободный промежуток для дороги</div><div className="year-rule"><CheckCircle2 size={15}/> Чередование колледж → дом → колледж в один день запрещено</div>
   <div className="year-fields"><F name="Обязательный запас на дорогу"><select value={cfg.commuteGap} onChange={e=>change(c=>({...c,commuteGap:Number(e.target.value) as 1|2}))}><option value={1}>1 свободная пара</option><option value={2}>2 свободные пары</option></select></F>
   <F name={'Дистант по умолчанию: до '+cfg.defaultOnlinePct+'%'}><input type="range" min={0} max={100} step={5} value={cfg.defaultOnlinePct} onChange={e=>change(c=>({...c,defaultOnlinePct:Number(e.target.value)}))}/></F></div>
   </section><section className="year-card"><h3>Критерии качества</h3>
    <div className="year-fields"><F name={'Штраф за окна у групп: '+cfg.groupGapWeight}><input type="range" min={0} max={100} step={5} value={cfg.groupGapWeight} onChange={e=>change(c=>({...c,groupGapWeight:Number(e.target.value)}))}/></F>
     <F name={'Штраф за окна у преподавателей: '+cfg.teacherGapWeight}><input type="range" min={0} max={100} step={5} value={cfg.teacherGapWeight} onChange={e=>change(c=>({...c,teacherGapWeight:Number(e.target.value)}))}/></F></div>
    <div className="year-note">В итоговом рейтинге сначала учитывается закрытие учебных часов, затем окна и пожелания. «Идеальным» вариант считается только при полном покрытии без нарушений обязательных ограничений.</div>
    <button className="year-next" onClick={run}><WandSparkles size={15}/> Рассчитать варианты</button>
   </section></div>}
  {tab==='results'&&<div className="year-results">
   {working?<section className="year-card"><h3>Расчёт выполняется отдельно от интерфейса</h3><p>{progress}</p><button className="year-next" onClick={stop}>Остановить</button></section>:!variants.length?<section className="year-card"><h3>Сравни четыре варианта до применения</h3><p>Расчёт пока не выполнен. Измени настройки или запусти подбор вариантов.</p><button className="year-next" onClick={run}><Play size={14}/> Рассчитать</button></section>:<>
    <div className="year-variants">{variants.map((v,i)=><button key={v.id} className={active===i?'chosen':''} onClick={()=>setActive(i)}><b>{v.name}</b><span>{Math.round(v.coveredHours/Math.max(1,v.requiredHours)*100)}% часов закрыто</span><small>{v.groupWindows} окон у групп · {v.teacherWindows} у преподавателей · {v.onlinePercent}% онлайн</small><small>{v.practicePairs} пар практики · {v.practiceIssues.length} проблем практики</small><em>{v.unplaced.length||v.practiceIssues.length?'Требует доработки':'Нет неразмещённых назначений'}</em></button>)}</div>
    <div className="year-cols"><section className="year-card">
     <h3>Выбранный вариант: {selected?.name}</h3>
     <div className="year-result-kpis"><div><b>{selected?.coveredHours.toLocaleString('ru-RU')}</b><small>размещено часов</small></div><div><b>{selected?.requiredHours.toLocaleString('ru-RU')}</b><small>требуется</small></div><div><b>{selected?.unplaced.length}</b><small>неполных назначений</small></div><div><b>{selected?.practiceIssues.length}</b><small>конфликтов практик</small></div></div>
     <div className="year-fields"><F name="Группа"><select value={viewGroup} onChange={e=>setViewGroup(e.target.value)}>{GROUPS.map(g=><option key={g.id} value={g.id}>{g.id}</option>)}</select></F><F name="Неделя"><select value={viewWeek} onChange={e=>setViewWeek(Number(e.target.value))}>{periodOptions(cfg.weeks)}</select></F></div>
     <MiniSchedule lessons={selected?.lessons||[]} week={viewWeek} group={viewGroup} title={'Предложенное расписание · '+viewGroup}/>
     <LoadBars lessons={selected?.lessons||[]} week={viewWeek} group={viewGroup}/>
     <button className="year-next" onClick={exportVariant}><Download size={14}/> Экспорт полного варианта (40 недель) в JSON</button>
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
