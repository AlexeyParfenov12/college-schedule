import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ClipboardCopy, Download, RotateCcw, Search, Table2, Users } from 'lucide-react';
import { GROUPS } from './data';
import type { CalendarEvent, Lesson } from './data';
import { affectedLessons, assignPeriod, CALENDAR_PHASES, calendarWeeks, checkCalendar, matrixCSV, phaseInfo, weekCell } from './calendarMatrixDomain';
import type { CalendarPhase, Week } from './calendarMatrixDomain';
import './calendar-matrix.css';

type Props={events:CalendarEvent[];lessons:Lesson[];group:string;setGroup:(group:string)=>void;replace:(events:CalendarEvent[])=>void};
type Selected={anchor:number;end:number;group:string};
const MONTHS=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const dateText=(iso:string)=>iso.slice(8)+'.'+iso.slice(5,7);
const csvDownload=(name:string,source:string,type:string)=>{
 const blob=new Blob([source],{type}),url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
 URL.revokeObjectURL(url);
};
function HeaderMonths({weeks}:{weeks:Week[]}){
 const segments:{month:number;year:number;length:number}[]=[];
 for(const w of weeks){
  const last=segments[segments.length-1];
  if(last&&last.month===w.month&&last.year===w.year)last.length++;
  else segments.push({month:w.month,year:w.year,length:1});
 }
 return <tr className="kug-months"><th className="kug-sticky-label">Специальность / группа</th>
  {segments.map((m,i)=><th key={i} colSpan={m.length}>{MONTHS[m.month]} {m.year}</th>)}</tr>;
}
export default function CalendarMatrix({events,lessons,group,setGroup,replace}:Props){
 const [year,setYear]=useState(2026);
 const [mode,setMode]=useState<'all'|'single'>('all');
 const [query,setQuery]=useState('');
 const [department,setDepartment]=useState('all');
 const [course,setCourse]=useState('all');
 const [selection,setSelection]=useState<Selected|null>(null);
 const [rows,setRows]=useState<string[]>([group]);
 const [phase,setPhase]=useState<CalendarPhase>('training');
 const [title,setTitle]=useState('');
 const [preview,setPreview]=useState(false);
 const [showCheck,setShowCheck]=useState(false);
 const [previous,setPrevious]=useState<CalendarEvent[]|null>(null);
 const [message,setMessage]=useState('');
 const dragging=useRef(false);
 const weeks=useMemo(()=>calendarWeeks(year),[year]);
 const groups=useMemo(()=>GROUPS.filter(g=>
  (department==='all'||g.department===department)&&
  (course==='all'||String(g.course)===course)&&
  (g.id+' '+g.specialty+' '+g.department).toLowerCase().includes(query.toLowerCase())
 ),[department,course,query]);
 const selectedGroups=rows.filter(g=>GROUPS.some(x=>x.id===g));
 const start=selection?Math.min(selection.anchor,selection.end):0;
 const end=selection?Math.max(selection.anchor,selection.end):0;
 const from=weeks[start]?.start||'',to=weeks[end]?.end||'';
 const affected=useMemo(()=>selection?affectedLessons(lessons,selectedGroups,from,to):[],[lessons,selection,selectedGroups.join('|'),from,to]);
 const findings=useMemo(()=>showCheck?checkCalendar(events,groups.map(x=>x.id),weeks):[],[showCheck,events,groups,weeks]);
 const phaseName=phaseInfo(phase).name;
 const selectCell=(g:string,index:number,shift=false)=>{
  if(!rows.includes(g))setRows([g]);
  setGroup(g);
  setSelection(old=>old&&shift?{anchor:old.anchor,end:index,group:g}:{anchor:index,end:index,group:g});
  setPreview(false);setMessage('');
 };
 useEffect(()=>{
  const stop=()=>dragging.current=false;
  window.addEventListener('mouseup',stop);
  return ()=>window.removeEventListener('mouseup',stop);
 },[]);
 const markRange=(g:string,index:number)=>{
  if(!dragging.current)return;
  setSelection(old=>old?{...old,end:index,group:g}:{anchor:index,end:index,group:g});
  setPreview(false);
 };
 const toggleRow=(id:string,checked:boolean)=>{
  setRows(old=>checked?[...new Set([...old,id])]:old.filter(x=>x!==id));
  setPreview(false);
 };
 const apply=()=>{
  if(!selection||!selectedGroups.length)return;
  const result=assignPeriod(events,selectedGroups,from,to,phase,title);
  setPrevious(events);replace(result);setPreview(false);setShowCheck(false);
  setMessage('Сохранено: '+selectedGroups.length+' групп, '+(end-start+1)+' недель. Можно отменить.');
 };
 const handleExport=()=>csvDownload('KUG-'+year+'-'+(year+1)+'.csv',
  matrixCSV(events,groups.map(g=>g.id),weeks),'text/csv;charset=utf-8');
 const handleJSON=()=>csvDownload('KUG-'+year+'-'+(year+1)+'.json',
  JSON.stringify({academicYear:year,periods:events},null,2),'application/json;charset=utf-8');
 const groupWeeks=weeks.map(w=>({week:w,cell:weekCell(events,group,w)}));
 return <section className="kug" data-testid="calendar-matrix">
  <header className="kug-top">
   <div><span className="kug-kicker">College Schedule · КУГ</span>
    <h2>Календарный учебный график</h2>
    <p>Сначала периоды групп — затем расписание занятий. Выдели недели и назначь вид учебной деятельности.</p>
   </div>
   <div className="kug-actions">
    <button onClick={handleExport}><Download size={15}/> CSV для Excel</button>
    <button onClick={handleJSON}><Download size={15}/> Резервная копия JSON</button>
    <button onClick={()=>window.print()}>Печать</button>
   </div>
  </header>
  <div className="kug-filters">
   <label>Учебный год<select aria-label="Учебный год КУГ" value={year} onChange={e=>{setYear(Number(e.target.value));setSelection(null);setPreview(false)}}>
    {[2025,2026,2027,2028].map(n=><option key={n} value={n}>{n}/{n+1}</option>)}</select></label>
   <label>Отделение<select aria-label="Отделение КУГ" value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">Все отделения</option>
    {[...new Set(GROUPS.map(g=>g.department))].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <label>Курс<select aria-label="Курс КУГ" value={course} onChange={e=>setCourse(e.target.value)}><option value="all">Все курсы</option>
    {[1,2,3,4].map(x=><option key={x} value={x}>{x} курс</option>)}</select></label>
   <label className="kug-search"><span>Поиск групп</span><span><Search size={15}/><input aria-label="Поиск группы КУГ" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Группа, специальность..."/></span></label>
   <div className="kug-modes" role="group" aria-label="Режим календаря">
    <button className={mode==='all'?'active':''} aria-pressed={mode==='all'} onClick={()=>setMode('all')}><Table2 size={15}/> Все группы</button>
    <button className={mode==='single'?'active':''} aria-pressed={mode==='single'} onClick={()=>setMode('single')}><Users size={15}/> Одна группа</button>
   </div>
  </div>
  {year!==2026&&<p className="kug-note">Выбран другой учебный год для просмотра и разметки. Расписание демонстрационного стенда пока привязано к датам с 9 ноября 2026 года; перенос дат его занятий на новый год не выполняется.</p>}
  <div className="kug-legend" aria-label="Обозначения периодов">
   {CALENDAR_PHASES.filter(x=>x.id!=='unassigned').map(p=><span key={p.id}><i className={'kug-fill kug-'+p.color}/><b>{p.short}</b> {p.name}</span>)}
   <span><i className="kug-fill kug-unassigned"/>— Не заполнено</span>
   <span><i className="kug-holiday"/> Праздник или выходной</span>
  </div>
  {mode==='all'?<>
   <div className="kug-matrix-help">Отметь группы флажками, затем выбери неделю. <b>Shift + нажатие</b> или протягивание мышью выделит интервал. На планшете можно задать номера недель в редакторе ниже.</div>
   <div className="kug-scroll" role="region" aria-label="Годовой график всех групп" tabIndex={0}>
    <table className="kug-table"><thead><HeaderMonths weeks={weeks}/>
     <tr className="kug-weekheads"><th className="kug-sticky-label">Группа · {weeks.length} недель</th>
      {weeks.map(w=><th key={w.index} title={w.start+' — '+w.end}><b>{w.index+1}</b><small>{dateText(w.start)}</small></th>)}</tr>
    </thead><tbody>
    {groups.map((g,i)=>{
     const sectionStart=i===0||groups[i-1].department!==g.department||groups[i-1].specialty!==g.specialty;
     return [sectionStart?<tr key={'s-'+g.id} className="kug-section"><th colSpan={weeks.length+1}>{g.department} · {g.specialty}</th></tr>:null,
      <tr key={g.id} className={rows.includes(g.id)?'kug-group-selected':''}>
       <th scope="row" className="kug-sticky-label"><label><input type="checkbox" aria-label={'Выбрать группу '+g.id}
        checked={rows.includes(g.id)} onChange={e=>toggleRow(g.id,e.target.checked)}/><span>{g.id}</span></label></th>
       {weeks.map(w=>{
        const cell=weekCell(events,g.id,w);
        const highlighted=rows.includes(g.id)&&selection&&w.index>=start&&w.index<=end;
        const chosen=phaseInfo(cell.phase);
        return <td key={w.index}><button type="button" aria-label={g.id+', неделя '+(w.index+1)+': '+(cell.mixed?'Смешанная неделя':chosen.name)}
         title={g.id+' · '+w.start+' — '+w.end+'\n'+(cell.mixed?cell.parts.map(p=>phaseInfo(p).name).join(' / '):chosen.name)+(cell.holidays?'\nПраздничных/неучебных дней: '+cell.holidays:'')}
         className={'kug-cell kug-'+chosen.color+(cell.mixed?' kug-mixed':'')+(highlighted?' kug-picked':'')+(cell.holidays?' kug-has-holiday':'')}
         onClick={e=>selectCell(g.id,w.index,e.shiftKey)}
         onMouseDown={()=>{dragging.current=true}}
         onMouseEnter={e=>{if(e.buttons===1)markRange(g.id,w.index)}}
         onMouseUp={()=>dragging.current=false}>
         <span>{cell.mixed?'◐':chosen.short}</span>{cell.holidays>0&&<i aria-hidden="true"/>}
        </button></td>
       })}
      </tr>];
    })}
    </tbody></table>
   </div>
  </>:<div className="kug-single">
   <div className="kug-single-head"><label>Группа<select aria-label="Группа для подробного календаря" value={group}
    onChange={e=>{setGroup(e.target.value);setRows([e.target.value]);setSelection(null)}}>
    {GROUPS.map(g=><option key={g.id} value={g.id}>{g.id} · {g.specialty}</option>)}</select></label>
    <span>Нажми на неделю, чтобы изменить период. Смешанные недели обозначены символом ◐.</span>
   </div>
   <div className="kug-single-weeks">{groupWeeks.map(({week:w,cell})=><button key={w.index} type="button"
    className={'kug-single-week kug-'+phaseInfo(cell.phase).color+(cell.mixed?' kug-mixed':'')+(selection&&w.index>=start&&w.index<=end?' kug-picked':'')}
    onClick={e=>selectCell(group,w.index,e.shiftKey)}>
    <b>{w.index+1}-я неделя · {dateText(w.start)}—{dateText(w.end)}</b>
    <span>{cell.mixed?cell.parts.map(p=>phaseInfo(p).name).join(' / '):phaseInfo(cell.phase).name}</span>
    {cell.holidays>0&&<small>{cell.holidays} вых./праздн.</small>}
   </button>)}</div>
  </div>}
  <div className="kug-editor" aria-label="Быстрое заполнение учебных недель">
   <div className="kug-editor-title"><b>Быстрое заполнение</b><span>{selectedGroups.length} групп · {selection?'Недели '+(start+1)+'–'+(end+1):'Выбери неделю'}</span></div>
   <div className="kug-editor-fields">
    <label>С недели<select aria-label="Начало диапазона КУГ" value={start} onChange={e=>{const n=Number(e.target.value);setSelection({anchor:n,end:Math.max(n,end),group});setPreview(false)}}>
     {weeks.map(w=><option key={w.index} value={w.index}>{w.index+1} · {dateText(w.start)}</option>)}</select></label>
    <label>По неделю<select aria-label="Конец диапазона КУГ" value={end} onChange={e=>{const n=Number(e.target.value);setSelection({anchor:Math.min(start,n),end:n,group});setPreview(false)}}>
     {weeks.map(w=><option key={w.index} value={w.index}>{w.index+1} · {dateText(w.end)}</option>)}</select></label>
    <label>Вид периода<select aria-label="Вид периода КУГ" value={phase} onChange={e=>{setPhase(e.target.value as CalendarPhase);setTitle('');setPreview(false)}}>
     {CALENDAR_PHASES.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Уточнение названия<input aria-label="Название периода КУГ" value={title} onChange={e=>setTitle(e.target.value)} placeholder={phaseName}/></label>
   </div>
   <div className="kug-editor-actions">
    <button className="kug-primary" disabled={!selection||selectedGroups.length===0} onClick={()=>setPreview(true)}><ClipboardCopy size={15}/> Рассчитать изменения</button>
    {previous&&<button onClick={()=>{replace(previous);setPrevious(null);setPreview(false);setMessage('Последняя операция отменена')}}><RotateCcw size={15}/> Отменить</button>}
    <button onClick={()=>setShowCheck(v=>!v)}><AlertTriangle size={15}/> {showCheck?'Скрыть проверку':'Проверить график'}</button>
   </div>
   {preview&&<div className="kug-preview" role="status">
    <strong>Предварительный просмотр</strong>
    <p>Период «{title||phaseName}» для {selectedGroups.length} групп; {from} — {to} ({end-start+1} недель).</p>
    <p>Затронутых уже назначенных занятий: <b>{affected.length}</b>. Их не удаляем. {affected.length?'Они потребуют проверки и при необходимости перепланирования.':'Конфликтов с текущими занятиями по этому диапазону нет.'}</p>
    {affected.some(l=>l.status==='held')&&<p className="kug-alert">В выбранном диапазоне есть проведённые занятия. Изменение графика не изменяет их статусы.</p>}
    <button className="kug-primary" onClick={apply}><Check size={15}/> Подтвердить и сохранить</button>
    <button onClick={()=>setPreview(false)}>Отмена</button>
   </div>}
   {message&&<p className="kug-note" role="status">{message}</p>}
  </div>
  {showCheck&&<div className="kug-check" role="region" aria-label="Проверка календарного графика">
   <h3>Проверка заполнения · {findings.filter(f=>f.level==='error').length} незаполненных, {findings.filter(f=>f.level==='warning').length} смешанных недель</h3>
   {findings.slice(0,50).map((f,i)=><button key={i} onClick={()=>{setRows([f.group]);setGroup(f.group);setSelection({anchor:f.week,end:f.week,group:f.group});setMode('all')}}>
    <b>{f.group} · неделя {f.week+1}</b><span>{f.message}</span></button>)}
   {findings.length>50&&<p>Показано первых 50 из {findings.length}. Используй фильтр отделения или группы для уточнения.</p>}
   {!findings.length&&<p>Для выбранных групп нет незаполненных или смешанных недель.</p>}
  </div>}
  <footer className="kug-footer">Праздники и официальные нерабочие дни рассчитываются отдельно и не изменяют основной тип периода. Экспорт CSV открывается в Excel; прямой импорт XLSX и серверное утверждение пока не подключены.</footer>
 </section>;
}
