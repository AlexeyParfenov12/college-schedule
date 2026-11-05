import { describe, expect, it } from 'vitest';
import { GROUPS, ROOMS, TEACHERS, buildSeed } from './data';
import type { Lesson, CalendarEvent } from './data';
import { deriveOffers, chooseRooms, suitableSubgroupPair, lessonDate, calendarIssues, eventAffectedLessons, previewTemplate, previewAutofill, calendarWeekSummaries } from './plannerDomain';
const l=(changes:Partial<Lesson>={}):Lesson=>({id:'base',day:0,slot:1,week:0,subject:'Математика',teacher:TEACHERS[0],groups:['П-21'],room:'109',type:'regular',mode:'offline',hours:2,...changes});
const absence:CalendarEvent={id:'c',title:'Каникулы',kind:'vacation',from:'2026-11-16',to:'2026-11-20',groups:[]};
describe('academic-derived smart lesson entry',()=>{
 it('discovers teaching assignments from demo lessons without inventing new teacher profiles',()=>{
  const records=[l(),l({id:'other',day:1,slot:2}),l({id:'third',groups:['П-22'],subject:'Физика',teacher:TEACHERS[2]})];
  const offers=deriveOffers(records);
  expect(offers).toHaveLength(2);
  expect(offers[0].count).toBe(2);
  expect(offers[0].group).toBe('П-21');
 });
 it('recommends only feasible rooms and highlights missing computer capacity',()=>{
  const practical=l({subject:'Программирование',room:''});
  expect(chooseRooms(practical,[]).some(x=>x.available)).toBe(false);
  const split={...practical,type:'subgroup' as const};
  const pair=suitableSubgroupPair(split,[]);
  expect(pair[0]).toBeTruthy();
  expect(pair[1]).toBeTruthy();
  expect(pair[0]).not.toEqual(pair[1]);
  expect(ROOMS.find(r=>r.id===pair[0])?.pc).toBeGreaterThanOrEqual(14);
 });
});
describe('calendar is an academic constraint, not a second schedule',()=>{
 it('maps week numbers to actual course dates and filters group-specific events',()=>{
  expect(lessonDate(0,0)).toBe('2026-11-09');
  expect(lessonDate(1,0)).toBe('2026-11-16');
  expect(calendarIssues(l({week:0}),[absence])).toEqual([]);
  expect(calendarIssues(l({week:1}),[absence])).toHaveLength(1);
  expect(eventAffectedLessons(absence,[l(),l({id:'second',week:1})])).toHaveLength(1);
 });
 it('shows blocked already-assigned lessons on the semester timeline',()=>{
  const week1=l({week:1,id:'w1'}),w0=l();
  const summaries=calendarWeekSummaries([absence],[w0,week1],'П-21');
  expect(summaries[1].blocked).toBe(1);
  expect(summaries[0].blocked).toBe(0);
 });
});
describe('semester template preview and auto scheduling',()=>{
 it('previews a copied week before applying without altering source',()=>{
  const original=l();
  const input=[original];
  const preview=previewTemplate(input,{sourceWeek:0,targetStart:2,targetEnd:3,cycle:1,group:'П-21',replace:true,calendar:[],blockedRooms:[]});
  expect(input).toHaveLength(1);
  expect(preview.accepted).toHaveLength(2);
  expect(preview.accepted.map(x=>x.after.week)).toEqual([2,3]);
  expect(preview.skipped).toHaveLength(0);
 });
 it('respects vacation dates and preserves shared flows and parallel meetings',()=>{
  const original=l({type:'stream',groups:['П-21','П-22'],room:'101'});
  const preview=previewTemplate([original],{sourceWeek:0,targetStart:1,targetEnd:1,cycle:1,group:'П-21',replace:false,calendar:[],blockedRooms:[]});
  expect(preview.accepted).toHaveLength(0);
  expect(preview.skipped[0].reason).toMatch(/поток|параллель/);
  const regular=previewTemplate([l()],{sourceWeek:0,targetStart:1,targetEnd:1,cycle:1,group:'П-21',replace:false,calendar:[absence],blockedRooms:[]});
  expect(regular.accepted).toHaveLength(0);
  expect(regular.skipped[0].reason).toContain('Учебный календарь');
 });
 it('proposes lessons only in allowed days and hours, with no collisions',()=>{
  const base=l({subject:'Математика',teacher:TEACHERS[68],room:''});
  const result=previewAutofill(base,[],[],[],2,{days:[0,1,2],slots:[1,2,3],requirePc:false});
  expect(result.placed).toHaveLength(2);
  expect(result.placed.every(x=>[0,1,2].includes(x.day)&&x.slot<=3)).toBe(true);
  expect(result.placed[0].id).not.toBe(result.placed[1].id);
 });
 it('does not pretend that all students fit in a 15-computer laboratory',()=>{
  const base=l({subject:'Программирование',teacher:TEACHERS[68],room:''});
  const result=previewAutofill(base,[],[],[],2,{days:[0,1],slots:[1,2],requirePc:true});
  expect(result.placed).toHaveLength(0);
  expect(result.rejected).toHaveLength(1);
 });
});
