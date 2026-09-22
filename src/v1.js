import {createMatch,rally,undo,redo,nextGame,scoreCall,matchView,prepareNextGame,resolveFinal,other,setCourtLeft,startPause,endPause,correct} from './match-engine.js';
import {courtView} from './court-view.js';
import {renderSession} from './match-session.js';
import {historyList,historyDetail} from './match-history.js';
import {createMatchRepository} from './match-persistence.js';
import './tournament-ui.js';
import './v1.css';

const app=document.getElementById('app');
const repository=createMatchRepository(localStorage);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=repository.active(),draft=repository.load().draft,history=repository.history(),screen='',warmInterval=null,medicalChoice=null;
function persist(){try{if(state)repository.saveSession(state,{draft,clearDraft:!draft});else repository.saveDraft(draft)}catch(error){alert('Không lưu được trận trên thiết bị này: '+error.message);window.location.reload();throw error}}
function save(){persist()}
function recordIfFinished(){if(state?.status==='finished')history=repository.history()}
const names=team=>(state||draft)?.config?.players?.[team]||state?.players?.[team]||[];
function base(title,body,footer='',overlay=''){
  window.v1Active=true;
  app.innerHTML=`<main class="v1"><header class="v1-head"><button data-v1="home" aria-label="Về trang chủ">‹</button><h1>${title}</h1></header><div class="v1-body">${body}</div>${footer?`<footer class="v1-footer">${footer}</footer>`:''}</main>${overlay}`;
}
function button(text,act,cls='v1-main'){return `<button class="${cls}" data-v1="${act}">${text}</button>`}
function mainHome(){
  const place=app.querySelector('#v1-home-actions');if(!place)return;
  const latest=repository.active(),active=latest?.status==='finished'?null:latest,pending=repository.load().draft,count=repository.history().length;
  place.innerHTML=`${active?button('TRẬN ĐANG DIỄN RA — TIẾP TỤC','resume'):pending?button('Tiếp tục chuẩn bị trận','resumeDraft'):''}${button('Quản lý giải đấu','tournament','v1-home-button')}${button(`Lịch sử trận đấu${count?' · '+count:''}`,'history','v1-home-button')}`;
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
  if(repository.active()?.status!=='finished' && repository.active() && !window.confirm('Bắt đầu trận mới sẽ lưu trận hiện tại vào thiết bị. Tiếp tục?'))return;
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
  const v=matchView(previewState(draft.config,f));
  base('Final Setup',`<p class="v1-muted">Sau khởi động · theo góc nhìn trọng tài</p><h2>Kiểm tra vị trí thực tế</h2><div class="v1-setting"><b>Ai giao trước?</b><div class="v1-options">${['A','B'].map(t=>`<button data-v1="serve:${t}" class="${f.serving===t?'selected':''}">Đội ${t} · ${escape(draft.config.players[t][0])}</button>`).join('')}</div></div><div class="v1-setting"><b>Ai ở bên trái trọng tài?</b><div class="v1-options">${['A','B'].map(t=>`<button data-v1="end:${t}" class="${f.courtLeft===t?'selected':''}">Đội ${t}</button>`).join('')}</div></div>${courtView(previewState(draft.config,f))}<div class="v1-call">${v.scoreCall}</div><p>${escape(v.server)} giao → ${escape(v.receiver)} đỡ</p>`,button('Xem lại và bắt đầu','reviewFinal'));
}
function renderNextFinal(){
  const f=draft.final,c=draft.config;
  draft.final=resolveFinal(c,f);save();screen='finalNext';
  const v=matchView(previewState(c,draft.final));
  base(`Final Setup · Game ${state.game+1}`,`<p class="v1-muted">Đội giao và bên sân dự kiến đã được chuyển từ game trước. Kiểm tra vị trí thực tế trước khi bắt đầu.</p><div class="v1-setting"><b>Đội giao trước</b><div class="v1-options">${['A','B'].map(t=>`<button data-v1="nextServe:${t}" class="${f.serving===t?'selected':''}">Đội ${t}</button>`).join('')}</div></div><div class="v1-setting"><b>Bên trái trọng tài</b><div class="v1-options">${['A','B'].map(t=>`<button data-v1="nextEnd:${t}" class="${f.courtLeft===t?'selected':''}">Đội ${t}</button>`).join('')}</div></div>${c.type==='double'?`<div class="v1-setting"><b>Vị trí VĐV</b><div class="v1-options">${['A','B'].map(t=>button(`Đổi vị trí Đội ${t}`,'nextSwap:'+t,'v1-secondary')).join('')}</div></div>`:''}${courtView(previewState(c,draft.final))}<div class="v1-call">${v.scoreCall}</div><div class="v1-pair">${escape(v.server)} GIAO → ${escape(v.receiver)} ĐỠ</div>`,button('Xác nhận và bắt đầu game','reviewFinal'));
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
function previewState(config,final){return createMatch(config,resolveFinal(config,final))}
function renderReview(){if(!draft?.final)return;screen='review';const f=resolveFinal(draft.config,draft.final),c=draft.config,v=matchView(previewState(c,f));
  base('Final Setup',`<p class="v1-muted">Đối chiếu lần cuối trước khi xướng điểm</p>${courtView(previewState(c,f))}<div class="v1-call">${v.scoreCall}</div><div class="v1-pair">${escape(v.server)} GIAO → ${escape(v.receiver)} ĐỠ</div><p>Đội ${f.serving} giao trước · ${c.type==='single'?'Đánh đơn':'Đánh đôi'}.</p>`,`${button('Sửa vị trí','editFinal','v1-secondary')}${button('BẮT ĐẦU TRẬN','begin')}`)
}
function renderMatch(){if(!state)return;if(state.status!=='playing')return renderResult();screen='match';clearInterval(warmInterval);
  const {body,footer,overlay}=renderSession(state,medicalChoice);
  base(`Game ${state.game}/${state.config.sets}`,body,footer,overlay);
  if(state.pause){const update=()=>{const p=state.pause,el=app.querySelector('[data-pauseclock]');if(!p||!el)return;const sec=Math.max(0,Math.ceil((p.duration-(Date.now()-p.startedAt))/1000));el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`};update();warmInterval=setInterval(update,500)}
}
function renderResult(){if(!state)return;screen='result';const s=state,last=s.games.at(-1);
  base(s.status==='finished'?'Kết quả trận':`Game ${last.game} kết thúc`,`<h2>Đội ${last.winner} thắng ${s.status==='finished'?'trận':'game '+last.game}</h2><div class="v1-matchScore"><div><small>ĐỘI A</small><strong>${last.score.A}</strong></div><div><small>ĐỘI B</small><strong>${last.score.B}</strong></div></div><p>Tỷ số game: ${s.gamesWon.A} – ${s.gamesWon.B}</p><div class="v1-gameList">${s.games.map(g=>`<div>Game ${g.game} · ${g.score.A} – ${g.score.B} · Đội ${g.winner}</div>`).join('')}</div>${button('Hoàn tác rally cuối','undo','v1-secondary')}`,s.status==='finished'?`${button('Lịch sử trận đấu','history')}${button('Về trang chủ','home','v1-secondary')}`:button('Final Setup game tiếp theo','nextGame'));
}
function renderHistory(){screen='history';history=repository.history();base('Lịch sử trận đấu',historyList(history),button('Về trang chủ','home','v1-secondary'))}
function renderRecord(id){const m=history.find(item=>item.id===id);if(!m)return renderHistory();screen='record';base('Chi tiết trận',historyDetail(m),button('Lịch sử trận đấu','history'))}
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-v1]');if(!b)return;event.preventDefault();event.stopImmediatePropagation();const action=b.dataset.v1;
  if(action==='home'){clearInterval(warmInterval);screen='';window.location.reload();return}
  if(action==='tournament'){window.dispatchEvent(new Event('tournament-open'));return}
  if(action==='resume'){state=repository.active();if(state){medicalChoice=null;renderMatch()}return}
  if(action==='resumeDraft'){draft=repository.load().draft;if(!draft)return;if(draft.phase==='warmup')renderWarm();else if(draft.final)renderReview();else startFinal();return}
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
  if(action==='nextGame'){draft={config:state.config,formHtml:state.formHtml||lastFormHtml,phase:'final',next:true,final:prepareNextGame(state)};save();return startFinal()}
  if(action==='undo'){if(!state)return;undo(state);save();recordIfFinished();return state.status==='playing'?renderMatch():renderResult()}
  if(action==='redo'){if(!state)return;redo(state);save();recordIfFinished();return state.status==='playing'?renderMatch():renderResult()}
  if(action.startsWith('rally:')){if(!state)return;rally(state,action.slice(6));save();recordIfFinished();return state.status==='playing'?renderMatch():renderResult()}
  if(action==='swap'){setCourtLeft(state,other(state.courtLeft));save();return renderMatch()}
  if(action==='tools'||action==='correction'){medicalChoice=action;return renderMatch()}
  if(action==='closePanel'){medicalChoice=null;return renderMatch()}
  if(action==='saveCorrection'){
    const val=name=>app.querySelector('[data-f="'+name+'"]')?.value;
    const serving=val('serving'),selected=val('player')||`${serving}:0`;
    if(selected.split(':')[0]!==serving)return alert('Chọn người giao thuộc đội đang giao.');
    try{correct(state,{A:val('A'),B:val('B'),serving,number:val('number'),player:selected.split(':')[1]});save();recordIfFinished();medicalChoice=null;return state.status==='playing'?renderMatch():renderResult()}
    catch(error){return alert(error.message)}
  }
  if(action.startsWith('timeout:')){startPause(state,'timeout',action.split(':')[1]);save();medicalChoice=null;return renderMatch()}
  if(action.startsWith('medical:')){const [,team,index]=action.split(':');startPause(state,'medical',team,Number(index));save();medicalChoice=null;return renderMatch()}
  if(action==='pauseScreen')return renderMatch();
  if(action==='endPause'){clearInterval(warmInterval);endPause(state);save();return renderMatch()}
},true);
let lastFormHtml='';window.addEventListener('v1-config',event=>{lastFormHtml=event.detail.html});
