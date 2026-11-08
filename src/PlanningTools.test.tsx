// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

beforeEach(()=>{localStorage.clear()});
afterEach(()=>cleanup());
const navigation=(name:string)=>{
 const nav=within(document.querySelector('aside.nav nav')!);
 const nested:Record<string,{parent:string;label:string}>={
  'Шаблоны':{parent:'Расписание',label:'Шаблоны расписания'},
  'Автосоставление':{parent:'Планирование',label:'Автосоставление на неделю'},
  'Аудитории':{parent:'Справочники',label:'Аудитории'}
 };
 const tool=nested[name];
 if(tool){
  const expand=nav.queryByRole('button',{name:'Развернуть '+tool.parent});
  if(expand)fireEvent.click(expand);
  fireEvent.click(nav.getByRole('button',{name:tool.label}));
 }else fireEvent.click(nav.getByRole('button',{name}));
};

describe('visual guided planning workflows',()=>{
 it('shows one KUG editor with official holidays embedded instead of the old production-calendar block',()=>{
  render(<App/>);
  navigation('Учебный календарь');
  expect(screen.getByTestId('calendar-studio')).toBeTruthy();
  expect(screen.getByTestId('calendar-matrix')).toBeTruthy();
  expect(screen.queryByText('Расширенный редактор и производственный календарь')).toBeNull();
  expect(screen.getByText('Перенос выходного')).toBeTruthy();
  const week=document.querySelector<HTMLButtonElement>('[aria-label^="П-21, неделя 10:"]');
  expect(week).toBeTruthy();
  fireEvent.click(week!);
  const detail=screen.getByRole('region',{name:'Дни выбранной недели'});
  expect(within(detail).getByText('День народного единства')).toBeTruthy();
  expect(within(detail).getByText('Государственный праздник')).toBeTruthy();
 },20000);
 it('shows a saved template cycle and a before/after grid',()=>{
  render(<App/>);
  navigation('Шаблоны');
  expect(screen.getByTestId('template-studio')).toBeTruthy();
  expect(screen.getByText('Сохранённые циклы')).toBeTruthy();
  expect(screen.getAllByTestId('mini-schedule').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByRole('button',{name:'Рассчитать изменения'})).toBeTruthy();
 },20000);
 it('explains auto-placement visually before accepting changes',()=>{
  render(<App/>);
  navigation('Автосоставление');
  expect(screen.getByTestId('generator-studio')).toBeTruthy();
  expect(screen.getByText(/Помощник размещения занятий/)).toBeTruthy();
  expect(screen.getByText(/Число рассчитывается автоматически/)).toBeTruthy();
  expect(screen.getByTestId('mini-schedule')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Показать предложенный вариант'})).toBeTruthy();
 },20000);
 it('adds a mini-week and workload chart to non-schedule pages',()=>{
  render(<App/>);
  navigation('Аудитории');
  expect(screen.getByTestId('mini-schedule')).toBeTruthy();
  expect(screen.getByTestId('load-bars')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Свернуть/}));
  expect(screen.queryByTestId('mini-schedule')).toBeNull();
 },20000);
 it('opens a guided editor with teacher assignment and selectable room',()=>{
  render(<App/>);
  const day=document.querySelector<HTMLButtonElement>('.empty-slot');
  expect(day).toBeTruthy();
  fireEvent.click(day!);
  expect(screen.getByTestId('smart-lesson-editor')).toBeTruthy();
  expect(screen.getByRole('combobox',{name:'Преподаватель занятия'})).toBeTruthy();
  expect(screen.getByRole('combobox',{name:'Дисциплина занятия'})).toBeTruthy();
  expect(screen.queryByRole('combobox',{name:'Группа занятия'})).toBeNull();
  expect(screen.getByText(/Расписание группы/)).toBeTruthy();
  const teacherSelect=screen.getByRole('combobox',{name:'Преподаватель занятия'}) as HTMLSelectElement;
  const firstTeacher=Array.from(teacherSelect.options).find(o=>o.value);
  expect(firstTeacher).toBeTruthy();
  fireEvent.change(teacherSelect,{target:{value:firstTeacher!.value}});
  const subjectSelect=screen.getByRole('combobox',{name:'Дисциплина занятия'}) as HTMLSelectElement;
  expect(subjectSelect.disabled).toBe(false);
  const firstSubject=Array.from(subjectSelect.options).find(o=>o.value);
  expect(firstSubject).toBeTruthy();
  fireEvent.change(subjectSelect,{target:{value:firstSubject!.value}});
  expect(screen.getByRole('combobox',{name:'Аудитория занятия'})).toBeTruthy();
 },20000);
 it('keeps the selected teacher fixed in teacher view and asks for group then subject',()=>{
  render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'Преподаватели'}));
  const empty=document.querySelector<HTMLButtonElement>('.empty-slot');
  expect(empty).toBeTruthy();
  fireEvent.click(empty!);
  expect(screen.getByTestId('smart-lesson-editor')).toBeTruthy();
  expect(screen.queryByRole('combobox',{name:'Преподаватель занятия'})).toBeNull();
  expect(screen.getByRole('combobox',{name:'Группа занятия'})).toBeTruthy();
  expect(screen.getByRole('combobox',{name:'Дисциплина занятия'})).toBeTruthy();
 },20000);
 it('assigns a period to two groups directly from the weekly matrix',()=>{
  render(<App/>);
  navigation('Учебный календарь');
  const week=document.querySelector<HTMLButtonElement>('[aria-label^="П-21, неделя 1:"]');
  expect(week).toBeTruthy();
  fireEvent.click(week!);
  fireEvent.click(screen.getByRole('checkbox',{name:'Выбрать группу П-22'}));
  const end=document.querySelector<HTMLButtonElement>('[aria-label^="П-21, неделя 3:"]');
  fireEvent.click(end!,{shiftKey:true});
  expect(screen.getByText(/Выбрано групп: 2/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Рассчитать изменения'}));
  expect(screen.getByText(/для 2 групп/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Подтвердить и сохранить'}));
  expect(screen.getByText(/Сохранено: 2 групп/)).toBeTruthy();
 },20000);
 it('can assign vacation to all visible department groups with exact dates',()=>{
  render(<App/>);
  navigation('Учебный календарь');
  fireEvent.change(screen.getByRole('combobox',{name:'Отделение КУГ'}),{target:{value:'ИТ'}});
  fireEvent.click(screen.getByRole('button',{name:/Выбрать все видимые/}));
  const first=document.querySelector<HTMLButtonElement>('[aria-label^="П-21, неделя 1:"]');
  fireEvent.click(first!);
  fireEvent.change(screen.getByLabelText('Вид периода КУГ'),{target:{value:'vacation'}});
  fireEvent.change(screen.getByLabelText('Точная дата начала периода'),{target:{value:'2027-07-05'}});
  fireEvent.change(screen.getByLabelText('Точная дата окончания периода'),{target:{value:'2027-07-18'}});
  fireEvent.click(screen.getByRole('button',{name:'Рассчитать изменения'}));
  expect(screen.getAllByText(/2027-07-05 — 2027-07-18/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button',{name:'Подтвердить и сохранить'}));
  expect(screen.getByText(/Сохранено: 12 групп/)).toBeTruthy();
 },20000);

});
