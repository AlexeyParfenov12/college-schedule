import { useEffect, useState } from 'react';
import { Building2, Check, Plus, Pencil, X, Archive, AlertTriangle } from 'lucide-react';
import { ROOMS } from './data';
import type { Lesson, Room } from './data';
import { archiveDemoRoom, classroomDependencies, saveDemoRoom } from './roomRegistry';

type Props={selected:string;lessons:Lesson[];onSelect:(id:string)=>void;onChange:()=>void;notify:(message:string)=>void};
const blank=():Room=>({id:'',building:'А',kind:'Учебная аудитория',capacity:32,pc:0,features:['Доска'],active:true,
 recommendedStudentsPerComputer:2,maxStudentsPerComputer:3,title:''});
export default function RoomManager({selected,lessons,onSelect,onChange,notify}:Props){
 const [form,setForm]=useState<Room|null>(null),[original,setOriginal]=useState<string|undefined>(undefined);
 const [error,setError]=useState('');
 const [equipment,setEquipment]=useState('');
 const [view,setView]=useState(false);
 const open=(room?:Room)=>{
  const data=room?{...room,features:[...room.features]}:blank();
  setOriginal(room?.id);setForm(data);setEquipment(data.features.join(', '));setError('');setView(true);
 };
 const patch=(changes:Partial<Room>)=>setForm(v=>v?{...v,...changes}:v);
 const submit=(event:React.FormEvent)=>{
  event.preventDefault();
  if(!form)return;
  const saved=saveDemoRoom({...form,features:equipment.split(',').map(s=>s.trim()).filter(Boolean)},original);
  if(!saved.ok){setError(saved.error);return}
  onSelect(saved.room.id);onChange();notify((original?'Аудитория обновлена: ':'Аудитория добавлена: ')+saved.room.id+' · демоданные сохранены в браузере');
  setView(false);
 };
 const room=ROOMS.find(r=>r.id===selected);
 const dependencies=room?classroomDependencies(room.id,lessons):[];
 return <>
  <div className="room-manager-controls">
   <div><Building2 size={15}/><span>Справочник помещений · {ROOMS.length} аудиторий</span></div>
   <button type="button" onClick={()=>open()}><Plus size={14}/> Добавить аудиторию</button>
   {room&&<button type="button" onClick={()=>open(room)}><Pencil size={14}/> Изменить выбранную</button>}
  </div>
  {room&&<div className="room-manager-insight">
   <span><strong>{room.id}</strong> · корпус {room.building} · {room.capacity} мест · {room.pc} ПК · рекомендовано {room.recommendedStudentsPerComputer||2} студ./ПК</span>
   <button type="button" onClick={()=>{
    if(!window.confirm('Архивировать аудиторию '+room.id+'?\n'+dependencies.length+' связанных занятий останутся в истории и потребуют переназначения.'))return;
    const result=archiveDemoRoom(room.id,lessons);
    if(!result.ok){notify(result.error);return}
    onChange();notify('Аудитория '+room.id+' выведена из подбора. Связанных занятий: '+dependencies.length);
   }}><Archive size={13}/> Архивировать</button>
  </div>}
  {view&&form&&<div className="room-editor-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setView(false)}}>
   <form className="room-editor-dialog" role="dialog" aria-modal="true" aria-label={original?'Редактирование аудитории':'Создание аудитории'} onSubmit={submit}>
    <header><div><b>{original?'Изменить аудиторию '+original:'Добавить аудиторию'}</b><small>Единый демонстрационный справочник помещений</small></div>
     <button type="button" aria-label="Закрыть форму аудитории" onClick={()=>setView(false)}><X size={16}/></button></header>
    <div className="room-editor-fields">
     <label>Номер аудитории<input value={form.id} maxLength={3} disabled={Boolean(original)} onChange={e=>patch({id:e.target.value})} placeholder="Например, 405" required/></label>
     <label>Корпус<input value={form.building} onChange={e=>patch({building:e.target.value})} required/></label>
     <label className="full">Название (необязательно)<input value={form.title||''} onChange={e=>patch({title:e.target.value})} placeholder="Лаборатория робототехники"/></label>
     <label className="full">Назначение<select value={form.kind} onChange={e=>patch({kind:e.target.value})}>
      {['Учебная аудитория','Компьютерный класс','Лекционный зал','Лаборатория','Мастерская','Спортивный зал','Другое'].map(x=><option key={x}>{x}</option>)}
     </select></label>
     <label>Посадочных мест<input aria-label="Посадочных мест" type="number" min={1} max={500} value={form.capacity} onChange={e=>patch({capacity:Number(e.target.value)})} required/></label>
     <label>Рабочих компьютеров<input aria-label="Рабочих компьютеров" type="number" min={0} max={500} value={form.pc} onChange={e=>patch({pc:Number(e.target.value)})} required/></label>
     <label>Обычно студентов за ПК<select aria-label="Обычно студентов за ПК" value={form.recommendedStudentsPerComputer||2} onChange={e=>patch({recommendedStudentsPerComputer:Number(e.target.value) as 1|2|3})}>
      {[1,2,3].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <label>Допустимо максимум за ПК<select aria-label="Допустимо максимум за ПК" value={form.maxStudentsPerComputer||3} onChange={e=>patch({maxStudentsPerComputer:Number(e.target.value) as 1|2|3})}>
      {[1,2,3].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <label className="full">Оборудование (через запятую)<input value={equipment} onChange={e=>setEquipment(e.target.value)} placeholder="Проектор, Интернет, интерактивная доска"/></label>
     <label className="full room-editor-switch"><input type="checkbox" checked={form.active} onChange={e=>patch({active:e.target.checked})}/> Кабинет работает и доступен для подбора</label>
    </div>
    <p className="room-editor-note"><AlertTriangle size={14}/> 15 компьютеров могут обслуживать 28 студентов в парном режиме при достаточной физической вместимости. Для индивидуальной аттестации требуется отдельный компьютер каждому.</p>
    {error&&<p role="alert" className="room-editor-error">{error}</p>}
    <footer><button type="button" onClick={()=>setView(false)}>Отмена</button><button type="submit"><Check size={14}/> Сохранить аудиторию</button></footer>
   </form>
  </div>}
 </>;
}
