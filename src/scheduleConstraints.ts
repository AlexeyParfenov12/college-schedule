/**
 * College-wide -> department -> group constraints for the demo annual solver.
 * Academic groups remain sourced from the shared demo Academic Core adapter.
 * Overrides are restrictive: a descendant cannot silently relax a college-wide ban.
 * Production rules will be authorized and audited through College Ecosystem Auth/RBAC.
 */
import { GROUPS } from './data';
import type { AnnualConfig, TeacherPreference } from './yearSolver';

export type DayPeriod={day:number;from:number;to:number};
export type ScopeRule={
 daysOff:number[];
 fromSlot:number;
 toSlot:number;
 forbidden:DayPeriod[];
 maxPairsPerDay:number;
};
export type ScopeOverride=Partial<ScopeRule>;
export type RuleHierarchy={
 collegeRules?:ScopeOverride;
 departmentRules?:Record<string,ScopeOverride>;
 groupRules?:Record<string,ScopeOverride>;
};
export type RuleTrace={rule:ScopeRule;origin:string[]};
const validDay=(n:number)=>Number.isInteger(n)&&n>=0&&n<=5;
const validSlot=(n:number)=>Number.isInteger(n)&&n>=1&&n<=6;
const clampSlot=(n:number,fallback:number)=>validSlot(n)?n:fallback;
const bound=(n:number,limit:number)=>Number.isInteger(n)&&n>=1?Math.min(n,limit):limit;
const uniqueDays=(days?:number[])=>[...new Set((Array.isArray(days)?days:[]).filter(validDay))].sort((a,b)=>a-b);
function sanitized(src?:ScopeOverride):ScopeOverride{
 if(!src)return {};
 return {
  ...(src.daysOff?{daysOff:uniqueDays(src.daysOff)}:{}),
  ...(src.fromSlot!==undefined?{fromSlot:clampSlot(src.fromSlot,1)}:{}),
  ...(src.toSlot!==undefined?{toSlot:clampSlot(src.toSlot,6)}:{}),
  ...(src.maxPairsPerDay!==undefined?{maxPairsPerDay:bound(src.maxPairsPerDay,6)}:{}),
  ...(src.forbidden?{forbidden:src.forbidden.filter(x=>validDay(x.day)&&validSlot(x.from)&&validSlot(x.to)&&x.from<=x.to)}:{})
 };
}
const base=(cfg:AnnualConfig):ScopeRule=>({
 daysOff:[],fromSlot:1,toSlot:cfg.slotsPerDay,forbidden:[],maxPairsPerDay:cfg.slotsPerDay
});
function overlay(previous:ScopeRule,patch?:ScopeOverride):ScopeRule{
 const p=sanitized(patch);
 return {
  daysOff:[...new Set([...previous.daysOff,...(p.daysOff||[])])].sort((a,b)=>a-b),
  fromSlot:Math.max(previous.fromSlot,p.fromSlot??1),
  toSlot:Math.min(previous.toSlot,p.toSlot??6),
  forbidden:[...previous.forbidden,...(p.forbidden||[])],
  maxPairsPerDay:Math.min(previous.maxPairsPerDay,p.maxPairsPerDay??6)
 };
}
export function effectiveGroupRules(cfg:AnnualConfig,groupId:string):RuleTrace{
 const found=GROUPS.find(g=>g.id===groupId);
 const department=found?.department;
 let resolved=base(cfg);
 const origin=['Учебная неделя колледжа'];
 if(cfg.collegeRules){resolved=overlay(resolved,cfg.collegeRules);origin.push('Колледж')}
 if(department&&cfg.departmentRules?.[department]){
  resolved=overlay(resolved,cfg.departmentRules[department]);
  origin.push('Отделение: '+department);
 }
 if(cfg.groupRules?.[groupId]){
  resolved=overlay(resolved,cfg.groupRules[groupId]);
  origin.push('Группа: '+groupId);
 }
 return {rule:resolved,origin};
}
export function effectiveTeacherRule(cfg:AnnualConfig,teacher:string):TeacherPreference{
 const p=cfg.teacherPreferences[teacher];
 const inherited=overlay(base(cfg),cfg.collegeRules);
 const constraint=overlay(inherited,p);
 return {
  daysOff:constraint.daysOff,
  fromSlot:constraint.fromSlot,
  toSlot:constraint.toSlot,
  forbidden:constraint.forbidden,
  preferDays:(p?.preferDays||[]).filter(validDay),
  maxOnlinePct:Math.max(0,Math.min(100,p?.maxOnlinePct??cfg.defaultOnlinePct)),
  maxPairsPerDay:constraint.maxPairsPerDay
 };
}
export function checkGroupSlot(cfg:AnnualConfig,groupId:string,day:number,slot:number,scheduledToday=0){
 const {rule,origin}=effectiveGroupRules(cfg,groupId);
 let reason='';
 if(day<0||day>=cfg.days)reason='День не входит в учебную неделю';
 else if(slot<1||slot>cfg.slotsPerDay)reason='Пара вне расписания звонков';
 else if(rule.daysOff.includes(day))reason='Этот день исключён правилами';
 else if(slot<rule.fromSlot||slot>rule.toSlot)reason='Пара вне разрешённого диапазона';
 else if(rule.forbidden.some(p=>p.day===day&&slot>=p.from&&slot<=p.to))reason='Пара запрещена ограничениями';
 else if(scheduledToday>=rule.maxPairsPerDay)reason='Достигнут максимум занятий в день';
 return {allowed:!reason,reason,origin,rule};
}
export function checkTeacherSlot(cfg:AnnualConfig,teacher:string,day:number,slot:number,scheduledToday=0){
 const rule=effectiveTeacherRule(cfg,teacher);
 let reason='';
 if(day<0||day>=cfg.days)reason='День за пределами учебной недели';
 else if(rule.daysOff.includes(day))reason='День запрещён преподавателю';
 else if(slot<rule.fromSlot||slot>rule.toSlot)reason='Пара вне диапазона преподавателя';
 else if(rule.forbidden.some(p=>p.day===day&&slot>=p.from&&slot<=p.to))reason='Пара запрещена преподавателю';
 else if(scheduledToday>=(rule.maxPairsPerDay??cfg.slotsPerDay))reason='Достигнута дневная нагрузка преподавателя';
 return {allowed:!reason,reason,rule};
}
