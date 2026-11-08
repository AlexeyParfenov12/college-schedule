import type { CalendarEvent, Lesson } from './data';
import { classifyCalendarDay, readCollegeWorkweek } from './productionCalendar';
import { lessonDate } from './plannerDomain';

export type CalendarPhase =
 'study'|'training'|'industrial'|'prediploma'|'exam'|'state'|'vacation'|'other'|'unassigned';
export type Week = {index:number;from:string;to:string;start:string;end:string;month:number;year:number};
export type PhaseInfo = {id:CalendarPhase;name:string;short:string;kind:CalendarEvent['kind'];color:string};

export const CALENDAR_PHASES:PhaseInfo[]=[
 {id:'study',name:'Теоретическое обучение',short:'Т',kind:'study',color:'theory'},
 {id:'training',name:'Учебная практика',short:'УП',kind:'practice',color:'training'},
 {id:'industrial',name:'Производственная практика',short:'ПП',kind:'practice',color:'industrial'},
 {id:'prediploma',name:'Преддипломная практика',short:'ПДП',kind:'practice',color:'prediploma'},
 {id:'exam',name:'Промежуточная аттестация / сессия',short:'ПА',kind:'exam',color:'exam'},
 {id:'state',name:'Государственная итоговая аттестация',short:'ГИА',kind:'exam',color:'state'},
 {id:'vacation',name:'Каникулы',short:'К',kind:'vacation',color:'vacation'},
 {id:'other',name:'Иной учебный период',short:'ИН',kind:'study',color:'other'},
 {id:'unassigned',name:'Не заполнено',short:'—',kind:'study',color:'unassigned'}
];

export const phaseInfo=(id:CalendarPhase)=>CALENDAR_PHASES.find(p=>p.id===id)||CALENDAR_PHASES[8];
const dateUTC=(value:string)=>new Date(value+'T00:00:00.000Z');
const iso=(date:Date)=>date.toISOString().slice(0,10);
export const plusDays=(value:string,days:number)=>{
 const d=dateUTC(value);d.setUTCDate(d.getUTCDate()+days);return iso(d);
};

/** One column per calendar week touching September 1 - August 31; endpoints remain exact. */
export function calendarWeeks(year:number):Week[]{
 const start=String(year)+'-09-01',end=String(year+1)+'-08-31';
 const first=dateUTC(start);
 const offset=(first.getUTCDay()+6)%7;
 first.setUTCDate(first.getUTCDate()-offset);
 const weeks:Week[]=[];
 for(let index=0;index<54;index++){
  const from=iso(first),to=plusDays(from,6);
  if(from>end)break;
  weeks.push({index,from,to,start:from<start?start:from,end:to>end?end:to,
   month:dateUTC(from<start?start:from).getUTCMonth(),year:dateUTC(from<start?start:from).getUTCFullYear()});
  first.setUTCDate(first.getUTCDate()+7);
 }
 return weeks;
}

export function phaseForEvent(event:CalendarEvent):CalendarPhase{
 if(event.periodCode&&CALENDAR_PHASES.some(p=>p.id===event.periodCode))return event.periodCode;
 if(event.kind==='vacation')return 'vacation';
 if(event.kind==='exam')return /государствен|гии|гиа/i.test(event.title)?'state':'exam';
 if(event.kind==='practice'){
  if(/преддиплом/i.test(event.title))return 'prediploma';
  if(/производствен/i.test(event.title))return 'industrial';
  return 'training';
 }
 return event.kind==='study'?'study':'other';
}

