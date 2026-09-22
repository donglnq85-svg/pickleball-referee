import {createTournament,addRulesVersion,addResource,addScheduledMatch,createAssignment,startWorkSession,finishWorkSession,setMatchReadiness,courtManagerView} from './tournament-domain.js';
import {createTournamentRepository} from './tournament-persistence.js';
import {createMatchRepository} from './match-persistence.js';
import './tournament.css';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repo=createTournamentRepository(localStorage),matchRepo=createMatchRepository(localStorage),app=document.getElementById('app');
let screen='',tournamentId=null,workSessionId=null,scopeKind='court';
const button=(label,action,secondary=false)=>`<button type="button" class="${secondary?'v1-secondary':'v1-main'}" data-t2="${action}">${label}</button>`;
const field=(label,name,attrs='')=>`<label class="t2-field">${label}<input name="${name}" ${attrs}></label>`;
const option=(values,selected=null)=>values.map(([id,label])=>`<option value="${escape(id)}" ${id===selected?'selected':''}>${escape(label)}</option>`).join('');
function base(title,body,footer=''){
  window.v1Active=true;
  app.innerHTML=`<main class="v1 t2"><header class="v1-head"><button type="button" data-t2="back" aria-label="Quay lại">‹</button><h1>${escape(title)}</h1></header><div class="v1-body">${body}</div>${footer?`<footer class="v1-footer">${footer}</footer>`:''}</main>`;
}
const selected=()=>{const t=repo.get(tournamentId);if(!t)throw Error('Không tìm thấy giải.');return t};
function change(action){try{const t=selected();action(t);repo.save(t);render()}catch(error){alert(error.message)}}
function renderList(){screen='list';const all=repo.list(),active=repo.load().activeWorkSession;
  base('Giải đấu',`<p class="v1-muted">Quản lý luật, lịch trận và phạm vi nhiệm vụ trọng tài.</p>${active?button('TIẾP TỤC NHIỆM VỤ','resume'):''}<h2>Giải của tôi</h2>${all.length?all.map(t=>`<button class="t2-card" data-t2="open:${escape(t.id)}"><b>${escape(t.name)}</b><small>${t.schedule.length} trận · ${t.assignments.length} phân công · ${t.status==='active'?'Đang diễn ra':'Đang chuẩn bị'}</small></button>`).join(''):'<p class="v1-muted">Chưa có giải.</p>'}<form data-t2-form="create">${field('Tên giải','name','required maxlength="100" placeholder="Tên giải"') }<button class="v1-main">Tạo giải</button></form>`,button('Về trang chủ','home',true));
}
function renderTournament(){screen='tournament';const t=selected(),version=t.rulesVersions.find(v=>v.id===t.activeRulesVersionId),active=t.workSessions.find(s=>s.status==='active');
  base(t.name,`<section class="t2-section"><h2>Rules Version</h2><p>${version?`${escape(version.label)} · ${escape(version.authority)} · ${version.scoring==='unknown'?'Chưa xác định scoring':escape(version.scoring)} · ${version.format?`${version.format.sets} game / ${version.format.points} điểm`:'Chưa xác định thể thức'}`:'Chưa xác định phiên bản luật'}</p><form data-t2-form="rules">${field('Tên phiên bản','label','required placeholder="Ví dụ: Luật áp dụng"')}${field('Nguồn luật','authority','required placeholder="Cơ quan và năm phiên bản"')}<label class="t2-field">Scoring<select name="scoring">${option([['unknown','Chưa xác định'],['side-out','Side-out']])}</select></label><div class="t2-grid">${field('Số game','sets','type="number" min="1" max="5" placeholder="1 / 3 / 5"')}${field('Điểm thắng','points','type="number" min="1" max="99" placeholder="11 / 15 / 21…"')}</div><label class="t2-field">Cách thắng<select name="rule">${option([['touch','Chạm điểm'],['unlimited','Cách biệt 2'],['maximum','Maximum cap']])}</select></label>${field('Điểm cap (nếu dùng)','cap','type="number" min="1" max="99"')}<button class="v1-secondary">Lưu Rules Version</button></form></section>
  <section class="t2-section"><h2>Cấu trúc giải</h2><p>Sân: ${t.structure.courts.length?t.structure.courts.map(x=>escape(x.label)).join(', '):'Chưa xác định'}<br>Bảng: ${t.structure.groups.length?t.structure.groups.map(x=>escape(x.label)).join(', '):'Chưa xác định'}</p><form data-t2-form="resource"><label class="t2-field">Loại<select name="kind">${option([['courts','Sân'],['groups','Bảng']])}</select></label>${field('Tên','label','required placeholder="Tên sân hoặc bảng"')}<button class="v1-secondary">Thêm vào cấu trúc</button></form></section>
  <section class="t2-section"><h2>Lịch trận</h2><p>${t.schedule.length?t.schedule.map(m=>`${escape(m.label)} · ${m.courtId?escape(t.structure.courts.find(c=>c.id===m.courtId)?.label):'Sân chưa xác định'} · ${m.groupId?escape(t.structure.groups.find(g=>g.id===m.groupId)?.label):'Bảng chưa xác định'} · ${m.readiness==='unknown'?'Readiness chưa xác định':escape(m.readiness)}`).join('<br>'):'Chưa có trận.'}</p><form data-t2-form="match">${field('Tên trận','label','required placeholder="Ví dụ: Trận 1"')}<label class="t2-field">Sân<select name="courtId">${option([['','Chưa xác định'],...t.structure.courts.map(c=>[c.id,c.label])])}</select></label><label class="t2-field">Bảng<select name="groupId">${option([['','Chưa xác định'],...t.structure.groups.map(g=>[g.id,g.label])])}</select></label><label class="t2-field">Hình thức<select name="type">${option([['unknown','Chưa xác định'],['single','Đánh đơn'],['double','Đánh đôi']])}</select></label><button class="v1-secondary">Thêm trận vào lịch</button></form></section>
  <section class="t2-section"><h2>My Assignment</h2><p>${t.assignments.length?t.assignments.map(a=>`${escape(a.label)} · ${a.scope.kind} · ${a.status}`).join('<br>'):'Chưa có phân công.'}</p><form data-t2-form="assignment">${field('Tên phân công','label','required placeholder="Nhiệm vụ trọng tài"')}<label class="t2-field">Phạm vi<select name="scopeKind" data-t2-scope>${option([['court','Sân'],['group','Bảng'],['match','Trận']],scopeKind)}</select></label><label class="t2-field">Đối tượng<select name="scopeId" required>${option((scopeKind==='court'?t.structure.courts:scopeKind==='group'?t.structure.groups:t.schedule).map(x=>[x.id,x.label]))}</select></label><button class="v1-secondary">Tạo phân công</button></form></section>
  <section class="t2-section"><h2>Nhiệm vụ</h2>${active?button('Tiếp tục nhiệm vụ đang mở',`continue:${active.id}`):t.assignments.filter(a=>a.status==='assigned').map(a=>button(`Bắt đầu · ${escape(a.label)}`,`start:${a.id}`)).join('')||'<p class="v1-muted">Chưa có phân công mới.</p>'}</section>`,button('Danh sách giải','list',true));
}
function renderCourt(){screen='court';const t=selected(),v=courtManagerView(t,workSessionId,matchRepo),court=id=>t.structure.courts.find(c=>c.id===id)?.label||'Sân chưa xác định',group=id=>t.structure.groups.find(g=>g.id===id)?.label||'Bảng chưa xác định';
  base('Court Manager',`<p class="v1-muted">${escape(t.name)} · ${escape(v.assignment.label)} · ${v.assignment.scope.kind==='court'?'Phạm vi sân':v.assignment.scope.kind==='group'?'Phạm vi bảng':'Phạm vi trận'}</p><div class="t2-summary"><b>${v.progress.finished}/${v.progress.total} trận hoàn tất</b><span>${v.progress.ready} sẵn sàng · ${v.progress.unknown} chưa rõ · ${v.progress.blocked} bị chặn</span></div><h2>Trận trong nhiệm vụ</h2>${v.matches.length?v.matches.map(m=>`<article class="t2-section"><h3>${escape(m.label)}</h3><p>${escape(court(m.courtId))} · ${escape(group(m.groupId))}</p><p>Tiến độ: ${m.progress==='not_started'?'Chưa bắt đầu':escape(m.progress)} · Readiness: ${m.readiness==='unknown'?'Chưa xác định':m.readiness==='ready'?'Sẵn sàng':'Chưa sẵn sàng'}</p>${m.readiness==='blocked'?`<p>${escape(m.blockedReason)}</p>`:''}<div class="t2-actions"><button data-t2="ready:${m.id}">Sẵn sàng</button><button data-t2="unknown:${m.id}">Chưa rõ</button></div><form data-t2-form="block:${m.id}">${field('Lý do chưa sẵn sàng','reason','required placeholder="Lý do thực tế"')}<button class="v1-secondary">Đánh dấu bị chặn</button></form></article>`).join(''):'<p class="v1-muted">Chưa có trận thuộc phạm vi này. Lịch trận và phân công được quản lý riêng.</p>'}`,`${button('Kết thúc nhiệm vụ','finish',true)}${button('Về giải','tournament',true)}`);
}
function render(){if(screen==='list')renderList();else if(screen==='tournament')renderTournament();else if(screen==='court')renderCourt()}
export function openTournament(){screen='list';render()}
window.addEventListener('tournament-open',openTournament);
document.addEventListener('change',event=>{if(!screen||!event.target.matches('[data-t2-scope]'))return;scopeKind=event.target.value;renderTournament()});
document.addEventListener('submit',event=>{
  const form=event.target.closest('[data-t2-form]');if(!form||!screen)return;
  event.preventDefault();event.stopImmediatePropagation();
  try{
    const f=new FormData(form),kind=form.dataset.t2Form;
    if(kind==='create'){const t=createTournament(f.get('name'));repo.save(t);tournamentId=t.id;screen='tournament';render();return}
    if(kind==='rules')return change(t=>{const sets=Number(f.get('sets')),points=Number(f.get('points'));const format=f.get('sets')&&f.get('points')?{sets,points,rule:f.get('rule'),cap:Number(f.get('cap'))||undefined}:null;addRulesVersion(t,{label:f.get('label'),authority:f.get('authority'),scoring:f.get('scoring'),format})});
    if(kind==='resource')return change(t=>addResource(t,f.get('kind'),f.get('label')));
    if(kind==='match')return change(t=>addScheduledMatch(t,{label:f.get('label'),courtId:f.get('courtId')||null,groupId:f.get('groupId')||null,type:f.get('type')}));
    if(kind==='assignment')return change(t=>createAssignment(t,{label:f.get('label'),scopeKind:f.get('scopeKind'),scopeIds:[f.get('scopeId')]}));
    if(kind.startsWith('block:'))return change(t=>setMatchReadiness(t,kind.slice(6),'blocked',f.get('reason')));
  }catch(error){alert(error.message)}
},true);
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-t2]');if(!b||!screen)return;
  event.preventDefault();event.stopImmediatePropagation();const action=b.dataset.t2;
  if(action==='home'){screen='';window.location.reload();return}
  if(action==='back'){if(screen==='court'){screen='tournament';render()}else if(screen==='tournament'){screen='list';render()}else{screen='';window.location.reload()}return}
  if(action==='list'){screen='list';render();return}
  if(action==='tournament'){screen='tournament';render();return}
  if(action==='resume'){const active=repo.load().activeWorkSession;if(!active)return; tournamentId=active.tournamentId;workSessionId=active.workSessionId;screen='court';render();return}
  if(action.startsWith('open:')){tournamentId=action.slice(5);scopeKind='court';screen='tournament';render();return}
  if(action.startsWith('continue:')){workSessionId=action.slice(9);screen='court';render();return}
  if(action.startsWith('start:')){try{const t=selected(),s=startWorkSession(t,action.slice(6));repo.save(t,{activeWorkSession:s.id});workSessionId=s.id;screen='court';render()}catch(error){alert(error.message)}return}
  if(action==='finish'){try{const t=selected();finishWorkSession(t,workSessionId);repo.save(t,{activeWorkSession:null});workSessionId=null;screen='tournament';render()}catch(error){alert(error.message)}return}
  if(action.startsWith('ready:'))return change(t=>setMatchReadiness(t,action.slice(6),'ready'));
  if(action.startsWith('unknown:'))return change(t=>setMatchReadiness(t,action.slice(8),'unknown'));
},true);
