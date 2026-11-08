/// <reference lib="webworker" />
import { solveAnnualVariant, rankAnnualVariants } from './yearSolver';
import type { AnnualConfig, YearDemand, AnnualVariant } from './yearSolver';
import type { Lesson, CalendarEvent } from './data';
import type { AcademicPracticeAssignment } from './practiceAssignments';
import { acceptProductionSnapshot } from './productionCalendarSync';
import { useWorkerCollegeDayOverrides } from './collegeDayOverrides';
import type { CollegeDayOverride } from './collegeDayOverrides';
import type { ProductionSnapshot } from './productionCalendarSync';

type Request={demands:YearDemand[];config:AnnualConfig;calendar:CalendarEvent[];locked:Lesson[];assignments?:AcademicPracticeAssignment[];production?:ProductionSnapshot|null;collegeOverrides?:CollegeDayOverride[]};
self.onmessage=(event:MessageEvent<Request>)=>{
 try{
  const {demands,config,calendar,locked,assignments,production,collegeOverrides}=event.data;
  useWorkerCollegeDayOverrides(collegeOverrides??[]);
  if(production&&!acceptProductionSnapshot(production))throw Error('Некорректные данные производственного календаря');
  const variants:AnnualVariant[]=[];
  for(let n=0;n<4;n++){
   const variant=solveAnnualVariant(demands,config,calendar,n,locked,assignments??[]);
   variants.push(variant);
   self.postMessage({type:'progress',current:n+1,total:4,name:variant.name});
  }
   self.postMessage({type:'result',variants:rankAnnualVariants(variants)});
 }catch(e){self.postMessage({type:'error',message:e instanceof Error?e.message:String(e)})}
};
