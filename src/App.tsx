import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode, DragEvent } from 'react';
import { CalendarDays, LayoutDashboard, ArrowLeftRight, Users, Building2, Settings2, FileText, Clock3, Plus, Search, Download, Check, AlertTriangle, ChevronLeft, ChevronRight, Menu, BookOpen, Monitor, Network, GitFork, WandSparkles, Save, X, Pencil, Trash2, Copy, Bell, Layers3, BarChart3, RotateCcw, Eye, SlidersHorizontal, Send, School, Filter } from 'lucide-react';
import { DAYS, TIMES, GROUPS, TEACHERS, SUBJECTS, ROOMS, TYPES, MODES, INITIAL, NAV, buildSeed } from './data';
import type { Lesson, Type, Mode } from './data';
import AdvancedWorkflows from './AdvancedWorkflows';
import { validate } from './demoLogic';

type Item = Lesson & {week?:number};
type View = 'group'|'teacher'|'room';
type Screen = typeof NAV[number][0];
const iconSet=[LayoutDashboard,CalendarDays,CalendarDays,Layers3,WandSparkles,ArrowLeftRight,Users,Network,GitFork,Building2,Monitor,BarChart3,Send,FileText,School,Settings2,BookOpen,BookOpen];
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

function Editor({item,save,remove,cancel,all,existing}: {item:Item;existing:boolean;save:(x:Item)=>void;remove:(id:string)=>void;cancel:()=>void;all:Item[]}) {
 const [form,setForm]=useState<Item>(item);
 useEffect(()=>setForm({...item,groups:[...item.groups]}),[item]);
 const patch=(p:Partial<Item>)=>setForm(s=>({...s,...p}));
 const isNew=!existing;
 const n=validate(form,all);
 const submit=(e:FormEvent)=>{e.preventDefault();save(form)};
 return <form className="editor" onSubmit={submit}>
  <div className="editor-head"><strong>{isNew?'Новое занятие':'Редактирование'}</strong><button type="button" className="icon-btn" onClick={cancel}><X size={16}/></button></div>
  <div className="editor-scroll">
   <Field label="Организация занятия"><Select value={form.type} onChange={v=>patch({type:v as Type})} options={Object.entries(TYPES).map(([value,label])=>({value,label}))}/></Field>
   <Field label="Дисциплина"><Select value={form.subject} onChange={v=>patch({subject:v})} options={SUBJECTS.map(v=>({value:v,label:v}))}/></Field>
   <div className="two"><Field label="День"><Select value={form.day} onChange={v=>patch({day:Number(v)})} options={DAYS.map((v,i)=>({value:i,label:v}))}/></Field><Field label="Пара"><Select value={form.slot} onChange={v=>patch({slot:Number(v)})} options={TIMES.map((v,i)=>({value:i+1,label:String(i+1)+' · '+v.slice(0,5)}))}/></Field></div>
   <Field label="Преподаватель"><Select value={form.teacher} onChange={v=>patch({teacher:v})} options={TEACHERS.map(v=>({value:v,label:v}))}/></Field>
   <Field label="Формат"><Select value={form.mode} onChange={v=>patch({mode:v as Mode})} options={Object.entries(MODES).map(([value,label])=>({value,label}))}/></Field>
   <Field label="Аудитория / размещение"><input value={form.room} onChange={e=>patch({room:e.target.value})} placeholder="405 / онлайн"/></Field>
   <div className="field"><span>Группы-участники</span><div className="choice-grid">{GROUPS.map(g=><label key={g.id} className="check-item"><input type="checkbox" checked={form.groups.includes(g.id)} onChange={e=>patch({groups:e.target.checked?[...form.groups,g.id]:form.groups.filter(v=>v!==g.id)})}/>{g.id}</label>)}</div></div>
   {form.type==='subgroup'&&<div className="hint"><Users size={15}/> Подгруппы: 1-я — 14 человек, ауд. 405; 2-я — 14 человек, ауд. 406. Состав студентов настраивается в разделе «Группы и подгруппы».</div>}
   {form.type==='stream'&&<div className="hint"><Network size={15}/> Общая встреча для выбранных групп. Проверяется вместимость общей аудитории.</div>}
   {form.type==='parallel'&&<div className="hint"><GitFork size={15}/> Связанные занятия одного преподавателя в разных местах. Укажи размещение и способ организации в примечании.</div>}
   <Field label="Примечание / особенности"><textarea rows={2} value={form.notes||''} onChange={e=>patch({notes:e.target.value})} placeholder="П-21 — аудитория 405; П-22 — онлайн"/></Field>
   {n.length>0&&<div className="warning"><AlertTriangle size={15}/> Проверка: {n.slice(0,2).map(x=>x.message).join('; ')}</div>}
  </div>
  <div className="editor-actions"><Action onClick={cancel}>Отмена</Action>{!isNew&&<Action onClick={()=>remove(form.id)}><Trash2 size={15}/></Action>}<button className="btn primary" type="submit" disabled={!form.groups.length}><Save size={15}/> Сохранить</button></div>
 </form>;
}

