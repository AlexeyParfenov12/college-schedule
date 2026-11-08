// @vitest-environment jsdom
import { afterEach,describe,expect,it } from 'vitest';
import { fireEvent,render,screen,cleanup } from '@testing-library/react';
import { addCollegeDayOverride,getCollegeDayOverrides,removeCollegeDayOverride,replaceCollegeDayOverrides,useWorkerCollegeDayOverrides } from './collegeDayOverrides';
import { classifyCalendarDay,collegeWorkOverrideProhibited } from './productionCalendar';
import CalendarAdminCenter from './CalendarAdminCenter';

afterEach(()=>{
 cleanup();
 replaceCollegeDayOverrides([]);
});
describe('college calendar manual changes and academic-office alerts',()=>{
 it('closes an ordinary teaching day and then restores its normal status',()=>{
  expect(classifyCalendarDay('2026-11-10',6).nonWorking).toBe(false);
  addCollegeDayOverride({date:'2026-11-10',action:'closed',reason:'Приказ колледжа № 14',author:'Диспетчер'});
  expect(classifyCalendarDay('2026-11-10',6).kind).toBe('college-off');
  expect(classifyCalendarDay('2026-11-10',6).nonWorking).toBe(true);
  expect(getCollegeDayOverrides()).toHaveLength(1);
  removeCollegeDayOverride('2026-11-10');
  expect(classifyCalendarDay('2026-11-10',6).nonWorking).toBe(false);
 });
 it('allows a local working Saturday in a five-day regime but never reopens federal holidays',()=>{
  addCollegeDayOverride({date:'2026-11-14',action:'working',reason:'Приказ о рабочей субботе',author:'Диспетчер'});
  expect(classifyCalendarDay('2026-11-14',5).kind).toBe('college-work');
  expect(classifyCalendarDay('2026-11-14',5).nonWorking).toBe(false);
  addCollegeDayOverride({date:'2026-11-04',action:'working',reason:'Ошибочный приказ колледжа',author:'Диспетчер'});
  expect(collegeWorkOverrideProhibited('2026-11-04',6)).toMatch(/федеральн/i);
  expect(classifyCalendarDay('2026-11-04',6).kind).toBe('holiday');
  expect(classifyCalendarDay('2026-11-04',6).nonWorking).toBe(true);
 });
 it('propagates local corrections into annual planner workers from the same data snapshot',()=>{
  const state=[{id:'college-2026-11-10',date:'2026-11-10',action:'shortened' as const,
   reason:'Приказ колледжа № 15',author:'Диспетчер',createdAt:'2026-11-08T00:00:00Z'}];
  useWorkerCollegeDayOverrides(state);
  expect(classifyCalendarDay('2026-11-10',6).kind).toBe('college-shortened');
 });
 it('enforces mandatory reasons and does not accept malformed override dates',()=>{
  expect(()=>addCollegeDayOverride({date:'2026-02-30',action:'closed',reason:'Приказ № 2',author:'Диспетчер'})).toThrow();
  expect(()=>addCollegeDayOverride({date:'2026-11-10',action:'closed',reason:'',author:'Диспетчер'})).toThrow();
 });
 it('provides preview, save and removal from a single academic-office interface',()=>{
  render(<CalendarAdminCenter lessons={[]}/>);
  fireEvent.change(screen.getByLabelText('Дата исключения колледжа'),{target:{value:'2026-11-10'}});
  fireEvent.change(screen.getByLabelText('Основание изменения дня'),{target:{value:'Приказ колледжа № 15'}});
  fireEvent.click(screen.getByText('Предпросмотр изменений'));
  expect(screen.getByText(/Затронутых уже существующих занятий: 0/)).toBeTruthy();
  fireEvent.click(screen.getByText('Сохранить исключение'));
  expect(classifyCalendarDay('2026-11-10',6).nonWorking).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Отменить исключение 2026-11-10'}));
  expect(classifyCalendarDay('2026-11-10',6).nonWorking).toBe(false);
 });
});
