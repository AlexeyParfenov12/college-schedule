import {useMemo,useState} from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, Check, ChevronRight, CircleHelp,
 ClipboardCheck, DoorClosed, GraduationCap, RefreshCcw, Search, ShieldCheck, UserRoundX, X } from 'lucide-react';
import { DAYS } from './data';
import type { Lesson } from './data';
import { lessonDate } from './plannerDomain';
import {
 decisionTickets,decisionProposals,readDispatcherSources
} from './decisionCenterDomain';
import type { DecisionKind, DecisionProposal } from './decisionCenterDomain';
import './decision-center.css';

type Props={
 lessons:Lesson[];week:number;days:5|6;
 onNavigate:(screen:'substitutions'|'resources'|'schedule'|'calendar'|'academic')=>void;
 onApply:(proposal:DecisionProposal)=>boolean;
 notify:(message:string)=>void;
};
const labels:Record<DecisionKind,string>={
 absence:'Отсутствие',room:'Кабинет',collision:'Конфликт',calendar:'КУГ',practice:'Практика'
};
const targetLabels:Record<DecisionKind,string>={
 absence:'Открыть замены',room:'Открыть аудитории',
 collision:'Открыть расписание',calendar:'Открыть календарь',
 practice:'Открыть Academic Core'
};
const icons:Record<DecisionKind,typeof AlertTriangle>={
 absence:UserRoundX,room:DoorClosed,collision:AlertTriangle,
 calendar:CalendarDays,practice:GraduationCap
};
export default function DecisionCenter({lessons,week,days,onNavigate,onApply,notify}:Props){
 const [sources,setSources]=useState(readDispatcherSources);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [shown,setShown]=useState(false);
 const [chosenKey,setChosenKey]=useState<string|null>(null);
 const [filter,setFilter]=useState<DecisionKind|'all'>('all');
 const tickets=useMemo(()=>decisionTickets(lessons,week,days,sources),[lessons,week,days,sources]);
 const filtered=tickets.filter(x=>filter==='all'||x.kind===filter);
 const selected=tickets.find(x=>x.id===activeId)||filtered[0]||null;
 const proposals=useMemo(()=>selected&&shown?
  decisionProposals(selected,lessons,sources,days):[],[selected,shown,lessons,sources,days]);
 const chosen=proposals.find(x=>x.key===chosenKey)||null;
 const sync=()=>{
  setSources(readDispatcherSources());setActiveId(null);setShown(false);
  setChosenKey(null);notify('Анализ обновлён по текущим данным демостенда');
 };
 const select=(id:string)=>{setActiveId(id);setShown(false);setChosenKey(null)};
 const showProposals=()=>{setShown(true);setChosenKey(null)};
 const confirm=()=>{
  if(!selected||!chosen)return;
  // Both the issue and the action are re-evaluated against the latest screen state.
  const fresh=decisionTickets(lessons,week,days,sources).find(x=>x.id===selected.id);
  const valid=fresh&&decisionProposals(fresh,lessons,sources,days).find(x=>x.key===chosen.key);
  if(!valid){setChosenKey(null);setShown(false);notify('Данные изменились. Запустите проверку решения снова.');return}
  if(!window.confirm('Внести это изменение только в черновик расписания?\n'+
   valid.source.subject+' · '+DAYS[valid.source.day]+' · '+valid.source.slot+'-я пара\n'+
   valid.title+'\nПубликация и уведомления не выполняются.'))return;
  const accepted=onApply(valid);
  if(!accepted){setShown(false);setChosenKey(null);notify('Расписание изменилось — повторите анализ');return}
  setActiveId(null);setShown(false);setChosenKey(null);
 };
 const critical=tickets.filter(x=>x.priority===1).length;
 const practice=tickets.filter(x=>x.kind==='practice').length;
 return <section className="dc-root" data-testid="decision-center">
  <div className="dc-hero">
   <div className="dc-hero-title">
    <div className="dc-hero-icon"><ClipboardCheck size={23}/></div>
    <div><h2>Центр решений</h2>
     <p>Очередь задач учебной части · неделя {week+1} ({lessonDate(week,0)} — {lessonDate(week,days-1)})</p>
    </div>
   </div>
   <button type="button" className="dc-btn dc-outline" onClick={sync}><RefreshCcw size={15}/> Обновить анализ</button>
  </div>
  <div className="dc-stats">
   <div><strong>{tickets.length}</strong><span>Требуют внимания</span></div>
   <div><strong>{critical}</strong><span>Конфликты и изменения</span></div>
   <div><strong>{practice}</strong><span>Назначения практик</span></div>
  </div>
  <div className="dc-hint"><ShieldCheck size={17}/>
   <p><b>Без автоматических изменений.</b> Центр читает существующие данные, предлагает варианты
    и сохраняет подтверждённое решение только в черновик. Сложные случаи остаются в своих рабочих разделах.
    Данные и справочники пока демонстрационные.</p>
  </div>
  <div className="dc-columns">
   <aside className="dc-queue" aria-label="Очередь проблем">
    <div className="dc-queue-head"><h3>Очередь задач</h3><span>{filtered.length}</span></div>
    <label className="dc-filter">Показать
     <select value={filter} onChange={e=>{setFilter(e.target.value as DecisionKind|'all');setActiveId(null);setShown(false);setChosenKey(null)}}>
      <option value="all">Все типы</option>
      {Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}
     </select>
    </label>
    <div className="dc-ticket-list">
     {!filtered.length&&<div className="dc-empty">По выбранному фильтру проблем нет.</div>}
     {filtered.slice(0,80).map(t=>{
      const Icon=icons[t.kind];
      return <button type="button" key={t.id} onClick={()=>select(t.id)}
       className={'dc-ticket'+(selected?.id===t.id?' selected':'')}
       aria-current={selected?.id===t.id?'true':undefined}>
       <span className="dc-ticket-heading"><Icon size={16}/><b>{t.title}</b></span>
       <span className="dc-ticket-meta">{t.group}{t.day!==undefined?' · '+DAYS[t.day]+', '+t.slot+'-я пара':''}</span>
       <span className="dc-ticket-kind">{labels[t.kind]} <ChevronRight size={14}/></span>
      </button>
     })}
     {filtered.length>80&&<p className="dc-limit">Показаны первые 80 задач. Используйте фильтры или рабочие разделы для полного списка.</p>}
    </div>
   </aside>
   <div className="dc-detail">
    {!selected?<div className="dc-empty dc-detail-empty"><Check size={28}/>
      <h3>Новых задач нет</h3><p>На этой неделе проблемы из подключённых источников не обнаружены. Это не заменяет полной проверки перед публикацией.</p></div>:
     <>
      <div className="dc-detail-header">
       <span className="dc-eyebrow">{labels[selected.kind]} · {selected.priority===1?'Требует решения':'Требует уточнения'}</span>
       <h3>{selected.title}</h3>
       <p>{selected.reason}</p>
       <div className="dc-meta">
        <span>{selected.group}</span>
        {selected.teacher&&<span>{selected.teacher}</span>}
        {selected.day!==undefined&&<span>{DAYS[selected.day]}, {selected.slot}-я пара</span>}
       </div>
      </div>
      <div className="dc-actions">
       {['absence','room'].includes(selected.kind)&&<button type="button" className="dc-btn dc-primary"
        onClick={showProposals}><Search size={15}/> Проверить доступные решения</button>}
       <button type="button" className="dc-btn dc-outline" onClick={()=>onNavigate(selected.section)}>
        {targetLabels[selected.kind]} <ArrowRight size={15}/>
       </button>
      </div>
      {shown&&<section className="dc-solutions" aria-label="Предложения">
       <div className="dc-solutions-title"><h4>Результат проверки</h4>
        <button type="button" aria-label="Закрыть предложения" className="dc-icon-button"
         onClick={()=>{setShown(false);setChosenKey(null)}}><X size={17}/></button>
       </div>
       {!proposals.length&&<div className="dc-no-option"><CircleHelp size={18}/>
        <p>Для этого занятия не найдено безопасных вариантов в текущих демоданных.
         Проверьте ограничения и подберите решение в основном разделе. Принудительная замена не выполняется.</p>
       </div>}
       {proposals.map(p=><div className={'dc-proposal'+(chosen?.key===p.key?' active':'')} key={p.key}>
        <div className="dc-proposal-text"><b>{p.title}</b><p>{p.explanation}</p></div>
        <button type="button" className="dc-btn dc-outline" onClick={()=>setChosenKey(p.key)}>Предпросмотр</button>
       </div>)}
      </section>}
      {chosen&&<section className="dc-preview" aria-label="Предпросмотр решения">
       <div className="dc-solutions-title"><h4>Перед подтверждением</h4>
        <button type="button" className="dc-icon-button" aria-label="Отменить предпросмотр"
         onClick={()=>setChosenKey(null)}><X size={17}/></button>
       </div>
       <div className="dc-diff">
        <div><small>Было</small><b>{chosen.source.subject}</b>
         <span>{chosen.source.teacher} · каб. {chosen.source.room}</span></div>
        <div><small>Предлагается</small><b>{chosen.after.subject}</b>
         <span>{chosen.after.teacher} · {chosen.after.mode==='online'?'онлайн':'каб. '+chosen.after.room}</span></div>
       </div>
       <p className="dc-check-note"><ShieldCheck size={16}/> Вариант будет ещё раз проверен перед применением.
        Изменение затронет только одно занятие и не опубликует расписание.
        {chosen.kind==='substitution'?' Исходные часы потребуют перепланирования.':''}</p>
       <button type="button" className="dc-btn dc-primary" onClick={confirm}><Check size={16}/> Применить к черновику</button>
       <button type="button" className="dc-btn dc-outline" onClick={()=>setChosenKey(null)}>Отмена</button>
      </section>}
      {!['absence','room'].includes(selected.kind)&&<div className="dc-no-option">
       <AlertTriangle size={18}/><p>Это комплексная задача. Центр показывает причину, но не делает неподтверждённых массовых переносов. Откройте соответствующий раздел для разрешения ситуации.</p>
      </div>}
     </>}
   </div>
  </div>
 </section>;
}
