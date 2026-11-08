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
