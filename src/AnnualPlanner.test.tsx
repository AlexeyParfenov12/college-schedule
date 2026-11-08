// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import App from './App';

beforeEach(()=>localStorage.clear());afterEach(()=>cleanup());
const open=()=>{render(<App/>);const nav=within(document.querySelector('aside.nav nav')!);fireEvent.click(nav.getByRole('button',{name:'Планирование'}))};
describe('Annual scheduler navigation and KUG practice',()=>{
 it('shows the large annual wizard with constraints and variants',()=>{
  open();
  expect(screen.getByTestId('year-planner')).toBeTruthy();
  expect(screen.getByRole('tab',{name:'Преподаватели'})).toBeTruthy();
  expect(screen.queryByRole('tab',{name:'Практика'})).toBeNull();
  expect(screen.getByText(/Практика из КУГ/)).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Закрепить практику'})).toBeNull();
  expect(screen.getByRole('tab',{name:'4 варианта'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'Рассчитать 4 варианта'})).toBeTruthy();
 },20000);
 it('allows filtering working rooms and setting teacher unavailability in other steps',()=>{
  open();
  fireEvent.click(screen.getByRole('tab',{name:'Преподаватели'}));
  expect(screen.getByRole('textbox',{name:'Поиск преподавателя для правил'})).toBeTruthy();
  expect(screen.getByText('Запретить отдельные пары')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab',{name:'Кабинеты'}));
  expect(screen.getByRole('textbox',{name:'Найти аудиторию для годового плана'})).toBeTruthy();
 },20000);
 it('reads semester workloads from the independent demo Academic Core adapter instead of editable timetable-derived inputs',()=>{
  open();
  expect(screen.getByText(/Демонстрационные учебные планы и назначения преподавателей заданы отдельно/)).toBeTruthy();
  expect(screen.getByText(/Период определяется автоматически/)).toBeTruthy();
  expect(screen.queryByRole('spinbutton',{name:/Пар за год/})).toBeNull();
  expect(screen.getByText(/учебных недель у группы/)).toBeTruthy();
  const table=document.querySelector('.year-table-scroll table')!;
  expect(table.textContent).toContain('Осень, ч');
  expect(table.textContent).toContain('Весна, ч');
  expect(table.textContent).toContain('Всего, ч');
 },20000);

 it('applies rules to the whole college and visibly inherits them for a specific group',()=>{
  open();
  fireEvent.click(screen.getByRole('tab',{name:'Правила групп'}));
  expect(screen.getByRole('combobox',{name:'Уровень правил'})).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox',{name:'Максимум пар группы'}),{target:{value:'2'}});
  let saved=JSON.parse(localStorage.getItem('college-year-preferences-v3')!);
  expect(saved.collegeRules.maxPairsPerDay).toBe(2);
  const tuesday=document.querySelector<HTMLLabelElement>('.year-cols .year-day-choices label:nth-child(2)')!;
  fireEvent.click(tuesday.querySelector('input')!);
  saved=JSON.parse(localStorage.getItem('college-year-preferences-v3')!);
  expect(saved.collegeRules.daysOff).toContain(1);
  fireEvent.change(screen.getByRole('combobox',{name:'Уровень правил'}),{target:{value:'group'}});
  const lockedTuesday=document.querySelector<HTMLInputElement>('.year-cols .year-day-choices label:nth-child(2) input')!;
  expect(lockedTuesday.checked).toBe(true);
  expect(lockedTuesday.disabled).toBe(true);
  expect(screen.getByText(/Лимит группы: 2 пар\/день/)).toBeTruthy();
 },20000);

 it('honors the six-day college setting even if a previous annual draft saved five days',()=>{
  localStorage.setItem('college-schedule-workweek-v1','6');
  localStorage.setItem('college-year-preferences-v3',JSON.stringify({days:5}));
  open();
  expect(screen.getByText('Пн–Сб · шестидневка')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab',{name:'Преподаватели'}));
  const choices=document.querySelectorAll('.year-card .year-day-choices');
  expect(choices.length).toBe(2);
  expect(choices[0].querySelectorAll('label')).toHaveLength(6);
  expect(choices[0].textContent).toContain('Сб');
  expect(choices[1].querySelectorAll('label')).toHaveLength(6);
  fireEvent.click(screen.getByRole('tab',{name:'Правила групп'}));
  expect(document.querySelectorAll('.year-card .year-day-choices label')).toHaveLength(6);
 },20000);

});