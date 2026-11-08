import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode, DragEvent, MouseEvent } from 'react';
import { CalendarDays, LayoutDashboard, ArrowLeftRight, Users, Building2, Settings2, FileText, Clock3, Plus, Download, Check, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, Menu, BookOpen, Monitor, Network, GitFork, WandSparkles, Save, X, Pencil, Trash2, Copy, Bell, Layers3, BarChart3, RotateCcw, Eye, SlidersHorizontal, Send, School, Filter } from 'lucide-react';
import { DAYS, TIMES, GROUPS, TEACHERS, SUBJECTS, ROOMS, TYPES, MODES, INITIAL, NAV, CALENDAR, buildSeed } from './data';
import type { Lesson, Type, Mode } from './data';
import AdvancedWorkflows from './AdvancedWorkflows';
import { NAV_SECTIONS, PREVIEW_SCREENS, sectionForScreen } from './navigationModel';
import LessonQuickActions from './LessonQuickActions';
import SmartLessonEditor from './SmartLessonEditor';
import LessonWeekMove from './LessonWeekMove';
import AnnualPlanner from './AnnualPlanner';
import MobileSchedule from './MobileSchedule';
import PolishedSelect from './PolishedSelect';
import { moveOptions, explainCandidate, readBlockedRooms, swapOptions } from './scheduleAssist';
import type { MoveOption } from './scheduleAssist';
import { validate } from './demoLogic';
import { lessonDate, WEEK_COUNT, calendarIssues, currentDemoCalendar } from './plannerDomain';
import { LEGACY_WEEK_OFFSET, shiftLegacyWeek } from './weekTimeline';
import { classifyCalendarDay, productionDiffersFromBaseline } from './productionCalendar';
import { useProductionCalendarState } from './productionCalendarSync';
import CalendarAdminCenter from './CalendarAdminCenter';
import { useCollegeOverrideRevision } from './collegeDayOverrides';
import { auditAnnualDraft } from './yearAudit';
import { readCollegeWorkweek } from './productionCalendar';

type Item = Lesson & {week?:number};
type ScheduleContextMenu={x:number;y:number}&(
 {kind:'lesson';lesson:Item}|{kind:'empty';day:number;slot:number;blockedReason?:string}
);
type View = 'group'|'teacher'|'room';
type Screen = typeof NAV[number][0];
const iconSet=[LayoutDashboard,CalendarDays,CalendarDays,Layers3,WandSparkles,School,ArrowLeftRight,Users,Network,GitFork,Building2,Monitor,BarChart3,Send,FileText,School,Settings2,BookOpen,BookOpen];
const BASE=buildSeed(16) as Item[];
const BASE_MAP=new Map(BASE.map(x=>[x.id,JSON.stringify(x)]));
/** Read old week indexes without modifying old browser records; persist future edits to v4. */
const start=():Item[]=>{try{
 const modern=localStorage.getItem('college-schedule-edits-v4');
 const legacy=modern?null:localStorage.getItem('college-schedule-edits-v3');
 const raw=modern||legacy;
 if(raw){
  const edits=JSON.parse(raw) as {updated:Item[],removed:string[]};
  if(!Array.isArray(edits.updated)||!Array.isArray(edits.removed))return BASE;
  const changed=legacy?edits.updated.map(shiftLegacyWeek):edits.updated;
  const deleted=new Set(edits.removed);
  const updates=new Map(changed.map(x=>[x.id,x]));
  return [...BASE.filter(x=>!deleted.has(x.id)).map(x=>updates.get(x.id)||x),...changed.filter(x=>!BASE_MAP.has(x.id))];
 }
}catch{}return BASE};

