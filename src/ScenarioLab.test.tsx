// @vitest-environment jsdom
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {TEACHERS} from './data';
import type {Lesson} from './data';
import type {ScenarioInput,ScenarioVariant} from './scenarioEngine';
import ScenarioLab from './ScenarioLab';

const example:Lesson={
 id:'close-room',week:10,day:0,slot:1,teacher:TEACHERS[0],
 groups:['П-21'],room:'109',subject:'Математика',mode:'offline',
 type:'regular',status:'scheduled',hours:2
};
beforeEach(()=>{
 localStorage.clear();
 localStorage.setItem('college-schedule-extras-v2',JSON.stringify({
  calendar:[],absences:[],rooms:{},practiceAssignments:[]
 }));
});
afterEach(()=>{cleanup();vi.restoreAllMocks()});
describe('isolated scenario review and confirmation',()=>{
 it('shows proposed differences without changing the existing schedule',()=>{
  const approve=vi.fn((_variant:ScenarioVariant,_input:ScenarioInput)=>true);
  const original=JSON.stringify(example);
  render(<ScenarioLab lessons={[example]} week={10} days={6} onApply={approve} notify={vi.fn()}/>);
  expect(screen.getByTestId('scenario-lab')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Рассчитать сценарии'}));
  expect(screen.getByRole('region',{name:'Сравнение сценариев'})).toBeTruthy();
  expect(approve).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:/Показать все изменения/}));
  expect(screen.getByRole('region',{name:'Предпросмотр пакета изменений'})).toBeTruthy();
  expect(screen.getByText(/Было: /)).toBeTruthy();
  expect(JSON.stringify(example)).toBe(original);
 });
 it('requires explicit confirmation and applies only to the draft callback',()=>{
  const approve=vi.fn((_v:ScenarioVariant,_i:ScenarioInput)=>true);
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
  render(<ScenarioLab lessons={[example]} week={10} days={6} onApply={approve} notify={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Рассчитать сценарии'}));
  expect(approve).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Применить пакет к черновику'}));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(approve).toHaveBeenCalledTimes(1);
  expect(approve.mock.calls[0][0].changes).toHaveLength(1);
  expect(approve.mock.calls[0][1].kind).toBe('room');
  expect(screen.getByText(/Пакет применён к черновику/)).toBeTruthy();
 });
 it('blocks partial scenarios that include held lessons',()=>{
  const approve=vi.fn((_v:ScenarioVariant,_i:ScenarioInput)=>true);
  render(<ScenarioLab lessons={[{...example,status:'held'}]} week={10} days={6}
   onApply={approve} notify={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Рассчитать сценарии'}));
  expect((screen.getByRole('button',{name:'Применить пакет к черновику'}) as HTMLButtonElement).disabled).toBe(true);
  expect(approve).not.toHaveBeenCalled();
 });
 it('discards previews when changing scenario inputs',()=>{
  const approve=vi.fn((_v:ScenarioVariant,_i:ScenarioInput)=>true);
  render(<ScenarioLab lessons={[example]} week={10} days={6} onApply={approve} notify={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Рассчитать сценарии'}));
  fireEvent.change(screen.getByLabelText('Начало периода'),{target:{value:'1'}});
  expect(screen.queryByRole('region',{name:'Сравнение сценариев'})).toBeNull();
  expect(approve).not.toHaveBeenCalled();
 });
});
