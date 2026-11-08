/** Demo adapter contract for approved Academic Core practice allocations.
 * KUG exclusively owns the calendar period; this file never invents a teacher, room, site or hours.
 */
import { GROUPS, ROOMS, TEACHERS } from './data';
import type { Lesson } from './data';
import type { KugPracticePeriod, PracticePhase } from './kugPractice';
import { practicePhaseLabel } from './kugPractice';

export type AcademicPracticeAssignment={
 periodId:string;group:string;phase:PracticePhase;supervisor:string;
 location:string; approvedHours:number;startSlot:number;
 calendarStamp:string;approved:boolean;
};
export const practicePeriodStamp=(p:KugPracticePeriod)=>[p.id,p.from,p.to,p.days.join(',')].join('|');
export function practiceAssignmentProblems(p:KugPracticePeriod,a:AcademicPracticeAssignment|undefined,slotsPerDay:number):string[]{
 if(!a)return ['Нет подтверждённого назначения практики в Academic Core: укажите руководителя, место и часы'];
 const issues:string[]=[];
 if(a.periodId!==p.id||a.group!==p.group||a.phase!==p.phase)issues.push('Назначение не соответствует периоду КУГ');
 if(a.calendarStamp!==practicePeriodStamp(p))issues.push('КУГ изменён: подтвердите назначение для новых дат');
 if(!a.approved)issues.push('Назначение ещё не утверждено');
 if(!TEACHERS.includes(a.supervisor))issues.push('Не выбран руководитель из кадрового справочника Academic Core');
 if(!Number.isInteger(a.approvedHours)||a.approvedHours<=0||a.approvedHours%2!==0)
  issues.push('Требуются утверждённые часы: положительное чётное число');
 if(!Number.isInteger(a.startSlot)||a.startSlot<1||a.startSlot>slotsPerDay)
  issues.push('Недопустимая начальная пара');
 if(p.phase==='training'){
  const room=ROOMS.find(r=>r.id===a.location);
  const group=GROUPS.find(g=>g.id===p.group);
  if(!room||!room.active)issues.push('Не выбрана действующая аудитория учебной практики');
  else if(group&&room.capacity<group.count)issues.push('Аудитория меньше численности группы');
  if(a.approvedHours>p.days.length*Math.max(0,slotsPerDay-a.startSlot+1)*2)
   issues.push('Часы практики не помещаются в доступные дни и пары КУГ');
 }else if(!a.location.trim())issues.push('Не указана организация или место прохождения');
 return [...new Set(issues)];
}
/** Only UP is scheduled into classroom slots. PP/PDP record offsite allocation, NOT conducted hours. */
export function practiceMeetings(p:KugPracticePeriod,a:AcademicPracticeAssignment):Lesson[]{
 if(p.phase!=='training'||!p.days.length)return [];
 const result:Lesson[]=[];
 for(let i=0;i<a.approvedHours/2;i++){
  const day=p.days[i%p.days.length],slot=a.startSlot+Math.floor(i/p.days.length);
  result.push({id:'practice-'+p.id+'-'+day+'-'+slot,week:p.week,day,slot,
   subject:practicePhaseLabel(p.phase),teacher:a.supervisor,groups:[p.group],room:a.location,
   type:'regular',mode:'offline',hours:2,practiceBlockId:p.id,status:'scheduled'});
 }
 return result;
}
export const practiceAssignmentIndex=(items:AcademicPracticeAssignment[])=>
 new Map(items.map(x=>[x.periodId,x]));