const id=()=>String(Date.now())+'-'+Math.random().toString(36).slice(2,7);
const download=(name:string,content:string)=>{const blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
const cellConflict=(x:Item,all:Item[])=>all.filter(y=>y.id!==x.id&&(y.week||0)===(x.week||0)&&y.day===x.day&&y.slot===x.slot&&(x.groups.some(g=>y.groups.includes(g))||x.teacher===y.teacher||(x.mode!=='online'&&y.mode!=='online'&&x.room===y.room)));
const names=(arr:string[])=>arr.join(' + ');

function Panel({title,children,aside}: {title:string;children:ReactNode;aside?:ReactNode}){return <section className="panel"><header className="panel-top"><strong>{title}</strong>{aside}</header><div className="panel-content">{children}</div></section>}
function Tag({children,tone='muted'}:{children:ReactNode;tone?:string}){return <span className={'tag '+tone}>{children}</span>}
function Empty({children}:{children:ReactNode}){return <div className="empty">{children}</div>}
function Select({value,onChange,options}:{value:string|number;onChange:(v:string)=>void;options:{value:string|number;label:string}[]}){return <PolishedSelect value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</PolishedSelect>}
function Action({onClick,children,primary=false,disabled=false,title}:{onClick:()=>void;children:ReactNode;primary?:boolean;disabled?:boolean;title?:string}){return <button type="button" title={title} disabled={disabled} className={primary?'btn primary':'btn'} onClick={onClick}>{children}</button>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}

export default function App(){
 const production=useProductionCalendarState();
 const collegeRevision=useCollegeOverrideRevision();
 const [screen,setScreen]=useState<Screen>('schedule');
 const [collapsed,setCollapsed]=useState(false);
 const [mobileNavOpen,setMobileNavOpen]=useState(false);
 const [expandedNav,setExpandedNav]=useState<Screen[]>(['schedule']);
 const [mobileDay,setMobileDay]=useState(0);
 const [items,setItems]=useState<Item[]>(start);
 const [selected,setSelected]=useState<Item|null>(null);
 const [focusId,setFocusId]=useState<string|null>(null);
 const [sideMode,setSideMode]=useState<'assistant'|'edit'>('assistant');
 const [moveMode,setMoveMode]=useState(false);
 const [draggingId,setDraggingId]=useState<string|null>(null);
 const [dragOnly,setDragOnly]=useState(false);
 const suppressDragClick=useRef(false);
 const droppedDuringDrag=useRef(false);
 const [preview,setPreview]=useState<MoveOption|null>(null);
 const [weekMoving,setWeekMoving]=useState<Item|null>(null);
 const [contextMenu,setContextMenu]=useState<ScheduleContextMenu|null>(null);
 const [lastChange,setLastChange]=useState<{before:Item[];changedIds:string[]}|null>(null);
 const [yearBackup,setYearBackup]=useState<{items:Item[];status:'draft'|'published'}|null>(null);
 const [hoverMove,setHoverMove]=useState<MoveOption|null>(null);
 const [view,setView]=useState<View>('group');
 const [group,setGroup]=useState('П-21');
 const [teacher,setTeacher]=useState(TEACHERS[0]);
 const [room,setRoom]=useState('102');
 const [week,setWeek]=useState(LEGACY_WEEK_OFFSET);
 const [density,setDensity]=useState<'compact'|'standard'>('compact');
 const [days,setDays]=useState<5|6>(readCollegeWorkweek);
 const [status,setStatus]=useState<'draft'|'published'>('draft');
 const [notice,setNotice]=useState('');
 const [replacement,setReplacement]=useState('Петров М. С.');
 const [genPreference,setGenPreference]=useState(true);
 const [studentsGroup,setStudentsGroup]=useState('П-21');
 useEffect(()=>{try{
 const existing=new Set(items.map(x=>x.id));
 const updated=items.filter(x=>BASE_MAP.get(x.id)!==JSON.stringify(x));
 const removed=BASE.filter(x=>!existing.has(x.id)).map(x=>x.id);
 localStorage.setItem('college-schedule-edits-v4',JSON.stringify({updated,removed}));
}catch(e){console.warn('Не удалось сохранить демо-изменения:',e)}},[items]);
 useEffect(()=>{if(notice){const timer=setTimeout(()=>setNotice(''),3500);return ()=>clearTimeout(timer)}},[notice]);
 const current=useMemo(()=>items.filter(x=>(x.week||0)===week),[items,week]);
 const blockedRooms=readBlockedRooms();
 const blockedKey=blockedRooms.join('|');
 const targets=useMemo(()=>selected?moveOptions(selected,current,blockedRooms,days,6):[],[selected,current,blockedKey,days]);
 const targetByCell=useMemo(()=>new Map(targets.map(t=>[t.day+':'+t.slot,t])),[targets]);
 const availableTargetCount=targets.filter(t=>t.kind==='available').length;
 const bellTimes=(()=>{try{const v=JSON.parse((localStorage.getItem('college-schedule-extras-v2')||localStorage.getItem('college-schedule-extras-v1'))||'{}');return Array.isArray(v.times)&&v.times.length===6?v.times as string[]:TIMES}catch{return TIMES}})();
 const resetSeed=()=>{if(window.confirm('Сбросить все изменения в расписании? Синтетическая база останется, черновики будут удалены.')){localStorage.removeItem('college-schedule-edits-v4');localStorage.removeItem('college-schedule-extras-v2');localStorage.removeItem('college-schedule-edits-v3');localStorage.removeItem('college-schedule-extras-v1');window.location.reload()}};
 const visible=current.filter(x=>view==='group'?x.groups.includes(group):view==='teacher'?x.teacher===teacher:x.room.includes(room));
 const collisions=selected?cellConflict(selected,current):[];
 const issueCount=current.filter(x=>x.status!=='cancelled'&&(cellConflict(x,current).length>0||calendarIssues(x,currentDemoCalendar(),days).length>0)).length;
 const productionChangedLessons=useMemo(()=>items.filter(x=>x.status!=='cancelled'&&
  productionDiffersFromBaseline(lessonDate(x.week||0,x.day),days)),[items,days,production.revision,collegeRevision]);
 const weekProductionDays=Array.from({length:days},(_,i)=>classifyCalendarDay(lessonDate(week,i),days));
 const closedWithLessons=current.filter(x=>x.status!=='cancelled'&&weekProductionDays[x.day]?.nonWorking);
 const displayName=NAV.find(x=>x[0]===screen)?.[1]||'Расписание';
 const choose=(x:Item)=>{setDragOnly(false);setMobileDay(x.day);setFocusId(null);setContextMenu(null);setSelected(x);setSideMode('assistant');setMoveMode(false);setDraggingId(null);setPreview(null);setHoverMove(null)};
 const beginDrag=(event:DragEvent<HTMLButtonElement>,lesson:Item)=>{
  if(lesson.status==='held'){event.preventDefault();setNotice('Проведённое занятие заблокировано для переноса');return}
  suppressDragClick.current=true;droppedDuringDrag.current=false;setDragOnly(true);
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('lessonId',lesson.id);
  setContextMenu(null);setSelected(lesson);setSideMode('assistant');
  setMoveMode(true);setDraggingId(lesson.id);setPreview(null);setHoverMove(null);
 };
 const finishDrag=()=>{
  const dropped=droppedDuringDrag.current;droppedDuringDrag.current=false;
  setDraggingId(null);setMoveMode(dropped);setHoverMove(null);
  if(!dropped){setSelected(null);setDragOnly(false)}
 };
 const make=(day=0,slot=1)=>{setMobileDay(day);const created:Item={id:id(),day,slot,week,subject:'',teacher:view==='teacher'?teacher:'',groups:view==='group'?[group]:[],room:view==='room'?room:'',type:'regular',mode:'offline'};setSelected(created);setSideMode('edit');setMoveMode(false);setPreview(null)};

 const save=(x:Item)=>{
  if(items.find(y=>y.id===x.id)?.status==='held'){setNotice('Проведённое занятие нельзя изменить без процедуры исправления');return false}
  const errors=explainCandidate(x,items,readBlockedRooms());
  if(errors.length){setNotice('Не сохранено: '+errors[0]);return false}
  setLastChange({before:items.filter(y=>y.id===x.id),changedIds:[x.id]});
  setItems(v=>[...v.filter(y=>y.id!==x.id),x]);
  setSelected(null);setMoveMode(false);setPreview(null);setStatus('draft');
  setNotice('Изменение сохранено · можно отменить последнее действие');
  return true;
 };
 const askRemove=(key:string)=>{
  const x=items.find(y=>y.id===key);
  if(!x)return;
  if(x.status==='held'){setNotice('Проведённое занятие нельзя удалить через редактор');return}
  if(window.confirm('Удалить занятие «'+x.subject+'» ('+x.groups.join(' + ')+', '+DAYS[x.day]+', '+x.slot+'-я пара)?\nЭто действие можно отменить.'))remove(key);
 };
 const remove=(key:string)=>{
  const existing=items.find(x=>x.id===key);
  if(existing?.status==='held'){setNotice('Проведённое занятие нельзя удалить');return}
  setLastChange({before:existing?[existing]:[],changedIds:[key]});
  setItems(v=>v.filter(x=>x.id!==key));
  setSelected(null);setMoveMode(false);setPreview(null);setStatus('draft');setNotice('Занятие удалено из черновика');
 };
 const undo=()=>{
  if(!lastChange)return;
  setItems(v=>[...v.filter(x=>!lastChange.changedIds.includes(x.id)),...lastChange.before]);
  setLastChange(null);setStatus('draft');setSelected(null);setMoveMode(false);setPreview(null);setNotice('Последнее изменение отменено');
 };
 const inspectTarget=(day:number,slot:number)=>{
  if(!selected||selected.status==='held')return;
  const next=targetByCell.get(day+':'+slot);
  if(!next||next.kind==='current')return;
  if(next.kind==='blocked'){setNotice('Нельзя перенести: '+next.reason);return}
  setPreview(next);
 };
 const confirmMove=()=>{
  if(!selected||!preview)return;
  save({...selected,day:preview.day,slot:preview.slot});
 };
 const performSwap=(other:Item)=>{
  if(!selected)return;
  const allowed=swapOptions(selected,current,readBlockedRooms()).find(x=>x.lesson.id===other.id);
  if(!allowed?.available){setNotice('Обмен недоступен: '+(allowed?.reason||'Нет подходящего варианта'));return}
  if(!window.confirm('Обменять '+selected.subject+' ('+DAYS[selected.day]+', '+selected.slot+' пара) и '+other.subject+' ('+DAYS[other.day]+', '+other.slot+' пара)?'))return;
  const first={...selected,day:other.day,slot:other.slot};
  const second={...other,day:selected.day,slot:selected.slot};
  const remaining=items.filter(x=>x.id!==selected.id&&x.id!==other.id);
  if(explainCandidate(first,[...remaining,second],readBlockedRooms()).length||explainCandidate(second,[...remaining,first],readBlockedRooms()).length){setNotice('Обмен отменён: расписание успело измениться');return}
  setLastChange({before:[selected,other],changedIds:[selected.id,other.id]});
  setItems([...remaining,first,second]);setStatus('draft');setSelected(null);setMoveMode(false);setPreview(null);setNotice('Занятия обменены местами · доступна отмена');
 };
 const closeSelected=()=>{setDragOnly(false);setSelected(null);setMoveMode(false);setDraggingId(null);setPreview(null);setHoverMove(null);setContextMenu(null)};
 const contextPosition=(event:MouseEvent<HTMLElement>)=>({
  x:Math.max(8,Math.min(event.clientX,window.innerWidth-240)),
  y:Math.max(8,Math.min(event.clientY,window.innerHeight-245))
 });
 // Right click is menu-only: never select a lesson or open its side panel.
 const rightClick=(event:MouseEvent<HTMLButtonElement>,lesson:Item)=>{
  event.preventDefault();event.stopPropagation();
  setContextMenu({...contextPosition(event),kind:'lesson',lesson});
 };
 const rightClickEmpty=(event:MouseEvent<HTMLDivElement>,day:number,slot:number,blockedReason?:string)=>{
  event.preventDefault();event.stopPropagation();
  if(moveMode||draggingId)return; // Preserve the drag/transfer interaction.
  setContextMenu({...contextPosition(event),kind:'empty',day,slot,blockedReason});
 };
 const moveAcrossWeeks=(next:Item)=>{
  const source=items.find(x=>x.id===next.id);
  if(!source){setNotice('Исходное занятие больше не существует');return}
  if(source.status==='held'){setNotice('Проведённое занятие нельзя перенести');return}
  const errors=explainCandidate(next,items,readBlockedRooms());
  if(errors.length){setNotice('Перенос отменён: '+errors[0]);return}
  setLastChange({before:[source],changedIds:[source.id]});
  setItems(v=>v.map(x=>x.id===next.id?next:x));
  setWeek(next.week||0);setWeekMoving(null);setSelected(null);setContextMenu(null);setMoveMode(false);setPreview(null);
  setStatus('draft');setNotice('Занятие перенесено на неделю '+((next.week||0)+1)+' · доступна отмена');
 };
 useEffect(()=>{
  if(!contextMenu)return;
  const dismiss=()=>setContextMenu(null);
  document.addEventListener('click',dismiss);
  return ()=>document.removeEventListener('click',dismiss);
 },[contextMenu]);;
 const move=(key:string,day:number,slot:number)=>{
  const source=items.find(x=>x.id===key);
  if(!source)return;
  setSelected(source);setSideMode('assistant');setContextMenu(null);setHoverMove(null);
  const dest=moveOptions(source,current,readBlockedRooms(),days,6).find(t=>t.day===day&&t.slot===slot);
  if(!dest||dest.kind==='current')return;
  if(dest.kind==='blocked'){setNotice('Перенос невозможен: '+dest.reason);return}
  setPreview(dest);
 };
 useEffect(()=>{
   const handler=(e:KeyboardEvent)=>{
    if(e.key==='Escape'){setPreview(null);setMoveMode(false);setDraggingId(null);setHoverMove(null);setContextMenu(null);setWeekMoving(null);return}
    const target=e.target as HTMLElement|null;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&lastChange&&!['INPUT','TEXTAREA','SELECT'].includes(target?.tagName||'')){e.preventDefault();undo()}
   };
   window.addEventListener('keydown',handler);return ()=>window.removeEventListener('keydown',handler);
 },[lastChange,items]);
 const exportCSV=(dataset=current)=>download('college-schedule.csv',['День;Пара;Группа;Дисциплина;Преподаватель;Аудитория;Организация;Формат',...dataset.map(x=>[DAYS[x.day],x.slot,names(x.groups),x.subject,x.teacher,x.room,TYPES[x.type],MODES[x.mode]].join(';'))].join('\n'));
 const show=(to:Screen)=>{
  setMobileNavOpen(false);setFocusId(null);setScreen(to);closeSelected();
  const section=sectionForScreen(to);
  if(section)setExpandedNav(previous=>previous.includes(section)?previous:[...previous,section]);
 };
 const toggleNavGroup=(key:Screen)=>setExpandedNav(previous=>
  previous.includes(key)?previous.filter(x=>x!==key):[...previous,key]);
 useEffect(()=>{
  if(!mobileNavOpen)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileNavOpen(false)};
  const onResize=()=>{if(window.innerWidth>820)setMobileNavOpen(false)};
  window.addEventListener('keydown',onKey);
  window.addEventListener('resize',onResize);
  return ()=>{window.removeEventListener('keydown',onKey);window.removeEventListener('resize',onResize)};
 },[mobileNavOpen]);
 const focusLesson=(lesson:Item)=>{
  const currentLesson=items.find(x=>x.id===lesson.id);
  if(!currentLesson){setNotice('Занятие было изменено или удалено. Обнови список.');return}
  setScreen('schedule');setView('group');setWeek(currentLesson.week||0);setMobileDay(currentLesson.day);
  setGroup(currentLesson.groups[0]||group);setSelected(currentLesson);setSideMode('assistant');
  setMoveMode(false);setDraggingId(null);setContextMenu(null);setFocusId(currentLesson.id);
 };
 useEffect(()=>{
  if(!focusId||screen!=='schedule')return;
  const timer=setTimeout(()=>{
   const cards=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-lesson-id]'));
   const element=cards.find(b=>b.dataset.lessonId===focusId);
   element?.scrollIntoView?.({behavior:'smooth',block:'center',inline:'center'});
  },80);
  return ()=>clearTimeout(timer);
 },[focusId,screen,view,group,week]);
 const sideGroups=view==='group'?GROUPS.map(g=>g.id):view==='teacher'?TEACHERS:ROOMS.map(r=>r.id);
 const sideValue=view==='group'?group:view==='teacher'?teacher:room;
 // A chosen lesson (or an empty slot being edited) has exactly one visibly selected cell.
 // Hide this navigation crosshair while the collision heatmap is active.
 const selectedCell=selected&&(selected.week||0)===week&&!moveMode&&!draggingId
  ? {day:preview?.day??selected.day,slot:preview?.slot??selected.slot}
  : null;
 const setSide=(s:string)=>{view==='group'?setGroup(s):view==='teacher'?setTeacher(s):setRoom(s);closeSelected()};
 const addRow=()=>make(0,1);
 const teachersTotal=[{name:TEACHERS[0],plan:144,assigned:132,done:98},{name:TEACHERS[1],plan:108,assigned:96,done:64},{name:TEACHERS[2],plan:108,assigned:88,done:56},{name:TEACHERS[3],plan:72,assigned:60,done:48}];
 const stats=(<div className="metrics"><div><strong>{current.length}</strong><span>Назначено занятий</span></div><div><strong>{current.filter(x=>x.replacementFor).length}</strong><span>Замены за неделю</span></div><div><strong>{issueCount}</strong><span>Требуют проверки</span></div><div><strong>—</strong><span>Остаток часов · нет Academic Core</span></div></div>);
 const lessonLabel=(x:Item)=>{
  const context=view==='teacher'?names(x.groups)+' · '+x.room
    :view==='room'?names(x.groups)+' · '+x.teacher
    :x.room+' · '+x.teacher;
  return <><strong>{x.subject}</strong><small title={context}>{context}</small>
   <span className="tiny">{TYPES[x.type]}{x.mode!=='offline'?' · '+MODES[x.mode]:''}</span></>;
 };
 const weekDate=useMemo(()=>{const d=new Date(lessonDate(week,0)+'T12:00:00');const e=new Date(lessonDate(week,5)+'T12:00:00');return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+' – '+e.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'})},[week]);
 const weekHeader=<div className="toolbar">
   <div className="control-group"><button className={view==='group'?'active':''} onClick={()=>{setView('group');closeSelected()}}><Users size={15}/> Группы</button><button className={view==='teacher'?'active':''} onClick={()=>{setView('teacher');closeSelected()}}>Преподаватели</button><button className={view==='room'?'active':''} onClick={()=>{setView('room');closeSelected()}}>Аудитории</button></div>
   <div className="control-group"><button aria-label="Предыдущая неделя" onClick={()=>{setWeek(w=>Math.max(0,w-1));closeSelected()}}><ChevronLeft size={15}/></button><b>{weekDate}</b><button aria-label="Следующая неделя" onClick={()=>{setWeek(w=>Math.min(WEEK_COUNT-1,w+1));closeSelected()}}><ChevronRight size={15}/></button></div>
   <div className="control-group right"><button className={density==='compact'?'active':''} onClick={()=>setDensity('compact')}>Компактно</button><button className={density==='standard'?'active':''} onClick={()=>setDensity('standard')}>Подробнее</button></div>
   <Action onClick={()=>exportCSV()}><Download size={14}/> CSV</Action>
   {lastChange&&<Action onClick={undo} title="Ctrl+Z — отменить последнее изменение"><RotateCcw size={14}/> Отменить</Action>}
   {yearBackup&&<Action title="Восстановить черновик до годового расчёта" onClick={()=>{
     if(!window.confirm('Вернуть предыдущий черновик? Последующие изменения тоже будут отменены.'))return;
     setItems(yearBackup.items);setStatus(yearBackup.status);setYearBackup(null);setLastChange(null);
     setNotice('Предыдущий черновик восстановлен');
   }}><RotateCcw size={14}/> Вернуть прошлый вариант</Action>}
 </div>;
 const grid=<div className={'timetable-scroll '+(moveMode&&selected?'move-active ':'')+(draggingId?'dragging':'')} data-testid="schedule-grid"><div className={'timetable '+density} style={{gridTemplateColumns:'74px repeat('+days+', minmax(140px,1fr))'}}>
 <div className="grid-head">Пара</div>{DAYS.slice(0,days).map((d,i)=>{
 const federal=classifyCalendarDay(lessonDate(week,i),days);
 return <div key={i} title={federal.label} className={'grid-head'+(selectedCell?.day===i?' selected-column-head':'')+(federal.nonWorking?' nonworking-head':'')}>
 {d}<small>{lessonDate(week,i).slice(8)}.{lessonDate(week,i).slice(5,7)}</small>
 {(federal.nonWorking||federal.kind==='shortened')&&<span className="federal-day-caption">{federal.kind==='holiday'?'Праздник':federal.kind==='shortened'?'Сокращённый':federal.kind==='transfer'?'Перенос':'Выходной'}</span>}
 </div>;
 })}
 {bellTimes.map((tm,row)=><div className="grid-fragment" key={row}>
  <div className={'slot'+(selectedCell?.slot===row+1?' selected-row-head':'')}><b>{row+1}</b><small>{tm}</small></div>
  {DAYS.slice(0,days).map((d,day)=>{
   const federal=classifyCalendarDay(lessonDate(week,day),days);
   const target=targetByCell.get(day+':'+(row+1));
   const cellLessons=visible.filter(x=>x.day===day&&x.slot===row+1);
   const pickedCell=selectedCell?.day===day&&selectedCell.slot===row+1;
   const crosshairRow=selectedCell?.slot===row+1;
   const crosshairColumn=selectedCell?.day===day;
   return <div key={d} data-testid={pickedCell?'selected-schedule-cell':undefined}
    data-selected={pickedCell?'true':undefined}
    className={'slot-cell '+(federal.nonWorking?' federal-closed-cell':'')+' '+(moveMode&&selected&&target?'slot-'+target.kind:'')+
      (pickedCell?' selected-slot-cell':crosshairRow?' selected-slot-row':crosshairColumn?' selected-slot-column':'')}
    title={moveMode&&target?target.reason:federal.nonWorking?federal.label:pickedCell?'Выбрано: '+DAYS[day]+', '+(row+1)+'-я пара':undefined}
    onContextMenu={e=>{if(cellLessons.length===0)rightClickEmpty(e,day,row+1,federal.nonWorking?federal.label:undefined)}}
    onDragEnter={()=>{if(draggingId&&target)setHoverMove(target)}}
    onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect=target?.kind==='available'?'move':'none'}}
    onDrop={e=>{e.preventDefault();const key=e.dataTransfer.getData('lessonId')||draggingId;if(key){droppedDuringDrag.current=true;move(key,day,row+1)}}}
    onMouseEnter={()=>{if(moveMode&&target)setHoverMove(target)}}
    onMouseLeave={()=>setHoverMove(null)}>
    {cellLessons.map(x=><button draggable={!preview&&x.status!=='held'} key={x.id} data-lesson-id={x.id}
      className={'lesson '+x.type+(selected?.id===x.id?' picked':'')+(focusId===x.id?' jump-focused':'')}
      onDragStart={(e:DragEvent<HTMLButtonElement>)=>beginDrag(e,x)} onDragEnd={finishDrag}
      onMouseDown={e=>{if(e.button===0)suppressDragClick.current=false}}
      onClick={()=>{if(suppressDragClick.current){suppressDragClick.current=false;return}choose(x)}} onContextMenu={e=>rightClick(e,x)} aria-label={'Открыть занятие: '+x.subject+', '+x.groups.join(' + ')}>{lessonLabel(x)}</button>)}
    {moveMode&&selected&&target&&cellLessons.length===0
     ? <button type="button" className={'target-overlay '+target.kind} data-testid={'target-'+day+'-'+(row+1)}
       onClick={()=>inspectTarget(day,row+1)} title={target.reason}
       aria-label={(target.kind==='available'?'Доступен перенос: ':target.kind==='blocked'?'Недоступен перенос: ':'Исходное занятие: ')+target.label+' — '+target.reason}>
        {target.kind==='available'?<><Check size={14}/> Перенести</>:target.kind==='blocked'?<><X size={13}/> Занято</>:<><CalendarDays size={13}/> Сейчас</>}
       </button>
     : (!moveMode&&cellLessons.length===0?<button className={'empty-slot'+(federal.nonWorking?' federal-disabled-slot':'')}
 disabled={federal.nonWorking} aria-label={federal.nonWorking?'Нерабочий день: '+federal.label:'Создать занятие: '+DAYS[day]+', пара '+(row+1)}
 title={federal.nonWorking?federal.label:'Назначить занятие'} onClick={()=>make(day,row+1)}>
 {federal.nonWorking?<span className="federal-no-class">Выходной</span>:<Plus size={15}/>}</button>:null)}
    {pickedCell&&<span className="selected-cell-marker" aria-hidden="true"><i className="selected-cell-dot"/> Выбрано</span>}
    {moveMode&&selected&&target&&cellLessons.length>0&&<span className={'drag-cell-indicator '+target.kind} title={target.reason}
      aria-label={(target.kind==='available'?'Можно перенести: ':target.kind==='blocked'?'Перенос запрещён: ':'Исходная ячейка: ')+target.reason}>
       {target.kind==='available'?<><Check size={12}/> Можно</>:target.kind==='blocked'?<><X size={12}/> Занято</>:<><CalendarDays size={12}/> Отсюда</>}
    </span>}
   </div>
  })}
 </div>)}
 </div></div>;
 const legend=<div className="legend"><span><i className="swatch regular"/>Обычное</span><span><i className="swatch subgroup"/>Подгруппы</span><span><i className="swatch stream"/>Поток</span><span><i className="swatch parallel"/>Параллель</span><span><i className="swatch online"/>Онлайн/гибрид</span></div>;
 const lessonContext=contextMenu?.kind==='lesson'?contextMenu:null;
 const emptyContext=contextMenu?.kind==='empty'?contextMenu:null;
 const schedule=<>
 <div className="schedule-production-strip" role="status" aria-label="Производственный календарь недели">
  <div className="schedule-production-heading"><strong>Производственный календарь</strong>
   <span>{production.status==='updated'?'Сверен '+production.checkedAt.slice(0,10):
      'Встроенные правила · '+(production.status==='unavailable'?'обновление временно недоступно':'проверка обновлений')}</span></div>
  <div className="schedule-production-days">
   {weekProductionDays.map((day,i)=><span key={day.date} className={'schedule-production-day schedule-production-'+day.kind}
     title={day.date+' · '+day.label} aria-label={DAYS[i]+', '+day.date+': '+day.label}>
      <b>{DAYS[i]}</b> {day.date.slice(8,10)} · {day.kind==='holiday'?'Праздник':
       day.kind==='transfer'?'Перенос':day.kind==='weekend'?'Выходной':
       day.kind==='shortened'||day.kind==='college-shortened'?'Сокращённый':day.kind==='college-off'?'Выходной колледжа':day.kind==='college-work'?'Рабочий колледжа':day.kind==='working-weekend'?'Рабочая суббота':'Рабочий'}
    </span>)}
  </div>
  <CalendarAdminCenter mode="summary" lessons={items} onOpen={()=>show('calendar')}/>
  {(closedWithLessons.length>0||productionChangedLessons.length>0)&&<div className="schedule-production-warning">
   <AlertTriangle size={15}/> {closedWithLessons.length>0
     ?'На нерабочие дни текущей недели назначено пар: '+closedWithLessons.length+'. Проверьте или перенесите их вручную.'
     :'Изменились календарные статусы дней. Проверьте занятия: '+productionChangedLessons.length+'.'}
  </div>}
 </div>
 {moveMode&&selected&&!draggingId&&<div className="move-toolbar"><div><ArrowLeftRight size={16}/><b>{draggingId?'Перетаскивание занятия':'Режим переноса'}</b><span>Выбрано: {selected.subject} · {selected.groups.join(' + ')}</span></div><div className="move-summary"><span className="marker available"/>{availableTargetCount} доступно <span className="marker blocked"/>{targets.filter(t=>t.kind==='blocked').length} недоступно</div><span className="move-hover-reason" role="status">{hoverMove?hoverMove.reason:draggingId?'Наведи на ячейку: зелёная — можно, красная — нельзя':'Выбери доступную ячейку'}</span><button onClick={()=>{setMoveMode(false);setDraggingId(null);setPreview(null);setDragOnly(false);setSelected(null)}}>Закрыть режим <X size={13}/></button></div>}
 {draggingId&&selected&&<div className="drag-floating-feedback" role="status" data-testid="drag-guide">
   <strong>Перемещаем: {selected.subject}</strong>
   <span><Check size={13}/> {availableTargetCount} доступно <X size={13}/> {targets.filter(t=>t.kind==='blocked').length} запрещено</span>
   <small>{hoverMove?.reason||'Наведи на ячейку: зелёная — можно, красная — нельзя'}</small>
 </div>}
 <div className="schedule-layout"><aside className="group-sidebar schedule-picker-strip" aria-label="Выбор расписания">
  <div className="schedule-picker-control">
   <label className="schedule-picker-caption" htmlFor="schedule-entity-select">
    {view==='group'?<Users size={15}/>:view==='teacher'?<BookOpen size={15}/>:<Building2 size={15}/>}
    {view==='group'?'Группа':view==='teacher'?'Преподаватель':'Аудитория'}
   </label>
   <div className="schedule-picker-field">
    <PolishedSelect id="schedule-entity-select" aria-label={view==='group'?'Выбрать группу':view==='teacher'?'Выбрать преподавателя':'Выбрать аудиторию'}
     value={sideValue} onChange={e=>setSide(e.target.value)}>
     {sideGroups.map(item=><option key={item} value={item}>{item}</option>)}
    </PolishedSelect>
   </div>
  </div>
  <span className="schedule-picker-counter">{view==='group'?'Групп':view==='teacher'?'Преподавателей':'Аудиторий'}: {sideGroups.length}</span>
  <div className="schedule-picker-create"><Action onClick={addRow}><Plus size={14}/> Занятие</Action></div>
 </aside>
 <section className="schedule-body">
  <div className="table-heading"><div><b>{sideValue}</b><small>{selectedCell?'Выбрано: '+DAYS[selectedCell.day]+', '+selectedCell.slot+'-я пара':view==='group'?'Занятия группы':view==='teacher'?'Занятия преподавателя':'Занятость аудитории'}</small></div><Tag tone={status==='published'?'green':'muted'}>{status==='published'?'Опубликовано (демо)':'Черновик'}</Tag></div>
  {grid}
  <MobileSchedule week={week} days={days} times={bellTimes} lessons={visible} day={mobileDay}
    selectedId={selected?.id} moveMode={moveMode&&Boolean(selected)} targets={targets}
    onDayChange={setMobileDay} onOpen={choose} onAdd={make} onTarget={inspectTarget}
    onCancelMove={()=>{setMoveMode(false);setPreview(null);setDraggingId(null)}}/>
  {legend}
  <div className="bottom-line"><span>Потоки и параллели переносятся целиком с участниками</span><span className="push-right">{hoverMove&&moveMode?hoverMove.reason:'Нажми на занятие — увидишь доступные варианты'}</span></div>
 </section>
 {selected&&!moveMode&&!dragOnly&&<button type="button" className="mobile-editor-backdrop" aria-label="Закрыть карточку занятия" onClick={closeSelected}/>}
 {selected&&!dragOnly&&<div className={'right-editor'+(moveMode?' mobile-move-collapsed':'')}>
   {sideMode==='assistant'&&items.some(x=>x.id===selected.id)
    ?<LessonQuickActions lesson={selected} current={current} blocked={blockedRooms} isMoveMode={moveMode}
      onMoveMode={()=>{setMoveMode(v=>!v);setPreview(null)}}
      onPreviewMove={inspectTarget} onSwap={performSwap}
      onTeacher={name=>{if(window.confirm('Заменить '+selected.teacher+' на '+name+' в '+selected.subject+'?'))save({...selected,teacher:name,replacementFor:selected.teacher,notes:(selected.notes||'')+'; Замена через подсказку'})}}
      onRoom={id=>{if(window.confirm('Изменить кабинет для '+selected.subject+' на '+id+'?'))save({...selected,room:id})}}
      onEdit={()=>{setSideMode('edit');setMoveMode(false);setPreview(null)}} onClose={closeSelected}
       onDelete={()=>askRemove(selected.id)} onWeekMove={()=>setWeekMoving(selected)}/>
    : <SmartLessonEditor key={selected.id} item={selected} save={save} remove={askRemove} cancel={closeSelected} all={current} catalog={items} view={view} contextGroup={view==='group'?group:undefined} contextTeacher={view==='teacher'?teacher:undefined} contextRoom={view==='room'?room:undefined} existing={items.some(x=>x.id===selected.id)}/>}
 </div>}
 </div>
 {lessonContext&&<div role="menu" aria-label="Действия с занятием" className="lesson-context-menu"
   style={{left:lessonContext.x,top:lessonContext.y}} onClick={e=>e.stopPropagation()}>
    <div className="lesson-context-title">{lessonContext.lesson.subject}
     <small>{lessonContext.lesson.groups.join(' + ')} · {DAYS[lessonContext.lesson.day]}, {lessonContext.lesson.slot}-я пара</small></div>
    <button role="menuitem" onClick={()=>choose(lessonContext.lesson)}><Eye size={14}/> Открыть свойства</button>
    <button role="menuitem" onClick={()=>{choose(lessonContext.lesson);setSideMode('edit')}}>
     <Pencil size={14}/> Изменить занятие</button>
    <button role="menuitem" disabled={lessonContext.lesson.status==='held'}
     onClick={()=>{choose(lessonContext.lesson);setMoveMode(true)}}>
     <ArrowLeftRight size={14}/> Перенести в этой неделе</button>
    <button role="menuitem" disabled={lessonContext.lesson.status==='held'}
     onClick={()=>{setWeekMoving(lessonContext.lesson);setContextMenu(null)}}>
     <CalendarDays size={14}/> Перенести на другую неделю</button>
    <div className="lesson-context-separator"/>
    <button role="menuitem" className="danger" disabled={lessonContext.lesson.status==='held'}
     onClick={()=>{setContextMenu(null);askRemove(lessonContext.lesson.id)}}>
     <Trash2 size={14}/> Удалить занятие</button>
   </div>}
  {emptyContext&&<div role="menu" aria-label="Действия с пустой ячейкой" className="lesson-context-menu"
   style={{left:emptyContext.x,top:emptyContext.y}} onClick={e=>e.stopPropagation()}>
    <div className="lesson-context-title">Свободная ячейка
     <small>{DAYS[emptyContext.day]}, {emptyContext.slot}-я пара · {lessonDate(week,emptyContext.day)}</small>
    </div>
    {emptyContext.blockedReason&&<p className="lesson-context-note">
     Нельзя назначить занятие: {emptyContext.blockedReason}
    </p>}
    <button role="menuitem" disabled={Boolean(emptyContext.blockedReason)}
     onClick={()=>{const {day,slot}=emptyContext;setContextMenu(null);make(day,slot)}}>
     <Plus size={14}/> Создать занятие</button>
    {emptyContext.blockedReason&&<button role="menuitem" onClick={()=>show('calendar')}>
     <CalendarDays size={14}/> Открыть учебный календарь
    </button>}
   </div>}
  {weekMoving&&<LessonWeekMove key={weekMoving.id} lesson={weekMoving} lessons={items} blockedRooms={blockedRooms} onCancel={()=>setWeekMoving(null)} onMove={moveAcrossWeeks}/>}
  {preview&&selected&&<div className="move-preview" role="dialog" aria-label="Подтверждение переноса">
   <div className="preview-title"><ArrowLeftRight size={16}/><strong>Подтвердить перенос</strong><button onClick={()=>setPreview(null)} aria-label="Закрыть предпросмотр"><X size={15}/></button></div>
   <div className="preview-route"><div><small>Сейчас</small><b>{DAYS[selected.day]}, {selected.slot}-я пара</b></div><ChevronRight size={18}/><div><small>Будет</small><b>{DAYS[preview.day]}, {preview.slot}-я пара</b></div></div>
   <div className="preview-detail">{selected.subject} · {selected.groups.join(' + ')} · {selected.teacher} · {selected.room}</div>
   <div className="preview-actions"><Action onClick={()=>setPreview(null)}>Отмена</Action><Action primary onClick={confirmMove}><Check size={15}/> Сохранить перенос</Action></div>
 </div>}
 </>;
 const table=(cols:string[],rows:(string|number|ReactNode)[][])=><div className="table-wrap"><table><thead><tr>{cols.map((col,i)=><th key={i}>{col}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>;
 const metricsTable=<Panel title="Учебная нагрузка преподавателей" aside={<Tag>II семестр</Tag>}>{table(['Преподаватель','План','Назначено','Проведено','Осталось'],teachersTotal.map(t=>[t.name,t.plan+' ч',t.assigned+' ч',t.done+' ч',<Tag tone="green">{t.plan-t.assigned} ч</Tag>]))}</Panel>;
 const cards=(list:{title:string;desc:string;action?:()=>void;tag?:string}[])=><div className="item-list">{list.map((x,i)=><div className="list-row" key={i}><div><strong>{x.title}</strong><small>{x.desc}</small></div>{x.tag&&<Tag>{x.tag}</Tag>}{x.action&&<button onClick={x.action} className="text-button">Открыть <ChevronRight size={14}/></button>}</div>)}</div>;
 const exportReports=()=>cards([{title:'Расписание групп',desc:'Занятия на выбранной неделе · CSV',action:()=>exportCSV()},{title:'Расписание преподавателей',desc:'Распределение занятий по преподавателям · CSV',action:()=>exportCSV()},{title:'Занятость аудиторий',desc:'Занятия с аудиториями · CSV',action:()=>exportCSV()},{title:'Лист замен',desc:'Примерный документ для согласования',tag:'Демо'},{title:'Выполнение учебного плана',desc:'Источником фактических часов будет электронный журнал',tag:'Интеграция'}]);
 const month=<div className="calendar-grid">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(v=><b key={v}>{v}</b>)}{Array.from({length:6},(_,i)=><span key={'o'+i}/>)}{Array.from({length:30},(_,i)=><button className={i+1>=9&&i+1<=14?'week-day':''} key={i}>{i+1}</button>)}</div>;
 const render=()=>screen==='schedule'
  ? <>{weekHeader}{schedule}</>
  : screen==='year'?<AnnualPlanner lessons={items} days={days} practiceAssignments={(()=>{
     try{const v=JSON.parse((localStorage.getItem('college-schedule-extras-v2')||'{}'));return Array.isArray(v.practiceAssignments)?v.practiceAssignments:[]}
     catch{return []}
    })()} calendar={(()=>{
      try{const v=JSON.parse((localStorage.getItem('college-schedule-extras-v2')||localStorage.getItem('college-schedule-extras-v1'))||'{}');return Array.isArray(v.calendar)?v.calendar:CALENDAR}
      catch{return CALENDAR}
    })()} notify={setNotice} onApply={(variant,weeks,workweek)=>{
      const calendar=(()=>{
        try{const value=JSON.parse((localStorage.getItem('college-schedule-extras-v2')||localStorage.getItem('college-schedule-extras-v1'))||'{}');return Array.isArray(value.calendar)?value.calendar:CALENDAR}
        catch{return CALENDAR}
      })();
      const audit=auditAnnualDraft(items,variant.lessons,weeks,calendar,readBlockedRooms(),workweek);
      if(audit.hardIssues.length){
       setNotice('Годовой вариант не применён: '+audit.hardIssues.length+' обязательных конфликтов. Первый: '+audit.hardIssues[0].reason);return
      }
      if(JSON.stringify(audit.next).length>4_600_000){
       setNotice('Годовой черновик превышает безопасный размер браузерного хранилища. Скачай JSON варианта.');return
      }
      try{
       localStorage.setItem('college-year-unplaced-v2',JSON.stringify({
        at:new Date().toISOString(),weeks,unplaced:variant.unplaced,practiceIssues:variant.practiceIssues
       }));
      }catch{setNotice('Не удалось сохранить остатки нагрузки в браузере');return}
      setYearBackup({items,status});
      setItems(audit.next);setStatus('draft');setLastChange(null);setSelected(null);setWeek(LEGACY_WEEK_OFFSET);setScreen('schedule');
      setNotice('Вариант применён к черновику: '+audit.changed+' занятий. Неразмещённых назначений: '+variant.unplaced.length+'. Доступен возврат.');
    }}/>
  : <AdvancedWorkflows screen={screen} items={items} setItems={setItems} week={week} setWeek={setWeek} group={group} setGroup={setGroup} teacher={teacher} setTeacher={setTeacher} room={room} setRoom={setRoom} onNavigate={show} onEdit={setSelected} onFocusLesson={focusLesson} notify={setNotice} markDraft={()=>setStatus('draft')} status={status} setStatus={setStatus} density={density} setDensity={setDensity} days={days} setDays={v=>setDays(v===5?5:6)}/>;
 return <div className="app">
  <aside className={'nav '+(collapsed?'closed':'')+(mobileNavOpen?' mobile-open':'')} id="mobile-college-menu">
   <div className="brand"><div className="brand-symbol">C</div><div><strong>College</strong><span>Schedule</span></div>
     <button onClick={()=>setCollapsed(v=>!v)} className="nav-toggle" aria-label={collapsed?'Развернуть навигацию':'Сузить навигацию'}><Menu size={16}/></button>
     <button type="button" className="mobile-menu-close" aria-label="Закрыть мобильное меню" onClick={()=>setMobileNavOpen(false)}><X size={20}/></button></div>
   <nav aria-label="Разделы College Schedule">
    {NAV_SECTIONS.map(section=>{
     const index=NAV.findIndex(([key])=>key===section.key);
     const Icon=iconSet[index]||CalendarDays;
     const active=screen===section.key||section.children.some(([key])=>key===screen);
     const open=expandedNav.includes(section.key);
     return <div className={'nav-section'+(active?' current':'')} key={section.key}>
      <div className="nav-section-row">
       <button type="button" title={section.label} className={'nav-primary'+(screen===section.key?' active':'')}
        aria-current={screen===section.key?'page':undefined} onClick={()=>show(section.key)}>
        <Icon size={17}/><span>{section.label}</span>
       </button>
       {section.children.length>0&&<button type="button" className="nav-expander"
        aria-label={(open?'Свернуть ':'Развернуть ')+section.label}
        aria-expanded={open} onClick={()=>toggleNavGroup(section.key)}>
        {open?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
       </button>}
      </div>
      {section.children.length>0&&open&&<div className="nav-submenu">
       {section.children.map(([key,label])=><button type="button" key={key}
        title={label} className={'nav-subitem'+(screen===key?' active':'')}
        aria-current={screen===key?'page':undefined} onClick={()=>show(key)}>
        <span className="nav-subitem-dot"/><span>{label}</span>
       </button>)}
      </div>}
     </div>;
    })}
    <details className="nav-preview">
     <summary><Eye size={15}/><span>Предпросмотр ролей</span></summary>
     {PREVIEW_SCREENS.map(([key,label])=><button type="button" key={key}
      className={'nav-preview-link'+(screen===key?' active':'')} onClick={()=>show(key)}>
      <BookOpen size={14}/><span>{label}</span></button>)}
    </details>
   </nav>
   <div className="nav-footer"><School size={17}/><span>Демо · Диспетчер</span></div>
  </aside>
  <button type="button" className={'mobile-nav-backdrop'+(mobileNavOpen?' is-visible':'')}
     aria-label="Закрыть список разделов" tabIndex={mobileNavOpen?0:-1} onClick={()=>setMobileNavOpen(false)}/>
  <div className="main">
   <header className="main-head"><button type="button" className="mobile-menu-trigger" aria-label="Открыть мобильное меню" aria-controls="mobile-college-menu" aria-expanded={mobileNavOpen} onClick={()=>setMobileNavOpen(true)}><Menu size={21}/></button><div className="page-title"><CalendarDays size={22}/><div><h1>{displayName}</h1><p>Демонстрационный учебный год 2026/2027</p></div></div><div className="head-actions"><Tag tone="muted">Колледж · Демостенд</Tag><button className="icon-btn" onClick={()=>setNotice('Все изменения сохраняются только в браузере')} title="Уведомления"><Bell size={17}/></button><Action onClick={()=>{setScreen('publication');setSelected(null)}} primary><Check size={15}/> Публикация</Action></div></header>
   <main className="workspace">{render()}</main>
   <nav className="mobile-bottom-nav" aria-label="Быстрые разделы">
     {([['schedule','Расписание',CalendarDays],['calendar','Календарь',CalendarDays],['year','Годовой',School],['overview','Обзор',LayoutDashboard]] as const).map(([key,label,Icon])=>
       <button type="button" key={key} className={screen===key?'active':''} aria-current={screen===key?'page':undefined} onClick={()=>show(key)}><Icon size={18}/><span>{label}</span></button>)}
     <button type="button" className={mobileNavOpen?'active':''} aria-label="Все разделы" onClick={()=>setMobileNavOpen(true)}><Menu size={19}/><span>Ещё</span></button>
   </nav>
   <footer className="app-foot"><span>College Schedule · тестовый стенд · {GROUPS.length} групп, {TEACHERS.length} преподавателя, {ROOMS.length} аудиторий · {items.length.toLocaleString('ru-RU')} занятий</span><button type="button" className="reset-button" onClick={resetSeed}>Сбросить демоданные</button></footer>
  </div>
  {notice&&<div role="status" className="toast"><AlertTriangle size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
 </div>;
}