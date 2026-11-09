/** Demonstration Academic Core practice catalog, not official curricular data.
 * KUG stores only a catalog code reference, NEVER a parallel lookup list.
 */
export type PracticePhase='training'|'industrial'|'prediploma';
export type AcademicPractice={code:string;title:string;phase:PracticePhase;source:'demo-academic-core'};
export const DEMO_ACADEMIC_PRACTICES:AcademicPractice[]=[
 {code:'УП.05.01',title:'Учебная практика по профессиональному модулю ПМ.05 (демо)',phase:'training',source:'demo-academic-core'},
 {code:'УП.02.02',title:'Учебная практика по профессиональному модулю ПМ.02 (демо)',phase:'training',source:'demo-academic-core'},
 {code:'УП.02.01',title:'Учебная практика по профессиональному модулю ПМ.02, часть 1 (демо)',phase:'training',source:'demo-academic-core'},
 {code:'ПП.05.01',title:'Производственная практика по профессиональному модулю ПМ.05 (демо)',phase:'industrial',source:'demo-academic-core'},
 {code:'ПП.02.01',title:'Производственная практика по профессиональному модулю ПМ.02 (демо)',phase:'industrial',source:'demo-academic-core'},
 {code:'ПДП.01',title:'Преддипломная практика (демо)',phase:'prediploma',source:'demo-academic-core'}
];
export const academicPractice=(code:string|undefined)=>DEMO_ACADEMIC_PRACTICES.find(p=>p.code===code);
export const practicesOfPhase=(phase:string)=>DEMO_ACADEMIC_PRACTICES.filter(p=>p.phase===phase);
export const isPracticePhase=(phase:string):phase is PracticePhase=>
 phase==='training'||phase==='industrial'||phase==='prediploma';
