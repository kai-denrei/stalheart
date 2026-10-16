import {smooth,MAZE_ADDED_LENGTH} from './mission.js';

// Measured from the throat, with side passages inheriting the fork's distance.
export const QUIET_STRETCH=48,FORK_DISTANCE=48;
export const colonyDistance=(s,branch='main')=>branch==='main'?s:FORK_DISTANCE+s;
export const colonyPresence=(s,branch='main')=>smooth(QUIET_STRETCH,155,colonyDistance(s,branch));
const stretch=s=>s+MAZE_ADDED_LENGTH*smooth(65,205,s);
const spread=spots=>spots.map(p=>p.branch&&p.branch!=='main'?p:{...p,s:stretch(p.s)});
// FAUNA NEAR THE ENTRANCE (owner, 2026-10-16: 'the cave fauna; more reeds and an assortment of other smaller creatures inside, close to the entrance… then the
// tentacles indicate a path towards one of the ways down'): a few ivories, a gorogoro and a Reed inside the first fifty metres, and tentacles from 30 m on the main
// route as the way-marks; the quiet approach of 2026-10-15 is now the first fifteen metres
export const IVORY_SPOTS=spread([{s:16,a:.8},{s:28,a:2.4},{s:40,a:4.2,bio:true},{s:58,a:0},{s:67,a:2.6},{s:78,a:1.1},{s:88,a:Math.PI/2},{s:99,a:Math.PI/2,bio:true},{s:112,a:Math.PI/2},{s:136,a:Math.PI/2},{s:160,a:3.6,bio:true},{s:185,a:2.2},{s:20,a:1.3,branch:'left'},{s:48,a:2.9,branch:'left',bio:true},{s:91,a:1.2,branch:'left'}]);
export const GORO_SPOTS=spread([{s:34},{s:76},{s:94,bio:true},{s:112},{s:82,branch:'left'},{s:126,branch:'left',bio:true}]);
export const REED_SPOTS=spread([{s:44,branch:'main'},{s:121,branch:'main'},{s:168,branch:'main',bio:true},{s:61,branch:'left'},{s:110,branch:'left'}]);
export const MAIN_TENTACLES=[30,46,58,68,80,89,98,105,112,119,126,133,140,147,154,161,168,175,181,187,192,198,201].map(stretch);
export const LEFT_TENTACLES=[24,41,58,75,92,109,126,143,161];
export const BLIND_TENTACLES=[32,48,65];
