import PolishedSelect from './PolishedSelect';
import { useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { AlertTriangle, ArrowLeftRight, BarChart3, Bell, BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight, Clock, Copy, Download, FileSpreadsheet, Filter, GitFork, GraduationCap, History, Laptop, Network, Plus, Printer, RotateCcw, Search, Send, Settings2, ShieldCheck, SlidersHorizontal, Trash2, Users, WandSparkles, X } from 'lucide-react';
import { GROUPS, TEACHERS, SUBJECTS, ROOMS, ROSTERS, CALENDAR, RULES, ABSENCES, DAYS, TIMES, TYPES, MODES, NAV } from './data';
import type { Lesson, Absence, CalendarEvent, Rule, Mode, Participant } from './data';
import { migrateDemoWinterPeriod } from './demoCalendarMigration';
import { exportCSV, exportJSON, findFree, validate, groupCount, workload, reportRows, QUALIFICATIONS, occupiedRooms } from './demoLogic';
import { CalendarStudio, TemplateStudio, GeneratorStudio } from './PlanningTools';
import { MiniSchedule, LoadBars, PeriodTimeline } from './ScheduleVisuals';
import { WEEK_COUNT, calendarIssues, lessonDate } from './plannerDomain';
import { LEGACY_WEEK_OFFSET, shiftLegacyWeek } from './weekTimeline';
import RoomManager from './RoomManager';
import { demoAcademicDemands, demoAcademicHorizon } from './academicPlanning';
import { DEFAULT_SUBSTITUTION_POLICY, suggestSubstitutions, applySubstitutionOption, revertSubstitution } from './substitutionPlanner';
import type { SubstitutionPolicy, SubstitutionOption } from './substitutionPlanner';
import { practicePeriodsFromKug } from './kugPractice';
import { practicePeriodStamp, practiceAssignmentProblems } from './practiceAssignments';
import type { AcademicPracticeAssignment } from './practiceAssignments';
import { previewBulkFormat } from './bulkFormatPlanning';
import type { BulkFormatPreview } from './bulkFormatPlanning';

type Screen=typeof NAV[number][0];
type Snapshot={id:string;label:string;at:string;week:number;lessons:Lesson[];notice:string};
type Template={id:string;name:string;week:number;group:string;weeks:number;locked:boolean};
type Roster=Record<string,{id:string;name:string;subgroup:number}[]>;
type RoomsMap=Record<string,{blocked:boolean;reason:string}>;
type Store={calendar:CalendarEvent[];roster:Roster;absences:Absence[];rooms:RoomsMap;rules:Rule[];snapshots:Snapshot[];templates:Template[];times:string[];notifications:string[];substitutionPolicy:SubstitutionPolicy;practiceAssignments:AcademicPracticeAssignment[]};
/** Earlier demo builds incorrectly shifted absence weekday indexes by the academic-week offset. */
export const normalizeAbsenceDays=(a:Absence):Absence=>({
 ...a,from:a.from>=LEGACY_WEEK_OFFSET&&a.from<LEGACY_WEEK_OFFSET+6?a.from-LEGACY_WEEK_OFFSET:a.from,
 to:a.to>=LEGACY_WEEK_OFFSET&&a.to<LEGACY_WEEK_OFFSET+6?a.to-LEGACY_WEEK_OFFSET:a.to,
 week:a.week??LEGACY_WEEK_OFFSET
});
const key='college-schedule-extras-v2';
const legacyKey='college-schedule-extras-v1';
const defaults=():Store=>({calendar:CALENDAR,roster:ROSTERS,absences:ABSENCES.map(x=>({...x})),rooms:{},rules:RULES,snapshots:[],templates:[{id:'template-a',name:'Двухнедельный цикл ИТ',week:LEGACY_WEEK_OFFSET,group:'П-21',weeks:2,locked:true},{id:'template-b',name:'Основной цикл радиотехники',week:LEGACY_WEEK_OFFSET,group:'Р-21',weeks:4,locked:false}],times:[...TIMES],notifications:[],substitutionPolicy:{...DEFAULT_SUBSTITUTION_POLICY},practiceAssignments:[]});
/** Read v1 once in memory. Its week numbers are November-based; the v1 key stays untouched. */
const saved=():Store=>{try{
 const modern=localStorage.getItem(key);
 if(modern){const current=JSON.parse(modern) as Partial<Store>;return {...defaults(),...current,absences:(current.absences??ABSENCES).map(normalizeAbsenceDays),calendar:migrateDemoWinterPeriod(current.calendar??CALENDAR)}};
 const legacy=localStorage.getItem(legacyKey);
 if(legacy){
  const old=JSON.parse(legacy) as Partial<Store>;
  return {...defaults(),...old,calendar:migrateDemoWinterPeriod(old.calendar??CALENDAR),
   templates:old.templates?.map(t=>({...t,week:t.week+LEGACY_WEEK_OFFSET}))??defaults().templates,
   absences:old.absences?.map(normalizeAbsenceDays)??defaults().absences,
   snapshots:old.snapshots?.map(v=>({...v,week:v.week+LEGACY_WEEK_OFFSET,
    lessons:v.lessons.map(shiftLegacyWeek)}))??[]
  };
 }
}catch{}return defaults()};
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const stamp=()=>new Date().toLocaleString('ru-RU');
const validRoom=(room:string)=>ROOMS.find(r=>r.id===room);
const dd=(v:string)=>v.slice(0,10);
const st=(x:string)=>x?x:'—';
type Props={
 screen:Screen;
 items:Lesson[]; setItems:Dispatch<SetStateAction<Lesson[]>>;
 week:number; setWeek:Dispatch<SetStateAction<number>>;
 group:string; setGroup:Dispatch<SetStateAction<string>>;
 teacher:string; setTeacher:Dispatch<SetStateAction<string>>;
 room:string; setRoom:Dispatch<SetStateAction<string>>;
 onNavigate:(key:Screen)=>void; onEdit:(item:Lesson)=>void; onFocusLesson:(lesson:Lesson)=>void;
 notify:(text:string)=>void; markDraft:()=>void;
 status:'draft'|'published'; setStatus:Dispatch<SetStateAction<'draft'|'published'>>;
 density:'compact'|'standard'; setDensity:Dispatch<SetStateAction<'compact'|'standard'>>;
 days:number; setDays:Dispatch<SetStateAction<number>>;
};
function Panel({title,children,aside}:{title:string;children:ReactNode;aside?:ReactNode}){return <section className="studio-panel"><header><strong>{title}</strong>{aside}</header><div className="studio-inner">{children}</div></section>}
function Button({children,onClick,primary=false,disabled=false,danger=false}:{children:ReactNode;onClick:()=>void;primary?:boolean;disabled?:boolean;danger?:boolean}){return <button type="button" className={'studio-btn '+(primary?'strong ':'')+(danger?'danger':'')} disabled={disabled} onClick={onClick}>{children}</button>}
function Select({value,onChange,items}:{value:string|number;onChange:(value:string)=>void;items:{id:string|number;label:string}[]}){return <PolishedSelect value={value} onChange={e=>onChange(e.target.value)}>{items.map((v,i)=><option key={i} value={v.id}>{v.label}</option>)}</PolishedSelect>}
function Field({title,children}:{title:string;children:ReactNode}){return <label className="studio-field"><span>{title}</span>{children}</label>}
const opts=(xs:string[])=>xs.map(x=>({id:x,label:x}));
const weekOpts=Array.from({length:WEEK_COUNT},(_,i)=>({id:i,label:'Учебная неделя '+(i+1)}));
function Pill({children,color='gray'}:{children:ReactNode;color?:'gray'|'green'|'red'|'amber'|'blue'|'lime'}){return <span className={'studio-pill '+color}>{children}</span>}
function Rows({heads,rows}:{heads:string[];rows:ReactNode[][]}){
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(0);
 const [pageSize,setPageSize]=useState(12);
 const filtered=rows.filter(row=>row.some(v=>(typeof v==='string'||typeof v==='number')&&String(v).toLowerCase().includes(query.trim().toLowerCase())));
 const searchable=rows.length>12;
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const actualPage=Math.min(page,totalPages-1);
 const shown=filtered.slice(actualPage*pageSize,(actualPage+1)*pageSize);
 return <div className="studio-table-shell">
   {searchable&&<div className="studio-table-tools">
    <div className="assist-search"><Search size={13}/><input aria-label="Фильтр строк таблицы" placeholder="Найти в таблице…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/></div>
    <span className="studio-table-count">{filtered.length} записей</span>
    <PolishedSelect aria-label="Строк на странице" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(0)}}><option value={12}>12 строк</option><option value={24}>24 строки</option><option value={48}>48 строк</option></PolishedSelect>
   </div>}
   <div className="studio-table-scroll"><table className="studio-table"><thead><tr>{heads.map((x,i)=><th key={i}>{x}</th>)}</tr></thead>
    <tbody>{shown.map((row,i)=><tr key={actualPage*pageSize+i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody>
   </table>{!shown.length&&<div className="studio-table-empty">Нет строк по выбранному фильтру</div>}</div>
   {filtered.length>pageSize&&<div className="studio-table-pagination"><span>{actualPage*pageSize+1}–{Math.min((actualPage+1)*pageSize,filtered.length)} из {filtered.length}</span><button aria-label="Предыдущая страница таблицы" disabled={actualPage===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>‹</button><span>{actualPage+1}/{totalPages}</span><button aria-label="Следующая страница таблицы" disabled={actualPage>=totalPages-1} onClick={()=>setPage(p=>p+1)}>›</button></div>}
 </div>;
}
function Notice({children,kind='info'}:{children:ReactNode;kind?:'info'|'warning'}){return <div className={'studio-note '+kind}><AlertTriangle size={15}/><span>{children}</span></div>}
function BaseStat({value,label,emphasis=''}:{value:string|number;label:string;emphasis?:string}){return <div className="studio-stat"><strong className={emphasis}>{value}</strong><small>{label}</small></div>}
function MiniButton({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button type="button" className="studio-link" onClick={onClick}>{children}<ChevronRight size={13}/></button>}

export default function AdvancedWorkflows(p:Props){
 const [db,setDb]=useState<Store>(saved);
 const put=(update:(prev:Store)=>Store)=>{setDb(v=>{const next=update(v);try{localStorage.setItem(key,JSON.stringify(next))}catch{p.notify('Хранилище браузера заполнено: история может не сохраниться')}return next})};
 const editData=(fn:(prev:Lesson[])=>Lesson[],msg='Изменения сохранены в черновике')=>{p.setItems(fn);p.markDraft();p.notify(msg)};
 const curr=p.items.filter(x=>(x.week||0)===p.week);
 const [proposal,setProposal]=useState<ReturnType<typeof findFree>[number]|null>(null);
 const [query,setQuery]=useState('');
 const [groupFilter,setGroupFilter]=useState('');
 const [showVisual,setShowVisual]=useState(true);
 const [subject,setSubject]=useState('Программирование');
 const [practicePeriodId,setPracticePeriodId]=useState('');
 const [practiceSupervisor,setPracticeSupervisor]=useState('');
 const [practiceLocation,setPracticeLocation]=useState('');
 const [practiceHours,setPracticeHours]=useState('');
 const [practiceStartSlot,setPracticeStartSlot]=useState(1);
 const [day,setDay]=useState(1);
 const [slot,setSlot]=useState(2);
 const [selectedRoom,setSelectedRoom]=useState(ROOMS[0].id);
 const [teacher,setTeacher]=useState(TEACHERS[0]);
 const [groups,setGroups]=useState<string[]>(['П-21','П-22']);
 const [groupDetails,setGroupDetails]=useState('П-21');
 const [subgroupCount,setSubgroupCount]=useState(2);
 const [reason,setReason]=useState('Больничный');
 const [fromDay,setFromDay]=useState(0);
 const [toDay,setToDay]=useState(2);
 const [absenceId,setAbsenceId]=useState('abs-1');
 const [mode,setMode]=useState<Mode>('online');
 const [formatGroup,setFormatGroup]=useState('П-21');
 const [formatScope,setFormatScope]=useState<'one'|'department'|'all'>('one');
 const [formatDepartment,setFormatDepartment]=useState(GROUPS[0].department);
 const [bulkPreview,setBulkPreview]=useState<BulkFormatPreview|null>(null);
 const [bulkReviewed,setBulkReviewed]=useState(false);
 const [checkedSubstitution,setCheckedSubstitution]=useState<{lessonId:string;optionKey:string;week:number;absenceId:string}|null>(null);
 const [substitutionAudit,setSubstitutionAudit]=useState<{week:number;absenceId:string;total:number;withOptions:number}|null>(null);
 const [genNumber,setGenNumber]=useState(6);
 const [targetWeek,setTargetWeek]=useState(1);
 const [calendarKind,setCalendarKind]=useState<CalendarEvent['kind']>('practice');
 const [calendarName,setCalendarName]=useState('Учебная практика');
 const [calendarFrom,setCalendarFrom]=useState('2026-11-16');
 const [calendarTo,setCalendarTo]=useState('2026-11-20');
 const [templateName,setTemplateName]=useState('Новый шаблон');
 const [reportType,setReportType]=useState('Расписание групп');
 const [limit,setLimit]=useState(40);
 const [confirmation,setConfirmation]=useState(false);
 const [teacherHours,setTeacherHours]=useState(TEACHERS[0]);
 const [studentIndex,setStudentIndex]=useState(0);
 const [roomType,setRoomType]=useState('Все');
 const [roomNeed,setRoomNeed]=useState(false);
 const [,refreshRooms]=useState(0);
 const [parallelMethod,setParallelMethod]=useState('Кабинет + дистанционное подключение');
 const [partRoom,setPartRoom]=useState(ROOMS[1].id);
 const [copyAll,setCopyAll]=useState(false);
 const [viewRule,setViewRule]=useState('all');
 const [distanceStart,setDistanceStart]=useState(0);
 const [distanceEnd,setDistanceEnd]=useState(4);
 const weekRange=()=>`неделя ${p.week+1} (${lessonDate(p.week,0)} — ${lessonDate(p.week,p.days-1)})`;
 const selectedAbsence=db.absences.find(x=>x.id===absenceId)||db.absences[0];
 const substitutionPolicy={...DEFAULT_SUBSTITUTION_POLICY,...db.substitutionPolicy};
 const updateSubstitutionPolicy=(patch:Partial<SubstitutionPolicy>)=>put(s=>({...s,substitutionPolicy:{...DEFAULT_SUBSTITUTION_POLICY,...s.substitutionPolicy,...patch}}));
 const onGroup=(g:string)=>setGroups(v=>v.includes(g)?v.filter(x=>x!==g):[...v,g]);
 const groupButtons=<div className="group-picker">
  <div className="selected-groups">{groups.map(g=><button key={g} onClick={()=>onGroup(g)} title="Убрать группу">{g} <X size={11}/></button>)}</div>
  <div className="assist-search"><Search size={13}/><input aria-label="Поиск групп для объединения" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} placeholder="Найти группу…"/></div>
  <div className="studio-group-select">{GROUPS.filter(g=>g.id.toLowerCase().includes(groupFilter.toLowerCase())).map(g=><button key={g.id} className={groups.includes(g.id)?'chosen':''} onClick={()=>onGroup(g.id)}>{groups.includes(g.id)?<Check size={12}/>:<Plus size={12}/>} {g.id}</button>)}</div>
 </div>;
 const ifOpen=(x:Lesson)=>p.onFocusLesson(x);
 const findProblems=useMemo(()=>curr.filter(x=>x.status!=='cancelled').flatMap(x=>
  [...validate(x,curr).filter(issue=>issue.hard),
   ...calendarIssues(x,db.calendar,p.days===5?5:6).map(message=>({kind:'calendar' as const,hard:true,message}))].map(issue=>({lesson:x,issue}))
 ).filter((v,i,a)=>a.findIndex(z=>z.lesson.id===v.lesson.id&&z.issue.message===v.issue.message)===i),[curr,db.calendar,p.days]);
 const softWarnings=useMemo(()=>curr.flatMap(x=>validate(x,curr).filter(issue=>!issue.hard).map(issue=>({lesson:x,issue}))),[curr]);
 const involved=useMemo(()=>selectedAbsence&&selectedAbsence.week===p.week?curr.filter(x=>x.teacher===selectedAbsence.teacher&&x.day>=selectedAbsence.from&&x.day<=selectedAbsence.to&&x.status!=='cancelled'&&x.status!=='held'):[],[curr,selectedAbsence]);
 const selectedRoster=db.roster[groupDetails]||[];
 const byTeacher=curr.filter(x=>x.teacher===teacherHours&&x.status!=='cancelled');
 const roomUsages=curr.filter(x=>occupiedRooms(x).includes(selectedRoom));
 const restoreData=()=>{if(!window.confirm('Восстановить учебные дополнительные настройки и состав подгрупп?'))return;put(()=>defaults());p.notify('Дополнительные настройки восстановлены')};
 const lesson=(type:Lesson['type'],participants?:Participant[]):Lesson=>({id:'new-'+newId(),day,slot,week:p.week,subject,teacher,groups:[...groups],room:selectedRoom,type,mode:'offline',participants,hours:2,notes:type==='parallel'?'Способ организации: '+parallelMethod:undefined});
 const create=(x:Lesson)=>{
  const blocked=occupiedRooms(x).find(room=>db.rooms[room]?.blocked);
  if(blocked){p.notify('Кабинет '+blocked+' закрыт и не может быть назначен');return}
  const issues=validate(x,curr).filter(y=>y.hard);
  if(issues.length){p.notify('Не создано: '+issues[0].message);return}
  editData(v=>[...v,x],'Создано занятие: '+x.subject+' ('+TYPES[x.type]+')');
 };
 const toggleRule=(id:string)=>put(d=>({...d,rules:d.rules.map(x=>x.id===id?{...x,enabled:!x.enabled}:x)}));
 const commonHeader=<div className="studio-inline-filters"><Field title="Учебная неделя"><Select value={p.week} onChange={v=>p.setWeek(Number(v))} items={weekOpts}/></Field><Field title="Группа"><Select value={p.group} onChange={p.setGroup} items={opts(GROUPS.map(x=>x.id))}/></Field></div>;
 const makeOverview=()=>{
  const special=curr.filter(x=>x.type!=='regular').length;
  return <div className="studio-stack"><div className="studio-stats">
    <BaseStat value={curr.length} label="Занятий на неделе"/>
    <BaseStat value={findProblems.length} label="Проблем для проверки" emphasis={findProblems.length?'red':''}/>
    <BaseStat value={special} label="Потоки, подгруппы, параллели"/>
    <BaseStat value={db.absences.filter(x=>x.status==='open').length} label="Отсутствия преподавателей"/>
  </div><div className="studio-columns"><Panel title="Очередь диспетчера" aside={<Pill color="lime">Действия</Pill>}>
   <div className="studio-list">{[
    {name:'Проверить конфликты',detail:'Пересечения группы, кабинета и преподавателя: '+findProblems.length,action:()=>p.onNavigate('schedule')},
    {name:'Закрыть отсутствие преподавателя',detail:'Найти затронутые пары и подобрать замену',action:()=>p.onNavigate('substitutions')},
    {name:'Распределить учебные часы',detail:'Проверить остатки нагрузки по дисциплинам',action:()=>p.onNavigate('workload')},
    {name:'Подготовить публикацию',detail:'Сохранить редакцию и уведомить участников',action:()=>p.onNavigate('publication')}
   ].map((a,i)=><div className="studio-list-row" key={i}><div><b>{a.name}</b><small>{a.detail}</small></div><MiniButton onClick={a.action}>Перейти</MiniButton></div>)}</div>
   </Panel><Panel title="Сценарии для проверки">{[
    ['Ручной редактор','Перетаскивание, создание, проверка конфликтов','schedule'],
    ['Потоки','Общая лекция с проверкой вместимости','streams'],
    ['Параллели','Очное занятие + онлайн-подключение','parallels'],
    ['Подгруппы','Распределение 28 студентов на рабочие места','groups'],
    ['Автосоставление','Подбор свободного слота для нагрузки','generator']
   ].map(([a,b,c])=><div className="studio-list-row" key={c}><div><b>{a}</b><small>{b}</small></div><MiniButton onClick={()=>p.onNavigate(c as Screen)}>Открыть</MiniButton></div>)}<Notice>Все данные синтетические. Не используйте этот стенд для реального учебного учёта.</Notice></Panel></div>
   <Panel title="Найденные конфликты" aside={<Pill color={findProblems.length?'amber':'green'}>{findProblems.length}</Pill>}>
    {findProblems.length? <Rows heads={['Группа','Пара','Проблема','Операция']} rows={findProblems.slice(0,20).map(({lesson:x,issue})=>[x.groups.join(', '),DAYS[x.day]+', '+x.slot,issue.message,<MiniButton onClick={()=>ifOpen(x)}>Исправить</MiniButton>])}/>:<Notice>На выбранной неделе конфликтов не найдено. Можно продолжать составление расписания.</Notice>}
   </Panel>{softWarnings.length>0&&<Notice>Предупреждений по организации занятий: {softWarnings.length}. Совместная работа за компьютерами допускается при достаточной вместимости и согласованных условиях.</Notice>}</div>;
 };
 const makeAcademic=()=>{
  const grps=GROUPS.filter(g=>(g.id+' '+g.specialty+' '+g.department).toLowerCase().includes(query.toLowerCase()));
  const periods=practicePeriodsFromKug(db.calendar,demoAcademicHorizon(db.calendar),p.days===5?5:6).filter(x=>x.group===p.group);
  const period=periods.find(x=>x.id===practicePeriodId)||periods[0];
  const existing=period?(db.practiceAssignments||[]).find(x=>x.periodId===period.id):undefined;
  const choosePeriod=(id:string)=>{setPracticePeriodId(id);const value=(db.practiceAssignments||[]).find(x=>x.periodId===id);setPracticeSupervisor(value?.supervisor||'');setPracticeLocation(value?.location||'');setPracticeHours(value?String(value.approvedHours):'');setPracticeStartSlot(value?.startSlot||1)};
  const savePractice=()=>{if(!period){p.notify('В КУГ для этой группы нет периода практики');return}
   const record:AcademicPracticeAssignment={periodId:period.id,group:period.group,phase:period.phase,
    supervisor:practiceSupervisor||existing?.supervisor||'',location:practiceLocation||existing?.location||'',
    approvedHours:practiceHours?Number(practiceHours):existing?.approvedHours||0,
    startSlot:practiceStartSlot,calendarStamp:practicePeriodStamp(period),approved:true};
   const errors=practiceAssignmentProblems(period,record,6);
   if(errors.length){p.notify('Назначение не сохранено: '+errors[0]);return}
   put(d=>({...d,practiceAssignments:[...(d.practiceAssignments||[]).filter(x=>x.periodId!==period.id),record]}));
   p.notify('Подтверждено назначение практики для '+period.group+' на '+period.from+' — '+period.to)
  };
  return <div className="studio-stack"><div className="studio-headbar"><input placeholder="Найти группу, отделение, специальность..." value={query} onChange={e=>setQuery(e.target.value)}/><Pill color="green">{GROUPS.length} групп · {TEACHERS.length} преподавателя</Pill></div>
    <Panel title="Академические группы · демонстрационный адаптер Academic Core">
      <Rows heads={['Группа','Отделение','Курс','Специальность','Студентов','Действия']} rows={grps.slice(0,limit).map(g=>[g.id,g.department,g.course,g.specialty,g.count,<MiniButton onClick={()=>{setGroupDetails(g.id);p.onNavigate('groups')}}>Состав</MiniButton>])}/>
      {grps.length>limit&&<Button onClick={()=>setLimit(v=>v+40)}>Показать ещё ({grps.length-limit})</Button>}
    </Panel>
    <Panel title="Учебные назначения · демонстрационный Academic Core" aside={<Select value={p.group} onChange={p.setGroup} items={opts(GROUPS.map(g=>g.id))}/>}>
      <Rows heads={['Дисциплина','Преподаватель','Осенний период, ч','Весенний период, ч','Итого, ч']} rows={demoAcademicDemands(db.calendar,p.days===5?5:6,demoAcademicHorizon(db.calendar)).filter(d=>d.group===p.group).map(d=>[
       d.subject,d.teacher,(d.semesters?.autumnPairs||0)*2,(d.semesters?.springPairs||0)*2,d.requiredPairs*2
      ])}/>
      <div className="studio-inline-filters"><Notice>Часы и назначения получены из отдельного тестового учебного плана, а не из текущего расписания. Реальный Academic Core ещё не подключён.</Notice>
       <Button onClick={()=>p.onNavigate('year')}>Проверить в годовом мастере</Button>
      </div>
    </Panel>
    <Panel title="Назначения практик · демонстрационный Academic Core">
     <Notice>Даты и тип практики берутся только из КУГ. Здесь подтверждаются ресурсы и плановые часы для выбранной группы; это не фактические часы электронного журнала. Данные сохраняются в браузере.</Notice>
     {!period?<p className="muted">В КУГ этой группы нет рабочих дней практики. Выберите другую группу или заполните учебный календарь.</p>:
      <div className="studio-form">
       <Field title="Период практики из КУГ"><Select value={period.id} onChange={choosePeriod}
        items={periods.map(x=>({id:x.id,label:x.from+' — '+x.to+' · '+(x.practiceCode||x.phase+' (уточнить практику)')+' · неделя '+(x.week+1)}))}/></Field>
       <div className="studio-duo">
        <Field title="Руководитель практики"><Select value={practiceSupervisor||existing?.supervisor||''} onChange={setPracticeSupervisor}
         items={[{id:'',label:'Не назначен'},...TEACHERS.map(t=>({id:t,label:t}))]}/></Field>
        <Field title={period.phase==='training'?'Аудитория учебной практики':'Организация/место практики'}>
         {period.phase==='training'?<Select value={practiceLocation||existing?.location||''} onChange={setPracticeLocation}
          items={[{id:'',label:'Не выбрана'},...ROOMS.filter(r=>r.active).map(r=>({id:r.id,label:r.id+' · '+r.capacity+' мест'}))]}/>:
          <input value={practiceLocation||existing?.location||''} onChange={e=>setPracticeLocation(e.target.value)} placeholder="Введите подтверждённое место прохождения"/>}
        </Field>
       </div>
       <div className="studio-duo">
        <Field title="Утверждённые академические часы для периода"><input type="number" min={2} max={72} step={2}
         value={practiceHours} onChange={e=>setPracticeHours(e.target.value)} placeholder="Из учебного плана"/></Field>
        <Field title="Начальная пара (для УП)"><Select value={practiceStartSlot} onChange={v=>setPracticeStartSlot(Number(v))}
         items={[1,2,3,4,5,6].map(n=>({id:n,label:n+'-я пара'}))}/></Field>
       </div>
       {existing&&<Notice>Есть ранее сохранённое назначение: {existing.approvedHours} ч. {existing.calendarStamp===practicePeriodStamp(period)?'КУГ не изменён.':'После изменения КУГ требуется повторное подтверждение.'}</Notice>}
       <div className="studio-inline-filters">
        <Button primary onClick={savePractice}><Check size={14}/> Сохранить подтверждённое назначение</Button>
        {existing&&<Button onClick={()=>{put(d=>({...d,practiceAssignments:(d.practiceAssignments||[]).filter(x=>x.periodId!==period.id)}));choosePeriod(period.id);p.notify('Назначение практики удалено')}}>Удалить назначение</Button>}
       </div>
      </div>}
    </Panel>
    <div className="studio-columns"><Panel title="Кадровый справочник">{TEACHERS.slice(0,15).map(t=><div className="studio-list-row" key={t}><b>{t}</b><small>{QUALIFICATIONS[t]?.join(', ')}</small></div>)}</Panel><Panel title="Учебные дисциплины">{SUBJECTS.map(s=><div className="studio-chip" key={s}>{s}</div>)}</Panel></div>
   <Notice>Данные предназначены для демонстрации. Реальные преподаватели, студенты, TeachingAssignment и учебные планы должны поступать из общего Academic Core.</Notice></div>;
 };
 const makeCalendar=()=> <CalendarStudio events={db.calendar} lessons={p.items} group={p.group} setGroup={p.setGroup} week={p.week} setWeek={p.setWeek}
   add={event=>{put(d=>({...d,calendar:[...d.calendar,event]}));p.notify('Период добавлен в учебный календарь (демо)')}}
   remove={id=>put(d=>({...d,calendar:d.calendar.filter(e=>e.id!==id)}))}
   replace={next=>{put(d=>({...d,calendar:next}));p.markDraft()}}/>;
 const makeTemplates=()=> <TemplateStudio lessons={p.items} calendar={db.calendar} group={p.group} week={p.week} saved={db.templates}
   blocked={Object.entries(db.rooms).filter(([,x])=>x.blocked).map(([id])=>id)}
   onApply={(next,count)=>editData(()=>next,'Шаблон применён: '+count+' занятий добавлено')}
   onSave={(name,sourceWeek,group,cycle)=>{put(d=>({...d,templates:[...d.templates,{id:newId(),name,week:sourceWeek,group,weeks:cycle,locked:false}]}));p.notify('Настройки цикла сохранены')}}/>;
 const makeGenerator=()=> <GeneratorStudio lessons={p.items} calendar={db.calendar} week={p.week} group={p.group}
   onGroup={p.setGroup} onSubgroups={()=>p.onNavigate('groups')} blocked={Object.entries(db.rooms).filter(([,x])=>x.blocked).map(([id])=>id)}
   onApply={(next,count)=>editData(()=>next,'Автосоставление: добавлено '+count+' занятий')}/>;
 const makeGroups=()=>{
 const group=GROUPS.find(x=>x.id===groupDetails)||GROUPS[0];
 const members=selectedRoster;
 const counts=Array.from({length:subgroupCount},(_,j)=>members.filter(x=>x.subgroup===j+1).length);
 return <div className="studio-columns">
 <Panel title="Группы и подгруппы" aside={<Pill color="lime">{group.count} студентов</Pill>}><div className="studio-form">
   <Field title="Учебная группа"><Select value={groupDetails} onChange={v=>{setGroupDetails(v);setStudentIndex(0)}} items={opts(GROUPS.map(g=>g.id))}/></Field>
   <div className="studio-duo"><Field title="Количество подгрупп"><Select value={subgroupCount} onChange={v=>setSubgroupCount(Number(v))} items={[2,3,4].map(n=>({id:n,label:n+' подгруппы'}))}/></Field>
   <Field title="Студентов"><input readOnly value={members.length}/></Field></div>
   <Button primary onClick={()=>{put(d=>({...d,roster:{...d.roster,[groupDetails]:d.roster[groupDetails].map((x,i)=>({...x,subgroup:(i%subgroupCount)+1}))}}));p.notify('Студенты распределены по '+subgroupCount+' подгруппам')}}><Users size={15}/> Распределить автоматически</Button>
   {counts.map((n,i)=><div className="studio-list-row" key={i}><b>Подгруппа {i+1}</b><Pill color={n<=15?'green':'amber'}>{n} человек · {n<=15?'15 ПК достаточно':'15 ПК недостаточно'}</Pill></div>)}
   <Notice>Состав принадлежит Academic Core. В демо можно менять его без влияния на действующие документы.</Notice>
 </div></Panel>
 <Panel title="Состав студентов — ручное распределение">
 <Rows heads={['Студент','Подгруппа']} rows={members.slice(0,35).map(x=>[x.name,<Select value={x.subgroup} onChange={val=>put(d=>({...d,roster:{...d.roster,[groupDetails]:d.roster[groupDetails].map(st=>st.id===x.id?{...st,subgroup:Number(val)}:st)}}))} items={Array.from({length:subgroupCount},(_,i)=>({id:i+1,label:'Подгруппа '+(i+1)}))}/>])}/>
 </Panel></div>;
 };
 const makeStream=()=>{
 const count=groupCount(groups);const capacity=validRoom(selectedRoom)?.capacity||0;
 const generated=curr.filter(x=>x.type==='stream');
 return <div className="studio-stack"><div className="studio-columns"><Panel title="Конструктор потока"><div className="studio-form">
  <Field title="Общая дисциплина"><Select value={subject} onChange={setSubject} items={opts(SUBJECTS)}/></Field>
  <Field title="Преподаватель"><Select value={teacher} onChange={setTeacher} items={opts(TEACHERS)}/></Field>
  <div className="studio-duo"><Field title="День"><Select value={day} onChange={v=>setDay(Number(v))} items={DAYS.map((v,i)=>({id:i,label:v}))}/></Field><Field title="Пара"><Select value={slot} onChange={v=>setSlot(Number(v))} items={TIMES.map((_,i)=>({id:i+1,label:String(i+1)}))}/></Field></div>
  <Field title="Общая аудитория"><Select value={selectedRoom} onChange={setSelectedRoom} items={ROOMS.map(r=>({id:r.id,label:r.id+' · '+r.capacity+' мест'}))}/></Field>
  <Button primary disabled={groups.length<2||count>capacity||db.rooms[selectedRoom]?.blocked} onClick={()=>create(lesson('stream'))}><Network size={15}/> Создать поток</Button>
 </div></Panel><Panel title="Участники потока"><div className="studio-inspect"><div className="studio-big">{count}<small>студентов</small></div><div className="studio-big">{capacity}<small>мест в аудитории</small></div></div>
  <Pill color={count<=capacity?'green':'red'}>{count<=capacity?'Вместимости достаточно':'Не хватает '+(count-capacity)+' мест'}</Pill>
  <div className="studio-selection">{groupButtons}</div>
  <Notice>Один преподаватель проводит одну общую встречу. В журнале посещаемость остаётся раздельной по группам.</Notice>
 </Panel></div>
 <Panel title="Потоки в расписании"><Rows heads={['Неделя','Пара','Дисциплина','Группы','Преподаватель','Кабинет','']} rows={generated.slice(0,30).map(x=>[x.week!+1,DAYS[x.day]+' · '+x.slot,x.subject,x.groups.join(', '),x.teacher,x.room,<MiniButton onClick={()=>ifOpen(x)}>Изменить</MiniButton>])}/></Panel></div>;
 };
 const makeParallel=()=>{
 const generated=curr.filter(x=>x.type==='parallel');
 const participants:Participant[]=groups.map((g,i)=>({group:g,mode:i===0?'offline':'online',room:i===0?selectedRoom:'Онлайн',teacher}));
 return <div className="studio-stack"><div className="studio-columns"><Panel title="Конструктор параллели"><div className="studio-form">
 <Field title="Дисциплина"><Select value={subject} onChange={setSubject} items={opts(SUBJECTS)}/></Field>
 <Field title="Преподаватель"><Select value={teacher} onChange={setTeacher} items={opts(TEACHERS)}/></Field>
 <div className="studio-duo"><Field title="День"><Select value={day} onChange={v=>setDay(Number(v))} items={DAYS.map((v,i)=>({id:i,label:v}))}/></Field><Field title="Пара"><Select value={slot} onChange={v=>setSlot(Number(v))} items={TIMES.map((_,i)=>({id:i+1,label:String(i+1)}))}/></Field></div>
 <Field title="Способ проведения"><Select value={parallelMethod} onChange={setParallelMethod} items={opts(['Кабинет + дистанционное подключение','Все группы дистанционно','Разные аудитории, с сопровождающим'])}/></Field>
 <Field title="Основная аудитория"><Select value={selectedRoom} onChange={setSelectedRoom} items={opts(ROOMS.map(x=>x.id))}/></Field>
 <Button primary disabled={groups.length<2} onClick={()=>{
 const pp=groups.map((g,i):Participant=>({group:g,mode:parallelMethod==='Все группы дистанционно'?'online':i===0?'offline':parallelMethod.includes('сопровождающим')?'offline':'online',room:parallelMethod==='Все группы дистанционно'?'Онлайн':i===0?selectedRoom:parallelMethod.includes('сопровождающим')?partRoom:'Онлайн',teacher}));
 create({...lesson('parallel',pp),mode:parallelMethod==='Все группы дистанционно'?'online':'hybrid',room:parallelMethod==='Все группы дистанционно'?'Онлайн':selectedRoom+(parallelMethod.includes('сопровождающим')?' / '+partRoom:' + онлайн'),notes:'Организация: '+parallelMethod+(parallelMethod.includes('сопровождающим')?'; сопровождающий сотрудник назначен':'')})
 }}><GitFork size={15}/> Создать параллель</Button>
 </div></Panel><Panel title="Участники и размещение">
  {groupButtons}<div className="studio-form"><Field title="Дополнительный кабинет"><Select value={partRoom} onChange={setPartRoom} items={opts(ROOMS.map(x=>x.id))}/></Field></div>
  {participants.map((v,i)=><div className="studio-list-row" key={i}><b>{v.group}</b><Pill color={i===0?'green':'blue'}>{i===0?selectedRoom:'Онлайн'}</Pill></div>)}
  <Notice>В разных аудиториях работа допустима только при указанной организации контроля. Пересечения независимых занятий запрещены.</Notice>
 </Panel></div><Panel title="Связанные параллельные занятия"><Rows heads={['День','Пара','Группы','Преподаватель','Формат','']} rows={generated.slice(0,30).map(x=>[DAYS[x.day],x.slot,x.groups.join(' + '),x.teacher,<Pill color="blue">{MODES[x.mode]}</Pill>,<MiniButton onClick={()=>ifOpen(x)}>Править</MiniButton>])}/></Panel></div>;
 };

 const makeSubstitutions=()=>{
  const teacherlessons=selectedAbsence?involved:[];
  const offer=(x:Lesson)=>suggestSubstitutions(x,p.items,db.calendar,db.absences,substitutionPolicy,p.days===5?5:6,
    Object.keys(db.rooms).filter(room=>db.rooms[room].blocked));
  const useOption=(source:Lesson,selected:SubstitutionOption)=>{
   const live=p.items.find(x=>x.id===source.id);
   if(!live||live.status==='held'||!selectedAbsence||live.teacher!==selectedAbsence.teacher){
    p.notify('Замена недоступна: занятие уже изменено или проведено');return;
   }
   if(checkedSubstitution?.lessonId!==source.id||checkedSubstitution.optionKey!==selected.key||checkedSubstitution.week!==p.week||checkedSubstitution.absenceId!==selectedAbsence.id){
    p.notify('Сначала нажмите «Проверить замену» для выбранного варианта');return;
   }
   // Revalidate at the moment of confirmation in case another class was edited.
   const valid=offer(live).find(v=>v.key===selected.key);
   if(!valid){p.notify('Этот вариант больше недоступен. Обновите предложения.');return}
   if(!window.confirm('Заменить «'+live.subject+'» на «'+valid.lesson.subject+'» ('+valid.lesson.teacher+')?\n'+
      'Исходная дисциплина останется с нераспределёнными часами.'))return;
   const next=applySubstitutionOption(live,valid,selectedAbsence.reason);
   const updated=p.items.map(l=>l.id===live.id?next:l);
   editData(()=>updated,'Замена сохранена: '+live.subject+' → '+next.subject);
   setCheckedSubstitution(null);setSubstitutionAudit(null);
   const left=updated.some(l=>(l.week||0)===p.week&&l.status!=='cancelled'&&l.teacher===selectedAbsence.teacher&&
     (l.week||0)===(selectedAbsence.week??p.week)&&l.day>=selectedAbsence.from&&l.day<=selectedAbsence.to);
   if(!left)put(d=>({...d,absences:d.absences.map(a=>a.id===selectedAbsence.id?{...a,status:'resolved'}:a)}));
  };
  const undo=(x:Lesson)=>{
   if(x.status==='held'){p.notify('Проведённую замену нельзя отменить обычным редактированием');return}
   const restored=revertSubstitution(x);
   editData(old=>old.map(y=>y.id===x.id?restored:y),'Замена отменена, исходное занятие восстановлено');
   setCheckedSubstitution(null);setSubstitutionAudit(null);
   put(d=>({...d,absences:d.absences.map(a=>a.teacher===restored.teacher&&(a.week??p.week)===(restored.week||0)&&restored.day>=a.from&&restored.day<=a.to?
    {...a,status:'open'}:a)}));
  };
  const stateLabel=(kind:Lesson['replacementKind'])=>kind==='subject'?'Другой предмет':kind==='online'?'Дистант':kind==='teacher'?'Другой преподаватель':'Замена';
  return <div className="studio-stack"><div className="studio-columns">
   <Panel title="Отсутствия преподавателей" aside={<Pill color="amber">{db.absences.filter(x=>x.status==='open').length} открыто</Pill>}>
    <div className="studio-form">
     <Field title="Преподаватель"><Select value={teacher} onChange={setTeacher} items={opts(TEACHERS)}/></Field>
     <div className="studio-duo"><Field title="С какого дня"><Select value={fromDay} onChange={v=>setFromDay(Number(v))} items={DAYS.map((x,i)=>({id:i,label:x}))}/></Field><Field title="По какой день"><Select value={toDay} onChange={v=>setToDay(Number(v))} items={DAYS.map((x,i)=>({id:i,label:x}))}/></Field></div>
     <Field title="Причина"><Select value={reason} onChange={setReason} items={opts(['Больничный','Командировка','Отпуск','Повышение квалификации','Другое'])}/></Field>
     <Button disabled={fromDay>toDay} onClick={()=>{const abs:Absence={id:'abs-'+newId(),teacher,from:fromDay,to:toDay,week:p.week,reason,status:'open'};
      put(d=>({...d,absences:[...d.absences,abs]}));setAbsenceId(abs.id);p.notify('Отсутствие зарегистрировано')}}><Plus size={14}/> Зарегистрировать отсутствие</Button>
    </div>
    <div className="studio-list">{db.absences.map(a=><button className={'studio-candidate '+(selectedAbsence?.id===a.id?'selected':'')} onClick={()=>setAbsenceId(a.id)} key={a.id}><b>{a.teacher}</b><span>{DAYS[a.from]} — {DAYS[a.to]} · неделя {(a.week??p.week)+1} · {a.reason} · {a.status==='open'?'Требует решения':'Решено'}</span></button>)}</div>
   </Panel>
   <Panel title="Правила замены колледжа">
    <div className="studio-form">
     <Field title="Основной способ замены"><Select value={substitutionPolicy.strategy}
      onChange={v=>updateSubstitutionPolicy({strategy:v as SubstitutionPolicy['strategy']})} items={[
       {id:'subject-first',label:'Другим предметом (без обязательной замены преподавателя)'},
       {id:'mixed',label:'Предметом или другим преподавателем'},
       {id:'teacher-only',label:'Только другим преподавателем'}
      ]}/></Field>
     <label className="studio-checkbox"><input type="checkbox" checked={substitutionPolicy.allowOnline}
      onChange={e=>updateSubstitutionPolicy({allowOnline:e.target.checked})}/> Предлагать дистант при допустимых ограничениях</label>
     <Field title="Максимальная доля дистанта за неделю"><Select value={substitutionPolicy.maxOnlinePercent}
      onChange={v=>updateSubstitutionPolicy({maxOnlinePercent:Number(v)})} items={[5,10,15,20,25,30].map(n=>({id:n,label:n+'%'}))}/></Field>
     <Field title="Максимум дистанционных пар в день"><Select value={substitutionPolicy.maxOnlinePairsPerDay}
      onChange={v=>updateSubstitutionPolicy({maxOnlinePairsPerDay:Number(v)})} items={[1,2].map(n=>({id:n,label:String(n)}))}/></Field>
     <Field title="Свободных пар на дорогу"><Select value={substitutionPolicy.commuteGap}
      onChange={v=>updateSubstitutionPolicy({commuteGap:Number(v) as 1|2})} items={[1,2].map(n=>({id:n,label:String(n)}))}/></Field>
     <Notice>Дистант предлагается только в начале или конце расписания группы и преподавателя, не между очными парами. Учитываются лимиты дистанта за неделю и время на дорогу. Правила сохраняются для этого демостенда в браузере.</Notice>
    </div>
   </Panel></div>
   <Panel title={'Подбор замен · '+weekRange()} aside={<Pill color="amber">{teacherlessons.length} не решено</Pill>}>
    <Notice>Сначала нажмите «Проверить замены», затем выберите конкретный вариант через «Проверить замену». Только после проверки появится отдельная кнопка подтверждения. Учебные назначения в этом стенде демонстрационные.</Notice>
    <Button primary disabled={!teacherlessons.length} onClick={()=>{
     setCheckedSubstitution(null);
     setSubstitutionAudit({week:p.week,absenceId:selectedAbsence?.id||'',total:teacherlessons.length,withOptions:teacherlessons.filter(x=>offer(x).length>0).length});
    }}><Search size={15}/> Проверить замены ({teacherlessons.length})</Button>
    {substitutionAudit?.week===p.week&&substitutionAudit.absenceId===selectedAbsence?.id&&
     <div className="substitution-audit" role="status">
      <div><strong>Результаты проверки</strong><p>Проверено занятий: {substitutionAudit.total}. Есть допустимые варианты: {substitutionAudit.withOptions}. Без вариантов: {substitutionAudit.total-substitutionAudit.withOptions}. Расписание не менялось.</p></div>
      <button type="button" className="substitution-dismiss" onClick={()=>{setSubstitutionAudit(null);setCheckedSubstitution(null)}} aria-label="Скрыть результаты проверки" title="Закрыть результаты"><X size={16}/></button>
     </div>}
    <div className="substitution-lesson-list">
     {!teacherlessons.length&&<p className="muted">Нет незакрытых занятий выбранного отсутствующего преподавателя на этой неделе.</p>}
     {teacherlessons.slice(0,30).map(x=>{
      const candidates=offer(x);
      return <section className="substitution-lesson" key={x.id}>
       <header className="substitution-lesson-header">
        <div className="substitution-lesson-meta">
         <strong>{DAYS[x.day]}, {x.slot}-я пара · {x.groups.join(' + ')} · {x.subject}</strong>
         <small>Исходный преподаватель: {x.teacher}. {x.groups.length!==1||x.type!=='regular'?
          'Для общего потока, подгрупп и параллелей нужно согласовать всех участников.':
          candidates.length?'Варианты подобраны с учётом КУГ, расписания, нагрузки и ресурсов.':
           'Нет безопасных вариантов: проверь занятость, учебный план, кабинеты и ограничения.'}</small>
        </div>
        <MiniButton onClick={()=>ifOpen(x)}>Открыть занятие</MiniButton>
       </header>
       {!!candidates.length&&<div className="substitution-options" role="list" aria-label={'Варианты замены: '+x.subject+', '+DAYS[x.day]+', '+x.slot+'-я пара'}>
        {candidates.slice(0,5).map(candidate=>{
         const verified=checkedSubstitution?.lessonId===x.id&&checkedSubstitution.optionKey===candidate.key&&checkedSubstitution.week===p.week&&checkedSubstitution.absenceId===selectedAbsence?.id;
         return <div className={'substitution-option'+(verified?' substitution-option-verified':'')} role="listitem" key={candidate.key}>
          <div className="substitution-option-info">
           <strong>{candidate.label}</strong><p>{candidate.explanation}</p>
          </div>
          {!verified&&<div className="substitution-option-actions">
           <Button onClick={()=>{
            const fresh=offer(x).find(v=>v.key===candidate.key);
            if(!fresh){setCheckedSubstitution(null);p.notify('Вариант больше не соответствует правилам');return}
            setCheckedSubstitution({lessonId:x.id,optionKey:candidate.key,week:p.week,absenceId:selectedAbsence?.id||''});
           }}><Search size={14}/> Проверить замену</Button>
          </div>}
          {verified&&<div className="substitution-verification" role="status">
           <div className="substitution-verification-head">
            <strong><CheckCircle2 size={16}/> Проверка пройдена</strong>
            <button type="button" className="substitution-dismiss" onClick={()=>setCheckedSubstitution(null)} title="Закрыть проверку" aria-label="Скрыть проверку"><X size={16}/></button>
           </div>
           <p>Проверены учебное назначение, КУГ, занятость, кабинеты, новые окна и ограничения дистанта по данным демостенда. Исходные часы ещё нужно распределить.</p>
           <div className="substitution-option-actions">
            <Button primary onClick={()=>useOption(x,candidate)}><Check size={14}/> Подтвердить замену</Button>
            <Button onClick={()=>setCheckedSubstitution(null)}>Отмена</Button>
           </div>
          </div>}
         </div>;
        })}
       </div>}
      </section>;
     })}
    </div>
   </Panel>
   <Panel title="Журнал замен — текущая неделя">
    <Rows heads={['День','Пара','Группы','Было: дисциплина / преподаватель','Стало: дисциплина / преподаватель','Способ','']}
     rows={curr.filter(x=>x.replacementFor).map(x=>[
      DAYS[x.day],x.slot,x.groups.join(', '),
      (x.replacementOriginal?.subject||x.subject)+' · '+(x.replacementOriginal?.teacher||x.replacementFor),
      x.subject+' · '+x.teacher+' ('+MODES[x.mode]+')',<Pill color={x.replacementKind==='online'?'blue':'green'}>{stateLabel(x.replacementKind)}</Pill>,
      <Button disabled={x.status==='held'} onClick={()=>undo(x)}>Вернуть</Button>
     ])}/>
    <Notice>При замене другим предметом исходные часы не списываются как проведённые. Требуется перепланировать исходную дисциплину через Academic Core; в демостенде автоматическое перераспределение часов не реализовано.</Notice>
   </Panel>
  </div>;
 };
 const makeResources=()=>{
  const list=ROOMS.filter(r=>(roomType==='Все'||r.kind===roomType)&&(!roomNeed||r.pc>0)&&(r.id+' '+r.kind+' '+r.building).toLowerCase().includes(query.toLowerCase()));
  return <div className="studio-stack"><RoomManager selected={selectedRoom} lessons={p.items} onSelect={setSelectedRoom} onChange={()=>refreshRooms(v=>v+1)} notify={p.notify}/><div className="studio-inline-filters">
   <Field title="Тип помещения"><Select value={roomType} onChange={setRoomType} items={opts(['Все',...Array.from(new Set(ROOMS.map(r=>r.kind)))])}/></Field>
   <label className="studio-checkbox"><input type="checkbox" checked={roomNeed} onChange={e=>setRoomNeed(e.target.checked)}/> Только с компьютерами</label>
   <input placeholder="Кабинет или корпус" value={query} onChange={e=>setQuery(e.target.value)}/>
   </div><div className="studio-columns"><Panel title="Аудитории и ресурсы">
   <Rows heads={['Кабинет','Корпус','Назначение','Мест','ПК','Состояние','']} rows={list.map(r=>[r.id,r.building,r.kind,r.capacity,r.pc,db.rooms[r.id]?.blocked?<Pill color="red">Закрыт</Pill>:<Pill color="green">Доступен</Pill>,<MiniButton onClick={()=>setSelectedRoom(r.id)}>Подробнее</MiniButton>])}/>
   </Panel><Panel title={'Аудитория '+selectedRoom}>
    {(()=>{const r=validRoom(selectedRoom);if(!r)return <Notice>Кабинет не найден</Notice>;
    const busy=curr.filter(x=>occupiedRooms(x).includes(selectedRoom));
    return <div className="studio-form">
     <div className="studio-stats"><BaseStat value={r.capacity} label="Посадочных мест"/><BaseStat value={r.pc} label="Компьютеров"/><BaseStat value={busy.length} label="Занятий за неделю"/></div>
     <p className="muted">Корпус {r.building} · {r.kind} · {r.features.join(', ')}</p>
     <label className="studio-checkbox"><input type="checkbox" checked={Boolean(db.rooms[selectedRoom]?.blocked)} onChange={e=>put(d=>({...d,rooms:{...d.rooms,[selectedRoom]:{blocked:e.target.checked,reason:'Техническое обслуживание'}}}))}/> Временно закрыть аудиторию</label>
     {busy.slice(0,15).map(x=><div className="studio-list-row" key={x.id}><b>{DAYS[x.day]}, {x.slot}-я · {x.subject}</b><small>{x.groups.join(', ')}</small></div>)}
    </div>})()}
   </Panel></div></div>;
 };
 const makeDistance=()=>{
  const selectedGroups=formatScope==='all'?GROUPS.map(g=>g.id):formatScope==='department'?
   GROUPS.filter(g=>g.department===formatDepartment).map(g=>g.id):[formatGroup];
  const eligible=curr.filter(x=>x.groups.some(g=>selectedGroups.includes(g))&&x.day>=distanceStart&&x.day<=distanceEnd);
  const build=()=>previewBulkFormat(p.items,db.calendar,db.absences,substitutionPolicy,p.days===5?5:6,{
   week:p.week,groups:selectedGroups,fromDay:distanceStart,toDay:distanceEnd,mode
  });
  const change=()=>{setBulkPreview(null);setBulkReviewed(false)};
  const apply=()=>{
   if(!bulkPreview)return;
   const fresh=build();
   const ids=(a:BulkFormatPreview)=>a.accepted.map(x=>x.id+'|'+x.mode+'|'+x.room).sort().join(',')+'#'+a.blocked.map(x=>x.lesson.id+'|'+x.reason).sort().join(',');
   if(ids(fresh)!==ids(bulkPreview)){setBulkPreview(fresh);p.notify('Расписание или ограничения изменились. Проверьте результаты повторно');return}
   if(!fresh.accepted.length){p.notify('Нет занятий, которые прошли проверку');return}
   const blocked=fresh.blocked.length;
   if(!window.confirm('Подтвердить смену формата только для '+fresh.accepted.length+' проверенных занятий на '+weekRange()+'?'+
    (blocked?'\\nОстальные '+blocked+' занятий НЕ будут изменены.':'')+'\\nЗанятия будут сохранены в черновике.'))return;
   const byId=new Map(fresh.accepted.map(x=>[x.id,x]));
   editData(old=>old.map(x=>byId.get(x.id)||x),'Формат изменён для '+byId.size+' проверенных занятий');
   setBulkPreview(null);setBulkReviewed(false);
  };
  return <div className="studio-stack"><div className="studio-columns">
   <Panel title={'Массовая смена формата · '+weekRange()}><div className="studio-form">
    <Field title="Кого переводим"><Select value={formatScope} onChange={v=>{setFormatScope(v as typeof formatScope);change()}} items={[
     {id:'one',label:'Одну группу'},
     {id:'department',label:'Все группы отделения'},
     {id:'all',label:'Все группы колледжа'}
    ]}/></Field>
    {formatScope==='one'&&<Field title="Группа"><Select value={formatGroup} onChange={v=>{setFormatGroup(v);change()}} items={opts(GROUPS.map(g=>g.id))}/></Field>}
    {formatScope==='department'&&<Field title="Отделение"><Select value={formatDepartment} onChange={v=>{setFormatDepartment(v);change()}} items={opts([...new Set(GROUPS.map(g=>g.department))])}/></Field>}
    <Notice>Область изменения: {selectedGroups.length} групп. Общие потоки изменяются только при выборе всех групп-участников.</Notice>
    <Field title="Новый формат занятий"><Select value={mode} onChange={v=>{setMode(v as Mode);change()}} items={Object.entries(MODES).map(([id,label])=>({id,label}))}/></Field>
    <div className="studio-duo">
     <Field title="С дня"><Select value={distanceStart} onChange={v=>{setDistanceStart(Number(v));change()}} items={DAYS.slice(0,p.days).map((v,i)=>({id:i,label:v}))}/></Field>
     <Field title="По день"><Select value={distanceEnd} onChange={v=>{setDistanceEnd(Number(v));change()}} items={DAYS.slice(0,p.days).map((v,i)=>({id:i,label:v}))}/></Field>
    </div>
    <Pill color="blue">Выбрано на {weekRange()}: {eligible.length} занятий</Pill>
    <Button primary disabled={distanceStart>distanceEnd||!eligible.length} onClick={()=>{setBulkPreview(build());setBulkReviewed(true)}}>
     <Search size={15}/> Проверить выбранные занятия
    </Button>
   </div></Panel>
   <Panel title="Правила и доступные форматы">
    {Object.entries(MODES).map(([id,label])=><div className="studio-list-row" key={id}><b>{label}</b><small>{id==='offline'?'Аудитория и занятость ресурсов':id==='online'?'Синхронно, с края дня, доля онлайн и время на дорогу':id==='async'?'Нужны LMS, задания и учёт часов':'Требуется схема очных/дистанционных участников'}</small></div>)}
    <Notice>Результаты проверяются по КУГ, занятиям, занятости группы и преподавателя, аудиториям, отсутствиям, лимитам дистанта и новым окнам. Проверка не создаёт видеовстречу или запись посещаемости.</Notice>
   </Panel></div>
   {bulkPreview&&bulkReviewed&&<Panel title={'Результат проверки · '+weekRange()}>
    <div className="studio-stats"><BaseStat value={bulkPreview.considered} label="Рассмотрено"/><BaseStat value={bulkPreview.accepted.length} label="Можно изменить"/><BaseStat value={bulkPreview.blocked.length} label="Не прошли проверку"/></div>
    <Notice kind={bulkPreview.blocked.length?'warning':'info'}>Расписание пока не изменено. Ниже указано, какие пары можно перевести в формат «{MODES[mode]}» и почему остальные недоступны. Подтверждение затронет только проверенные занятия.</Notice>
    {bulkPreview.accepted.slice(0,20).map(x=><div key={x.id} className="studio-list-row"><b><Check size={14}/> {DAYS[x.day]}, {x.slot}-я · {x.groups.join(' + ')} · {x.subject}</b><small>Подходит: {MODES[x.mode]}</small></div>)}
    {bulkPreview.blocked.slice(0,50).map(x=><div key={x.lesson.id} className="studio-list-row"><b><X size={14}/> {DAYS[x.lesson.day]}, {x.lesson.slot}-я · {x.lesson.groups.join(' + ')}</b><small>Отклонено: {x.reason}</small></div>)}
    <Button primary disabled={!bulkPreview.accepted.length} onClick={apply}><Check size={15}/> Подтвердить прошедшие проверку ({bulkPreview.accepted.length})</Button>
   </Panel>}
   <Panel title={'Дистанционные занятия · '+weekRange()}>
    <Rows heads={['Группа','День','Пара','Дисциплина','Формат','']} rows={curr.filter(x=>x.mode!=='offline').slice(0,70).map(x=>[x.groups.join(', '),DAYS[x.day],x.slot,x.subject,<Pill color="blue">{MODES[x.mode]}</Pill>,<MiniButton onClick={()=>ifOpen(x)}>Открыть</MiniButton>])}/>
   </Panel>
  </div>;
 };
 const makeWorkload=()=>{
  const curriculum=demoAcademicDemands(db.calendar,p.days===5?5:6,demoAcademicHorizon(db.calendar));
  const groupPlan=curriculum.filter(d=>d.group===p.group).map(d=>{
   const assigned=p.items.filter(x=>x.status!=='cancelled'&&x.groups.includes(d.group)&&x.teacher===d.teacher&&x.subject===d.subject);
   const placed=assigned.length*2,held=assigned.filter(x=>x.status==='held').length*2;
   return {...d,plan:d.requiredPairs*2,placed,held,remaining:Math.max(0,d.requiredPairs*2-placed)};
  });
  const totals=groupPlan.reduce((sum,d)=>({plan:sum.plan+d.plan,placed:sum.placed+d.placed,held:sum.held+d.held,remaining:sum.remaining+d.remaining}),{plan:0,placed:0,held:0,remaining:0});
  const teachers=TEACHERS.map(t=>({workload:workload(p.items,t,p.week),name:t}));
  return <div className="studio-stack">
   <div className="studio-inline-filters"><Field title="Контроль часов группы"><Select value={p.group} onChange={p.setGroup} items={opts(GROUPS.map(g=>g.id))}/></Field>
    <Pill color="amber">Учебные планы и назначения — тестовые данные</Pill></div>
   <div className="studio-stats">
    <BaseStat value={totals.plan+' ч'} label="План группы (демо)"/>
    <BaseStat value={totals.placed+' ч'} label="Распределено по расписанию"/>
    <BaseStat value={totals.held+' ч'} label="Проведено в деморежиме"/>
    <BaseStat value={totals.remaining+' ч'} label="Осталось разместить"/>
   </div>
   <Panel title={'Покрытие учебного плана · '+p.group}>
    <Rows heads={['Дисциплина','Преподаватель','План, ч','Распределено, ч','Проведено, ч','Остаток, ч','Действие']} rows={groupPlan.map(d=>[
     d.subject,d.teacher,d.plan,d.placed,d.held,
     d.remaining>0?<Pill color="amber">{d.remaining} ч</Pill>:<Pill color="green">Закрыто</Pill>,
     d.remaining>0?<MiniButton onClick={()=>p.onNavigate('generator')}>Разместить</MiniButton>:<span>—</span>
    ])}/>
    <Notice>Демонстрационный план берётся из отдельного адаптера учебных назначений, а не из уже заполненного расписания. Часы не являются утверждённым учебным планом. Для потоков часы каждой группы считаются отдельно; фактическое проведение должно подтверждаться электронным журналом.</Notice>
   </Panel>
   <Panel title="Занятость преподавателей на выбранной неделе" aside={<Pill color="lime">Неделя {p.week+1}</Pill>}>
    <Rows heads={['Преподаватель','Распределено, ч','Проведено, ч','Ожидает подтверждения, ч','']} rows={teachers.filter(x=>x.workload.assigned>0).slice(0,45).map(t=>[
     t.name,t.workload.assigned,t.workload.held,Math.max(0,t.workload.assigned-t.workload.held),
     <MiniButton onClick={()=>setTeacherHours(t.name)}>Детали</MiniButton>
    ])}/>
   </Panel>
   <Panel title={'Занятия преподавателя: '+teacherHours} aside={<Select value={teacherHours} onChange={setTeacherHours} items={opts(TEACHERS)}/>}>
    <Rows heads={['День','Пара','Группы','Дисциплина','Факт','']} rows={byTeacher.slice(0,55).map(x=>[
      DAYS[x.day],x.slot,x.groups.join(', '),x.subject,x.status==='held'?<Pill color="green">Проведено</Pill>:<Pill>По плану</Pill>,
      <Button onClick={()=>editData(old=>old.map(y=>y.id===x.id?{...y,status:y.status==='held'?'scheduled':'held'}:y),'Демо-статус занятия обновлён')}>{x.status==='held'?'Снять':'Подтвердить'}</Button>
     ])}/>
    <Notice>Подтверждение факта проведения здесь является тестовой операцией. Официальная нагрузка преподавателей, тарификация и часы журнала требуют подключения Academic Core и электронного журнала.</Notice>
   </Panel>
  </div>;
 };
 const makePublication=()=>{
  const currentVersion=db.snapshots.find(x=>x.week===p.week);
  const changes=currentVersion?curr.filter(x=>{const old=currentVersion.lessons.find(z=>z.id===x.id);return !old||JSON.stringify(old)!==JSON.stringify(x)}).length:curr.length;
  const removeCount=currentVersion?currentVersion.lessons.filter(x=>!curr.some(z=>z.id===x.id)).length:0;
  return <div className="studio-columns"><Panel title="Публикация расписания" aside={<Pill color={p.status==='published'?'green':'amber'}>{p.status==='published'?'Опубликовано':'Черновик'}</Pill>}><div className="studio-stats">
   <BaseStat value={curr.length} label="Занятий"/><BaseStat value={changes} label="Изменено/добавлено"/><BaseStat value={removeCount} label="Удалено"/>
   </div><div className="studio-form">
   <label className="studio-checkbox"><input type="checkbox" checked={confirmation} onChange={e=>setConfirmation(e.target.checked)}/> Проверено: расписание готово к публикации (демо)</label>
   <Button primary disabled={!confirmation||findProblems.length>0} onClick={()=>{
    const snapshot:Snapshot={id:newId(),label:'Версия '+(db.snapshots.length+1),at:stamp(),week:p.week,lessons:curr.map(x=>({...x})),notice:'Публикация выполнена локально'};
    put(d=>({...d,snapshots:[snapshot,...d.snapshots].slice(0,6),notifications:['Опубликовано расписание: неделя '+(p.week+1)+' · '+stamp(),...d.notifications].slice(0,30)}));
    p.setStatus('published');setConfirmation(false);p.notify('Демо-версия опубликована в браузере');
   }}><Send size={15}/> Опубликовать версию</Button>
   {findProblems.length>0&&<Notice kind="warning">Обнаружено конфликтов: {findProblems.length}. Устраните их до публикации.</Notice>}
   <Button onClick={()=>exportJSON('college-schedule-week-'+(p.week+1)+'.json',curr)}><Download size={15}/> Скачать снимок JSON</Button>
   </div></Panel><Panel title="История редакций и уведомления">
    {db.snapshots.filter(x=>x.week===p.week).length?db.snapshots.filter(x=>x.week===p.week).map(v=><div className="studio-list-row" key={v.id}><div><b>{v.label}</b><small>{v.at} · {v.lessons.length} занятий</small></div><Button onClick={()=>{if(!window.confirm('Восстановить этот снимок в черновик?'))return;editData(old=>[...old.filter(x=>(x.week||0)!==p.week),...v.lessons.map(x=>({...x}))],'Черновик восстановлен из версии')}}><RotateCcw size={14}/> Вернуть</Button></div>):<Notice>Опубликованных снимков для этой недели нет.</Notice>}
   {db.notifications.slice(0,8).map((x,i)=><div className="studio-list-row" key={i}><Bell size={14}/><small>{x}</small></div>)}
   <Notice>В GitHub Pages публикация не отправляет настоящие уведомления: изменения доступны только в текущем браузере.</Notice>
  </Panel></div>;
 };
 const makeReports=()=>{
  const reportOptions=['Расписание групп','Расписание преподавателей','Занятость аудиторий','Нагрузка преподавателей','Контроль учебных часов','Лист замен','Потоки','Параллели','Подгруппы','Онлайн и гибрид'];
  const rows=reportType==='Нагрузка преподавателей'?[['Преподаватель','Назначено (ч)','Проведено (ч)'],...TEACHERS.map(t=>{const w=workload(p.items,t,p.week);return [t,w.assigned,w.held]})]:
  reportType==='Занятость аудиторий'?[['Аудитория','Корпус','День','Пара','Группа','Предмет'],...ROOMS.flatMap(r=>curr.filter(x=>occupiedRooms(x).includes(r.id)).map(x=>[r.id,r.building,DAYS[x.day],x.slot,x.groups.join(', '),x.subject]))]:
  reportType==='Контроль учебных часов'?[['Группа','Дисциплина','Преподаватель','План, ч (демо)','Распределено, ч','Проведено, ч','Осталось, ч'],...demoAcademicDemands(db.calendar,p.days===5?5:6,demoAcademicHorizon(db.calendar)).map(d=>{
   const completed=p.items.filter(x=>x.status!=='cancelled'&&x.groups.includes(d.group)&&x.subject===d.subject&&x.teacher===d.teacher);
   const assigned=completed.length*2;return [d.group,d.subject,d.teacher,d.requiredPairs*2,assigned,completed.filter(x=>x.status==='held').length*2,Math.max(0,d.requiredPairs*2-assigned)]
  })]:
  reportRows(reportType==='Лист замен'?'Замены':reportType,p.items,p.week);
  return <div className="studio-columns"><Panel title="Конструктор отчётов"><div className="studio-form">
   <Field title="Отчёт"><Select value={reportType} onChange={setReportType} items={opts(reportOptions)}/></Field>
   <Field title="Неделя"><Select value={p.week} onChange={v=>p.setWeek(Number(v))} items={weekOpts}/></Field>
   <Pill color="lime">Строк: {rows.length-1}</Pill>
   <Button primary onClick={()=>exportCSV('college-'+reportType.toLowerCase().replace(/\s/g,'-')+'.csv',rows)}><FileSpreadsheet size={15}/> Скачать CSV для Excel</Button>
   <Button onClick={()=>exportJSON('college-schedule-report.json',{name:reportType,week:p.week,rows})}><Download size={15}/> Скачать JSON</Button>
   <Button onClick={()=>window.print()}><Printer size={15}/> Печать текущего экрана</Button>
   <Notice>CSV и JSON формируются из изменённых данных стенда. Юридически значимые ведомости и унифицированные формы подключаются отдельно.</Notice>
  </div></Panel><Panel title="Предварительный просмотр"><Rows heads={rows[0].map(String)} rows={rows.slice(1,21).map(r=>r.map(String))}/></Panel></div>;
 };
 const makeSettings=()=>{
  return <div className="studio-stack"><div className="studio-columns"><Panel title="Компактность и интерфейс"><div className="studio-form">
   <Field title="Плотность расписания"><Select value={p.density} onChange={v=>p.setDensity(v as 'compact'|'standard')} items={[{id:'compact',label:'Компактная'},{id:'standard',label:'Стандартная'}]}/></Field>
   <Field title="Учебных дней в неделю"><Select value={p.days} onChange={v=>{
 const days=Number(v)===5?5:6;
 try{localStorage.setItem('college-schedule-workweek-v1',String(days))}catch{}
 p.setDays(days);
 }} items={[{id:5,label:'Пн–Пт · пятидневка'},{id:6,label:'Пн–Сб · шестидневка'}]}/></Field>
   <Notice>Выходные и праздники автоматически исключаются из ручного назначения, шаблонов и годового расчёта. Для 2026 и 2027 годов применяются утверждённые переносы, при этом правила пятидневки и шестидневки отличаются. Региональные и колледжные периоды настраиваются в учебном календаре.</Notice>
   <Notice>Цветовая система: глубокий бирюзовый, светлая нейтральная поверхность и лаймовый акцент College Ecosystem.</Notice>
  </div></Panel><Panel title="Сетка звонков — редактирование для демонстрации">
   {db.times.map((t,i)=><div className="studio-list-row" key={i}><b>{i+1} пара</b><input value={t} onChange={e=>put(d=>({...d,times:d.times.map((x,j)=>j===i?e.target.value:x)}))}/></div>)}
   <Notice>В расписании общая сетка времени пока задаётся Academic Core. Изменения здесь сохранены как демонстрационная конфигурация.</Notice>
  </Panel></div><Panel title="Ограничения и приоритеты генератора">
   <div className="studio-inline-filters"><Field title="Показать"><Select value={viewRule} onChange={setViewRule} items={[{id:'all',label:'Все'},{id:'hard',label:'Жёсткие'},{id:'soft',label:'Мягкие'}]}/></Field></div>
   <Rows heads={['Активно','Правило','Тип','Приоритет']} rows={db.rules.filter(x=>viewRule==='all'||(viewRule==='hard')===x.hard).map(r=>[<input type="checkbox" checked={r.enabled} onChange={()=>toggleRule(r.id)}/>,r.name,r.hard?<Pill color="amber">Жёсткое</Pill>:<Pill color="blue">Пожелание</Pill>,r.weight])}/>
   <Notice>В работающем серверном планировщике жёсткие ограничения нельзя отключать без проверки полномочий. Здесь это демонстрация интерфейса настроек.</Notice>
  </Panel><Button onClick={restoreData} danger><RotateCcw size={15}/> Восстановить дополнительные данные</Button></div>;
 };
 const makeTeacher=()=>{
  const own=curr.filter(x=>x.teacher===p.teacher&&x.status!=='cancelled').sort((a,b)=>a.day-b.day||a.slot-b.slot);
  return <div className="studio-stack"><div className="studio-inline-filters"><Field title="Преподаватель"><Select value={p.teacher} onChange={p.setTeacher} items={opts(TEACHERS)}/></Field><Field title="Неделя"><Select value={p.week} onChange={v=>p.setWeek(Number(v))} items={weekOpts}/></Field></div>
   <div className="studio-stats"><BaseStat value={own.length} label="Занятий"/><BaseStat value={own.length*2+' ч'} label="Назначено"/><BaseStat value={own.filter(x=>x.mode!=='offline').length} label="Дистанционно"/><BaseStat value={own.filter(x=>x.status==='held').length} label="Отмечено проведённым"/></div>
   <Panel title="Личное расписание преподавателя">
    <Rows heads={['День','Пара','Группы','Дисциплина','Место','Тип','']} rows={own.map(x=>[DAYS[x.day],x.slot,x.groups.join(', '),x.subject,x.room,<Pill color={x.type==='regular'?'gray':'lime'}>{TYPES[x.type]}</Pill>,<MiniButton onClick={()=>ifOpen(x)}>Занятие</MiniButton>])}/>
   </Panel><Notice>Роли, личные данные и доступ к журналу здесь не реализованы: это демонстрация пользовательского вида.</Notice></div>;
 };
 const makeStudent=()=>{
  const mine=curr.filter(x=>x.groups.includes(p.group)&&x.status!=='cancelled').sort((a,b)=>a.day-b.day||a.slot-b.slot);
  const members=db.roster[p.group]||[];const student=members[studentIndex]||members[0];
  return <div className="studio-stack"><div className="studio-inline-filters"><Field title="Группа"><Select value={p.group} onChange={v=>{p.setGroup(v);setStudentIndex(0)}} items={opts(GROUPS.map(x=>x.id))}/></Field><Field title="Студент (синтетические данные)"><Select value={studentIndex} onChange={v=>setStudentIndex(Number(v))} items={members.map((x,i)=>({id:i,label:x.name}))}/></Field><Field title="Неделя"><Select value={p.week} onChange={v=>p.setWeek(Number(v))} items={weekOpts}/></Field></div>
   <div className="studio-stats"><BaseStat value={mine.length} label="Занятий группы"/><BaseStat value={student?.subgroup||'—'} label="Подгруппа"/><BaseStat value={mine.filter(x=>x.mode!=='offline').length} label="Дистанционно"/><BaseStat value={mine.filter(x=>x.type==='stream').length} label="Потоковых лекций"/></div>
   <Panel title="Индивидуальное расписание студента">
    <Rows heads={['День','Пара','Дисциплина','Преподаватель','Место','Организация']} rows={mine.map(x=>[DAYS[x.day],x.slot,x.subject,x.teacher,x.type==='subgroup'?x.room.split(/\s*\/\s*/)[(student?.subgroup||1)-1]||x.room:x.room,<Pill color={x.type==='subgroup'?'blue':x.type==='stream'?'green':x.type==='parallel'?'lime':'gray'}>{x.type==='subgroup'?'Подгруппа '+(student?.subgroup||1):TYPES[x.type]}</Pill>])}/>
   </Panel><Notice>Общая группа и принадлежность подгруппе учитываются раздельно. Реальная фильтрация занятий по составу подгруппы будет подключена к Academic Core.</Notice></div>;
 };
 const content=(()=>{switch(p.screen){
 case 'overview':return makeOverview();
 case 'academic':return makeAcademic();
 case 'calendar':return makeCalendar();
 case 'templates':return makeTemplates();
 case 'generator':return makeGenerator();
 case 'substitutions':return makeSubstitutions();
 case 'groups':return makeGroups();
 case 'streams':return makeStream();
 case 'parallels':return makeParallel();
 case 'resources':return makeResources();
 case 'distance':return makeDistance();
 case 'workload':return makeWorkload();
 case 'publication':return makePublication();
 case 'reports':return makeReports();
 case 'settings':return makeSettings();
 case 'teacher':return makeTeacher();
 case 'student':return makeStudent();
 default:return <Notice>Для этого раздела используйте главный редактор расписания.</Notice>;
 }})();
 const contextGroup=p.screen==='groups'?groupDetails:p.screen==='streams'||p.screen==='parallels'?groups[0]:p.screen==='distance'?(formatScope==='one'?formatGroup:undefined):p.screen==='student'?p.group:['overview','academic','publication','reports','settings'].includes(p.screen)?p.group:undefined;
 const contextTeacher=p.screen==='substitutions'?selectedAbsence?.teacher:p.screen==='teacher'?p.teacher:p.screen==='workload'?teacherHours:undefined;
 const contextRoom=p.screen==='resources'?selectedRoom:undefined;
 const viewTitle=p.screen==='distance'?(formatScope==='all'?'Все группы':formatScope==='department'?'Отделение: '+formatDepartment:'Группа '+formatGroup):p.screen==='substitutions'?'Преподаватель: '+(selectedAbsence?.teacher||''):p.screen==='resources'?'Аудитория '+selectedRoom:p.screen==='workload'||p.screen==='teacher'?'Преподаватель '+(contextTeacher||''):'Группа '+(contextGroup||'');
 if(['calendar','templates','generator','settings','academic','overview','reports','publication'].includes(p.screen))return content;
 return <div className="studio-stack">
  <section className="studio-context-box">
   <header><div><strong>Как это выглядит в расписании</strong><span>{viewTitle} · {weekRange()}</span></div>
    <button type="button" onClick={()=>setShowVisual(v=>!v)}>{showVisual?'Свернуть':'Развернуть'} {showVisual?<ChevronRight size={14}/>:<ChevronRight size={14}/>}</button>
   </header>
   {showVisual&&<div className="studio-context-visuals"><MiniSchedule lessons={p.items} week={p.week} group={contextGroup} teacher={contextTeacher} room={contextRoom} maxSlot={6} title={viewTitle}/><LoadBars lessons={p.items} week={p.week} group={contextGroup} teacher={contextTeacher} room={contextRoom}/></div>}
  </section>
  <div className="studio-note" role="status"><Clock size={15}/> Действия в этом разделе относятся к текущей учебной неделе: {weekRange()}. Настройки года и КУГ изменяются в соответствующих разделах.</div>
  {content}
 </div>;

}

