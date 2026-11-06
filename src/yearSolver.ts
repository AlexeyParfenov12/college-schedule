import { GROUPS, ROOMS, TEACHERS } from './data';
import type { Lesson, CalendarEvent } from './data';
import { deriveOffers, needsComputers, calendarIssues, lessonDate } from './plannerDomain';
import { assessRoomFit } from './roomPolicy';

export type TeacherPreference={
 daysOff:number[]; fromSlot:number; toSlot:number;
 forbidden:{day:number;from:number;to:number}[];
 preferDays:number[]; maxOnlinePct:number;
};
export type PracticeBlock={
 id:string;group:string;kind:'college'|'company';title:string;teacher:string;
 startWeek:number;durationWeeks:number;days:number[];fromSlot:number;toSlot:number;
 room:string;requiresComputers?:boolean;requiresIndividualComputer?:boolean;computerShare?:1|2|3;
};
export type PracticeAudit={blockId:string;group:string;week:number;reason:string};
export type AnnualConfig={
 weeks:number; days:5|6; slotsPerDay:number; commuteGap:1|2;
 defaultOnlinePct:number; groupGapWeight:number; teacherGapWeight:number;
 activeRooms:string[]; allowStreams:string[]; allowSubgroups:string[]; assistedSubgroups:string[];
 teacherPreferences:Record<string,TeacherPreference>;
 practiceBlocks:PracticeBlock[];
};
export type YearDemand={id:string;group:string;teacher:string;subject:string;pairsPerWeek:number;requiredPairs:number};
export type Unplaced={id:string;week:number;group:string;subject:string;teacher:string;reason:string};
export type AnnualVariant={id:string;name:string;lessons:Lesson[];unplaced:Unplaced[];
 totalPairs:number;placedPairs:number;coveredHours:number;requiredHours:number;
 groupWindows:number;teacherWindows:number;onlinePercent:number;score:number;streamCount:number;subgroupCount:number;
 practicePairs:number;practiceIssues:PracticeAudit[];practiceBlocks:PracticeBlock[]};
export const ANNUAL_WEEK_LIMIT=40;
export function defaultAnnualConfig():AnnualConfig{
 return {
  weeks:40,days:5,slotsPerDay:6,commuteGap:1,
  defaultOnlinePct:20,groupGapWeight:90,teacherGapWeight:65,
  activeRooms:ROOMS.filter(r=>r.active).map(r=>r.id),allowStreams:[],
  allowSubgroups:[],assistedSubgroups:[],teacherPreferences:{},practiceBlocks:[]
 };
}
export const teacherRule=(cfg:AnnualConfig,name:string):TeacherPreference=>cfg.teacherPreferences[name]||{
 daysOff:[],fromSlot:1,toSlot:6,forbidden:[],preferDays:[],maxOnlinePct:cfg.defaultOnlinePct
};
export const streamKey=(teacher:string,subject:string)=>teacher+'|'+subject;
/** Infers deliberately limited synthetic demand, NOT curricula from the Academic Core. */
export function deriveAnnualDemands(seed:Lesson[],weeks:number,maxSubjects=6):YearDemand[]{
 const offers=deriveOffers(seed.filter(x=>(x.week||0)<4));
 return GROUPS.flatMap(g=>offers.filter(x=>x.group===g.id)
  .sort((a,b)=>b.count-a.count||a.subject.localeCompare(b.subject,'ru'))
  .slice(0,maxSubjects)
  .map(o=>({id:o.key,group:g.id,teacher:o.teacher,subject:o.subject,
    pairsPerWeek:o.count>=3?2:1,requiredPairs:(o.count>=3?2:1)*weeks})));
}
const suited=(subject:string,room:typeof ROOMS[number],count:number,requiredPc=false,individual=false,computerShare:1|2|3=2)=>assessRoomFit(
 {id:'check',day:0,slot:1,groups:[],teacher:'',subject,room:room.id,type:'regular',mode:'offline',requiresComputers:requiredPc,requiresIndividualComputer:individual,computerShare},room,count
).level==='ok';
const location=(l:Lesson)=>l.mode==='online'?'home':l.room==='Предприятие'?'company':'college';
/** Hard condition for both teacher and every participating group: at most one home/campus switch per day,
 * with a configurable fully vacant travel interval. */
