// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { NAV } from './data';

beforeEach(()=>{localStorage.clear()});
afterEach(()=>cleanup());

describe('React interface smoke checks',()=>{
 it('renders the compact timetable and exposes all 18 main sections',()=>{
  render(<App/>);
  expect(screen.getByRole('heading',{name:'Расписание'})).toBeTruthy();
  for(const [,label] of NAV){
   expect(screen.getByRole('button',{name:label})).toBeTruthy();
  }
  expect(document.querySelector('.timetable')).toBeTruthy();
 },15000);
 it('navigates all functional screens without rendering errors',()=>{
  render(<App/>);
  for(const [key,label] of NAV){
   fireEvent.click(screen.getByRole('button',{name:label}));
   expect(document.querySelector('.workspace')?.textContent?.length).toBeGreaterThan(30);
   expect(screen.getByRole('heading',{name:label})).toBeTruthy();
   if(key==='streams') expect(screen.getByText('Конструктор потока')).toBeTruthy();
   if(key==='parallels') expect(screen.getByText('Конструктор параллели')).toBeTruthy();
   if(key==='groups') expect(screen.getByText('Состав студентов — ручное распределение')).toBeTruthy();
  }
 },30000);
 it('shows live scenario screen and manual conflict controls',()=>{
  render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'Расписание'}));
  expect(document.querySelectorAll('.lesson').length).toBeGreaterThan(5);
  const lessons=document.querySelectorAll<HTMLButtonElement>('.lesson');
  fireEvent.click(lessons[0]);
  expect(screen.getByText('Редактирование')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Сохранить'})).toBeTruthy();
 },20000);
});
