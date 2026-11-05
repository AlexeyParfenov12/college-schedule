import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode, DragEvent, MouseEvent } from 'react';
import { CalendarDays, LayoutDashboard, ArrowLeftRight, Users, Building2, Settings2, FileText, Clock3, Plus, Search, Download, Check, AlertTriangle, ChevronLeft, ChevronRight, Menu, BookOpen, Monitor, Network, GitFork, WandSparkles, Save, X, Pencil, Trash2, Copy, Bell, Layers3, BarChart3, RotateCcw, Eye, SlidersHorizontal, Send, School, Filter } from 'lucide-react';
import { DAYS, TIMES, GROUPS, TEACHERS, SUBJECTS, ROOMS, TYPES, MODES, INITIAL, NAV, buildSeed } from './data';
import type { Lesson, Type, Mode } from './data';
import AdvancedWorkflows from './AdvancedWorkflows';
import LessonQuickActions from './LessonQuickActions';
import SmartLessonEditor from './SmartLessonEditor';
import LessonWeekMove from './LessonWeekMove';
import AnnualPlanner from './AnnualPlanner';
import { moveOptions, explainCandidate, readBlockedRooms, swapOptions } from './scheduleAssist';
import type { MoveOption } from './scheduleAssist';
import { validate } from './demoLogic';
import { lessonDate } from './plannerDomain';

type Item = Lesson & {week?:number};
type View = 'group'|'teacher'|'room';
type Screen = typeof NAV[number][0];
const iconSet=[LayoutDashboard,CalendarDays,CalendarDays,Layers3,WandSparkles,School,ArrowLeftRight,Users,Network,GitFork,Building2,Monitor,BarChart3,Send,FileText,School,Settings2,BookOpen,BookOpen];
const BASE=buildSeed(16) as Item[];
const BASE_MAP=new Map(BASE.map(x=>[x.id,JSON.stringify(x)]));
const start=():Item[]=>{try{
 const raw=localStorage.getItem('college-schedule-edits-v3');
 if(raw){const edits=JSON.parse(raw) as {updated:Item[],removed:string[]};const deleted=new Set(edits.removed);const updates=new Map(edits.updated.map(x=>[x.id,x]));return [...BASE.filter(x=>!deleted.has(x.id)).map(x=>updates.get(x.id)||x),...edits.updated.filter(x=>!BASE_MAP.has(x.id))]}
}catch{}return BASE};

