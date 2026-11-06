import type { Lesson, Room } from './data';
import { GROUPS } from './data';

/** Demo resource policy. In production supply these rules from Academic Core / resource configuration. */
export const needsComputers=(subject:string)=>/программ|сет|баз данных|информат|операционн|веб|интерфейс|информационн.*безопас|разработк/i.test(subject);
export type RoomFit={level:'ok'|'warning'|'blocked';reason:string;students:number;seats:number;computers:number;studentsPerComputer:number;requiredComputers:number;hard:boolean};
export const studentsIn=(lesson:Lesson)=> lesson.participants?.reduce((sum,p)=>sum+(p.count||GROUPS.find(g=>g.id===p.group)?.count||0),0)
 ||lesson.groups.reduce((sum,id)=>sum+(GROUPS.find(g=>g.id===id)?.count||0),0);
export function assessRoomFit(lesson:Lesson,room:Room,count=studentsIn(lesson)):RoomFit{
 const requiresPC=Boolean(lesson.requiresIndividualComputer||needsComputers(lesson.subject));
 const required=lesson.requiresIndividualComputer?1:(lesson.computerShare||room.recommendedStudentsPerComputer||2);
 const permitted=Math.max(1,Math.min(3,room.maxStudentsPerComputer||3));
 const requiredComputers=requiresPC?Math.ceil(count/required):0;
 const base={students:count,seats:room.capacity,computers:room.pc,studentsPerComputer:required,requiredComputers};
 if(count>room.capacity)return {...base,level:'blocked',hard:true,reason:'Не хватает посадочных мест: '+count+' студентов, '+room.capacity+' мест'};
 if(!room.active)return {...base,level:'blocked',hard:true,reason:'Аудитория закрыта'};
 if(!requiresPC)return {...base,level:'ok',hard:false,reason:'Подходит · '+room.capacity+' мест'};
 if(room.pc===0)return {...base,level:'blocked',hard:true,reason:'Для этой дисциплины необходим компьютерный кабинет'};
 if(lesson.requiresIndividualComputer&&room.pc<count)return {...base,level:'blocked',hard:true,reason:'Индивидуальная работа 1:1: '+count+' студентов, '+room.pc+' ПК'};
 if(required>permitted)return {...base,level:'blocked',hard:true,reason:'Режим '+required+' студента за ПК запрещён для кабинета (максимум '+permitted+')'};
 if(room.pc*required>=count)return {...base,level:'ok',hard:false,reason:'Подходит: '+count+' студентов, '+room.pc+' ПК, по '+required+' чел./ПК'};
 if(room.pc*permitted>=count)return {...base,level:'warning',hard:false,
  reason:'Нужно по '+Math.ceil(count/room.pc)+' чел./ПК. Можно изменить режим с '+required+' до '+permitted+' после согласования'};
 return {...base,level:'warning',hard:false,
  reason:'Не хватает компьютерных рабочих мест: '+count+' студентов, '+room.pc+' ПК при лимите '+permitted+' чел./ПК. Нужна замена кабинета или согласование организации занятия'};
}
