import { classifyCalendarDay, readCollegeWorkweek } from './productionCalendar';
export type Type = 'regular' | 'subgroup' | 'stream' | 'parallel';
export type Mode = 'offline' | 'online' | 'hybrid' | 'async';
export type Participant = {group:string;subgroup?:number;teacher?:string;room:string;mode:Mode;count?:number};
export type Lesson = {
 id:string; day:number; slot:number; subject:string; teacher:string; groups:string[]; room:string;
 type:Type; mode:Mode; notes?:string; week?:number; participants?:Participant[]; hours?:number;
 computerShare?:1|2|3; requiresIndividualComputer?:boolean; requiresComputers?:boolean; practiceBlockId?:string;
 status?:'scheduled'|'cancelled'|'held'; replacementFor?:string; originalDay?:number; originalSlot?:number;
};
export const DAYS=['Пн','Вт','Ср','Чт','Пт','Сб'];
export const TIMES=['08:30–10:00','10:10–11:40','12:00–13:30','13:40–15:10','15:20–16:50','17:00–18:30'];
export const SUBJECTS=['Математика','Русский язык','История','Английский язык','Физика','Информатика','Программирование','Компьютерные сети','Базы данных','Операционные системы','Разработка интерфейсов','Веб-технологии','Информационная безопасность','Электротехника','Цифровая схемотехника','Микропроцессоры','Электронные приборы','Экономика','Менеджмент','Физкультура','Проектирование систем','Практика','Лабораторная работа','Консультация','Общая лекция','Экзамен','Зачёт'];
const surnames=['Петров','Иванова','Сидоров','Волков','Смирнова','Кузнецов','Соколова','Орлов','Морозова','Белов','Васильева','Попов','Новикова','Фёдоров','Михайлова','Романов','Сергеева','Лебедев','Борисова','Зайцев','Макарова','Павлов','Алексеева','Козлов','Никитина','Семёнов','Григорьева','Егоров','Степанова','Данилов','Медведева','Тихонов','Беляева','Жуков','Фролова','Крылов','Ларина','Максимов','Киреева','Филиппов','Тарасова','Андреев','Карпова','Ильин','Полякова','Яковлев','Осипова','Гаврилов','Ермакова','Куликов','Захарова','Тимофеев','Чернов','Голубева','Миронов','Дмитриева','Баранов','Наумова','Киселёв','Щукина','Комаров','Ушакова','Назаров','Фомина','Гущин','Субботина','Крылова','Котов','Маслова','Глебов','Орлова','Самойлов'];
export const TEACHERS=surnames.map((s,i)=>s+' '+['М. С.','Е. В.','А. И.','Д. Н.','А. В.','П. И.'][i%6]);
export const GROUPS=[
 ...['П-11','П-12','П-13','П-14','П-21','П-22','П-23','П-24','П-31','П-32','П-41','П-42'].map((id,i)=>({id,count:24+i%7,department:'ИТ',course:Number(id.split('-')[1][0]),specialty:'Разработка программного обеспечения',shift:i<8?1:2})),
 ...['Р-11','Р-12','Р-21','Р-22','Р-31','Р-32','Р-41','Р-42'].map((id,i)=>({id,count:22+(i*3)%9,department:'Радиотехника',course:Number(id.split('-')[1][0]),specialty:'Радиоэлектроника',shift:i<4?1:2})),
 ...['С-11','С-12','С-21','С-22','С-31','С-32','С-41','С-42'].map((id,i)=>({id,count:23+(i*2)%8,department:'Сети',course:Number(id.split('-')[1][0]),specialty:'Сетевое и системное администрирование',shift:i<4?1:2})),
 ...['Э-11','Э-12','Э-21','Э-22','Э-31','Э-32','Э-41','Э-42'].map((id,i)=>({id,count:22+(i*5)%10,department:'Экономика',course:Number(id.split('-')[1][0]),specialty:'Экономика и бухгалтерский учёт',shift:i<4?1:2}))
];
export type Room={id:string;kind:string;capacity:number;pc:number;building:string;features:string[];active:boolean;title?:string;recommendedStudentsPerComputer?:1|2|3;maxStudentsPerComputer?:1|2|3};
export const ROOMS:Room[]=Array.from({length:56},(_,i)=>{
 const building=i<34?'А':i<48?'Б':'В';const num=i<34?101+i:i<48?201+i-34:301+i-48;
 const lab=i%6===0||i%6===1;const lect=i%13===0;
 return {id:String(num),kind:lect?'Лекционный зал':lab?'Компьютерный класс':'Учебная аудитория',capacity:lect?96:32,pc:lab?15:0,building,recommendedStudentsPerComputer:2 as const,maxStudentsPerComputer:3 as const,features:lab?['ПК','Проектор','Интернет']:lect?['Проектор','Микрофоны']:['Доска','Проектор'],active:true};
});
export const TYPES:Record<Type,string>={regular:'Обычное',subgroup:'Подгруппы',stream:'Поток',parallel:'Параллель'};
export const MODES:Record<Mode,string>={offline:'Очно',online:'Онлайн',hybrid:'Гибрид',async:'Асинхронно'};
const make=(id:string,day:number,slot:number,subject:string,teacher:string,groups:string[],room:string,type:Type='regular',mode:Mode='offline',week=0):Lesson=>({id,day,slot,subject,teacher,groups,room,type,mode,week,hours:2});
export const INITIAL:Lesson[]=[
 make('demo-01',0,1,'Математика',TEACHERS[1],['П-21'],'109'),
 make('demo-02',0,2,'Программирование',TEACHERS[2],['П-21'],'102 / 107','subgroup'),
 make('demo-03',0,3,'Компьютерные сети',TEACHERS[0],['П-21','П-22'],'105 + онлайн','parallel','hybrid'),
 make('demo-04',0,4,'Практика',TEACHERS[2],['П-21'],'103'),
 make('demo-05',1,1,'Английский язык',TEACHERS[1],['П-21'],'106'),
 make('demo-06',1,2,'Базы данных',TEACHERS[5],['П-21','П-23'],'101','stream'),
 make('demo-07',1,3,'Компьютерные сети',TEACHERS[0],['П-21','П-22'],'105 + онлайн','parallel','hybrid'),
 make('demo-08',2,1,'Математика',TEACHERS[1],['П-21'],'109'),
 make('demo-09',2,2,'Программирование',TEACHERS[2],['П-21'],'102 / 107','subgroup'),
 make('demo-10',2,3,'Лабораторная работа',TEACHERS[3],['П-21'],'103'),
 make('demo-11',2,4,'Английский язык',TEACHERS[1],['П-21'],'106'),
 make('demo-12',3,1,'Физика',TEACHERS[3],['П-21'],'103'),
 make('demo-13',3,2,'Математика',TEACHERS[1],['П-21'],'109'),
 make('demo-14',3,3,'Общая лекция',TEACHERS[0],['П-21','П-23'],'101','stream'),
 make('demo-15',3,4,'Консультация',TEACHERS[1],['П-21'],'109'),
 make('demo-16',4,1,'Математика',TEACHERS[1],['П-21'],'109'),
 make('demo-17',4,2,'Компьютерные сети',TEACHERS[0],['П-21'],'102 / 107','subgroup'),
 make('demo-18',4,3,'Практика',TEACHERS[2],['П-21'],'102'),
 make('demo-19',4,4,'Базы данных',TEACHERS[5],['П-21'],'105')
];
export const ROSTERS: Record<string,{id:string;name:string;subgroup:number}[]> = Object.fromEntries(GROUPS.map((g,i)=>[g.id,Array.from({length:g.count},(_,j)=>({id:g.id+'-'+String(j+1).padStart(2,'0'),name:['Иванов','Петров','Сидоров','Смирнов','Кузнецов','Попов','Орлов','Волков','Соколов','Крылов','Егоров','Сергеев'][j%12]+' '+['Александр','Максим','Мария','Екатерина','Дмитрий','Артём','Анна','Никита','Полина','Иван','София','Павел'][(j+i)%12]+' '+(j%2?'В.':'А.'),subgroup:j<Math.ceil(g.count/2)?1:2}))]));
export type CalendarEvent={id:string;title:string;kind:'study'|'exam'|'vacation'|'practice'|'holiday';from:string;to:string;groups:string[]};
export const CALENDAR:CalendarEvent[]=[
 {id:'cal-1',title:'Учебные недели',kind:'study',from:'2026-09-01',to:'2026-12-28',groups:[]},
 {id:'cal-2',title:'Экзаменационная сессия',kind:'exam',from:'2027-01-11',to:'2027-01-25',groups:[]},
 {id:'cal-3',title:'Производственная практика',kind:'practice',from:'2026-12-01',to:'2026-12-20',groups:['П-31','П-32']},
 {id:'cal-4',title:'Зимние каникулы',kind:'vacation',from:'2027-01-26',to:'2027-02-08',groups:[]},
 {id:'cal-5',title:'Нерабочий праздничный день',kind:'holiday',from:'2026-11-04',to:'2026-11-04',groups:[]}
];
export type Absence={id:string;teacher:string;from:number;to:number;reason:string;status:'open'|'resolved'};
export const ABSENCES:Absence[]=[{id:'abs-1',teacher:TEACHERS[0],from:0,to:2,reason:'Больничный',status:'open'}, {id:'abs-2',teacher:TEACHERS[7],from:1,to:1,reason:'Командировка',status:'open'}];
export type Rule={id:string;name:string;hard:boolean;enabled:boolean;weight:number};
export const RULES:Rule[]=[
 {id:'teacher',name:'Преподаватель не занят в другом месте',hard:true,enabled:true,weight:100},
 {id:'group',name:'Студенты не участвуют в двух независимых занятиях',hard:true,enabled:true,weight:100},
 {id:'room',name:'Аудитория не занята другой парой',hard:true,enabled:true,weight:100},
 {id:'capacity',name:'Вместимость помещения достаточна',hard:true,enabled:true,weight:100},
 {id:'windows',name:'Минимизировать окна у групп',hard:false,enabled:true,weight:70},
 {id:'teachers-windows',name:'Минимизировать окна у преподавателей',hard:false,enabled:true,weight:50},
 {id:'even',name:'Равномерная нагрузка в течение недели',hard:false,enabled:true,weight:45},
 {id:'buildings',name:'Минимизировать переходы между корпусами',hard:false,enabled:true,weight:30}
];
export const NAV=[
 ['overview','Обзор'],['schedule','Расписание'],['calendar','Учебный календарь'],
 ['templates','Шаблоны'],['generator','Автосоставление'],['year','Годовой планировщик'],['substitutions','Замены'],
 ['groups','Группы и подгруппы'],['streams','Потоки'],['parallels','Параллели'],
 ['resources','Аудитории'],['distance','Дистант и гибрид'],['workload','Нагрузка и часы'],
 ['publication','Публикация'],['reports','Отчёты'],['academic','Академические данные'],
 ['settings','Настройки'],['teacher','Преподаватель'],['student','Студент']
] as const;
export const totalDatasetDays=16;
export function buildSeed(weeks=16):Lesson[]{
 const base=[...INITIAL];let counter=1;
 const workweek=readCollegeWorkweek();
 for(let w=0;w<weeks;w++){
   for(let day=0;day<workweek;day++){
    const iso=new Date(Date.UTC(2026,10,9+w*7+day)).toISOString().slice(0,10);
    if(classifyCalendarDay(iso,workweek).nonWorking)continue;
    for(let slot=1;slot<=5;slot++){
      const usedTeachers=new Set(base.filter(x=>x.week===w&&x.day===day&&x.slot===slot).map(x=>x.teacher));
      const usedRooms=new Set(base.filter(x=>x.week===w&&x.day===day&&x.slot===slot).flatMap(x=>x.room.split(/\s*[+/]\s*/).filter(s=>/^\d+$/.test(s))));
      for(let g=0;g<GROUPS.length;g++){
        const grp=GROUPS[g];
        if(slot===5 && (day+g)%3!==0)continue;
        if(day===5 && (g+slot)%4!==0)continue;
        if(w===0&&base.some(x=>x.week===w&&x.day===day&&x.slot===slot&&x.groups.includes(grp.id)))continue;
        const subject=SUBJECTS[(g*3+day*5+slot+w)% (SUBJECTS.length-3)];
        let teacherIdx=(g*2+day*3+slot+w)%TEACHERS.length;
        for(let k=0;k<TEACHERS.length&&usedTeachers.has(TEACHERS[teacherIdx]);k++)teacherIdx=(teacherIdx+1)%TEACHERS.length;
        let roomIdx=(g+day*3+slot+w)%ROOMS.length;
        for(let k=0;k<ROOMS.length&&(usedRooms.has(ROOMS[roomIdx].id)||ROOMS[roomIdx].capacity<grp.count);k++)roomIdx=(roomIdx+1)%ROOMS.length;
        if(usedRooms.has(ROOMS[roomIdx].id)||ROOMS[roomIdx].capacity<grp.count)continue;
        const teacher=TEACHERS[teacherIdx], room=ROOMS[roomIdx].id;
        usedTeachers.add(teacher);usedRooms.add(room);
        const mode:Mode=(w===4&&day<3&&g%8===0)?'online':((g+day+w)%31===0?'hybrid':'offline');
        const type:Type='regular';
        base.push(make('seed-'+counter++,day,slot,subject,teacher,[grp.id],room,type,mode,w));
      }
    }
   }
 }
 return base;
}
