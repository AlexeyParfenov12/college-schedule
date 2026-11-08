import PolishedSelect from './PolishedSelect';
import CalendarMatrix from './CalendarMatrix';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, HelpCircle, Layers3, Search, Sparkles, WandSparkles } from 'lucide-react';
import { GROUPS, TIMES } from './data';
import type { CalendarEvent, Lesson } from './data';
import { WEEK_COUNT, lessonDate, previewTemplate, previewAutofill, needsComputers } from './plannerDomain';
import { demoAcademicDemands, demoAcademicHorizon } from './academicPlanning';
import { readCollegeWorkweek } from './productionCalendar';
import type { PreviewPlan } from './plannerDomain';
import { MiniSchedule, LoadBars, PlanningSummary } from './ScheduleVisuals';

const weekOptions=Array.from({length:WEEK_COUNT},(_,i)=>({value:i,label:'Неделя '+(i+1)+' · '+lessonDate(i,0)}));
const grouped=GROUPS.map(x=>x.id);
function Heading({step,children}:{step:number;children:React.ReactNode}){return <div className="plan-step"><b>{step}</b><strong>{children}</strong></div>}
function Field({name,children}:{name:string;children:React.ReactNode}){return <label className="plan-field"><span>{name}</span>{children}</label>}
function Info({children}:{children:React.ReactNode}){return <p className="plan-info"><HelpCircle size={15}/><span>{children}</span></p>}
function Cmd({onClick,children,disabled=false}:{onClick:()=>void;children:React.ReactNode;disabled?:boolean}){return <button type="button" className="plan-command" disabled={disabled} onClick={onClick}>{children}</button>}

type CalendarProps={events:CalendarEvent[];lessons:Lesson[];group:string;setGroup:(g:string)=>void;week:number;setWeek:(w:number)=>void;add:(v:CalendarEvent)=>void;remove:(id:string)=>void;replace:(v:CalendarEvent[])=>void};
/** Unified calendar editor; federal holidays are displayed in the KUG matrix.
 * The legacy form is deliberately not rendered, but its saved events are retained. */
export function CalendarStudio({events,lessons,group,setGroup,replace}:CalendarProps){
 return <div className="plan-page" data-testid="calendar-studio">
  <CalendarMatrix events={events} lessons={lessons} group={group} setGroup={setGroup} replace={replace}/>
 </div>;
}

