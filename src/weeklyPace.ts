/** Academy hours: hard semester totals, soft weekly pace. One hour reserves an entire
 * timetable cell in this demonstration; later a 45-minute half-pair grid can refine it.
 */
export type PeriodHours={id:string;weeks:number[];requiredHours:number;weeklyTargetHours?:number};
export type WeeklyPaceDeviation={
 id:string;group:string;subject:string;periodId:string;week:number;
 targetHours:number;actualHours:number;deviationHours:number;
};
export function cumulativeWeeklyGoal(period:PeriodHours,week:number):number{
 const weeks=[...new Set(period.weeks)].sort((a,b)=>a-b),index=weeks.indexOf(week);
 if(index<0||!weeks.length)return 0;
 const total=Math.max(0,period.requiredHours);
 if(index===weeks.length-1)return total; // one semester may catch up, never transfers into the next
 const rate=period.weeklyTargetHours;
 if(typeof rate==='number'&&Number.isFinite(rate)&&rate>0)
  return Math.min(total,Math.floor((index+1)*rate));
 return Math.min(total,Math.ceil(total*(index+1)/weeks.length));
}
export function splitAcademicHours(hours:number):(1|2)[]{
 if(!Number.isInteger(hours)||hours<0)throw Error('Неотрицательные целые академические часы обязательны');
 const parts:(1|2)[]=[];
 for(let left=hours;left>0;left-=Math.min(2,left))parts.push(Math.min(2,left) as 1|2);
 return parts;
}
export function auditWeeklyPace(
 demands:{id:string;group:string;subject:string;periodAllocations?:PeriodHours[]}[],
 actualHours:(demandId:string,week:number)=>number
):WeeklyPaceDeviation[]{
 const deviations:WeeklyPaceDeviation[]=[];
 for(const d of demands)for(const period of d.periodAllocations||[]){
  if(!period.weeklyTargetHours)continue;
  const weeks=[...new Set(period.weeks)].sort((a,b)=>a-b);
  for(let i=0;i<weeks.length;i++){
   const week=weeks[i],before=i?cumulativeWeeklyGoal(period,weeks[i-1]):0;
   const targetHours=cumulativeWeeklyGoal(period,week)-before;
   const actual=actualHours(d.id,week);
   if(actual!==targetHours)deviations.push({id:d.id,group:d.group,subject:d.subject,
    periodId:period.id,week,targetHours,actualHours:actual,deviationHours:actual-targetHours});
  }
 }
 return deviations;
}
