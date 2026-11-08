import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { refreshRoomCatalog } from './roomRegistry';
import { refreshProductionCalendar } from './productionCalendarSync';
import { migrateDemoAcademicCalendar, migrateDemoWinterBreakLabel } from './academicPlanning';
import './styles.css';
import './studio.css';
import './ux.css';
import './planner.css';
import './year.css';
import './room-manager.css';
import './official-calendar.css';
import './mobile.css';
import './polished-select.css';
refreshRoomCatalog();
migrateDemoAcademicCalendar();
migrateDemoWinterBreakLabel();
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
// Check the latest published snapshot without blocking initial rendering.
void refreshProductionCalendar();
// A long-lived dispatcher tab also checks for a newly published snapshot.
let lastCheck=Date.now();
const checkWhenDue=()=>{
 if(Date.now()-lastCheck<6*60*60*1000)return;
 lastCheck=Date.now();
 void refreshProductionCalendar();
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkWhenDue()});
window.setInterval(checkWhenDue,6*60*60*1000);