type SavedCycle={id:string;name:string;week:number;group:string;weeks:number;locked:boolean};
type TemplateProps={lessons:Lesson[];calendar:CalendarEvent[];group:string;week:number;blocked:string[];saved:SavedCycle[];onApply:(next:Lesson[],count:number)=>void;onSave:(name:string,sourceWeek:number,group:string,cycle:number)=>void};
export function TemplateStudio({lessons,calendar,group,week,blocked,saved,onApply,onSave}:TemplateProps){
 const [startMode,setStartMode]=useState(group);
 const [sourceWeek,setSourceWeek]=useState(week);
 const [cycle,setCycle]=useState<1|2|3|4>(1);
 const [targetStart,setTargetStart]=useState(Math.min(WEEK_COUNT-1,week+1));
 const [targetEnd,setTargetEnd]=useState(WEEK_COUNT-1);
 const [name,setName]=useState('Основной цикл группы '+group);
 const [replace,setReplace]=useState(true);
 const [preview,setPreview]=useState<PreviewPlan|null>(null);
 const source=lessons.filter(l=>(l.week||0)>=sourceWeek&&(l.week||0)<sourceWeek+cycle&&l.groups.includes(startMode));
 const active=source.length>0&&targetStart<=targetEnd&&targetStart!==sourceWeek;
 useEffect(()=>setPreview(null),[sourceWeek,cycle,targetStart,targetEnd,startMode,replace,calendar,lessons]);
 const build=()=>previewTemplate(lessons,{sourceWeek,targetStart,targetEnd,cycle,group:startMode,replace,calendar,blockedRooms:blocked});
 const apply=()=>{
  if(!preview||!preview.accepted.length)return;
  const fresh=build();
  if(fresh.accepted.length!==preview.accepted.length||fresh.skipped.length!==preview.skipped.length){setPreview(fresh);return}
  const removeIds=new Set(fresh.removed.map(x=>x.id));
  const next=[...lessons.filter(l=>!removeIds.has(l.id)),...fresh.accepted.map(x=>x.after)];
  onApply(next,fresh.accepted.length);setPreview(null);
 };
 const toPreview=preview?preview.accepted.filter(x=>x.after.week===targetStart).map(x=>x.after):[];
 const removedPreviewIds=new Set(preview?.removed.map(x=>x.id)||[]);
 const comparedLessons=[...lessons.filter(x=>!removedPreviewIds.has(x.id)),...toPreview];
 return <div className="plan-page" data-testid="template-studio">
  <div className="plan-intro"><div><strong>Шаблон — повторяющийся цикл, а не одна таблица на год</strong><p>Сначала составь эталонную неделю (или цикл А/Б), затем разверни его на семестр или выбранные недели. Разовые замены и праздники остаются отдельными изменениями.</p></div><Copy size={24}/></div>
  <div className="plan-saved"><strong>Сохранённые циклы</strong><div>{saved.map(x=><button key={x.id} type="button" onClick={()=>{setStartMode(x.group);setSourceWeek(x.week);setCycle(Math.min(4,Math.max(1,x.weeks)) as 1|2|3|4);setName(x.name);setPreview(null)}}><Copy size={13}/><span>{x.name}</span><small>{x.group} · {x.weeks} нед.</small></button>)}</div></div>
  <div className="plan-flow"><span><b>1</b> Неделя-образец</span><ArrowRight size={15}/><span><b>2</b> Цикл и период</span><ArrowRight size={15}/><span><b>3</b> Предпросмотр</span><ArrowRight size={15}/><span><b>4</b> Применить</span></div>
  <div className="plan-columns">
   <section className="plan-pane">
    <Heading step={1}>Выбери основу расписания</Heading>
    <div className="plan-fields">
     <Field name="Группа"><PolishedSelect value={startMode} onChange={e=>setStartMode(e.target.value)}>{grouped.map(g=><option key={g} value={g}>{g}</option>)}</PolishedSelect></Field>
     <Field name="Откуда взять занятия"><PolishedSelect value={sourceWeek} onChange={e=>setSourceWeek(Number(e.target.value))}>{weekOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</PolishedSelect></Field>
     <Field name="Длина повторяющегося цикла"><PolishedSelect value={cycle} onChange={e=>setCycle(Number(e.target.value) as 1|2|3|4)}><option value={1}>1 неделя — постоянно</option><option value={2}>2 недели — А/Б</option><option value={3}>3 недели</option><option value={4}>4 недели</option></PolishedSelect></Field>
     <MiniSchedule lessons={lessons} week={sourceWeek} group={startMode} title={'Образец · '+source.length+' занятий в цикле'}/>
     <Heading step={2}>На какие недели применить?</Heading>
     <div className="plan-duo"><Field name="С недели"><PolishedSelect value={targetStart} onChange={e=>setTargetStart(Number(e.target.value))}>{weekOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</PolishedSelect></Field><Field name="По неделю"><PolishedSelect value={targetEnd} onChange={e=>setTargetEnd(Number(e.target.value))}>{weekOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</PolishedSelect></Field></div>
     <label className="plan-confirm"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/> Заменить обычные занятия группы в целевом периоде (не затрагивать проведённые и чужие потоки)</label>
     <Cmd disabled={!active} onClick={()=>setPreview(build())}><Search size={14}/> Рассчитать изменения</Cmd>
    </div>
   </section>
   <section className="plan-pane">
    <Heading step={3}>Сравни до и после</Heading>
    <div className="plan-duo"><MiniSchedule week={targetStart} lessons={lessons} group={startMode} title="Сейчас"/><MiniSchedule week={targetStart} lessons={comparedLessons} group={startMode} highlightIds={toPreview.map(x=>x.id)} title="После применения"/></div>
    {preview?<><PlanningSummary total={preview.accepted.length+preview.skipped.length} added={preview.accepted.length} skipped={preview.skipped.length} description={'Затронуто недель: '+preview.targetWeeks.length+'. Будет заменено существующих занятий: '+preview.removed.length+'.'}/>
     {preview.skipped.length>0&&<div className="plan-skips"><strong>Почему некоторые занятия пропущены?</strong>{preview.skipped.slice(0,6).map((x,i)=><small key={i}>Неделя {x.week+1}: {x.source.subject} — {x.reason}</small>)}</div>}
     {preview.calendarWarnings.length>0&&<div className="plan-skips"><strong>Особые периоды:</strong>{preview.calendarWarnings.map(x=><small key={x}>{x}</small>)}</div>}
     <Heading step={4}>Применить к черновику</Heading>
     <Cmd disabled={!preview.accepted.length} onClick={apply}><Check size={14}/> Применить {preview.accepted.length} занятий</Cmd>
    </>:<Info>Выбери период и нажми «Рассчитать изменения». До подтверждения расписание не меняется.</Info>}
    <div className="plan-template-store"><Field name="Название сохранённого шаблона"><input value={name} onChange={e=>setName(e.target.value)}/></Field><button type="button" disabled={!name.trim()} onClick={()=>onSave(name,sourceWeek,startMode,cycle)}><Copy size={14}/> Сохранить настройки цикла</button></div>
   </section>
  </div>
  <Info>Недельный шаблон можно повторить на весь учебный год, когда определены все недели года. В этом тестовом стенде доступно 16 недель. Поток с участниками нескольких групп не разбивается автоматически — такие занятия требуют согласованного переноса целиком.</Info>
 </div>;
}

type GeneratorProps={lessons:Lesson[];calendar:CalendarEvent[];week:number;group:string;onGroup:(v:string)=>void;blocked:string[];onApply:(next:Lesson[],count:number)=>void;onSubgroups:()=>void};
export function GeneratorStudio({lessons,calendar,week,group,onGroup,blocked,onApply,onSubgroups}:GeneratorProps){
 const offerings=useMemo(()=>demoAcademicDemands(calendar,readCollegeWorkweek(),demoAcademicHorizon(calendar)).map(d=>{
  const scheduled=lessons.filter(l=>l.status!=='cancelled'&&l.groups.includes(d.group)&&
   l.subject===d.subject&&l.teacher===d.teacher).length;
  return {...d,key:d.id,planned:d.requiredPairs,scheduled,remaining:Math.max(0,d.requiredPairs-scheduled)};
 }),[lessons,calendar]);
 const available=offerings.filter(o=>o.group===group);
 const [offerKey,setOfferKey]=useState('');
 const [dayLimit,setDayLimit]=useState(readCollegeWorkweek);
 const [slotLimit,setSlotLimit]=useState(4);
 const [preview,setPreview]=useState<ReturnType<typeof previewAutofill>|null>(null);
 const selected=available.find(o=>o.key===offerKey)||available.find(o=>o.remaining>0)||available[0];
 const count=Math.min(3,selected?.remaining||0);
 const hasSelection=Boolean(selected&&count>0&&selected.availableWeeks?.includes(week));
 useEffect(()=>setPreview(null),[offerKey,count,dayLimit,slotLimit,group,week,lessons,calendar]);
 const options={days:Array.from({length:dayLimit},(_,i)=>i).filter(day=>!calendar.some(e=>e.kind==='study')||isTeachingDate(lessonDate(week,day),group,calendar,readCollegeWorkweek())),slots:Array.from({length:slotLimit},(_,i)=>i+1),requirePc:Boolean(selected&&needsComputers(selected.subject))};
 const seed:Lesson={id:'proposal',week,day:0,slot:1,groups:[group],teacher:selected?.teacher||'',subject:selected?.subject||'',room:'',type:'regular',mode:'offline',hours:2};
 const build=()=>previewAutofill(seed,lessons,calendar,blocked,count,options);
 const apply=()=>{
  if(!preview?.placed.length)return;
  const updated=build();
  if(updated.placed.length!==preview.placed.length){setPreview(updated);return}
  onApply([...lessons,...updated.placed],updated.placed.length);setPreview(null);
 };
 return <div className="plan-page" data-testid="generator-studio">
  <div className="plan-intro"><div><strong>Помощник размещения занятий</strong><p>Выбери группу и незакрытую дисциплину. Преподаватель и количество оставшихся часов уже известны из демонстрационного учебного плана. Помощник предложит подходящие свободные пары текущей недели; изменения появятся только после подтверждения.</p></div><WandSparkles size={24}/></div>
  <div className="plan-columns">
   <section className="plan-pane">
    <Heading step={1}>Какую нагрузку разместить?</Heading>
    <div className="plan-fields">
     <Field name="Учебная группа"><PolishedSelect value={group} onChange={e=>onGroup(e.target.value)}>{grouped.map(g=><option key={g} value={g}>{g}</option>)}</PolishedSelect></Field>
     <Field name="Нераспределённая учебная нагрузка"><PolishedSelect aria-label="Учебное назначение для генератора" value={selected?.key||''} onChange={e=>setOfferKey(e.target.value)}>{available.map(o=><option value={o.key} key={o.key}>{o.subject} · {o.remaining*2} ч осталось · {o.teacher}</option>)}</PolishedSelect></Field>
     {selected&&<div className="plan-current"><Check size={14}/> {selected.teacher} · {selected.subject} · <strong>план {selected.planned*2} ч, распределено {selected.scheduled*2} ч, осталось {selected.remaining*2} ч</strong> (демо)</div>}
     <div className="plan-current">Помощник попробует разместить до <strong>{count} занятий</strong> из оставшейся нагрузки на текущей неделе. Число рассчитывается автоматически.</div>
      {selected&&!selected.availableWeeks?.includes(week)&&<Info>Эта неделя не является теоретической для группы по учебному календарю. Выбери учебную неделю в расписании.</Info>}
      {selected&&selected.remaining===0&&<Info>Все часы выбранной дисциплины уже распределены по демонстрационному плану.</Info>}
     <Heading step={2}>Ограничения и пожелания</Heading>
     <div className="plan-duo">
      <Field name="Дни"><PolishedSelect value={dayLimit} onChange={e=>setDayLimit(Number(e.target.value)===5?5:6)}><option value={5}>Понедельник–пятница</option><option value={6}>Понедельник–суббота</option></PolishedSelect></Field>
      <Field name="До какой пары"><PolishedSelect value={slotLimit} onChange={e=>setSlotLimit(Number(e.target.value))}>{TIMES.map((x,i)=><option key={x} value={i+1}>До {i+1}-й пары</option>)}</PolishedSelect></Field>
     </div>
     {selected&&needsComputers(selected.subject)&&<div className="plan-current"><Layers3 size={14}/> Для компьютерных занятий сначала проверяется работа по 2–3 студента за ПК при достаточном числе посадочных мест. Подгруппы применяются только при обоснованной необходимости. <button type="button" className="plan-inline-link" onClick={onSubgroups}>Настройка подгрупп</button></div>}
     <Cmd disabled={!hasSelection} onClick={()=>setPreview(build())}><Sparkles size={14}/> Показать предложенный вариант</Cmd>
    </div>
   </section>
   <section className="plan-pane">
    <Heading step={3}>Предпросмотр расписания</Heading>
    <MiniSchedule week={week} lessons={[...lessons,...(preview?.placed||[])]} group={group} highlightIds={preview?.placed.map(x=>x.id)} title={'Неделя '+(week+1)+' · '+group}/>
    <LoadBars lessons={[...lessons,...(preview?.placed||[])]} week={week} group={group}/>
    {preview?<><PlanningSummary total={count} added={preview.placed.length} skipped={count-preview.placed.length} description="Новые ячейки выделены лаймовым. Сначала только расчёт, никаких изменений в черновике."/>
     {preview.rejected.map((reason,i)=><div className="plan-skips" key={i}><small>{reason}</small></div>)}
     <Heading step={4}>Принять предложения</Heading>
     <Cmd disabled={!preview.placed.length} onClick={apply}><Check size={14}/> Добавить {preview.placed.length} занятий в черновик</Cmd>
    </>:<Info>Нажми «Показать предложенный вариант». Ничего не сохраняется, пока не примешь результат.</Info>}
   </section>
  </div>
  <Info>Источник часов — отдельный демонстрационный набор учебных назначений, не реальный Academic Core. Расчёт служит для проверки сценариев и не подтверждает выполнение учебного плана реального колледжа. Промышленный оптимизатор будет работать в NestJS/BullMQ с проверкой общих правил.</Info>
 </div>;
}