export function commuteViolations(lessons:Lesson[],commuteGap:number):string[]{
 const sorted=[...lessons].filter(x=>x.mode!=='async'&&x.status!=='cancelled').sort((a,b)=>a.slot-b.slot);
 const result:string[]=[];let switches=0;
 for(let i=1;i<sorted.length;i++){
  if(location(sorted[i])!==location(sorted[i-1])){
   switches++;
   const vacancy=sorted[i].slot-sorted[i-1].slot-1;
   if(vacancy<commuteGap)result.push('Нет '+commuteGap+' свободной пары на дорогу между домом и колледжем');
  }
 }
 if(switches>1)result.push('Нельзя чередовать колледж → дом → колледж в течение дня');
 return [...new Set(result)];
}
export function avoidableWindows(lessons:Lesson[],commuteGap:number){
 const ordered=[...lessons].filter(x=>x.status!=='cancelled').sort((a,b)=>a.slot-b.slot);
 let windows=0;
 for(let i=1;i<ordered.length;i++){
  const gap=Math.max(0,ordered[i].slot-ordered[i-1].slot-1);
  const needed=location(ordered[i])!==location(ordered[i-1])?commuteGap:0;
  windows+=Math.max(0,gap-needed);
 }
 return windows;
}
type WeekState={
 lessons:Lesson[];groupByDay:Map<string,Lesson[]>;teacherByDay:Map<string,Lesson[]>;
 groupBusy:Set<string>;teacherBusy:Set<string>;roomBusy:Set<string>;
};
const createWeek=():WeekState=>({lessons:[],groupByDay:new Map(),teacherByDay:new Map(),groupBusy:new Set(),teacherBusy:new Set(),roomBusy:new Set()});
export const practiceWeekActive=(p:PracticeBlock,w:number)=>w>=p.startWeek&&w<p.startWeek+p.durationWeeks;
const k=(value:string,day:number)=>value+'|'+day;
const busyKey=(value:string,day:number,slot:number)=>value+'|'+day+'|'+slot;
const get=(m:Map<string,Lesson[]>,key:string)=>m.get(key)||[];
function append(state:WeekState,l:Lesson){
 state.lessons.push(l);
 for(const g of l.groups){
  state.groupBusy.add(busyKey(g,l.day,l.slot));
  const key=k(g,l.day);mAppend(state.groupByDay,key,l);
 }
 state.teacherBusy.add(busyKey(l.teacher,l.day,l.slot));
 mAppend(state.teacherByDay,k(l.teacher,l.day),l);
 if(l.mode!=='online')for(const id of l.room.match(/\b\d{3}\b/g)||[])state.roomBusy.add(busyKey(id,l.day,l.slot));
}
function mAppend(m:Map<string,Lesson[]>,key:string,l:Lesson){const a=m.get(key);if(a)a.push(l);else m.set(key,[l])}
export const hasSlotConflict=(state:WeekState,l:Lesson):boolean=>
 l.groups.some(g=>state.groupBusy.has(busyKey(g,l.day,l.slot)))||
 state.teacherBusy.has(busyKey(l.teacher,l.day,l.slot))||
 (l.mode!=='online'&&(l.room.match(/\b\d{3}\b/g)||[]).some(room=>state.roomBusy.has(busyKey(room,l.day,l.slot))));