export default function App(){
 const [screen,setScreen]=useState<Screen>('schedule');
 const [collapsed,setCollapsed]=useState(false);
 const [items,setItems]=useState<Item[]>(start);
 const [selected,setSelected]=useState<Item|null>(null);
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
 const current=items.filter(x=>(x.week||0)===week);
 const bellTimes=(()=>{try{const v=JSON.parse(localStorage.getItem('college-schedule-extras-v1')||'{}');return Array.isArray(v.times)&&v.times.length===6?v.times as string[]:TIMES}catch{return TIMES}})();
 const resetSeed=()=>{if(window.confirm('Сбросить все изменения в расписании? Синтетическая база останется, черновики будут удалены.')){localStorage.removeItem('college-schedule-edits-v3');localStorage.removeItem('college-schedule-extras-v1');window.location.reload()}};
 const visible=current.filter(x=>view==='group'?x.groups.includes(group):view==='teacher'?x.teacher===teacher:x.room.includes(room));
 const collisions=selected?cellConflict(selected,current):[];
 const issueCount=current.filter(x=>cellConflict(x,current).length>0).length;
 const displayName=NAV.find(x=>x[0]===screen)?.[1]||'Расписание';
 const make=(day=0,slot=1)=>{const created:Item={id:id(),day,slot,week,subject:SUBJECTS[0],teacher:TEACHERS[0],groups:[group],room:'109',type:'regular',mode:'offline'};setSelected(created)};
 const save=(x:Item)=>{
 const blocked=(()=>{try{const v=JSON.parse(localStorage.getItem('college-schedule-extras-v1')||'{}');return Object.entries(v.rooms||{}).filter(([_,room])=>(room as {blocked:boolean}).blocked).map(([id])=>id)}catch{return [] as string[]}})();
 const chosenRooms=x.mode==='online'||x.mode==='async'?[]:x.room.match(/\b\d{3}\b/g)||[];
 if(chosenRooms.some(room=>blocked.includes(room))){setNotice('Выбранная аудитория временно закрыта');return}
 const errors=validate(x,items).filter(y=>y.hard); if(errors.length){setNotice('Не сохранено: '+errors[0].message);return} setItems(v=>[...v.filter(y=>y.id!==x.id),x]);setSelected(null);setStatus('draft');setNotice('Изменение сохранено локально')};
 const remove=(key:string)=>{setItems(v=>v.filter(x=>x.id!==key));setSelected(null);setStatus('draft');setNotice('Занятие удалено из черновика')};
 const move=(key:string,day:number,slot:number)=>{const l=items.find(x=>x.id===key);if(!l)return;const next={...l,day,slot};if(validate(next,items).some(y=>y.hard)){setNotice('Перенос отменён: найдено пересечение');return}save(next)};
 const exportCSV=(dataset=current)=>download('college-schedule.csv',['День;Пара;Группа;Дисциплина;Преподаватель;Аудитория;Организация;Формат',...dataset.map(x=>[DAYS[x.day],x.slot,names(x.groups),x.subject,x.teacher,x.room,TYPES[x.type],MODES[x.mode]].join(';'))].join('\n'));
 const show=(to:Screen)=>{setScreen(to);setSelected(null)};
 const sideGroups=view==='group'?GROUPS.map(g=>g.id):view==='teacher'?TEACHERS:ROOMS.map(r=>r.id);
 const sideValue=view==='group'?group:view==='teacher'?teacher:room;
 const setSide=(s:string)=>{view==='group'?setGroup(s):view==='teacher'?setTeacher(s):setRoom(s);setSelected(null)};
 const addRow=()=>make(0,1);
 const teachersTotal=[{name:TEACHERS[0],plan:144,assigned:132,done:98},{name:TEACHERS[1],plan:108,assigned:96,done:64},{name:TEACHERS[2],plan:108,assigned:88,done:56},{name:TEACHERS[3],plan:72,assigned:60,done:48}];
 const stats=(<div className="metrics"><div><strong>{current.length}</strong><span>Назначено занятий</span></div><div><strong>6</strong><span>Замены за неделю</span></div><div><strong>{issueCount}</strong><span>Требуют проверки</span></div><div><strong>12</strong><span>Не распределено</span></div></div>);
 const lessonLabel=(x:Item)=><><strong>{x.subject}</strong><small>{x.room} · {x.teacher}</small><span className="tiny">{TYPES[x.type]}{x.mode!=='offline'?' · '+MODES[x.mode]:''}</span></>;
 const weekHeader=<div className="toolbar"><div className="control-group"><button className={view==='group'?'active':''} onClick={()=>setView('group')}><Users size={15}/> Группы</button><button className={view==='teacher'?'active':''} onClick={()=>setView('teacher')}>Преподаватели</button><button className={view==='room'?'active':''} onClick={()=>setView('room')}>Аудитории</button></div><div className="control-group"><button onClick={()=>{setWeek(w=>Math.max(0,w-1));setSelected(null)}}><ChevronLeft size={15}/></button><b>{week===0?'9–14 ноября 2026':'Неделя '+(week>0?'+':'')+week}</b><button onClick={()=>{setWeek(w=>Math.min(15,w+1));setSelected(null)}}><ChevronRight size={15}/></button></div><div className="control-group right"><button className={density==='compact'?'active':''} onClick={()=>setDensity('compact')}>Плотно</button><button className={density==='standard'?'active':''} onClick={()=>setDensity('standard')}>Обычно</button></div><Action onClick={()=>exportCSV()}><Download size={15}/> CSV</Action></div>;
 const grid=<div className="timetable-scroll"><div className={'timetable '+density} style={{gridTemplateColumns:'74px repeat('+days+', minmax(140px,1fr))'}}><div className="grid-head">Пара</div>{DAYS.slice(0,days).map((d,i)=><div key={i} className="grid-head">{d}<small>{9+i}.11</small></div>)}{bellTimes.map((tm,row)=><div className="grid-fragment" key={row}><div className="slot"><b>{row+1}</b><small>{tm}</small></div>{DAYS.slice(0,days).map((d,day)=><div className="slot-cell" key={d} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const key=e.dataTransfer.getData('lessonId');if(key)move(key,day,row+1)}}>{visible.filter(x=>x.day===day&&x.slot===row+1).map(x=><button draggable key={x.id} className={'lesson '+x.type+(selected?.id===x.id?' picked':'')} onDragStart={(e:DragEvent<HTMLButtonElement>)=>e.dataTransfer.setData('lessonId',x.id)} onClick={()=>setSelected(x)}>{lessonLabel(x)}</button>)}<button className="empty-slot" title="Назначить занятие" onClick={()=>make(day,row+1)}><Plus size={15}/></button></div>)}</div>)}</div></div>;
 const legend=<div className="legend"><span><i className="swatch regular"/>Обычное</span><span><i className="swatch subgroup"/>Подгруппы</span><span><i className="swatch stream"/>Поток</span><span><i className="swatch parallel"/>Параллель</span><span><i className="swatch online"/>Онлайн/гибрид</span></div>;
 const schedule=<><div className="schedule-layout"><aside className="group-sidebar"><div className="sidebar-search"><Search size={14}/><input placeholder="Найти..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="side-caption">ИТ-отделение</div>{sideGroups.filter(s=>s.toLowerCase().includes(search.toLowerCase())).map(s=><button key={s} className={sideValue===s?'chosen':''} onClick={()=>setSide(s)}>{view==='group'?<Users size={14}/>:view==='room'?<Building2 size={14}/>:<BookOpen size={14}/>}<span>{s}</span></button>)}<div className="side-bottom"><Action onClick={addRow}><Plus size={14}/> Занятие</Action></div></aside><section className="schedule-body"><div className="table-heading"><div><b>{sideValue}</b><small>{view==='group'?'Рабочая сетка группы':view==='teacher'?'Нагрузка преподавателя':'Занятость аудитории'}</small></div><Tag tone={status==='published'?'green':'muted'}>{status==='published'?'Опубликовано (демо)':'Черновик'}</Tag></div>{grid}{legend}<div className="bottom-line"><span>Нераспределённая нагрузка: <b>56 ч</b></span><span className="push-right">Перетаскивай занятия между ячейками</span></div></section>{selected&&<div className="right-editor"><Editor key={selected.id} item={selected} save={save} remove={remove} cancel={()=>setSelected(null)} all={current} existing={items.some(x=>x.id===selected.id)}/></div>}</div></>;
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