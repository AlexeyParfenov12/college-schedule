import { DAYS, ROOMS, TEACHERS } from './data';
import type { Lesson } from './data';
import { QUALIFICATIONS, occupiedRooms, validate } from './demoLogic';
import { calendarIssues, currentDemoCalendar } from './plannerDomain';

export type Position = {day:number;slot:number};
export type MoveOption = Position & {kind:'current'|'available'|'blocked';reason:string;label:string};
export type TeacherSuggestion={name:string;available:boolean;qualified:boolean;reason:string;score:number};
export type RoomSuggestion={id:string;available:boolean;reason:string;capacity:number;pcs:number;score:number};
export const readBlockedRooms=():string[]=>{
 try{const raw=localStorage.getItem('college-schedule-extras-v1');if(!raw)return [];const settings=JSON.parse(raw);
 return Object.entries(settings.rooms||{}).filter(([,v])=>Boolean((v as {blocked?:boolean}).blocked)).map(([id])=>id)
 }catch{return []}
};
export const affectedParticipants=(lesson:Lesson)=>lesson.groups.join(' + ');
/** A complete lesson is moved as a single linked unit: all stream/parallel members follow it. */
export function explainCandidate(candidate:Lesson,all:Lesson[],blocked:string[]=[]):string[]{
 const messages:string[]=[];
 if(candidate.status==='held')messages.push('Занятие уже подтверждено как проведённое');
 for(const room of occupiedRooms(candidate)){
   if(blocked.includes(room))messages.push('Кабинет '+room+' временно закрыт');
 }
 for(const issue of validate(candidate,all))if(issue.hard)messages.push(issue.message);
 for(const issue of calendarIssues(candidate,currentDemoCalendar()))messages.push(issue);
 return [...new Set(messages)];
}
export function moveOptions(source:Lesson,all:Lesson[],blocked:string[]=[],days=6,slots=6):MoveOption[]{
 const result:MoveOption[]=[];
 for(let day=0;day<days;day++)for(let slot=1;slot<=slots;slot++){
   const label=DAYS[day]+' · '+slot+'-я пара';
   if(source.day===day&&source.slot===slot){result.push({day,slot,kind:'current',reason:'Текущее время',label});continue}
   const problems=explainCandidate({...source,day,slot},all,blocked);
   result.push({day,slot,kind:problems.length?'blocked':'available',reason:problems[0]||'Свободны преподаватель, все участники и аудитория',label});
 }
 return result;
}
export function teacherSuggestions(source:Lesson,all:Lesson[],blocked:string[]=[]):TeacherSuggestion[]{
 return TEACHERS.filter(t=>t!==source.teacher).map(name=>{
   const qualified=(QUALIFICATIONS[name]||[]).includes(source.subject);
   const conflicts=explainCandidate({...source,teacher:name},all,blocked);
   const available=conflicts.length===0;
   const reason=!available?conflicts[0]:!qualified?'Свободен, но дисциплина не подтверждена в тестовом справочнике квалификаций':'Подходит по дисциплине и свободен';
   return {name,available,qualified,reason,score:(available?100:0)+(qualified?40:0)};
 }).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'ru'));
}
export function roomSuggestions(source:Lesson,all:Lesson[],blocked:string[]=[]):RoomSuggestion[]{
 return ROOMS.filter(room=>!occupiedRooms(source).includes(room.id)).map(room=>{
   const issues=explainCandidate({...source,room:room.id,mode:source.mode==='online'||source.mode==='async'?'offline':source.mode},all,blocked);
   const available=issues.length===0;
   const specialised=/программ|сет|баз|информат|лаборатор/i.test(source.subject);
   const reason=issues[0]||(specialised&&room.pc===0?'Свободен, но нет компьютерных мест':'Подходит и свободен');
   const score=(available?100:0)+(specialised&&room.pc?25:0)+(room.capacity>=40?3:0);
   return {id:room.id,capacity:room.capacity,pcs:room.pc,available,reason,score};
 }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
export function countAvailable(options:MoveOption[]):number{return options.filter(x=>x.kind==='available').length}

export type SwapOption={lesson:Lesson;available:boolean;reason:string};
/** Validate the two changed lessons as one atomic proposal before offering a swap. */
export function swapOptions(source:Lesson,all:Lesson[],blocked:string[]=[]):SwapOption[]{
 return all.filter(other=>other.id!==source.id&&(other.week||0)===(source.week||0)&&
   !(other.day===source.day&&other.slot===source.slot)&&other.status!=='cancelled').map(other=>{
   if(source.status==='held'||other.status==='held')return {lesson:other,available:false,reason:'Проведённые занятия нельзя переставлять'};
   const rest=all.filter(x=>x.id!==source.id&&x.id!==other.id);
   const a={...source,day:other.day,slot:other.slot};
   const b={...other,day:source.day,slot:source.slot};
   const issuesA=explainCandidate(a,[...rest,b],blocked);
   const issuesB=explainCandidate(b,[...rest,a],blocked);
   const issues=[...issuesA,...issuesB];
   return {lesson:other,available:!issues.length,reason:issues[0]||'Оба занятия можно обменять без конфликта'};
 }).sort((a,b)=>Number(b.available)-Number(a.available)||
 Number(b.lesson.groups.some(g=>source.groups.includes(g)))-Number(a.lesson.groups.some(g=>source.groups.includes(g)))||
 a.lesson.day-b.lesson.day||a.lesson.slot-b.lesson.slot);
}
