import { GROUPS, ROOMS, TEACHERS, SUBJECTS, DAYS, TIMES } from './data';
import type { Lesson } from './data';
import { assessRoomFit } from './roomPolicy';
export type Issue={kind:'group'|'teacher'|'room'|'capacity'|'equipment'|'parallel'|'calendar';message:string;hard:boolean};
export const occupiedRooms=(l:Lesson)=> l.mode==='online'||l.mode==='async'?[]:Array.from(new Set((l.participants?.map(p=>p.room).join(' / ')||l.room).match(/\b\d{3}\b/g)||[]));
export const participantGroups=(l:Lesson)=>Array.from(new Set(l.participants?.map(p=>p.group) || l.groups));
export function validate(l:Lesson, others:Lesson[], options:{capacity?:boolean;parallel?:boolean}={capacity:true,parallel:true}):Issue[]{
 const issues:Issue[]=[];
 const active=others.filter(x=>x.id!==l.id&&(x.week||0)===(l.week||0)&&x.day===l.day&&x.slot===l.slot&&x.status!=='cancelled');
 const groups=participantGroups(l); const places=occupiedRooms(l);
 for(const x of active){
  const duplicates=groups.filter(g=>participantGroups(x).includes(g));
  if(duplicates.length)issues.push({kind:'group',hard:true,message:'Группа уже занята: '+duplicates.join(', ')});
  if(x.teacher===l.teacher)issues.push({kind:'teacher',hard:true,message:'Преподаватель '+l.teacher+' уже ведёт '+x.subject});
  const rooms=places.filter(r=>occupiedRooms(x).includes(r));
  if(rooms.length)issues.push({kind:'room',hard:true,message:'Аудитория '+rooms.join(', ')+' занята'});
 }
 if(options.capacity&&l.mode!=='online'&&l.mode!=='async'){
  const count=groups.reduce((sum,g)=>sum+(GROUPS.find(x=>x.id===g)?.count||0),0);
  if(l.type==='regular'||l.type==='stream'){
   for(const place of places){
    const room=ROOMS.find(r=>r.id===place);
    if(!room){issues.push({kind:'room',hard:true,message:'Аудитория '+place+' отсутствует в справочнике'});continue}
    const fit=assessRoomFit(l,room,count);
    if(fit.level!=='ok')issues.push({kind:fit.hard?'capacity':'equipment',hard:fit.hard,message:'Аудитория '+place+': '+fit.reason});
   }
  }
  if(l.type==='subgroup'){
   const countPerGroup=Math.ceil(count/Math.max(2,l.participants?.length||2));
   if(places.length<2&&!l.participants?.length)issues.push({kind:'capacity',hard:true,message:'Подгруппам нужны два разных помещения или подтверждённая схема совместного занятия'});
   for(const place of places){
    const room=ROOMS.find(r=>r.id===place);
    if(!room){issues.push({kind:'room',hard:true,message:'Аудитория '+place+' отсутствует в справочнике'});continue}
    const fit=assessRoomFit(l,room,countPerGroup);
    if(fit.level!=='ok')issues.push({kind:fit.hard?'capacity':'equipment',hard:fit.hard,message:'Подгруппа, кабинет '+place+': '+fit.reason});
   }
  }
  if(l.type==='parallel'){
   const onsite=l.participants?.filter(p=>p.mode!=='online'&&p.mode!=='async')||[{group:groups[0],room:places[0],mode:'offline' as const}];
   for(const part of onsite){
    const room=ROOMS.find(r=>r.id===part.room);
    const attending=part.count||GROUPS.find(x=>x.id===part.group)?.count||0;
    if(!room){issues.push({kind:'room',hard:true,message:'Аудитория '+part.room+' отсутствует в справочнике'});continue}
    const fit=assessRoomFit(l,room,attending);
    if(fit.level!=='ok')issues.push({kind:fit.hard?'capacity':'equipment',hard:fit.hard,message:'Параллель '+part.group+': '+fit.reason});
   }
  }
 }
 if(options.parallel&&l.type==='parallel'){
  const placements=l.participants||[];
  if(placements.length){
   const onsite=new Set(placements.filter(p=>p.mode==='offline'||p.mode==='hybrid').map(p=>p.room));
   if(onsite.size>1&&!l.notes?.toLowerCase().includes('сопровож'))issues.push({kind:'parallel',hard:true,message:'Преподаватель не может находиться в двух кабинетах. Укажи сопровождающего или дистанционную организацию'});
  }else if(l.room.match(/\d{3}.*\d{3}/)&&!l.notes?.toLowerCase().includes('сопровож')){
   issues.push({kind:'parallel',hard:true,message:'Для параллели в разных помещениях укажи способ организации занятия'});
  }
 }
 return issues.filter((x,i,a)=>a.findIndex(z=>z.kind===x.kind&&z.message===x.message)===i);
}
export function findFree(l:Lesson,all:Lesson[],days=6):{day:number;slot:number;room:string;issues:Issue[];score:number}[]{
 const result=[];
 for(let day=0;day<days;day++)for(let slot=1;slot<=5;slot++)for(const r of ROOMS){
   if(!r.active)continue;
   const candidate={...l,day,slot,room:r.id};
   const issues=validate(candidate,all);
   if(issues.some(x=>x.hard))continue;
   const before=all.filter(x=>x.groups.some(g=>candidate.groups.includes(g))&&(x.week||0)===(candidate.week||0)&&x.day===day).map(x=>x.slot);
   const score=100-slot*3-(before.length?Math.min(...before)>slot?Math.min(...before)-slot:slot-Math.max(...before):0)*6+(r.pc>0&&/программ|сет|баз|информатик/i.test(l.subject)?15:0);
   result.push({day,slot,room:r.id,issues,score});
 }
 return result.sort((a,b)=>b.score-a.score).slice(0,30);
}
export function exportCSV(filename:string,rows:(string|number)[][]){
 const quoted=(v:string|number)=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const data='\ufeff'+rows.map(row=>row.map(quoted).join(';')).join('\r\n');
 const blob=new Blob([data],{type:'text/csv;charset=utf-8'});
 const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1200);
}
export function exportJSON(filename:string,data:unknown){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
export function reportRows(kind:string,all:Lesson[],week:number):(string|number)[][]{
 const titles=['Неделя','День','Пара','Дисциплина','Преподаватель','Группы','Аудитория','Тип','Формат','Статус'];
 let source=all.filter(x=>(x.week||0)===week);
 if(kind==='Онлайн и гибрид')source=source.filter(x=>x.mode!=='offline');
 if(kind==='Потоки')source=source.filter(x=>x.type==='stream');
 if(kind==='Параллели')source=source.filter(x=>x.type==='parallel');
 if(kind==='Подгруппы')source=source.filter(x=>x.type==='subgroup');
 if(kind==='Замены')source=source.filter(x=>Boolean(x.replacementFor));
 if(kind==='Замены')return [['Неделя','День','Пара','Группа','Было: предмет','Было: преподаватель','Стало: предмет','Стало: преподаватель','Формат','Способ'],...source.map(l=>[
  (l.week||0)+1,DAYS[l.day],l.slot,l.groups.join(', '),l.replacementOriginal?.subject||l.subject,
  l.replacementOriginal?.teacher||l.replacementFor||'',l.subject,l.teacher,l.mode,l.replacementKind||'teacher'])];
 return [titles,...source.map(x=>[Number(x.week||0)+1,DAYS[x.day],x.slot,x.subject,x.teacher,x.groups.join(', '),x.room,x.type,x.mode,x.status||'scheduled'])];
}
export const QUALIFICATIONS:Record<string,string[]> = Object.fromEntries(TEACHERS.map((x,i)=>[x,[SUBJECTS[i%SUBJECTS.length],SUBJECTS[(i+5)%SUBJECTS.length],SUBJECTS[(i+11)%SUBJECTS.length]]]));
export function workload(lessons:Lesson[],teacher:string,week:number){
 const own=lessons.filter(l=>l.teacher===teacher&&(l.week||0)===week&&l.status!=='cancelled');
 return {assigned:own.reduce((s,l)=>s+(l.hours||2),0),held:own.filter(l=>l.status==='held').reduce((s,l)=>s+(l.hours||2),0),lessons:own};
}
export function groupCount(groups:string[]){return groups.reduce((sum,id)=>sum+(GROUPS.find(x=>x.id===id)?.count||0),0)}
export function dayLabel(d:number){return DAYS[d]+' · '+TIMES[0].slice(0,5)}
