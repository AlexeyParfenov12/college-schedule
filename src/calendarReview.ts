/** Local demo acknowledgements for calendar discrepancy notices.
 * Acknowledgement never changes federal status; if the source data changes,
 * the new fingerprint becomes unread and requires fresh review.
 */
import type { CalendarDiscrepancy, OfficialCandidate } from './productionCalendarSync';
export const CALENDAR_REVIEWS_KEY='college-calendar-reviewed-v1';
export const discrepancyFingerprint=(d:CalendarDiscrepancy)=>
 ['discrepancy',d.id,d.date,d.workweek,d.apiCode,d.legalCode,d.explanation,d.documentTitle,d.officialUrl].join('|');
export const candidateFingerprint=(d:OfficialCandidate)=>
 ['official',d.id,d.date,d.title,d.explanation,d.url].join('|');
export const warningFingerprint=(message:string)=>'warning|'+message;
export function readCalendarReviews():string[]{
 try{
  const raw=localStorage.getItem(CALENDAR_REVIEWS_KEY);
  const items:unknown=raw?JSON.parse(raw):[];
  return Array.isArray(items)?[...new Set(items.filter((v):v is string=>typeof v==='string'&&v.length<2000))].slice(0,200):[];
 }catch{return []}
}
export function saveCalendarReviews(items:string[]):void{
 const unique=[...new Set(items)].slice(-200);
 try{localStorage.setItem(CALENDAR_REVIEWS_KEY,JSON.stringify(unique))}catch{
  throw new Error('Не удалось сохранить статус просмотра календарных уведомлений');
 }
}
