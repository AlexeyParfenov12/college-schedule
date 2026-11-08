import { DAYS, GROUPS, ROOMS, TEACHERS, SUBJECTS, CALENDAR } from './data';
import type { Lesson, CalendarEvent } from './data';
import { phaseAt } from './calendarMatrixDomain';
import { occupiedRooms, validate } from './demoLogic';
import { assessRoomFit, needsComputers } from './roomPolicy';
import { classifyCalendarDay, readCollegeWorkweek } from './productionCalendar';
import type { Workweek } from './productionCalendar';
export { needsComputers } from './roomPolicy';

export type TeachingOffer = {key:string;group:string;teacher:string;subject:string;count:number;sampleRoom:string};
export function deriveOffers(lessons:Lesson[]):TeachingOffer[]{
 const map=new Map<string,TeachingOffer>();
 for(const l of lessons){
  if(l.status==='cancelled')continue;
  for(const g of l.groups){
   const key=[g,l.teacher,l.subject].join('|');
   const old=map.get(key);
   if(old){old.count++;if(/\b\d{3}\b/.test(l.room))old.sampleRoom=l.room}
   else map.set(key,{key,group:g,teacher:l.teacher,subject:l.subject,count:1,sampleRoom:l.room});
  }
 }
 return [...map.values()].sort((a,b)=>b.count-a.count||a.group.localeCompare(b.group,'ru')||a.subject.localeCompare(b.subject,'ru'));
}