export function practiceReservations(cfg:AnnualConfig,events:CalendarEvent[],week:number,state:WeekState){
 const created:Lesson[]=[],issues:PracticeAudit[]=[];
 const active=(cfg.practiceBlocks||[]).filter(p=>practiceWeekActive(p,week));
 const activeGroups=new Set(active.map(p=>p.group));
 for(const block of active){
  const group=GROUPS.find(g=>g.id===block.group);
  if(!group){issues.push({blockId:block.id,group:block.group,week,reason:'Группа не найдена'});continue}
  const room=ROOMS.find(r=>r.id===block.room);
  if(block.kind==='college'){
   if(!room||!cfg.activeRooms.includes(block.room)||!room.active){
    issues.push({blockId:block.id,group:block.group,week,reason:'Закреплённый кабинет практики закрыт или не существует'});continue;
   }
   if(!suited(block.title,room,group.count,block.requiresComputers,block.requiresIndividualComputer,block.computerShare)){
    const fit=assessRoomFit({id:'practice-test',week,day:0,slot:1,groups:[block.group],teacher:block.teacher,subject:block.title,room:room.id,type:'regular',mode:'offline',requiresComputers:block.requiresComputers,requiresIndividualComputer:block.requiresIndividualComputer,computerShare:block.computerShare},room,group.count);
    issues.push({blockId:block.id,group:block.group,week,reason:fit.reason});continue;
   }
  }
  for(const day of block.days){
   if(day>=cfg.days)continue;
   for(let slot=block.fromSlot;slot<=Math.min(block.toSlot,cfg.slotsPerDay);slot++){
    const lesson:Lesson={id:'practice-'+block.id+'-'+week+'-'+day+'-'+slot,
     week,day,slot,groups:[block.group],subject:block.title||'Учебная практика',
     teacher:block.teacher||'Руководитель практики',room:block.kind==='college'?block.room:'Предприятие',
     mode:'offline',type:'regular',hours:2,practiceBlockId:block.id,requiresComputers:block.requiresComputers,requiresIndividualComputer:block.requiresIndividualComputer,computerShare:block.computerShare,notes:'Непрерывный блок практики · '+(block.kind==='college'?'Закреплённый кабинет':'Внешняя организация')};
    const conflicts=hasSlotConflict(state,lesson);
    const availability=teacherRule(cfg,block.teacher);
    const unavailable=availability.daysOff.includes(day)||slot<availability.fromSlot||slot>availability.toSlot||
      availability.forbidden.some(b=>b.day===day&&slot>=b.from&&slot<=b.to);
    // A matching practice period is not a prohibition; vacations and holidays are.
    const vacation=events.some(e=>['holiday','vacation'].includes(e.kind)&&
      e.from<=lessonDate(week,day)&&lessonDate(week,day)<=e.to&&(!e.groups.length||e.groups.includes(block.group)));
    if(vacation||conflicts||unavailable){
     issues.push({blockId:block.id,group:block.group,week,reason:vacation?'Практика пересекается с каникулами или выходным':unavailable?'Руководитель практики недоступен в заданный день или пару':'Группа, руководитель или кабинет заняты другой практикой/фиксированным занятием'});
     continue;
    }
    append(state,lesson);created.push(lesson);
   }
  }
 }
 return {created,issues,activeGroups};
}

