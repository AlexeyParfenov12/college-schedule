import { describe, expect, it } from 'vitest';
import type { Lesson } from './data';
import { ROOMS, TEACHERS } from './data';
import { countAvailable, explainCandidate, moveOptions, teacherSuggestions, roomSuggestions, swapOptions } from './scheduleAssist';
const src=(changes:Partial<Lesson>={}):Lesson=>({
 id:'original',week:10,day:0,slot:1,subject:'Программирование',teacher:TEACHERS[0],
 groups:['П-21'],room:'109',type:'regular',mode:'offline',...changes
});
describe('contextual scheduling assistant',()=>{
 it('labels source, free slots and forbidden group collisions separately',()=>{
   const a=src(),other=src({id:'other',day:1,slot:2,teacher:TEACHERS[4],room:'110'});
   const slots=moveOptions(a,[a,other],[],6,6);
   expect(slots).toHaveLength(36);
   expect(slots.find(x=>x.day===0&&x.slot===1)?.kind).toBe('current');
   const forbidden=slots.find(x=>x.day===1&&x.slot===2);
   expect(forbidden?.kind).toBe('blocked');
   expect(forbidden?.reason).toMatch(/Группа уже занята/);
   expect(countAvailable(slots)).toBeGreaterThan(10);
 });
 it('blocks unavailable classrooms in the heatmap',()=>{
   const a=src(),slots=moveOptions(a,[a],['109']);
   expect(slots.find(x=>x.day===2&&x.slot===1)?.reason).toContain('временно закрыт');
   expect(countAvailable(slots)).toBe(0);
 });
 it('moves linked stream participants as one unit when testing alternatives',()=>{
   const stream=src({type:'stream',groups:['П-21','П-22'],room:'101'});
   const clash=src({id:'other',groups:['П-22'],teacher:TEACHERS[8],room:'110',day:2,slot:4});
   const slots=moveOptions(stream,[stream,clash]);
   expect(slots.find(x=>x.day===2&&x.slot===4)?.kind).toBe('blocked');
 });
 it('provides qualified and available replacement teachers before unqualified ones',()=>{
   const a=src();
   const choices=teacherSuggestions(a,[a]);
   expect(choices.length).toBe(TEACHERS.length-1);
   const top=choices.find(x=>x.available&&x.qualified);
   expect(top).toBeTruthy();
   expect(choices[0].available&&choices[0].qualified).toBe(true);
   const occupied=src({id:'busy',teacher:top!.name,groups:['П-22'],room:'110'});
   expect(teacherSuggestions(a,[a,occupied]).find(x=>x.name===top!.name)?.available).toBe(false);
 });
 it('allows a shared workstation classroom when physical seats are sufficient',()=>{
   const choices=roomSuggestions(src(),[]);
   expect(choices.length).toBe(ROOMS.length-1);
   expect(choices.find(r=>r.id==='102')?.available).toBe(true);
   expect(choices.find(r=>r.id==='101')?.available).toBe(true);
 });
 it('disallows modification hints for already confirmed lessons',()=>{
   const a=src({status:'held'});
   expect(explainCandidate({...a,day:2},[a])).toContain('Занятие уже подтверждено как проведённое');
 });
 it('allows an atomic two-way swap and rejects a third-party collision',()=>{
  const a=src({id:'a',day:0,slot:1,room:'109'});
  const b=src({id:'b',day:1,slot:2,room:'110',teacher:TEACHERS[1]});
  expect(swapOptions(a,[a,b]).find(x=>x.lesson.id==='b')?.available).toBe(true);
  const third=src({id:'third',day:1,slot:2,groups:['П-23'],room:'109',teacher:TEACHERS[2]});
  expect(swapOptions(a,[a,b,third]).find(x=>x.lesson.id==='b')?.available).toBe(false);
 });
 it('never offers exchanges of confirmed lessons',()=>{
  const a=src({id:'a',day:0,slot:1}),b=src({id:'b',day:1,slot:1,status:'held'});
  expect(swapOptions(a,[a,b]).find(x=>x.lesson.id==='b')?.available).toBe(false);
 });
});
