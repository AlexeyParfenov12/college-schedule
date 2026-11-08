/**
 * Russian federal non-working calendar, shared by every College Schedule workflow.
 *
 * Federal holidays: Labour Code of the Russian Federation, article 112.
 * Confirmed annual transfers:
 * 2026: Government Resolution №1466 of 24 September 2025
 * https://static.government.ru/media/files/4jeB8hNKm69ggOa9yDiYOli6YoAyM21i.pdf
 * 2027: Government Resolution №1187 of 17 September 2026
 * https://www.consultant.ru/document/cons_doc_LAW_544706/
 * 5-day vs 6-day interpretation:
 * https://www.consultant.ru/document/cons_doc_LAW_533407/8482f400cefcccc796927e9d8d72f679e8803386/
 *
 * Do not treat future years with unpublished government transfers as approved.
 * Regional or college closures are additional events in the academic calendar.
 */
export type Workweek=5|6;
import { externalDayCode } from './productionCalendarSync';
import { getCollegeDayOverride } from './collegeDayOverrides';
export type CalendarDayKind='work'|'weekend'|'holiday'|'transfer'|'working-weekend'|'shortened'|'college-off'|'college-work'|'college-shortened';
export type CalendarDay={date:string;kind:CalendarDayKind;label:string;nonWorking:boolean;confirmedTransfers:boolean;basis:string};
export const LEGAL_SOURCE='https://www.consultant.ru/document/cons_doc_LAW_34683/98ef2900507766e70ff29c0b9d8e2353ea80a1cf/';
export const CONFIRMED_TRANSFERS:Record<number,{source:string;five:{off:string[];work:string[]};six:{off:string[];work:string[]}}>={
 2026:{source:'Постановление Правительства РФ № 1466 от 24.09.2025',
  five:{off:['2026-01-09','2026-12-31'],work:[]},
  six:{off:['2026-12-31'],work:[]}},
 2027:{source:'Постановление Правительства РФ № 1187 от 17.09.2026',
  five:{off:['2027-02-22','2027-11-05','2027-12-31'],work:['2027-02-20']},
  six:{off:['2027-12-31'],work:[]}}
};
const MONTH_DAY_NAMES:Record<string,string>={
 '01-01':'Новогодние каникулы','01-02':'Новогодние каникулы','01-03':'Новогодние каникулы',
 '01-04':'Новогодние каникулы','01-05':'Новогодние каникулы','01-06':'Новогодние каникулы',
 '01-07':'Рождество Христово','01-08':'Новогодние каникулы',
 '02-23':'День защитника Отечества','03-08':'Международный женский день',
 '05-01':'Праздник Весны и Труда','05-09':'День Победы',
 '06-12':'День России','11-04':'День народного единства'
};
export const fixedHolidayName=(iso:string)=>MONTH_DAY_NAMES[iso.slice(5)]||'';
const dateUTC=(iso:string)=>new Date(iso+'T00:00:00.000Z');
const isoDate=(d:Date)=>d.toISOString().slice(0,10);
const dayOfWeek=(iso:string)=>dateUTC(iso).getUTCDay();
const isNormalWeekend=(iso:string,week:Workweek)=>dayOfWeek(iso)===0||(week===5&&dayOfWeek(iso)===6);
export const transfersConfirmed=(year:number)=>Object.prototype.hasOwnProperty.call(CONFIRMED_TRANSFERS,year);
export function readCollegeWorkweek():Workweek{
 try{if(typeof localStorage!=='undefined')return localStorage.getItem('college-schedule-workweek-v1')==='5'?5:6}catch{}
 return 6;
}
/**
 * Predicts replacement off days for holidays outside January.
 * January holiday transfers are ONLY taken from the official government annual decree.
 * This is a federal baseline; future decrees may revise these days.
 */
function observedHolidays(year:number,week:Workweek,annual:{off:string[];work:string[]}){
 const observed=new Map<string,string>();
 const yearName=String(year);
 const holidays=Object.keys(MONTH_DAY_NAMES).filter(x=>!x.startsWith('01-'));
 for(const monthDay of holidays){
  const origin=yearName+'-'+monthDay;
  if(!isNormalWeekend(origin,week))continue;
  const next=dateUTC(origin);
  for(let n=0;n<14;n++){
   next.setUTCDate(next.getUTCDate()+1);
   const candidate=isoDate(next);
   if(!isNormalWeekend(candidate,week)&&!fixedHolidayName(candidate)&&
     !annual.off.includes(candidate)&&!observed.has(candidate)){
    observed.set(candidate,'Выходной перенесён с '+origin+' ('+fixedHolidayName(origin)+')');
    break;
   }
  }
 }
 return observed;
}
const cache=new Map<string,Map<string,string>>();
function observedFor(year:number,week:Workweek,annual:{off:string[];work:string[]}){
 const key=year+'-'+week;
 let map=cache.get(key);
 if(!map){map=observedHolidays(year,week,annual);cache.set(key,map)}
 return map;
}
export function classifyLocalCalendarDay(iso:string,week:Workweek=6):CalendarDay{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||Number.isNaN(dateUTC(iso).getTime()))throw new Error('Некорректная дата календаря: '+iso);
 const year=Number(iso.slice(0,4));
 const official=CONFIRMED_TRANSFERS[year];
 const approved=Boolean(official);
 const annual=approved?(week===5?official.five:official.six):{off:[],work:[]};
 const basis=official?.source||'Федеральные праздники и еженедельные выходные; переносы этого года ещё не подтверждены';
 const holiday=fixedHolidayName(iso);
 const make=(kind:CalendarDayKind,label:string,nonWorking:boolean):CalendarDay=>({
  date:iso,kind,label,nonWorking,confirmedTransfers:approved,basis
 });
 if(holiday)return make('holiday',holiday,true);
 if(annual.off.includes(iso))return make('transfer','Выходной по переносу · '+basis,true);
 const observed=observedFor(year,week,annual).get(iso);
 if(observed)return make('transfer',observed,true);
 if(annual.work.includes(iso))return make('working-weekend','Рабочая суббота по переносу · '+basis,false);
 if(isNormalWeekend(iso,week))return make('weekend',dayOfWeek(iso)===0?'Воскресенье · выходной':'Суббота · выходной',true);
 return make('work','Рабочий учебный день',false);
}
/** A published API snapshot refines the baseline. It never silently reopens a day
 * declared non-working by the built-in legal rules, including future unapproved years.
 * Third-party statuses are reference data, not proof of a new government decree. */
