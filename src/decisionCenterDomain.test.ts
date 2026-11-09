// @vitest-environment jsdom
import { beforeEach,describe,expect,it } from 'vitest';
import { CALENDAR, TEACHERS } from './data';
import type { Lesson, CalendarEvent, Absence } from './data';
import { DEFAULT_SUBSTITUTION_POLICY } from './substitutionPlanner';
import {
 readDispatcherSources, decisionTickets, decisionProposals
} from './decisionCenterDomain';
import type { DispatcherSources } from './decisionCenterDomain';
const lesson=(id:string,room='109',teacher=TEACHERS[0],group='П-21'):Lesson=>({
 id,week:10,day:0,slot:1,teacher,groups:[group],room,subject:'Математика',
 type:'regular',mode:'offline',status:'scheduled',hours:2
});
const env=():DispatcherSources=>({
 calendar:CALENDAR,absences:[],blockedRooms:[],
 substitutionPolicy:{...DEFAULT_SUBSTITUTION_POLICY},practiceAssignments:[]
});
beforeEach(()=>localStorage.clear());
describe('Decision Center: isolated analysis over existing data',()=>{
 it('reads saved room and absence settings without writing a duplicate source',()=>{
  const original=JSON.stringify({
   calendar:CALENDAR,rooms:{'109':{blocked:true,reason:'Ремонт'}},
   absences:[{id:'a',teacher:TEACHERS[0],from:0,to:1,week:10,status:'open',reason:'Больничный'}]
  });
  localStorage.setItem('college-schedule-extras-v2',original);
  const loaded=readDispatcherSources();
  expect(loaded.blockedRooms).toContain('109');
  expect(loaded.absences[0].week).toBe(10);
  expect(localStorage.getItem('college-schedule-extras-v2')).toBe(original);
  expect(localStorage.getItem('college-decisions-store')).toBeNull();
 });
 it('detects an absent teacher and does not automatically modify a class',()=>{
  const absence:Absence={id:'a',teacher:TEACHERS[0],from:0,to:1,week:10,status:'open',reason:'Больничный'};
  const source=lesson('class');
  const before=JSON.stringify(source);
  const issues=decisionTickets([source],10,6,{...env(),absences:[absence]});
  expect(issues).toHaveLength(1);
  expect(issues[0].kind).toBe('absence');
  expect(issues[0].section).toBe('substitutions');
  decisionProposals(issues[0],[source],{...env(),absences:[absence]},6);
  expect(JSON.stringify(source)).toBe(before);
 });
 it('proposes a compatible room from the existing room catalog and never mutates source',()=>{
  const source=lesson('closed');
  const settings={...env(),blockedRooms:['109']};
  const problems=decisionTickets([source],10,6,settings);
  expect(problems[0].kind).toBe('room');
  const before=JSON.stringify(source);
  const proposals=decisionProposals(problems[0],[source],settings,6);
  expect(proposals.length).toBeGreaterThan(0);
  expect(proposals.every(p=>p.kind==='room'&&p.after.room!=='109')).toBe(true);
  expect(JSON.stringify(source)).toBe(before);
 });
 it('does not suggest editing an already held or multi-group lesson',()=>{
  const held={...lesson('done'),status:'held' as const};
  const shared={...lesson('shared'),groups:['П-21','П-22']};
  const settings={...env(),blockedRooms:['109']};
  const issues=decisionTickets([held,shared],10,6,settings);
  for(const issue of issues)expect(decisionProposals(issue,[held,shared],settings,6)).toEqual([]);
 });
 it('detects conflicts without moving a linked course or silently altering the timetable',()=>{
  const a=lesson('a','109',TEACHERS[0],'П-21');
  const b=lesson('b','110',TEACHERS[1],'П-21');
  const problems=decisionTickets([a,b],10,6,env());
  expect(problems.some(x=>x.kind==='collision')).toBe(true);
  expect(problems.filter(x=>x.kind==='collision').every(x=>decisionProposals(x,[a,b],env(),6).length===0)).toBe(true);
 });
 it('routes unassigned named practice periods to Academic Core rather than fabricating supervisors',()=>{
  const calendar:CalendarEvent[]=[{id:'p',kind:'practice',periodCode:'training',
   practiceCode:'УП.05.01',title:'Учебная практика',from:'2026-11-09',to:'2026-11-10',groups:['П-21']}];
  const problems=decisionTickets([],10,6,{...env(),calendar});
  expect(problems.some(x=>x.kind==='practice'&&x.section==='academic'&&x.title.includes('УП.05.01'))).toBe(true);
 });
});
