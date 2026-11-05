import { useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarClock, Check, ChevronDown, ChevronUp, DoorOpen, Pencil, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { DAYS, TYPES } from './data';
import type { Lesson } from './data';
import { moveOptions, roomSuggestions, teacherSuggestions, affectedParticipants, swapOptions } from './scheduleAssist';

type Props={
 lesson:Lesson; current:Lesson[]; blocked:string[]; isMoveMode:boolean;
 onMoveMode:()=>void; onPreviewMove:(day:number,slot:number)=>void; onSwap:(lesson:Lesson)=>void;
 onTeacher:(teacher:string)=>void; onRoom:(room:string)=>void;
 onEdit:()=>void; onClose:()=>void; onDelete:()=>void; onWeekMove:()=>void;
};
export default function LessonQuickActions({lesson,current,blocked,isMoveMode,onMoveMode,onPreviewMove,onSwap,onTeacher,onRoom,onEdit,onClose,onDelete,onWeekMove}:Props){
 const [expanded,setExpanded]=useState<'teacher'|'room'|null>(null);
 const [filter,setFilter]=useState('');
 const teachers=useMemo(()=>teacherSuggestions(lesson,current,blocked),[lesson,current,blocked]);
 const rooms=useMemo(()=>roomSuggestions(lesson,current,blocked),[lesson,current,blocked]);
 const slots=useMemo(()=>moveOptions(lesson,current,blocked).filter(x=>x.kind==='available').slice(0,4),[lesson,current,blocked]);
 const swaps=useMemo(()=>swapOptions(lesson,current,blocked).filter(x=>x.available).slice(0,4),[lesson,current,blocked]);
 const isLocked=lesson.status==='held';
 const showTeacher=(expanded==='teacher'?teachers:teachers.filter(x=>x.available&&x.qualified).slice(0,4))
     .filter(x=>x.name.toLowerCase().includes(filter.toLowerCase()));
 const showRooms=(expanded==='room'?rooms:rooms.filter(x=>x.available).slice(0,4))
     .filter(x=>x.id.toLowerCase().includes(filter.toLowerCase()));
 return <div className="assist-panel" data-testid="lesson-assistant">
  <div className="assist-header"><div><b>{lesson.subject}</b><small>{TYPES[lesson.type]} · {affectedParticipants(lesson)} · {lesson.room}</small></div><button className="icon-btn" title="Закрыть помощник" onClick={onClose}><X size={15}/></button></div>
  <div className="assist-tabs"><button className={isMoveMode?'on':''} onClick={onMoveMode} disabled={isLocked}><ArrowLeftRight size={14}/> {isMoveMode?'Выбор ячейки…':'Перенести'}</button><button onClick={onEdit}><Pencil size={14}/> Изменить</button></div>
  <div className="assist-quick-actions"><button onClick={onWeekMove} disabled={isLocked}><CalendarClock size={14}/> Другая неделя</button><button className="danger" onClick={onDelete} disabled={isLocked}><Trash2 size={14}/> Удалить пару</button></div>
  <div className="assist-scroll">
   {isLocked&&<div className="assist-note">Проведённое занятие заблокировано для изменения. Исправления должны проходить отдельную проверяемую процедуру.</div>}
   {isMoveMode&&<div className="assist-highlight"><ShieldCheck size={15}/> На сетке зелёные ячейки доступны, красные — заняты или запрещены. Нажми на ячейку для предварительного просмотра, затем подтверди перенос.</div>}
   <section className="assist-section">
    <div className="assist-title"><span><CalendarClock size={15}/> Свободное время</span><span className="assist-small">{slots.length} варианта</span></div>
    {slots.map(p=><button className="assist-option" key={p.day+'-'+p.slot} disabled={isLocked} title={p.reason} onClick={()=>onPreviewMove(p.day,p.slot)}><span>{p.label}</span><small>Свободно</small><Check size={13}/></button>)}
    {!slots.length&&<div className="assist-empty">Подходящих слотов пока нет</div>}
   </section>
   <section className="assist-section">
    <div className="assist-title"><span><ArrowLeftRight size={15}/> Обменять парами</span><span className="assist-small">{swaps.length} варианта</span></div>
    {swaps.map(x=><button className="assist-option" disabled={isLocked} title={x.reason} key={x.lesson.id} onClick={()=>onSwap(x.lesson)}><span>{DAYS[x.lesson.day]}, {x.lesson.slot}-я · {x.lesson.subject}</span><small>{x.lesson.groups.join(' + ')}</small><Check size={13}/></button>)}
    {!swaps.length&&<div className="assist-empty">Нет безопасных вариантов для обмена на этой неделе</div>}
   </section>
   <section className="assist-section">
    <div className="assist-title"><span><Users size={15}/> Кем заменить преподавателя</span><button onClick={()=>{setExpanded(expanded==='teacher'?null:'teacher');setFilter('')}}>{expanded==='teacher'?<ChevronUp size={14}/>:<ChevronDown size={14}/>} {expanded==='teacher'?'Свернуть':'Все варианты'}</button></div>
    {expanded==='teacher'&&<div className="assist-search"><Search size={14}/><input aria-label="Поиск преподавателя на замену" value={filter} placeholder="Поиск преподавателя" onChange={e=>setFilter(e.target.value)}/></div>}
    <div className={'assist-options '+(expanded==='teacher'?'scroll':'')}>
     {showTeacher.map(t=><button className="assist-option" key={t.name} disabled={isLocked||!t.qualified||!t.available} title={t.reason} onClick={()=>onTeacher(t.name)}><span>{t.name}</span><small className={t.available&&t.qualified?'ok':'bad'}>{t.available&&t.qualified?'Подходит':t.reason}</small><span className="assist-status">{t.available&&t.qualified?<Check size={13}/>:<X size={12}/>}</span></button>)}
     {!showTeacher.length&&<div className="assist-empty">Нет свободных преподавателей с подтверждённой дисциплиной. Открой все варианты, чтобы увидеть причины.</div>}
    </div>
   </section>
   {(lesson.type==='regular'||lesson.type==='stream')&&lesson.mode!=='online'&&lesson.mode!=='async'&&
   <section className="assist-section">
    <div className="assist-title"><span><DoorOpen size={15}/> Свободные аудитории</span><button onClick={()=>{setExpanded(expanded==='room'?null:'room');setFilter('')}}>{expanded==='room'?<ChevronUp size={14}/>:<ChevronDown size={14}/>} {expanded==='room'?'Свернуть':'Все варианты'}</button></div>
    {expanded==='room'&&<div className="assist-search"><Search size={14}/><input aria-label="Поиск аудитории для замены" value={filter} placeholder="Номер аудитории" onChange={e=>setFilter(e.target.value)}/></div>}
    <div className={'assist-options '+(expanded==='room'?'scroll':'')}>
      {showRooms.map(r=><button className="assist-option" key={r.id} disabled={isLocked||!r.available} title={r.reason} onClick={()=>onRoom(r.id)}><span>Ауд. {r.id} · {r.capacity} мест</span><small className={r.available?'ok':'bad'}>{r.pcs?'ПК: '+r.pcs+' · ':''}{r.reason}</small><span className="assist-status">{r.available?<Check size={13}/>:<X size={12}/>}</span></button>)}
      {!showRooms.length&&<div className="assist-empty">Подходящих аудиторий нет</div>}
    </div>
   </section>}
   {(lesson.type==='subgroup'||lesson.type==='parallel')&&<div className="assist-note">Для этого занятия аудитории назначаются отдельно по участникам. Измени размещение через «Все поля».</div>}
   <div className="assist-footnote">Подсказки учитывают занятия на выбранной неделе и базовые ограничения. Квалификация преподавателей — демонстрационная, требует подтверждения Academic Core.</div>
  </div>
 </div>;
}
