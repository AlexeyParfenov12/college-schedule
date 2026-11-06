// @vitest-environment jsdom
import { beforeEach,afterEach,describe,expect,it } from 'vitest';
import { GROUPS, ROOMS, TEACHERS } from './data';
import type { Lesson } from './data';
import { assessRoomFit } from './roomPolicy';
import { classroomDependencies,refreshRoomCatalog,saveDemoRoom,archiveDemoRoom } from './roomRegistry';
const group=GROUPS.find(g=>g.id==='П-21')!;
const room=()=>ROOMS.find(r=>r.id==='102')!;
const lesson=(changes:Partial<Lesson>={}):Lesson=>({id:'test',day:0,slot:1,week:0,
 subject:'Программирование',teacher:TEACHERS[0],groups:['П-21'],room:'102',mode:'offline',type:'regular',...changes});
beforeEach(()=>{localStorage.removeItem('college-room-catalog-v1');refreshRoomCatalog()});
afterEach(()=>{localStorage.removeItem('college-room-catalog-v1');refreshRoomCatalog()});
describe('shared computer work and physical safety',()=>{
 it('fits 28 students using 15 computers in a pair-work room with 32 seats',()=>{
  expect(group.count).toBe(28);
  const fit=assessRoomFit(lesson(),room());
  expect(fit.level).toBe('ok');
  expect(fit.requiredComputers).toBe(14);
  expect(fit.studentsPerComputer).toBe(2);
 });
 it('offers an amber, negotiable warning for 10 PCs with 28 students at 2 per PC',()=>{
  const r={...room(),pc:10,capacity:32};
  const fit=assessRoomFit(lesson(),r);
  expect(fit.level).toBe('warning');
  expect(fit.hard).toBe(false);
  expect(fit.reason).toMatch(/3|ПК/);
 });
 it('fits 28 students in 10 PCs if 3 learners per computer are allowed',()=>{
  const fit=assessRoomFit(lesson({computerShare:3}),{...room(),pc:10,capacity:32});
  expect(fit.level).toBe('ok');
  expect(fit.requiredComputers).toBe(10);
 });
 it('does not allow too many students in a small physical room, even with 30 PCs',()=>{
  const fit=assessRoomFit(lesson(),{...room(),pc:15,capacity:15});
  expect(fit.hard).toBe(true);
  expect(fit.reason).toMatch(/посадочных/);
 });
 it('enforces an individual workstation for exam/mandatory 1:1',()=>{
  const fit=assessRoomFit(lesson({requiresIndividualComputer:true}),room());
  expect(fit.level).toBe('blocked');
  expect(fit.reason).toMatch(/1:1/);
 });
 it('does not make a title-only inference equivalent to an explicit mandatory requirement',()=>{
  const noPc={...room(),pc:0};
  expect(assessRoomFit(lesson(),noPc).level).toBe('warning');
  expect(assessRoomFit(lesson({requiresComputers:true}),noPc).level).toBe('blocked');
 });
});
describe('single persisted classroom catalog (demo)',()=>{
 it('creates a classroom and restores it from storage without duplicate entries',()=>{
  const result=saveDemoRoom({id:'405',building:'Г',kind:'Компьютерный класс',capacity:32,pc:15,
   active:true,title:'Новая лаборатория',features:['ПК','Интернет'],recommendedStudentsPerComputer:2,maxStudentsPerComputer:3});
  expect(result.ok).toBe(true);
  expect(ROOMS.find(r=>r.id==='405')?.capacity).toBe(32);
  refreshRoomCatalog();
  expect(ROOMS.filter(r=>r.id==='405')).toHaveLength(1);
  const dupe=saveDemoRoom({...room(),id:'405'});
  expect(dupe.ok).toBe(false);
 });
 it('changes shared-PC policy on an existing classroom and preserves the same id',()=>{
  const changed=saveDemoRoom({...room(),maxStudentsPerComputer:2,recommendedStudentsPerComputer:2},'102');
  expect(changed.ok).toBe(true);
  expect(ROOMS.find(r=>r.id==='102')?.maxStudentsPerComputer).toBe(2);
  expect(assessRoomFit(lesson({computerShare:3}),room()).hard).toBe(true);
 });
 it('archives classrooms but retains associated lessons and reports them as dependencies',()=>{
  const lessons=[lesson(),lesson({id:'other',day:1,room:'102 / 107'})];
  expect(classroomDependencies('102',lessons)).toHaveLength(2);
  expect(archiveDemoRoom('102',lessons).ok).toBe(true);
  expect(ROOMS.find(r=>r.id==='102')?.active).toBe(false);
  expect(lessons).toHaveLength(2);
 });
 it('rejects an impossible physical configuration',()=>{
  const bad=saveDemoRoom({...room(),capacity:12,pc:25},'102');
  expect(bad.ok).toBe(false);
 });
});
