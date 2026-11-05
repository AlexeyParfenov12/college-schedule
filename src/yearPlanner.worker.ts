/// <reference lib="webworker" />
import { solveAnnualVariant } from './yearSolver';
import type { AnnualConfig, YearDemand, AnnualVariant } from './yearSolver';
import type { Lesson, CalendarEvent } from './data';

type Request={demands:YearDemand[];config:AnnualConfig;calendar:CalendarEvent[];locked:Lesson[]};
self.onmessage=(event:MessageEvent<Request>)=>{
 try{
  const {demands,config,calendar,locked}=event.data;
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