type Task={demand:YearDemand;group:string;teacher:string;subject:string;week:number;members?:Task[]};
function hardReason(task:Task,state:WeekState,cfg:AnnualConfig,calendar:CalendarEvent[],roomCandidates:typeof ROOMS,teacherOnline:number,onlineQuota:number,variant:number){
 const rule=teacherRule(cfg,task.teacher);
 if(rule.daysOff.length>=cfg.days)return 'Преподаватель исключил все доступные дни';
 if(rule.fromSlot>rule.toSlot)return 'Недопустимый диапазон пар преподавателя';
 const group=GROUPS.find(g=>g.id===task.group);
 if(!group)return 'Группа отсутствует в Academic Core';
 if(needsComputers(task.subject)&&!roomCandidates.some(r=>suited(task.subject,r,group.count))
   &&(!cfg.allowSubgroups.includes(group.id)||!cfg.assistedSubgroups.includes(group.id)))return 'Не хватает компьютеров: нужны разрешение на подгруппы и сопровождающий';
 return 'Нет свободного слота с учётом пожеланий, кабинетов, окон и времени на дорогу';
}
function suitableRooms(task:Task,cfg:AnnualConfig,state:WeekState,day:number,slot:number){
 const group=GROUPS.find(g=>g.id===task.group)!;
 const groupCount=(task.members?.length?task.members.map(m=>m.group):[task.group]).reduce((n,id)=>n+(GROUPS.find(g=>g.id===id)?.count||0),0);
 const active=ROOMS.filter(r=>cfg.activeRooms.includes(r.id)&&r.active);
 const normal=active.filter(r=>suited(task.subject,r,groupCount)
  &&!state.roomBusy.has(busyKey(r.id,day,slot)));
 if(normal.length)return normal.slice().sort((a,b)=>a.capacity-b.capacity).slice(0,6)
  .map(r=>({room:r.id,type:'regular' as const}));
 if(!task.members&&needsComputers(task.subject)&&cfg.allowSubgroups.includes(task.group)&&cfg.assistedSubgroups.includes(task.group)){
  const half=Math.ceil(group.count/2);
  const labs=active.filter(r=>suited(task.subject,r,half)&&r.pc>0&&!state.roomBusy.has(busyKey(r.id,day,slot)));
  if(labs.length>=2)return [{room:labs[0].id+' / '+labs[1].id,type:'subgroup' as const}];
 }
 return [];
}
function candidateScore(state:WeekState,l:Lesson,cfg:AnnualConfig,variant:number){
 let beforeGroup=0,afterGroup=0;
 for(const g of l.groups){
  const d=get(state.groupByDay,k(g,l.day));
  beforeGroup+=avoidableWindows(d,cfg.commuteGap);
  afterGroup+=avoidableWindows([...d,l],cfg.commuteGap);
 }
 const teacherDay=get(state.teacherByDay,k(l.teacher,l.day));
 const beforeTeacher=avoidableWindows(teacherDay,cfg.commuteGap);
 const afterTeacher=avoidableWindows([...teacherDay,l],cfg.commuteGap);
 const groupDelta=afterGroup-beforeGroup,teacherDelta=afterTeacher-beforeTeacher;
 const groupWeight=variant===1?0.7:variant===2?1.2:1;
 const teacherWeight=variant===1?1.3:variant===2?.8:1;
 let score=110-groupDelta*cfg.groupGapWeight*.3*groupWeight-teacherDelta*cfg.teacherGapWeight*.3*teacherWeight;
 score+=(teacherDay.length?16:0)+(l.groups.some(g=>get(state.groupByDay,k(g,l.day)).length>0)?20:0);
 score-=l.slot*(variant===2?1.9:.7);
 if(l.mode==='online')score+=variant===3?25:-7;
 if(teacherRule(cfg,l.teacher).preferDays.includes(l.day))score+=9;
 if(l.type==='subgroup')score-=4;
 if(l.type==='stream')score+=13;
 score+=((l.day*11+l.slot*7+variant*13+l.teacher.length)%9)*.02;
 return score;
}
export function solveAnnualVariant(demands:YearDemand[],cfg:AnnualConfig,events:CalendarEvent[],variant:number,locked:Lesson[]=[]):AnnualVariant{
 const label=['Минимум окон у групп','Удобство преподавателей','Равномерный график','Больше дистанта'][variant]||'Вариант';
 const placed:Lesson[]=[],unplaced:Unplaced[]=[];
 const regularDemands=demands; // Practice is linked by academic demand ID, never guessed from a discipline title.
 const quota=new Map<string,number>(),usedOnline=new Map<string,number>();
 for(const d of regularDemands){const limit=quota.get(d.teacher)||0;quota.set(d.teacher,limit+d.requiredPairs)}
 for(const [teacher,total] of quota)quota.set(teacher,Math.floor(total*Math.max(0,Math.min(100,teacherRule(cfg,teacher).maxOnlinePct))/100));
 const covered=new Map<string,number>();
 const practiceIssues:PracticeAudit[]=[];
 let practicePairs=0;
 let streamCount=0,subgroupCount=0;
 for(let week=0;week<cfg.weeks;week++){
  const state=createWeek();
  for(const l of locked.filter(l=>(l.week||0)===week&&l.status==='held'))append(state,l);
  const reservations=practiceReservations(cfg,events,week,state);
  practicePairs+=reservations.created.length;
  practiceIssues.push(...reservations.issues);
  placed.push(...reservations.created);
  const tasks:Task[]=[];
  for(const d of regularDemands){
   if(reservations.activeGroups.has(d.group))continue;
   const done=covered.get(d.id)||0;
   const quotaNow=Math.ceil((week+1)*d.requiredPairs/cfg.weeks);
   const due=Math.max(0,Math.min(3,quotaNow-done));
   for(let j=0;j<due;j++)tasks.push({demand:d,group:d.group,teacher:d.teacher,subject:d.subject,week});
  }
  tasks.sort((a,b)=>Number(needsComputers(b.subject))-Number(needsComputers(a.subject))||
   teacherRule(cfg,a.teacher).daysOff.length-teacherRule(cfg,b.teacher).daysOff.length||
   (a.teacher+a.subject+a.group).localeCompare(b.teacher+b.subject+b.group,'ru'));
  const queue:Task[]=[];
  const absorbed=new Set<number>();
  for(let i=0;i<tasks.length;i++){
   if(absorbed.has(i))continue;
   const task=tasks[i];
   if(cfg.allowStreams.includes(streamKey(task.teacher,task.subject))){
    const partner=tasks.findIndex((other,j)=>j>i&&!absorbed.has(j)&&other.teacher===task.teacher&&
     other.subject===task.subject&&other.group!==task.group);
    if(partner>=0){
     const a=GROUPS.find(g=>g.id===task.group),b=GROUPS.find(g=>g.id===tasks[partner].group);
     const count=(a?.count||0)+(b?.count||0);
     if(ROOMS.some(room=>cfg.activeRooms.includes(room.id)&&room.active&&suited(task.subject,room,count))){
      absorbed.add(partner);queue.push({...task,members:[task,tasks[partner]]});continue;
     }
    }
   }
   queue.push(task);
  }
  for(let taskIndex=0;taskIndex<queue.length;taskIndex++){
   const task=queue[taskIndex];
   const taskGroups=task.members?.map(m=>m.group)||[task.group];
   const preference=teacherRule(cfg,task.teacher);
   const choices:{l:Lesson;score:number}[]=[];
   const onlineEligible=!needsComputers(task.subject)&&
    (usedOnline.get(task.teacher)||0)<(quota.get(task.teacher)||0);
   for(let day=0;day<cfg.days;day++){
    if(preference.daysOff.includes(day))continue;
    for(let slot=1;slot<=cfg.slotsPerDay;slot++){
     if(slot<preference.fromSlot||slot>preference.toSlot)continue;
     if(preference.forbidden.some(x=>x.day===day&&slot>=x.from&&slot<=x.to))continue;
     if(taskGroups.some(g=>state.groupBusy.has(busyKey(g,day,slot)))||state.teacherBusy.has(busyKey(task.teacher,day,slot)))continue;
     const roomChoices=suitableRooms(task,cfg,state,day,slot);
     const modes:{mode:'offline'|'online';room:string;type:'regular'|'subgroup'}[]=
       [...roomChoices.map(x=>({mode:'offline' as const,room:x.room,type:x.type})),
        ...(onlineEligible?[{mode:'online' as const,room:'Онлайн',type:'regular' as const}]:[])];
     for(const option of modes){
      const l:Lesson={id:'year-'+variant+'-'+week+'-'+task.demand.id+'-'+day+'-'+slot,
       week,day,slot,groups:taskGroups,teacher:task.teacher,subject:task.subject,
       room:option.room,mode:option.mode,type:task.members?'stream':option.type,hours:2,
       notes:option.type==='subgroup'?'Демонстрация: одобрено разделение, сопровождающий необходим':undefined};
      if(calendarIssues(l,events).length)continue;
      const dailyTeacher=get(state.teacherByDay,k(task.teacher,day));
      if(taskGroups.some(g=>commuteViolations([...get(state.groupByDay,k(g,day)),l],cfg.commuteGap).length)||
         commuteViolations([...dailyTeacher,l],cfg.commuteGap).length)continue;
      const score=candidateScore(state,l,cfg,variant);
      choices.push({l,score});
     }
    }
   }
   choices.sort((a,b)=>b.score-a.score);
   if(choices.length){
    const l=choices[0].l;append(state,l);placed.push(l);
    for(const member of task.members||[task])covered.set(member.demand.id,(covered.get(member.demand.id)||0)+1);
    if(l.type==='stream')streamCount++;
    if(l.mode==='online')usedOnline.set(l.teacher,(usedOnline.get(l.teacher)||0)+1);
    if(l.type==='subgroup')subgroupCount++;
   }else if(task.members){queue.push(...task.members)}
  }
  // Remaining due is carried over into later weeks.
 }
 for(const d of regularDemands){
  const missing=d.requiredPairs-(covered.get(d.id)||0);
  if(missing>0){
   const group=GROUPS.find(g=>g.id===d.group);
   const reason=needsComputers(d.subject)&&group&&!ROOMS.some(r=>cfg.activeRooms.includes(r.id)&&suited(d.subject,r,group.count))
     &&(!cfg.allowSubgroups.includes(d.group)||!cfg.assistedSubgroups.includes(d.group))
    ? 'Недостаточно компьютерных мест; разреши подгруппы и сопровождающего'
    : 'Недостаточно доступных дней, пар или совместимых аудиторий с учётом ограничений';
   unplaced.push({id:d.id,week:cfg.weeks-1,group:d.group,subject:d.subject,teacher:d.teacher,reason:reason+' · остаток '+missing+' пар'});
  }
 }
 // Calendar-defined practice must have an explicit room/company reservation.
 for(const event of events.filter(e=>e.kind==='practice')){
  for(const group of event.groups){
   const affectedWeeks=Array.from({length:cfg.weeks},(_,w)=>w).filter(w=>
    event.from<=lessonDate(w,6)&&event.to>=lessonDate(w,0));
   for(const w of affectedWeeks){
    const reserved=(cfg.practiceBlocks||[]).some(p=>p.group===group&&practiceWeekActive(p,w));
    if(!reserved)practiceIssues.push({blockId:'calendar-'+event.id,group,week:w,
     reason:'Практика «'+event.title+'» есть в учебном календаре, но для недели '+(w+1)+' не закреплены кабинет или предприятие и руководитель'});
   }
  }
 }
 let groupWindows=0,teacherWindows=0;
 const groupMap=new Map<string,Lesson[]>(),teacherMap=new Map<string,Lesson[]>();
 for(const l of placed){
  for(const g of l.groups)mAppend(groupMap,(l.week||0)+'|'+l.day+'|'+g,l);
  mAppend(teacherMap,(l.week||0)+'|'+l.day+'|'+l.teacher,l);
 }
 for(const entries of groupMap.values())groupWindows+=avoidableWindows(entries,cfg.commuteGap);
 for(const entries of teacherMap.values())teacherWindows+=avoidableWindows(entries,cfg.commuteGap);
 const totalPracticePairs=(cfg.practiceBlocks||[]).reduce((n,p)=>
  n+Math.max(0,Math.min(cfg.weeks,p.startWeek+p.durationWeeks)-p.startWeek)*
  p.days.filter(day=>day<cfg.days).length*
  Math.max(0,Math.min(p.toSlot,cfg.slotsPerDay)-p.fromSlot+1),0);
 const totalPairs=regularDemands.reduce((sum,d)=>sum+d.requiredPairs,0)+totalPracticePairs;
 const placedPairs=placed.reduce((sum,l)=>sum+l.groups.length,0);
 const online=placed.filter(l=>l.mode==='online').length;
 const score=Math.round((placedPairs/Math.max(1,totalPairs))*10000-groupWindows*cfg.groupGapWeight*.22-teacherWindows*cfg.teacherGapWeight*.12);
 return {id:'variant-'+variant,name:label,lessons:placed,unplaced,
  totalPairs,placedPairs,requiredHours:totalPairs*2,coveredHours:placedPairs*2,
  groupWindows,teacherWindows,onlinePercent:Math.round(online/Math.max(1,placed.length)*100),score,streamCount,subgroupCount,practicePairs,practiceIssues,practiceBlocks:cfg.practiceBlocks||[]};
}
