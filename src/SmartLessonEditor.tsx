import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeftRight, BookOpen, Check, ChevronDown, ChevronUp, CircleAlert, Laptop, MapPin, Plus, Search, Sparkles, Trash2, Users, X } from 'lucide-react';
import { DAYS, GROUPS, MODES, ROOMS, SUBJECTS, TEACHERS, TIMES, TYPES } from './data';
import type { Lesson, Mode, Type, Participant } from './data';
import { validate } from './demoLogic';
import { deriveOffers, chooseRooms, firstSuitableRoom, suitableSubgroupPair, needsComputers } from './plannerDomain';
import { readBlockedRooms } from './scheduleAssist';

type Props={item:Lesson;existing:boolean;all:Lesson[];catalog:Lesson[];view:'group'|'teacher'|'room';save:(l:Lesson)=>boolean|void;remove:(id:string)=>void;cancel:()=>void};
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
export default function SmartLessonEditor({item,existing,all,catalog,view,save,remove,cancel}:Props){
 const offers=useMemo(()=>deriveOffers(catalog),[catalog]);
 const [form,setForm]=useState<Lesson>(item);
 const [startBy,setStartBy]=useState<'group'|'teacher'>(view==='teacher'?'teacher':'group');
 const [expanded,setExpanded]=useState(false);
 const [groupSearch,setGroupSearch]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [manual,setManual]=useState(false);
 const [secondRoom,setSecondRoom]=useState('');
 const [offerKey,setOfferKey]=useState('');
 const [msg,setMsg]=useState('');
 const blocked=readBlockedRooms();
 const key=blocked.join('|');
 const offerForGroup=useMemo(()=>offers.filter(o=>o.group===form.groups[0]),[offers,form.groups]);
 const offerForTeacher=useMemo(()=>offers.filter(o=>o.teacher===form.teacher),[offers,form.teacher]);
 const suggested=startBy==='group'?offerForGroup:offerForTeacher;
 const usedOffers=useMemo(()=>[...suggested].sort((a,b)=>b.count-a.count),[suggested]);
 useEffect(()=>{
  setStartBy(view==='teacher'?'teacher':'group');setExpanded(false);setSearchOpen(false);setMsg('');
  const choices=deriveOffers(catalog);
  const exact=choices.find(o=>o.group===item.groups[0]&&o.subject===item.subject&&o.teacher===item.teacher);
  const choice=exact||(!existing?choices.find(o=>view==='teacher'?o.teacher===item.teacher:o.group===item.groups[0]):undefined);
  const initial:Lesson=!existing&&choice?{...item,groups:[choice.group],subject:choice.subject,teacher:choice.teacher}:item;
  if(!existing)initial.room=deriveRoom(initial,catalog.filter(x=>(x.week||0)===(initial.week||0)));
  setForm(initial);
  setOfferKey(choice?.key||'');setSecondRoom(roomId(initial.room)[1]||'');
  setManual(!choice&&existing);
 // Parent changes the editor by item ID; don't reset fields after every keystroke.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[item.id]);
 const patch=(p:Partial<Lesson>)=>setForm(x=>({...x,...p}));
 const selectOffer=(key:string)=>{
  const offer=offers.find(o=>o.key===key);if(!offer)return;
  const updated:Lesson={...form,teacher:offer.teacher,subject:offer.subject,groups:[offer.group]};
  updated.room=deriveRoom(updated,all);setForm(updated);setOfferKey(offer.key);setManual(false);
  setSecondRoom(roomId(updated.room)[1]||'');setMsg('');
 };
 const selectGroup=(group:string)=>{
  const offer=offers.find(o=>o.group===group);
  const proposed={...form,groups:[group],teacher:offer?.teacher||form.teacher,subject:offer?.subject||form.subject};
  proposed.room=deriveRoom(proposed,all);
  setForm(proposed);setOfferKey(offer?.key||'');setSecondRoom(roomId(proposed.room)[1]||'');
  setManual(!offer);
 };
 const selectTeacher=(teacher:string)=>{
  const offer=offers.find(o=>o.teacher===teacher);
  const proposed={...form,teacher,groups:offer?[offer.group]:form.groups,subject:offer?.subject||form.subject};
  proposed.room=deriveRoom(proposed,all);
  setForm(proposed);setOfferKey(offer?.key||'');setSecondRoom(roomId(proposed.room)[1]||'');
  setManual(!offer);
 };
 const roomCandidate=useMemo(()=>normalizeLesson(form),[form]);
 const allRooms=useMemo(()=>chooseRooms(roomCandidate,all,blocked),[roomCandidate,all,key]);
 const preferred=allRooms.filter(r=>r.available);
 const chosen=roomId(form.room);
 const selectable=allRooms.filter(r=>r.available||chosen.includes(r.id));
 const currentVenue=chosen[0]||'';
 const groupSize=groupCount(form.groups);
 const minNeeded=needsComputers(form.subject)&&form.type==='regular'&&groupSize>0&&preferred.length===0;
 const switchType=(type:Type)=>{
  const comparable=offers.find(o=>o.teacher===form.teacher&&o.subject===form.subject&&o.group!==form.groups[0]);
  const nextGroups=type==='regular'||type==='subgroup'?[form.groups[0]]:form.groups.length>1?form.groups:comparable?[form.groups[0],comparable.group]:[form.groups[0]];
  const base:Lesson={...form,type,groups:nextGroups};
  base.mode=type==='parallel'?'hybrid':type==='subgroup'?'offline':form.mode;
  base.room=deriveRoom(base,all);setForm(base);setSecondRoom(roomId(base.room)[1]||'');
 };
 const setRoom=(first:string,second=secondRoom)=>{
  setSecondRoom(second);
  const room=form.type==='subgroup'?first&&second?first+' / '+second:'':form.type==='parallel'?first+' + онлайн':first;
  patch({room});
 };
 const issues=validate(roomCandidate,all).filter(i=>i.hard);
 const multiple= form.type==='stream'||form.type==='parallel';
 const isValid=Boolean(form.groups.length&&(!multiple||form.groups.length>=2)&&form.subject&&form.teacher&&(form.mode==='online'||form.mode==='async'||roomId(form.room).length>0)&&!issues.length);
 const saveForm=(e:FormEvent)=>{e.preventDefault();if(!isValid){setMsg(issues[0]?.message||'Заполни доступные варианты занятия');return}save(roomCandidate)};
 const typeLabel=Object.entries(TYPES);
 const isOnline=form.mode==='online'||form.mode==='async';
 const showRoom=!isOnline;
 return <form className="smart-editor" onSubmit={saveForm} data-testid="smart-lesson-editor">
  <header className="smart-head"><div><b>{existing?'Занятие':'Новое занятие'}</b><span>{DAYS[form.day]}, {form.slot}-я пара · {TIMES[form.slot-1]}</span></div><button type="button" onClick={cancel} aria-label="Закрыть форму" className="smart-icon"><X size={16}/></button></header>
  <div className="smart-scroll">
   <div className="smart-helper"><Sparkles size={15}/><span>Выбери учебное назначение — дисциплину и преподавателя подставим автоматически.</span></div>
   <div className="smart-steps">
    <div className="smart-step-title"><span>1</span> От чего начинаем?</div>
    <div className="smart-segments"><button type="button" className={startBy==='group'?'active':''} onClick={()=>setStartBy('group')}><Users size={13}/> С группы</button><button type="button" className={startBy==='teacher'?'active':''} onClick={()=>setStartBy('teacher')}><BookOpen size={13}/> С преподавателя</button></div>
    {startBy==='group'
      ?<label className="smart-field"><span>Группа</span><select value={form.groups[0]} onChange={e=>selectGroup(e.target.value)}>{options(groupOptions)}</select></label>
      :<label className="smart-field"><span>Преподаватель</span><select value={form.teacher} onChange={e=>selectTeacher(e.target.value)}>{options(TEACHERS)}</select></label>}
    <div className="smart-step-title"><span>2</span> Что проводим?</div>
    <label className="smart-field"><span>Назначения из деморасписания · {usedOffers.length}</span><select aria-label="Учебное назначение" value={offerKey} onChange={e=>selectOffer(e.target.value)}>
     <option value="" disabled>Выбери известное назначение</option>{usedOffers.map(o=><option value={o.key} key={o.key}>{o.subject} · {startBy==='group'?o.teacher:o.group}</option>)}
    </select></label>
    {form.subject&&<div className="smart-summary"><span><BookOpen size={13}/> {form.subject}</span><span><Users size={13}/> {form.groups.join(' + ')}</span><span>Преподаватель: {form.teacher}</span></div>}
    {!usedOffers.length&&<div className="smart-warning">Для выбранного {startBy==='group'?'коллектива':'преподавателя'} нет подтверждённых назначений в демонстрационных данных. Данные TeachingAssignment будут поступать из Academic Core.</div>}
    <div className="smart-step-title"><span>3</span> Где и в каком формате?</div>
    <div className="smart-inline"><label className="smart-field"><span>Тип занятия</span><select value={form.type} onChange={e=>switchType(e.target.value as Type)}>{typeLabel.map(([type,title])=><option key={type} value={type}>{title}</option>)}</select></label><label className="smart-field"><span>Формат</span><select value={form.mode} onChange={e=>{const mode=e.target.value as Mode;const updated={...form,mode};updated.room=deriveRoom(updated,all);setForm(updated)}}>{Object.entries(MODES).map(([m,title])=><option value={m} key={m}>{title}</option>)}</select></label></div>
    {(form.type==='stream'||form.type==='parallel')&&<div className="smart-group-picker"><span>Участники ({form.groups.length}) · нужно минимум две группы</span><div>{form.groups.map(g=><button type="button" key={g} onClick={()=>patch({groups:form.groups.filter(x=>x!==g)})}>{g}<X size={11}/></button>)}</div><button type="button" className="smart-text" onClick={()=>setSearchOpen(v=>!v)}>+ Добавить группу</button>
     {searchOpen&&<div className="smart-drop"><input aria-label="Поиск дополнительных групп" placeholder="Поиск…" value={groupSearch} onChange={e=>setGroupSearch(e.target.value)}/><div>{GROUPS.filter(g=>!form.groups.includes(g.id)&&g.id.toLowerCase().includes(groupSearch.toLowerCase())).map(g=><button type="button" key={g.id} onClick={()=>patch({groups:[...form.groups,g.id]})}>{g.id} <Plus size={11}/></button>)}</div></div>}
    </div>}
    {showRoom&&<div className="smart-room">
      {form.type==='subgroup'?<>
       <label className="smart-field"><span>Кабинет 1-й подгруппы</span><select aria-label="Аудитория первой подгруппы" value={currentVenue} onChange={e=>setRoom(e.target.value)}><option value="">Выбрать кабинет</option>{selectable.map(r=><option key={r.id} value={r.id}>{r.label} · {r.reason}</option>)}</select></label>
       <label className="smart-field"><span>Кабинет 2-й подгруппы</span><select aria-label="Аудитория второй подгруппы" value={secondRoom} onChange={e=>setRoom(currentVenue,e.target.value)}><option value="">Выбрать кабинет</option>{selectable.filter(x=>x.id!==currentVenue).map(r=><option key={r.id} value={r.id}>{r.label} · {r.reason}</option>)}</select></label>
       <span className="smart-subline">{groupSize} студентов → две подгруппы примерно по {Math.ceil(groupSize/2)} человек.</span>
      </>:<>
       <label className="smart-field"><span>Аудитория · {preferred.length} подходящих</span><select aria-label="Аудитория занятия" value={currentVenue} onChange={e=>setRoom(e.target.value)}><option value="">Подбери аудиторию</option>{selectable.map(r=><option key={r.id} value={r.id}>{r.label} · {r.reason}</option>)}</select></label>
       {form.type==='parallel'&&<span className="smart-subline">Первая группа очно; остальные подключаются онлайн. При другом формате используй отдельный конструктор параллелей.</span>}
      </>}
      {minNeeded&&<div className="smart-suggest"><Laptop size={15}/><span>Для всех {groupSize} студентов недостаточно компьютерных мест. Раздели практическое занятие на подгруппы.</span><button type="button" onClick={()=>switchType('subgroup')}>Разделить</button></div>}
      {!preferred.length&&<span className="smart-subline error">Нет свободной подходящей аудитории: проверь время, вместимость или формат.</span>}
     </div>}
    {isOnline&&<div className="smart-subline"><Laptop size={13}/> Аудитория не требуется — выбран дистанционный формат.</div>}
   </div>
   <button className="smart-expand" type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>} Дополнительные параметры</button>
   {expanded&&<div className="smart-extra">
     <div className="smart-inline"><label className="smart-field"><span>День</span><select value={form.day} onChange={e=>patch({day:Number(e.target.value)})}>{DAYS.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label><label className="smart-field"><span>Пара</span><select value={form.slot} onChange={e=>patch({slot:Number(e.target.value)})}>{TIMES.map((x,i)=><option value={i+1} key={x}>{i+1}</option>)}</select></label></div>
     <label className="smart-field"><span>Примечание</span><textarea rows={2} value={form.notes||''} onChange={e=>patch({notes:e.target.value})}/></label>
     <button type="button" className="smart-text" onClick={()=>setManual(x=>!x)}>{manual?'Скрыть':'Развернуть'} ручной выбор дисциплины/преподавателя</button>
     {manual&&<><label className="smart-field"><span>Дисциплина (деморежим)</span><select value={form.subject} onChange={e=>patch({subject:e.target.value})}>{options(SUBJECTS)}</select></label><label className="smart-field"><span>Преподаватель (деморежим)</span><select value={form.teacher} onChange={e=>patch({teacher:e.target.value})}>{options(TEACHERS)}</select></label><div className="smart-warning">Ручное изменение учебного назначения требует проверки полномочий и связи TeachingAssignment в общей системе.</div></>}
   </div>}
   {issues.length>0&&<div className="smart-warning"><CircleAlert size={14}/> {issues[0].message}</div>}
   {msg&&<div className="smart-warning">{msg}</div>}
   <div className="smart-disclaimer">Предложения основаны на тестовых данных: связь группа—предмет—преподаватель выведена из расписания, а не подтверждена Academic Core.</div>
  </div>
  <footer className="smart-footer">{existing&&<button type="button" onClick={()=>remove(form.id)} className="smart-danger" aria-label="Удалить занятие"><Trash2 size={15}/></button>}<button type="button" className="smart-cancel" onClick={cancel}>Отмена</button><button type="submit" className="smart-submit" disabled={!isValid}><Check size={14}/> {existing?'Сохранить':'Назначить'}</button></footer>
 </form>;
}
