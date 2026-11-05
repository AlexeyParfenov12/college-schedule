// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { NAV } from './data';

beforeEach(()=>{localStorage.clear()});
afterEach(()=>cleanup());

describe('React interface smoke checks',()=>{
 it('renders the compact timetable and exposes all 18 main sections',()=>{
  render(<App/>);
  expect(screen.getByRole('heading',{name:'Расписание'})).toBeTruthy();
  const nav=within(document.querySelector('aside.nav nav')!);
  for(const [,label] of NAV){
   expect(nav.getByRole('button',{name:label})).toBeTruthy();
  }
  expect(document.querySelector('.timetable')).toBeTruthy();
 },15000);
 it('navigates all functional screens without rendering errors',()=>{
  render(<App/>);
  const nav=within(document.querySelector('aside.nav nav')!);
  for(const [key,label] of NAV){
   fireEvent.click(nav.getByRole('button',{name:label}));
   expect(document.querySelector('.workspace')?.textContent?.length).toBeGreaterThan(30);
   expect(screen.getByRole('heading',{name:label})).toBeTruthy();
   if(key==='streams') expect(screen.getByText('Конструктор потока')).toBeTruthy();
   if(key==='parallels') expect(screen.getByText('Конструктор параллели')).toBeTruthy();
   if(key==='groups') expect(screen.getByText('Состав студентов — ручное распределение')).toBeTruthy();
  }
 },30000);
 it('opens the contextual assistant, paints a move map and keeps the full editor optional',()=>{
  render(<App/>);
  expect(document.querySelectorAll('.lesson').length).toBeGreaterThan(5);
  fireEvent.click(document.querySelectorAll<HTMLButtonElement>('.lesson')[0]);
  expect(screen.getByTestId('lesson-assistant')).toBeTruthy();
  expect(document.querySelector('.timetable-scroll.move-active')).toBeTruthy();
  expect(document.querySelectorAll('.target-overlay.available').length).toBeGreaterThan(0);
  expect(document.querySelectorAll('.target-overlay.blocked').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button',{name:'Все поля'}));
  expect(screen.getByText('Редактирование')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Сохранить'})).toBeTruthy();
 },20000);
 it('previews a safe move, confirms it and offers Undo',()=>{
  render(<App/>);
  fireEvent.click(document.querySelectorAll<HTMLButtonElement>('.lesson')[0]);
  const candidate=document.querySelector<HTMLButtonElement>('.target-overlay.available');
  expect(candidate).toBeTruthy();
  fireEvent.click(candidate!);
  expect(screen.getByRole('dialog',{name:'Подтверждение переноса'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Сохранить перенос'}));
  expect(screen.queryByRole('dialog',{name:'Подтверждение переноса'})).toBeNull();
  expect(screen.getByRole('button',{name:'Отменить'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Отменить'}));
  expect(screen.queryByRole('button',{name:'Отменить'})).toBeNull();
 },20000);
 it('paginates long academic lists rather than growing an endless page',()=>{
  render(<App/>);
  const nav=within(document.querySelector('aside.nav nav')!);
  fireEvent.click(nav.getByRole('button',{name:'Академические данные'}));
  expect(screen.getAllByLabelText('Строк на странице').length).toBeGreaterThan(0);
  const next=screen.getByRole('button',{name:'Следующая страница таблицы'});
  fireEvent.click(next);
  expect(screen.getAllByText(/13–24 из/).length).toBeGreaterThan(0);
 },15000);
});