const id=()=>String(Date.now())+'-'+Math.random().toString(36).slice(2,7);
const download=(name:string,content:string)=>{const blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
const cellConflict=(x:Item,all:Item[])=>all.filter(y=>y.id!==x.id&&(y.week||0)===(x.week||0)&&y.day===x.day&&y.slot===x.slot&&(x.groups.some(g=>y.groups.includes(g))||x.teacher===y.teacher||(x.mode!=='online'&&y.mode!=='online'&&x.room===y.room)));
const names=(arr:string[])=>arr.join(' + ');

function Panel({title,children,aside}: {title:string;children:ReactNode;aside?:ReactNode}){return <section className="panel"><header className="panel-top"><strong>{title}</strong>{aside}</header><div className="panel-content">{children}</div></section>}
function Tag({children,tone='muted'}:{children:ReactNode;tone?:string}){return <span className={'tag '+tone}>{children}</span>}
function Empty({children}:{children:ReactNode}){return <div className="empty">{children}</div>}
function Select({value,onChange,options}:{value:string|number;onChange:(v:string)=>void;options:{value:string|number;label:string}[]}){return <select value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>}
function Action({onClick,children,primary=false,disabled=false,title}:{onClick:()=>void;children:ReactNode;primary?:boolean;disabled?:boolean;title?:string}){return <button type="button" title={title} disabled={disabled} className={primary?'btn primary':'btn'} onClick={onClick}>{children}</button>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}

export default function App(){
 const [screen,setScreen]=useState<Screen>('schedule');
 const [collapsed,setCollapsed]=useState(false);
 const [items,setItems]=useState<Item[]>(start);
 const [selected,setSelected]=useState<Item|null>(null);
 const [sideMode,setSideMode]=useState<'assistant'|'edit'>('assistant');
 const [moveMode,setMoveMode]=useState(false);
 const [preview,setPreview]=useState<MoveOption|null>(null);
 const [weekMoving,setWeekMoving]=useState<Item|null>(null);
 const [contextMenu,setContextMenu]=useState<{x:number;y:number;lesson:Item}|null>(null);
 const [lastChange,setLastChange]=useState<{before:Item[];changedIds:string[]}|null>(null);
 const [hoverMove,setHoverMove]=useState<MoveOption|null>(null);
 const [view,setView]=useState<View>('group');
 const [group,setGroup]=useState('П-21');
 const [teacher,setTeacher]=useState(TEACHERS[0]);
 const [room,setRoom]=useState('102');
 const [week,setWeek]=useState(0);
 const [density,setDensity]=useState<'compact'|'standard'>('compact');
 const [days,setDays]=useState(6);
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState<'draft'|'published'>('draft');
 const [notice,setNotice]=useState('');
 const [replacement,setReplacement]=useState('Петров М. С.');
 const [genPreference,setGenPreference]=useState(true);
 const [studentsGroup,setStudentsGroup]=useState('П-21');
 useEffect(()=>{try{
 const existing=new Set(items.map(x=>x.id));
 const updated=items.filter(x=>BASE_MAP.get(x.id)!==JSON.stringify(x));
 const removed=BASE.filter(x=>!existing.has(x.id)).map(x=>x.id);
 localStorage.setItem('college-schedule-edits-v3',JSON.stringify({updated,removed}));
}catch(e){console.warn('Не удалось сохранить демо-изменения:',e)}},[items]);
 useEffect(()=>{if(notice){const timer=setTimeout(()=>setNotice(''),3500);return ()=>clearTimeout(timer)}},[notice]);
 const current=useMemo(()=>items.filter(x=>(x.week||0)===week),[items,week]);
 const blockedRooms=readBlockedRooms();
 const blockedKey=blockedRooms.join('|');
 const targets=useMemo(()=>selected?moveOptions(selected,current,blockedRooms,days,6):[],[selected,current,blockedKey,days]);
 const targetByCell=useMemo(()=>new Map(targets.map(t=>[t.day+':'+t.slot,t])),[targets]);
 const availableTargetCount=targets.filter(t=>t.kind==='available').length;
 const bellTimes=(()=>{try{const v=JSON.parse(localStorage.getItem('college-schedule-extras-v1')||'{}');return Array.isArray(v.times)&&v.times.length===6?v.times as string[]:TIMES}catch{return TIMES}})();
 const resetSeed=()=>{if(window.confirm('Сбросить все изменения в расписании? Синтетическая база останется, черновики будут удалены.')){localStorage.removeItem('college-schedule-edits-v3');localStorage.removeItem('college-schedule-extras-v1');window.location.reload()}};
 const visible=current.filter(x=>view==='group'?x.groups.includes(group):view==='teacher'?x.teacher===teacher:x.room.includes(room));
 const collisions=selected?cellConflict(selected,current):[];
 const issueCount=current.filter(x=>cellConflict(x,current).length>0).length;
 const displayName=NAV.find(x=>x[0]===screen)?.[1]||'Расписание';
 const choose=(x:Item)=>{setContextMenu(null);setSelected(x);setSideMode('assistant');setMoveMode(false);setPreview(null);setHoverMove(null)};
 const make=(day=0,slot=1)=>{const created:Item={id:id(),day,slot,week,subject:'',teacher:view==='teacher'?teacher:'',groups:view==='group'?[group]:[],room:view==='room'?room:'',type:'regular',mode:'offline'};setSelected(created);setSideMode('edit');setMoveMode(false);setPreview(null)};

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
 const closeSelected=()=>{setSelected(null);setMoveMode(false);setPreview(null);setHoverMove(null);setContextMenu(null)};
 const rightClick=(event:MouseEvent<HTMLButtonElement>,lesson:Item)=>{
  event.preventDefault();event.stopPropagation();
  setContextMenu({x:Math.min(event.clientX,Math.max(15,window.innerWidth-240)),y:Math.min(event.clientY,Math.max(15,window.innerHeight-235)),lesson});
  setSelected(lesson);setSideMode('assistant');setMoveMode(false);setPreview(null);
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
  choose(source);
  const dest=moveOptions(source,current,readBlockedRooms(),days,6).find(t=>t.day===day&&t.slot===slot);
  if(!dest||dest.kind==='current')return;
  if(dest.kind==='blocked'){setNotice('Перенос невозможен: '+dest.reason);return}
  setPreview(dest);
 };
 useEffect(()=>{
   const handler=(e:KeyboardEvent)=>{
    if(e.key==='Escape'){setPreview(null);setMoveMode(false);setHoverMove(null);setContextMenu(null);setWeekMoving(null);return}
    const target=e.target as HTMLElement|null;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&lastChange&&!['INPUT','TEXTAREA','SELECT'].includes(target?.tagName||'')){e.preventDefault();undo()}
   };
   window.addEventListener('keydown',handler);return ()=>window.removeEventListener('keydown',handler);
 },[lastChange,items]);
 const exportCSV=(dataset=current)=>download('college-schedule.csv',['День;Пара;Группа;Дисциплина;Преподаватель;Аудитория;Организация;Формат',...dataset.map(x=>[DAYS[x.day],x.slot,names(x.groups),x.subject,x.teacher,x.room,TYPES[x.type],MODES[x.mode]].join(';'))].join('\n'));
 const show=(to:Screen)=>{setScreen(to);closeSelected()};
 const sideGroups=view==='group'?GROUPS.map(g=>g.id):view==='teacher'?TEACHERS:ROOMS.map(r=>r.id);
 const sideValue=view==='group'?group:view==='teacher'?teacher:room;
 const setSide=(s:string)=>{view==='group'?setGroup(s):view==='teacher'?setTeacher(s):setRoom(s);closeSelected()};
 const addRow=()=>make(0,1);
 const teachersTotal=[{name:TEACHERS[0],plan:144,assigned:132,done:98},{name:TEACHERS[1],plan:108,assigned:96,done:64},{name:TEACHERS[2],plan:108,assigned:88,done:56},{name:TEACHERS[3],plan:72,assigned:60,done:48}];
 const stats=(<div className="metrics"><div><strong>{current.length}</strong><span>Назначено занятий</span></div><div><strong>6</strong><span>Замены за неделю</span></div><div><strong>{issueCount}</strong><span>Требуют проверки</span></div><div><strong>12</strong><span>Не распределено</span></div></div>);
 const lessonLabel=(x:Item)=><><strong>{x.subject}</strong><small>{x.room} · {x.teacher}</small><span className="tiny">{TYPES[x.type]}{x.mode!=='offline'?' · '+MODES[x.mode]:''}</span></>;
 const weekDate=useMemo(()=>{const d=new Date(2026,10,9+week*7);const e=new Date(d);e.setDate(e.getDate()+5);return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+' – '+e.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'})},[week]);
 const weekHeader=<div className="toolbar">
   <div className="control-group"><button className={view==='group'?'active':''} onClick={()=>{setView('group');closeSelected()}}><Users size={15}/> Группы</button><button className={view==='teacher'?'active':''} onClick={()=>{setView('teacher');closeSelected()}}>Преподаватели</button><button className={view==='room'?'active':''} onClick={()=>{setView('room');closeSelected()}}>Аудитории</button></div>
   <div className="control-group"><button aria-label="Предыдущая неделя" onClick={()=>{setWeek(w=>Math.max(0,w-1));closeSelected()}}><ChevronLeft size={15}/></button><b>{weekDate}</b><button aria-label="Следующая неделя" onClick={()=>{setWeek(w=>Math.min(39,w+1));closeSelected()}}><ChevronRight size={15}/></button></div>
   <div className="control-group right"><button className={density==='compact'?'active':''} onClick={()=>setDensity('compact')}>Компактно</button><button className={density==='standard'?'active':''} onClick={()=>setDensity('standard')}>Подробнее</button></div>
   <Action onClick={()=>exportCSV()}><Download size={14}/> CSV</Action>
   {lastChange&&<Action onClick={undo} title="Ctrl+Z — отменить последнее изменение"><RotateCcw size={14}/> Отменить</Action>}
 </div>;
 const grid=<div className={'timetable-scroll '+(moveMode&&selected?'move-active':'')} data-testid="schedule-grid"><div className={'timetable '+density} style={{gridTemplateColumns:'74px repeat('+days+', minmax(140px,1fr))'}}>
 <div className="grid-head">Пара</div>{DAYS.slice(0,days).map((d,i)=><div key={i} className="grid-head">{d}<small>{lessonDate(week,i).slice(8)}.{lessonDate(week,i).slice(5,7)}</small></div>)}
 {bellTimes.map((tm,row)=><div className="grid-fragment" key={row}>
  <div className="slot"><b>{row+1}</b><small>{tm}</small></div>
  {DAYS.slice(0,days).map((d,day)=>{
   const target=targetByCell.get(day+':'+(row+1));
   const cellLessons=visible.filter(x=>x.day===day&&x.slot===row+1);
   return <div key={d} className={'slot-cell '+(moveMode&&selected&&target?'slot-'+target.kind:'')} title={moveMode&&target?target.reason:undefined}
    onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const key=e.dataTransfer.getData('lessonId');if(key)move(key,day,row+1)}}
    onMouseEnter={()=>{if(moveMode&&target)setHoverMove(target)}}
    onMouseLeave={()=>setHoverMove(null)}>
    {cellLessons.map(x=><button draggable={!preview} key={x.id}
      className={'lesson '+x.type+(selected?.id===x.id?' picked':'')}
      onDragStart={(e:DragEvent<HTMLButtonElement>)=>{e.dataTransfer.setData('lessonId',x.id);choose(x)}}
      onClick={()=>choose(x)} onContextMenu={e=>rightClick(e,x)} aria-label={'Открыть занятие: '+x.subject+', '+x.groups.join(' + ')}>{lessonLabel(x)}</button>)}
    {moveMode&&selected&&target&&cellLessons.length===0
     ? <button type="button" className={'target-overlay '+target.kind} data-testid={'target-'+day+'-'+(row+1)}
       onClick={()=>inspectTarget(day,row+1)} title={target.reason}
       aria-label={(target.kind==='available'?'Доступен перенос: ':target.kind==='blocked'?'Недоступен перенос: ':'Исходное занятие: ')+target.label+' — '+target.reason}>
        {target.kind==='available'?<><Check size={14}/> Перенести</>:target.kind==='blocked'?<><X size={13}/> Занято</>:<><CalendarDays size={13}/> Сейчас</>}
       </button>
     : <button className="empty-slot" aria-label={'Создать занятие: '+DAYS[day]+', пара '+(row+1)} title="Назначить занятие" onClick={()=>make(day,row+1)}><Plus size={15}/></button>}
   </div>
  })}
 </div>)}
 </div></div>;
 const legend=<div className="legend"><span><i className="swatch regular"/>Обычное</span><span><i className="swatch subgroup"/>Подгруппы</span><span><i className="swatch stream"/>Поток</span><span><i className="swatch parallel"/>Параллель</span><span><i className="swatch online"/>Онлайн/гибрид</span></div>;
 const schedule=<>
 {moveMode&&selected&&<div className="move-toolbar"><div><ArrowLeftRight size={16}/><b>Режим переноса</b><span>Выбрано: {selected.subject} · {selected.groups.join(' + ')}</span></div><div className="move-summary"><span className="marker available"/>{availableTargetCount} доступно <span className="marker blocked"/>{targets.filter(t=>t.kind==='blocked').length} недоступно</div><button onClick={()=>{setMoveMode(false);setPreview(null)}}>Закрыть режим <X size={13}/></button></div>}
 <div className="schedule-layout"><aside className="group-sidebar">
  <div className="sidebar-search"><Search size={14}/><input aria-label="Поиск групп, преподавателей, аудиторий" placeholder="Поиск..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
  <div className="side-caption">{view==='group'?'Группы':view==='teacher'?'Преподаватели':'Аудитории'}</div>
  <div className="side-scroll">{sideGroups.filter(s=>s.toLowerCase().includes(search.toLowerCase())).map(s=><button key={s} className={sideValue===s?'chosen':''} onClick={()=>setSide(s)}>{view==='group'?<Users size={13}/>:view==='room'?<Building2 size={13}/>:<BookOpen size={13}/>}<span>{s}</span></button>)}</div>
  <div className="side-bottom"><Action onClick={addRow}><Plus size={14}/> Занятие</Action></div>
 </aside>
 <section className="schedule-body">
  <div className="table-heading"><div><b>{sideValue}</b><small>{view==='group'?'Занятия группы':view==='teacher'?'Занятия преподавателя':'Занятость аудитории'}</small></div><Tag tone={status==='published'?'green':'muted'}>{status==='published'?'Опубликовано (демо)':'Черновик'}</Tag></div>
  {grid}{legend}
  <div className="bottom-line"><span>Потоки и параллели переносятся целиком с участниками</span><span className="push-right">{hoverMove&&moveMode?hoverMove.reason:'Нажми на занятие — увидишь доступные варианты'}</span></div>
 </section>
 {selected&&<div className="right-editor">
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
 {contextMenu&&<div role="menu" aria-label="Действия с занятием" className="lesson-context-menu" style={{left:contextMenu.x,top:contextMenu.y}} onClick={e=>e.stopPropagation()}>
    <div className="lesson-context-title">{contextMenu.lesson.subject}<small>{contextMenu.lesson.groups.join(' + ')} · {DAYS[contextMenu.lesson.day]}, {contextMenu.lesson.slot}-я</small></div>
    <button role="menuitem" onClick={()=>{setSelected(contextMenu.lesson);setSideMode('edit');setContextMenu(null)}}><Pencil size={14}/> Изменить занятие</button>
    <button role="menuitem" disabled={contextMenu.lesson.status==='held'} onClick={()=>{choose(contextMenu.lesson);setMoveMode(true)}}><ArrowLeftRight size={14}/> Перенести в этой неделе</button>
    <button role="menuitem" disabled={contextMenu.lesson.status==='held'} onClick={()=>{setWeekMoving(contextMenu.lesson);setContextMenu(null)}}><CalendarDays size={14}/> Перенести на другую неделю</button>
    <div className="lesson-context-separator"/>
    <button role="menuitem" className="danger" disabled={contextMenu.lesson.status==='held'} onClick={()=>{setContextMenu(null);askRemove(contextMenu.lesson.id)}}><Trash2 size={14}/> Удалить занятие</button>
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
  : <AdvancedWorkflows screen={screen} items={items} setItems={setItems} week={week} setWeek={setWeek} group={group} setGroup={setGroup} teacher={teacher} setTeacher={setTeacher} room={room} setRoom={setRoom} onNavigate={show} onEdit={setSelected} notify={setNotice} markDraft={()=>setStatus('draft')} status={status} setStatus={setStatus} density={density} setDensity={setDensity} days={days} setDays={setDays}/>;
 return <div className="app">
  <aside className={'nav '+(collapsed?'closed':'')}>
   <div className="brand"><div className="brand-symbol">C</div>{!collapsed&&<div><strong>College</strong><span>Schedule</span></div>}<button onClick={()=>setCollapsed(v=>!v)} className="nav-toggle"><Menu size={16}/></button></div>
   <nav>{NAV.map(([key,label],i)=>{const I=iconSet[i];return <button key={key} title={label} className={screen===key?'active':''} onClick={()=>show(key)}><I size={17}/>{!collapsed&&<span>{label}</span>}</button>})}</nav>
   <div className="nav-footer"><School size={17}/>{!collapsed&&<span>Демо · Диспетчер</span>}</div>
  </aside>
  <div className="main">
   <header className="main-head"><div className="page-title"><CalendarDays size={22}/><div><h1>{displayName}</h1><p>ИТ-отделение · II семестр 2026/2027</p></div></div><div className="head-actions"><Tag tone="muted">Колледж · Демостенд</Tag><button className="icon-btn" onClick={()=>setNotice('Все изменения сохраняются только в браузере')} title="Уведомления"><Bell size={17}/></button><Action onClick={()=>{setScreen('publication');setSelected(null)}} primary><Check size={15}/> Публикация</Action></div></header>
   <main className="workspace">{render()}</main>
   <footer className="app-foot"><span>College Schedule · тестовый стенд · {GROUPS.length} групп, {TEACHERS.length} преподавателя, {ROOMS.length} аудиторий · {items.length.toLocaleString('ru-RU')} занятий</span><button type="button" className="reset-button" onClick={resetSeed}>Сбросить демоданные</button></footer>
  </div>
  {notice&&<div role="status" className="toast"><AlertTriangle size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
 </div>;
}