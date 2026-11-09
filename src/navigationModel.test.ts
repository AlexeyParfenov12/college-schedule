import {describe,expect,it} from 'vitest';
import {NAV} from './data';
import { NAV_SECTIONS, PREVIEW_SCREENS, menuContainsScreen, sectionForScreen } from './navigationModel';

describe('dispatcher navigation model',()=>{
 it('includes the separate decision center and keeps all existing job areas',()=>{
  expect(NAV_SECTIONS.map(x=>x.label)).toEqual([
   'Обзор','Центр решений','Сценарии и последствия','Расписание','Учебный календарь','Планирование',
   'Замены','Отчёты','Справочники','Настройки']);
 });
 it('retains every old route exactly once without a destructive migration',()=>{
  const reachable=[
   ...NAV_SECTIONS.flatMap(x=>[x.key,...x.children.map(([key])=>key)]),
   ...PREVIEW_SCREENS.map(([key])=>key),
   'publication'
  ];
  expect(reachable).toHaveLength(NAV.length);
  expect(new Set(reachable).size).toBe(reachable.length);
  for(const [key] of NAV)expect(menuContainsScreen(key)).toBe(true);
 });
 it('navigates each nested tool under its dispatcher workflow',()=>{
  expect(sectionForScreen('streams')).toBe('schedule');
  expect(sectionForScreen('parallels')).toBe('schedule');
  expect(sectionForScreen('distance')).toBe('schedule');
  expect(sectionForScreen('generator')).toBe('year');
  expect(sectionForScreen('workload')).toBe('year');
  expect(sectionForScreen('resources')).toBe('academic');
  expect(sectionForScreen('teacher')).toBeNull();
  expect(sectionForScreen('publication')).toBeNull();
 });
});
