import { NAV } from './data';
export type ScheduleScreen=typeof NAV[number][0];

/**
 * Navigation is organized by dispatcher jobs, not by backend module boundaries.
 * Every legacy route stays addressable; no academic entities or stored records change.
 */
export const NAV_SECTIONS=[
 {key:'overview',label:'Обзор',children:[]},
 {key:'decisions',label:'Центр решений',children:[]},
 {key:'schedule',label:'Расписание',children:[
  ['templates','Шаблоны расписания'],['streams','Потоки'],['parallels','Параллели'],
  ['distance','Дистант и гибрид']
 ]},
 {key:'calendar',label:'Учебный календарь',children:[]},
 {key:'year',label:'Планирование',children:[
  ['generator','Автосоставление на неделю'],['workload','Нагрузка и часы']
 ]},
 {key:'substitutions',label:'Замены',children:[]},
 {key:'reports',label:'Отчёты',children:[]},
 {key:'academic',label:'Справочники',children:[
  ['groups','Группы и подгруппы'],['resources','Аудитории']
 ]},
 {key:'settings',label:'Настройки',children:[]}
] as const satisfies ReadonlyArray<{key:ScheduleScreen;label:string;children:ReadonlyArray<readonly [ScheduleScreen,string]>}>;
export const PREVIEW_SCREENS=[
 ['teacher','Предпросмотр преподавателя'],['student','Предпросмотр студента']
] as const satisfies ReadonlyArray<readonly [ScheduleScreen,string]>;
export const PUBLISH_SCREEN='publication' as const;
export function sectionForScreen(screen:ScheduleScreen):ScheduleScreen|null{
 for(const section of NAV_SECTIONS){
  if(section.key===screen||section.children.some(([key])=>key===screen))return section.key;
 }
 return null;
}
export function menuContainsScreen(screen:ScheduleScreen):boolean{
 return NAV_SECTIONS.some(section=>section.key===screen||section.children.some(([key])=>key===screen))||
  PREVIEW_SCREENS.some(([key])=>key===screen)||screen===PUBLISH_SCREEN;
}
