// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import App from './App';

beforeEach(()=>localStorage.clear());afterEach(()=>cleanup());
const open=()=>{render(<App/>);const nav=within(document.querySelector('aside.nav nav')!);fireEvent.click(nav.getByRole('button',{name:'Годовой планировщик'}))};
describe('Annual scheduler navigation and group practices',()=>{
 it('shows the large annual wizard with constraints and variants',()=>{
  open();
  expect(screen.getByTestId('year-planner')).toBeTruthy();
  expect(screen.getByRole('tab',{name:'Преподаватели'})).toBeTruthy();
  expect(screen.getByRole('tab',{name:'Практика'})).toBeTruthy();
  expect(screen.getByRole('tab',{name:'4 варианта'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'Рассчитать 4 варианта'})).toBeTruthy();
 },20000);
 it('books a practice for consecutive weeks and displays its classroom and duration',()=>{
  open();
  fireEvent.click(screen.getByRole('tab',{name:'Практика'}));
  expect(screen.getByText(/Непрерывная практика/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Закрепить практику'}));
  expect(screen.getByRole('button',{name:'Удалить практику П-21'})).toBeTruthy();
  expect(screen.getByText(/Каб. 109/)).toBeTruthy();
  expect(screen.getByText(/недели 6–7/)).toBeTruthy();
 },20000);
 it('allows filtering working rooms and setting teacher unavailability in other steps',()=>{
  open();
  fireEvent.click(screen.getByRole('tab',{name:'Преподаватели'}));
  expect(screen.getByRole('textbox',{name:'Поиск преподавателя для правил'})).toBeTruthy();
  expect(screen.getByText('Запретить отдельные пары')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab',{name:'Кабинеты'}));
  expect(screen.getByRole('textbox',{name:'Найти аудиторию для годового плана'})).toBeTruthy();
 },20000);
});