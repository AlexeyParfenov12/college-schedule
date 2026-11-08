/// <reference lib="webworker" />
import { solveAnnualVariant } from './yearSolver';
import type { AnnualConfig, YearDemand, AnnualVariant } from './yearSolver';
import type { Lesson, CalendarEvent } from './data';
import { acceptProductionSnapshot } from './productionCalendarSync';
import { useWorkerCollegeDayOverrides } from './collegeDayOverrides';
import type { CollegeDayOverride } from './collegeDayOverrides';
import type { ProductionSnapshot } from './productionCalendarSync';

type Request={demands:YearDemand[];config:AnnualConfig;calendar:CalendarEvent[];locked:Lesson[];production?:ProductionSnapshot|null;collegeOverrides?:CollegeDayOverride[]};
self.onmessage=(event:MessageEvent<Request>)=>{
 try{
  const {demands,config,calendar,locked,production,collegeOverrides}=event.data;
  useWorkerCollegeDayOverrides(collegeOverrides??[]);
  if(production&&!acceptProductionSnapshot(production))throw Error('Некорректные данные производственного календаря');
  const variants:AnnualVariant[]=[];
  for(let n=0;n<4;n++){
   const variant=solveAnnualVariant(demands,config,calendar,n,locked);
   variants.push(variant);
   self.postMessage({type:'progress',current:n+1,total:4,name:variant.name});
  }
  variants.sort((a,b)=>b.score-a.score);
  self.postMessage({type:'result',variants});
 }catch(e){self.postMessage({type:'error',message:e instanceof Error?e.message:String(e)})}
};
