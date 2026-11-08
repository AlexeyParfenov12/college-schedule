import type { CalendarEvent, Lesson } from './data';
import { classifyCalendarDay, readCollegeWorkweek } from './productionCalendar';
import { calendarIssues, lessonDate } from './plannerDomain';

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
export function weekCell(events:CalendarEvent[],group:string,week:Week,closedDays?:ReadonlyMap<string,boolean>):WeekCell{
 const phases:CalendarPhase[]=[],seen=new Set<CalendarPhase>();
 let holidays=0,unassignedDays=0;
 const workweek=readCollegeWorkweek();
 for(let date=week.start;date<=week.end;date=plusDays(date,1)){
  if((closedDays?.get(date)??classifyCalendarDay(date,workweek).nonWorking)){
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
export type CalendarChangeImpact={
 affected:Lesson[];
 newlyBlocked:Lesson[];
 alreadyBlocked:Lesson[];
 held:Lesson[];
};
/** Calculate actual newly incompatible lessons after a change; never delete or move them silently. */
export function calendarChangeImpact(before:CalendarEvent[],after:CalendarEvent[],lessons:Lesson[],
 groups:string[],from:string,to:string):CalendarChangeImpact{
 const affected=affectedLessons(lessons,groups,from,to);
 const newlyBlocked:Lesson[]=[],alreadyBlocked:Lesson[]=[],held:Lesson[]=[];
 for(const lesson of affected){
  const issuesBefore=calendarIssues(lesson,before);
  const issuesAfter=calendarIssues(lesson,after);
  if(issuesAfter.length){
   if(issuesBefore.length)alreadyBlocked.push(lesson);
   else newlyBlocked.push(lesson);
  }
  if(lesson.status==='held')held.push(lesson);
 }
 return {affected,newlyBlocked,alreadyBlocked,held};
}
export function checkCalendar(events:CalendarEvent[],groups:string[],weeks:Week[],closedDays?:ReadonlyMap<string,boolean>):CalendarFinding[]{
 const findings:CalendarFinding[]=[];
 for(const group of groups)for(const week of weeks){
  const status=weekCell(events,group,week,closedDays);
  if(status.unassignedDays)findings.push({level:'error',group,week:week.index,
   message:'Не заполнено учебных дней: '+status.unassignedDays});
  if(status.mixed)findings.push({level:'warning',group,week:week.index,
   message:'Смешанная неделя: '+status.parts.map(p=>phaseInfo(p).short).join(' / ')});
  // Explicit group-specific events must not contradict each other; inherited college
  // defaults can legitimately overlap with a group override.
  const conflicts=new Set<string>();
  for(let date=week.start;date<=week.end;date=plusDays(date,1)){
   const explicit=events.filter(e=>e.kind!=='holiday'&&e.groups.includes(group)&&e.from<=date&&date<=e.to);
   if(explicit.length>1){
    const phases=new Set(explicit.map(phaseForEvent));
    if(phases.size>1)conflicts.add('Конфликт периодов '+[...phases].map(p=>phaseInfo(p).short).join(' / '));
    else conflicts.add('Дублирующиеся индивидуальные периоды');
   }
  }
  for(const message of conflicts)findings.push({level:'error',group,week:week.index,message});
 }
 return findings;
}
export function matrixCSV(events:CalendarEvent[],groups:string[],weeks:Week[]):string{
 const quote=(v:string)=>'"'+v.replace(/"/g,'""')+'"';
 const first=['Группа',...weeks.map(w=>'Неделя '+(w.index+1)+' ('+w.start+'—'+w.end+')')];
 return '\uFEFF'+[first,...groups.map(g=>[g,...weeks.map(w=>{
  // Export exact dates even when a holiday masks a transition on the weekly view.
  const days=Array.from({length:7},(_,i)=>{
   const date=plusDays(w.from,i);
   return date<w.start||date>w.end?'~':phaseInfo(phaseAt(events,g,date)).short;
  });
  const present=days.filter(x=>x!=='~');
  return present.every(x=>x===present[0])?present[0]:days.join('|');
 })])].map(row=>row.map(quote).join(';')).join('\r\n');
}

/** CSV produced by matrixCSV: strict year/header/group checks, no guessed mixed-day allocation. */
function parseSemicolonCSV(source:string):string[][]{
 const rows:string[][]=[],line:string[]=[];
 let item='',inside=false;
 const s=source.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(c==='"'){
   if(inside&&s[i+1]==='"'){item+='"';i++}else inside=!inside;
  }else if(c===';'&&!inside){line.push(item);item=''}
  else if((c==='\r'||c==='\n')&&!inside){
   if(c==='\r'&&s[i+1]==='\n')i++;
   line.push(item);item='';
   if(line.some(x=>x.trim()))rows.push([...line]);
   line.length=0;
  }else item+=c;
 }
 if(inside)throw new Error('Незакрытая кавычка в файле CSV');
 line.push(item);
 if(line.some(x=>x.trim()))rows.push(line);
 return rows;
}
export type MatrixImport={next:CalendarEvent[];groups:number;ranges:number;cells:number};
export function importMatrixCSV(source:string,events:CalendarEvent[],year:number,allowedGroups:string[]):MatrixImport{
 const weeks=calendarWeeks(year);
 const lines=parseSemicolonCSV(source);
 if(!lines.length)throw new Error('Файл CSV пуст');
 const expected=['Группа',...weeks.map(w=>'Неделя '+(w.index+1)+' ('+w.start+'—'+w.end+')')];
 if(lines[0].length!==expected.length||lines[0].some((value,i)=>value!==expected[i])){
  throw new Error('Заголовок недель или учебный год не соответствует выбранному графику. Нужен CSV, экспортированный из этого раздела.');
 }
 const byCode=new Map(CALENDAR_PHASES.map(x=>[x.short,x.id]));
 const groups=new Set<string>(),edits:{group:string;phase:CalendarPhase;start:string;end:string}[]=[];
 for(const row of lines.slice(1)){
  const group=row[0]?.trim();
  if(!allowedGroups.includes(group))throw new Error('Неизвестная группа в файле: '+group);
  if(groups.has(group))throw new Error('Повторяется группа: '+group);
  if(row.length!==expected.length)throw new Error('Неверное число недель у группы '+group);
  groups.add(group);
  let current:typeof edits[number]|undefined;
  for(let i=0;i<weeks.length;i++){
   const value=row[i+1].trim();
   const codes=value.includes('|')?value.split('|'):null;
   if(codes&&codes.length!==7)throw new Error('Неверный формат смешанной недели '+(i+1)+' у '+group);
   const parts:{from:string;to:string;code:string}[]=codes?codes.map((code,j)=>{
    const date=plusDays(weeks[i].from,j);
    return {from:date,to:date,code};
   }).filter(x=>x.from>=weeks[i].start&&x.from<=weeks[i].end):
   [{from:weeks[i].start,to:weeks[i].end,code:value}];
   for(const part of parts){
    const phase=byCode.get(part.code);
    if(!phase)throw new Error('Неизвестный код «'+part.code+'» у '+group+', неделя '+(i+1));
    if(current&&current.phase===phase&&plusDays(current.end,1)===part.from)current.end=part.to;
    else {current={group,phase,start:part.from,end:part.to};edits.push(current)}
   }
  }
 }
 if(!groups.size)throw new Error('В CSV нет ни одной группы');
 let next=events;
 for(const edit of edits)next=assignPeriod(next,[edit.group],edit.start,edit.end,edit.phase);
 return {next,groups:groups.size,ranges:edits.length,cells:groups.size*weeks.length};
}
/** Copies exact daily activity, not a rough week label; optionally preserve target's existing periods. */
export function copyGroupCalendar(events:CalendarEvent[],source:string,target:string,year:number,overwrite:boolean):CalendarEvent[]{
 if(source===target)throw new Error('Выбери другую группу');
 const from=String(year)+'-09-01',to=String(year+1)+'-08-31';
 const edits:{phase:CalendarPhase;start:string;end:string}[]=[];
 let current:typeof edits[number]|undefined;
 for(let date=from;date<=to;date=plusDays(date,1)){
  const phase=phaseAt(events,source,date);
  const targetPhase=phaseAt(events,target,date);
  // An inherited college-wide period is not a group-specific customization.
  // Preserve explicit target overrides, not merely the shared defaults.
  const explicitTarget=events.some(e=>e.kind!=='holiday'&&e.groups.includes(target)&&e.from<=date&&date<=e.to);
  if(phase===targetPhase||(!overwrite&&explicitTarget)){current=undefined;continue}
  if(current&&current.phase===phase&&plusDays(current.end,1)===date)current.end=date;
  else{current={phase,start:date,end:date};edits.push(current)}
 }
 let next=events;
 for(const item of edits)next=assignPeriod(next,[target],item.start,item.end,item.phase);
 return next;
}

/** Validate a locally exported whole-calendar backup before offering any destructive restore. */
export function parseCalendarBackup(source:string,expectedYear:number,allowedGroups:string[]):CalendarEvent[]{
 let parsed:unknown;
 try{parsed=JSON.parse(source)}catch{throw new Error('Файл не является корректным JSON')}
 if(!parsed||typeof parsed!=='object')throw new Error('Неверная структура резервной копии');
 const document=parsed as Record<string,unknown>;
 if(document.academicYear!==expectedYear)throw new Error('Резервная копия другого учебного года. Выбери учебный год из имени файла перед восстановлением.');
 if(!Array.isArray(document.periods)||document.periods.length>10000)
  throw new Error('В резервной копии отсутствует допустимый массив учебных периодов');
 const codes=new Set(CALENDAR_PHASES.map(p=>p.id)),kinds=new Set(['study','exam','vacation','practice','holiday']);
 const groupIds=new Set(allowedGroups),seen=new Set<string>();
 const validDate=(value:unknown):value is string=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T00:00:00.000Z');
  return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;
 };
 return document.periods.map((value:unknown,index:number)=>{
  if(!value||typeof value!=='object')throw new Error('Неверный период №'+(index+1));
  const e=value as Record<string,unknown>;
  if(typeof e.id!=='string'||!e.id||e.id.length>120||seen.has(e.id))
   throw new Error('Некорректный или повторяющийся идентификатор периода №'+(index+1));
  seen.add(e.id);
  if(typeof e.title!=='string'||!e.title.trim()||e.title.length>500)
   throw new Error('Отсутствует название периода №'+(index+1));
  if(!kinds.has(String(e.kind)))throw new Error('Неизвестный тип периода №'+(index+1));
  if(!validDate(e.from)||!validDate(e.to)||e.from>e.to)
   throw new Error('Некорректные даты периода №'+(index+1));
  if(!Array.isArray(e.groups)||!e.groups.every((id:unknown)=>typeof id==='string'&&groupIds.has(id)))
   throw new Error('Неизвестная группа в периоде №'+(index+1));
  if(new Set(e.groups).size!==e.groups.length)throw new Error('Повтор группы в периоде №'+(index+1));
  if(e.periodCode!==undefined&&(!codes.has(String(e.periodCode))||
     phaseInfo(e.periodCode as CalendarPhase).kind!==e.kind))
   throw new Error('Некорректный код учебного периода №'+(index+1));
  return {id:e.id,title:e.title,kind:e.kind,from:e.from,to:e.to,
   groups:[...e.groups],...(e.periodCode===undefined?{}:{periodCode:e.periodCode})} as CalendarEvent;
 });
}
