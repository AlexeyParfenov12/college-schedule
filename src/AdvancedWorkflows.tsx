import { useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { AlertTriangle, ArrowLeftRight, BarChart3, Bell, BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight, Clock, Copy, Download, FileSpreadsheet, Filter, GitFork, GraduationCap, History, Laptop, Network, Plus, Printer, RotateCcw, Search, Send, Settings2, ShieldCheck, SlidersHorizontal, Trash2, Users, WandSparkles, X } from 'lucide-react';
import { GROUPS, TEACHERS, SUBJECTS, ROOMS, ROSTERS, CALENDAR, RULES, ABSENCES, DAYS, TIMES, TYPES, MODES, NAV } from './data';
import type { Lesson, Absence, CalendarEvent, Rule, Mode, Participant } from './data';
import { exportCSV, exportJSON, findFree, validate, groupCount, workload, reportRows, QUALIFICATIONS, occupiedRooms } from './demoLogic';

type Screen=typeof NAV[number][0];
type Snapshot={id:string;label:string;at:string;week:number;lessons:Lesson[];notice:string};
type Template={id:string;name:string;week:number;group:string;weeks:number;locked:boolean};
type Roster=Record<string,{id:string;name:string;subgroup:number}[]>;
type RoomsMap=Record<string,{blocked:boolean;reason:string}>;
type Store={calendar:CalendarEvent[];roster:Roster;absences:Absence[];rooms:RoomsMap;rules:Rule[];snapshots:Snapshot[];templates:Template[];times:string[];notifications:string[]};
const key='college-schedule-extras-v1';
const defaults=():Store=>({calendar:CALENDAR,roster:ROSTERS,absences:ABSENCES,rooms:{},rules:RULES,snapshots:[],templates:[{id:'template-a',name:'Двухнедельный цикл ИТ',week:0,group:'П-21',weeks:2,locked:true},{id:'template-b',name:'Основной цикл радиотехники',week:0,group:'Р-21',weeks:4,locked:false}],times:[...TIMES],notifications:[]});
const saved=():Store=>{try{const v=localStorage.getItem(key);if(v){const s=JSON.parse(v);return {...defaults(),...s}}}catch{}return defaults()};
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
 onNavigate:(key:Screen)=>void; onEdit:(item:Lesson)=>void;
 notify:(text:string)=>void; markDraft:()=>void;
 status:'draft'|'published'; setStatus:Dispatch<SetStateAction<'draft'|'published'>>;
 density:'compact'|'standard'; setDensity:Dispatch<SetStateAction<'compact'|'standard'>>;
 days:number; setDays:Dispatch<SetStateAction<number>>;
};
function Panel({title,children,aside}:{title:string;children:ReactNode;aside?:ReactNode}){return <section className="studio-panel"><header><strong>{title}</strong>{aside}</header><div className="studio-inner">{children}</div></section>}
function Button({children,onClick,primary=false,disabled=false,danger=false}:{children:ReactNode;onClick:()=>void;primary?:boolean;disabled?:boolean;danger?:boolean}){return <button type="button" className={'studio-btn '+(primary?'strong ':'')+(danger?'danger':'')} disabled={disabled} onClick={onClick}>{children}</button>}
function Select({value,onChange,items}:{value:string|number;onChange:(value:string)=>void;items:{id:string|number;label:string}[]}){return <select value={value} onChange={e=>onChange(e.target.value)}>{items.map((v,i)=><option key={i} value={v.id}>{v.label}</option>)}</select>}
function Field({title,children}:{title:string;children:ReactNode}){return <label className="studio-field"><span>{title}</span>{children}</label>}
const opts=(xs:string[])=>xs.map(x=>({id:x,label:x}));
const weekOpts=Array.from({length:16},(_,i)=>({id:i,label:'Учебная неделя '+(i+1)}));
function Pill({children,color='gray'}:{children:ReactNode;color?:'gray'|'green'|'red'|'amber'|'blue'|'lime'}){return <span className={'studio-pill '+color}>{children}</span>}
function Rows({heads,rows}:{heads:string[];rows:ReactNode[][]}){return <div className="studio-table-scroll"><table className="studio-table"><thead><tr>{heads.map((x,i)=><th key={i}>{x}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}
function Notice({children,kind='info'}:{children:ReactNode;kind?:'info'|'warning'}){return <div className={'studio-note '+kind}><AlertTriangle size={15}/><span>{children}</span></div>}
function BaseStat({value,label,emphasis=''}:{value:string|number;label:string;emphasis?:string}){return <div className="studio-stat"><strong className={emphasis}>{value}</strong><small>{label}</small></div>}
function MiniButton({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button type="button" className="studio-link" onClick={onClick}>{children}<ChevronRight size={13}/></button>}

export default function AdvancedWorkflows(p:Props){
 const [db,setDb]=useState<Store>(saved);
 const put=(update:(prev:Store)=>Store)=>{setDb(v=>{const next=update(v);try{localStorage.setItem(key,JSON.stringify(next))}catch{p.notify('Хранилище браузера заполнено: история может не сохраниться')}return next})};
 const editData=(fn:(prev:Lesson[])=>Lesson[],msg='Изменения сохранены в черновике')=>{p.setItems(fn);p.markDraft();p.notify(msg)};
 const curr=p.items.filter(x=>(x.week||0)===p.week);
 const [query,setQuery]=useState('');
 const [subject,setSubject]=useState('Программирование');
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
 const [subTeacher,setSubTeacher]=useState(TEACHERS[3]);
 const [absenceId,setAbsenceId]=useState('abs-1');
 const [mode,setMode]=useState<Mode>('online');
 const [formatGroup,setFormatGroup]=useState('П-21');
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
 const [parallelMethod,setParallelMethod]=useState('Кабинет + дистанционное подключение');
 const [partRoom,setPartRoom]=useState(ROOMS[1].id);
 const [copyAll,setCopyAll]=useState(false);
 const [viewRule,setViewRule]=useState('all');
 const [distanceStart,setDistanceStart]=useState(0);
 const [distanceEnd,setDistanceEnd]=useState(4);
 const selectedAbsence=db.absences.find(x=>x.id===absenceId)||db.absences[0];
 const onGroup=(g:string)=>setGroups(v=>v.includes(g)?v.filter(x=>x!==g):[...v,g]);
 const groupButtons=<div className="studio-group-select">{GROUPS.map(g=><label key={g.id} className={groups.includes(g.id)?'chosen':''}><input type="checkbox" checked={groups.includes(g.id)} onChange={()=>onGroup(g.id)}/>{g.id}</label>)}</div>;
 const ifOpen=(x:Lesson)=>{p.setGroup(x.groups[0]||'П-21');p.onNavigate('schedule');p.onEdit(x)};
 const findProblems=useMemo(()=>curr.flatMap(x=>validate(x,curr).map(issue=>({lesson:x,issue}))).filter((v,i,a)=>a.findIndex(z=>z.lesson.id===v.lesson.id&&z.issue.message===v.issue.message)===i),[curr]);
 const involved=useMemo(()=>selectedAbsence?curr.filter(x=>x.teacher===selectedAbsence.teacher&&x.day>=selectedAbsence.from&&x.day<=selectedAbsence.to&&x.status!=='cancelled'):[],[curr,selectedAbsence]);
 const selectedRoster=db.roster[groupDetails]||[];
 const byTeacher=curr.filter(x=>x.teacher===teacherHours&&x.status!=='cancelled');
 const roomUsages=curr.filter(x=>occupiedRooms(x).includes(selectedRoom));
 const beginWeek=p.week;
 const restoreData=()=>{if(!window.confirm('Восстановить учебные дополнительные настройки и состав подгрупп?'))return;put(()=>defaults());p.notify('Дополнительные настройки восстановлены')};
 const lesson=(type:Lesson['type'],participants?:Participant[]):Lesson=>({id:'new-'+newId(),day,slot,week:p.week,subject,teacher,groups:[...groups],room:selectedRoom,type,mode:'offline',participants,hours:2,notes:type==='parallel'?'Способ организации: '+parallelMethod:undefined});
 const create=(x:Lesson)=>{
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
   </Panel></div>;
 };
 const makeAcademic=()=>{
  const grps=GROUPS.filter(g=>(g.id+' '+g.specialty+' '+g.department).toLowerCase().includes(query.toLowerCase()));
  return <div className="studio-stack"><div className="studio-headbar"><input placeholder="Найти группу, отделение, специальность..." value={query} onChange={e=>setQuery(e.target.value)}/><Pill color="green">{GROUPS.length} групп · {TEACHERS.length} преподавателя</Pill></div>
    <Panel title="Академические группы — справочник Academic Core">
      <Rows heads={['Группа','Отделение','Курс','Специальность','Студентов','Действия']} rows={grps.slice(0,limit).map(g=>[g.id,g.department,g.course,g.specialty,g.count,<MiniButton onClick={()=>{setGroupDetails(g.id);p.onNavigate('groups')}}>Состав</MiniButton>])}/>
      {grps.length>limit&&<Button onClick={()=>setLimit(v=>v+40)}>Показать ещё ({grps.length-limit})</Button>}
    </Panel><div className="studio-columns"><Panel title="Кадровый справочник">{TEACHERS.slice(0,15).map(t=><div className="studio-list-row" key={t}><b>{t}</b><small>{QUALIFICATIONS[t]?.join(', ')}</small></div>)}</Panel><Panel title="Учебные дисциплины">{SUBJECTS.map(s=><div className="studio-chip" key={s}>{s}</div>)}</Panel></div>
   <Notice>Данные предназначены для демонстрации. Реальные преподаватели, студенты, TeachingAssignment и учебные планы должны поступать из общего Academic Core.</Notice></div>;
 };
 const makeCalendar=()=>{
 const selected=db.calendar.slice().sort((a,b)=>a.from.localeCompare(b.from));
 return <div className="studio-columns"><Panel title="Учебный календарь">
  <Rows heads={['Период','Вид','Начало','Окончание','Группы','']} rows={selected.map(x=>[x.title,<Pill color={x.kind==='exam'?'amber':x.kind==='holiday'?'red':'blue'}>{({study:'Учёба',exam:'Сессия',vacation:'Каникулы',practice:'Практика',holiday:'Выходной'} as const)[x.kind]}</Pill>,x.from,x.to,x.groups.length?x.groups.join(', '):'Все',<button className="studio-ghost" title="Удалить" onClick={()=>put(d=>({...d,calendar:d.calendar.filter(e=>e.id!==x.id)}))}><Trash2 size={14}/></button>])}/>
 </Panel><Panel title="Добавить период"><div className="studio-form">
  <Field title="Название"><input value={calendarName} onChange={e=>setCalendarName(e.target.value)}/></Field>
  <Field title="Тип"><Select value={calendarKind} onChange={v=>setCalendarKind(v as CalendarEvent['kind'])} items={[['study','Учебный период'],['practice','Практика'],['exam','Сессия'],['vacation','Каникулы'],['holiday','Нерабочий день']].map(([id,label])=>({id,label}))}/></Field>
  <div className="studio-duo"><Field title="С"><input type="date" value={calendarFrom} onChange={e=>setCalendarFrom(e.target.value)}/></Field><Field title="По"><input type="date" value={calendarTo} onChange={e=>setCalendarTo(e.target.value)}/></Field></div>
  <Button primary disabled={!calendarName.trim()||calendarFrom>calendarTo} onClick={()=>{put(d=>({...d,calendar:[...d.calendar,{id:newId(),title:calendarName,kind:calendarKind,from:calendarFrom,to:calendarTo,groups:[] }]}));p.notify('Учебный период добавлен в демонстрационный календарь')}}><Plus size={15}/> Добавить период</Button>
  <Notice>Изменения календаря пока не отменяют уже опубликованные занятия: для этого нужна отдельная операция пересчёта расписания.</Notice>
 </div></Panel></div>;
 };
 const makeTemplates=()=>{
 return <div className="studio-stack"><div className="studio-inline-filters">{commonHeader}<Field title="Целевой период"><Select value={targetWeek} onChange={v=>setTargetWeek(Number(v))} items={weekOpts}/></Field></div>
 <div className="studio-columns"><Panel title="Циклы и шаблоны">
  <Rows heads={['Название','Группа','Повтор','Статус','']} rows={db.templates.map(x=>[x.name,x.group,x.weeks+' нед.',x.locked?<Pill color="green">Закреплён</Pill>:<Pill>Черновик</Pill>,<Button onClick={()=>put(d=>({...d,templates:d.templates.map(y=>y.id===x.id?{...y,locked:!y.locked}:y)}))}>{x.locked?'Снять фиксацию':'Закрепить'}</Button>])}/>
 </Panel><Panel title="Создать / скопировать шаблон"><div className="studio-form">
   <Field title="Название шаблона"><input value={templateName} onChange={e=>setTemplateName(e.target.value)}/></Field>
   <Button onClick={()=>{put(d=>({...d,templates:[...d.templates,{id:newId(),name:templateName,week:p.week,group:p.group,weeks:2,locked:false}]}));p.notify('Шаблон сохранён')}}><Plus size={15}/> Сохранить шаблон</Button>
   <label className="studio-checkbox"><input type="checkbox" checked={copyAll} onChange={e=>setCopyAll(e.target.checked)}/> Копировать все группы, а не только {p.group}</label>
   <Notice>Копирование создаёт занятия в другой неделе, не заменяя существующие. Совпадения будут проверены.</Notice>
   <Button primary disabled={targetWeek===p.week} onClick={()=>{
    const source=curr.filter(x=>copyAll||x.groups.includes(p.group));
    let added=0;
    editData(old=>{let next=[...old];for(const x of source){const c={...x,id:'copy-'+newId(),week:targetWeek};if(validate(c,next).some(i=>i.hard))continue;next.push(c);added++}return next},'Шаблон скопирован в неделю '+(targetWeek+1));
    p.notify('Добавлено занятий: '+added);
   }}><Copy size={15}/> Копировать в неделю {targetWeek+1}</Button>
 </div></Panel></div></div>;
 };
 const makeGenerator=()=>{
 const seed:Lesson={id:'proposal',week:p.week,day,slot,subject,teacher,room:selectedRoom,groups:[p.group],mode:'offline',type:'regular'};
 const possible=findFree(seed,curr,6).filter(x=>!db.rooms[x.room]?.blocked);
 const [proposal,setProposal]=useState<(typeof possible)[number]|null>(null);
 const chosen=proposal||possible[0];
 return <div className="studio-columns"><Panel title="Автоматическое составление — тестовый алгоритм"><div className="studio-form">
   <Field title="Группа"><Select value={p.group} onChange={p.setGroup} items={opts(GROUPS.map(g=>g.id))}/></Field>
   <Field title="Дисциплина"><Select value={subject} onChange={setSubject} items={opts(SUBJECTS)}/></Field>
   <Field title="Преподаватель"><Select value={teacher} onChange={setTeacher} items={opts(TEACHERS)}/></Field>
   <Field title="Количество занятий для досоставления"><input type="number" min="1" max="12" value={genNumber} onChange={e=>setGenNumber(Math.max(1,Math.min(12,Number(e.target.value)||1)))}/></Field>
   <div className="studio-note info"><SlidersHorizontal size={15}/> Учитываются жёсткие пересечения преподавателей, групп и аудиторий. Мягкие предпочтения используются при оценке вариантов.</div>
   <Button primary onClick={()=>{
    let count=0;editData(old=>{const next=[...old];for(let k=0;k<genNumber;k++){const basis={...seed,id:'auto-'+newId()};const variants=findFree(basis,next.filter(x=>(x.week||0)===p.week),6).filter(x=>!db.rooms[x.room]?.blocked);if(!variants.length)break;const best=variants[0];next.push({...basis,day:best.day,slot:best.slot,room:best.room});count++}return next},'Алгоритм дополнил расписание');p.notify('Назначено '+count+' из '+genNumber+' занятий');
   }}><WandSparkles size={15}/> Досоставить расписание</Button>
 </div></Panel><Panel title="Найденные свободные варианты" aside={<Pill color="lime">{possible.length}</Pill>}>
 {possible.slice(0,12).map((s,i)=><button key={i} className={'studio-candidate '+(chosen===s?'selected':'')} onClick={()=>setProposal(s)}><b>{DAYS[s.day]} · {s.slot} пара · аудитория {s.room}</b><span>Оценка {s.score} · конфликты: 0</span></button>)}
 {!possible.length&&<Notice kind="warning">В выбранном периоде свободных вариантов нет.</Notice>}
 {chosen&&<Button onClick={()=>create({...seed,id:'auto-'+newId(),day:chosen.day,slot:chosen.slot,room:chosen.room})}><Check size={15}/> Принять выбранный вариант</Button>}
 </Panel></div>;
 };
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
  return <div className="studio-stack"><div className="studio-columns">
   <Panel title="Отсутствия преподавателей" aside={<Pill color="amber">{db.absences.filter(x=>x.status==='open').length} открыто</Pill>}>
   <div className="studio-form">
    <Field title="Преподаватель"><Select value={teacher} onChange={setTeacher} items={opts(TEACHERS)}/></Field>
    <div className="studio-duo"><Field title="С какого дня"><Select value={fromDay} onChange={v=>setFromDay(Number(v))} items={DAYS.map((x,i)=>({id:i,label:x}))}/></Field><Field title="По какой день"><Select value={toDay} onChange={v=>setToDay(Number(v))} items={DAYS.map((x,i)=>({id:i,label:x}))}/></Field></div>
    <Field title="Причина"><Select value={reason} onChange={setReason} items={opts(['Больничный','Командировка','Отпуск','Повышение квалификации','Другое'])}/></Field>
    <Button disabled={fromDay>toDay} onClick={()=>{const abs:Absence={id:'abs-'+newId(),teacher,from:fromDay,to:toDay,reason,status:'open'};put(d=>({...d,absences:[...d.absences,abs]}));setAbsenceId(abs.id);p.notify('Отсутствие зарегистрировано')}}><Plus size={14}/> Зарегистрировать отсутствие</Button>
   </div>
   <div className="studio-list">{db.absences.map(a=><button className={'studio-candidate '+(selectedAbsence?.id===a.id?'selected':'')} onClick={()=>setAbsenceId(a.id)} key={a.id}><b>{a.teacher}</b><span>{DAYS[a.from]} — {DAYS[a.to]} · {a.reason} · {a.status==='open'?'Требует решения':'Решено'}</span></button>)}</div>
   </Panel><Panel title="Подбор замен"><div className="studio-form">
    <p className="muted">Затронутых занятий на неделе: <b>{teacherlessons.length}</b></p>
    <Field title="Замещающий преподаватель"><Select value={subTeacher} onChange={setSubTeacher} items={opts(TEACHERS.filter(t=>t!==selectedAbsence?.teacher))}/></Field>
    <Button primary disabled={!selectedAbsence||!teacherlessons.length} onClick={()=>{
     if(!selectedAbsence)return;
     let count=0;
     editData(old=>{let next=[...old];for(const x of teacherlessons){
      const replacement={...x,teacher:subTeacher,replacementFor:x.replacementFor||x.teacher,notes:((x.notes||'')+'; Замена: '+selectedAbsence.reason).trim()};
      if(validate(replacement,next).some(i=>i.hard))continue;
      next=next.map(y=>y.id===x.id?replacement:y);count++;
     }return next},'Замены оформлены');
     if(count)put(d=>({...d,absences:d.absences.map(a=>a.id===absenceId?{...a,status:'resolved'}:a)}));
     p.notify('Успешно заменено '+count+' из '+teacherlessons.length+' занятий');
    }}><ArrowLeftRight size={15}/> Подобрать и назначить замену</Button>
    <Notice>При замене выполняется проверка нового преподавателя на занятость. В реальной системе необходима дополнительная проверка его квалификации и полномочий.</Notice>
   </div>
   </Panel></div>
   <Panel title="Занятия отсутствующего преподавателя">
    <Rows heads={['День','Пара','Группа','Дисциплина','Преподаватель','']} rows={teacherlessons.slice(0,70).map(x=>[DAYS[x.day],x.slot,x.groups.join(', '),x.subject,x.teacher,<MiniButton onClick={()=>ifOpen(x)}>Открыть</MiniButton>])}/>
   </Panel>
   <Panel title="Журнал замен — текущая неделя">
    <Rows heads={['День','Пара','Группы','Было','Стало','']} rows={curr.filter(x=>x.replacementFor).map(x=>[DAYS[x.day],x.slot,x.groups.join(', '),x.replacementFor,x.teacher,<Button onClick={()=>editData(old=>old.map(y=>y.id===x.id?{...y,teacher:x.replacementFor!,replacementFor:undefined}:y),'Замена отменена')}>Вернуть</Button>])}/>
   </Panel>
  </div>;
 };
 const makeResources=()=>{
  const list=ROOMS.filter(r=>(roomType==='Все'||r.kind===roomType)&&(!roomNeed||r.pc>0)&&(r.id+' '+r.kind+' '+r.building).toLowerCase().includes(query.toLowerCase()));
  return <div className="studio-stack"><div className="studio-inline-filters">
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
  const eligible=curr.filter(x=>x.groups.includes(formatGroup)&&x.day>=distanceStart&&x.day<=distanceEnd);
  return <div className="studio-stack"><div className="studio-columns"><Panel title="Массовая смена формата"><div className="studio-form">
   <Field title="Группа"><Select value={formatGroup} onChange={setFormatGroup} items={opts(GROUPS.map(x=>x.id))}/></Field>
   <Field title="Формат занятий"><Select value={mode} onChange={v=>setMode(v as Mode)} items={Object.entries(MODES).map(([id,label])=>({id,label}))}/></Field>
   <div className="studio-duo"><Field title="С дня"><Select value={distanceStart} onChange={v=>setDistanceStart(Number(v))} items={DAYS.map((v,i)=>({id:i,label:v}))}/></Field><Field title="По день"><Select value={distanceEnd} onChange={v=>setDistanceEnd(Number(v))} items={DAYS.map((v,i)=>({id:i,label:v}))}/></Field></div>
   <Pill color="blue">Будет изменено: {eligible.length} занятий</Pill>
   <Button primary disabled={distanceStart>distanceEnd||!eligible.length} onClick={()=>{
    editData(old=>old.map(x=>eligible.some(y=>y.id===x.id)?{...x,mode,room:mode==='online'||mode==='async'?'Онлайн':x.room,notes:(x.notes||'')+'; Массовое изменение формата'}:x),'Формат занятий изменён');
   }}><Laptop size={15}/> Применить к выбранным занятиям</Button>
  </div></Panel><Panel title="Форматы обучения">{[['Очно','Аудитория + преподаватель'],['Онлайн','Синхронная конференция'],['Асинхронно','Материалы и задания без общего времени подключения'],['Гибрид','Часть студентов очно, часть онлайн']].map(([t,d])=><div className="studio-list-row" key={t}><b>{t}</b><small>{d}</small></div>)}
  <Notice>Создание реальных видеовстреч, посещаемость и подтверждение часов требуют подключённых LMS, ВКС и журнала. Здесь проверяется планирование формата.</Notice></Panel></div>
  <Panel title="Дистанционные занятия за неделю"><Rows heads={['Группа','День','Пара','Дисциплина','Формат','']} rows={curr.filter(x=>x.mode!=='offline').slice(0,70).map(x=>[x.groups.join(', '),DAYS[x.day],x.slot,x.subject,<Pill color="blue">{MODES[x.mode]}</Pill>,<MiniButton onClick={()=>ifOpen(x)}>Открыть</MiniButton>])}/></Panel></div>;
 };
 const makeWorkload=()=>{
  const teachers=TEACHERS.map(t=>({...workload:workload(p.items,t,p.week),name:t,plan:12}));
  const assigned=teachers.reduce((s,t)=>s+t.workload.assigned,0),held=teachers.reduce((s,t)=>s+t.workload.held,0);
  return <div className="studio-stack"><div className="studio-stats"><BaseStat value={assigned+' ч'} label="Назначено за неделю"/><BaseStat value={held+' ч'} label="Подтверждено в демо"/><BaseStat value={(assigned-held)+' ч'} label="Ожидает подтверждения"/><BaseStat value={teachers.filter(t=>t.workload.assigned>0).length} label="Задействовано преподавателей"/></div>
  <Panel title="Нагрузка по преподавателям">
   <Rows heads={['Преподаватель','Учебных часов (демо)','Назначено','Подтверждено','Осталось','']} rows={teachers.filter(x=>x.workload.assigned>0).slice(0,45).map(t=>[t.name,t.plan+' ч',t.workload.assigned+' ч',t.workload.held+' ч',Math.max(0,t.workload.assigned-t.workload.held)+' ч',<MiniButton onClick={()=>setTeacherHours(t.name)}>Детали</MiniButton>])}/>
  </Panel><Panel title={'Занятия преподавателя: '+teacherHours} aside={<Select value={teacherHours} onChange={setTeacherHours} items={opts(TEACHERS)}/>}>
   <Rows heads={['День','Пара','Группы','Дисциплина','Факт','']} rows={byTeacher.slice(0,55).map(x=>[DAYS[x.day],x.slot,x.groups.join(', '),x.subject,x.status==='held'?<Pill color="green">Проведено</Pill>:<Pill>По плану</Pill>,<Button onClick={()=>editData(old=>old.map(y=>y.id===x.id?{...y,status:y.status==='held'?'scheduled':'held'}:y),'Демо-статус занятия обновлён')}>{x.status==='held'?'Снять':'Подтвердить'}</Button>])}/>
  <Notice>Это имитация факта проведения для тестов. Официальные часы преподавателя и тарификация в реальной системе не формируются в браузере.</Notice>
  </Panel></div>;
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
  const reportOptions=['Расписание групп','Расписание преподавателей','Занятость аудиторий','Нагрузка преподавателей','Лист замен','Потоки','Параллели','Подгруппы','Онлайн и гибрид'];
  const rows=reportType==='Нагрузка преподавателей'?[['Преподаватель','Назначено (ч)','Проведено (ч)'],...TEACHERS.map(t=>{const w=workload(p.items,t,p.week);return [t,w.assigned,w.held]})]:
  reportType==='Занятость аудиторий'?[['Аудитория','Корпус','День','Пара','Группа','Предмет'],...ROOMS.flatMap(r=>curr.filter(x=>occupiedRooms(x).includes(r.id)).map(x=>[r.id,r.building,DAYS[x.day],x.slot,x.groups.join(', '),x.subject]))]:
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
   <Field title="Учебных дней в неделю"><Select value={p.days} onChange={v=>p.setDays(Number(v))} items={[{id:5,label:'5 дней'},{id:6,label:'6 дней'}]}/></Field>
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
    <Rows heads={['День','Пара','Дисциплина','Преподаватель','Место','Организация']} rows={mine.map(x=>[DAYS[x.day],x.slot,x.subject,x.teacher,x.room,<Pill color={x.type==='subgroup'?'blue':x.type==='stream'?'green':x.type==='parallel'?'lime':'gray'}>{x.type==='subgroup'?'Подгруппа '+(student?.subgroup||1):TYPES[x.type]}</Pill>])}/>
   </Panel><Notice>Общая группа и принадлежность подгруппе учитываются раздельно. Реальная фильтрация занятий по составу подгруппы будет подключена к Academic Core.</Notice></div>;
 };
 switch(p.screen){
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
 }
}

