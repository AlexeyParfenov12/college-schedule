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
  expect(screen.getByText(/Автосоставление — сначала предложение/)).toBeTruthy();
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
  expect(screen.getByRole('combobox',{name:'Учебное назначение'})).toBeTruthy();
  expect(screen.getByRole('combobox',{name:'Аудитория занятия'})).toBeTruthy();
  expect(document.querySelector('input[placeholder="405 / онлайн"]')).toBeNull();
 },20000);
});
