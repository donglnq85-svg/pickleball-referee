import {matchView} from './match-engine.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function courtView(state){
  const view=matchView(state);
  const player=p=>`<div class="court-player ${p.server?'is-server':''} ${p.receiver?'is-receiver':''}" style="--court-x:${p.end==='left'?'17%':'83%'};--court-y:${p.top?'26%':'74%'}" aria-label="${escape(p.name)} · Đội ${p.team}${p.server?' · giao bóng':p.receiver?' · đỡ bóng':''} · ô ${p.lane==='right'?'phải':'trái'}">
    <span class="court-player-badge">${p.ball?'<span class="court-ball" aria-label="Bóng"></span>':''}${p.team}${p.index+1}</span>
    <span class="court-player-name">${escape(p.name)}</span>
    ${p.server||p.receiver?`<span class="court-player-role">${p.server?'GIAO':'ĐỠ'}</span>`:''}
  </div>`;
  return `<section class="ref-court-section" aria-label="Sơ đồ sân theo góc nhìn trọng tài">
    <div class="ref-court-heading"><span>ĐỘI ${view.courtLeft} · BÊN TRÁI</span><span>ĐỘI ${view.courtRight} · BÊN PHẢI</span></div>
    <div class="ref-court"><div class="court-service-lines" aria-hidden="true"></div><div class="court-nvz court-nvz-left" aria-hidden="true"></div><div class="court-nvz court-nvz-right" aria-hidden="true"></div><div class="court-net" aria-label="Lưới"></div>${view.participants.map(player).join('')}</div>
    <p class="ref-court-caption">SÂN NHÌN TỪ VỊ TRÍ TRỌNG TÀI · BÓNG Ở NGƯỜI GIAO</p>
  </section>`;
}
