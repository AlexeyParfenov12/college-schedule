import { describe, expect, it } from 'vitest';
import { GROUPS, ROOMS, TEACHERS, buildSeed } from './data';
import type { Lesson } from './data';
import { findFree, groupCount, reportRows, validate } from './demoLogic';
const basic=(patch:Partial<Lesson>={}):Lesson=>({
 id:'test-class', day:0, slot:1, week:0, subject:'Программирование',teacher:TEACHERS[0],
 groups:['П-21'],room:'109',type:'regular',mode:'offline',hours:2,...patch
});
describe('demonstration academic data',()=>{
 it('contains substantial deterministic synthetic base',()=>{
  const all=buildSeed(2);
  expect(GROUPS.length).toBeGreaterThanOrEqual(30);
  expect(TEACHERS.length).toBeGreaterThanOrEqual(60);
  expect(ROOMS.length).toBeGreaterThanOrEqual(40);
  expect(all.length).toBeGreaterThan(1200);
  expect(buildSeed(2)).toEqual(all);
 });
 it('does not assign the same group and time twice across one seeded week',()=>{
  const all=buildSeed(1);const seen=new Set<string>();
  for(const l of all)for(const g of l.groups){
   const key=[l.week,l.day,l.slot,g].join(':');expect(seen.has(key)).toBe(false);seen.add(key);
  }
 });
 it('retains special scenarios with one shared meeting, not copied teacher lessons',()=>{
  const all=buildSeed(1);
  expect(all.some(x=>x.type==='stream'&&x.groups.length>1)).toBe(true);
  expect(all.some(x=>x.type==='parallel'&&x.groups.length>1)).toBe(true);
  expect(all.some(x=>x.type==='subgroup')).toBe(true);
 });
});
describe('hard scheduling constraints',()=>{
 it('checks teachers named only inside parallel participants',()=>{
  const parallel=basic({id:'parallel',type:'parallel',teacher:TEACHERS[0],groups:['П-21','П-22'],
   room:'109 + онлайн',mode:'hybrid',participants:[
    {group:'П-21',room:'109',mode:'offline',teacher:TEACHERS[1]},
    {group:'П-22',room:'Онлайн',mode:'online',teacher:TEACHERS[2]}
   ]});
  const independent=basic({id:'independent',groups:['П-23'],room:'112',teacher:TEACHERS[2]});
  expect(validate(independent,[parallel]).some(x=>x.kind==='teacher'&&x.hard&&x.message.includes(TEACHERS[2]))).toBe(true);
  expect(validate(parallel,[independent]).some(x=>x.kind==='teacher'&&x.hard)).toBe(true);
  expect(validate({...independent,teacher:TEACHERS[4]},[parallel]).some(x=>x.kind==='teacher')).toBe(false);
 });
 it('blocks two parallel lessons sharing a teacher through their participants',()=>{
  const a=basic({id:'a',type:'parallel',groups:['П-21'],teacher:TEACHERS[0],room:'109',
   participants:[{group:'П-21',room:'109',mode:'offline',teacher:TEACHERS[2]}]});
  const b=basic({id:'b',type:'parallel',groups:['П-22'],teacher:TEACHERS[1],room:'110',
   participants:[{group:'П-22',room:'110',mode:'offline',teacher:TEACHERS[2]}]});
  expect(validate(a,[b]).some(x=>x.kind==='teacher'&&x.hard)).toBe(true);
 });
 it('blocks a teacher in a second independent simultaneous lesson',()=>{
  const a=basic({id:'a',groups:['П-21']});
  const b=basic({id:'b',groups:['П-22']});
  expect(validate(b,[a]).some(x=>x.kind==='teacher')).toBe(true);
 });
 it('blocks group overlap even with a different teacher and room',()=>{
  const a=basic({id:'a'});
  const b=basic({id:'b',teacher:TEACHERS[1],room:'110'});
  expect(validate(b,[a]).some(x=>x.kind==='group')).toBe(true);
 });
 it('blocks collisions in rooms',()=>{
  const a=basic({id:'a'});
  const b=basic({id:'b',groups:['П-22'],teacher:TEACHERS[1]});
  expect(validate(b,[a]).some(x=>x.kind==='room')).toBe(true);
 });
 it('accepts 28 students with 15 PCs when paired work fits 32 physical seats',()=>{
  const normal=basic({room:'102'});
  expect(validate(normal,[]).filter(x=>x.hard)).toHaveLength(0);
 });
 it('blocks a true physical overflow in the same room',()=>{
  const stream=basic({type:'stream',groups:['П-21','П-22'],room:'102'});
  expect(validate(stream,[]).some(x=>x.kind==='capacity'&&x.hard)).toBe(true);
 });
 it('lets two 14-student computer subgroups use two 15-PC rooms',()=>{
  const split=basic({type:'subgroup',room:'102 / 107'});
  expect(validate(split,[]).filter(x=>x.hard)).toHaveLength(0);
 });
 it('requires placement details when subgroups are scheduled simultaneously',()=>{
  const split=basic({type:'subgroup',room:'102'});
  expect(validate(split,[]).some(x=>x.kind==='capacity')).toBe(true);
 });
 it('rejects an oversized stream',()=>{
  const stream=basic({type:'stream',groups:['П-21','П-22'],room:'102'});
  expect(validate(stream,[]).some(x=>x.kind==='capacity')).toBe(true);
  expect(validate({...stream,room:'101'},[]).filter(x=>x.hard)).toHaveLength(0);
 });
 it('allows an onsite-and-remote parallel but protects two onsite locations',()=>{
  const remote=basic({type:'parallel',groups:['П-21','П-22'],room:'109 + онлайн',mode:'hybrid',
   participants:[{group:'П-21',room:'109',mode:'offline'},{group:'П-22',room:'Онлайн',mode:'online'}]});
  expect(validate(remote,[]).filter(x=>x.hard)).toHaveLength(0);
  const unsafe={...remote,participants:[{group:'П-21',room:'109',mode:'offline' as const},{group:'П-22',room:'110',mode:'offline' as const}],room:'109 / 110',mode:'hybrid' as const};
  expect(validate(unsafe,[]).some(x=>x.kind==='parallel')).toBe(true);
  expect(validate({...unsafe,notes:'сопровождающий сотрудник назначен'},[]).some(x=>x.kind==='parallel')).toBe(false);
 });
 it('does not count combined groups as separate independent appointments',()=>{
  const stream=basic({type:'stream',groups:['П-21','П-22'],room:'101'});
  expect(validate(stream,[stream]).filter(x=>x.hard)).toHaveLength(0);
 });
});
describe('planner suggestions and reports',()=>{
 it('finds only collision-free and adequately sized candidates',()=>{
  const current=buildSeed(1);
  const teacher=TEACHERS[50];
  const candidate=basic({id:'new',teacher,groups:['П-21']});
  const available=findFree(candidate,current);
  for(const option of available)expect(validate({...candidate,...option},current).some(x=>x.hard)).toBe(false);
 });
 it('counts students in a stream once per group',()=>{
  const count=groupCount(['П-21','П-22']);
  expect(count).toBe(GROUPS.find(g=>g.id==='П-21')!.count+GROUPS.find(g=>g.id==='П-22')!.count);
 });
 it('returns actual lessons in exports, not placeholder records',()=>{
  const lessons=buildSeed(1);
  const streamRows=reportRows('Потоки',lessons,10);
  expect(streamRows.length).toBeGreaterThan(1);
  expect(streamRows[0]).toContain('Преподаватель');
  expect(streamRows.slice(1).every(row=>row[7]==='stream')).toBe(true);
 });
});
