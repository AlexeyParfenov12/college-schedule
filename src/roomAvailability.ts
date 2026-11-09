/** Shared demo room closure source for dispatcher and timetable assistant. */
export const readBlockedRooms=():string[]=>{
 try{
  const raw=localStorage.getItem('college-schedule-extras-v2')||
   localStorage.getItem('college-schedule-extras-v1');
  if(!raw)return [];
  const source:unknown=JSON.parse(raw);
  if(!source||typeof source!=='object')return [];
  const rooms=(source as {rooms?:unknown}).rooms;
  if(!rooms||typeof rooms!=='object'||Array.isArray(rooms))return [];
  return Object.entries(rooms).filter(([,value])=>value&&typeof value==='object'&&
   (value as {blocked?:boolean}).blocked===true).map(([id])=>id);
 }catch{return []}
};
