import {matchView} from './match-engine.js';
import {courtView} from './court-view.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,kind='secondary',disabled=false)=>`<button class="ref-button ref-button-${kind}" data-v1="${action}" ${disabled?'disabled':''}>${label}</button>`;
const playerNames=(s,t)=>s.players[t].map(escape).join(' / ');

function eventsSheet(s){
  const team=t=>`<section class="ref-event-team"><h3>Đội ${t} · ${playerNames(s,t)}</h3>${button(`Time-out · ${s.timeout[t]} đã dùng trong game`,'timeout:'+t,'secondary')}${s.players[t].map((name,i)=>button(`Y tế · ${escape(name)}${s.medical[t][i]?' · đã dùng':''}`,`medical:${t}:${i}`,'secondary',!!s.medical[t][i])).join('')}</section>`;
  return `<div class="ref-sheet-content"><h2>Sự kiện trận đấu</h2><p>Trận và lượt giao hiện tại được giữ nguyên khi tạm dừng.</p>${team('A')}${team('B')}${button('Sửa trạng thái trận','correction','secondary')}</div>`;
}
function correctionSheet(s){
  const view=matchView(s);
  return `<div class="ref-sheet-content"><h2>Sửa trạng thái</h2><p>Đối chiếu với thực tế trước khi lưu. Thao tác được ghi vào lịch sử và có thể hoàn tác.</p>
    <label>Điểm Đội A<input data-f="A" type="number" min="0" max="99" value="${s.score.A}"></label>
    <label>Điểm Đội B<input data-f="B" type="number" min="0" max="99" value="${s.score.B}"></label>
    <label>Đội giao<select data-f="serving"><option ${s.serving==='A'?'selected':''}>A</option><option ${s.serving==='B'?'selected':''}>B</option></select></label>
    ${s.config.type==='double'?`<label>Lượt giao<select data-f="number"><option ${s.serverNumber===1?'selected':''}>1</option><option ${s.serverNumber===2?'selected':''}>2</option></select></label><label>Người giao<select data-f="player">${['A','B'].flatMap(t=>s.players[t].map((n,i)=>`<option value="${t}:${i}" ${t===s.serving&&i===view.serverIndex?'selected':''}>Đội ${t} · ${escape(n)}</option>`)).join('')}</select></label>`:''}
    ${button('Lưu sửa đổi','saveCorrection','primary')}</div>`;
}
function pauseSheet(s){
  const p=s.pause;
  return `<div class="ref-sheet-content ref-pause-sheet"><h2>${p.type==='medical'?'Hỗ trợ y tế':'Time-out'}</h2><p>${p.type==='medical'?escape(s.players[p.team][p.playerIndex]):'Đội '+p.team}</p><div class="ref-clock" data-pauseclock></div><p>Trận bên dưới được giữ nguyên. Đồng hồ tiếp tục chạy khi app ở nền.</p>${button('Trở lại rally đang chờ','endPause','primary')}</div>`;
}
function sheet(s,panel){
  if(!s.pause&&!panel)return '';
  const content=s.pause?pauseSheet(s):panel==='correction'?correctionSheet(s):eventsSheet(s);
  return `<div class="ref-overlay" role="presentation"><button class="ref-scrim" data-v1="${s.pause?'pauseScreen':'closePanel'}" aria-label="${s.pause?'Đang tạm dừng':'Đóng bảng sự kiện'}"></button><section class="ref-sheet" role="dialog" aria-modal="true" aria-label="${s.pause?'Trận đang tạm dừng':panel==='correction'?'Sửa trạng thái':'Sự kiện trận đấu'}">${!s.pause?button('Đóng','closePanel','quiet'):''}${content}</section></div>`;
}

export function renderSession(s,panel){
  const view=matchView(s);
  const call=view.scoreCall.split(' – ');
  const scorePanels=`<div class="ref-call ${s.config.type==='single'?'ref-call-single':''}" aria-label="Xướng tỷ số ${view.scoreCall}">
    <div class="ref-call-cell ref-call-serving"><small>ĐIỂM ĐỘI GIAO</small><strong>${call[0]}</strong><span>ĐỘI ${view.serving}</span></div>
    <div class="ref-call-cell"><small>ĐIỂM ĐỘI ĐỠ</small><strong>${call[1]}</strong><span>ĐỘI ${view.receiving}</span></div>
    ${s.config.type==='double'?`<div class="ref-call-cell ref-call-number"><small>LƯỢT GIAO</small><strong>${call[2]}</strong><span>SERVER ${call[2]}</span></div>`:''}</div>`;
  const teams=`<div class="ref-teams"><div class="ref-team ${view.serving==='A'?'is-serving':''}"><span>ĐỘI A</span><strong>${s.score.A}</strong><small>${playerNames(s,'A')}</small></div><div class="ref-game-status">GAME<br><b>${s.game}/${s.config.sets}</b><small>${s.gamesWon.A} : ${s.gamesWon.B}</small></div><div class="ref-team ${view.serving==='B'?'is-serving':''}"><span>ĐỘI B</span><strong>${s.score.B}</strong><small>${playerNames(s,'B')}</small></div></div>`;
  const body=`<div class="ref-session">${scorePanels}${teams}<div class="ref-service"><span>ĐỘI ${view.serving} GIAO${s.config.type==='double'?' · LƯỢT '+view.serverNumber:''}</span><strong>${escape(view.server)} <em>GIAO →</em> ${escape(view.receiver)} <em>ĐỠ</em></strong></div>${s.notice?`<div class="ref-notice" role="status">${escape(s.notice)}</div>`:''}${courtView(s)}<div class="ref-actions">${button('↶ Hoàn tác','undo','secondary',!s.undo.length)}${button('↷ Làm lại','redo','secondary',!s.redo.length)}${button('⇄ Đổi bên sân','swap','secondary')}${button('Time-out · Y tế · Sự cố','tools','secondary')}</div></div>`;
  const footer=`<div class="ref-rally-actions">${button(`ĐỘI ${view.serving} THẮNG RALLY`,`rally:${view.serving}`,'primary',!!s.pause)}${button(`ĐỘI ${view.receiving} THẮNG RALLY`,`rally:${view.receiving}`,'neutral',!!s.pause)}</div>`;
  return {body,footer,overlay:sheet(s,panel)};
}
