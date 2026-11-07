// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import MobileSchedule from './MobileSchedule';
import type { Lesson } from './data';
import type { MoveOption } from './scheduleAssist';
const times=['08:30–10:00','10:10–11:40','12:00–13:30','13:40–15:10','15:20–16:50','17:00–18:30'];
const math:Lesson={id:'mobile-math',week:0,day:0,slot:1,subject:'Математика',teacher:'Петров М. С.',
 groups:['П-21'],room:'109',type:'regular',mode:'offline'};
afterEach(()=>cleanup());
describe('touch-first schedule agenda',()=>{
 it('switches days and opens existing linked lesson by one touch',()=>{
  const onDayChange=vi.fn(),onOpen=vi.fn(),onAdd=vi.fn();
  const props={week:0,days:6 as const,times,day:0,selectedId:undefined,lessons:[math],
   moveMode:false,targets:[] as MoveOption[],onDayChange,onOpen,onAdd,onTarget:vi.fn(),onCancelMove:vi.fn()};
  const {rerender}=render(<MobileSchedule {...props}/>);
  const agenda=within(screen.getByRole('region',{name:'Расписание на телефоне'}));
  expect(agenda.getByRole('group',{name:'Выбор дня недели'})).toBeTruthy();
  fireEvent.click(agenda.getByRole('button',{name:/Математика/}));
  expect(onOpen).toHaveBeenCalledWith(math);
  fireEvent.click(agenda.getByRole('button',{name:/Вт\s*10/}));
  expect(onDayChange).toHaveBeenCalledWith(1);
  rerender(<MobileSchedule {...props} day={1}/>);
  fireEvent.click(agenda.getByRole('button',{name:'Добавить занятие: Вт, 1-я пара'}));
  expect(onAdd).toHaveBeenCalledWith(1,1);
 });
 it('shows exact green and red move targets without needing a drag gesture',()=>{
  const onTarget=vi.fn(),onCancelMove=vi.fn();
  const targets:MoveOption[]=[{day:0,slot:1,kind:'current',reason:'Текущее время',label:'Пн · 1'},
    {day:0,slot:2,kind:'available',reason:'Свободно',label:'Пн · 2'},
    {day:0,slot:3,kind:'blocked',reason:'Аудитория занята',label:'Пн · 3'}];
  const {container}=render(<MobileSchedule week={0} days={5} times={times} lessons={[math]} day={0}
   selectedId="mobile-math" moveMode targets={targets} onDayChange={vi.fn()} onOpen={vi.fn()}
   onAdd={vi.fn()} onTarget={onTarget} onCancelMove={onCancelMove}/>);
  expect(container.querySelectorAll('.mobile-move-target.available')).toHaveLength(1);
  expect(container.querySelectorAll('.mobile-move-target.blocked')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:/Перенести на Пн 2/}));
  expect(onTarget).toHaveBeenCalledWith(0,2);
  fireEvent.click(screen.getByRole('button',{name:/Перенос запрещён: Пн 3/}));
  expect(onTarget).toHaveBeenCalledWith(0,3);
  fireEvent.click(screen.getByRole('button',{name:'Отмена'}));
  expect(onCancelMove).toHaveBeenCalledTimes(1);
 });
 it('never offers create actions for a federal transferred rest day',()=>{
  const {container}=render(<MobileSchedule week={7} days={5} times={times} lessons={[]} day={3}
   moveMode={false} targets={[]} onDayChange={vi.fn()} onOpen={vi.fn()} onAdd={vi.fn()}
   onTarget={vi.fn()} onCancelMove={vi.fn()}/>);
  expect(container.querySelectorAll('.mobile-add-lesson')).toHaveLength(0);
  expect(screen.getAllByText('Нерабочий день')).toHaveLength(6);
 });
 it('offers a regular Saturday in six-day mode, but excludes it for five-day mode',()=>{
  const props={week:0,times,lessons:[] as Lesson[],day:5,moveMode:false,targets:[] as MoveOption[],
   onDayChange:vi.fn(),onOpen:vi.fn(),onAdd:vi.fn(),onTarget:vi.fn(),onCancelMove:vi.fn()};
  const {rerender}=render(<MobileSchedule {...props} days={6}/>);
  expect(screen.getByRole('button',{name:'Добавить занятие: Сб, 1-я пара'})).toBeTruthy();
  rerender(<MobileSchedule {...props} day={4} days={5}/>);
  expect(screen.getAllByRole('button',{name:/Добавить занятие/}).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button',{name:/Сб.*14/})).toBeNull();
 });
});
