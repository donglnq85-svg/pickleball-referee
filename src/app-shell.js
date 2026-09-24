import {createMatchRepository} from './match-persistence.js';
import {createTournamentRepository} from './tournament-persistence.js';
import {resolveTodayProjection,TODAY_TIME_ZONE} from './today-projection.js';
import './app-shell.css';
import './v1.js';

const app=document.getElementById('app');
const matchRepository=createMatchRepository(localStorage);
const tournamentRepository=createTournamentRepository(localStorage);
let activeTab='today';
let currentProjection=null;

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon=(name)=>{
  const paths={
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    work:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    match:'<path d="M7 3h10v18H7zM3 8h4m10 8h4M10 6v4m4 4v4"/>',
    notice:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.home}</svg>`;
};

function loadProjection(){
  return resolveTodayProjection({matchDocument:matchRepository.load(),tournamentDocument:tournamentRepository.load(),now:new Date(),timeZone:TODAY_TIME_ZONE});
}

function dateHeading(){
  const text=new Intl.DateTimeFormat('vi-VN',{timeZone:TODAY_TIME_ZONE,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  return text.charAt(0).toUpperCase()+text.slice(1);
}
const shortDate=value=>value?new Intl.DateTimeFormat('vi-VN',{timeZone:TODAY_TIME_ZONE,day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'Chưa có ngày';
const clock=value=>value?new Intl.DateTimeFormat('vi-VN',{timeZone:TODAY_TIME_ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
const workTime=plan=>plan?.startsAt?`${clock(plan.startsAt)}${plan.endsAt?' – '+clock(plan.endsAt):''}`:'Chưa có giờ';
const teamNames=(players,team)=>players?.[team]?.length?players[team].map(escape).join(' / '):`Đội ${team}`;

function shell(content,tab=activeTab){
  activeTab=tab;
  app.innerHTML=`<main class="app-shell"><header class="app-header"><div class="app-avatar" aria-label="Hồ sơ trọng tài">TT</div><div class="app-brand">PICKLEBALL REFEREE</div><button class="app-bell" data-shell="notifications" aria-label="Thông báo">${icon('bell')}</button></header><section class="app-content">${content}</section>${bottomNav(tab)}</main>`;
}

function bottomNav(active){
  const items=[['today','home','Hôm nay'],['work','work','Công việc'],['matches','match','Trận đấu'],['notifications','notice','Thông báo'],['profile','profile','Hồ sơ']];
  return `<nav class="app-bottom-nav" aria-label="Điều hướng chính">${items.map(([id,glyph,label])=>`<button class="nav-item ${active===id?'active':''}" data-shell="tab:${id}" aria-current="${active===id?'page':'false'}">${icon(glyph)}<span>${label}</span></button>`).join('')}</nav>`;
}

const heading=()=>`<div class="today-heading"><h1>Hôm nay</h1><p>${escape(dateHeading())}</p></div>`;
const arrowButton=(label,action,red=false)=>`<button class="primary-button${red?' red':''}" data-shell="${action}">${escape(label)}${icon('arrow')}</button>`;
const locationRows=work=>`${work?.plan?.startsAt?`<div class="meta-row">${icon('calendar')}<span>${shortDate(work.plan.startsAt)} · ${workTime(work.plan)}</span></div>`:''}${work?.plan?.location?`<div class="meta-row">${icon('pin')}<span>${escape(work.plan.location)}</span></div>${work.plan.city?`<div class="meta-small">${escape(work.plan.city)}</div>`:''}`:''}`;
const workTitle=work=>escape(work?.tournamentName||'Công việc chưa đặt tên');
const matchLabel=match=>escape(match?.label||'Trận tiếp theo');

function noWorkView(p){
  const upcoming=p.upcoming||[];
  return `${heading()}<div class="today-stack"><section class="empty-hero"><div class="empty-calendar">${icon('calendar')}</div><h2>Hôm nay bạn không có<br>lịch làm việc.</h2><p>Hãy nghỉ ngơi và chuẩn bị cho<br>những giải đấu sắp tới!</p></section><section class="today-card work-card"><div class="section-kicker">Công việc sắp tới</div>${upcoming.length?`<div class="work-title">${workTitle(upcoming[0])}</div>${locationRows(upcoming[0])}`:'<p class="meta-row">Chưa có công việc nào được lên lịch.</p>'}${arrowButton('Xem công việc','open-work')}</section>${upcoming.length>1?`<section class="today-card"><div class="section-kicker">Lịch sắp tới</div><div class="schedule-list">${upcoming.map(item=>`<div class="schedule-row"><strong>${item.plan?.startsAt?new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',timeZone:TODAY_TIME_ZONE}).format(new Date(item.plan.startsAt)):'—'}</strong><span>${workTitle(item)}</span><span>›</span></div>`).join('')}</div></section>`:''}</div>`;
}

function workTodayView(p){
  const checks=[['Đã nhận công việc',p.readiness.accepted],['Đã có thông tin giải',p.readiness.hasTournamentInfo],['Đã có lịch trận',p.readiness.hasSchedule],['Sẵn sàng làm việc',p.readiness.ready]];
  return `${heading()}<div class="today-stack"><section class="today-card work-today-card"><div class="section-kicker">${icon('calendar')}Công việc hôm nay</div><div class="work-title">${workTitle(p.work)}</div>${locationRows(p.work)}${arrowButton('Bắt đầu ngày làm việc','start-work')}</section><section class="today-card"><div class="section-kicker">Cần chuẩn bị</div><div class="check-list">${checks.map(([label,done])=>`<div class="check-row"><span class="check-icon">${done?'✓':'·'}</span><span>${label}</span></div>`).join('')}</div></section><section class="today-card"><div class="section-kicker">Lịch hôm nay</div><div class="schedule-row"><strong>${workTime(p.work.plan).split(' – ')[0]}</strong><span><b>${workTime(p.work.plan)}</b><br>${workTitle(p.work)}</span><span>›</span></div></section></div>`;
}

function progressCard(p){return `<section class="today-card"><div class="section-kicker">Tiến độ hôm nay</div><div class="progress-head"><strong>${p.progress.finished} / ${p.progress.total}<small> trận</small></strong><span>${p.progress.percent}%</span></div><div class="progress-track"><div class="progress-bar" style="width:${Math.max(0,Math.min(100,p.progress.percent))}%"></div></div></section>`}
function nextMatchCard(match,actionLabel='Chuẩn bị trận',action='prepare-match'){
  if(!match)return '';
  return `<section class="today-card match-card"><div class="match-top"><div><div class="section-kicker">Trận tiếp theo</div><div class="match-number">${matchLabel(match)}</div></div><div class="match-place">${escape(match.court)}</div></div><div class="match-context">${match.type==='single'?'Đánh đơn':'Đánh đôi'} · ${escape(match.group)}</div><div class="versus">${teamNames(match.players,'A')}<small>VS</small>${teamNames(match.players,'B')}</div>${arrowButton(actionLabel,action)}</section>`;
}
function workingView(p){
  const list=(p.upcomingMatches||[]).slice(0,3);
  return `${heading()}<div class="today-stack"><section class="status-banner"><strong><span class="status-dot">✓</span>Đang làm việc</strong><p>${workTitle(p.work)}</p></section>${nextMatchCard(p.nextMatch)}${progressCard(p)}${list.length?`<section class="today-card"><div class="section-kicker">Lịch trận tiếp theo</div><div class="timeline-list">${list.map((match,index)=>`<div class="timeline-item"><time>${index===0?'Tiếp':'Sau'}</time><span class="timeline-marker"></span><div><b>${matchLabel(match)} · ${escape(match.court)}</b>${escape(match.group)} · ${teamNames(match.players,'A')} vs ${teamNames(match.players,'B')}</div><span>›</span></div>`).join('')}</div></section>`:''}</div>`;
}
function waitingView(p){return `${heading()}<div class="today-stack"><section class="status-banner"><strong><span class="status-dot">✓</span>Đang làm việc</strong><p>${workTitle(p.work)}</p></section><section class="today-card waiting-card"><h2>Đang chờ trận tiếp theo</h2><p>Chưa có trận nào cần chuẩn bị ngay. Mở công việc để kiểm tra tình trạng tại sân.</p>${arrowButton('Xem công việc','open-active-work')}</section>${progressCard(p)}</div>`}
function activeMatchView(p){
  const m=p.activeMatch;
  return `${heading()}<div class="today-stack"><section class="today-card live-card"><div class="live-badge">ĐANG DIỄN RA</div><div class="match-top"><div><div class="match-number">${escape(m.label)}</div><div class="match-context">${escape(m.group||'Trận đang diễn ra')}</div></div><div class="match-place">${escape(m.court||'')}</div></div><div class="live-score"><span>${teamNames(m.players,'A')}</span><strong>${m.points.A}</strong></div><div class="live-score"><span>${teamNames(m.players,'B')}</span><strong>${m.points.B}</strong></div><div class="live-footer"><span>Game ${m.game}</span><span>${m.gamesWon.A} – ${m.gamesWon.B} game</span></div>${arrowButton('Quay lại trận đấu','resume-match',true)}</section>${p.work?progressCard(p):''}${p.nextMatch?`<section class="today-card"><div class="section-kicker">Trận tiếp theo</div><div class="schedule-row"><strong>Sau</strong><span><b>${matchLabel(p.nextMatch)} · ${escape(p.nextMatch.court)}</b><br>${teamNames(p.nextMatch.players,'A')} vs ${teamNames(p.nextMatch.players,'B')}</span><span>›</span></div></section>`:''}</div>`;
}
function completedView(p){
  const hours=Math.floor(p.summary.durationMinutes/60),minutes=p.summary.durationMinutes%60,time=`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  return `${heading()}<div class="today-stack"><section class="success-hero"><div class="success-mark">${icon('check')}</div><h2>Hoàn thành hôm nay</h2><div class="tournament">${workTitle(p.work)}</div><p>Cảm ơn bạn đã cống hiến<br>vì tinh thần thể thao công bằng!</p></section><section class="today-card summary-grid"><div class="summary-stat"><strong>${p.summary.matches}</strong><span>trận<br>đã điều hành</span></div><div class="summary-stat"><strong>${time}</strong><span>thời gian<br>làm việc</span></div></section>${arrowButton('Xem tổng kết','view-summary')}<section class="today-card quote-card">Công bằng không tự nhiên mà có,<br>nó được tạo nên từ những người như bạn.<small>Pickleball Referee</small></section></div>`;
}

function renderToday(){
  activeTab='today';
  try{currentProjection=loadProjection();const views={'no-work':noWorkView,'work-today':workTodayView,working:workingView,waiting:waitingView,'active-match':activeMatchView,completed:completedView};shell((views[currentProjection.kind]||noWorkView)(currentProjection),'today')}
  catch(error){shell(`${heading()}<section class="today-card waiting-card"><h2>Chưa thể khôi phục dữ liệu</h2><p>${escape(error.message)}</p><p>Dữ liệu gốc được giữ nguyên để có thể xử lý an toàn.</p></section>`,'today')}
}

function workCards(){
  const document=tournamentRepository.load(),items=Object.values(document.tournaments).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  if(!items.length)return '<section class="today-card waiting-card"><h2>Chưa có công việc</h2><p>Module Công việc đang được hoàn thiện theo gói thiết kế riêng.</p></section>';
  return items.map(tournament=>{const active=tournament.workSessions?.find(item=>item.status==='active'),assignment=active?tournament.assignments.find(item=>item.id===active.assignmentId):tournament.assignments?.find(item=>item.status==='assigned');return `<section class="today-card"><div class="section-kicker">${active?'Đang làm việc':'Hồ sơ công việc'}</div><div class="work-title">${escape(tournament.name)}</div><p class="meta-row">${escape(assignment?.label||'Chưa có phần việc được giao')}</p><button class="bridge-button" data-shell="open-tournament" data-tournament-id="${escape(tournament.id)}" data-work-session-id="${escape(active?.id||'')}">${active?'Tiếp tục công việc':'Mở hồ sơ công việc'}${icon('arrow')}</button></section>`}).join('');
}
function renderWork(){shell(`<div class="work-bridge"><div class="bridge-title"><h1>Công việc</h1><p>Đi tới đúng hồ sơ và trạng thái công việc hiện có.</p></div>${workCards()}</div>`,'work')}
function renderPlaceholder(tab,title,message){shell(`<section class="placeholder"><div class="placeholder-icon">${icon(tab==='matches'?'match':tab==='notifications'?'notice':'profile')}</div><h1>${escape(title)}</h1><p>${escape(message)}</p>${tab==='matches'?'<button class="bridge-button" data-shell="history">Xem lịch sử trận đấu</button>':''}</section>`,tab)}

function openTournamentContext({tournamentId,workSessionId=null,screen='assignment',matchId=null}){window.dispatchEvent(new CustomEvent('application-resume',{detail:{kind:'tournament',screen,tournamentId,workSessionId,matchId}}))}
function todayAction(action){
  const p=currentProjection||loadProjection();
  if(action==='open-work')return renderWork();
  if(action==='resume-match')return window.dispatchEvent(new CustomEvent('match-resume',{detail:{matchId:p.activeMatch.id}}));
  if(action==='start-work')return openTournamentContext({tournamentId:p.work.tournamentId,screen:'assignment'});
  if(action==='prepare-match')return openTournamentContext({tournamentId:p.work.tournamentId,workSessionId:p.work.workSessionId,screen:p.nextMatch.operations?.preMatch?'prematch':'operations',matchId:p.nextMatch.id});
  if(action==='open-active-work')return openTournamentContext({tournamentId:p.work.tournamentId,workSessionId:p.work.workSessionId,screen:'court'});
  if(action==='view-summary')return openTournamentContext({tournamentId:p.work.tournamentId,workSessionId:p.work.workSessionId,screen:'shiftAttention'});
}

document.addEventListener('click',event=>{
  const target=event.target.closest('[data-shell]');if(!target)return;
  const action=target.dataset.shell;
  if(action?.startsWith('tab:')){const tab=action.slice(4);if(tab==='today')renderToday();else if(tab==='work')renderWork();else if(tab==='matches')renderPlaceholder('matches','Trận đấu','Công cụ trận đấu đang được hoàn thiện. Các trận đang diễn ra vẫn được mở trực tiếp từ Hôm nay.');else if(tab==='notifications')renderPlaceholder('notifications','Thông báo','Module Thông báo đang được hoàn thiện.');else renderPlaceholder('profile','Hồ sơ','Module Hồ sơ đang được hoàn thiện.');return}
  if(['open-work','resume-match','start-work','prepare-match','open-active-work','view-summary'].includes(action))return todayAction(action);
  if(action==='notifications')return renderPlaceholder('notifications','Thông báo','Module Thông báo đang được hoàn thiện.');
  if(action==='history')return window.dispatchEvent(new Event('history-open'));
  if(action==='open-tournament')return openTournamentContext({tournamentId:target.dataset.tournamentId,workSessionId:target.dataset.workSessionId||null,screen:target.dataset.workSessionId?'court':'assignment'});
});

window.addEventListener('app-shell-home',renderToday);
window.addEventListener('pageshow',event=>{if(event.persisted)renderToday()});
renderToday();
