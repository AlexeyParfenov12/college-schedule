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
  expect(document.querySelector('.timetable-scroll.move-active')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Перенести'}));
  expect(document.querySelector('.timetable-scroll.move-active')).toBeTruthy();
  expect(document.querySelectorAll('.target-overlay.available').length).toBeGreaterThan(0);
  expect(document.querySelectorAll('.target-overlay.blocked').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button',{name:'Изменить'}));
  expect(screen.getByTestId('smart-lesson-editor')).toBeTruthy();
  expect(screen.getByRole('combobox',{name:'Аудитория занятия'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'Сохранить'})).toBeTruthy();
 },20000);
 it('previews a safe move, confirms it and offers Undo',()=>{
  render(<App/>);
  fireEvent.click(document.querySelectorAll<HTMLButtonElement>('.lesson')[0]);
  fireEvent.click(screen.getByRole('button',{name:'Перенести'}));
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
 it('clicking a scheduled lesson opens a directly accessible delete action',()=>{
  render(<App/>);
  const lesson=document.querySelector<HTMLButtonElement>('.lesson');
  expect(lesson).toBeTruthy();
  fireEvent.click(lesson!);
  expect(screen.getByTestId('lesson-assistant')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Удалить пару'})).toBeTruthy();
 },20000);
 it('right click opens edit, delete and inter-week move actions',()=>{
  render(<App/>);
  const lesson=document.querySelector<HTMLButtonElement>('.lesson')!;
  fireEvent.contextMenu(lesson,{clientX:145,clientY:180});
  expect(screen.getByRole('menu',{name:'Действия с занятием'})).toBeTruthy();
  expect(screen.getByRole('menuitem',{name:'Удалить занятие'})).toBeTruthy();
  fireEvent.click(screen.getByRole('menuitem',{name:'Перенести на другую неделю'}));
  expect(screen.getByRole('dialog',{name:'Перенос занятия на другую неделю'})).toBeTruthy();
  expect(screen.getByRole('combobox',{name:'Целевая неделя'})).toBeTruthy();
 },20000);
 it('keeps existing lessons clickable while another lesson is selected',()=>{
  render(<App/>);
  const first=document.querySelectorAll<HTMLButtonElement>('.lesson');
  fireEvent.click(first[0]);
  fireEvent.click(screen.getByRole('button',{name:'Перенести'}));
  const second=document.querySelectorAll<HTMLButtonElement>('.lesson')[1];
  fireEvent.click(second);
  expect(screen.getByTestId('lesson-assistant')).toBeTruthy();
  expect(document.querySelector('.timetable-scroll.move-active')).toBeNull();
 },20000);
 it('starts availability heatmap on dragStart and clears it when a drag is cancelled',()=>{
  render(<App/>);
  const first=document.querySelector<HTMLButtonElement>('.lesson');
  expect(first).toBeTruthy();
  const key=first!.getAttribute('aria-label')||'';
  const transfer={setData:(_type:string,_value:string)=>{},getData:(_type:string)=>'',effectAllowed:'',dropEffect:''};
  fireEvent.dragStart(first!,{dataTransfer:transfer});
  expect(document.querySelector('.timetable-scroll.move-active.dragging')).toBeTruthy();
  expect(document.querySelectorAll('.slot-cell.slot-available').length).toBeGreaterThan(0);
  expect(document.querySelectorAll('.slot-cell.slot-blocked').length).toBeGreaterThan(0);
  expect(document.querySelectorAll('.drag-cell-indicator.blocked').length).toBeGreaterThan(0);
  expect(screen.getByTestId('drag-guide')).toBeTruthy();
  expect(screen.getByText(/Перемещаем:/)).toBeTruthy();
  fireEvent.dragEnd(first!,{dataTransfer:transfer});
  expect(document.querySelector('.timetable-scroll.dragging')).toBeNull();
  expect(document.querySelector('.timetable-scroll.move-active')).toBeNull();
  expect(screen.queryByTestId('drag-guide')).toBeNull();
  expect(first?.getAttribute('aria-label')).toBe(key);
 },20000);
 it('drops into a green cell with a preview instead of silently moving',()=>{
  render(<App/>);
  const first=document.querySelector<HTMLButtonElement>('.lesson')!;
  let lessonId='';
  const transfer={setData:(_type:string,value:string)=>{lessonId=value},getData:(_type:string)=>lessonId,effectAllowed:'',dropEffect:''};
  fireEvent.dragStart(first,{dataTransfer:transfer});
  const available=document.querySelector<HTMLButtonElement>('.target-overlay.available');
  expect(available).toBeTruthy();
  const cell=available!.closest('.slot-cell');
  expect(cell).toBeTruthy();
  fireEvent.dragEnter(cell!,{dataTransfer:transfer});
  fireEvent.drop(cell!,{dataTransfer:transfer});
  fireEvent.dragEnd(first,{dataTransfer:transfer});
  expect(screen.getByRole('dialog',{name:'Подтверждение переноса'})).toBeTruthy();
  expect(document.querySelector('.timetable-scroll.dragging')).toBeNull();
 },20000);

 it('visibly marks exactly the chosen lesson cell, its day, and its period',()=>{
  render(<App/>);
  const lessons=document.querySelectorAll<HTMLButtonElement>('.lesson');
  expect(lessons.length).toBeGreaterThan(2);
  fireEvent.click(lessons[0]);
  const first=screen.getByTestId('selected-schedule-cell');
  expect(first.classList.contains('selected-slot-cell')).toBe(true);
  expect(first.querySelector('.selected-cell-marker')?.textContent).toContain('Выбрано');
  expect(first.querySelectorAll('.selected-cell-dot')).toHaveLength(1);
  expect(document.querySelectorAll('.grid-head.selected-column-head')).toHaveLength(1);
  expect(document.querySelectorAll('.slot.selected-row-head')).toHaveLength(1);
  fireEvent.click(lessons[1]);
  const second=screen.getByTestId('selected-schedule-cell');
  expect(document.querySelectorAll('.slot-cell.selected-slot-cell')).toHaveLength(1);
  expect(second.querySelector('.lesson.picked')).toBeTruthy();
  fireEvent.click(screen.getByTitle('Закрыть помощник'));
  expect(screen.queryByTestId('selected-schedule-cell')).toBeNull();
  expect(document.querySelector('.grid-head.selected-column-head')).toBeNull();
 },20000);
 it('highlights an empty cell being edited and clears it on cancel',()=>{
  render(<App/>);
  const empty=document.querySelector<HTMLButtonElement>('.empty-slot');
  expect(empty).toBeTruthy();
  fireEvent.click(empty!);
  const highlighted=screen.getByTestId('selected-schedule-cell');
  expect(highlighted.querySelector('.selected-cell-marker')?.textContent).toContain('Выбрано');
  expect(screen.getByTestId('smart-lesson-editor')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Отмена'}));
  expect(screen.queryByTestId('selected-schedule-cell')).toBeNull();
 },20000);
 it('does not confuse selected-cell crosshair with drag-and-drop conflict colors',()=>{
  render(<App/>);
  const lesson=document.querySelector<HTMLButtonElement>('.lesson')!;
  fireEvent.click(lesson);
  expect(screen.getByTestId('selected-schedule-cell')).toBeTruthy();
  const transfer={setData:(_type:string,_value:string)=>{},getData:(_type:string)=>'',effectAllowed:'',dropEffect:''};
  fireEvent.dragStart(lesson,{dataTransfer:transfer});
  expect(document.querySelector('.timetable-scroll.move-active.dragging')).toBeTruthy();
  expect(screen.queryByTestId('selected-schedule-cell')).toBeNull();
  fireEvent.dragEnd(lesson,{dataTransfer:transfer});
  expect(screen.getByTestId('selected-schedule-cell')).toBeTruthy();
 },20000);

 it('navigates from a workflow to the exact shared lesson and highlights it by stable ID',()=>{
  render(<App/>);
  fireEvent.click(within(document.querySelector('aside.nav nav')!).getByRole('button',{name:'Потоки'}));
  const link=screen.getAllByRole('button',{name:'Изменить'})[0];
  expect(link).toBeTruthy();
  fireEvent.click(link);
  expect(screen.getByTestId('selected-schedule-cell')).toBeTruthy();
  const focused=document.querySelector<HTMLButtonElement>('.lesson.jump-focused');
  expect(focused).toBeTruthy();
  expect(focused!.dataset.lessonId).toBeTruthy();
  expect(focused!.classList.contains('picked')).toBe(true);
 },20000);
 it('offers all 53 calendar weeks for inter-week moves',()=>{
  render(<App/>);
  const first=document.querySelector<HTMLButtonElement>('.lesson');
  expect(first).toBeTruthy();
  fireEvent.click(first!);
  fireEvent.click(screen.getByRole('button',{name:'Другая неделя'}));
  const select=screen.getByRole('combobox',{name:'Целевая неделя'}) as HTMLSelectElement;
  expect(select.options).toHaveLength(53);
  fireEvent.change(select,{target:{value:'25'}});
  expect(select.value).toBe('25');
 },20000);

 it('shows groups rather than repeating the selected teacher in teacher timetable cards',()=>{
  render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'Преподаватели'}));
  const lesson=document.querySelector<HTMLButtonElement>('.lesson');
  expect(lesson).toBeTruthy();
  const meta=lesson!.querySelector('small')!;
  expect(meta.textContent).toMatch(/[ПРСЭ]-\d{2}/);
  expect(meta.textContent).not.toContain('Петров М. С.');
 },20000);

 it('opens the complete mobile menu and keeps the bottom quick navigation in sync',()=>{
  render(<App/>);
  const bottom=within(screen.getByRole('navigation',{name:'Быстрые разделы'}));
  expect(bottom.getByRole('button',{name:'Расписание'}).getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('button',{name:'Открыть мобильное меню'}));
  expect(document.querySelector('aside.nav.mobile-open')).toBeTruthy();
  fireEvent.click(within(document.querySelector('aside.nav nav')!).getByRole('button',{name:'Учебный календарь'}));
  expect(document.querySelector('aside.nav.mobile-open')).toBeNull();
  expect(screen.getByRole('heading',{name:'Учебный календарь'})).toBeTruthy();
  fireEvent.click(bottom.getByRole('button',{name:'Расписание'}));
  expect(screen.getByRole('heading',{name:'Расписание'})).toBeTruthy();
  expect(bottom.getByRole('button',{name:'Расписание'}).getAttribute('aria-current')).toBe('page');
 },20000);
 it('uses a mobile lesson sheet and releases safe slots during touch move mode',()=>{
  render(<App/>);
  const agenda=screen.getByRole('region',{name:'Расписание на телефоне'});
  fireEvent.click(within(agenda).getAllByRole('button',{name:/Математика/})[0]);
  expect(document.querySelector('.mobile-editor-backdrop')).toBeTruthy();
  expect(document.querySelector('.right-editor.mobile-move-collapsed')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Перенести'}));
  expect(document.querySelector('.right-editor.mobile-move-collapsed')).toBeTruthy();
  expect(document.querySelector('.mobile-editor-backdrop')).toBeNull();
  expect(agenda.querySelector('.mobile-move-target.available')).toBeTruthy();
  fireEvent.click(within(agenda).getByRole('button',{name:'Отмена'}));
  expect(document.querySelector('.mobile-editor-backdrop')).toBeTruthy();
 },20000);

});
