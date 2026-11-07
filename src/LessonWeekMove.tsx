import PolishedSelect from './PolishedSelect';
import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, X, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { DAYS, TIMES, TYPES } from './data';
import type { Lesson } from './data';
import { explainCandidate } from './scheduleAssist';
import { lessonDate, WEEK_COUNT } from './plannerDomain';

type Props={lesson:Lesson;lessons:Lesson[];blockedRooms:string[];onCancel:()=>void;onMove:(next:Lesson)=>void};
type Cell={day:number;slot:number;errors:string[];current:boolean;date:string};
export default function LessonWeekMove({lesson,lessons,blockedRooms,onCancel,onMove}:Props){
 const originWeek=lesson.week||0;
 const [targetWeek,setTargetWeek]=useState(Math.min(originWeek+1,WEEK_COUNT-1));
 const [chosen,setChosen]=useState<{day:number;slot:number}|null>(null);
 const cells=useMemo(()=>Array.from({length:6*6},(_,i):Cell=>{
  const day=i%6,slot=Math.floor(i/6)+1;
  const proposed={...lesson,week:targetWeek,day,slot};
  const errors=explainCandidate(proposed,lessons,blockedRooms);
  const current=targetWeek===originWeek&&day===lesson.day&&slot===lesson.slot;
  return {day,slot,errors,current,date:lessonDate(targetWeek,day)};
 }),[lesson,lessons,targetWeek,blockedRooms.join('|')]);
 const selected=cells.find(c=>c.day===chosen?.day&&c.slot===chosen?.slot);
 const eligible=cells.filter(c=>!c.errors.length&&!c.current).length;
 const move=()=>{if(!selected||selected.errors.length||selected.current)return;onMove({...lesson,week:targetWeek,day:selected.day,slot:selected.slot})};
 return <div className="week-move-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
  <section className="week-move-modal" role="dialog" aria-modal="true" aria-label="Перенос занятия на другую неделю">
   <header><div><strong>Перенос занятия между неделями</strong><small>{lesson.subject} · {TYPES[lesson.type]} · {lesson.groups.join(' + ')}</small></div>
    <button aria-label="Закрыть перенос на другую неделю" onClick={onCancel}><X size={17}/></button></header>
   <div className="week-move-details"><span>Сейчас: <b>{originWeek+1}-я неделя, {DAYS[lesson.day]}, {lesson.slot}-я пара</b></span>
    <span>Преподаватель: {lesson.teacher} · {lesson.room}</span></div>
   <div className="week-move-nav"><button aria-label="Неделя назад" disabled={targetWeek===0} onClick={()=>{setTargetWeek(v=>v-1);setChosen(null)}}><ChevronLeft size={17}/></button>
    <label>Целевая неделя<PolishedSelect aria-label="Целевая неделя" value={targetWeek} onChange={e=>{setTargetWeek(Number(e.target.value));setChosen(null)}}>
    {Array.from({length:WEEK_COUNT},(_,w)=><option key={w} value={w}>{w+1}-я · с {lessonDate(w,0)}</option>)}</PolishedSelect></label>
    <button aria-label="Неделя вперёд" disabled={targetWeek===WEEK_COUNT-1} onClick={()=>{setTargetWeek(v=>v+1);setChosen(null)}}><ChevronRight size={17}/></button>
    <span className="week-move-free">{eligible} доступных ячеек</span></div>
   <p className="week-move-guide">Выбери день и пару на целевой неделе. Зелёные ячейки свободны для всей группы, преподавателя и аудиторий; красные показывают причину запрета.</p>
   <div className="week-move-grid">
    <div className="week-move-row-head">Пара</div>{DAYS.map((d,i)=><div className="week-move-row-head" key={d}>{d}<small>{lessonDate(targetWeek,i).slice(8)}</small></div>)}
    {TIMES.map((time,i)=><div className="week-move-fragment" key={time}>
      <div className="week-move-time"><b>{i+1}</b><small>{time}</small></div>
      {DAYS.map((d,day)=>{
       const x=cells.find(c=>c.day===day&&c.slot===i+1)!;
       const isSelected=selected===x;
       return <button key={d} className={'week-move-cell '+(x.current?'original':x.errors.length?'occupied':'free')+(isSelected?' chosen':'')}
       title={x.errors[0]||'Свободно'} aria-label={(x.errors.length?'Недоступно: ':'Доступно: ')+DAYS[day]+', '+(i+1)+' пара'+(x.errors.length?' — '+x.errors[0]:'')}
       onClick={()=>setChosen({day,slot:i+1})}>
        {x.current?'Сейчас':x.errors.length?<><AlertTriangle size={12}/> Занято</>:<><CheckCircle2 size={12}/> Можно</>}
       </button>
      })}
    </div>)}
   </div>
   <div className={'week-move-feedback '+(selected?.errors.length?'error':'')}>
    {selected?selected.current?'Это исходное время занятия.':selected.errors.length?selected.errors[0]:'Новое время: '+selected.date+', '+selected.slot+'-я пара. Проверка конфликтов пройдена.':'Нажми на доступную ячейку, чтобы выбрать новое время.'}
   </div>
   <footer><button className="btn" onClick={onCancel}>Отмена</button><button className="btn primary" disabled={!selected||selected.errors.length>0||selected.current||lesson.status==='held'} onClick={move}><ArrowLeftRight size={15}/> Перенести занятие</button></footer>
  </section>
 </div>;
}
