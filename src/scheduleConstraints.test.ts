import { describe,expect,it } from 'vitest';
import { GROUPS,TEACHERS } from './data';
import { defaultAnnualConfig, solveAnnualVariant } from './yearSolver';
import { checkGroupSlot, checkTeacherSlot, effectiveGroupRules,effectiveTeacherRule } from './scheduleConstraints';
describe('College -> department -> group restrictive inheritance',()=>{
 it('inherits all three levels and explains which scope contributes a restriction',()=>{
  const cfg=defaultAnnualConfig();cfg.days=6;
  cfg.collegeRules={daysOff:[1],fromSlot:2,toSlot:5,maxPairsPerDay:4};
  cfg.departmentRules={'ИТ':{daysOff:[2],maxPairsPerDay:3}};
  cfg.groupRules={'П-21':{daysOff:[3],fromSlot:3,maxPairsPerDay:2}};
  const trace=effectiveGroupRules(cfg,'П-21');
  expect(trace.rule.daysOff).toEqual([1,2,3]);
  expect(trace.rule.fromSlot).toBe(3);
  expect(trace.rule.toSlot).toBe(5);
  expect(trace.rule.maxPairsPerDay).toBe(2);
  expect(trace.origin).toEqual(['Учебная неделя колледжа','Колледж','Отделение: ИТ','Группа: П-21']);
  expect(checkGroupSlot(cfg,'П-21',3,3).allowed).toBe(false);
  expect(checkGroupSlot(cfg,'П-22',3,3).allowed).toBe(true);
  expect(checkGroupSlot(cfg,'Р-21',2,3).allowed).toBe(true);
 });
 it('never permits child rules to relax college-wide mandatory bans',()=>{
  const cfg=defaultAnnualConfig();
  cfg.collegeRules={daysOff:[0],fromSlot:3,maxPairsPerDay:1,forbidden:[{day:2,from:4,to:4}]};
  cfg.departmentRules={'ИТ':{daysOff:[],fromSlot:1,maxPairsPerDay:6}};
  cfg.groupRules={'П-21':{daysOff:[],fromSlot:1,maxPairsPerDay:6}};
  const result=effectiveGroupRules(cfg,'П-21');
  expect(result.rule.daysOff).toEqual([0]);
  expect(result.rule.fromSlot).toBe(3);
  expect(result.rule.maxPairsPerDay).toBe(1);
  expect(checkGroupSlot(cfg,'П-21',2,4).allowed).toBe(false);
  expect(checkGroupSlot(cfg,'П-21',1,3,1).reason).toMatch(/максимум/);
 });
 it('applies common days-off and max daily load to teachers as well',()=>{
  const cfg=defaultAnnualConfig();cfg.collegeRules={daysOff:[0],maxPairsPerDay:2,fromSlot:2};
  cfg.teacherPreferences[TEACHERS[0]]={daysOff:[],fromSlot:1,toSlot:6,forbidden:[],preferDays:[],maxOnlinePct:20,maxPairsPerDay:6};
  const rule=effectiveTeacherRule(cfg,TEACHERS[0]);
  expect(rule.daysOff).toContain(0);
  expect(rule.fromSlot).toBe(2);
  expect(rule.maxPairsPerDay).toBe(2);
  expect(checkTeacherSlot(cfg,TEACHERS[0],0,2).allowed).toBe(false);
  expect(checkTeacherSlot(cfg,TEACHERS[0],1,2,2).allowed).toBe(false);
 });
 it('keeps six-day-week Saturday available unless that day is explicitly prohibited',()=>{
  const cfg=defaultAnnualConfig();cfg.days=6;
  expect(checkGroupSlot(cfg,'П-21',5,1).allowed).toBe(true);
  cfg.groupRules={'П-21':{daysOff:[5]}};
  expect(checkGroupSlot(cfg,'П-21',5,1).allowed).toBe(false);
  expect(checkGroupSlot(cfg,'П-22',5,1).allowed).toBe(true);
 });
});
describe('Annual solver enforces configured group and teacher scope',()=>{
 it('never schedules on a forbidden college day even if there are free rooms',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=1;cfg.days=5;cfg.slotsPerDay=6;
  cfg.collegeRules={daysOff:[0,1,2,3],maxPairsPerDay:1};
  const demand={id:'math',group:'П-21',subject:'Математика',teacher:TEACHERS[0],pairsPerWeek:3,requiredPairs:3};
  const result=solveAnnualVariant([demand],cfg,[],0);
  expect(result.lessons.every(l=>l.day===4)).toBe(true);
  expect(result.lessons.filter(l=>l.groups.includes('П-21'))).toHaveLength(1);
  expect(result.unplaced).toHaveLength(1);
 });
 it('preserves restrictions for continuously reserved practice blocks',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=1;cfg.days=5;
  cfg.groupRules={'П-21':{daysOff:[0]}};
  cfg.practiceBlocks=[{id:'practice',group:'П-21',kind:'college',title:'Учебная практика',teacher:TEACHERS[0],
    startWeek:0,durationWeeks:1,days:[0,1],fromSlot:1,toSlot:1,room:'109'}];
  const result=solveAnnualVariant([],cfg,[],0);
  expect(result.lessons.filter(l=>l.practiceBlockId==='practice')).toHaveLength(1);
  expect(result.lessons.some(l=>l.practiceBlockId==='practice'&&l.day===0)).toBe(false);
  expect(result.practiceIssues.some(i=>i.reason.includes('Группа:'))).toBe(true);
 });
});
