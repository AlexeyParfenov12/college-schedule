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
  // Filter to the target row before editing, just as a dispatcher would for a single-group correction.
  fireEvent.change(screen.getByLabelText('Поиск группы КУГ'),{target:{value:'П-21'}});
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

describe('integrated KUG production calendar display',()=>{
 it('shows seven day markers in a selected week with explicit holiday details',()=>{
  const {container}=render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={()=>{}}/>);
  const button=container.querySelector<HTMLButtonElement>('[aria-label^="П-21, неделя 10:"]');
  expect(button).not.toBeNull();
  // Federal holidays are rendered once above the groups, not repeated in every group/week cell.
  expect(button!.querySelectorAll('.kug-day-dot')).toHaveLength(0);
  const official=container.querySelector<HTMLButtonElement>('[aria-label="Производственный календарь, неделя 10"]');
  expect(official).not.toBeNull();
  expect(official!.querySelectorAll('.kug-day-dot')).toHaveLength(7);
  fireEvent.click(button!);
  const detail=screen.getByRole('region',{name:'Дни выбранной недели'});
  expect(detail.textContent).toContain('День народного единства');
  expect(detail.querySelectorAll('.kug-detail-day')).toHaveLength(7);
 });
});


describe('compact KUG navigation, progressive disclosure and density',()=>{
 it('uses the full 53-week matrix and keeps holidays in one common row',()=>{
  const {container}=render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={()=>{}}/>);
  const weeks=container.querySelectorAll<HTMLButtonElement>('[aria-label^="П-21, неделя "]');
  expect(weeks).toHaveLength(53);
  expect(container.querySelectorAll('.kug-calendar-row')).toHaveLength(1);
  expect(container.querySelectorAll('.kug-calendar-row .kug-day-dot')).toHaveLength(371);
  expect(container.classList.contains('kug-density-compact')).toBe(false);
  expect(screen.getByTestId('calendar-matrix').classList.contains('kug-density-compact')).toBe(true);
  fireEvent.change(screen.getByRole('combobox',{name:'Плотность календаря'}),{target:{value:'detailed'}});
  expect(screen.getByTestId('calendar-matrix').classList.contains('kug-density-detailed')).toBe(true);
 },20000);
 it('shows four months, switches the term, and scopes selection to visible weeks',()=>{
  const {container}=render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={()=>{}}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Масштаб компактного календаря'}),{target:{value:'quarter'}});
  expect(screen.getByRole('combobox',{name:'Масштаб компактного календаря'})).toHaveProperty('value','quarter');
  expect(container.querySelectorAll('[aria-label^="П-21, неделя "]').length).toBeLessThan(25);
  fireEvent.click(screen.getByRole('button',{name:'Январь — апрель'}));
  expect(container.querySelector('[aria-label^="П-21, неделя 1:"]')).toBeNull();
  expect(container.querySelector('[aria-label^="П-21, неделя 20:"]')).not.toBeNull();
  fireEvent.change(screen.getByRole('combobox',{name:'Масштаб компактного календаря'}),{target:{value:'all'}});
  expect(container.querySelectorAll('[aria-label^="П-21, неделя "]')).toHaveLength(53);
 },20000);
 it('collapses department/course sections without losing their group records',()=>{
  const {container}=render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={()=>{}}/>);
  expect(container.querySelector('[aria-label^="П-21, неделя 1:"]')).not.toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Свернуть ИТ · 2 курс'}));
  expect(container.querySelector('[aria-label^="П-21, неделя 1:"]')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Развернуть ИТ · 2 курс'}));
  expect(container.querySelector('[aria-label^="П-21, неделя 1:"]')).not.toBeNull();
 },20000);
 it('shows a separate year-long group strip while preserving week editing',()=>{
  const {container}=render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Группа'}));
  const strip=screen.getByRole('group',{name:'Годовая линия группы П-21'});
  expect(strip.querySelectorAll('button')).toHaveLength(53);
  fireEvent.click(strip.querySelectorAll('button')[9]);
  expect(screen.getByRole('region',{name:'Дни выбранной недели'})).toBeTruthy();
  expect(container.querySelector('.kug-workspace-side')).not.toBeNull();
 },20000);
});


describe('three KUG view modes and the hidden academic-office center',()=>{
 it('retains the original large-table grid with seven daily marks in each group/week',()=>{
  const {container}=render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={()=>{}}/>);
  const first=container.querySelector<HTMLButtonElement>('[aria-label^="П-21, неделя 10:"]')!;
  expect(first.querySelectorAll('.kug-day-dot')).toHaveLength(0);
  expect(screen.getByRole('group',{name:'Режим календаря'}).querySelectorAll('button')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button',{name:'Большая таблица'}));
  expect(screen.getByTestId('calendar-matrix').classList.contains('kug-view-large')).toBe(true);
  const expanded=container.querySelector<HTMLButtonElement>('[aria-label^="П-21, неделя 10:"]')!;
  expect(expanded.querySelectorAll('.kug-day-dot')).toHaveLength(7);
  expect(container.querySelectorAll('.kug-calendar-row .kug-day-dot')).toHaveLength(371);
  fireEvent.click(screen.getByRole('button',{name:'Компактная таблица'}));
  expect(container.querySelector<HTMLButtonElement>('[aria-label^="П-21, неделя 10:"]')!.querySelectorAll('.kug-day-dot')).toHaveLength(0);
 },20000);
 it('keeps academic-office tools hidden until explicit click, then allows closing',()=>{
  render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={()=>{}}/>);
  const trigger=screen.getByRole('button',{name:/Центр календаря учебной части/});
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByLabelText('Дата исключения колледжа')).toBeNull();
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByLabelText('Дата исключения колледжа')).toBeTruthy();
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByLabelText('Дата исключения колледжа')).toBeNull();
 },20000);
});


describe('KUG controls next to table and restored weekly group cards',()=>{
 it('places year, department, course, group search, and density adjacent to the data',()=>{
  const {container}=render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={()=>{}}/>);
  const controls=container.querySelector('.kug-workspace-main > .kug-table-controls');
  expect(controls).not.toBeNull();
  expect(controls!.querySelector('[aria-label="Учебный год КУГ"]')).not.toBeNull();
  expect(controls!.querySelector('[aria-label="Отделение КУГ"]')).not.toBeNull();
  expect(controls!.querySelector('[aria-label="Курс КУГ"]')).not.toBeNull();
  expect(controls!.querySelector('[aria-label="Поиск группы КУГ"]')).not.toBeNull();
  expect(controls!.querySelector('[aria-label="Плотность календаря"]')).not.toBeNull();
  expect(controls!.nextElementSibling?.classList.contains('kug-matrix-help')).toBe(true);
 },20000);
 it('shows 53 readable dated week cards with a daily strip for a group',()=>{
  const {container}=render(<CalendarMatrix events={CALENDAR} lessons={[]} group="П-21" setGroup={()=>{}} replace={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Группа'}));
  const cards=screen.getByRole('group',{name:'Годовая линия группы П-21'});
  expect(cards.querySelectorAll('button')).toHaveLength(53);
  const january=[...cards.querySelectorAll('button')].find(b=>b.textContent?.includes('18.01'));
  expect(january).toBeTruthy();
  expect(january!.textContent).toContain('Каникулы');
  expect(january!.querySelectorAll('.kug-day-dot')).toHaveLength(7);
  const february=[...cards.querySelectorAll('button')].find(b=>b.textContent?.includes('01.02'));
  expect(february).toBeTruthy();
  expect(february!.textContent).toContain('Теоретическое');
  expect(container.querySelector('.kug-single-timeline')).toBeNull();
 },20000);
});