export type RoomChoice={id:string;label:string;available:boolean;recommended:boolean;reason:string;seats:number;computers:number;score:number;fit:'ok'|'warning'|'blocked'};
/** Room suitability is context-dependent; the availability is checked for the exact proposed lesson time. */
export function chooseRooms(lesson:Lesson,lessons:Lesson[],blocked:string[]=[]):RoomChoice[]{
 const counts=lesson.groups.reduce((sum,id)=>sum+(GROUPS.find(g=>g.id===id)?.count||0),0);
 const split=lesson.type==='subgroup'?2:1;
 const needed=Math.ceil(counts/split);
 const computer=needsComputers(lesson.subject);
 const candidates=ROOMS.map(room=>{
  const shared=lessons.filter(x=>x.id!==lesson.id&&(x.week||0)===(lesson.week||0)&&x.day===lesson.day&&x.slot===lesson.slot&&x.status!=='cancelled');
  const occupied=shared.some(x=>occupiedRooms(x).includes(room.id));
  const closed=blocked.includes(room.id)||!room.active;
  const fit=assessRoomFit(lesson,room,needed);
  const available=!closed&&!occupied&&!fit.hard;
  const recommended=available&&fit.level==='ok';
  const reason=closed?'Аудитория закрыта':occupied?'Аудитория занята':fit.reason;
  const lastRoom=lesson.room.match(/\\b\\d{3}\\b/g)?.includes(room.id);
  const score=(recommended?200:available?65:0)+(computer&&room.pc>0?25:0)+(lastRoom?10:0)+(fit.level==='warning'?-30:0);
  return {id:room.id,label:'Ауд. '+room.id+' · '+room.kind+' · '+room.capacity+' мест'+(room.pc?' · '+room.pc+' ПК':''),
   available,recommended,reason,seats:room.capacity,computers:room.pc,score,fit:fit.level};

 });
 return candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
export function firstSuitableRoom(lesson:Lesson,lessons:Lesson[],blocked:string[]=[]):string{
 return chooseRooms(lesson,lessons,blocked).find(x=>x.available)?.id||'';
}
export function suitableSubgroupPair(lesson:Lesson,lessons:Lesson[],blocked:string[]=[]):[string,string]{
 const options=chooseRooms({...lesson,type:'subgroup'},lessons,blocked).filter(x=>x.available);
 return [options[0]?.id||'',options.find(x=>x.id!==options[0]?.id)?.id||''];
}

export const START_ISO='2026-11-09';
export const WEEK_COUNT=40;
export function lessonDate(week:number,day:number):string{
 const d=new Date(Date.UTC(2026,10,9+week*7+day));return d.toISOString().slice(0,10);
}
export function calendarIssues(lesson:Lesson,calendar:CalendarEvent[],workweek:Workweek=readCollegeWorkweek()):string[]{
 const date=lessonDate(lesson.week||0,lesson.day);
 const automatic=classifyCalendarDay(date,workweek);
 const results=automatic.nonWorking?['Производственный календарь: '+automatic.label+' ('+date+')']:[];
 const custom=calendar.filter(e=>e.from<=date&&date<=e.to&&(e.groups.length===0||lesson.groups.some(g=>e.groups.includes(g))))
  .filter(e=>e.kind==='holiday'||e.kind==='vacation'||(e.kind==='practice'&&!lesson.practiceBlockId))
  .map(e=>'Учебный календарь: '+e.title+' ('+date+')');
 const activity=calendar.length?lesson.groups.flatMap(group=>{
  const phase=phaseAt(calendar,group,date);
  if(phase==='unassigned')return ['График '+group+': учебный период не назначен ('+date+')'];
  if(['exam','state'].includes(phase)&&!/экзамен|зач[её]т|аттестац|консультац/i.test(lesson.subject))
   return ['График '+group+': в период аттестации нельзя назначить обычную пару'];
  if(['training','industrial','prediploma'].includes(phase)&&!lesson.practiceBlockId)
   return ['График '+group+': период практики требует соответствующего назначения'];
  return [];
 }):[];
 return [...new Set([...results,...custom,...activity])];
}
export function calendarWarnings(lesson:Lesson,calendar:CalendarEvent[]):string[]{
 const day=lessonDate(lesson.week||0,lesson.day);
 return calendar.filter(e=>e.from<=day&&day<=e.to&&(e.groups.length===0||lesson.groups.some(g=>e.groups.includes(g))))
  .filter(e=>e.kind==='exam').map(e=>'Экзаменационная сессия: '+e.title);
}
export function eventAffectedLessons(event:CalendarEvent,lessons:Lesson[]):Lesson[]{
 return lessons.filter(l=>{const date=lessonDate(l.week||0,l.day);return date>=event.from&&date<=event.to&&(event.groups.length===0||l.groups.some(g=>event.groups.includes(g)))});
}
export type WeekSummary={week:number;start:string;total:number;blocked:number;events:string[]};
export function calendarWeekSummaries(events:CalendarEvent[],lessons:Lesson[],group:string,start=0,end=WEEK_COUNT-1):WeekSummary[]{
 const result:WeekSummary[]=[];
 for(let week=start;week<=end;week++){
  const current=lessons.filter(x=>(x.week||0)===week&&x.groups.includes(group));
  const active=events.filter(x=>{const from=lessonDate(week,0),to=lessonDate(week,6);return x.from<=to&&x.to>=from&&(x.groups.length===0||x.groups.includes(group))});
  result.push({week,start:lessonDate(week,0),total:current.length,blocked:current.filter(x=>calendarIssues(x,events).length>0).length,events:active.map(x=>x.title)});
 }
 return result;
}

export type PlannedPlacement={id:string;source:Lesson;after:Lesson;reasons:string[]};
export type PreviewPlan={accepted:PlannedPlacement[];skipped:{source:Lesson;week:number;reason:string}[];targetWeeks:number[];removed:Lesson[];calendarWarnings:string[]};
type TemplateArgs={sourceWeek:number;targetStart:number;targetEnd:number;cycle:1|2|3|4;group:string;replace:boolean;calendar:CalendarEvent[];blockedRooms:string[]};
/** Pure preview. Never silently split a stream or parallel that has participants outside the selected group. */
export function previewTemplate(lessons:Lesson[],opts:TemplateArgs):PreviewPlan{
 const accepted:PlannedPlacement[]=[],skipped:PreviewPlan['skipped']=[],removed:Lesson[]=[],warnings:string[]=[];
 const targetWeeks:number[]=[];
 const base=lessons.filter(l=>l.week!==undefined&&l.week>=opts.sourceWeek&&l.week<opts.sourceWeek+opts.cycle
  &&l.groups.includes(opts.group));
 let working=[...lessons];
 for(let week=opts.targetStart;week<=Math.min(opts.targetEnd,WEEK_COUNT-1);week++){
  if(week<0||week>=WEEK_COUNT)continue;
  if(week>=opts.sourceWeek&&week<opts.sourceWeek+opts.cycle){skipped.push(...base.map(source=>({source,week,reason:'Исходный период шаблона'})));continue}
  targetWeeks.push(week);
  if(opts.replace){
   const replaced=working.filter(l=>(l.week||0)===week&&l.groups.includes(opts.group)&&l.groups.length===1&&l.status!=='held');
   removed.push(...replaced);
   working=working.filter(l=>!replaced.includes(l));
  }
  for(const source of base.filter(l=>(l.week||0)-opts.sourceWeek===(week-opts.targetStart)%opts.cycle)){
   if(source.groups.length>1){skipped.push({source,week,reason:'Общий поток или параллель: переноси с полным составом участников'});continue}
   if(source.status==='held'){skipped.push({source,week,reason:'Уже проведённое занятие нельзя копировать'});continue}
   const after:Lesson={...source,id:'template-'+week+'-'+source.id,week,status:'scheduled',replacementFor:undefined};
   const calendar=calendarIssues(after,opts.calendar);
   if(calendar.length){skipped.push({source,week,reason:calendar[0]});continue}
   const rooms=occupiedRooms(after).filter(room=>opts.blockedRooms.includes(room));
   const errors=validate(after,working).filter(x=>x.hard).map(x=>x.message);
   const reasons=[...rooms.map(x=>'Кабинет '+x+' закрыт'),...errors];
   if(reasons.length){skipped.push({source,week,reason:reasons[0]});continue}
   const warning=calendarWarnings(after,opts.calendar);
   warnings.push(...warning);
   accepted.push({id:after.id,source,after,reasons:warning});working.push(after);
  }
 }
 return {accepted,skipped,removed,targetWeeks,calendarWarnings:[...new Set(warnings)]};
}

export function previewAutofill(base:Lesson,lessons:Lesson[],calendar:CalendarEvent[],blocked:string[],count:number,
 options:{days:number[];slots:number[];requirePc:boolean}):{placed:Lesson[];rejected:string[]}{
 const placed:Lesson[]=[],rejected:string[]=[];
 const current=[...lessons.filter(l=>(l.week||0)===(base.week||0))];
 for(let i=0;i<count;i++){
  const choices:{lesson:Lesson;score:number}[]=[];
  for(const day of options.days)for(const slot of options.slots){
   if(day<0||day>5||slot<1||slot>6)continue;
   const partial={...base,id:'gen-'+i+'-'+day+'-'+slot,day,slot};
   if(calendarIssues(partial,calendar).length)continue;
   for(const room of chooseRooms(partial,current,blocked).filter(x=>x.recommended)){
    if(options.requirePc&&room.computers===0)continue;
    const lesson={...partial,room:room.id};
    if(validate(lesson,current).some(x=>x.hard))continue;
    const already=current.filter(x=>(x.week||0)===(base.week||0)&&x.day===day&&x.groups.some(g=>base.groups.includes(g))).length;
    const score=110-already*35-slot*4+room.score*.14+
      (current.some(l=>l.day===day&&l.teacher===base.teacher)?10:0);
    choices.push({lesson,score});
   }
  }
  choices.sort((a,b)=>b.score-a.score||a.lesson.day-b.lesson.day);
  const best=choices[0];
  if(!best){rejected.push('Занятие '+(i+1)+': не найден безопасный слот');break}
  const id='auto-'+(base.week||0)+'-'+i+'-'+best.lesson.day+'-'+best.lesson.slot+'-'+base.teacher;
  const next={...best.lesson,id};placed.push(next);current.push(next);
 }
 return {placed,rejected};
}
export function planningProgress(lessons:Lesson[],group:string,week:number):number[]{
 return DAYS.map((_,day)=>lessons.filter(l=>l.groups.includes(group)&&(l.week||0)===week&&l.day===day&&l.status!=='cancelled').length);
}

/** Read the synthetic calendar shared by the editor and planning tools, never production data. */
export function currentDemoCalendar():CalendarEvent[]{
 try{const raw=localStorage.getItem('college-schedule-extras-v1');if(raw){const value=JSON.parse(raw);if(Array.isArray(value.calendar))return value.calendar as CalendarEvent[]}}catch{}
 return CALENDAR;
}
