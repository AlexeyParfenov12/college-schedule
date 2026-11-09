import {useMemo,useState} from 'react';
import { AlertTriangle, ArrowLeftRight, CalendarDays, Check, ChevronDown, Download, DoorClosed,
 GitCompareArrows, Info, RefreshCw, ShieldCheck, UserRoundX, X } from 'lucide-react';
import { DAYS, ROOMS, TEACHERS } from './data';
import type {Lesson} from './data';
import { lessonDate } from './plannerDomain';
import { readDispatcherSources } from './decisionCenterDomain';
import {
 modelScenario, scenarioExport, scenarioInputProblems, scenarioSignature
} from './scenarioEngine';
import type { ScenarioInput, ScenarioKind, ScenarioResult, ScenarioVariant } from './scenarioEngine';
import './scenario-lab.css';

type Props={
 lessons:Lesson[];week:number;days:5|6;
 onApply:(variant:ScenarioVariant,input:ScenarioInput)=>boolean;
 notify:(message:string)=>void;
};
const fmt=(n:number)=>(n>0?'+':'')+n;
const lessonLabel=(l:Lesson)=>DAYS[l.day]+', '+l.slot+'-я пара · '+l.groups.join(' + ')+' · '+l.subject;
export default function ScenarioLab({lessons,week,days,onApply,notify}:Props){
 const weekly=useMemo(()=>lessons.filter(l=>(l.week||0)===week&&l.status!=='cancelled'),[lessons,week]);
 const usedRooms=useMemo(()=>[...new Set(weekly.flatMap(l=>l.room.match(/\b\d{3}\b/g)||[]))]
  .filter(id=>ROOMS.some(r=>r.id===id)).sort(),[weekly]);
 const usedTeachers=useMemo(()=>[...new Set(weekly.map(l=>l.teacher))].sort(),[weekly]);
 const [kind,setKind]=useState<ScenarioKind>('room');
 const [room,setRoom]=useState(usedRooms[0]||ROOMS[0].id);
 const [teacher,setTeacher]=useState(usedTeachers[0]||TEACHERS[0]);
 const [fromDay,setFromDay]=useState(0);
 const [toDay,setToDay]=useState(days-1);
 const [result,setResult]=useState<ScenarioResult|null>(null);
 const [chosenId,setChosenId]=useState<ScenarioVariant['id']|null>(null);
 const [preview,setPreview]=useState(false);
 const [applied,setApplied]=useState(false);
 const input:ScenarioInput={kind,room,teacher,fromDay,toDay,week};
 const selected=result?.variants.find(x=>x.id===chosenId)||null;
 const freshSignature=result?scenarioSignature(lessons,input,readDispatcherSources(),days):'';
 const stale=Boolean(result&&freshSignature!==result.signature);
 const reset=()=>{setResult(null);setChosenId(null);setPreview(false);setApplied(false)};
 const model=()=>{
  const issues=scenarioInputProblems(input,days);
  if(issues.length){notify(issues[0]);return}
  const simulation=modelScenario(lessons,input,readDispatcherSources(),days);
  setResult(simulation);setChosenId(simulation.variants[0]?.id||null);setPreview(false);setApplied(false);
 };
 const exportReview=()=>{
  if(!result||!selected||stale)return;
  const file=scenarioExport(input,result,selected);
  const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;
  link.download='college-scenario-week-'+(week+1)+'-'+selected.id+'.json';
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
 };
 const confirm=()=>{
  if(!result||!selected||stale||!selected.complete)return;
  if(!window.confirm('Подтвердить пакет из '+selected.changes.length+
   ' изменений только в ЧЕРНОВИК расписания?\n'+
   'Публикация, отправка уведомлений и изменение справочников не выполняются.'))return;
  if(onApply(selected,input)){setApplied(true);setPreview(false)}
  else {reset();notify('Проверка не пройдена. Пересчитайте сценарий на актуальных данных.')}
 };
 const asDate=(index:number)=>lessonDate(week,index);
 return <section className="sl-root" data-testid="scenario-lab">
  <header className="sl-hero">
   <div className="sl-title"><div className="sl-symbol"><GitCompareArrows size={25}/></div>
    <div><h2>Лаборатория сценариев</h2>
     <p>Что будет, если… · неделя {week+1}, {asDate(0)} — {asDate(days-1)}</p></div>
   </div>
   <span className="sl-demo">Демонстрационный цифровой двойник</span>
  </header>
  <div className="sl-tip"><ShieldCheck size={18}/>
   <div><b>Сначала моделирование — потом решение.</b> Здесь не изменяются исходное расписание,
    учебный календарь, кадровые отсутствия и справочник аудиторий. Данные берутся из текущего стенда.
    Подтверждённый пакет попадает только в черновик и доступен для отмены.</div>
  </div>
  <section className="sl-panel" aria-label="Параметры сценария">
   <div className="sl-panel-heading"><h3>1. Смоделировать событие</h3>
    <span>Выберите, что произошло</span></div>
   <div className="sl-control-body">
    <div className="sl-kind">
     <button type="button" className={kind==='room'?'active':''}
      aria-pressed={kind==='room'} onClick={()=>{setKind('room');reset()}}>
      <DoorClosed size={19}/><b>Закрыта аудитория</b><small>Ремонт, авария, мероприятие</small>
     </button>
     <button type="button" className={kind==='teacher'?'active':''}
      aria-pressed={kind==='teacher'} onClick={()=>{setKind('teacher');reset()}}>
      <UserRoundX size={19}/><b>Отсутствует преподаватель</b><small>Больничный, командировка</small>
     </button>
    </div>
    <div className="sl-fields">
     {kind==='room'?<label>Аудитория
      <select aria-label="Аудитория для сценария" value={room} onChange={e=>{setRoom(e.target.value);reset()}}>
       {[...new Set([...usedRooms,...ROOMS.filter(r=>r.active).map(r=>r.id)])].map(code=>
        <option key={code} value={code}>Каб. {code}{usedRooms.includes(code)?' · есть занятия':''}</option>)}
      </select>
     </label>:<label>Преподаватель
      <select aria-label="Преподаватель для сценария" value={teacher} onChange={e=>{setTeacher(e.target.value);reset()}}>
       {[...new Set([...usedTeachers,...TEACHERS])].map(name=>
        <option key={name} value={name}>{name}</option>)}
      </select></label>}
     <label>С какого дня
      <select aria-label="Начало периода" value={fromDay} onChange={e=>{
       const next=Number(e.target.value);setFromDay(next);if(next>toDay)setToDay(next);reset()}}>
       {DAYS.slice(0,days).map((label,i)=><option key={label} value={i}>{label}, {asDate(i)}</option>)}
      </select>
     </label>
     <label>По какой день
      <select aria-label="Конец периода" value={toDay} onChange={e=>{
       const next=Number(e.target.value);setToDay(next);if(next<fromDay)setFromDay(next);reset()}}>
       {DAYS.slice(0,days).map((label,i)=><option key={label} value={i}>{label}, {asDate(i)}</option>)}
      </select>
     </label>
    </div>
    <div className="sl-actions">
     <button type="button" className="sl-btn sl-strong" onClick={model}><RefreshCw size={16}/>
      Рассчитать сценарии</button>
     {result&&<button type="button" className="sl-btn" onClick={reset}><X size={15}/> Очистить сравнение</button>}
    </div>
   </div>
  </section>
  {result&&<section className="sl-panel sl-results" aria-label="Сравнение сценариев">
   <div className="sl-panel-heading"><h3>2. Последствия и варианты</h3>
    <span>{result.affected.length} затронуто занятий · {result.variants.length} различающихся решений</span></div>
   {stale&&<div className="sl-warning" role="alert"><AlertTriangle size={17}/> Расписание или исходные данные изменились. Пересчитайте сценарий; прежние результаты не применяются.</div>}
   {result.issues.length>0&&<div className="sl-warning">{result.issues.join('; ')}</div>}
   {!result.affected.length&&<div className="sl-empty">В заданном интервале подходящих занятий нет. Выберите другой кабинет, преподавателя или диапазон дней.</div>}
   {!!result.affected.length&&<>
    <div className="sl-mini-stats">
     <div><strong>{result.affected.length}</strong><span>Затронуто пар</span></div>
     <div><strong>{selected?.metrics.groups.length??0}</strong><span>Групп</span></div>
     <div><strong>{selected?.metrics.teachers.length??0}</strong><span>Преподавателей</span></div>
    </div>
    <div className="sl-variants" role="group" aria-label="Выбор рассчитанного варианта">
     {result.variants.map(v=><button key={v.id} type="button"
      className={'sl-variant'+(selected?.id===v.id?' selected':'')}
      aria-pressed={selected?.id===v.id}
      onClick={()=>{setChosenId(v.id);setPreview(false);setApplied(false)}}>
      <b>{v.title}</b><span>{v.description}</span>
      <strong>{v.metrics.modified} изменений · {v.metrics.unresolved} нерешено</strong>
      <small>Окна у групп: {fmt(v.metrics.groupWindowsAfter-v.metrics.groupWindowsBefore)}</small>
     </button>)}
    </div>
    {selected&&<>
     <div className="sl-impact">
      <h4>Последствия выбранного варианта</h4>
      <table><tbody>
       <tr><th>Показатель</th><th>До</th><th>После</th></tr>
       <tr><td>Окна у групп, за неделю</td><td>{selected.metrics.groupWindowsBefore}</td><td>{selected.metrics.groupWindowsAfter}</td></tr>
       <tr><td>Окна у преподавателей</td><td>{selected.metrics.teacherWindowsBefore}</td><td>{selected.metrics.teacherWindowsAfter}</td></tr>
       <tr><td>Дистанционные/гибридные занятия</td><td>{selected.metrics.onlineBefore}</td><td>{selected.metrics.onlineAfter}</td></tr>
       <tr><td>Изменено занятий</td><td>0</td><td>{selected.metrics.modified}</td></tr>
       <tr><td>Часов исходных дисциплин для перепланирования</td><td>0</td><td>{selected.metrics.replanHours}</td></tr>
       <tr><td>Нерешённых занятий</td><td>—</td><td>{selected.metrics.unresolved}</td></tr>
      </tbody></table>
      <p>Оценки приведены по всей выбранной учебной неделе. Сокращение окон здесь не гарантируется глобальным оптимумом.</p>
     </div>
     <div className="sl-controls">
      <button type="button" className="sl-btn" disabled={stale}
       onClick={()=>setPreview(p=>!p)}><ArrowLeftRight size={15}/>
       {preview?'Скрыть изменения':'Показать все изменения'} <ChevronDown size={14}/></button>
      <button type="button" className="sl-btn" disabled={stale} onClick={exportReview}>
       <Download size={15}/> Скачать отчёт JSON</button>
     </div>
     {preview&&!stale&&<section className="sl-diff" aria-label="Предпросмотр пакета изменений">
      <h4>Список изменений: было → станет</h4>
      {selected.changes.map(c=><article className="sl-diff-row" key={c.before.id}>
       <b>{lessonLabel(c.before)}</b>
       <div><span>Было: {c.before.teacher}, каб. {c.before.room}</span>
        <ArrowLeftRight size={15}/>
        <span>Станет: {c.after.subject}, {c.after.teacher}, {c.after.mode==='online'?'онлайн':'каб. '+c.after.room}</span>
       </div><p>{c.reason}</p>
      </article>)}
      {!selected.changes.length&&<div className="sl-empty">Безопасных изменений нет.</div>}
      {selected.unresolved.length>0&&<div className="sl-unresolved">
       <h4><AlertTriangle size={15}/> Требуется ручное решение: {selected.unresolved.length}</h4>
       {selected.unresolved.map(x=><p key={x.lesson.id}><b>{lessonLabel(x.lesson)}</b> — {x.reason}</p>)}
      </div>}
     </section>}
     {selected.unresolved.length>0&&!preview&&<div className="sl-warning">
      <AlertTriangle size={17}/> {selected.unresolved.length} занятий не удалось перераспределить. Откройте предпросмотр для подробностей. Такой пакет нельзя применять целиком.</div>}
     <div className="sl-approval">
      <div><b>{selected.complete?'Пакет прошёл предварительную проверку':'Пакет требует доработки'}</b>
       <p>{selected.complete?'Будет выполнена повторная проверка по актуальному расписанию. Только после подтверждения пакет попадёт в черновик.':
        'Неполный пакет можно скачать для обсуждения, но нельзя молча применить или опубликовать.'}</p></div>
      <button type="button" className="sl-btn sl-strong" disabled={!selected.complete||stale||applied}
       onClick={confirm}><Check size={16}/>{applied?'Изменения добавлены в черновик':'Применить пакет к черновику'}</button>
     </div>
     {applied&&<div className="sl-done"><ShieldCheck size={17}/> Пакет применён к черновику. Верните последнее изменение кнопкой «Отменить» в расписании или Ctrl+Z. Публикация не выполнялась.</div>}
    </>}
   </>}
  </section>}
  <div className="sl-foot"><Info size={16}/>
   <span>Это сценарный анализ, а не официальный приказ о закрытии кабинета или отсутствии сотрудника.
    Само событие при необходимости регистрируется отдельно в существующем разделе.
    Автоматическая рассылка, согласование сотрудниками и публикация в этом модуле не выполняются.</span>
  </div>
 </section>;
}
