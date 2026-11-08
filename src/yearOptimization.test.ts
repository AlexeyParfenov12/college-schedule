import {describe,expect,it} from 'vitest';
import {TEACHERS} from './data';
import type {Lesson,CalendarEvent} from './data';
import {avoidableWindows,compactAnnualWeek,defaultAnnualConfig,rankAnnualVariants,solveAnnualVariant} from './yearSolver';
const base=(id:string,slot:number,status:Lesson['status']='scheduled'):Lesson=>({
 id,day:0,slot,week:1,subject:'Математика',teacher:TEACHERS[0],groups:['П-21'],room:'109',type:'regular',mode:'offline',status
});
describe('year compaction as a non-destructive local search',()=>{
 it('removes avoidable windows and preserves lesson identities',()=>{
  const cfg=defaultAnnualConfig();cfg.days=5;
  const lessons=[base('a',1),base('b',3)];
  expect(avoidableWindows(lessons,1)).toBe(1);
  const changes=compactAnnualWeek(lessons,cfg,[]);
  expect(changes).toBeGreaterThan(0);
  expect(avoidableWindows(lessons,1)).toBe(0);
  expect(lessons.map(x=>x.id).sort()).toEqual(['a','b']);
 });
 it('never moves already held lessons or fixed KUG practice meetings',()=>{
  const cfg=defaultAnnualConfig();
  const lessons=[base('locked',1,'held'),base('regular',4),{...base('practice',6),practiceBlockId:'kug-P-21-1-training'}];
  compactAnnualWeek(lessons,cfg,[]);
  expect(lessons.find(x=>x.id==='locked')?.slot).toBe(1);
  expect(lessons.find(x=>x.id==='practice')?.slot).toBe(6);
 });
 it('does not put a lesson on a forbidden day or move it into practice in KUG',()=>{
  const cfg=defaultAnnualConfig();cfg.days=5;
  cfg.teacherPreferences[TEACHERS[0]]={daysOff:[1],fromSlot:1,toSlot:6,forbidden:[{day:0,from:2,to:2}],
   preferDays:[],maxOnlinePct:0};
  const lesson=base('a',3),next=base('b',5);
  const kug:CalendarEvent={id:'kug',title:'УП',kind:'practice',periodCode:'training',groups:['П-21'],
   from:'2026-09-09',to:'2026-09-09'};
  compactAnnualWeek([lesson,next],cfg,[kug]);
  expect([lesson,next].every(x=>x.day!==1&&x.slot!==2)).toBe(true);
 });
});
describe('accurate comparison of four scenarios',()=>{
 it('labels the actual lowest-window result, never a fixed index',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=1;
  const variants=[0,1,2,3].map(i=>solveAnnualVariant([],cfg,[],i));
  variants.forEach((v,i)=>{v.groupWindows=[14,7,1,9][i];v.teacherWindows=[2,3,2,1][i]});
  const ranked=rankAnnualVariants(variants);
  expect(ranked.find(x=>x.name.includes('Меньше всего окон'))?.groupWindows).toBe(1);
  expect(ranked[0].groupWindows).toBe(1);
  expect(new Set(ranked.map(x=>x.name)).size).toBe(4);
 });
});
