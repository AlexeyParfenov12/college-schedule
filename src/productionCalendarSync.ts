import { useSyncExternalStore } from 'react';

/** Snapshot is downloaded by a scheduled GitHub Action, never from a browser-to-API secret. */
export type ProductionYear={five:string;six:string};
export type ProductionSnapshot={
 version:1;provider:'isdayoff.ru';checkedAt:string;years:Record<string,ProductionYear>;
};
export type ProductionState={revision:number;status:'baseline'|'updated'|'unavailable';checkedAt:string;years:number[];message:string};
let snapshot:ProductionSnapshot|null=null;
let state:ProductionState={revision:0,status:'baseline',checkedAt:'',years:[],message:'Используются встроенные календарные правила'};
const subscribers=new Set<()=>void>();
const emit=()=>{for(const subscriber of subscribers)subscriber()};
export const getProductionState=()=>state;
export const subscribeProductionCalendar=(listener:()=>void)=>{subscribers.add(listener);return ()=>{subscribers.delete(listener)}};
export function useProductionCalendarState(){return useSyncExternalStore(subscribeProductionCalendar,getProductionState,getProductionState)}
const isLeap=(year:number)=>new Date(Date.UTC(year,1,29)).getUTCMonth()===1;
const validDate=(year:number,ordinal:number)=>{
 const date=new Date(Date.UTC(year,0,ordinal+1));
 return date.getUTCFullYear()===year?date:null;
};
const validateYear=(year:number,entry:ProductionYear):boolean=>{
 if(!Number.isInteger(year)||year<2020||year>2100||!entry||typeof entry.five!=='string'||typeof entry.six!=='string')return false;
 const length=isLeap(year)?366:365;
 if(entry.five.length!==length||entry.six.length!==length)return false;
 if(!/^[012]+$/.test(entry.five)||!/^[012]+$/.test(entry.six))return false;
 if(entry.five[0]!=='1'||entry.six[0]!=='1')return false;
 let sundays=0,off5=0,off6=0;
 for(let i=0;i<length;i++){
  const date=validDate(year,i);if(!date)return false;
  if(date.getUTCDay()===0){sundays++;if(entry.five[i]!=='1'||entry.six[i]!=='1')return false;}
  if(entry.five[i]==='1')off5++;
  if(entry.six[i]==='1')off6++;
 }
 return sundays>=52&&off5>=95&&off6>=55&&off5<=145&&off6<=125;
};
export function acceptProductionSnapshot(raw:unknown):boolean{
 if(!raw||typeof raw!=='object')return false;
 const data=raw as Partial<ProductionSnapshot>;
 if(data.version!==1||data.provider!=='isdayoff.ru'||typeof data.checkedAt!=='string'||
    !/^\d{4}-\d{2}-\d{2}T/.test(data.checkedAt)||!Number.isFinite(Date.parse(data.checkedAt))||
    !data.years||typeof data.years!=='object')return false;
 const entries=Object.entries(data.years);
 if(!entries.length||entries.length>8||entries.some(([key,value])=>!/^20\d\d$/.test(key)||!validateYear(Number(key),value)))return false;
 const previous=JSON.stringify(snapshot?.years);
 snapshot=data as ProductionSnapshot;
 state={revision:state.revision+1,status:'updated',checkedAt:data.checkedAt,years:entries.map(([k])=>Number(k)).sort(),
  message:previous&&previous!==JSON.stringify(data.years)?'Производственный календарь обновлён. Проверьте существующие занятия.':'Данные производственного календаря загружены'};
 emit();return true;
}
export function externalDayCode(iso:string,week:5|6):'0'|'1'|'2'|null{
 const year=Number(iso.slice(0,4));const entry=snapshot?.years[String(year)];
 if(!entry)return null;
 const index=Math.round((Date.parse(iso+'T00:00:00Z')-Date.UTC(year,0,1))/86400000);
 return (entry[week===5?'five':'six'][index] as '0'|'1'|'2'|undefined)??null;
}
export async function refreshProductionCalendar():Promise<boolean>{
 try{
  const base=new URL('production-calendar.json',document.baseURI);
  base.searchParams.set('t',String(Date.now()));
  const response=await fetch(base.toString(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const body:unknown=await response.json();
  if(!acceptProductionSnapshot(body))throw Error('Неверный формат или неполные данные календаря');
  return true;
 }catch{
  if(!snapshot){state={...state,status:'unavailable',revision:state.revision+1,message:'Обновление недоступно; действуют встроенные правила'};emit()}
  return false;
 }
}
