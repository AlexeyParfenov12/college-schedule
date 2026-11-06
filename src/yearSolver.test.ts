import { describe,expect,it } from 'vitest';
import { GROUPS, ROOMS, TEACHERS } from './data';
import type { Lesson, CalendarEvent } from './data';
import { defaultAnnualConfig, solveAnnualVariant, commuteViolations, practiceWeekActive, deriveAnnualDemands } from './yearSolver';
import type { PracticeBlock } from './yearSolver';

const block=(change:Partial<PracticeBlock>={}):PracticeBlock=>({
 id:'practice-demo',group:'П-21',kind:'college',title:'Учебная практика',
 teacher:TEACHERS[0],startWeek:1,durationWeeks:3,days:[0,1,2,3,4],fromSlot:1,toSlot:3,room:'109',...change
});
const lesson=(id:string,slot:number,mode:'offline'|'online',teacher=TEACHERS[0]):Lesson=>({
 id,day:0,slot,week:0,teacher,groups:['П-21'],subject:'Математика',room:mode==='online'?'Онлайн':'109',mode,type:'regular'
});
describe('Practice blocks with fixed rooms',()=>{
 it('keeps the same teaching room in each week of a multiweek practice',()=>{
  const config=defaultAnnualConfig();config.weeks=5;config.days=5;config.slotsPerDay=4;
  config.practiceBlocks=[block()];
  const result=solveAnnualVariant([],config,[],0);
  const practical=result.lessons.filter(l=>l.id.startsWith('practice-'));
  expect(practical).toHaveLength(3*5*3);
  expect(practical.every(l=>l.room==='109'&&l.groups[0]==='П-21')).toBe(true);
  expect([...new Set(practical.map(l=>l.week))]).toEqual([1,2,3]);
  expect(result.practiceIssues).toHaveLength(0);
  expect(result.requiredHours).toBe(3*5*3*2);
  expect(result.coveredHours).toBe(result.requiredHours);
 });
 it('blocks both the practice group and room from unrelated lessons',()=>{
  const config=defaultAnnualConfig();config.weeks=3;config.practiceBlocks=[block({startWeek:1,durationWeeks:1,days:[0],fromSlot:1,toSlot:3})];
  const demand={id:'math-test',group:'П-22',subject:'Математика',teacher:TEACHERS[4],pairsPerWeek:2,requiredPairs:6};
  const result=solveAnnualVariant([demand],config,[],1);
  const practice=result.lessons.filter(x=>x.id.startsWith('practice-'));
  const other=result.lessons.filter(x=>!x.id.startsWith('practice-'));
  for(const p of practice){
   expect(other.some(x=>x.week===p.week&&x.day===p.day&&x.slot===p.slot&&x.room==='109')).toBe(false);
  }
 });
 it('does not schedule ordinary lessons for the group during its practice weeks',()=>{
  const config=defaultAnnualConfig();config.weeks=4;config.practiceBlocks=[block({startWeek:1,durationWeeks:2,days:[0],fromSlot:1,toSlot:1})];
  const demand={id:'forbidden-regular',group:'П-21',subject:'Математика',teacher:TEACHERS[7],pairsPerWeek:1,requiredPairs:4};
  const result=solveAnnualVariant([demand],config,[],1);
  const normal=result.lessons.filter(x=>!x.id.startsWith('practice-'));
  expect(normal.some(x=>x.groups.includes('П-21')&&(x.week===1||x.week===2))).toBe(false);
 });
 it('reports a closed laboratory and does not silently move the practice to another room',()=>{
  const config=defaultAnnualConfig();config.weeks=3;config.practiceBlocks=[block({startWeek:0,durationWeeks:2})];
  config.activeRooms=config.activeRooms.filter(x=>x!=='109');
  const result=solveAnnualVariant([],config,[],2);
  expect(result.practicePairs).toBe(0);
  expect(result.practiceIssues.some(x=>x.reason.includes('закрыт'))).toBe(true);
  expect(result.coveredHours).toBeLessThan(result.requiredHours);
 });
 it('rejects a computer practice if every student needs a PC in a small lab',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=1;
  cfg.practiceBlocks=[block({startWeek:0,durationWeeks:1,room:'102',days:[0],fromSlot:1,toSlot:2,requiresComputers:true,requiresIndividualComputer:true})];
  const result=solveAnnualVariant([],cfg,[],0);
  expect(result.practicePairs).toBe(0);
  expect(result.practiceIssues.some(x=>x.reason.includes('1:1')&&x.reason.includes('ПК'))).toBe(true);
 });
 it('honours teacher day-off preferences for continuous practice',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=1;
  cfg.practiceBlocks=[block({startWeek:0,durationWeeks:1,days:[0],fromSlot:1,toSlot:2})];
  cfg.teacherPreferences[TEACHERS[0]]={daysOff:[0],fromSlot:1,toSlot:6,forbidden:[],preferDays:[],maxOnlinePct:0};
  const result=solveAnnualVariant([],cfg,[],0);
  expect(result.practicePairs).toBe(0);
  expect(result.practiceIssues.some(x=>x.reason.includes('недоступен'))).toBe(true);
 });
 it('allows practice at a company without booking a college room',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=2;cfg.practiceBlocks=[block({startWeek:0,durationWeeks:2,kind:'company',room:'',days:[0],fromSlot:1,toSlot:2})];
  cfg.activeRooms=[];
  const result=solveAnnualVariant([],cfg,[],0);
  expect(result.practicePairs).toBe(4);
  expect(result.lessons.every(x=>x.room==='Предприятие')).toBe(true);
 });
 it('rejects overlap with a public holiday and reports the problem',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=1;cfg.practiceBlocks=[block({startWeek:0,durationWeeks:1,days:[0],fromSlot:1,toSlot:2})];
  const holiday:CalendarEvent={id:'off',kind:'holiday',title:'Выходной',from:'2026-11-09',to:'2026-11-09',groups:[]};
  const result=solveAnnualVariant([],cfg,[holiday],0);
  expect(result.practiceIssues.length).toBeGreaterThan(0);
  expect(result.practicePairs).toBe(0);
 });
 it('flags academic-calendar practice without a corresponding fixed reservation',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=3;
  const event:CalendarEvent={id:'practice-calendar',kind:'practice',title:'Учебная практика',
   from:'2026-11-16',to:'2026-11-20',groups:['П-21']};
  const variant=solveAnnualVariant([],cfg,[event],0);
  expect(variant.practiceIssues.some(x=>x.group==='П-21'&&x.reason.includes('не закреплены'))).toBe(true);
 });
 it('calculates whole weeks inclusively, respecting declared start and duration',()=>{
  const p=block({startWeek:3,durationWeeks:2});
  expect(practiceWeekActive(p,2)).toBe(false);
  expect(practiceWeekActive(p,3)).toBe(true);
  expect(practiceWeekActive(p,4)).toBe(true);
  expect(practiceWeekActive(p,5)).toBe(false);
 });
});
describe('Home versus campus changeover',()=>{
 it('requires a free pair for the road and forbids multiple daily location changes',()=>{
  expect(commuteViolations([lesson('a',1,'offline'),lesson('b',2,'online')],1).length).toBeGreaterThan(0);
  expect(commuteViolations([lesson('a',1,'offline'),lesson('b',3,'online')],1)).toHaveLength(0);
  expect(commuteViolations([lesson('a',1,'offline'),lesson('b',3,'online'),lesson('c',5,'offline')],1)).toHaveLength(1);
 });
});
