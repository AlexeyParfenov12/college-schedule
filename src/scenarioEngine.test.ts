// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from 'vitest';
import {ROOMS,TEACHERS} from './data';
import type {Lesson} from './data';
import {DEFAULT_SUBSTITUTION_POLICY} from './substitutionPlanner';
import type {DispatcherSources} from './decisionCenterDomain';
import {
 modelScenario,scenarioExport,scenarioAffected,verifyScenarioVariant,scenarioInputProblems
} from './scenarioEngine';
import type {ScenarioInput} from './scenarioEngine';

const roomScenario=(fromDay=0,toDay=1):ScenarioInput=>({
 kind:'room',week:10,fromDay,toDay,room:'109',teacher:TEACHERS[0]
});
const teacherScenario:ScenarioInput={
 kind:'teacher',week:10,fromDay:0,toDay:1,room:'109',teacher:TEACHERS[0]
};
const sources=():DispatcherSources=>({
 calendar:[],absences:[],blockedRooms:[],practiceAssignments:[],
 substitutionPolicy:{...DEFAULT_SUBSTITUTION_POLICY}
});
const lesson=(id:string,day=0,room='109',teacher=TEACHERS[0]):Lesson=>({
 id,day,week:10,slot:1,subject:'Математика',teacher,groups:['П-21'],
 room,type:'regular',mode:'offline',hours:2,status:'scheduled'
});
beforeEach(()=>localStorage.clear());
describe('independent what-if timetable simulator',()=>{
 it('reports only affected dates and does not mutate lessons or stored academic data',()=>{
  const first=lesson('first');
  const second=lesson('second',2);
  const third={...lesson('other-room'),room:'112',day:1};
  const original=[first,second,third];
  const before=JSON.stringify(original);
  const plan=modelScenario(original,roomScenario(0,1),sources(),6);
  expect(plan.affected.map(x=>x.id)).toEqual(['first']);
  expect(plan.variants.length).toBeGreaterThan(0);
  expect(plan.variants[0].complete).toBe(true);
  expect(plan.variants[0].changes).toHaveLength(1);
  expect(plan.variants[0].changes[0].after.room).not.toBe('109');
  expect(JSON.stringify(original)).toBe(before);
  expect(localStorage.length).toBe(0);
 });
 it('models multiple classroom changes atomically without reusing an occupied room/slot',()=>{
  const original=[lesson('one',0),lesson('two',1)];
  const plan=modelScenario(original,roomScenario(),sources(),6);
  const variant=plan.variants[0];
  expect(variant.metrics.affected).toBe(2);
  expect(variant.complete).toBe(true);
  expect(variant.changes).toHaveLength(2);
  expect(variant.changes.every(x=>x.after.id===x.before.id)).toBe(true);
  expect(verifyScenarioVariant(original,roomScenario(),sources(),6,variant).ok).toBe(true);
  const report=scenarioExport(roomScenario(),plan,variant);
  expect(report.demo).toBe(true);
  expect(report.differences).toHaveLength(2);
  expect(report.notice).toContain('не является опубликованным');
 });
 it('models a closed building without relocating lessons into any room in that building',()=>{
  const first=lesson('in-building-A',0,'109');
  const second={...lesson('in-building-B',1,'209'),teacher:TEACHERS[1]};
  const input={...roomScenario(),kind:'building' as const,building:'А'};
  const result=modelScenario([first,second],input,sources(),6);
  expect(result.affected.map(x=>x.id)).toEqual(['in-building-A']);
  expect(result.variants.length).toBeGreaterThan(0);
  const variant=result.variants[0];
  if(variant.complete){
   expect(variant.changes).toHaveLength(1);
   const chosenRoom=ROOMS.find(r=>r.id===variant.changes[0].after.room);
   expect(chosenRoom?.building).not.toBe('А');
   expect(verifyScenarioVariant([first,second],input,sources(),6,variant).ok).toBe(true);
  }else{
   expect(variant.unresolved.length).toBeGreaterThan(0);
  }
 });
 it('does not fabricate a safe replacement for already held lessons',()=>{
  const original=[{...lesson('held'),status:'held' as const}];
  const plan=modelScenario(original,roomScenario(),sources(),6);
  expect(plan.variants[0].unresolved[0].reason).toContain('Проведённые');
  expect(plan.variants[0].complete).toBe(false);
  expect(verifyScenarioVariant(original,roomScenario(),sources(),6,plan.variants[0]).ok).toBe(false);
 });
 it('keeps practice and streams linked rather than editing one member in isolation',()=>{
  const practice={...lesson('practice'),practiceBlockId:'kug-10'};
  const stream={...lesson('stream',1),type:'stream' as const,groups:['П-21','П-22']};
  const plan=modelScenario([practice,stream],roomScenario(),sources(),6);
  expect(plan.variants[0].unresolved).toHaveLength(2);
  expect(plan.variants[0].changes).toHaveLength(0);
 });
 it('revalidates the complete package and rejects stale or manipulated changes',()=>{
  const original=[lesson('source')];
  const input=roomScenario();
  const first=modelScenario(original,input,sources(),6).variants[0];
  expect(first.complete).toBe(true);
  const current=[{...original[0],notes:'Updated in another view'}];
  expect(verifyScenarioVariant(current,input,sources(),6,first).ok).toBe(false);
  const changedSources={...sources(),blockedRooms:['102']};
  expect(verifyScenarioVariant(original,input,changedSources,6,first).ok).toBe(false);
  const manipulated={...first,changes:first.changes.map(c=>({...c,after:{...c.after,room:'109'}}))};
  expect(verifyScenarioVariant(original,input,sources(),6,manipulated).ok).toBe(false);
 });
 it('never marks unresolved teacher absences as a complete scenario',()=>{
  const missing=teacherScenario;
  const original=[lesson('absence')];
  const originalText=JSON.stringify(original);
  const plan=modelScenario(original,missing,sources(),6);
  expect(plan.affected).toHaveLength(1);
  for(const v of plan.variants){
   if(v.complete)expect(v.changes.every(x=>x.after.teacher!==TEACHERS[0])).toBe(true);
   else expect(verifyScenarioVariant(original,missing,sources(),6,v).ok).toBe(false);
  }
  expect(JSON.stringify(original)).toBe(originalText);
 });
 it('rejects invalid day ranges and missing catalog rooms',()=>{
  const invalid={...roomScenario(),fromDay:4,toDay:1,room:'no-room'};
  expect(scenarioInputProblems(invalid,6).length).toBeGreaterThan(0);
  expect(modelScenario([lesson('x')],invalid,sources(),6).variants).toEqual([]);
  expect(scenarioAffected([lesson('x',4)],roomScenario(0,1))).toEqual([]);
  expect(ROOMS.some(x=>x.id==='109')).toBe(true);
 });
});
