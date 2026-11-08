// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CalendarMatrix from './CalendarMatrix';
import { CALENDAR } from './data';
import type { CalendarEvent } from './data';
import { phaseAt } from './calendarMatrixDomain';

afterEach(()=>cleanup());
describe('KUG annual matrix: user interaction',()=>{
 it('previews and applies a multi-group weekly range, then undoes the operation',()=>{
  const replace=vi.fn<(events:CalendarEvent[])=>void>();
  const {container}=render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={replace}/>);
  const choose=(week:number,shift=false)=>{
   const button=container.querySelector<HTMLButtonElement>('[aria-label^="П-21, неделя '+week+':"]');
   expect(button).not.toBeNull();
   fireEvent.click(button!,{shiftKey:shift});
  };
  choose(1);
  fireEvent.click(screen.getByRole('checkbox',{name:'Выбрать группу П-22'}));
  choose(3,true);
  expect(screen.getByText(/2 групп · Недели 1–3/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Рассчитать изменения'}));
  expect(replace).not.toHaveBeenCalled();
  expect(screen.getByText(/Период «Учебная практика» для 2 групп/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Подтвердить и сохранить'}));
  expect(replace).toHaveBeenCalledTimes(1);
  const updated=replace.mock.calls[0][0];
  expect(phaseAt(updated,'П-21','2026-09-15')).toBe('training');
  expect(phaseAt(updated,'П-22','2026-09-15')).toBe('training');
  fireEvent.click(screen.getByRole('button',{name:'Отменить'}));
  expect(replace).toHaveBeenCalledTimes(2);
  expect(replace.mock.calls[1][0]).toEqual(CALENDAR);
 },30000);
});

describe('KUG exact dates and bulk selection',()=>{
 it('can edit a partial week without changing neighbouring dates',()=>{
  const replace=vi.fn<(events:CalendarEvent[])=>void>();
  const {container}=render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={replace}/>);
  fireEvent.click(container.querySelector<HTMLButtonElement>('[aria-label^="П-21, неделя 1:"]')!);
  fireEvent.change(screen.getByLabelText('Точная дата начала периода'),{target:{value:'2026-09-02'}});
  fireEvent.change(screen.getByLabelText('Точная дата окончания периода'),{target:{value:'2026-09-03'}});
  fireEvent.click(screen.getByRole('button',{name:'Рассчитать изменения'}));
  fireEvent.click(screen.getByRole('button',{name:'Подтвердить и сохранить'}));
  const result=replace.mock.calls[0][0];
  expect(phaseAt(result,'П-21','2026-09-01')).toBe('study');
  expect(phaseAt(result,'П-21','2026-09-02')).toBe('training');
  expect(phaseAt(result,'П-21','2026-09-03')).toBe('training');
  expect(phaseAt(result,'П-21','2026-09-04')).toBe('study');
 },20000);
 it('selects all visible filtered groups in one action and allows clearing selection',()=>{
  render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={()=>{}}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Курс КУГ'}),{target:{value:'2'}});
  const bulk=screen.getByRole('button',{name:/Выбрать все видимые/});
  fireEvent.click(bulk);
  expect(screen.getByText('Выбрано групп: 10')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Снять выбор'}));
  expect(screen.getByText('Выбрано групп: 0')).toBeTruthy();
 });
});
