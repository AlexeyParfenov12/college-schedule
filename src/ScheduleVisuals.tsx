import { useMemo } from 'react';
import { AlertTriangle, CalendarDays, Check, Clock3, Layers3 } from 'lucide-react';
import { DAYS, GROUPS } from './data';
import type { Lesson, CalendarEvent } from './data';
import { occupiedRooms } from './demoLogic';
import { calendarWeekSummaries, lessonDate } from './plannerDomain';

type MiniProps={lessons:Lesson[];week:number;group?:string;teacher?:string;room?:string;highlightIds?:string[];onSelect?:(lesson:Lesson)=>void;maxSlot?:number;title?:string};
export function MiniSchedule({lessons,week,group,teacher,room,highlightIds=[],onSelect,maxSlot=5,title}:MiniProps){
 const relevant=useMemo(()=>lessons.filter(l=>(l.week||0)===week&&l.status!=='cancelled'&&
   (!group||l.groups.includes(group))&&(!teacher||l.teacher===teacher)&&(!room||occupiedRooms(l).includes(room))),
 [lessons,week,group,teacher,room]);
 const highlight=new Set(highlightIds);
 const occupied=relevant.reduce((count,l)=>count+1,0);
 return <div className="viz-week" data-testid="mini-schedule">
  <div className="viz-week-head"><strong>{title||'Неделя '+(week+1)}</strong><span>{occupied} занятий</span></div>
  <div className="viz-week-grid"><span className="viz-corner">Пара</span>{DAYS.map((d,i)=><span className="viz-week-day" key={d}>{d}<small>{lessonDate(week,i).slice(8)}</small></span>)}
  {Array.from({length:maxSlot},(_,i)=>i+1).flatMap(slot=>[
   <span className="viz-slot" key={'n'+slot}>{slot}</span>,
   ...DAYS.map((d,day)=>{
    const found=relevant.filter(x=>x.day===day&&x.slot===slot);
    const change=found.some(x=>highlight.has(x.id));
    const special=found.some(x=>x.type!=='regular');
    return <div className={'viz-cell '+(found.length?'occupied ':'')+(change?'candidate ':'')+(special?'special':'')} key={d+'-'+slot}
      title={found.length?found.map(x=>x.subject+' · '+x.groups.join(', ')).join('\n'):'Свободно'}>
      {found.slice(0,2).map(l=><button type="button" key={l.id} onClick={()=>onSelect?.(l)} disabled={!onSelect} className="viz-event" title={l.subject+' — '+l.room}><span>{l.subject}</span>{found.length>1&&<small>{l.groups[0]}</small>}</button>)}
      {found.length>2&&<small className="viz-more">+{found.length-2}</small>}
    </div>;
   })
  ])}</div>
  <div className="viz-legend"><span><i className="busy"/>Занято</span><span><i className="proposal"/>Планируемое изменение</span><span><i className="free"/>Свободно</span></div>
 </div>;
}

export function PeriodTimeline({calendar,lessons,group,onWeek,activeWeek=0}:{calendar:CalendarEvent[];lessons:Lesson[];group:string;onWeek?:(week:number)=>void;activeWeek?:number}){
 const summaries=calendarWeekSummaries(calendar,lessons,group);
 return <div className="viz-period" data-testid="academic-timeline">
  <div className="viz-period-head"><div><strong>Карта учебных недель</strong><small>{group} · {summaries.length} недель демопланировщика · учёба, практики, сессии, каникулы</small></div><CalendarDays size={19}/></div>
  <div className="viz-period-grid">{summaries.map(s=>{
   const event=calendar.find(e=>e.from<=lessonDate(s.week,6)&&e.to>=s.start&&(e.groups.length===0||e.groups.includes(group))&&e.kind!=='study');
   const kind=event?.kind||'study';
   return <button type="button" key={s.week} onClick={()=>onWeek?.(s.week)} disabled={!onWeek}
    className={'viz-period-week '+kind+(activeWeek===s.week?' active':'')} title={s.events.length?s.events.join('; '):'Обычная учебная неделя'}>
    <b>{s.week+1}</b><span>{s.start.slice(5)}</span><small>{event?({exam:'Сессия',vacation:'Каникулы',practice:'Практика',holiday:'Выходной',study:'Учёба'} as const)[kind]:'Учёба'}</small>
    {s.blocked>0&&<em title="Занятия требуют перепланирования">{s.blocked} !</em>}
   </button>;
  })}</div>
  <div className="viz-legend"><span><i className="busy"/>Учёба</span><span><i className="exam"/>Сессия</span><span><i className="practice"/>Практика</span><span><i className="vacation"/>Каникулы</span><span><i className="alert"/>Требуют проверки</span></div>
 </div>;
}

export function LoadBars({lessons,week,group,teacher,room}:{lessons:Lesson[];week:number;group?:string;teacher?:string;room?:string}){
 const data=DAYS.map((d,day)=>({day:d,count:lessons.filter(l=>(l.week||0)===week&&l.day===day&&l.status!=='cancelled'&&(!group||l.groups.includes(group))&&(!teacher||l.teacher===teacher)&&(!room||occupiedRooms(l).includes(room))).length}));
 const max=Math.max(1,...data.map(x=>x.count));
 return <div className="viz-bars" data-testid="load-bars"><div className="viz-title"><Layers3 size={16}/><b>Распределение занятий по дням</b></div><div className="viz-bar-grid">
  {data.map(x=><div className="viz-bar-row" key={x.day}><span>{x.day}</span><div className="viz-bar-track"><div style={{width:(x.count/max)*100+'%'}}/></div><b>{x.count}</b></div>)}
  </div></div>;
}

export function PlanningSummary({total,added,skipped,blocked=0,description}:{total:number;added:number;skipped:number;blocked?:number;description?:string}){
 return <div className="viz-summary" data-testid="planning-summary">
   <div><Check size={15}/><b>{added}</b><span>Подходит</span></div>
   <div><AlertTriangle size={15}/><b>{skipped}</b><span>Пропущено</span></div>
   <div><Clock3 size={15}/><b>{total}</b><span>Рассмотрено</span></div>
   {blocked>0&&<div className="viz-summary-warning">В исходном календаре есть {blocked} занятия, требующих изменения</div>}
   {description&&<p>{description}</p>}
 </div>;
}
