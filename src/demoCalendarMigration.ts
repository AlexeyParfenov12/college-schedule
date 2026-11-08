import type { CalendarEvent } from './data';

/**
 * Fix an error in the original 2026/27 demo year.
 * Never rewrite customized global dates, group periods or imported calendars.
 * Only when all four ORIGINAL demo baseline events still match, replace their
 * exact date boundaries. Existing browser storage remains untouched until the
 * dispatcher explicitly saves; the result is reapplied idempotently on load.
 */
const original:ReadonlyArray<Pick<CalendarEvent,'id'|'kind'|'title'|'from'|'to'|'groups'>>=[
 {id:'cal-1',title:'Учебные недели',kind:'study',from:'2026-09-01',to:'2026-12-28',groups:[]},
 {id:'cal-2',title:'Экзаменационная сессия',kind:'exam',from:'2027-01-11',to:'2027-01-25',groups:[]},
 {id:'cal-6',title:'Теоретическое обучение · весна',kind:'study',from:'2027-02-09',to:'2027-06-25',groups:[]},
 {id:'cal-4',title:'Зимний межсеместровый перерыв',kind:'vacation',from:'2027-01-26',to:'2027-02-08',groups:[]}
];
const revised:Record<string,{from:string;to:string}>={
 'cal-1':{from:'2026-09-01',to:'2026-12-20'},
 'cal-2':{from:'2026-12-21',to:'2026-12-30'},
 'cal-4':{from:'2027-01-01',to:'2027-01-24'},
 'cal-6':{from:'2027-01-25',to:'2027-06-25'}
};
export function migrateDemoWinterPeriod(events:CalendarEvent[]):CalendarEvent[]{
 if(!Array.isArray(events))return events;
 const untouched=original.every(ref=>{
  const matches=events.filter(e=>e.id===ref.id);
  return matches.length===1&&matches[0].title===ref.title
   &&matches[0].kind===ref.kind&&matches[0].from===ref.from&&matches[0].to===ref.to
   &&matches[0].groups.length===0&&!matches[0].periodCode;
 });
 // A customized session, vacation or semester must never be changed silently.
 if(!untouched)return events;
 return events.map(event=>revised[event.id]?{...event,...revised[event.id]}:event);
}
