import {scoreCall} from './match-engine.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Date(value).toLocaleString('vi-VN');
const names=(m,t)=>m.players[t].map(escape).join(' / ');
const button=(text,action)=>`<button class="ref-button ref-button-primary" data-v1="${action}">${text}</button>`;

export function historyList(records){
  if(!records.length)return '<p class="ref-empty">Chưa có trận đã hoàn tất.</p>';
  return records.map(m=>`<button class="ref-history-card" data-v1="record:${escape(m.id)}" aria-label="${names(m,'A')} đấu ${names(m,'B')}, kết quả ${m.gamesWon.A} – ${m.gamesWon.B}">
    <span class="ref-history-line"><b>${names(m,'A')}</b><strong>${m.gamesWon.A}</strong></span>
    <span class="ref-history-line"><b>${names(m,'B')}</b><strong>${m.gamesWon.B}</strong></span>
    <span class="ref-history-meta">${date(m.createdAt)} · ${m.config.type==='single'?'Đánh đơn':'Đánh đôi'} · Đã kết thúc</span>
  </button>`).join('');
}

const eventName=e=>{
  if(e.type==='rally')return `Đội ${e.winner} thắng rally`;
  if(e.type==='nextGame')return 'Bắt đầu game tiếp theo';
  if(e.type==='timeout')return `Time-out · Đội ${e.after?.pause?.team||''}`;
  if(e.type==='medical')return `Hỗ trợ y tế · Đội ${e.after?.pause?.team||''}`;
  if(e.type==='resume')return 'Trở lại trận';
  if(e.type==='courtEnd')return 'Đổi bên sân';
  if(e.type==='correction')return 'Trọng tài sửa trạng thái';
  if(e.type==='undo')return 'Hoàn tác '+(e.reverses||'');
  if(e.type==='redo')return 'Làm lại '+(e.reapplies||'');
  return e.type;
};
export function historyDetail(m){
  const winner=m.gamesWon.A>m.gamesWon.B?'A':'B';
  const events=m.events||[];
  return `<section class="ref-detail-result"><h2>Đội ${winner} thắng trận</h2><div class="ref-detail-teams"><span>${names(m,'A')}<b>${m.gamesWon.A}</b></span><span>${names(m,'B')}<b>${m.gamesWon.B}</b></span></div></section>
    <section class="ref-detail-section"><h3>Kết quả từng game</h3>${m.games.map(g=>`<div class="ref-detail-row">Game ${g.game}<strong>${g.score.A} – ${g.score.B}</strong><small>Đội ${g.winner} thắng</small></div>`).join('')}</section>
    <section class="ref-detail-section"><h3>Thông tin trận</h3><p>${m.config.type==='single'?'Đánh đơn':'Đánh đôi'} · ${m.config.sets} game · ${m.config.points} điểm · ${m.config.rule==='touch'?'Chạm điểm':m.config.rule==='maximum'?'Thắng cách 2, cap '+m.config.cap:'Thắng cách 2'}</p><p>${date(m.createdAt)} → ${date(m.finishedAt)}</p><p>Điểm chấp: A ${m.config.start.A} · B ${m.config.start.B}</p><p>Time-out: A ${m.timeoutTotal.A} · B ${m.timeoutTotal.B}</p><p>Y tế: ${m.medical.A.reduce((a,b)=>a+b,0)+m.medical.B.reduce((a,b)=>a+b,0)} lượt</p></section>
    <section class="ref-detail-section"><h3>Diễn biến trận · ${events.length} sự kiện</h3><ol class="ref-event-log">${events.map(e=>`<li><span>${escape(eventName(e))}</span>${e.after?.score?`<small>Game ${e.after.game} · ${e.after.score.A} – ${e.after.score.B} · xướng ${scoreCall(e.after)}</small>`:''}</li>`).join('')}</ol></section>`;
}
