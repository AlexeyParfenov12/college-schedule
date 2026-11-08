/** Count unjustified timetable windows for an academic group or a teacher.
 * A required journey between campus and home is not considered an avoidable window.
 */
import type { Lesson } from './data';
const remote=(l:Lesson)=>l.mode==='online'||l.mode==='async';
export function idleWindows(dayLessons:Lesson[],commuteGap:1|2=1):number{
 const sorted=[...dayLessons].filter(l=>l.status!=='cancelled').sort((a,b)=>a.slot-b.slot);
 let count=0;
 for(let i=1;i<sorted.length;i++){
  const vacant=Math.max(0,sorted[i].slot-sorted[i-1].slot-1);
  const journey=remote(sorted[i])!==remote(sorted[i-1])?Math.min(vacant,commuteGap):0;
  count+=vacant-journey;
 }
 return count;
}
export function newWindowsForChange(before:Lesson[],source:Lesson,after:Lesson,commuteGap:1|2=1):string[]{
 const week=source.week||0,day=source.day;
 const occupied=before.filter(l=>l.status!=='cancelled'&&(l.week||0)===week&&l.day===day);
 const proposed=[...occupied.filter(l=>l.id!==source.id),after];
 const scopes=[
  ...source.groups.map(g=>({name:'группы '+g,match:(l:Lesson)=>l.groups.includes(g)})),
  {name:'преподавателя '+after.teacher,match:(l:Lesson)=>l.teacher===after.teacher}
 ];
 return scopes.flatMap(scope=>{
  const old=idleWindows(occupied.filter(scope.match),commuteGap);
  const next=idleWindows(proposed.filter(scope.match),commuteGap);
  return next>old?['Добавляются окна у '+scope.name+': '+(next-old)+' пары']:[];
 });
}
