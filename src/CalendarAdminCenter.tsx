import { useMemo, useState } from 'react';
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
 const week=readCollegeWorkweek();
 const exceptions=getCollegeDayOverrides();
 const discrepancyCount=production.discrepancies.length||production.warnings.length;
 const candidates=production.officialMonitor?.candidates??[];
 const issueCount=discrepancyCount+candidates.length;
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
   <span>{issueCount?issueCount+' сообщений о календаре':'Новых расхождений не обнаружено'} · {production.officialMonitor?.status==='ok'?'официальная проверка выполнена':'официальный мониторинг требует проверки'}</span></div>
  <button type="button" onClick={onOpen}>Открыть в учебном календаре</button>
 </div>;
 return <section className="calendar-admin" aria-label="Центр календаря учебной части">
  <header className="calendar-admin-head">
   <div><strong>Центр календаря учебной части</strong>
    <p>Адресат: администратор учебной части. Документы и причины расхождений доступны по ссылкам.</p></div>
   <span>{issueCount?issueCount+' требуют проверки':'Нет обнаруженных расхождений'}</span>
  </header>
  <div className="calendar-admin-status">
   <div><b>Справочный календарь</b><span>{production.status==='updated'?'Проверен '+production.checkedAt.slice(0,10):production.message}</span></div>
   <div><b>Официальные публикации</b>
    <span>{production.officialMonitor
      ?(production.officialMonitor.status==='ok'?'Проверены '+production.officialMonitor.checkedAt.slice(0,10):
        'Проверка '+(production.officialMonitor.status==='partial'?'частичная':'недоступна')+' — требуется контроль')
      :'Мониторинг официальных публикаций пока не загружен'}</span></div>
  </div>
  {(discrepancyCount>0||candidates.length>0||production.officialMonitor?.status!=='ok')&&
   <div className="calendar-admin-alerts" aria-label="Уведомления администратору учебной части">
    <button type="button" className="calendar-admin-expand" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>
     <b>Проверка нормативных оснований</b>
     <span>{expanded?'Скрыть подробности':'Показать даты, причины и документы'}</span>
    </button>
    {expanded&&<div className="calendar-admin-alert-items">
     {production.discrepancies.map(d=><article key={d.id} className="calendar-admin-alert">
      <b>{d.date} · {d.workweek}-дневная неделя</b>
      <p>{d.explanation}</p>
      <span>API: {d.apiCode} · нормативное правило: {d.legalCode} · применяется нормативное правило</span>
      <a href={d.officialUrl} target="_blank" rel="noreferrer">{d.documentTitle}</a>
     </article>)}
     {!production.discrepancies.length&&production.warnings.map((x,i)=><article key={i} className="calendar-admin-alert">
      <b>Расхождение справочного API</b><p>{x}</p>
      <span>Для ссылки на нормативный документ требуется обновлённая проверка.</span>
     </article>)}
     {candidates.map(x=><article className="calendar-admin-alert" key={x.id}>
      <b>Новая официальная публикация · {x.date}</b>
      <p>{x.title}. {x.explanation}</p>
      <a href={x.url} target="_blank" rel="noreferrer">Открыть официальный документ № {x.id}</a>
     </article>)}
     {production.officialMonitor?.status!=='ok'&&<p className="calendar-admin-unverified">
      Нельзя считать мониторинг всех новых постановлений завершённым: официальный портал был недоступен или проверен частично. Проверьте новые публикации вручную.
     </p>}
    </div>}
   </div>}
  <div className="calendar-admin-manual">
   <div><strong>Ручное изменение дней колледжа</strong>
    <p>Можно добавить неучебный день, рабочую субботу или сокращённый день. Федеральные праздники и подтверждённые переносы изменить нельзя.</p></div>
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
   {blocked&&<p className="calendar-admin-deny" role="alert">{blocked}</p>}
   <div className="calendar-admin-actions">
    <button type="button" onClick={()=>{setPreview(true);setNotice('')}} disabled={!date||Boolean(blocked)||reason.trim().length<6}>Предпросмотр изменений</button>
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
