// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

beforeEach(()=>{localStorage.clear()});
afterEach(()=>cleanup());
const navigation=(name:string)=>{fireEvent.click(within(document.querySelector('aside.nav nav')!).getByRole('button',{name}))};

describe('visual guided planning workflows',()=>{
 it('shows the semester timeline and a preview of calendar impact',()=>{
  render(<App/>);
  navigation('Учебный календарь');
  expect(screen.getByTestId('calendar-studio')).toBeTruthy();
  expect(screen.getByTestId('academic-timeline')).toBeTruthy();
  expect(screen.getByText(/Учебный календарь — когда колледж учится/)).toBeTruthy();
  expect(screen.getByText(/В этот период уже поставлено/)).toBeTruthy();
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
 it('can assign one academic period to several selected groups without creating duplicate calendars',()=>{
  render(<App/>);
  navigation('Учебный календарь');
  expect(screen.getByRole('combobox',{name:'Просмотр календаря группы'})).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox',{name:'Тип периода'}),{target:{value:'study'}});
  fireEvent.change(screen.getByRole('combobox',{name:'На кого действует'}),{target:{value:'custom'}});
  const groupLabels=[...document.querySelectorAll<HTMLLabelElement>('.plan-calendar-group-list label')];
  const second=groupLabels.find(x=>x.textContent?.includes('П-22'));
  expect(second).toBeTruthy();
  fireEvent.click(second!.querySelector('input')!);
  expect(screen.getByText('Выбрано групп: 2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Сохранить учебный период'}));
  expect(screen.getByText(/П-21, П-22/)).toBeTruthy();
 },20000);

});
