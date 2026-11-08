import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, ClipboardCopy, Download, RotateCcw, Search, Table2, Users } from 'lucide-react';
import { GROUPS } from './data';
import type { CalendarEvent, Lesson } from './data';
import { assignPeriod, calendarChangeImpact, CALENDAR_PHASES, calendarWeeks, checkCalendar, copyGroupCalendar, importMatrixCSV, kugWeekDays, matrixCSV, matrixTemplateCSV, parseCalendarBackup, phaseInfo, weekCell } from './calendarMatrixDomain';
import type { MatrixImport } from './calendarMatrixDomain';
import type { CalendarPhase, Week } from './calendarMatrixDomain';
import { classifyCalendarDay, readCollegeWorkweek, productionDiffersFromBaseline } from './productionCalendar';
import { useProductionCalendarState } from './productionCalendarSync';
import { calendarIssues, lessonDate } from './plannerDomain';
import type { CalendarDay } from './productionCalendar';
import { plusDays } from './calendarMatrixDomain';
import './calendar-matrix.css';
import CalendarAdminCenter from './CalendarAdminCenter';
import { useCollegeOverrideRevision } from './collegeDayOverrides';

type Props={events:CalendarEvent[];lessons:Lesson[];group:string;setGroup:(group:string)=>void;replace:(events:CalendarEvent[])=>void};
type Selected={anchor:number;end:number;group:string};
type ViewMode='year'|'large'|'single';
type CompactSpan='all'|'quarter';
type Density='compact'|'standard'|'detailed';
type IssueFilter='all'|'unassigned'|'conflicts'|'practice';
const groupKey=(department:string,course:number)=>department+'::'+course;
const MONTHS=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const statusName:Record<string,string>={shortened:'Сокращённый день', 'college-off':'Дополнительный выходной колледжа','college-work':'Рабочий день колледжа','college-shortened':'Сокращённый день колледжа',work:'Рабочий день',weekend:'Выходной',holiday:'Государственный праздник',transfer:'Перенесённый выходной','working-weekend':'Рабочая суббота',college:'Нерабочий день колледжа'};
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
 const production=useProductionCalendarState();
 const collegeRevision=useCollegeOverrideRevision();
 const [year,setYear]=useState(2026);
 const [mode,setMode]=useState<ViewMode>('year');
 const [density,setDensity]=useState<Density>('compact');
 const [compactSpan,setCompactSpan]=useState<CompactSpan>('all');
 const [adminOpen,setAdminOpen]=useState(false);
 const [quarter,setQuarter]=useState<0|4|8>(0);
 const [issueFilter,setIssueFilter]=useState<IssueFilter>('all');
 const [collapsed,setCollapsed]=useState<string[]>([]);
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
 const [importPending,setImportPending]=useState<MatrixImport|null>(null);
 const [importError,setImportError]=useState('');
 const [backupPending,setBackupPending]=useState<CalendarEvent[]|null>(null);
 const [backupError,setBackupError]=useState('');
 const [copyTarget,setCopyTarget]=useState('П-22');
 const [copyOverwrite,setCopyOverwrite]=useState(false);
 const [copyPending,setCopyPending]=useState<CalendarEvent[]|null>(null);
 const [exactFrom,setExactFrom]=useState('');
 const [exactTo,setExactTo]=useState('');
 const dragging=useRef(false);
 const weeks=useMemo(()=>calendarWeeks(year),[year]);
 const baseGroups=useMemo(()=>GROUPS.filter(g=>
  (department==='all'||g.department===department)&&
  (course==='all'||String(g.course)===course)&&
  (g.id+' '+g.specialty+' '+g.department).toLowerCase().includes(query.trim().toLowerCase())
 ),[department,course,query]);
 const calendarWorkweek=readCollegeWorkweek();
 // Cache official non-working days once per displayed year, not per group and cell.
 const officialDays=useMemo(()=>{
  const dates=new Map<string,CalendarDay>(),workweek=calendarWorkweek;
  for(const week of weeks)for(let date=week.from;date<=week.to;date=plusDays(date,1)){
   if(!dates.has(date))dates.set(date,classifyCalendarDay(date,workweek));
  }
  return dates;
 },[weeks,production.revision,calendarWorkweek,collegeRevision]);
 const closedDays=useMemo(()=>new Map([...officialDays].map(([date,day])=>[date,day.nonWorking])),[officialDays]);
 const affectedLessons=useMemo(()=>lessons.filter(l=>l.status!=='cancelled'&&
   productionDiffersFromBaseline(lessonDate(l.week||0,l.day),calendarWorkweek)),[lessons,calendarWorkweek,production.revision]);
 const cells=useMemo(()=>{
  const result=new Map<string,ReturnType<typeof weekCell>>();
  for(const g of baseGroups)for(const w of weeks)result.set(g.id+':'+w.index,weekCell(events,g.id,w,closedDays));
  return result;
 },[baseGroups,weeks,events,closedDays]);
 const problemGroups=useMemo(()=>{
  const match=new Set<string>();
  if(issueFilter==='all')return match;
  for(const g of baseGroups){
   const statuses=weeks.map(w=>cells.get(g.id+':'+w.index)!);
   if(issueFilter==='unassigned'&&statuses.some(x=>x.unassignedDays>0))match.add(g.id);
   if(issueFilter==='practice'&&statuses.some(x=>x.parts.some(p=>p==='training'||p==='industrial'||p==='prediploma')))match.add(g.id);
  }
  if(issueFilter==='conflicts'){
   const findings=checkCalendar(events,baseGroups.map(g=>g.id),weeks,closedDays);
   for(const finding of findings)if(/Конфликт периодов|Дублирующиеся/.test(finding.message))match.add(finding.group);
   for(const lesson of lessons)if(lesson.status!=='cancelled'&&calendarIssues(lesson,events,calendarWorkweek).length)
    for(const id of lesson.groups)match.add(id);
  }
  return match;
 },[issueFilter,baseGroups,weeks,cells,events,closedDays,lessons,calendarWorkweek]);
 const groups=useMemo(()=>baseGroups.filter(g=>issueFilter==='all'||problemGroups.has(g.id)),[baseGroups,issueFilter,problemGroups]);
 const visibleWeeks=useMemo(()=>{
  if(mode!=='year'||compactSpan!=='quarter')return weeks;
  const first=quarter===0?year+'-09-01':quarter===4?(year+1)+'-01-01':(year+1)+'-05-01';
  const last=quarter===0?year+'-12-31':quarter===4?(year+1)+'-04-30':(year+1)+'-08-31';
  return weeks.filter(w=>w.end>=first&&w.start<=last);
 },[weeks,mode,compactSpan,quarter,year]);
 const warningCount=(production.discrepancies.length||production.warnings.length)+(production.officialMonitor?.candidates.length||0);
 const selectedGroups=rows.filter(g=>GROUPS.some(x=>x.id===g));
 const start=selection?Math.min(selection.anchor,selection.end):0;
 const end=selection?Math.max(selection.anchor,selection.end):0;
 const from=exactFrom||weeks[start]?.start||'',to=exactTo||weeks[end]?.end||'';
 const academicStart=year+'-09-01',academicEnd=(year+1)+'-08-31';
 const validRange=Boolean(selection&&selectedGroups.length&&from&&to&&from<=to&&from>=academicStart&&to<=academicEnd);
 const projected=useMemo(()=>preview&&validRange?
  assignPeriod(events,selectedGroups,from,to,phase,title):null,
  [preview,validRange,events,selectedGroups.join('|'),from,to,phase,title]);
 const impact=useMemo(()=>projected?calendarChangeImpact(events,projected,lessons,selectedGroups,from,to):null,
  [projected,events,lessons,selectedGroups.join('|'),from,to]);
 const copyReceiver=copyTarget===group?(GROUPS.find(g=>g.id!==group)?.id||copyTarget):copyTarget;
 const findings=useMemo(()=>showCheck?checkCalendar(events,groups.map(x=>x.id),weeks,closedDays):[],[showCheck,events,groups,weeks,closedDays]);
 const phaseName=phaseInfo(phase).name;
 const selectCell=(g:string,index:number,shift=false)=>{
  if(!rows.includes(g))setRows([g]);
  setGroup(g);
  setSelection(old=>old&&shift?{anchor:old.anchor,end:index,group:g}:{anchor:index,end:index,group:g});
  setPreview(false);setExactFrom('');setExactTo('');setMessage('');
 };
 useEffect(()=>{
  const stop=()=>dragging.current=false;
  window.addEventListener('mouseup',stop);
  return ()=>window.removeEventListener('mouseup',stop);
 },[]);
 const markRange=(g:string,index:number)=>{
  if(!dragging.current)return;
  setSelection(old=>old?{...old,end:index,group:g}:{anchor:index,end:index,group:g});
  setPreview(false);setExactFrom('');setExactTo('');
 };
 const toggleRow=(id:string,checked:boolean)=>{
  setRows(old=>checked?[...new Set([...old,id])]:old.filter(x=>x!==id));
  setPreview(false);
 };
 const apply=()=>{
  if(!validRange||!projected)return;
  setPrevious(events);replace(projected);setPreview(false);setShowCheck(false);
  setMessage('Сохранено: '+selectedGroups.length+' групп · '+from+' — '+to+'. Можно отменить.');
 };
 const handleTemplate=()=>csvDownload('KUG-шаблон-'+year+'-'+(year+1)+'.csv',
  matrixTemplateCSV(GROUPS.map(g=>g.id),weeks),'text/csv;charset=utf-8');
 const handleExport=()=>csvDownload('KUG-'+year+'-'+(year+1)+'.csv',
  matrixCSV(events,groups.map(g=>g.id),weeks),'text/csv;charset=utf-8');
 const handleJSON=()=>csvDownload('KUG-'+year+'-'+(year+1)+'.json',
  JSON.stringify({version:1,academicYear:year,periods:events},null,2),'application/json;charset=utf-8');
 const readCSV=async(file?:File)=>{
  if(!file)return;
  setImportError('');setImportPending(null);setBackupPending(null);
  if(file.size>2_000_000){setImportError('CSV превышает 2 МБ. Проверь размер файла.');return}
  try{
   const parsed=importMatrixCSV(await file.text(),events,year,GROUPS.map(g=>g.id));
   setImportPending(parsed);
  }catch(error){setImportError(error instanceof Error?error.message:'Не удалось проверить CSV')}
 };
 const readBackup=async(file?:File)=>{
  if(!file)return;
  setBackupError('');setBackupPending(null);setImportPending(null);
  if(file.size>4_000_000){setBackupError('Размер JSON превышает 4 МБ');return}
  try{
   const restored=parseCalendarBackup(await file.text(),year,GROUPS.map(g=>g.id));
   setBackupPending(restored);
  }catch(error){setBackupError(error instanceof Error?error.message:'Ошибка проверки резервной копии')}
 };
 const confirmBackup=()=>{
  if(!backupPending)return;
  setPrevious(events);replace(backupPending);setBackupPending(null);
  setImportPending(null);setPreview(false);setShowCheck(false);
  setMessage('Календарь восстановлен из JSON: '+backupPending.length+' периодов. Проверь учебные графики и расписание.');
 };
 const confirmImport=()=>{
  if(!importPending)return;
  setPrevious(events);replace(importPending.next);
  setMessage('Импортировано '+importPending.groups+' групп и '+importPending.ranges+' интервалов. Расписание требует повторной проверки.');
  setImportPending(null);setPreview(false);setShowCheck(false);
 };
 const prepareCopy=()=>{
  try{
   const result=copyGroupCalendar(events,group,copyReceiver,year,copyOverwrite);
   if(result===events||JSON.stringify(result)===JSON.stringify(events)){setMessage('Нет доступных пустых периодов для копирования. При необходимости разреши замену текущего графика.');return}
   setCopyPending(result);setMessage('');
  }catch(error){setMessage(error instanceof Error?error.message:'Не удалось сформировать копию')}
 };
 const confirmCopy=()=>{
  if(!copyPending)return;
  setPrevious(events);replace(copyPending);setCopyPending(null);
  setMessage('График группы '+group+' скопирован в '+copyReceiver+'. Проверь связанные занятия.');
 };
 const groupWeeks=useMemo(()=>weeks.map(w=>({week:w,cell:weekCell(events,group,w,closedDays),
  days:kugWeekDays(events,group,w,officialDays,calendarWorkweek)})),[weeks,events,group,closedDays,officialDays,calendarWorkweek]);
 const activeWeek=selection?weeks[selection.anchor]:null;
 const detailDays=useMemo(()=>activeWeek?kugWeekDays(events,group,activeWeek,officialDays,calendarWorkweek):[],
  [events,group,activeWeek,officialDays,calendarWorkweek]);
 const sections=useMemo(()=>{
  const buckets=new Map<string,typeof groups>();
  for(const g of [...groups].sort((a,b)=>a.department.localeCompare(b.department,'ru')||a.course-b.course||a.id.localeCompare(b.id,'ru'))){
   const key=groupKey(g.department,g.course);
   if(!buckets.has(key))buckets.set(key,[]);
   buckets.get(key)!.push(g);
  }
  return [...buckets.entries()].map(([key,items])=>({key,items,label:items[0].department+' · '+items[0].course+' курс'}));
 },[groups]);
 const largeWeekDays=useMemo(()=>{
  const cache=new Map<string,ReturnType<typeof kugWeekDays>>();
  if(mode!=='large')return cache;
  for(const g of groups)for(const week of weeks)
   cache.set(g.id+':'+week.index,kugWeekDays(events,g.id,week,officialDays,calendarWorkweek));
  return cache;
 },[mode,groups,weeks,events,officialDays,calendarWorkweek]);
 const tableRows=useMemo(()=>sections.flatMap(section=>{
  const hidden=collapsed.includes(section.key)&&!query.trim();
  const heading=<tr key={'section-'+section.key} className="kug-section"><th colSpan={visibleWeeks.length+1}>
   <button type="button" aria-expanded={!hidden} aria-label={(hidden?'Развернуть ':'Свернуть ')+section.label}
    onClick={()=>setCollapsed(old=>old.includes(section.key)?old.filter(x=>x!==section.key):[...old,section.key])}>
    {hidden?<ChevronRight size={13}/>:<ChevronDown size={13}/>} {section.label}<span>{section.items.length} групп</span>
   </button></th></tr>;
  if(hidden)return [heading];
  return [heading,...section.items.map(g=><tr key={g.id} className={rows.includes(g.id)?'kug-group-selected':''}>
   <th scope="row" className="kug-sticky-label"><label><input type="checkbox" aria-label={'Выбрать группу '+g.id}
    checked={rows.includes(g.id)} onChange={e=>toggleRow(g.id,e.target.checked)}/><span>{g.id}</span></label></th>
   {visibleWeeks.map(w=>{
    const cell=cells.get(g.id+':'+w.index)!;
    const picked=Boolean(rows.includes(g.id)&&selection&&w.index>=start&&w.index<=end);
    const chosen=phaseInfo(cell.phase);
    const special=events.some(e=>e.kind==='holiday'&&e.groups.includes(g.id)&&e.from<=w.end&&e.to>=w.start);
    return <td key={w.index}><button type="button" aria-label={g.id+', неделя '+(w.index+1)+': '+(cell.mixed?'Смешанная неделя':chosen.name)}
     title={g.id+' · '+w.start+' — '+w.end+'\n'+(cell.mixed?cell.parts.map(p=>phaseInfo(p).name).join(' / '):chosen.name)}
     className={'kug-cell kug-'+chosen.color+(cell.mixed?' kug-mixed':'')+(picked?' kug-picked':'')+(special?' kug-group-exception':'')}
     onClick={e=>selectCell(g.id,w.index,e.shiftKey)}
     onMouseDown={()=>{dragging.current=true}}
     onMouseEnter={e=>{if(e.buttons===1)markRange(g.id,w.index)}}
     onMouseUp={()=>dragging.current=false}>
     <span className="kug-cell-label">{cell.mixed?'◐':chosen.short}</span>
     {mode==='large'&&<span className="kug-day-strip kug-large-weekdays" aria-label="Дни недели">
      {(largeWeekDays.get(g.id+':'+w.index)||[]).map(day=>
       <i key={day.date} title={day.dayName+': '+day.label}
        className={'kug-day-dot '+(day.withinYear?'kug-day-'+day.kind:'kug-day-outside')}/>)}
     </span>}
     {cell.unassignedDays>0&&<i className="kug-cell-unassigned" aria-hidden="true"/>}
     {special&&<i className="kug-cell-exception" aria-hidden="true"/>}
    </button></td>;
   })}
  </tr>)];
 }),[sections,collapsed,query,visibleWeeks,rows,selection,start,end,cells,events,mode,largeWeekDays]);
 const globalCalendarRow=<tr className="kug-calendar-row">
  <th scope="row" className="kug-sticky-label">Праздники и выходные</th>
  {visibleWeeks.map(w=><td key={w.index}><button type="button" className="kug-calendar-week"
    aria-label={'Производственный календарь, неделя '+(w.index+1)}
    title={Array.from({length:7},(_,i)=>officialDays.get(plusDays(w.from,i)))
     .filter((d):d is CalendarDay=>d!==undefined&&d.nonWorking)
     .map(d=>dateText(d.date)+': '+d.label).join('\n')||'Нерабочих дней нет'}
    onClick={()=>selectCell(group,w.index)}>
    {Array.from({length:7},(_,i)=>{
     const date=plusDays(w.from,i),day=officialDays.get(date);
     return <i key={date} aria-hidden="true"
      className={'kug-day-dot '+(date<w.start||date>w.end?'kug-day-outside':'kug-day-'+(day?.kind||'work'))}/>;
    })}
   </button></td>)}
 </tr>;
 return <section className={'kug kug-density-'+density+' kug-view-'+mode} data-testid="calendar-matrix">
  <header className="kug-top">
   <div><span className="kug-kicker">College Schedule · КУГ</span>
    <h2>Календарный учебный график</h2>
    <p>Сначала периоды групп — затем расписание занятий. Выдели недели и назначь вид учебной деятельности.</p>
   </div>
   <details className="kug-tools"><summary>Шаблон таблицы, импорт и экспорт</summary>
    <div className="kug-template-guide">
     <strong>Заполнение учебного календаря через Excel</strong>
     <ol>
      <li>Скачай пустой шаблон CSV с группами и датами всех недель выбранного учебного года.</li>
      <li>Открой его в Excel. В нужных неделях впиши код периода, сохрани файл в формате <b>CSV UTF-8 с разделителем «;»</b>.</li>
      <li>Загрузи файл обратно. Проверь число изменяемых ячеек и подтверди импорт.</li>
     </ol>
     <p><b>Пустая ячейка</b> — оставить существующий график без изменения.
      Код <b>—</b> — намеренно очистить выбранную неделю.
      Для дней с разными периодами используй семь кодов, разделённых знаком <b>|</b> (с понедельника по воскресенье).</p>
     <div className="kug-template-codes" aria-label="Допустимые коды периодов">
      {CALENDAR_PHASES.map(p=><span key={p.id}><b>{p.short}</b> — {p.name}</span>)}
     </div>
     <p>Не меняй заголовки с датами и названия групп. В шаблоне можно удалить строки групп, которые не требуется импортировать. Праздники и выходные учитываются системой отдельно.</p>
    </div>
    <div className="kug-actions">
    <button type="button" className="kug-primary" onClick={handleTemplate}><Download size={15}/> Скачать пустой шаблон CSV</button>
    <button onClick={handleExport}><Download size={15}/> Скачать текущий график CSV</button>
    <button onClick={handleJSON}><Download size={15}/> Резервная копия JSON</button>
    <label className="kug-import-label"><span>Загрузить заполненный CSV</span><input type="file" accept=".csv,text/csv" aria-label="Загрузить график из CSV" onChange={e=>{void readCSV(e.target.files?.[0]);e.target.value=''}}/></label>
    <label className="kug-import-label"><span>Восстановить JSON</span><input type="file" accept=".json,application/json" aria-label="Восстановить календарь из JSON" onChange={e=>{void readBackup(e.target.files?.[0]);e.target.value=''}}/></label>
    <button onClick={()=>window.print()}>Печать</button>
   </div></details>
  </header>
  {importError&&<p className="kug-alert" role="alert">{importError}</p>}
  {backupError&&<p className="kug-alert" role="alert">{backupError}</p>}
  {backupPending&&<div className="kug-preview" role="status">
   <strong>Восстановление резервной копии</strong>
   <p>В файле {backupPending.length} учебных периодов. После подтверждения будет полностью заменён текущий локальный календарь, включая периоды других учебных лет. Расписание занятий не удаляется.</p>
   <p className="kug-alert">Внимание: проверь источник файла перед подтверждением.</p>
   <button className="kug-primary" onClick={confirmBackup}><Check size={15}/> Подтвердить замену всего календаря</button>
   <button onClick={()=>setBackupPending(null)}>Отмена</button>
  </div>}
  {importPending&&<div className="kug-preview" role="status">
   <strong>Предпросмотр импорта</strong>
   <p>Будут изменены <b>{importPending.cells} недельных ячеек</b> в <b>{importPending.groups} группах</b> ({importPending.ranges} непрерывных периодов).</p>
   <p><b>Пустые ячейки не изменяют существующий график.</b> Другие группы, неуказанные недели и учебные годы сохраняются. Проверь связанные занятия перед подтверждением.</p>
   <button className="kug-primary" onClick={confirmImport}><Check size={15}/> Применить импорт</button>
   <button onClick={()=>setImportPending(null)}>Отмена</button>
  </div>}
  {year!==2026&&<p className="kug-note">Выбран другой учебный год для просмотра и разметки. Расписание демонстрационного стенда пока привязано к датам с 9 ноября 2026 года; перенос дат его занятий на новый год не выполняется.</p>}
  <div className="kug-production-status" role="status">
   <div><strong>Производственный календарь · {calendarWorkweek}-дневная неделя</strong>
    <span>{production.status==='updated'
      ?'Сверено со справочным источником '+production.checkedAt.slice(0,10)
      :production.message}. Данные будущих лет до утверждения постановления предварительные.</span></div>
   <a href="https://www.consultant.ru/law/ref/calendar/proizvodstvennye/" target="_blank" rel="noreferrer">Сверить с нормативным календарём</a>
   {production.warnings.length>0&&<b className="kug-production-affected">
    Расхождений со справочным API: {production.warnings.length}. Причины и документы — ниже, в Центре календаря.
   </b>}
   {affectedLessons.length>0&&<b className="kug-production-affected">Проверьте {affectedLessons.length} занятий после обновления</b>}
  </div>
  <div className="kug-admin-accordion">
    <button type="button" className="kug-admin-toggle" aria-expanded={adminOpen}
     aria-controls="kug-admin-center" onClick={()=>setAdminOpen(value=>!value)}>
     <span className="kug-admin-toggle-main">
      <span className="kug-admin-chevron">{adminOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</span>
      <strong>Центр календаря учебной части</strong>
      {warningCount>0&&<span className="kug-admin-count">{warningCount} требуют проверки</span>}
     </span>
     <span className="kug-admin-toggle-action">{adminOpen?'Скрыть':'Раскрыть'}</span>
    </button>
    {adminOpen&&<div id="kug-admin-center" className="kug-admin-content">
      <CalendarAdminCenter lessons={lessons}/>
    </div>}
   </div>
  <details className="kug-legend-details"><summary>Условные обозначения периодов и календарных дней</summary><div className="kug-legend" aria-label="Обозначения периодов">
   {CALENDAR_PHASES.filter(x=>x.id!=='unassigned').map(p=><span key={p.id}><i className={'kug-fill kug-'+p.color}/><b>{p.short}</b> {p.name}</span>)}
   <span><i className="kug-fill kug-unassigned"/>— Не заполнено</span>
   <span className="kug-legend-day"><i className="kug-day-dot kug-day-weekend"/> Выходной</span>
   <span className="kug-legend-day"><i className="kug-day-dot kug-day-holiday"/> Праздник</span>
   <span className="kug-legend-day"><i className="kug-day-dot kug-day-transfer"/> Перенос выходного</span>
   <span className="kug-legend-day"><i className="kug-day-dot kug-day-working-weekend"/> Рабочая суббота</span>
   <span className="kug-legend-day"><i className="kug-day-dot kug-day-shortened"/> Сокращённый день</span>
   <span className="kug-legend-day"><i className="kug-day-dot kug-day-college"/> Доп. выходной колледжа</span>
   <span className="kug-legend-day"><i className="kug-day-dot kug-day-college-work"/> Рабочий день колледжа</span>
  </div></details>
  <div className="kug-workspace">
   <div className="kug-workspace-main">
    <div className="kug-table-controls">
  <div className="kug-filters">
   <label>Учебный год<select aria-label="Учебный год КУГ" value={year} onChange={e=>{setYear(Number(e.target.value));setSelection(null);setPreview(false);setImportPending(null);setBackupPending(null);setCopyPending(null)}}>
    {[2025,2026,2027,2028].map(n=><option key={n} value={n}>{n}/{n+1}</option>)}</select></label>
   <label>Отделение<select aria-label="Отделение КУГ" value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">Все отделения</option>
    {[...new Set(GROUPS.map(g=>g.department))].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <label>Курс<select aria-label="Курс КУГ" value={course} onChange={e=>setCourse(e.target.value)}><option value="all">Все курсы</option>
    {[1,2,3,4].map(x=><option key={x} value={x}>{x} курс</option>)}</select></label>
   <label className="kug-search"><span>Поиск групп</span><span><Search size={15}/><input aria-label="Поиск группы КУГ" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Группа, специальность..."/></span></label>
   <label>Показать<select aria-label="Фильтр проблем КУГ" value={issueFilter} onChange={e=>{setIssueFilter(e.target.value as IssueFilter);setSelection(null);setPreview(false)}}>
    <option value="all">Все группы</option><option value="unassigned">С незаполненными днями</option>
    <option value="conflicts">С конфликтами</option><option value="practice">С практикой</option>
   </select></label>
   <div className="kug-modes" role="group" aria-label="Режим календаря">
    <button className={mode==='year'?'active':''} aria-pressed={mode==='year'} onClick={()=>{setMode('year');setSelection(null);setPreview(false)}}><Table2 size={15}/> Компактная таблица</button>
    <button className={mode==='large'?'active':''} aria-pressed={mode==='large'} onClick={()=>{setMode('large');setSelection(null);setPreview(false)}}><Table2 size={15}/> Большая таблица</button>
    <button className={mode==='single'?'active':''} aria-pressed={mode==='single'} onClick={()=>{setMode('single');setSelection(null);setPreview(false)}}><Users size={15}/> Группа</button>
   </div>
  </div>
  <div className="kug-display-options">
   {mode==='year'&&<label>Период<select aria-label="Масштаб компактного календаря" value={compactSpan}
    onChange={e=>{setCompactSpan(e.target.value as CompactSpan);setSelection(null);setPreview(false)}}>
    <option value="all">Весь год</option><option value="quarter">4 месяца</option>
   </select></label>}
   {mode==='year'&&compactSpan==='quarter'&&<div className="kug-term-switch" role="group" aria-label="Период четырёх месяцев">
    {([{start:0,label:'Сентябрь — декабрь'},{start:4,label:'Январь — апрель'},{start:8,label:'Май — август'}] as const)
     .map(t=><button type="button" key={t.start} className={quarter===t.start?'active':''} aria-pressed={quarter===t.start}
     onClick={()=>{setQuarter(t.start);setSelection(null);setPreview(false)}}>{t.label}</button>)}
   </div>}
   {mode!=='large'&&<label>Плотность<select aria-label="Плотность календаря" value={density} onChange={e=>setDensity(e.target.value as Density)}>
    <option value="compact">Компактная</option><option value="standard">Стандартная</option>
    <option value="detailed">Подробная</option>
   </select></label>}
   {mode==='large'&&<span>Подробные ячейки с отметками дней</span>}
   <span>{visibleWeeks.length} недель · {groups.length} групп</span>
  </div>
    </div>
    {mode!=='single'?<>
     <div className="kug-matrix-help">
      <span>Выбери группу и неделю. <b>Shift + нажатие</b> или протягивание выделит диапазон.</span>
      <div className="kug-row-actions">
       <button type="button" onClick={()=>{setRows(old=>[...new Set([...old,...groups.map(g=>g.id)])]);setPreview(false)}}>Выбрать все видимые ({groups.length})</button>
       <button type="button" onClick={()=>{setRows([]);setPreview(false)}}>Снять выбор</button>
       <span>Выбрано групп: {selectedGroups.length}</span>
      </div>
     </div>
     <div className="kug-scroll" role="region" aria-label="Годовой график всех групп" tabIndex={0}>
      <table className="kug-table"><thead><HeaderMonths weeks={visibleWeeks}/>
       <tr className="kug-weekheads"><th className="kug-sticky-label">Группа · {visibleWeeks.length} нед.</th>
        {visibleWeeks.map(w=><th key={w.index} title={w.start+' — '+w.end}>
         <b>{w.index+1}</b><small>{dateText(w.start)}</small></th>)}
       </tr>
      </thead><tbody>{globalCalendarRow}{tableRows}</tbody></table>
     </div>
     {groups.length===0&&<p className="kug-empty" role="status">По заданным фильтрам группы не найдены. Сбрось фильтр или уточни поиск.</p>}
    </>:<div className="kug-single">
     <div className="kug-single-head">
      <label>Группа<select aria-label="Группа для подробного календаря" value={group}
       onChange={e=>{setGroup(e.target.value);setRows([e.target.value]);setSelection(null)}}>
       {GROUPS.map(g=><option key={g.id} value={g.id}>{g.id} · {g.specialty}</option>)}
      </select></label>
      <span>Все недели группы: период, даты и отметки дней. Нажми на неделю, чтобы изменить график.</span>
     </div>
     <div className="kug-single-weeks" role="group" aria-label={'Годовая линия группы '+group}>
      {groupWeeks.map(({week:w,cell,days})=><button key={w.index} type="button"
       aria-label={group+', неделя '+(w.index+1)+': '+(cell.mixed?'Смешанная неделя':phaseInfo(cell.phase).name)}
       className={'kug-single-week kug-'+phaseInfo(cell.phase).color+
        (cell.mixed?' kug-mixed':'')+(selection&&w.index>=start&&w.index<=end?' kug-picked':'')}
       onClick={e=>selectCell(group,w.index,e.shiftKey)}>
       <b>{w.index+1}-я неделя · {dateText(w.start)}–{dateText(w.end)}</b>
       <span>{cell.mixed?cell.parts.map(p=>phaseInfo(p).name).join(' / '):phaseInfo(cell.phase).name}</span>
       <span className="kug-day-strip kug-single-strip" aria-label="Отметки дней недели">
        {days.map(day=><i key={day.date} title={day.dayName+': '+day.label}
         className={'kug-day-dot '+(day.withinYear?'kug-day-'+day.kind:'kug-day-outside')}/>)}
       </span>
       {cell.holidays>0&&<small>{cell.holidays} нерабочих дней</small>}
      </button>)}
     </div>
    </div>}
   </div>
   <aside className="kug-workspace-side" aria-label="Свойства учебного периода">
    {!activeWeek&&<div className="kug-side-empty">
     <b>Свойства периода</b>
     <p>Выдели одну или несколько недель в таблице. Здесь появятся даты, календарные ограничения и действия.</p>
    </div>}
  {activeWeek&&<section className="kug-week-detail" aria-label="Дни выбранной недели">
   <header><div><b>{group} · неделя {activeWeek.index+1}</b>
    <span>{activeWeek.start} — {activeWeek.end} · {calendarWorkweek}-дневная учебная неделя</span></div>
    <span>{detailDays.filter(day=>day.withinYear&&day.nonWorking).length} нерабочих дней</span>
   </header>
   <div className="kug-detail-days">
    {detailDays.map(day=><article key={day.date} className={'kug-detail-day kug-detail-'+day.kind+(day.withinYear?'':' kug-detail-outside')}>
     <b>{day.dayName} · {dateText(day.date)}</b>
     <span>{day.withinYear?(statusName[day.kind]||'День'):'За пределами учебного года'}</span>
     <small>{day.withinYear?day.label:'—'}</small>
     {day.withinYear&&<em>{day.nonWorking?'Занятия не назначать':day.canScheduleTheory?'Теория разрешена':'По графику: '+phaseInfo(day.phase).name}</em>}
    </article>)}
   </div>
   {detailDays.some(day=>day.withinYear&&!day.confirmedTransfers)&&
    <p className="kug-day-pending">Переносы выходных для этого года ещё не подтверждены. Показаны известные федеральные праздники и обычные выходные; переносы требуют проверки.</p>}
   <p className="kug-day-note">Праздники и выходные не меняют вид учебного периода группы. Пяти- и шестидневная неделя учитывается по настройкам колледжа.</p>
  </section>}
  <div className="kug-editor" aria-label="Быстрое заполнение учебных недель">
   <div className="kug-editor-title"><b>Быстрое заполнение</b><span>{selectedGroups.length} групп · {selection?'Недели '+(start+1)+'–'+(end+1):'Выбери неделю'} · {selection?from+' — '+to:''}</span></div>
   <div className="kug-editor-fields">
    <label>С недели<select aria-label="Начало диапазона КУГ" value={start} onChange={e=>{const n=Number(e.target.value);setSelection({anchor:n,end:Math.max(n,end),group});setExactFrom('');setExactTo('');setPreview(false)}}>
     {weeks.map(w=><option key={w.index} value={w.index}>{w.index+1} · {dateText(w.start)}</option>)}</select></label>
    <label>По неделю<select aria-label="Конец диапазона КУГ" value={end} onChange={e=>{const n=Number(e.target.value);setSelection({anchor:Math.min(start,n),end:n,group});setExactFrom('');setExactTo('');setPreview(false)}}>
     {weeks.map(w=><option key={w.index} value={w.index}>{w.index+1} · {dateText(w.end)}</option>)}</select></label>
    <label>Вид периода<select aria-label="Вид периода КУГ" value={phase} onChange={e=>{setPhase(e.target.value as CalendarPhase);setTitle('');setPreview(false)}}>
     {CALENDAR_PHASES.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Уточнение названия<input aria-label="Название периода КУГ" value={title} onChange={e=>{setTitle(e.target.value);setPreview(false)}} placeholder={phaseName}/></label>
     <label>Точная дата начала<input aria-label="Точная дата начала периода" type="date" min={academicStart} max={academicEnd} value={from} onChange={e=>{setExactFrom(e.target.value);setPreview(false)}}/></label>
     <label>Точная дата окончания<input aria-label="Точная дата окончания периода" type="date" min={academicStart} max={academicEnd} value={to} onChange={e=>{setExactTo(e.target.value);setPreview(false)}}/></label>
   </div>
   {selection&&!validRange&&<p className="kug-alert" role="alert">Выбери группы и корректные даты в пределах учебного года ({academicStart} — {academicEnd}).</p>}
   <div className="kug-editor-actions">
    <button className="kug-primary" disabled={!validRange} onClick={()=>setPreview(true)}><ClipboardCopy size={15}/> Рассчитать изменения</button>
    {previous&&<button onClick={()=>{replace(previous);setPrevious(null);setPreview(false);setMessage('Последняя операция отменена')}}><RotateCcw size={15}/> Отменить</button>}
    <button onClick={()=>setShowCheck(v=>!v)}><AlertTriangle size={15}/> {showCheck?'Скрыть проверку':'Проверить график'}</button>
   </div>
   {preview&&<div className="kug-preview" role="status">
    <strong>Предварительный просмотр</strong>
    <p>Период «{title||phaseName}» для {selectedGroups.length} групп; {from} — {to} ({Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000)+1} календарных дней).</p>
    <p>Занятий в этом периоде: <b>{impact?.affected.length||0}</b>.
     Новых конфликтов после изменения: <b>{impact?.newlyBlocked.length||0}</b>.
     Ранее проблемных занятий: <b>{impact?.alreadyBlocked.length||0}</b>.
     Занятия не удаляются автоматически.</p>
    {Boolean(impact?.newlyBlocked.length)&&<p className="kug-alert">После изменения некоторые запланированные пары станут недопустимыми. Перепроверь расписание перед публикацией.</p>}
    {Boolean(impact?.held.length)&&<p className="kug-alert">Есть проведённые занятия ({impact?.held.length}). Их статусы и часы не изменяются.</p>}
    <button className="kug-primary" onClick={apply}><Check size={15}/> Подтвердить и сохранить</button>
    <button onClick={()=>setPreview(false)}>Отмена</button>
   </div>}
   {message&&<p className="kug-note" role="status">{message}</p>}
  </div>
  <details className="kug-copy-details"><summary>Копировать график между группами</summary><div className="kug-copy-panel">
   <strong>Копирование графика группы</strong>
   <div className="kug-copy-controls">
    <label>Из группы <b>{group}</b></label>
    <label>В группу <select aria-label="Получатель копии КУГ" value={copyReceiver} onChange={e=>{setCopyTarget(e.target.value);setCopyPending(null)}}>
     {GROUPS.filter(g=>g.id!==group).map(g=><option key={g.id} value={g.id}>{g.id}</option>)}</select></label>
    <label className="kug-copy-overwrite"><input type="checkbox" checked={copyOverwrite}
     onChange={e=>{setCopyOverwrite(e.target.checked);setCopyPending(null)}}/> Заменить заполненные периоды получателя</label>
    <button type="button" onClick={prepareCopy}><ClipboardCopy size={15}/> Предпросмотр копирования</button>
   </div>
   {copyPending&&<div className="kug-preview" role="status">
    <p>Скопировать график {group} в {copyReceiver}. {copyOverwrite?'Заполненные периоды получателя будут перезаписаны.':'Уже заполненные периоды получателя сохранятся.'}</p>
    <button className="kug-primary" onClick={confirmCopy}><Check size={15}/> Подтвердить копирование</button>
    <button onClick={()=>setCopyPending(null)}>Отмена</button>
   </div>}
  </div>
  </details>
  {showCheck&&<div className="kug-check" role="region" aria-label="Проверка календарного графика">
   <h3>Проверка заполнения · {findings.filter(f=>f.level==='error').length} незаполненных, {findings.filter(f=>f.level==='warning').length} смешанных недель</h3>
   {findings.slice(0,50).map((f,i)=><button key={i} onClick={()=>{setRows([f.group]);setGroup(f.group);setSelection({anchor:f.week,end:f.week,group:f.group});setMode('year');setCollapsed([])}}>
    <b>{f.group} · неделя {f.week+1}</b><span>{f.message}</span></button>)}
   {findings.length>50&&<p>Показано первых 50 из {findings.length}. Используй фильтр отделения или группы для уточнения.</p>}
   {!findings.length&&<p>Для выбранных групп нет незаполненных или смешанных недель.</p>}
  </div>}
  </aside></div>
  <footer className="kug-footer">Праздники и выходные расположены в общей строке над группами и учитываются при назначении занятий. Локальные дни конкретной группы отмечаются отдельно. Импорт/экспорт CSV, восстановление JSON и проверка затронутых занятий сохранены. Этот стенд использует демонстрационные данные, а не серверное утверждение Academic Core.</footer>
 </section>;
}
