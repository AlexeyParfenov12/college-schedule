// @vitest-environment jsdom
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {TEACHERS} from './data';
import type {Lesson} from './data';
import DecisionCenter from './DecisionCenter';

const classInClosedRoom:Lesson={
 id:'room-demo',week:10,day:0,slot:1,subject:'Математика',teacher:TEACHERS[0],
 groups:['П-21'],room:'109',mode:'offline',type:'regular',status:'scheduled',hours:2
};
beforeEach(()=>{
 localStorage.clear();
 localStorage.setItem('college-schedule-extras-v2',JSON.stringify({
  absences:[],calendar:[],rooms:{'109':{blocked:true,reason:'Ремонт'}}
 }));
});
afterEach(()=>{cleanup();vi.restoreAllMocks()});
describe('separate decision center UI',()=>{
 it('does not alter timetable merely by opening issues or previewing proposals',()=>{
  const apply=vi.fn(()=>true),go=vi.fn(),notify=vi.fn();
  const original=JSON.stringify(classInClosedRoom);
  render(<DecisionCenter lessons={[classInClosedRoom]} week={10} days={6}
   onNavigate={go} onApply={apply} notify={notify}/>);
  expect(screen.getByTestId('decision-center')).toBeTruthy();
  expect(screen.getByText('Недоступен кабинет 109')).toBeTruthy();
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Проверить доступные решения'}));
  const option=screen.getAllByRole('button',{name:'Предпросмотр'})[0];
  fireEvent.click(option);
  expect(screen.getByRole('region',{name:'Предпросмотр решения'})).toBeTruthy();
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Отмена'}));
  expect(screen.queryByRole('region',{name:'Предпросмотр решения'})).toBeNull();
  expect(JSON.stringify(classInClosedRoom)).toBe(original);
 });
 it('requires a separate confirm before emitting a single draft change',()=>{
  const apply=vi.fn(()=>true);
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
  render(<DecisionCenter lessons={[classInClosedRoom]} week={10} days={6}
   onNavigate={vi.fn()} onApply={apply} notify={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Проверить доступные решения'}));
  fireEvent.click(screen.getAllByRole('button',{name:'Предпросмотр'})[0]);
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Применить к черновику'}));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply.mock.calls[0][0].source.id).toBe('room-demo');
  expect(apply.mock.calls[0][0].after.room).not.toBe('109');
 });
 it('can navigate to the responsible existing section for a problem',()=>{
  const go=vi.fn();
  render(<DecisionCenter lessons={[classInClosedRoom]} week={10} days={6}
   onNavigate={go} onApply={vi.fn(()=>true)} notify={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Открыть аудитории'}));
  expect(go).toHaveBeenCalledWith('resources');
 });
});
