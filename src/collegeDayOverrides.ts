import { useSyncExternalStore } from 'react';

/** Local demo data; Academic Core will replace this with scoped RBAC/audit API. */
export type CollegeDayAction='closed'|'working'|'shortened';
export type CollegeDayOverride={
 id:string;date:string;action:CollegeDayAction;reason:string;
 author:string;createdAt:string;
};
const KEY='college-production-overrides-v1';
let revisions=0;
const listeners=new Set<()=>void>();
const signal=()=>{revisions++;for(const cb of listeners)cb()};
const validDate=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)
 &&!Number.isNaN(Date.parse(day+'T00:00:00Z'))
 &&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
const load=():CollegeDayOverride[]=>{
 try{
  const raw=localStorage.getItem(KEY);
  if(!raw)return [];
  const value:unknown=JSON.parse(raw);
  if(!Array.isArray(value))return [];
  return value.filter((x):x is CollegeDayOverride=>Boolean(x)&&typeof x==='object'
   &&validDate(x.date)&&['closed','working','shortened'].includes(x.action)
   &&typeof x.reason==='string'&&typeof x.author==='string'
   &&typeof x.createdAt==='string'&&typeof x.id==='string');
 }catch{return []}
};
let data:CollegeDayOverride[]|null=null;
export const getCollegeDayOverrides=()=>data??(data=load());
export const getCollegeDayOverride=(date:string)=>getCollegeDayOverrides().find(x=>x.date===date);
export const getCollegeOverrideRevision=()=>revisions;
export const subscribeCollegeDayOverrides=(cb:()=>void)=>{listeners.add(cb);return()=>{listeners.delete(cb)}};
export const useCollegeOverrideRevision=()=>useSyncExternalStore(subscribeCollegeDayOverrides,getCollegeOverrideRevision,getCollegeOverrideRevision);
export function replaceCollegeDayOverrides(rows:CollegeDayOverride[]):void{
 const seen=new Set<string>();
 if(rows.length>400||rows.some(x=>!validDate(x.date)||x.reason.trim().length<6
  ||x.reason.length>500||!['closed','working','shortened'].includes(x.action)||!x.author.trim()
  ||seen.has(x.date)||!seen.add(x.date)))throw Error('Некорректные исключения колледжа');
 data=rows.map(x=>({...x}));
 try{localStorage.setItem(KEY,JSON.stringify(data))}catch{throw Error('Не удалось сохранить локальные исключения')}
 signal();
}
export function addCollegeDayOverride(input:Omit<CollegeDayOverride,'id'|'createdAt'>):CollegeDayOverride{
 if(!validDate(input.date))throw Error('Укажите корректную дату');
 if(input.reason.trim().length<6)throw Error('Укажите основание не менее 6 символов');
 const row:CollegeDayOverride={...input,id:'college-'+input.date,reason:input.reason.trim(),createdAt:new Date().toISOString()};
 replaceCollegeDayOverrides([...getCollegeDayOverrides().filter(x=>x.date!==input.date),row]);
 return row;
}
export function removeCollegeDayOverride(date:string):void{
 replaceCollegeDayOverrides(getCollegeDayOverrides().filter(x=>x.date!==date));
}
/** Only for annual planning in a separate Web Worker: source is read-only snapshot. */
export function useWorkerCollegeDayOverrides(rows:CollegeDayOverride[]):void{
 data=rows;
 signal();
}
