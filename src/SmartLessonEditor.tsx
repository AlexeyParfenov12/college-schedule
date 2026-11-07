import PolishedSelect from './PolishedSelect';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeftRight, BookOpen, CalendarDays, Check, ChevronDown, ChevronUp, CircleAlert, Laptop, MapPin, Plus, Search, Sparkles, Trash2, Users, X } from 'lucide-react';
import { DAYS, GROUPS, MODES, ROOMS, SUBJECTS, TEACHERS, TIMES, TYPES } from './data';
import type { Lesson, Mode, Type, Participant } from './data';
import { validate } from './demoLogic';
import { deriveOffers, chooseRooms, firstSuitableRoom, suitableSubgroupPair, needsComputers, calendarIssues, currentDemoCalendar } from './plannerDomain';
import { readBlockedRooms } from './scheduleAssist';

type Props={item:Lesson;existing:boolean;all:Lesson[];catalog:Lesson[];view:'group'|'teacher'|'room';contextGroup?:string;contextTeacher?:string;contextRoom?:string;save:(l:Lesson)=>boolean|void;remove:(id:string)=>void;cancel:()=>void};
const options=(values:string[])=>values.map(v=><option key={v} value={v}>{v}</option>);
const groupCount=(names:string[])=>names.reduce((n,id)=>n+(GROUPS.find(g=>g.id===id)?.count||0),0);
const roomId=(v:string):string[]=>[...(v.match(/\b\d{3}\b/g)||[])];
const groupOptions=GROUPS.map(g=>g.id);
const parseMode=(x:Lesson):'group'|'teacher'=>x.groups.length?'group':'teacher';
function deriveRoom(choice:Lesson,all:Lesson[]):string{
 if(choice.mode==='online'||choice.mode==='async')return 'Онлайн';
 if(choice.type==='subgroup'){const [a,b]=suitableSubgroupPair(choice,all,readBlockedRooms());return a&&b?a+' / '+b:''}
 if(choice.type==='parallel'){
  const normal={...choice,type:'regular' as const,groups:[choice.groups[0]],mode:'offline' as const};
  const room=firstSuitableRoom(normal,all,readBlockedRooms());
  return room?room+' + онлайн':'';
 }
 return firstSuitableRoom(choice,all,readBlockedRooms());
}
function normalizeLesson(x:Lesson):Lesson{
 if(x.mode==='online'||x.mode==='async')return {...x,room:'Онлайн',participants:undefined};
 if(x.type==='parallel'){
  const place=roomId(x.room)[0]||'';
  const participants:Participant[]=x.groups.map((g,i)=>({group:g,room:i===0?place:'Онлайн',mode:i===0?'offline':'online',teacher:x.teacher}));
  return {...x,mode:'hybrid',room:place+' + онлайн',participants};
 }
 return {...x,participants:undefined};
}
export default function SmartLessonEditor({item,existing,all,catalog,view,contextGroup,contextTeacher,contextRoom,save,remove,cancel}:Props){
 const offers=useMemo(()=>deriveOffers(catalog),[catalog]);
 const [form,setForm]=useState<Lesson>(item);
 const [expanded,setExpanded]=useState(false);
 const [groupSearch,setGroupSearch]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [manual,setManual]=useState(false);
 const [secondRoom,setSecondRoom]=useState('');
 const [msg,setMsg]=useState('');
 const [equipmentApproved,setEquipmentApproved]=useState(false);
 const blocked=readBlockedRooms();
 const key=blocked.join('|');
 const primaryGroup=view==='group'?(contextGroup||item.groups[0]):form.groups[0]||'';
 const related=useMemo(()=>offers.filter(o=>o.group===primaryGroup),[offers,primaryGroup]);
 const teacherNames=useMemo(()=>Array.from(new Set(related.map(o=>o.teacher))),[related]);
 const teacherIsBusy=(name:string)=>all.some(l=>l.id!==form.id&&l.status!=='cancelled'&&(l.week||0)===(form.week||0)&&l.day===form.day&&l.slot===form.slot&&l.teacher===name);
 const groupIsBusy=(name:string)=>all.some(l=>l.id!==form.id&&l.status!=='cancelled'&&(l.week||0)===(form.week||0)&&l.day===form.day&&l.slot===form.slot&&l.groups.includes(name));
 const availableTeachers=useMemo(()=>teacherNames.filter(name=>!teacherIsBusy(name)),[teacherNames,all,form.week,form.day,form.slot,form.id]);
 const subjectNames=useMemo(()=>Array.from(new Set(related.filter(o=>o.teacher===form.teacher).map(o=>o.subject))),[related,form.teacher]);
 const subjects=useMemo(()=>existing&&form.subject&&!subjectNames.includes(form.subject)?[form.subject,...subjectNames]:subjectNames,[existing,form.subject,subjectNames]);
 const assignedGroups=useMemo(()=>Array.from(new Set(offers.filter(o=>o.teacher===form.teacher).map(o=>o.group))),[offers,form.teacher]);
 const availableGroups=(view==='teacher'?assignedGroups:GROUPS.map(g=>g.id)).filter(name=>!groupIsBusy(name));
 const roomSuggestion=(value:Lesson)=>view==='room'&&contextRoom&&value.mode!=='online'&&value.mode!=='async'?contextRoom:deriveRoom(value,all);
 useEffect(()=>{
  setExpanded(false);setSearchOpen(false);setMsg('');setEquipmentApproved(false);
  const fixedGroup=view==='group'?(contextGroup||item.groups[0]):item.groups[0];
  const fixedTeacher=view==='teacher'?(contextTeacher||item.teacher):item.teacher;
  const base:Lesson=existing?{...item}:{
   ...item,
   groups:view==='teacher'?[]:fixedGroup?[fixedGroup]:[],
   teacher:view==='teacher'?fixedTeacher:'',
   subject:'',
   room:view==='room'?(contextRoom||''):''
  };
  if(view==='group'&&fixedGroup&&!base.groups.includes(fixedGroup))base.groups=[fixedGroup,...base.groups];
  setForm(base);
  setSecondRoom(roomId(base.room)[1]||'');
  setManual(false);
  // Only reset on opening another lesson; not while editing fields.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[item.id]);
 const patch=(p:Partial<Lesson>)=>{setEquipmentApproved(false);setForm(x=>({...x,...p}))};
 const selectTeacher=(teacher:string)=>{
  const options=offers.filter(o=>o.group===primaryGroup&&o.teacher===teacher);
  const nextSubject=options.some(o=>o.subject===form.subject)?form.subject:options.length===1?options[0].subject:'';
  const updated={...form,teacher,subject:nextSubject};
  updated.room=nextSubject?roomSuggestion(updated):view==='room'?contextRoom||'':'';
  setForm(updated);setSecondRoom(roomId(updated.room)[1]||'');setMsg('');setEquipmentApproved(false);
 };
 const selectGroup=(group:string)=>{
  const teacher=view==='teacher'?(contextTeacher||form.teacher):'';
  const options=offers.filter(o=>o.group===group&&o.teacher===teacher);
  const subject=options.length===1?options[0].subject:options.some(o=>o.subject===form.subject)?form.subject:'';
  const updated={...form,groups:[group],teacher,subject};
  updated.room=subject?roomSuggestion(updated):view==='room'?contextRoom||'':'';
  setForm(updated);setSecondRoom(roomId(updated.room)[1]||'');setMsg('');
 };
 const selectSubject=(subject:string)=>{
  const updated={...form,subject};
  updated.room=subject?roomSuggestion(updated):view==='room'?contextRoom||'':'';
  setForm(updated);setSecondRoom(roomId(updated.room)[1]||'');setMsg('');
 };
 const roomCandidate=useMemo(()=>normalizeLesson(form),[form]);
 const allRooms=useMemo(()=>chooseRooms(roomCandidate,all,blocked),[roomCandidate,all,key]);
 const preferred=allRooms.filter(r=>r.available);
 const chosen=roomId(form.room);
 const selectable=allRooms.filter(r=>r.available);
 const currentVenue=selectable.some(r=>r.id===chosen[0])?chosen[0]:'';
 const groupSize=groupCount(form.groups);
 const minNeeded=needsComputers(form.subject)&&form.type==='regular'&&groupSize>0&&selectable.length===0;
 const switchType=(type:Type)=>{
  const comparable=offers.find(o=>o.teacher===form.teacher&&o.subject===form.subject&&o.group!==primaryGroup);
  const nextGroups=type==='regular'||type==='subgroup'?[primaryGroup]:form.groups.length>1?form.groups:comparable?[primaryGroup,comparable.group]:[primaryGroup];
  const base:Lesson={...form,type,groups:nextGroups};
  base.mode=type==='parallel'?'hybrid':type==='subgroup'?'offline':form.mode;
  base.room=roomSuggestion(base);setForm(base);setSecondRoom(roomId(base.room)[1]||'');
 };
 const setRoom=(first:string,second=secondRoom)=>{
  setSecondRoom(second);
  const room=form.type==='subgroup'?first&&second?first+' / '+second:'':form.type==='parallel'?first+' + онлайн':first;
  patch({room});
 };
 const allIssues=validate(roomCandidate,all);
 const issues=allIssues.filter(i=>i.hard);
 const softIssues=allIssues.filter(i=>!i.hard);
 const dateIssues=calendarIssues(roomCandidate,currentDemoCalendar());
 const multiple= form.type==='stream'||form.type==='parallel';
 const isValid=Boolean(form.groups.length&&(!multiple||form.groups.length>=2)&&form.subject&&form.teacher&&(manual||subjectNames.includes(form.subject))&&(form.mode==='online'||form.mode==='async'||roomId(form.room).length>0)&&!issues.length&&!dateIssues.length&&(!softIssues.length||equipmentApproved));
 const saveForm=(e:FormEvent)=>{e.preventDefault();if(!isValid){setMsg(issues[0]?.message||softIssues[0]?.message||'Заполни доступные варианты занятия');return}save(roomCandidate)};
 const typeLabel=Object.entries(TYPES);
 const isOnline=form.mode==='online'||form.mode==='async';
 const showRoom=!isOnline;
 return <form className="smart-editor" onSubmit={saveForm} data-testid="smart-lesson-editor">
  <header className="smart-head"><div><b>{existing?'Занятие':'Новое занятие'}</b><span>{DAYS[form.day]}, {form.slot}-я пара · {TIMES[form.slot-1]}</span></div><button type="button" onClick={cancel} aria-label="Закрыть форму" className="smart-icon"><X size={16}/></button></header>
  <div className="smart-scroll">
   <div className="smart-helper"><Sparkles size={15}/><span>{view==='group'?'Группа уже выбрана. Сначала укажи преподавателя, затем его дисциплину.':view==='teacher'?'Преподаватель уже выбран. Укажи группу, затем дисциплину, которую он в ней ведёт.':'Аудитория уже выбрана. Укажи группу, преподавателя и дисциплину.'}</span></div>
   <div className="smart-steps">
    {view==='group'
     ?<div className="smart-context"><Users size={14}/><span>Расписание группы <strong>{contextGroup||primaryGroup}</strong></span></div>
     :view==='teacher'
      ?<div className="smart-context"><BookOpen size={14}/><span>Преподаватель: <strong>{contextTeacher||form.teacher}</strong></span></div>
      :<div className="smart-context"><MapPin size={14}/><span>Аудитория <strong>{contextRoom||form.room}</strong></span></div>}
    {view!=='group'&&<>
      <div className="smart-step-title"><span>1</span> Группа</div>
      <label className="smart-field"><span>Для какой группы проводится занятие?</span>
       <PolishedSelect aria-label="Группа занятия" value={primaryGroup} onChange={e=>selectGroup(e.target.value)}>
        <option value="">Выбери группу</option>{availableGroups.map(g=><option value={g} key={g}>{g}</option>)}
       </PolishedSelect>
      </label>
    </>}
    {view!=='teacher'&&<>
      <div className="smart-step-title"><span>{view==='group'?1:2}</span> Преподаватель</div>
      <label className="smart-field"><span>{primaryGroup?'Преподаватели группы '+primaryGroup:'Сначала выбери группу'}</span>
       <PolishedSelect aria-label="Преподаватель занятия" value={form.teacher} onChange={e=>selectTeacher(e.target.value)} disabled={!primaryGroup}>
        <option value="">Выбери свободного преподавателя</option>{availableTeachers.map(t=><option value={t} key={t}>{t}</option>)}
       </PolishedSelect>
      </label>
    </>}
    {view==='teacher'&&<div className="smart-step-title"><span>2</span> Дисциплина</div>}
    {view!=='teacher'&&<div className="smart-step-title"><span>{view==='group'?2:3}</span> Дисциплина</div>}
    <label className="smart-field"><span>{form.teacher&&primaryGroup?'Что '+form.teacher+' ведёт у '+primaryGroup+'?':'Сначала '+(view==='teacher'?'выбери группу':'выбери преподавателя')}</span>
     <PolishedSelect aria-label="Дисциплина занятия" value={form.subject} onChange={e=>selectSubject(e.target.value)} disabled={!form.teacher||!primaryGroup}>
      <option value="">Выбери дисциплину</option>{subjects.map(subject=><option value={subject} key={subject}>{subject}</option>)}
     </PolishedSelect>
    </label>
    {form.subject&&form.teacher&&primaryGroup&&<div className="smart-summary compact"><span><BookOpen size={13}/> {form.subject}</span><span><Users size={13}/> {form.groups.join(' + ')}</span></div>}
    {primaryGroup&&related.length===0&&<div className="smart-warning">Для группы пока нет учебных назначений в демонстрационной базе. В рабочей системе они поступят из TeachingAssignment.</div>}
    {form.teacher&&primaryGroup&&!subjectNames.length&&<div className="smart-warning">Для выбранного преподавателя нет дисциплин этой группы в демоданных. Проверь назначение в Academic Core.</div>}
    {form.subject&&form.teacher&&primaryGroup&&<>
    <div className="smart-step-title"><span>{view==='room'?4:3}</span> Где и в каком формате?</div>
    <div className="smart-inline"><label className="smart-field"><span>Тип занятия</span><PolishedSelect value={form.type} onChange={e=>switchType(e.target.value as Type)}>{typeLabel.map(([type,title])=><option key={type} value={type}>{title}</option>)}</PolishedSelect></label><label className="smart-field"><span>Формат</span><PolishedSelect value={form.mode} onChange={e=>{const mode=e.target.value as Mode;const updated={...form,mode};updated.room=deriveRoom(updated,all);setForm(updated)}}>{Object.entries(MODES).map(([m,title])=><option value={m} key={m}>{title}</option>)}</PolishedSelect></label></div>
    {(form.type==='stream'||form.type==='parallel')&&<div className="smart-group-picker"><span>Участники ({form.groups.length}) · нужно минимум две группы</span><div>{form.groups.map(g=><button type="button" key={g} onClick={()=>g===contextGroup&&view==='group'?undefined:patch({groups:form.groups.filter(x=>x!==g)})} disabled={view==='group'&&g===contextGroup}>{g}<X size={11}/></button>)}</div><button type="button" className="smart-text" onClick={()=>setSearchOpen(v=>!v)}>+ Добавить группу</button>
     {searchOpen&&<div className="smart-drop"><input aria-label="Поиск дополнительных групп" placeholder="Поиск…" value={groupSearch} onChange={e=>setGroupSearch(e.target.value)}/><div>{GROUPS.filter(g=>!form.groups.includes(g.id)&&g.id.toLowerCase().includes(groupSearch.toLowerCase())).map(g=><button type="button" key={g.id} onClick={()=>patch({groups:[...form.groups,g.id]})}>{g.id} <Plus size={11}/></button>)}</div></div>}
    </div>}
    {showRoom&&needsComputers(form.subject)&&<div className="smart-pc-policy">
     <label className="smart-field"><span>Студентов за компьютером</span>
       <PolishedSelect aria-label="Студентов за компьютером" disabled={Boolean(form.requiresIndividualComputer)}
         value={form.requiresIndividualComputer?1:form.computerShare||2}
         onChange={e=>patch({computerShare:Number(e.target.value) as 1|2|3})}>
         {[1,2,3].map(n=><option value={n} key={n}>{n} {n===1?'студент':'студента'} / ПК</option>)}
       </PolishedSelect>
     </label>
     <label className="smart-pc-individual"><input type="checkbox" checked={Boolean(form.requiresIndividualComputer)}
       onChange={e=>patch({requiresIndividualComputer:e.target.checked,computerShare:e.target.checked?1:2})}/>
       Обязательный индивидуальный компьютер (экзамен, аттестация)</label>
    </div>}
    {showRoom&&<div className="smart-room">
      {form.type==='subgroup'?<>
       <label className="smart-field"><span>Кабинет 1-й подгруппы</span><PolishedSelect aria-label="Аудитория первой подгруппы" value={currentVenue} onChange={e=>setRoom(e.target.value)}><option value="">Выбрать кабинет</option>{selectable.map(r=><option key={r.id} value={r.id}>{r.label} · {r.reason}</option>)}</PolishedSelect></label>
       <label className="smart-field"><span>Кабинет 2-й подгруппы</span><PolishedSelect aria-label="Аудитория второй подгруппы" value={secondRoom} onChange={e=>setRoom(currentVenue,e.target.value)}><option value="">Выбрать кабинет</option>{selectable.filter(x=>x.id!==currentVenue).map(r=><option key={r.id} value={r.id}>{r.label} · {r.reason}</option>)}</PolishedSelect></label>
       <span className="smart-subline">{groupSize} студентов → две подгруппы примерно по {Math.ceil(groupSize/2)} человек.</span>
      </>:<>
       <label className="smart-field"><span>Аудитория · {selectable.length} доступных</span><PolishedSelect aria-label="Аудитория занятия" value={currentVenue} onChange={e=>setRoom(e.target.value)}><option value="">Подбери аудиторию</option>{selectable.map(r=><option key={r.id} value={r.id}>{r.label} · {r.reason}</option>)}</PolishedSelect></label>
       {form.type==='parallel'&&<span className="smart-subline">Первая группа очно; остальные подключаются онлайн. При другом формате используй отдельный конструктор параллелей.</span>}
      </>}
      {minNeeded&&<div className="smart-suggest"><Laptop size={15}/><span>Для всех {groupSize} студентов недостаточно компьютерных мест. Раздели практическое занятие на подгруппы.</span><button type="button" onClick={()=>switchType('subgroup')}>Разделить</button></div>}
      {!preferred.length&&<span className="smart-subline error">Нет свободной подходящей аудитории: проверь время, вместимость или формат.</span>}
     </div>}
    {isOnline&&<div className="smart-subline"><Laptop size={13}/> Аудитория не требуется — выбран дистанционный формат.</div>}
    </>}
   </div>
   <button className="smart-expand" type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>} Дополнительные параметры</button>
   {expanded&&<div className="smart-extra">
     <div className="smart-inline"><label className="smart-field"><span>День</span><PolishedSelect value={form.day} onChange={e=>patch({day:Number(e.target.value)})}>{DAYS.map((d,i)=><option value={i} key={d}>{d}</option>)}</PolishedSelect></label><label className="smart-field"><span>Пара</span><PolishedSelect value={form.slot} onChange={e=>patch({slot:Number(e.target.value)})}>{TIMES.map((x,i)=><option value={i+1} key={x}>{i+1}</option>)}</PolishedSelect></label></div>
     <label className="smart-field"><span>Примечание</span><textarea rows={2} value={form.notes||''} onChange={e=>patch({notes:e.target.value})}/></label>
     <button type="button" className="smart-text" onClick={()=>setManual(x=>!x)}>{manual?'Скрыть':'Развернуть'} ручной выбор дисциплины/преподавателя</button>
     {manual&&<><label className="smart-field"><span>Дисциплина (деморежим)</span><PolishedSelect value={form.subject} onChange={e=>patch({subject:e.target.value})}>{options(SUBJECTS)}</PolishedSelect></label><label className="smart-field"><span>Преподаватель (деморежим)</span><PolishedSelect value={form.teacher} onChange={e=>patch({teacher:e.target.value})}>{options(TEACHERS)}</PolishedSelect></label><div className="smart-warning">Ручное изменение учебного назначения требует проверки полномочий и связи TeachingAssignment в общей системе.</div></>}
   </div>}
   {softIssues.length>0&&<div className="smart-equipment-warning" role="note"><CircleAlert size={14}/>
     <span>{softIssues[0].message}. Это предупреждение, а не автоматический запрет.
     <label><input type="checkbox" checked={equipmentApproved} onChange={e=>setEquipmentApproved(e.target.checked)}/>
      Условия размещения проверены и согласованы учебной частью (деморежим)</label></span>
    </div>}
   {issues.length>0&&<div className="smart-warning"><CircleAlert size={14}/> {issues[0].message}</div>}
   {dateIssues.length>0&&<div className="smart-warning"><CalendarDays size={14}/> {dateIssues[0]} — выбери другую дату или согласуй календарь.</div>}
   {msg&&<div className="smart-warning">{msg}</div>}
   <div className="smart-disclaimer">Предложения основаны на тестовых данных: связь группа—предмет—преподаватель выведена из расписания, а не подтверждена Academic Core.</div>
  </div>
  <footer className="smart-footer">{existing&&<button type="button" onClick={()=>remove(form.id)} className="smart-danger" aria-label="Удалить занятие"><Trash2 size={15}/></button>}<button type="button" className="smart-cancel" onClick={cancel}>Отмена</button><button type="submit" className="smart-submit" disabled={!isValid}><Check size={14}/> {existing?'Сохранить':'Назначить'}</button></footer>
 </form>;
}