export function periodAt(events:CalendarEvent[],group:string,date:string):CalendarEvent|undefined{
 const applicable=events.filter(e=>e.kind!=='holiday'&&e.from<=date&&date<=e.to&&
  (e.groups.length===0||e.groups.includes(group)));
 // Group-specific instructions override college-wide defaults; latest edit wins within each scope.
 const scoped=applicable.filter(e=>e.groups.includes(group));
 return (scoped.length?scoped:applicable).at(-1);
}
export const phaseAt=(events:CalendarEvent[],group:string,date:string):CalendarPhase=>{
 const event=periodAt(events,group,date);
 return event?phaseForEvent(event):'unassigned';
};
export type WeekCell={phase:CalendarPhase;mixed:boolean;holidays:number;parts:CalendarPhase[];unassignedDays:number};
/** Never paint an unassigned week as theoretical training. */
export function weekCell(events:CalendarEvent[],group:string,week:Week):WeekCell{
 const phases:CalendarPhase[]=[],seen=new Set<CalendarPhase>();
 let holidays=0,unassignedDays=0;
 for(let date=week.start;date<=week.end;date=plusDays(date,1)){
  if(classifyCalendarDay(date,readCollegeWorkweek()).nonWorking){
   holidays++;continue;
  }
  if(events.some(e=>e.kind==='holiday'&&e.from<=date&&e.to>=date&&
   (e.groups.length===0||e.groups.includes(group)))){holidays++;continue}
  const phase=phaseAt(events,group,date);
  if(phase==='unassigned')unassignedDays++;
  if(!seen.has(phase)){seen.add(phase);phases.push(phase)}
 }
 return {phase:phases.length===1?phases[0]:phases.length===0?'unassigned':phases[0],
  mixed:phases.length>1,holidays,parts:phases,unassignedDays};
}
const relevant=(e:CalendarEvent,groups:string[],from:string,to:string)=>
 e.from<=to&&e.to>=from&&e.groups.some(g=>groups.includes(g));
export function affectedLessons(lessons:Lesson[],groups:string[],from:string,to:string):Lesson[]{
 return lessons.filter(l=>{
  const date=lessonDate(l.week||0,l.day);
  return date>=from&&date<=to&&l.groups.some(g=>groups.includes(g));
 });
}
let sequence=0;
/** Atomic rewrite of group-specific calendar segments; global defaults are never destroyed. */
export function assignPeriod(events:CalendarEvent[],groups:string[],from:string,to:string,phase:CalendarPhase,title?:string):CalendarEvent[]{
 if(!groups.length||from>to)throw new Error('Некорректный диапазон или список групп');
 const selected=new Set(groups),out:CalendarEvent[]=[];
 const nextId=()=> 'matrix-'+Date.now().toString(36)+'-'+(++sequence);
 for(const e of events){
  if(e.kind==='holiday'||!relevant(e,groups,from,to)){out.push(e);continue}
  const stay=e.groups.filter(g=>!selected.has(g));
  if(stay.length)out.push({...e,groups:stay});
  for(const g of e.groups.filter(g=>selected.has(g))){
   if(e.from<from)out.push({...e,id:nextId(),groups:[g],to:plusDays(from,-1)});
   if(e.to>to)out.push({...e,id:nextId(),groups:[g],from:plusDays(to,1)});
  }
 }
 const info=phaseInfo(phase);
 out.push({id:nextId(),title:title?.trim()||info.name,kind:info.kind,periodCode:phase,from,to,groups:[...selected]});
 return out;
}
export type CalendarFinding={level:'error'|'warning';group:string;week:number;message:string};
export function checkCalendar(events:CalendarEvent[],groups:string[],weeks:Week[]):CalendarFinding[]{
 const findings:CalendarFinding[]=[];
 for(const group of groups)for(const week of weeks){
  const status=weekCell(events,group,week);
  if(status.unassignedDays)findings.push({level:'error',group,week:week.index,
   message:'Не заполнено учебных дней: '+status.unassignedDays});
  if(status.mixed)findings.push({level:'warning',group,week:week.index,
   message:'Смешанная неделя: '+status.parts.map(p=>phaseInfo(p).short).join(' / ')});
 }
 return findings;
}
export function matrixCSV(events:CalendarEvent[],groups:string[],weeks:Week[]):string{
 const quote=(v:string)=>'"'+v.replace(/"/g,'""')+'"';
 const first=['Группа',...weeks.map(w=>'Неделя '+(w.index+1)+' ('+w.start+'—'+w.end+')')];
 return '\uFEFF'+[first,...groups.map(g=>[g,...weeks.map(w=>{
  const s=weekCell(events,g,w);return s.mixed?s.parts.map(p=>phaseInfo(p).short).join('/'):phaseInfo(s.phase).short;
 })])].map(row=>row.map(quote).join(';')).join('\r\n');
}
