import PolishedSelect from './PolishedSelect';
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { classifyCalendarDay, holidayMonth, CONFIRMED_TRANSFERS, LEGAL_SOURCE, readCollegeWorkweek } from './productionCalendar';
import type { Workweek } from './productionCalendar';

const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_NAMES=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const firstSelected=()=>({year:2026,month:11});
type Props={workweek?:Workweek};
export default function OfficialCalendar({workweek=readCollegeWorkweek()}:Props){
 const [chosen,setChosen]=useState(firstSelected),[selected,setSelected]=useState('2026-11-09');
 const month=useMemo(()=>holidayMonth(chosen.year,chosen.month,workweek),[chosen.year,chosen.month,workweek]);
 const chosenDay=selected.startsWith(String(chosen.year)+'-'+String(chosen.month).padStart(2,'0')+'-')
  ?classifyCalendarDay(selected,workweek):null;
 const shift=(offset:number)=>setChosen(v=>{
  const day=new Date(Date.UTC(v.year,v.month-1+offset,1));
  return {year:day.getUTCFullYear(),month:day.getUTCMonth()+1};
 });
 const selectYear=(year:number)=>Number.isInteger(year)&&year>=2000&&year<=2100&&setChosen(v=>({...v,year}));
 return <section className="federal-calendar" aria-label="Автоматический производственный календарь Российской Федерации">
  <div className="federal-calendar-top">
   <div><span className="federal-calendar-icon"><CalendarDays size={17}/></span>
    <div><h3>Государственные праздники и выходные — автоматически</h3>
     <p>Федеральный календарь РФ, {workweek===5?'пятидневная':'шестидневная'} учебная неделя. В расчёте участвуют и переносы нерабочих дней.</p></div>
   </div>
   <span className={month.confirmedTransfers?'federal-calendar-status approved':'federal-calendar-status pending'}>
    {month.confirmedTransfers?'Переносы утверждены':'Переносы требуют проверки'}
   </span>
  </div>
  <div className="federal-calendar-body">
   <div className="federal-calendar-main">
    <div className="federal-calendar-nav"><button aria-label="Предыдущий месяц" onClick={()=>shift(-1)}><ChevronLeft size={16}/></button>
     <PolishedSelect aria-label="Месяц производственного календаря" value={chosen.month} onChange={e=>setChosen(v=>({...v,month:Number(e.target.value)}))}>
      {MONTHS.map((name,i)=><option key={name} value={i+1}>{name}</option>)}</PolishedSelect>
     <input aria-label="Год производственного календаря" type="number" min={2000} max={2100} value={chosen.year}
      onChange={e=>selectYear(Number(e.target.value))}/>
     <button aria-label="Следующий месяц" onClick={()=>shift(1)}><ChevronRight size={16}/></button>
     <span className="federal-calendar-count">{month.off} нерабочих · {month.days.length-month.off} учебных дней</span>
    </div>
    <div className="federal-calendar-grid">{DAY_NAMES.map(day=><span className="federal-calendar-weekday" key={day}>{day}</span>)}
     {Array.from({length:month.firstMondayOffset},(_,i)=><span className="federal-calendar-empty" key={'empty-'+i}/>)}
     {month.days.map(day=><button type="button" key={day.date} title={day.date+' · '+day.label}
       aria-label={day.date+' '+day.label} aria-pressed={selected===day.date}
       onClick={()=>setSelected(day.date)} className={'federal-day '+(day.nonWorking?'off ':'working ')+day.kind+(selected===day.date?' chosen':'')}>
       <span>{Number(day.date.slice(8))}</span>
       {(day.kind==='holiday'||day.kind==='transfer')&&<span className="federal-day-dot"/>}
     </button>)}
    </div>
    <div className="federal-calendar-legend"><span><i className="working"/>Учебный день</span><span><i className="weekend"/>Выходной</span>
     <span><i className="holiday"/>Праздник</span><span><i className="transfer"/>Перенос</span><span><i className="working-weekend"/>Рабочая суббота</span></div>
   </div>
   <div className="federal-calendar-explain">
    <h4>Почему день доступен или закрыт?</h4>
    {chosenDay?<div className="federal-calendar-picked"><b>{chosenDay.date}</b><span>{chosenDay.label}</span>
     <strong>{chosenDay.nonWorking?'Занятия автоматически не назначаются':'Занятия можно планировать'}</strong></div>
    :<p>Нажми на дату слева, чтобы посмотреть правило.</p>}
    <div className="federal-calendar-source"><Info size={14}/>
     <span>{CONFIRMED_TRANSFERS[chosen.year]?.source||'Федеральные праздники известны, но ежегодное постановление о переносах для этого года не включено. План предварительный.'}</span>
    </div>
    <a href={CONFIRMED_TRANSFERS[chosen.year]?chosen.year===2026?
     'https://static.government.ru/media/files/4jeB8hNKm69ggOa9yDiYOli6YoAyM21i.pdf':
     'https://www.consultant.ru/document/cons_doc_LAW_544706/':LEGAL_SOURCE}
     target="_blank" rel="noopener noreferrer">Правовое основание и переносы</a>
    <p className="federal-calendar-footnote">Региональные праздники, каникулы, сессии и практики задаются отдельными периодами ниже. Нерабочие дни не создаются вручную каждый год.</p>
   </div>
  </div>
 </section>;
}