export function classifyReferenceCalendarDay(iso:string,week:Workweek=6):CalendarDay{
 const baseline=classifyLocalCalendarDay(iso,week);
 const external=externalDayCode(iso,week);
 if(external===null)return baseline;
 const reference=' · Сверка: isdayoff.ru (справочные данные; изменение требует проверки)';
 if(external==='1'&&!baseline.nonWorking){
  return {...baseline,kind:'transfer',label:'Нерабочий день по обновлённому календарю'+reference,
   nonWorking:true,basis:baseline.basis+reference};
 }
 if(external==='2'&&!baseline.nonWorking){
  return {...baseline,kind:'shortened',label:'Предпраздничный сокращённый день'+reference,
   basis:baseline.basis+reference};
 }
 // Never silently open a statutorily closed day on a disagreement.
 return baseline;
}
/** College-wide local exceptions; federal holidays and confirmed transfers cannot be reopened. */
export function collegeWorkOverrideProhibited(iso:string,week:Workweek=6):string|null{
 const federal=classifyReferenceCalendarDay(iso,week);
 if(federal.kind==='holiday'||federal.kind==='transfer')return 'Федеральный праздник или перенесённый нерабочий день нельзя делать рабочим локальным исключением';
 if(federal.nonWorking&&new Date(iso+'T00:00:00Z').getUTCDay()===0)return 'Воскресенье требует отдельного правового основания; локальный редактор не может сделать его обычным рабочим днём';
 if(federal.nonWorking&&federal.kind!=='weekend')return 'Нерабочий день подтверждён внешним календарём и требует нормативной проверки';
 return null;
}
export function classifyCalendarDay(iso:string,week:Workweek=6):CalendarDay{
 const reference=classifyReferenceCalendarDay(iso,week);
 const custom=getCollegeDayOverride(iso);
 if(!custom)return reference;
 const basis='Решение колледжа: '+custom.reason+' · внесено '+custom.author;
 if(custom.action==='closed')return {...reference,kind:'college-off',label:'Дополнительный неучебный день · '+custom.reason,nonWorking:true,basis};
 if(custom.action==='shortened'&&!reference.nonWorking)return {...reference,kind:'college-shortened',label:'Сокращённый учебный день · '+custom.reason,nonWorking:false,basis};
 if(custom.action==='working'&&!collegeWorkOverrideProhibited(iso,week))
  return {...reference,kind:'college-work',label:'Дополнительный рабочий день колледжа · '+custom.reason,nonWorking:false,basis};
 return reference;
}
export function productionDiffersFromBaseline(iso:string,week:Workweek=6):boolean{
 const before=classifyLocalCalendarDay(iso,week),after=classifyReferenceCalendarDay(iso,week);
 return before.nonWorking!==after.nonWorking||before.kind!==after.kind;
}
export function nonWorkingDays(from:string,to:string,week:Workweek=6):CalendarDay[]{
 const start=dateUTC(from),end=dateUTC(to);
 if(start>end)return [];
 const output:CalendarDay[]=[];
 for(const d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){
  const day=classifyCalendarDay(isoDate(d),week);
  if(day.nonWorking)output.push(day);
  if(output.length>5000)break;
 }
 return output;
}
export function holidayMonth(year:number,month:number,week:Workweek){
 const start=new Date(Date.UTC(year,month-1,1));
 const end=new Date(Date.UTC(year,month,0));
 const days:CalendarDay[]=[];
 for(let i=1;i<=end.getUTCDate();i++)days.push(classifyCalendarDay(year+'-'+String(month).padStart(2,'0')+'-'+String(i).padStart(2,'0'),week));
 return {year,month,days,firstMondayOffset:(start.getUTCDay()+6)%7,
  holidays:days.filter(x=>x.kind==='holiday'||x.kind==='transfer').length,
  off:days.filter(x=>x.nonWorking).length,confirmedTransfers:transfersConfirmed(year)};
}
