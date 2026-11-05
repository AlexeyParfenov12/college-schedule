export type Type = 'regular'|'subgroup'|'stream'|'parallel';
export type Mode = 'offline'|'online'|'hybrid'|'async';
export type Lesson = {id:string;day:number;slot:number;subject:string;teacher:string;groups:string[];room:string;type:Type;mode:Mode;notes?:string};
export const DAYS=['Пн','Вт','Ср','Чт','Пт','Сб'];
export const TIMES=['08:30–10:00','10:10–11:40','12:00–13:30','13:40–15:10','15:20–16:50','17:00–18:30'];
export const GROUPS=[{id:'П-21',count:28,department:'ИТ'},{id:'П-22',count:27,department:'ИТ'},{id:'П-23',count:25,department:'ИТ'},{id:'П-24',count:29,department:'ИТ'},{id:'Р-31',count:24,department:'Радиотехника'},{id:'Э-21',count:26,department:'Экономика'}];
export const TEACHERS=['Петров М. С.','Иванова Е. В.','Сидоров А. И.','Волков Д. Н.','Смирнова А. В.','Кузнецов П. И.'];
export const SUBJECTS=['Программирование','Компьютерные сети','Базы данных','Математика','Физика','Английский язык','Лабораторная работа','Практика','Консультация','История','Общая лекция'];
export const ROOMS=[{id:'101',kind:'Лекционный зал',capacity:100,pc:0},{id:'203',kind:'Лаборатория',capacity:26,pc:0},{id:'301',kind:'Аудитория',capacity:32,pc:0},{id:'303',kind:'Аудитория',capacity:28,pc:0},{id:'405',kind:'Компьютерный класс',capacity:15,pc:15},{id:'406',kind:'Компьютерный класс',capacity:15,pc:15},{id:'409',kind:'Компьютерный класс',capacity:26,pc:26}];
export const TYPES:Record<Type,string>={regular:'Обычное',subgroup:'Подгруппы',stream:'Поток',parallel:'Параллель'};
export const MODES:Record<Mode,string>={offline:'Очно',online:'Онлайн',hybrid:'Гибрид',async:'Асинхронно'};
const make=(id:string,day:number,slot:number,subject:string,teacher:string,groups:string[],room:string,type:Type='regular',mode:Mode='offline'):Lesson=>({id,day,slot,subject,teacher,groups,room,type,mode});
export const INITIAL:Lesson[]=[
make('1',0,1,'Математика',TEACHERS[1],['П-21'],'301'),
make('2',0,2,'Программирование',TEACHERS[2],['П-21'],'405 / 406','subgroup'),
make('3',0,3,'Компьютерные сети',TEACHERS[0],['П-21','П-22'],'405 + онлайн','parallel','hybrid'),
make('4',0,4,'Практика',TEACHERS[2],['П-21'],'405'),
make('5',1,1,'Английский язык',TEACHERS[1],['П-21'],'303'),
make('6',1,2,'Базы данных',TEACHERS[2],['П-21','П-23'],'101','stream'),
make('7',1,3,'Компьютерные сети',TEACHERS[0],['П-21','П-22'],'405 + онлайн','parallel','hybrid'),
make('8',2,1,'Математика',TEACHERS[1],['П-21'],'301'),
make('9',2,2,'Программирование',TEACHERS[2],['П-21'],'405 / 406','subgroup'),
make('10',2,3,'Лабораторная работа',TEACHERS[3],['П-21'],'203'),
make('11',2,4,'Английский язык',TEACHERS[1],['П-21'],'303'),
make('12',3,1,'Физика',TEACHERS[3],['П-21'],'203'),
make('13',3,2,'Математика',TEACHERS[1],['П-21'],'301'),
make('14',3,3,'Общая лекция',TEACHERS[0],['П-21','П-23'],'101','stream'),
make('15',3,4,'Консультация',TEACHERS[1],['П-21'],'301'),
make('16',4,1,'Математика',TEACHERS[1],['П-21'],'301'),
make('17',4,2,'Компьютерные сети',TEACHERS[0],['П-21'],'405 / 406','subgroup'),
make('18',4,3,'Практика',TEACHERS[2],['П-21'],'405'),
make('19',4,4,'Базы данных',TEACHERS[2],['П-21'],'409'),
make('20',0,1,'Базы данных',TEACHERS[2],['П-22'],'409'),
make('21',0,2,'Физика',TEACHERS[3],['П-22'],'203'),
make('22',2,1,'История',TEACHERS[5],['П-22'],'303'),
make('23',4,1,'История',TEACHERS[5],['П-22'],'303'),
make('24',0,1,'Физика',TEACHERS[3],['П-23'],'203')
];
export const NAV=[
['overview','Обзор'],['schedule','Расписание'],['calendar','Учебный календарь'],['templates','Шаблоны'],['generator','Автосоставление'],['substitutions','Замены'],['groups','Группы и подгруппы'],['streams','Потоки'],['parallels','Параллели'],['resources','Аудитории'],['distance','Дистант и гибрид'],['workload','Нагрузка и часы'],['publication','Публикация'],['reports','Отчёты'],['academic','Академические данные'],['settings','Настройки'],['teacher','Преподаватель'],['student','Студент']] as const;
