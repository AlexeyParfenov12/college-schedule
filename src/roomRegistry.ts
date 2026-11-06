import { ROOMS } from './data';
import type { Room, Lesson } from './data';
const STORAGE='college-room-catalog-v1';
const baseline:Room[]=ROOMS.map(r=>({...r,features:[...r.features]}));
export type RoomSaveResult={ok:true;room:Room}|{ok:false;error:string};
export function refreshRoomCatalog(){
 let saved:Room[]|null=null;
 try{
  const raw=localStorage.getItem(STORAGE);
  if(raw){const parsed:unknown=JSON.parse(raw);if(Array.isArray(parsed))saved=parsed.filter((r):r is Room=>Boolean(r&&typeof r.id==='string'&&/^\d{3}$/.test(r.id)&&typeof r.capacity==='number'&&Array.isArray(r.features)))}
 }catch{/* Storage can be disabled. Fall back to the demo catalog. */}
 ROOMS.splice(0,ROOMS.length,...(saved||baseline).map(r=>({...r,features:[...r.features]})));
}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(ROOMS))}catch{return false}return true}
function announce(){if(typeof window!=='undefined')window.dispatchEvent(new Event('college-rooms-changed'))}
export function saveDemoRoom(room:Room,originalId?:string):RoomSaveResult{
 const id=room.id.trim(),building=room.building.trim(),title=(room.title||'').trim();
 if(!/^\d{3}$/.test(id))return {ok:false,error:'Номер аудитории: три цифры (формат демонстрационного справочника)'};
 if(!building)return {ok:false,error:'Укажи корпус'};
 if(!room.kind.trim())return {ok:false,error:'Укажи тип помещения'};
 if(!Number.isInteger(room.capacity)||room.capacity<1)return {ok:false,error:'Вместимость должна быть положительным целым числом'};
 if(!Number.isInteger(room.pc)||room.pc<0||room.pc>room.capacity)return {ok:false,error:'Число компьютеров должно быть от 0 до количества мест'};
 const share=room.recommendedStudentsPerComputer||2,max=room.maxStudentsPerComputer||3;
 if(share>max||share<1||max>3||max<1)return {ok:false,error:'Проверь разрешённое количество студентов на компьютер'};
 const conflicting=ROOMS.find(r=>r.id===id&&r.id!==originalId);
 if(conflicting)return {ok:false,error:'Аудитория '+id+' уже есть в справочнике. Дублирование невозможно'};
 if(originalId&&originalId!==id)return {ok:false,error:'Для аудитории с существующим расписанием нельзя менять номер. Создай новый кабинет и архивируй старый'};
 const replacement:Room={...room,id,building,title,features:[...new Set(room.features.map(x=>x.trim()).filter(Boolean))],
  recommendedStudentsPerComputer:share,maxStudentsPerComputer:max};
 const old=ROOMS.findIndex(r=>r.id===(originalId||id));
 if(old>=0)ROOMS.splice(old,1,replacement);else ROOMS.push(replacement);
 persist();announce();
 return {ok:true,room:replacement};
}
export function archiveDemoRoom(id:string,lessons:Lesson[]):RoomSaveResult{
 const r=ROOMS.find(x=>x.id===id);
 if(!r)return {ok:false,error:'Аудитория не найдена'};
 const related=lessons.filter(l=>new RegExp('\\b'+id+'\\b').test(l.room)&&l.status!=='cancelled');
 const replacement={...r,active:false};
 const index=ROOMS.findIndex(x=>x.id===id);
 ROOMS.splice(index,1,replacement);persist();announce();
 return {ok:true,room:replacement};
}
export function classroomDependencies(id:string,lessons:Lesson[]){
 return lessons.filter(l=>new RegExp('\\b'+id+'\\b').test(l.room)&&l.status!=='cancelled');
}
