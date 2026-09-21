import {createMatch,rally,undo,redo,nextGame,scoreCall,serverIndex,receiverIndex,rightPlayer,other,setCourtLeft,startPause,endPause,correct} from './match-engine.js';
import './v1.css';

const app=document.getElementById('app');
const ACTIVE='pickleball-referee:v1:active', DRAFT='pickleball-referee:v1:draft', HISTORY='pickleball-referee:v1:history';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{alert('Không lưu được trận trên thiết bị này. Kiểm tra dung lượng trình duyệt.');return false}};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=read(ACTIVE,null),draft=read(DRAFT,null),history=read(HISTORY,[]),screen='',warmInterval=null,medicalChoice=null;
function save(){if(state)write(ACTIVE,state);if(draft)write(DRAFT,draft);else localStorage.removeItem(DRAFT)}
function recordIfFinished(){if(state?.status!=='finished')return;history=read(HISTORY,[]);if(!history.some(m=>m.id===state.id)){history.unshift(structuredClone(state));write(HISTORY,history)}localStorage.removeItem(ACTIVE)}
const names=team=>(state||draft)?.config?.players?.[team]||state?.players?.[team]||[];
function base(title,body,footer=''){
  window.v1Active=true;
  app.innerHTML=`<main class="v1"><header class="v1-head"><button data-v1="home" aria-label="Về trang chủ">‹</button><h1>${title}</h1></header><div class="v1-body">${body}</div>${footer?`<footer class="v1-footer">${footer}</footer>`:''}</main>`;
}
function button(text,act,cls='v1-main'){return `<button class="${cls}" data-v1="${act}">${text}</button>`}
function mainHome(){
  const place=app.querySelector('#v1-home-actions');if(!place)return;
  const active=read(ACTIVE,null),pending=read(DRAFT,null),count=read(HISTORY,[]).length;
  place.innerHTML=`${active?button('TRẬN ĐANG DIỄN RA — TIẾP TỤC','resume'):pending?button('Tiếp tục chuẩn bị trận','resumeDraft'):''}${button(`Lịch sử trận đấu${count?' · '+count:''}`,'history','v1-home-button')}`;
}
new MutationObserver(()=>{if(app.querySelector('#v1-home-actions')&&!app.querySelector('#v1-home-actions button'))mainHome()}).observe(app,{subtree:true,childList:true});
function parseConfig(){
  const pressed=selector=>app.querySelector(selector+'[aria-pressed="true"]')||app.querySelector(selector+'.on');
  const type=pressed('.q4mChoices button')?.dataset.a==='single'?'single':'double';
  const sets=Number(pressed('.q4mFormats button')?.dataset.a?.slice(3)||1);
  const points=Number(app.querySelector('.q4mCustomPoints output[aria-label="Điểm thắng tùy chỉnh"]')?.textContent||pressed('.q4mPointChoices button')?.textContent||11);
  const selectedRule=pressed('.q4mWinChoices button')?.dataset.a;
  const capMode=pressed('.q4mCapChoices button')?.dataset.a;
  const rule=selectedRule==='touch'?'touch':capMode==='maximum'?'maximum':'unlimited';
  const cap=Number(app.querySelector('output[aria-label="Điểm tối đa"]')?.textContent||points+4);
  const players={A:[],B:[]};for(const team of ['A','B'])for(let i=1;i<=(type==='single'?1:2);i++)players[team].push(app.querySelector('#'+team.toLowerCase()+i)?.value.trim()||`VĐV ${team}${i}`);
  const start={A:Number(app.querySelector('[aria-label="Điểm bắt đầu Đội A"]')?.textContent||0),B:Number(app.querySelector('[aria-label="Điểm bắt đầu Đội B"]')?.textContent||0)};
  return {type,sets,points,rule,cap,players,start,note:app.querySelector('#match-note')?.value||'',scoring:'side-out'};
}
window.addEventListener('v1-config',event=>{
  for(const input of app.querySelectorAll('[data-player]')) {
    input.setCustomValidity(input.value.trim()?'':'Vui lòng nhập tên vận động viên');
    if(!input.reportValidity()){input.focus();return}
  }
  if(read(ACTIVE,null) && !window.confirm('Bắt đầu trận mới sẽ bỏ trận đang diễn ra trên thiết bị này. Tiếp tục?'))return;
  const config=parseConfig();if(!Object.values(config.players).flat().every(n=>n.trim()))return;
  draft={config,formHtml:event.detail.html,phase:'warmup',warmSeconds:0,warmDeadline:0,final:null};state=null;save();screen='warmup';renderWarm();
});
function renderWarm(){
  if(!draft)return;
  clearInterval(warmInterval);screen='warmup';
  const running=draft.warmDeadline>0,remaining=Math.max(0,Math.ceil((draft.warmDeadline-Date.now())/1000));
  if(running&&remaining<=0){draft.warmDeadline=0;save();return startFinal()}
  const clock=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  base('Chuẩn bị trận',`<p class="v1-muted">${draft.config.type==='single'?'Đánh đơn':'Đánh đôi'} · ${draft.config.sets} game · ${draft.config.points} điểm</p><h2>Khởi động</h2><p>Có thể bỏ qua để thiết lập vị trí thực tế ngay trước khi bắt đầu.</p>${running?`<div class="v1-clock" data-clock>${clock(remaining)}</div><p class="v1-muted">Đồng hồ chạy theo thời gian thực.</p>`:`<div class="v1-options">${[1,2,3,5].map(n=>`<button data-v1="warm:${n}" ${draft.warmSeconds===n*60?'class="selected"':''}>${n} phút</button>`).join('')}</div><label class="v1-custom">Thời lượng khác (phút) <input type="number" min="1" max="60" inputmode="numeric" data-v1-custom value="${draft.warmSeconds?draft.warmSeconds/60:''}"></label>`}`,
    running?button('Kết thúc khởi động','finishWarm') : `${button('Bỏ qua khởi động','skipWarm','v1-secondary')}${button('Bắt đầu đồng hồ','startWarm')}`);
  if(running)warmInterval=setInterval(()=>{const sec=Math.max(0,Math.ceil((draft.warmDeadline-Date.now())/1000));const node=app.querySelector('[data-clock]');if(node)node.textContent=clock(sec);if(sec===0){clearInterval(warmInterval);draft.warmDeadline=0;save();startFinal()}},300);
}
function startFinal(){if(!draft)return;clearInterval(warmInterval);draft.phase='final';draft.warmDeadline=0;save();screen='final';if(draft.next)return renderNextFinal();if(draft.config.type==='double')window.v1OpenFinalSetup(draft.formHtml,draft.config.start);else renderSingleFinal()}
window.addEventListener('v1-final-back',()=>{if(draft){draft.phase='warmup';save();renderWarm()}});
function renderSingleFinal(){
  const f=draft.final||{serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0};draft.final=f;save();screen='finalSingle';
  base('Final Setup',`<p class="v1-muted">Sau khởi động · theo góc nhìn trọng tài</p><h2>Kiểm tra vị trí thực tế</h2><div class="v1-setting"><b>Ai giao trước?</b><div class="v1-options">${['A','B'].map(t=>`<button data-v1="serve:${t}" class="${f.serving===t?'selected':''}">Đội ${t} · ${escape(draft.config.players[t][0])}</button>`).join('')}</div></div><div class="v1-setting"><b>Ai ở bên trái trọng tài?</b><div class="v1-options">${['A','B'].map(t=>`<button data-v1="end:${t}" class="${f.courtLeft===t?'selected':''}">Đội ${t}</button>`).join('')}</div></div>${courtPreview(draft.config,f)}<div class="v1-call">${draft.config.start[f.serving]} – ${draft.config.start[other(f.serving)]}</div><p>${escape(draft.config.players[f.serving][0])} giao → ${escape(draft.config.players[other(f.serving)][0])} đỡ</p>`,button('Xem lại và bắt đầu','reviewFinal'));
}
function renderNextFinal(){
  const f=draft.final,c=draft.config;
  f.serverIndex=c.type==='single'?0:(c.start[f.serving]%2===0?f.right[f.serving]:1-f.right[f.serving]);
  f.receiverIndex=c.type==='single'?0:(c.start[f.serving]%2===0?f.right[other(f.serving)]:1-f.right[other(f.serving)]);
  save();screen='finalNext';
  base(`Final Setup · Game ${state.game+1}`,`<p class="v1-muted">Đội giao và bên sân dự kiến đã được chuyển từ game trước. Kiểm tra vị trí thực tế trước khi bắt đầu.</p><div class="v1-setting"><b>Đội giao trước</b><div class="v1-options">${['A','B'].map(t=>`<button data-v1="nextServe:${t}" class="${f.serving===t?'selected':''}">Đội ${t}</button>`).join('')}</div></div><div class="v1-setting"><b>Bên trái trọng tài</b><div class="v1-options">${['A','B'].map(t=>`<button data-v1="nextEnd:${t}" class="${f.courtLeft===t?'selected':''}">Đội ${t}</button>`).join('')}</div></div>${c.type==='double'?`<div class="v1-setting"><b>Vị trí VĐV</b><div class="v1-options">${['A','B'].map(t=>button(`Đổi vị trí Đội ${t}`,'nextSwap:'+t,'v1-secondary')).join('')}</div></div>`:''}${courtPreview(c,f)}<div class="v1-call">${c.start[f.serving]} – ${c.start[other(f.serving)]}${c.type==='double'?' – 2':''}</div><div class="v1-pair">${escape(c.players[f.serving][f.serverIndex])} GIAO → ${escape(c.players[other(f.serving)][f.receiverIndex])} ĐỠ</div>`,button('Xác nhận và bắt đầu game','reviewFinal'));
}
function parseDoublesFinal(detail){
  const doc=document.createElement('div');doc.innerHTML=detail.html;
  const left=doc.querySelector('.p5v3labels span')?.textContent.match(/ĐỘI ([AB])/)?.[1]||'A';
  const right={A:0,B:0};let serverIndex=0,receiverIndex=0;
  doc.querySelectorAll('.p5v3p').forEach(el=>{
    const id=el.querySelector('.p5v3pid')?.textContent||'';const team=id[0],index=Number(id[1])-1;
    if(!['A','B'].includes(team)||index<0)return;
    const bottom=parseFloat(el.style.top)>50;
    if((team===left&&bottom)||(team!==left&&!bottom))right[team]=index;
    if(el.classList.contains('server'))serverIndex=index;
    if(el.classList.contains('receiver'))receiverIndex=index;
  });
  return {serving:detail.serveTeam,courtLeft:left,right,serverIndex,receiverIndex};
}
window.addEventListener('v1-final-ready',event=>{if(!draft)return;draft.final=parseDoublesFinal(event.detail);save();screen='review';renderReview()});
function courtPreview(config,final,s=null){
  const left=final.courtLeft,right=other(left),score=s?.score||config.start,serving=s?.serving||final.serving;
  const parity=score[serving]%2===0;
  const slot=(team,top)=>{
    const data=config.players[team];
    if(config.type==='single'){
      const isRight=team===left?!top:top;
      const active=isRight===parity;
      return `<div class="v1-slot">${active?`<b>${escape(data[0])}</b><small>${team===serving?'GIAO':'ĐỠ'}</small>`:''}</div>`;
    }
    const index=team===left?(top?1-(s?rightPlayer(s,team):final.right[team]):(s?rightPlayer(s,team):final.right[team])):(top?(s?rightPlayer(s,team):final.right[team]):1-(s?rightPlayer(s,team):final.right[team]));
    const server=team===serving&&index===(s?serverIndex(s):final.serverIndex);
    const receiver=team!==serving&&index===(s?receiverIndex(s):final.receiverIndex);
    return `<div class="v1-slot"><b>${escape(data[index])}</b><small>${server?'GIAO':receiver?'ĐỠ':''}</small></div>`;
  };
  return `<div class="v1-court"><div class="v1-court-label">BÊN TRÁI · ĐỘI ${left}</div><div class="v1-court-label">BÊN PHẢI · ĐỘI ${right}</div><div class="v1-half">${slot(left,true)}${slot(left,false)}</div><div class="v1-half">${slot(right,true)}${slot(right,false)}</div></div><p class="v1-referee">VỊ TRÍ THEO GÓC NHÌN TRỌNG TÀI</p>`;
}
function renderReview(){if(!draft?.final)return;screen='review';const f=draft.final,c=draft.config;
  const servingName=c.players[f.serving][f.serverIndex],receiverName=c.players[other(f.serving)][c.type==='single'?0:f.receiverIndex];
  base('Final Setup',`<p class="v1-muted">Đối chiếu lần cuối trước khi xướng điểm</p>${courtPreview(c,f)}<div class="v1-call">${c.start[f.serving]} – ${c.start[other(f.serving)]}${c.type==='double'?' – 2':''}</div><div class="v1-pair">${escape(servingName)} GIAO → ${escape(receiverName)} ĐỠ</div><p>Đội ${f.serving} giao trước · ${c.type==='single'?'Đánh đơn':'Đánh đôi'}.</p>`,`${button('Sửa vị trí','editFinal','v1-secondary')}${button('BẮT ĐẦU TRẬN','begin')}`)
}
function teamLabel(team){return `ĐỘI ${team} · ${state.players[team].map(escape).join(' / ')}`}
function renderMatch(){if(!state)return;screen='match';const s=state,serving=s.serving,receiving=other(serving),server=s.players[serving][serverIndex(s)],receiver=s.players[receiving][receiverIndex(s)];
  if(s.status==='gameEnd'||s.status==='finished')return renderResult();
  const p=s.pause;
  const pauseButtons=['A','B'].map(t=>`<div class="v1-toolteam"><b>Đội ${t}</b><button data-v1="timeout:${t}" ${p?'disabled':''}>Time-out · đã dùng ${s.timeout[t]} trong game</button>${s.players[t].map((n,i)=>`<button data-v1="medical:${t}:${i}" ${s.medical[t][i]||p?'disabled':''}>Y tế · ${escape(n)}</button>`).join('')}</div>`).join('');
  base(`Game ${s.game}/${s.config.sets}`,`<div class="v1-matchScore"><div><small>ĐỘI A</small><strong>${s.score.A}</strong><span>${s.players.A.map(escape).join(' / ')}</span></div><div><small>ĐỘI B</small><strong>${s.score.B}</strong><span>${s.players.B.map(escape).join(' / ')}</span></div></div><div class="v1-call">${scoreCall(s)}</div><div class="v1-pair">${escape(server)} GIAO → ${escape(receiver)} ĐỠ${s.config.type==='double'?` · LƯỢT ${s.serverNumber}`:''}</div>${s.notice?`<div class="v1-notice">${escape(s.notice)}</div>`:''}${courtPreview(s.config,{courtLeft:s.courtLeft,serving:s.serving,right:{}},s)}<div class="v1-utilities">${button('Hoàn tác','undo','v1-secondary')}${button('Làm lại','redo','v1-secondary')}${button('Đổi bên sân','swap','v1-secondary')}${button('Time-out / Y tế','tools','v1-secondary')}${button('Sửa trạng thái','correction','v1-secondary')}${button('Trợ lý trọng tài','help','v1-secondary')}</div><div id="v1-extra"></div>`,p?button('Xem thời gian tạm dừng','pauseScreen'): `<div class="v1-rally">${button('ĐỘI A THẮNG RALLY','rally:A','v1-rallyA')}${button('ĐỘI B THẮNG RALLY','rally:B','v1-rallyB')}</div>`);
  if(medicalChoice==='tools')app.querySelector('#v1-extra').innerHTML=`<div class="v1-tools">${pauseButtons}</div>`;
  if(medicalChoice==='help')app.querySelector('#v1-extra').innerHTML='<div class="v1-tools"><b>Trợ lý trọng tài</b><p>Chỉ xướng điểm khi người giao, người đỡ đã vào đúng vị trí và VĐV sẵn sàng. Trước lượt giao tiếp theo, đối chiếu sơ đồ và tỷ số trên màn hình.</p></div>';
  if(medicalChoice==='correction')app.querySelector('#v1-extra').innerHTML=`<div class="v1-tools"><b>Sửa trạng thái trước lượt giao tiếp theo</b><p>Đối chiếu bảng điểm và vị trí thực tế. Thay đổi được ghi vào lịch sử và có thể hoàn tác.</p><label>Điểm Đội A<input data-f="A" type="number" min="0" max="99" value="${s.score.A}"></label><label>Điểm Đội B<input data-f="B" type="number" min="0" max="99" value="${s.score.B}"></label><label>Đội giao<select data-f="serving"><option ${s.serving==='A'?'selected':''}>A</option><option ${s.serving==='B'?'selected':''}>B</option></select></label>${s.config.type==='double'?`<label>Lượt giao<select data-f="number"><option ${s.serverNumber===1?'selected':''}>1</option><option ${s.serverNumber===2?'selected':''}>2</option></select></label><label>Người giao<select data-f="player">${['A','B'].flatMap(t=>s.players[t].map((n,i)=>`<option value="${t}:${i}" ${t===s.serving&&i===serverIndex(s)?'selected':''}>Đội ${t} · ${escape(n)}</option>`)).join('')}</select></label>`:''}${button('Lưu sửa đổi','saveCorrection')}</div>`;
}
function renderPause(){if(!state?.pause)return;screen='pause';const p=state.pause;
  const update=()=>{const el=app.querySelector('[data-pauseclock]');if(!el)return;const remaining=Math.max(0,Math.ceil((p.duration-(Date.now()-p.startedAt))/1000));el.textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`};
  base(p.type==='medical'?'Hỗ trợ y tế':'Time-out',`<p>${p.type==='medical'?escape(state.players[p.team][p.playerIndex]):'Đội '+p.team}</p><div class="v1-clock" data-pauseclock></div><p class="v1-muted">Trận và vị trí được giữ nguyên. Đồng hồ vẫn tính khi ứng dụng chạy nền.</p>`,button('Trở lại trận','endPause'));update();clearInterval(warmInterval);warmInterval=setInterval(update,500);
}
function renderResult(){if(!state)return;screen='result';const s=state,last=s.games.at(-1);
  base(s.status==='finished'?'Kết quả trận':`Game ${last.game} kết thúc`,`<h2>Đội ${last.winner} thắng ${s.status==='finished'?'trận':'game '+last.game}</h2><div class="v1-matchScore"><div><small>ĐỘI A</small><strong>${last.score.A}</strong></div><div><small>ĐỘI B</small><strong>${last.score.B}</strong></div></div><p>Tỷ số game: ${s.gamesWon.A} – ${s.gamesWon.B}</p><div class="v1-gameList">${s.games.map(g=>`<div>Game ${g.game} · ${g.score.A} – ${g.score.B} · Đội ${g.winner}</div>`).join('')}</div>${button('Hoàn tác rally cuối','undo','v1-secondary')}`,s.status==='finished'?`${button('Lịch sử trận đấu','history')}${button('Về trang chủ','home','v1-secondary')}`:button('Final Setup game tiếp theo','nextGame'));
}
function renderHistory(){screen='history';history=read(HISTORY,[]);
  base('Lịch sử trận đấu',history.length?history.map(m=>`<button class="v1-record" data-v1="record:${m.id}"><b>${escape(m.players.A.join(' / '))} – ${escape(m.players.B.join(' / '))}</b><span>${new Date(m.createdAt).toLocaleString('vi-VN')} · ${m.config.type==='single'?'Đơn':'Đôi'} · ${m.gamesWon.A}–${m.gamesWon.B}</span></button>`).join(''):'<p>Chưa có trận đã hoàn tất.</p>',button('Về trang chủ','home','v1-secondary'));
}
function renderRecord(id){const m=history.find(item=>item.id===id);if(!m)return renderHistory();screen='record';
  base('Chi tiết trận',`<h2>Đội ${m.gamesWon.A>m.gamesWon.B?'A':'B'} thắng · ${m.gamesWon.A}–${m.gamesWon.B}</h2><p>${escape(m.players.A.join(' / '))} – ${escape(m.players.B.join(' / '))}</p><p>${new Date(m.createdAt).toLocaleString('vi-VN')} → ${new Date(m.finishedAt).toLocaleString('vi-VN')}</p><p>${m.config.type==='single'?'Đánh đơn':'Đánh đôi'} · ${m.config.sets} game · ${m.config.points} điểm · ${m.config.rule==='touch'?'Chạm điểm':m.config.rule==='maximum'?'Cách biệt 2, có cap '+m.config.cap:'Cách biệt 2'}</p><p>Điểm chấp: A ${m.config.start.A} · B ${m.config.start.B}</p><div class="v1-gameList">${m.games.map(g=>`<div>Game ${g.game}: ${g.score.A} – ${g.score.B} · Đội ${g.winner} thắng</div>`).join('')}</div><p>Time-out: A ${m.timeoutTotal.A} · B ${m.timeoutTotal.B}</p><p>Y tế: ${m.medical.A.reduce((a,b)=>a+b,0)+m.medical.B.reduce((a,b)=>a+b,0)} lượt · Sự kiện: ${m.events.length}</p>`,button('Lịch sử trận đấu','history'));
}
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-v1]');if(!b)return;event.preventDefault();event.stopImmediatePropagation();const action=b.dataset.v1;
  if(action==='home'){clearInterval(warmInterval);screen='';window.location.reload();return}
  if(action==='resume'){state=read(ACTIVE,null);if(state){medicalChoice=null;state.pause?renderPause():renderMatch()}return}
  if(action==='resumeDraft'){draft=read(DRAFT,null);if(!draft)return;if(draft.phase==='warmup')renderWarm();else if(draft.final)renderReview();else startFinal();return}
  if(action==='history')return renderHistory();if(action.startsWith('record:'))return renderRecord(action.slice(7));
  if(action.startsWith('warm:')){draft.warmSeconds=Number(action.slice(5))*60;save();return renderWarm()}
  if(action==='skipWarm'||action==='finishWarm')return startFinal();
  if(action==='startWarm'){const input=app.querySelector('[data-v1-custom]');const mins=Number(input?.value);if(Number.isFinite(mins)&&mins>0&&mins<=60)draft.warmSeconds=Math.round(mins*60);if(!draft.warmSeconds)return alert('Chọn thời lượng hoặc bỏ qua khởi động.');draft.warmDeadline=Date.now()+draft.warmSeconds*1000;save();return renderWarm()}
  if(action.startsWith('serve:')){draft.final.serving=action.slice(6);return renderSingleFinal()}
  if(action.startsWith('end:')){draft.final.courtLeft=action.slice(4);return renderSingleFinal()}
  if(action==='reviewFinal')return renderReview();
  if(action==='editFinal')return draft.next?renderNextFinal():draft.config.type==='single'?renderSingleFinal():startFinal();
  if(action.startsWith('nextServe:')){draft.final.serving=action.slice(10);return renderNextFinal()}
  if(action.startsWith('nextEnd:')){draft.final.courtLeft=action.slice(8);return renderNextFinal()}
  if(action.startsWith('nextSwap:')){const team=action.slice(9);draft.final.right[team]=1-draft.final.right[team];return renderNextFinal()}
  if(action==='begin'){if(state?.status==='gameEnd')nextGame(state,draft.final);else state=createMatch(draft.config,draft.final);state.formHtml=draft.formHtml;draft=null;save();medicalChoice=null;return renderMatch()}
  if(action==='nextGame'){
    const serving=other(state.initialServing||state.serving),courtLeft=other(state.courtLeft),right={A:0,B:0};
    if(state.config.type==='double')for(const team of ['A','B'])right[team]=state.config.start[team]%2===0?state.anchor[team]:1-state.anchor[team];
    draft={config:state.config,formHtml:state.formHtml||lastFormHtml,phase:'final',next:true,final:{serving,courtLeft,right,serverIndex:0,receiverIndex:0}};
    save();return startFinal();
  }
  if(action==='undo'){if(!state)return;const wasFinished=state.status==='finished';undo(state);if(wasFinished&&state.status!=='finished'){history=read(HISTORY,[]).filter(m=>m.id!==state.id);write(HISTORY,history)}if(state.status!=='finished')write(ACTIVE,state);else recordIfFinished();return state.status==='playing'?renderMatch():renderResult()}
  if(action==='redo'){if(!state)return;redo(state);if(state.status!=='finished')write(ACTIVE,state);else recordIfFinished();return state.status==='playing'?renderMatch():renderResult()}
  if(action.startsWith('rally:')){if(!state)return;rally(state,action.slice(6));write(ACTIVE,state);recordIfFinished();return state.status==='playing'?renderMatch():renderResult()}
  if(action==='swap'){setCourtLeft(state,other(state.courtLeft));save();return renderMatch()}
  if(action==='tools'||action==='help'||action==='correction'){medicalChoice=medicalChoice===action?null:action;return renderMatch()}
  if(action==='saveCorrection'){
    const val=name=>app.querySelector('[data-f="'+name+'"]')?.value;
    const serving=val('serving'),selected=val('player')||`${serving}:0`;
    if(selected.split(':')[0]!==serving)return alert('Chọn người giao thuộc đội đang giao.');
    try{correct(state,{A:val('A'),B:val('B'),serving,number:val('number'),player:selected.split(':')[1]});save();recordIfFinished();medicalChoice=null;return state.status==='playing'?renderMatch():renderResult()}
    catch(error){return alert(error.message)}
  }
  if(action.startsWith('timeout:')){startPause(state,'timeout',action.split(':')[1]);save();medicalChoice=null;return renderPause()}
  if(action.startsWith('medical:')){const [,team,index]=action.split(':');startPause(state,'medical',team,Number(index));save();medicalChoice=null;return renderPause()}
  if(action==='pauseScreen')return renderPause();
  if(action==='endPause'){clearInterval(warmInterval);endPause(state);save();return renderMatch()}
},true);
let lastFormHtml='';window.addEventListener('v1-config',event=>{lastFormHtml=event.detail.html});
