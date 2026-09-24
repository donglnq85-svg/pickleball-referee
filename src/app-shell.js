import {createMatchRepository} from './match-persistence.js';
import {createTournamentRepository} from './tournament-persistence.js';
import {startWorkSession} from './tournament-domain.js';
import {resolveTodayProjection,TODAY_TIME_ZONE} from './today-projection.js';
import {applyTodayQaFixtureIfRequested} from './today-qa-fixtures.js';
import {openTournamentExperience} from './tournament-experience.js';
import {appHeader} from './app-header.js';
import {bottomNav} from './app-bottom-nav.js';
import './app-shell.css';
import './v1.js';

const app=document.getElementById('app');
applyTodayQaFixtureIfRequested();
const matchRepository=createMatchRepository(localStorage);
const tournamentRepository=createTournamentRepository(localStorage);
let activeTab='today';
let currentProjection=null;

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon=(name)=>{
  const paths={
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    tournament:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/>',
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
const shortDate=value=>value?new Intl.DateTimeFormat('vi-VN',{timeZone:TODAY_TIME_ZONE,day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)).replaceAll('-','/'):'Chưa có ngày';
const clock=value=>value&&String(value).includes('T')?new Intl.DateTimeFormat('vi-VN',{timeZone:TODAY_TIME_ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
const workTime=plan=>plan?.startsAt&&String(plan.startsAt).includes('T')?`${clock(plan.startsAt)}${plan.endsAt&&String(plan.endsAt).includes('T')?' – '+clock(plan.endsAt):''}`:'Chưa có giờ';
const teamNames=(players,team)=>players?.[team]?.length?players[team].map(escape).join(' / '):`Đội ${team}`;

function shell(content,tab=activeTab){
  activeTab=tab;
  app.innerHTML=`<main class="app-shell"${tab==='today'?` data-today-kind="${currentProjection?.kind||'error'}"`:""}>${appHeader(icon('bell'))}<section class="app-content">${content}</section>${bottomNav(tab)}</main>`;
  app.querySelector('.app-content').scrollTop=0;
}


const heading=()=>`<div class="today-heading"><h1>Hôm nay</h1><p>${escape(dateHeading())}</p></div>`;
const arrowButton=(label,action,red=false)=>`<button class="primary-button${red?' red':''}" data-shell="${action}">${escape(label)}${icon('arrow')}</button>`;
const locationRows=work=>`${work?.plan?.startsAt?`<div class="meta-row">${icon('calendar')}<span>${shortDate(work.plan.startsAt)}${String(work.plan.startsAt).includes('T')?` · ${workTime(work.plan)}`:''}</span></div>`:''}${work?.plan?.location?`<div class="meta-row">${icon('pin')}<span>${escape(work.plan.location)}</span></div>${work.plan.city?`<div class="meta-small">${escape(work.plan.city)}</div>`:''}`:''}`;
const workTitle=work=>escape(work?.tournamentName||'Công việc chưa đặt tên');
const matchLabel=match=>escape(match?.label||'Trận tiếp theo');
const calendarMark=()=>`<svg viewBox="0 0 100 80" aria-hidden="true"><defs><linearGradient id="calendar-blue" x2="1" y2="1"><stop stop-color="#a8cffc"/><stop offset="1" stop-color="#83b2f0"/></linearGradient></defs><g fill="none" stroke="#bad7f8" stroke-width="3" stroke-linecap="round"><path d="m6 27 6 4m-7 16 7-2m76-17 6-4m-6 20 7 2"/></g><g transform="rotate(-4 50 40)"><rect x="25" y="12" width="52" height="53" rx="5" fill="#fff"/><path d="M30 12h42a5 5 0 0 1 5 5v10H25V17a5 5 0 0 1 5-5" fill="url(#calendar-blue)"/><g stroke="#a3c6f4" stroke-width="1.5" fill="#eff7ff"><rect x="36" y="7" width="4" height="13" rx="2"/><rect x="63" y="7" width="4" height="13" rx="2"/></g><g fill="#b8d8fb">${[34,47,60].flatMap(x=>[34,47].map(y=>`<rect x="${x}" y="${y}" width="8" height="8" rx="3"/>`)).join('')}</g></g></svg>`;

function noWorkView(p){
  const upcoming=p.upcoming||[];
  const next=upcoming[0];
  const readiness=next?[['Đã nhận công việc',next.readiness?.accepted],['Đã có thông tin giải',next.readiness?.hasTournamentInfo],['Đã có lịch trận',next.readiness?.hasSchedule]].filter(([,verified])=>verified):[];
  return `${heading()}<div class="today-stack today-no-work"><section class="empty-hero"><div class="empty-calendar">${calendarMark()}</div><h2>Hôm nay bạn không có lịch làm việc.</h2><p>Hãy nghỉ ngơi và chuẩn bị cho những giải đấu sắp tới!</p></section>${next?`<section class="today-card work-card"><div class="section-kicker">Công việc sắp tới</div><div class="upcoming-main"><span class="upcoming-icon">${icon('calendar')}</span><div class="upcoming-facts"><div class="upcoming-title"><strong>${workTitle(next)}</strong>${next.countdown?`<span class="upcoming-countdown">${escape(next.countdown)}</span>`:''}</div>${locationRows(next)}</div><button class="upcoming-chevron" data-shell="open-upcoming" data-tournament-id="${escape(next.tournamentId)}" data-assignment-id="${escape(next.assignmentId)}" aria-label="Mở ${workTitle(next)}">›</button></div><button class="primary-button" data-shell="open-upcoming" data-tournament-id="${escape(next.tournamentId)}" data-assignment-id="${escape(next.assignmentId)}">Xem công việc ${icon('arrow')}</button></section>`:''}${readiness.length?`<section class="today-card"><div class="section-kicker">Cần chuẩn bị</div><div class="check-list">${readiness.map(([label])=>`<div class="check-row"><span class="check-icon">✓</span><span>${label}</span></div>`).join('')}</div></section>`:''}${upcoming.length?`<section class="today-card"><div class="section-kicker">Lịch sắp tới</div><div class="schedule-list">${upcoming.map(item=>`<button class="schedule-row" data-shell="open-upcoming" data-tournament-id="${escape(item.tournamentId)}" data-assignment-id="${escape(item.assignmentId)}"><strong>${item.plan?.startsAt?new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',timeZone:TODAY_TIME_ZONE}).format(new Date(item.plan.startsAt)).replaceAll('-','/'):'—'}</strong><span>${workTitle(item)}</span><span aria-hidden="true">›</span></button>`).join('')}</div></section>`:''}</div>`;
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
  try{currentProjection=loadProjection();const views={'no-work':noWorkView,'no-assignments':noWorkView,'work-today':workTodayView,working:workingView,waiting:waitingView,'active-match':activeMatchView,completed:completedView};shell((views[currentProjection.kind]||noWorkView)(currentProjection),'today')}
  catch{currentProjection=null;shell(`${heading()}<section class="today-card waiting-card" role="status"><h2>Chưa thể hiển thị lịch làm việc</h2><p>Thông tin đã lưu vẫn được giữ lại. Vui lòng thử lại.</p><button class="primary-button" data-shell="tab:today">Thử lại</button></section>`,'today')}
}

function workCards(){
  const document=tournamentRepository.load(),items=Object.values(document.tournaments).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  if(!items.length)return '<section class="today-card waiting-card"><h2>Chưa có công việc</h2><p>Module Công việc đang được hoàn thiện theo gói thiết kế riêng.</p></section>';
  return items.map(tournament=>{const active=tournament.workSessions?.find(item=>item.status==='active'),assignment=active?tournament.assignments.find(item=>item.id===active.assignmentId):tournament.assignments?.find(item=>item.status==='assigned');const action=active?'open-tournament':assignment?'start-assignment':'open-tournament';return `<section class="today-card"><div class="section-kicker">${active?'Đang làm việc':'Hồ sơ công việc'}</div><div class="work-title">${escape(tournament.name)}</div><p class="meta-row">${escape(assignment?.label||'Chưa có phần việc được giao')}</p><button class="bridge-button" data-shell="${action}" data-tournament-id="${escape(tournament.id)}" data-assignment-id="${escape(assignment?.id||'')}" data-work-session-id="${escape(active?.id||'')}">${active?'Tiếp tục công việc':assignment?'Bắt đầu ngày làm việc':'Mở hồ sơ công việc'}${icon('arrow')}</button></section>`}).join('');
}
function renderWork(){activeTab='tournament';history.replaceState(null,'',location.pathname+location.search);openTournamentExperience()}
function renderPlaceholder(tab,title,message){history.replaceState(null,'',location.pathname+location.search);shell(`<section class="placeholder"><div class="placeholder-icon">${icon(tab==='matches'?'match':tab==='notifications'?'notice':'profile')}</div><h1>${escape(title)}</h1><p>${escape(message)}</p>${tab==='matches'?'<button class="bridge-button" data-shell="history">Xem lịch sử trận đấu</button>':''}</section>`,tab)}

function openTournamentContext({tournamentId,workSessionId=null,screen='assignment',matchId=null}){window.dispatchEvent(new CustomEvent('application-resume',{detail:{kind:'tournament',screen,tournamentId,workSessionId,matchId}}))}
function beginAssignment(tournamentId,assignmentId){
  try{const tournament=tournamentRepository.get(tournamentId),workSession=startWorkSession(tournament,assignmentId);tournamentRepository.save(tournament,{activeWorkSession:workSession.id});openTournamentContext({tournamentId,workSessionId:workSession.id,screen:'court'})}
  catch(error){alert(error.message)}
}
function todayAction(action){
  const p=currentProjection||loadProjection();
  if(action==='open-work')return renderWork();
  if(action==='resume-match')return window.dispatchEvent(new CustomEvent('match-resume',{detail:{matchId:p.activeMatch.id}}));
  if(action==='start-work')return beginAssignment(p.work.tournamentId,p.work.assignmentId);
  if(action==='prepare-match')return openTournamentContext({tournamentId:p.work.tournamentId,workSessionId:p.work.workSessionId,screen:p.nextMatch.operations?.preMatch?'prematch':'operations',matchId:p.nextMatch.id});
  if(action==='open-active-work')return openTournamentContext({tournamentId:p.work.tournamentId,workSessionId:p.work.workSessionId,screen:'court'});
  if(action==='view-summary')return openTournamentContext({tournamentId:p.work.tournamentId,workSessionId:p.work.workSessionId,screen:'shiftAttention'});
}

document.addEventListener('click',event=>{
  const target=event.target.closest('[data-shell]');if(!target)return;
  const action=target.dataset.shell;
  if(action?.startsWith('tab:')){const tab=action.slice(4);if(tab==='today'){history.replaceState(null,'',location.pathname+location.search);renderToday();}else if(tab==='tournament')renderWork();else if(tab==='matches')renderPlaceholder('matches','Trận đấu','Công cụ trận đấu đang được hoàn thiện. Các trận đang diễn ra vẫn được mở trực tiếp từ Hôm nay.');else if(tab==='notifications')renderPlaceholder('notifications','Thông báo','Module Thông báo đang được hoàn thiện.');else renderPlaceholder('profile','Hồ sơ','Module Hồ sơ đang được hoàn thiện.');return}
  if(action==='open-upcoming'){
    const {tournamentId,assignmentId}=target.dataset;
    location.hash=`/tournaments/${encodeURIComponent(tournamentId)}/work/${encodeURIComponent(assignmentId)}`;
    return openUpcomingRoute();
  }
  if(['open-work','resume-match','start-work','prepare-match','open-active-work','view-summary'].includes(action))return todayAction(action);
  if(action==='notifications')return renderPlaceholder('notifications','Thông báo','Module Thông báo đang được hoàn thiện.');
  if(action==='history')return window.dispatchEvent(new Event('history-open'));
  if(action==='start-assignment')return beginAssignment(target.dataset.tournamentId,target.dataset.assignmentId);
  if(action==='open-tournament')return openTournamentContext({tournamentId:target.dataset.tournamentId,workSessionId:target.dataset.workSessionId||null,screen:target.dataset.workSessionId?'court':'assignment'});
});

function openUpcomingRoute(){
  const route=location.hash.match(/^#\/tournaments\/([^/]+)\/work\/([^/]+)$/);
  if(!route)return false;
  try{activeTab='tournament';openTournamentExperience({tournamentId:decodeURIComponent(route[1]),assignmentId:decodeURIComponent(route[2]),screen:'work'});return true}catch{return false}
}
function refreshToday(){
  if(!app.querySelector('[data-today-kind]'))return;
  const oldContent=app.querySelector('.app-content'),scroll=oldContent?.scrollTop||0;
  const focused=document.activeElement?.closest('[data-shell]');
  const focusKey=focused?{action:focused.dataset.shell,tournamentId:focused.dataset.tournamentId,assignmentId:focused.dataset.assignmentId}:null;
  let signature;try{signature=JSON.stringify(loadProjection())+dateHeading()+navigator.onLine}catch{signature='error'}
  if(signature===lastSignature)return;
  lastSignature=signature;renderToday();
  app.querySelector('.app-content').scrollTop=scroll;
  if(focusKey){const restored=[...app.querySelectorAll('[data-shell]')].find(el=>el.dataset.shell===focusKey.action&&el.dataset.tournamentId===focusKey.tournamentId&&el.dataset.assignmentId===focusKey.assignmentId);restored?.focus({preventScroll:true})}
}
let lastSignature='';
function scheduleClockRefresh(){setTimeout(()=>{refreshToday();scheduleClockRefresh()},60000-Date.now()%60000+25)}
window.addEventListener('app-shell-home',()=>{history.replaceState(null,'',location.pathname+location.search);renderToday()});
window.addEventListener('hashchange',()=>{if(!openUpcomingRoute()&&!location.hash)renderToday()});
window.addEventListener('pageshow',event=>{if(event.persisted){if(!openUpcomingRoute())renderToday()}});
window.addEventListener('focus',refreshToday);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday()});
for(const event of ['storage','referee-domain-changed','online','offline'])window.addEventListener(event,refreshToday);
if(!openUpcomingRoute())renderToday();
scheduleClockRefresh();
