import { useRef } from 'react';
import type { TouchEvent } from 'react';
import { CalendarDays, Check, CircleAlert, Plus, ArrowLeftRight, X } from 'lucide-react';
import { DAYS, TYPES } from './data';
import type { Lesson } from './data';
import type { MoveOption } from './scheduleAssist';
import { lessonDate } from './plannerDomain';
import { withinAcademicYear } from './weekTimeline';
import { classifyCalendarDay } from './productionCalendar';
import { useProductionCalendarState } from './productionCalendarSync';

/** Touch-first agenda for small screens; the desktop timetable remains unchanged. */
export type MobileScheduleProps={
 week:number;days:5|6;times:string[];lessons:Lesson[];day:number;selectedId?:string;
 moveMode:boolean;targets:MoveOption[];
 onDayChange:(day:number)=>void;onOpen:(lesson:Lesson)=>void;onAdd:(day:number,slot:number)=>void;
 onTarget:(day:number,slot:number)=>void;onCancelMove:()=>void;
};
export default function MobileSchedule({
 week,days,times,lessons,day,selectedId,moveMode,targets,onDayChange,onOpen,onAdd,onTarget,onCancelMove
}:MobileScheduleProps){
 useProductionCalendarState();
 const touchOrigin=useRef<{x:number;y:number}|null>(null);
 const chosenDay=Math.min(Math.max(day,0),days-1);
 const onTouchStart=(event:TouchEvent<HTMLElement>)=>{
  if(event.touches.length!==1){touchOrigin.current=null;return}
  touchOrigin.current={x:event.touches[0].clientX,y:event.touches[0].clientY};
 };
 const onTouchEnd=(event:TouchEvent<HTMLElement>)=>{
  const origin=touchOrigin.current;touchOrigin.current=null;
  if(!origin||event.changedTouches.length!==1)return;
  const dx=event.changedTouches[0].clientX-origin.x,dy=event.changedTouches[0].clientY-origin.y;
  // Respect vertical scrolling; navigate only on a deliberate horizontal gesture.
  if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.6)return;
  const next=chosenDay+(dx<0?1:-1);
  if(next>=0&&next<days)onDayChange(next);
 };
 const date=lessonDate(week,chosenDay);
 const official=classifyCalendarDay(date,days);
 const unavailable=!withinAcademicYear(date)||official.nonWorking;
 const current=lessons.filter(l=>l.day===chosenDay&&l.status!=='cancelled');
 const slots=times.map((time,index)=>({slot:index+1,time,lessons:current.filter(l=>l.slot===index+1),
  target:targets.find(t=>t.day===chosenDay&&t.slot===index+1)}));
 return <section className="mobile-agenda" aria-label="Расписание на телефоне" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
  <div className="mobile-day-strip" role="group" aria-label="Выбор дня недели">
   {DAYS.slice(0,days).map((name,i)=>{
    const iso=lessonDate(week,i);
    const isOff=!withinAcademicYear(iso)||classifyCalendarDay(iso,days).nonWorking;
    const count=lessons.filter(l=>l.day===i&&l.status!=='cancelled').length;
    return <button type="button" key={i} className={'mobile-day'+(i===chosenDay?' active':'')+(isOff?' is-off':'')}
      aria-pressed={i===chosenDay} onClick={()=>onDayChange(i)}>
      <b>{name}</b><span>{iso.slice(8)}</span><small>{isOff?'—':count}</small>
    </button>;
   })}
  </div>
  <div className="mobile-agenda-heading">
   <div><strong>{DAYS[chosenDay]} · {date.slice(8)}.{date.slice(5,7)}</strong><small>{unavailable?withinAcademicYear(date)?official.label:'За пределами учебного года':current.length+' занятий · нажмите на пару для действий'}</small></div>
   {moveMode&&<button type="button" className="mobile-move-close" onClick={onCancelMove}><X size={14}/> Отмена</button>}
  </div>
  {moveMode&&<div role="status" className="mobile-move-help"><ArrowLeftRight size={15}/> Зелёная пара доступна для переноса, красная — занята или запрещена. Выберите новое время.</div>}
  <div className="mobile-agenda-slots">
  {slots.map(({slot,time,lessons:here,target})=><div key={slot} className={'mobile-slot'+(here.some(l=>l.id===selectedId)?' picked':'')+(unavailable?' closed':'')}>
   <div className="mobile-slot-time"><b>{slot}</b><small>{time}</small></div>
   <div className="mobile-slot-body">
    {here.length?here.map(l=><button type="button" key={l.id} data-mobile-lesson-id={l.id}
      className={'mobile-lesson '+l.type+(l.id===selectedId?' chosen':'')} onClick={()=>onOpen(l)}>
       <span className="mobile-lesson-top"><strong>{l.subject}</strong><span>{l.mode==='offline'?TYPES[l.type]:l.mode==='online'?'Онлайн':l.mode==='hybrid'?'Гибрид': 'Асинхронно'}</span></span>
       <small>{l.groups.join(' + ')} · {l.teacher}</small>
       <small>{l.room||'Без аудитории'}</small>
      </button>):null}
    {moveMode&&target&&<button type="button"
       className={'mobile-move-target '+target.kind} disabled={target.kind==='current'}
       aria-label={(target.kind==='blocked'?'Перенос запрещён: ':target.kind==='available'?'Перенести на ':'Исходная пара: ')+DAYS[chosenDay]+' '+slot+' · '+target.reason}
       onClick={()=>onTarget(chosenDay,slot)}>
       {target.kind==='available'?<Check size={14}/>:target.kind==='blocked'?<CircleAlert size={14}/>:<CalendarDays size={14}/>}
       <span>{target.kind==='available'?'Сюда можно':target.kind==='blocked'?'Недоступно':'Исходная пара'}</span>
       {target.kind==='blocked'&&<small>{target.reason}</small>}
      </button>}
    {!here.length&&!moveMode&&(unavailable?
      <span className="mobile-closed-note">{withinAcademicYear(date)?'Нерабочий день':'Вне учебного года'}</span>:
      <button type="button" className="mobile-add-lesson" onClick={()=>onAdd(chosenDay,slot)}
       aria-label={'Добавить занятие: '+DAYS[chosenDay]+', '+slot+'-я пара'}><Plus size={15}/> Добавить занятие</button>
    )}
   </div>
  </div>)}
  </div>
  <p className="mobile-agenda-footer">Листайте вправо или влево, чтобы менять дни. Потоки и параллели перемещаются вместе со всеми участниками. Для переноса нажмите на занятие и выберите «Перенести».</p>
 </section>;
}
