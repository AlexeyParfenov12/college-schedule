/** Safe preview; never directly mutates the official schedule. */
import { ROOMS } from './data';
import type { Lesson, CalendarEvent, Absence, Mode } from './data';
import type { Workweek } from './productionCalendar';
import type { SubstitutionPolicy } from './substitutionPlanner';
import { checkOnlineEdge } from './substitutionPlanner';
import { newWindowsForChange } from './scheduleWindowRules';
import { validate } from './demoLogic';
import { calendarIssues } from './plannerDomain';

export type BulkFormatBlock={lesson:Lesson;reason:string};
export type BulkFormatPreview={accepted:Lesson[];blocked:BulkFormatBlock[];considered:number};
export type BulkFormatSelection={week:number;groups:string[];fromDay:number;toDay:number;mode:Mode};
export function previewBulkFormat(
 all:Lesson[],calendar:CalendarEvent[],absences:Absence[],policy:SubstitutionPolicy,days:Workweek,
 selection:BulkFormatSelection
):BulkFormatPreview{
 const eligible=all.filter(l=>(l.week||0)===selection.week&&l.day>=selection.fromDay&&l.day<=selection.toDay&&l.groups.some(g=>selection.groups.includes(g)));
 let next=[...all];
 const accepted:Lesson[]=[],blocked:BulkFormatBlock[]=[];
 for(const lesson of eligible){
  const reasons:string[]=[];
  if(lesson.status==='held')reasons.push('Проведённое занятие нельзя изменить');
  if(lesson.status==='cancelled')reasons.push('Отменённое занятие не редактируется');
  if(!lesson.groups.every(g=>selection.groups.includes(g)))reasons.push('Общий поток затрагивает группы вне выбранной области');
  if(lesson.mode===selection.mode)reasons.push('У занятия уже такой формат');
  if(lesson.day>=days)reasons.push('День вне учебной недели');
  if(absences.some(a=>a.status==='open'&&a.teacher===lesson.teacher&&lesson.day>=a.from&&lesson.day<=a.to))
   reasons.push('Преподаватель отсутствует: изменение формата не заменяет преподавателя');
  if(selection.mode==='hybrid'&&!(lesson.type==='parallel'&&lesson.participants?.length))
   reasons.push('Для гибрида необходимо заранее назначить очных/удалённых участников и контроль');
  if(selection.mode==='async')reasons.push('Асинхронное занятие требует задания, контроля выполнения и учёта часов в LMS');
  const room=selection.mode==='online'||selection.mode==='async'?'Онлайн':lesson.room;
  if(selection.mode==='offline'&&(!ROOMS.some(r=>r.id===room&&r.active)))
   reasons.push('Для очного занятия не назначена подходящая аудитория');
  if(selection.mode==='hybrid'&&lesson.mode!=='hybrid'&&lesson.mode!=='offline')
   reasons.push('Требуется отдельное назначение аудитории и участников гибрида');
  const candidate:Lesson={...lesson,mode:selection.mode,room,
   notes:[lesson.notes,'Смена формата на '+selection.mode].filter(Boolean).join('; ')};
  if(!reasons.length){
   reasons.push(...validate(candidate,next).filter(x=>x.hard).map(x=>x.message));
   reasons.push(...calendarIssues(candidate,calendar,days));
   if(selection.mode==='online'){
    if(!policy.allowOnline)reasons.push('Дистанционный формат запрещён настройками колледжа');
    else reasons.push(...checkOnlineEdge(candidate,next,policy));
   }
   reasons.push(...newWindowsForChange(next,lesson,candidate,policy.commuteGap));
  }
  if(reasons.length){blocked.push({lesson,reason:[...new Set(reasons)].join('; ')});continue}
  accepted.push(candidate);
  next=next.map(x=>x.id===lesson.id?candidate:x);
 }
 return {accepted,blocked,considered:eligible.length};
}
