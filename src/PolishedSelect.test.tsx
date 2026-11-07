// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import PolishedSelect from './PolishedSelect';
import App from './App';

afterEach(()=>cleanup());
function Controlled(){
 const [value,setValue]=useState('П-21');
 return <PolishedSelect aria-label="Учебная группа" value={value} onChange={e=>setValue(e.target.value)}>
  <option value="П-21">П-21</option><option value="П-22">П-22</option>
  <option value="Р-21" disabled>Р-21 · недоступно</option>
 </PolishedSelect>;
}
describe('polished popup for existing select controls',()=>{
 it('opens a real styled option list, selects an item and retains native combobox semantics',()=>{
  render(<Controlled/>);
  expect(screen.getByRole('combobox',{name:'Учебная группа'})).toHaveProperty('value','П-21');
  fireEvent.click(document.querySelector('.polished-select-hitbox')!);
  expect(screen.getByRole('listbox',{name:/Варианты:/})).toBeTruthy();
  expect(within(screen.getByRole('listbox')).getByRole('option',{name:'П-21'}).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option',{name:'П-22'}));
  expect((screen.getByRole('combobox',{name:'Учебная группа'}) as HTMLSelectElement).value).toBe('П-22');
  expect(screen.queryByRole('listbox')).toBeNull();
 });
 it('does not allow selecting a disabled value',()=>{
  render(<Controlled/>);
  fireEvent.click(document.querySelector('.polished-select-hitbox')!);
  expect(within(screen.getByRole('listbox')).getByRole('option',{name:/недоступно/})).toHaveProperty('disabled',true);
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option',{name:/недоступно/}));
  expect((screen.getByRole('combobox',{name:'Учебная группа'}) as HTMLSelectElement).value).toBe('П-21');
 });
 it('supports keyboard arrow navigation, Enter and Escape',()=>{
  render(<Controlled/>);
  const select=screen.getByRole('combobox',{name:'Учебная группа'});
  fireEvent.keyDown(select,{key:'ArrowDown'});
  expect(screen.getByRole('listbox')).toBeTruthy();
  fireEvent.keyDown(select,{key:'ArrowDown'});
  fireEvent.keyDown(select,{key:'Enter'});
  expect((select as HTMLSelectElement).value).toBe('П-22');
  fireEvent.keyDown(select,{key:'ArrowDown'});
  fireEvent.keyDown(select,{key:'Escape'});
  expect(screen.queryByRole('listbox')).toBeNull();
 });
 it('filters long option lists in the actual open panel',()=>{
  const onChange=vi.fn();
  render(<PolishedSelect aria-label="Учебный преподаватель" value="Вариант 1" onChange={onChange}>
   {Array.from({length:22},(_,i)=><option key={i} value={'Вариант '+(i+1)}>{'Вариант '+(i+1)}</option>)}
  </PolishedSelect>);
  fireEvent.click(document.querySelector('.polished-select-hitbox')!);
  fireEvent.change(screen.getByRole('searchbox',{name:/Поиск:/}),{target:{value:'Вариант 17'}});
  expect(within(screen.getByRole('listbox')).getByRole('option',{name:'Вариант 17'})).toBeTruthy();
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option',{name:'Вариант 17'}));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].target.value).toBe('Вариант 17');
 });
 it('keeps legacy native change events usable by existing forms and automated checks',()=>{
  render(<Controlled/>);
  const select=screen.getByRole('combobox',{name:'Учебная группа'}) as HTMLSelectElement;
  fireEvent.change(select,{target:{value:'П-22'}});
  expect(select.value).toBe('П-22');
 });
});
describe('schedule entity dropdown replaces long sidebar at all breakpoints',()=>{
 it('switches group, then teacher, then classroom using the same list picker',()=>{
  localStorage.clear();
  render(<App/>);
  expect(document.querySelector('.group-sidebar.schedule-picker-strip')).toBeTruthy();
  const picker=screen.getByRole('combobox',{name:'Выбрать группу'});
  expect((picker as HTMLSelectElement).value).toBe('П-21');
  fireEvent.click(document.querySelector('.schedule-picker-field .polished-select-hitbox')!);
  fireEvent.change(screen.getByRole('searchbox',{name:/Поиск:/}),{target:{value:'П-22'}});
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option',{name:'П-22'}));
  expect((screen.getByRole('combobox',{name:'Выбрать группу'}) as HTMLSelectElement).value).toBe('П-22');
  expect(document.querySelector('.table-heading b')?.textContent).toBe('П-22');
  fireEvent.click(screen.getByRole('button',{name:'Преподаватели'}));
  expect(screen.getByRole('combobox',{name:'Выбрать преподавателя'})).toBeTruthy();
  fireEvent.click(within(document.querySelector('.toolbar')!).getByRole('button',{name:'Аудитории'}));
  expect(screen.getByRole('combobox',{name:'Выбрать аудиторию'})).toBeTruthy();
 },20000);
});
