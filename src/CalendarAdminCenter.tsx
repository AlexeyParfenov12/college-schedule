import { useMemo, useState } from 'react';
import { discrepancyFingerprint, candidateFingerprint, warningFingerprint, readCalendarReviews, saveCalendarReviews } from './calendarReview';
import type { Lesson } from './data';
import { lessonDate } from './plannerDomain';
import { classifyCalendarDay, classifyReferenceCalendarDay, collegeWorkOverrideProhibited, readCollegeWorkweek } from './productionCalendar';
import { useProductionCalendarState } from './productionCalendarSync';
import { addCollegeDayOverride, getCollegeDayOverrides, removeCollegeDayOverride, useCollegeOverrideRevision } from './collegeDayOverrides';
import type { CollegeDayAction } from './collegeDayOverrides';
import './calendar-admin.css';

type Props={lessons:Lesson[];mode?:'full'|'summary';onOpen?:()=>void};
const LABEL:Record<CollegeDayAction,string>={
 closed:'Дополнительный выходной / праздник колледжа',
 working:'Дополнительный рабочий день',
 shortened:'Сокращённый учебный день'
};
export default function CalendarAdminCenter({lessons,mode='full',onOpen}:Props){
 const production=useProductionCalendarState();
 useCollegeOverrideRevision();
 const [date,setDate]=useState('2026-11-10');
 const [action,setAction]=useState<CollegeDayAction>('closed');
 const [reason,setReason]=useState('');
 const [preview,setPreview]=useState(false);
 const [notice,setNotice]=useState('');
 const [expanded,setExpanded]=useState(false);
 const [showReviewed,setShowReviewed]=useState(false);
 const [reviewed,setReviewed]=useState<string[]>(readCalendarReviews);
 const week=readCollegeWorkweek();
 const exceptions=getCollegeDayOverrides();

 const candidates=production.officialMonitor?.candidates??[];
 const discrepancies=production.discrepancies;
 const warnings=discrepancies.length?[]:production.warnings;
 const isReviewed=(fingerprint:string)=>reviewed.includes(fingerprint);
 const pendingDiscrepancies=discrepancies.filter(x=>!isReviewed(discrepancyFingerprint(x)));
 const pendingWarnings=warnings.filter(x=>!isReviewed(warningFingerprint(x)));
 const pendingCandidates=candidates.filter(x=>!isReviewed(candidateFingerprint(x)));
 const reviewedDiscrepancies=discrepancies.filter(x=>isReviewed(discrepancyFingerprint(x)));
 const reviewedWarnings=warnings.filter(x=>isReviewed(warningFingerprint(x)));
 const reviewedCandidates=candidates.filter(x=>isReviewed(candidateFingerprint(x)));
 const historicalCount=reviewedDiscrepancies.length+reviewedWarnings.length+reviewedCandidates.length;
 const monitoringIncomplete=Boolean(production.officialMonitor&&production.officialMonitor.status!=='ok');
 const issueCount=pendingDiscrepancies.length+pendingWarnings.length+pendingCandidates.length+(monitoringIncomplete?1:0);
 const updateReviewed=(fingerprint:string,mark:boolean)=>{
  const next=mark?[...new Set([...reviewed,fingerprint])]:reviewed.filter(x=>x!==fingerprint);
  try{saveCalendarReviews(next);setReviewed(next);setNotice(mark?
   'Уведомление отмечено как просмотренное. Нормативный календарь не изменён.':
   'Уведомление возвращено в список требующих проверки.')}
  catch(e){setNotice(e instanceof Error?e.message:'Не удалось сохранить статус уведомления')}
 };
 const openDate=(target:string)=>{
  setDate(target);setAction('closed');setPreview(false);
  setNotice('Выбран день '+target+'. Федеральный перенос уже применяется автоматически. Сделать его рабочим локальным приказом нельзя; ручные правила предназначены для дополнительных дней колледжа.');
  document.getElementById('calendar-day-editor')?.scrollIntoView({behavior:'smooth',block:'start'});
 };
 const before=useMemo(()=>{
  try{return classifyReferenceCalendarDay(date,week)}catch{return null}
 },[date,week,production.revision]);
 const after=useMemo(()=>{
  try{return classifyCalendarDay(date,week)}catch{return null}
 },[date,week,production.revision,exceptions]);
 const blocked=action==='working'?collegeWorkOverrideProhibited(date,week):
  action==='shortened'&&before?.nonWorking?'Нерабочий день нельзя объявить сокращённым рабочим':null;
 const impacted=useMemo(()=>lessons.filter(item=>lessonDate(item.week||0,item.day)===date&&item.status!=='cancelled'),[lessons,date]);
 const onSave=()=>{
  try{
   if(blocked)throw Error(blocked);
   addCollegeDayOverride({date,action,reason,author:'Администратор учебной части (локальный деморежим)'});
   setNotice('Исключение сохранено в этом браузере. Затронутые занятия требуют проверки; автоматического переноса нет.');
   setPreview(false);setReason('');
  }catch(error){setNotice(error instanceof Error?error.message:'Ошибка сохранения')}
 };
 if(mode==='summary')return <div className="calendar-admin-summary" role="status">
  <div><strong>Уведомления учебной части</strong>
   <span>{issueCount?issueCount+' требуют проверки':'Нет непросмотренных календарных уведомлений'}{historicalCount?' · '+historicalCount+' просмотрено':''} · {production.officialMonitor?.status==='ok'?'официальная проверка выполнена':'статус официальной проверки см. в разделе'}</span></div>
  <button type="button" onClick={onOpen}>Открыть в учебном календаре</button>
 </div>;
 return <section className="calendar-admin" aria-label="Центр календаря учебной части">
  <header className="calendar-admin-head">
   <div><strong>Центр календаря учебной части</strong>
    <p>Адресат: администратор учебной части. Документы и причины расхождений доступны по ссылкам.</p></div>
   <span>{issueCount?issueCount+' требуют проверки':'Нет новых уведомлений'}{historicalCount?' · '+historicalCount+' просмотрено':''}</span>
  </header>
  <div className="calendar-admin-status">
   <div><b>Справочный календарь</b><span>{production.status==='updated'?'Проверен '+production.checkedAt.slice(0,10):production.message}</span></div>
   <div><b>Официальные публикации</b>
    <span>{production.officialMonitor
      ?(production.officialMonitor.status==='ok'?'Проверены '+production.officialMonitor.checkedAt.slice(0,10):
        'Проверка '+(production.officialMonitor.status==='partial'?'частичная':'недоступна')+' — требуется контроль')
      :'Мониторинг официальных публикаций пока не загружен'}</span></div>
  </div>
  {(issueCount>0||historicalCount>0)&&
   <div className="calendar-admin-alerts" aria-label="Уведомления администратору учебной части">
    <button type="button" className="calendar-admin-expand" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>
     <b>Проверка нормативных оснований · {issueCount} новых</b>
     <span>{expanded?'Свернуть уведомления':'Показать даты и решения'}</span>
    </button>
    {expanded&&<div className="calendar-admin-alert-items">
     {!!issueCount&&<div className="calendar-admin-notice">
      Эти сообщения относятся к сверке справочного API и официального календаря. При расхождении уже действует нормативное правило. После проверки можно отметить сообщение как просмотренное — само календарное правило не изменится.
     </div>}
     {pendingDiscrepancies.map(d=><article key={discrepancyFingerprint(d)} className="calendar-admin-alert">
      <b>{d.date} · {d.workweek}-дневная неделя</b>
      <p>{d.explanation}</p>
      <span>Справочный API: {d.apiCode} · нормативное правило: {d.legalCode}. Применяется нормативное правило.</span>
      <a href={d.officialUrl} target="_blank" rel="noreferrer">{d.documentTitle}</a>
      <div className="calendar-admin-alert-controls">
       <button type="button" onClick={()=>openDate(d.date)}>Посмотреть день в редакторе</button>
       <button type="button" className="calendar-admin-mark" onClick={()=>updateReviewed(discrepancyFingerprint(d),true)}>Проверено · убрать из новых</button>
      </div>
     </article>)}
     {pendingWarnings.map(x=><article key={warningFingerprint(x)} className="calendar-admin-alert">
      <b>Предупреждение справочного API</b><p>{x}</p>
      <span>Для документального подтверждения требуется дополнительная официальная проверка.</span>
      <div className="calendar-admin-alert-controls">
       <button type="button" className="calendar-admin-mark" onClick={()=>updateReviewed(warningFingerprint(x),true)}>Просмотрено · скрыть из новых</button>
      </div>
     </article>)}
     {pendingCandidates.map(x=><article className="calendar-admin-alert" key={candidateFingerprint(x)}>
      <b>Новая официальная публикация · {x.date}</b>
      <p>{x.title}. {x.explanation}</p>
      <a href={x.url} target="_blank" rel="noreferrer">Открыть официальный документ № {x.id}</a>
      <div className="calendar-admin-alert-controls">
       <button type="button" className="calendar-admin-mark" onClick={()=>updateReviewed(candidateFingerprint(x),true)}>Проверено · убрать из новых</button>
      </div>
     </article>)}
     {monitoringIncomplete&&<p className="calendar-admin-unverified">
      Мониторинг новых постановлений выполнен частично или источник недоступен. Это системный статус и не скрывается подтверждением отдельного уведомления.
     </p>}
     {historicalCount>0&&<section className="calendar-admin-reviewed">
      <button type="button" className="calendar-admin-review-toggle" onClick={()=>setShowReviewed(v=>!v)}
       aria-expanded={showReviewed}>{showReviewed?'Скрыть просмотренные':'Просмотренные уведомления ('+historicalCount+')'}</button>
      {showReviewed&&<div className="calendar-admin-alert-items">
       {reviewedDiscrepancies.map(d=><article key={discrepancyFingerprint(d)} className="calendar-admin-alert acknowledged">
        <b>{d.date} · {d.workweek}-дневная неделя · просмотрено</b>
        <p>{d.explanation}</p>
        <span>Применяется нормативное правило; запись остаётся в истории проверки.</span>
        <a href={d.officialUrl} target="_blank" rel="noreferrer">Нормативный документ</a>
        <div className="calendar-admin-alert-controls">
         <button type="button" onClick={()=>openDate(d.date)}>Посмотреть дату</button>
         <button type="button" onClick={()=>updateReviewed(discrepancyFingerprint(d),false)}>Вернуть в новые</button>
        </div>
       </article>)}
       {reviewedWarnings.map(x=><article className="calendar-admin-alert acknowledged" key={warningFingerprint(x)}>
        <p>{x}</p><button type="button" onClick={()=>updateReviewed(warningFingerprint(x),false)}>Вернуть в новые</button>
       </article>)}
       {reviewedCandidates.map(x=><article className="calendar-admin-alert acknowledged" key={candidateFingerprint(x)}>
        <b>{x.title}</b><p>{x.explanation}</p><button type="button" onClick={()=>updateReviewed(candidateFingerprint(x),false)}>Вернуть в новые</button>
       </article>)}
      </div>}
     </section>}
    </div>}
   </div>}
  <div className="calendar-admin-manual" id="calendar-day-editor">
   <div><strong>Ручное изменение дней колледжа</strong>
    <p>Здесь задаются только дополнительные решения колледжа: неучебный день, разрешённый рабочий день или сокращение. Федеральные праздники и утверждённые переносы нельзя делать рабочими — для них действует нормативный календарь, а не локальное исключение.</p></div>
   <div className="calendar-admin-form">
    <label>Дата<input aria-label="Дата исключения колледжа" type="date" value={date}
     onChange={e=>{setDate(e.target.value);setPreview(false);setNotice('')}}/></label>
    <label>Статус<select aria-label="Новый статус дня колледжа" value={action}
     onChange={e=>{setAction(e.target.value as CollegeDayAction);setPreview(false);setNotice('')}}>
     {Object.entries(LABEL).map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></label>
    <label className="calendar-admin-reason">Основание / приказ<input aria-label="Основание изменения дня" value={reason}
     onChange={e=>{setReason(e.target.value);setPreview(false)}} placeholder="Например, приказ колледжа № 15 от 01.11.2026"/></label>
   </div>
   <p className="calendar-admin-day-preview">
    {before?'Федеральный/справочный статус: '+before.label:'Выберите дату'}
    {after&&exceptions.some(x=>x.date===date)?' · Действует исключение колледжа: '+after.label:''}
   </p>
   {(blocked||before?.kind==='holiday'||before?.kind==='transfer')&&<p className="calendar-admin-deny" role="note">
    {blocked||'Это федеральный нерабочий день: его статус уже применяется автоматически. Локальная запись не требуется; смена федерального статуса недоступна.'}
   </p>}
   <div className="calendar-admin-actions">
    <button type="button" onClick={()=>{setPreview(true);setNotice('')}} disabled={!date||Boolean(blocked)||reason.trim().length<6||(before?.nonWorking&&action==='closed')}>Предпросмотр изменений</button>
   </div>
   {preview&&<div className="calendar-admin-confirm" role="status">
    <b>{date} · {LABEL[action]}</b>
    <p>Основание: {reason}. Затронутых уже существующих занятий: {impacted.length}.
     {impacted.length?' Проверьте эти пары после сохранения.':''}</p>
    {impacted.length>0&&<p>{impacted.slice(0,6).map(x=>x.groups.join(', ')+': '+x.subject).join(' · ')}
     {impacted.length>6?' и ещё '+(impacted.length-6):''}</p>}
    <button type="button" onClick={onSave}>Сохранить исключение</button>
    <button type="button" onClick={()=>setPreview(false)}>Отмена</button>
   </div>}
   {notice&&<p className="calendar-admin-feedback" role="status">{notice}</p>}
   <div className="calendar-admin-overrides">
    <b>Сохранённые решения колледжа ({exceptions.length})</b>
    {exceptions.length===0?<p>Дополнительных исключений нет.</p>:exceptions.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>
     <div key={x.id}><span>{x.date} · {LABEL[x.action]} · {x.reason}</span>
      <button type="button" aria-label={'Отменить исключение '+x.date} onClick={()=>{
       removeCollegeDayOverride(x.date);setNotice('Решение отменено. Расписание требует перепроверки.');
      }}>Удалить</button></div>)}
   </div>
  </div>
  <p className="calendar-admin-disclaimer">Демонстрационный режим: изменения хранятся в этом браузере. Настоящая доставка персональных уведомлений, утверждение приказов, роли, аудит сотрудников и синхронизация между устройствами появятся при подключении общего Auth/Academic Core.</p>
 </section>;
}
