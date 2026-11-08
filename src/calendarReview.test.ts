// @vitest-environment jsdom
import {afterEach,describe,expect,it} from 'vitest';
import {
 CALENDAR_REVIEWS_KEY,candidateFingerprint,discrepancyFingerprint,
 readCalendarReviews,saveCalendarReviews,warningFingerprint
} from './calendarReview';
import type {CalendarDiscrepancy,OfficialCandidate} from './productionCalendarSync';
afterEach(()=>localStorage.removeItem(CALENDAR_REVIEWS_KEY));
const difference:CalendarDiscrepancy={
 id:'2026-12-31-6',date:'2026-12-31',workweek:6,apiCode:'0',legalCode:'1',
 status:'review_required',scope:'federal',explanation:'Справочное API не совпадает с федеральным переносом',
 documentTitle:'Постановление № 1466',officialUrl:'https://publication.pravo.gov.ru/document/demo',
 publicationUrl:'https://publication.pravo.gov.ru/document/demo'
};
describe('calendar review without changing federal rules',()=>{
 it('persists acknowledgement and keeps it separate from a college day override',()=>{
  const key=discrepancyFingerprint(difference);
  saveCalendarReviews([key,key]);
  expect(readCalendarReviews()).toEqual([key]);
  expect(localStorage.getItem('college-production-overrides-v1')).toBeNull();
 });
 it('reopens review when normative or third-party classification changes',()=>{
  const old=discrepancyFingerprint(difference);
  const revised=discrepancyFingerprint({...difference,apiCode:'2'});
  const updatedExplanation=discrepancyFingerprint({...difference,explanation:'Другая причина'});
  expect(old).not.toBe(revised);
  expect(old).not.toBe(updatedExplanation);
  saveCalendarReviews([old]);
  expect(readCalendarReviews()).not.toContain(revised);
 });
 it('can explicitly restore a reviewed item and tracks publications separately',()=>{
  const notice:OfficialCandidate={id:'post-1',date:'2026-12-31',title:'Постановление',url:'https://publication.pravo.gov.ru/example',
   status:'requires_review',explanation:'Новая публикация'};
  const key=candidateFingerprint(notice),warning=warningFingerprint('Сверка API');
  saveCalendarReviews([key,warning]);
  saveCalendarReviews(readCalendarReviews().filter(x=>x!==key));
  expect(readCalendarReviews()).toEqual([warning]);
 });
 it('treats malformed or unavailable browser data as no acknowledgement',()=>{
  localStorage.setItem(CALENDAR_REVIEWS_KEY,'broken json');
  expect(readCalendarReviews()).toEqual([]);
  localStorage.setItem(CALENDAR_REVIEWS_KEY,JSON.stringify([12,undefined,{},'valid']));
  expect(readCalendarReviews()).toEqual(['valid']);
 });
});
