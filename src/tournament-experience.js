import {
  createTournament,addRulesVersion,addResource,addPlayer,addEntry,
  addScheduledMatch,createAssignment,startWorkSession,entryPlayers
} from './tournament-domain.js';
import {createTournamentRepository} from './tournament-persistence.js';
import {createMatchRepository} from './match-persistence.js';
import {currentResult} from './tournament-results.js';
import {projectMatch,projectStandings,nextReadyMatchId} from './tournament-experience-projection.js';
import './tournament-experience.css';
import {appHeader} from './app-header.js';
import {tournamentListState,tournamentWorkBadge} from './tournament-list-projection.js';

const app=document.getElementById('app');
const repo=createTournamentRepository(localStorage);
const matchRepo=createMatchRepository(localStorage);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const today=()=>new Date().toISOString().slice(0,10);
let screen='list',tournamentId=null,groupId=null,listFilter='all',groupTab='athletes';

const glyph=name=>{
  const paths={
    back:'<path d="m15 18-6-6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',home:'<path d="m3 10 9-7 9 7v10H4Z"/>',
    trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/>',
    match:'<path d="M7 3h10v18H7zM3 8h4m10 8h4"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',users:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20a6 6 0 0 1 12 0m0-5a5 5 0 0 1 6 5"/>',
    court:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14M3 12h18"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',check:'<path d="m5 12 4 4L19 6"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.trophy}</svg>`;
};

function bottomNav(){
  const items=[['today','home','Hôm nay'],['tournament','trophy','Giải đấu'],['matches','match','Trận đấu'],['notifications','bell','Thông báo'],['profile','user','Hồ sơ']];
  return `<nav class="app-bottom-nav" aria-label="Điều hướng chính">${items.map(([id,icon,label])=>`<button class="nav-item ${id==='tournament'?'active':''}" data-shell="tab:${id}" aria-current="${id==='tournament'?'page':'false'}">${glyph(icon)}<span>${label}</span></button>`).join('')}</nav>`;
}

function shell(content,{title=null,subtitle=null,back=null,action=''}={}){
  const hasHeader=Boolean(title||subtitle||back||action);
  app.innerHTML=`<main class="app-shell tx-app${hasHeader?'':' tx-headerless'}">${hasHeader?`<header class="tx-header">${back?`<button class="tx-icon" data-tx="${back}" aria-label="Quay lại">${glyph('back')}</button>`:'<span class="tx-header-spacer"></span>'}<div>${title?`<h1>${escape(title)}</h1>`:''}${subtitle?`<p>${escape(subtitle)}</p>`:''}</div>${action||'<span class="tx-header-spacer"></span>'}</header>`:''}<section class="app-content tx-content">${content}</section>${bottomNav()}</main>`;
  app.querySelector('.tx-content')?.scrollTo(0,0);
}

const selected=()=>tournamentId?repo.get(tournamentId):null;
const fmtDate=value=>value?new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${String(value).slice(0,10)}T00:00:00`)):'Chưa có';
const fmtTime=value=>{if(!value)return '—';const text=String(value);if(/^\d\d:\d\d/.test(text))return text.slice(0,5);const date=new Date(text);return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit'}).format(date)};
const tournamentStatus=t=>{if(t.status==='active')return 'Đang diễn ra';const end=t.endsAt||t.startsAt;return end&&new Date(`${String(end).slice(0,10)}T23:59:59+07:00`)<new Date()?'Đã kết thúc':'Sắp diễn ra'};
const statusClass=t=>tournamentStatus(t)==='Đang diễn ra'?'live':tournamentStatus(t)==='Đã kết thúc'?'done':'upcoming';
const groupEntries=(t,g)=>Array.isArray(g?.entryIds)?g.entryIds.map(id=>t.structure.entries.find(entry=>entry.id===id)).filter(Boolean):[];
const entryLabel=(t,id)=>{const entry=t.structure.entries.find(item=>item.id===id);if(!entry)return 'Chưa xác định';return entryPlayers(t,id).join(' / ')};
const resource=(items,id,fallback)=>items.find(item=>item.id===id)?.label||fallback;

function renderList(){
  screen='list';tournamentId=null;groupId=null;
  const all=repo.list(),groups=[['upcoming','Sắp diễn ra'],['live','Đang diễn ra'],['done','Đã kết thúc']];
  const counts=Object.fromEntries(groups.map(([id])=>[id,all.filter(t=>tournamentListState(t)===id).length]));counts.all=all.length;
  const create=`<button class="primary-button tl-create" data-tx="create">${glyph('plus')}Tạo giải đấu</button>`;
  const card=t=>{
    const badge=tournamentWorkBadge(t,tournamentListState(t));
    const logo=typeof t.logoUrl==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(t.logoUrl)?`<img src="${escape(t.logoUrl)}" alt="">`:`<span>${escape((t.name||'Giải đấu').split(/\s+/).slice(0,3).map(s=>s[0]).join(''))}</span>`;
    return `<button class="tl-card" data-tx="open:${escape(t.id)}"><span class="tl-cover">${logo}</span><span class="tl-details"><b>${escape(t.name)}</b><span class="tl-meta">${glyph('calendar')}<span>${fmtDate(t.startsAt)}${t.endsAt&&t.endsAt!==t.startsAt?` – ${fmtDate(t.endsAt)}`:''}</span></span><span class="tl-meta">${glyph('pin')}<span>${escape(t.location||'Chưa có địa điểm')}${t.city?`<br>${escape(t.city)}`:''}</span></span><span class="tl-badge ${badge.tone}">${glyph('calendar')}${badge.label}</span></span><span class="tl-chevron" aria-hidden="true">›</span></button>`;
  };
  const sections=groups.filter(([id])=>listFilter==='all'||listFilter===id).map(([id,label])=>{
    const items=all.filter(t=>tournamentListState(t)===id);
    return items.length?`<section class="tl-group"><h2>${label}<span>${items.length}</span></h2>${items.map(card).join('')}</section>`:'';
  }).join('');
  const empty=`<div class="tl-empty"><div class="tl-calendar" aria-hidden="true">${glyph('calendar')}</div><h2>Bạn chưa có giải đấu nào</h2><p>Hãy tạo giải đấu khi bạn nhận được<br>thông tin mời tham gia từ ban tổ chức.</p>${create}</div><aside class="tl-note"><h2><span aria-hidden="true">ⓘ</span> Lưu ý</h2><ul><li>Chỉ tạo giải đấu khi bạn đã nhận được thông tin mời tham gia.</li><li>Bạn có thể bổ sung lịch làm việc sau.</li><li>Các trận đấu sẽ được cập nhật khi có phân công từ ban tổ chức.</li></ul></aside>`;
  const content=`<div class="tl-heading"><h1>Giải đấu</h1><p>Các giải đấu bạn được mời tham gia</p></div>${all.length?`${create}<div class="tl-filters" aria-label="Lọc giải đấu">${[['all','Tất cả'],...groups].map(([id,label])=>`<button aria-pressed="${listFilter===id}" class="${listFilter===id?'active':''}" data-tx="filter:${id}">${label} (${counts[id]})</button>`).join('')}</div>${sections||'<p class="tl-no-results">Chưa có giải đấu trong nhóm này.</p>'}`:empty}`;
  app.innerHTML=`<main class="app-shell tl-app">${appHeader(glyph('bell'))}<section class="app-content tl-content">${content}</section>${bottomNav()}</main>`;
}

function renderCreate(){
  screen='create';
  shell(`<form class="tx-form" data-tx-form="create"><p class="tx-intro">Tạo giải đấu mới để quản lý và tổ chức thi đấu</p><label>Tên giải đấu *<input name="name" required placeholder="Ví dụ: Vietnam Pickleball Open 2026"></label><label>Mô tả giải đấu<textarea name="description" rows="3" maxlength="200" placeholder="Mô tả ngắn về giải đấu"></textarea></label><fieldset><legend>Thời gian diễn ra giải đấu *</legend><div class="tx-grid"><input name="startsAt" type="date" required value="${today()}"><span>→</span><input name="endsAt" type="date" required value="${today()}"></div></fieldset><label>Địa điểm *<input name="location" required placeholder="Cụm sân ABC Pickleball"></label><fieldset><legend>Thời gian làm việc *</legend><div class="tx-grid"><input name="workStart" type="time" required value="07:00"><span>→</span><input name="workEnd" type="time" required value="18:00"></div></fieldset><section class="tx-upload">${glyph('plus')}<b>Thêm ảnh (tùy chọn)</b><small>Logo hoặc hình ảnh giải đấu</small></section><button class="tx-primary">Tạo giải đấu</button></form>`,{title:'Tạo giải đấu',subtitle:'',back:'list'});
}

function renderSuccess(){
  screen='success';const t=selected();
  shell(`<section class="tx-success"><div class="tx-success-mark">${glyph('check')}</div><h2>Tạo giải đấu thành công!</h2><p>Giải đấu đã được tạo và sẵn sàng để thiết lập các thông tin tiếp theo.</p></section><section class="tx-summary-card"><div class="tx-summary-head"><span class="tx-logo logo-0">${escape((t.name.match(/[A-ZÀ-Ỹ]/g)||['G']).slice(0,2).join(''))}</span><div><b>${escape(t.name)}</b><small>${escape(t.description||'Chưa có mô tả')}</small></div><i class="tx-status upcoming">Sắp diễn ra</i></div><dl><div><dt>Thời gian diễn ra</dt><dd>${fmtDate(t.startsAt)} → ${fmtDate(t.endsAt)}</dd></div><div><dt>Thời gian làm việc</dt><dd>${fmtTime(t.workPlan?.startsAt)} → ${fmtTime(t.workPlan?.endsAt)}</dd></div><div><dt>Địa điểm</dt><dd>${escape(t.location||'Chưa có')}</dd></div><div><dt>Logo / Hình ảnh</dt><dd>${t.logoName?'Đã thêm':'Chưa có'}</dd></div></dl></section><button class="tx-primary" data-tx="groups">Xem chi tiết giải đấu →</button><button class="tx-secondary" data-tx="list">Thêm giải làm việc khác</button>`,{title:'',back:'list'});
}

function detailHeader(t,active){
  const tabs=[['info','Thông tin'],['rules','Thể thức'],['courts','Sân của tôi'],['groups','Bảng đấu']];
  return `<section class="tx-detail-name"><h2>${escape(t.name)}</h2><p>Chi tiết giải đấu</p></section><nav class="tx-detail-tabs">${tabs.map(([id,label])=>`<button class="${active===id?'active':''}" data-tx="${id}">${label}</button>`).join('')}</nav>`;
}

function renderInfo(){
  screen='info';const t=selected();
  shell(`${detailHeader(t,'info')}<section class="tx-info-card"><h3>Thông tin giải đấu</h3><dl><div><dt>Tên giải</dt><dd>${escape(t.name)}</dd></div><div><dt>Thời gian</dt><dd>${fmtDate(t.startsAt)} → ${fmtDate(t.endsAt)}</dd></div><div><dt>Địa điểm</dt><dd>${escape(t.location||'Chưa có')}</dd></div><div><dt>Mô tả</dt><dd>${escape(t.description||'Chưa có')}</dd></div></dl></section><div class="tx-action-grid"><button class="tx-secondary" data-tx="assignment">Thêm phân công</button><button class="tx-primary" data-tx="addGroup">Thêm bảng đấu</button></div>`,{title:t.name,subtitle:'Chi tiết giải đấu',back:'list'});
}

function renderAssignment(){
  screen='assignment';const t=selected(),courts=t.structure.courts;
  shell(`<form class="tx-form" data-tx-form="assignment"><div class="tx-mode-tabs"><button type="button" class="active">Theo sân<small>Phụ trách sân</small></button><button type="button" disabled>Theo bảng<small>Phụ trách bảng đấu</small></button><button type="button" disabled>Theo trận<small>Phụ trách trận cụ thể</small></button><button type="button" disabled>Kết hợp<small>Sân + Bảng + Trận</small></button></div><div class="tx-note">Ngày và khung giờ được lấy từ lịch giải. Bạn chỉ cần chọn sân và bổ sung bảng đấu/trận đấu nếu có.</div><h3>Thông tin phân công</h3><label>Ngày thi đấu<input name="date" type="date" value="${String(t.startsAt||today()).slice(0,10)}" required></label><label class="tx-check"><input name="allDay" type="checkbox" checked> Dùng toàn bộ ngày</label><fieldset><legend>Khung giờ phân công</legend><div class="tx-grid"><input name="start" type="time" value="07:00" required><span>→</span><input name="end" type="time" value="18:00" required></div></fieldset><label>Sân phụ trách *<select name="courtId"><option value="new">+ Thêm sân mới</option>${courts.map(c=>`<option value="${c.id}">${escape(c.label)}</option>`).join('')}</select></label><label>Tên sân mới<input name="courtLabel" placeholder="Ví dụ: Sân 3"></label><label>Ghi chú (tùy chọn)<textarea name="note" rows="3" maxlength="200" placeholder="Ví dụ: Ca sáng, chờ thông báo bảng đấu..."></textarea></label><div class="tx-sticky-actions"><button type="button" class="tx-secondary" data-tx="info">Hủy</button><button class="tx-primary">Lưu phân công</button></div></form>`,{title:'Thêm phân công',subtitle:t.name,back:'info'});
}

function renderRules(){
  screen='rules';const t=selected(),version=t.rulesVersions.find(v=>v.id===t.activeRulesVersionId),format=version?.format;
  const rounds=['Vòng bảng','Vòng 1/8','Tứ kết','Bán kết','Chung kết'];
  shell(`${detailHeader(t,'rules')}<div class="tx-note">Thiết lập thể thức tính điểm theo từng vòng. Các trận đấu sử dụng cấu hình hiện đang áp dụng của giải.</div><div class="tx-section-head"><h3>Danh sách vòng thi đấu</h3><button data-tx="configureRules">+ Thêm vòng</button></div><div class="tx-round-list">${rounds.map(round=>`<section class="tx-round-card"><div><b>${round}</b><small>Áp dụng theo cài đặt hiện hành</small></div><button aria-label="Chỉnh sửa" data-tx="configureRules">✎</button><dl><div><dt>Số game</dt><dd>${format?.sets||'Chưa có'}</dd></div><div><dt>Điểm mỗi game</dt><dd>${format?.points||'Chưa có'}</dd></div><div><dt>Cách biệt thắng</dt><dd>${format?format.rule==='touch'?'Chạm điểm':'Cách 2 điểm':'Chưa có'}</dd></div><div><dt>Giới hạn điểm</dt><dd>${format?.cap?`Tối đa ${format.cap}`:format?'Không giới hạn':'Chưa có'}</dd></div></dl></section>`).join('')}</div>`,{title:'Thể thức tính điểm',subtitle:t.name,back:'info'});
}

function renderRuleEditor(){
  screen='ruleEditor';const t=selected(),version=t.rulesVersions.find(v=>v.id===t.activeRulesVersionId),f=version?.format||{sets:1,points:11,rule:'touch'};
  shell(`<form class="tx-form" data-tx-form="rules"><div class="tx-note">Cấu hình mới được lưu thành lịch sử thay đổi; các trận đã bắt đầu vẫn giữ nguyên cấu hình cũ.</div><label>Số game<select name="sets"><option ${f.sets===1?'selected':''}>1</option><option ${f.sets===3?'selected':''}>3</option><option ${f.sets===5?'selected':''}>5</option></select></label><label>Điểm thắng mỗi game<input name="points" type="number" min="1" max="99" value="${f.points}"></label><label>Cách thắng<select name="rule"><option value="touch" ${f.rule==='touch'?'selected':''}>Chạm điểm</option><option value="unlimited" ${f.rule==='unlimited'?'selected':''}>Thắng cách 2</option><option value="maximum" ${f.rule==='maximum'?'selected':''}>Cách 2, có điểm tối đa</option></select></label><label>Điểm tối đa (nếu áp dụng)<input name="cap" type="number" min="1" max="99" value="${f.cap||''}"></label><button class="tx-primary">Lưu thể thức</button></form>`,{title:'Cài đặt thể thức',subtitle:t.name,back:'rules'});
}

function renderCourts(){
  screen='courts';const t=selected();
  const assignmentCourts=new Map();for(const a of t.assignments||[])if(a.scope.kind==='court')for(const id of a.scope.ids)assignmentCourts.set(id,a);
  const cards=[...assignmentCourts].map(([id,a])=>{const court=t.structure.courts.find(c=>c.id===id),matches=t.schedule.filter(m=>m.courtId===id);return `<section class="tx-court-card"><div class="tx-court-top"><span>${glyph('court')}</span><div><h3>${escape(court?.label||'Sân chưa xác định')}</h3><p>${escape(t.location||'Chưa có địa điểm')}</p></div><i class="tx-status ${a.status==='active'?'live':'upcoming'}">${a.status==='active'?'Đang diễn ra':'Chưa bắt đầu'}</i></div><div class="tx-court-meta"><span>${glyph('clock')}${escape(a.workPlan?.startsAt?fmtTime(a.workPlan.startsAt):'07:00')} – ${escape(a.workPlan?.endsAt?fmtTime(a.workPlan.endsAt):'18:00')}</span><span>${matches.length} trận</span></div><p>${[...new Set(matches.map(m=>resource(t.structure.groups,m.groupId,'Chưa xác định bảng')))].join(', ')||'Chưa có bảng đấu'}</p><div class="tx-card-actions"><button data-tx="courtMatches:${id}">Xem danh sách trận</button><button class="tx-primary" data-tx="startAssignment:${a.id}">Vào ${escape(court?.label||'sân')}</button></div></section>`}).join('');
  shell(`${detailHeader(t,'courts')}<div class="tx-note">Đây là các sân bạn được phân công phụ trách. Chỉ hiển thị sân và lịch thi đấu thuộc phần việc của bạn.</div><div class="tx-date-row"><b>${fmtDate(t.startsAt)}</b><button data-tx="assignment">+ Thêm phân công</button></div>${cards||'<section class="tx-empty compact"><h2>Chưa có sân được phân công</h2><p>Thêm phân công để sân xuất hiện tại đây.</p><button class="tx-primary" data-tx="assignment">Thêm phân công</button></section>'}<button class="tx-secondary" data-tx="groups">Xem lịch tổng quan</button>`,{title:t.name,subtitle:'Chi tiết giải đấu',back:'list'});
}

function renderGroups(){
  screen='groups';const t=selected(),groups=t.structure.groups;
  shell(`${detailHeader(t,'groups')}<div class="tx-note">Danh sách các bảng đấu trong giải. Chọn một bảng để xem vận động viên, lịch thi đấu và kết quả.</div><div class="tx-section-head"><div class="tx-mini-filters"><span class="active">Tất cả</span></div><button data-tx="addGroup">+ Thêm bảng đấu</button></div><div class="tx-group-list">${groups.map((g,index)=>{const entries=groupEntries(t,g),matches=t.schedule.filter(m=>m.groupId===g.id),court=resource(t.structure.courts,g.courtId||matches[0]?.courtId,'Chưa xác định sân');return `<button class="tx-group-card" data-tx="group:${g.id}"><span class="tx-group-letter color-${index%4}">${escape((g.label||'?').replace('Bảng ','').slice(0,1))}</span><span><b>${escape(g.label)}</b><small>${escape(g.category||'Chưa có nội dung')} · ${escape(g.formatLabel||'Vòng bảng')}</small><em>${glyph('users')}${entries.length||'Chưa có'} cặp VĐV ${glyph('court')}${escape(court)}</em></span><i class="tx-status ${matches.some(m=>m.matchSessionId)?'live':'upcoming'}">${matches.some(m=>m.matchSessionId)?'Đang diễn ra':'Chưa bắt đầu'}</i><strong>›</strong></button>`}).join('')||'<section class="tx-empty compact"><h2>Chưa có bảng đấu</h2><p>Thêm bảng đấu khi bạn đã có thông tin từ BTC.</p></section>'}</div>`,{title:t.name,subtitle:'Chi tiết giải đấu',back:'list'});
}

function renderAddGroup(){
  screen='addGroup';const t=selected(),courts=t.structure.courts;
  const playerRows=Array.from({length:4},(_,i)=>`<div class="tx-pair-row"><span>${i+1}</span><input name="p${i}a" placeholder="Tên VĐV"><input name="p${i}b" placeholder="Tên VĐV"></div>`).join('');
  shell(`<form class="tx-form" data-tx-form="group"><section class="tx-assignment-context"><b>Sân phụ trách</b><select name="courtId" required><option value="">Chọn sân</option>${courts.map(c=>`<option value="${c.id}">${escape(c.label)}</option>`).join('')}</select><small>${glyph('calendar')}${fmtDate(t.startsAt)} ${glyph('clock')}07:00 – 18:00</small></section><h3>Thông tin bảng đấu</h3><div class="tx-grid two"><label>Tên bảng *<input name="label" required placeholder="Bảng A"></label><label>Nội dung thi đấu *<input name="category" required placeholder="Đôi nam 4.5"></label></div><div class="tx-grid two"><label>Thể thức thi đấu<select name="format"><option>Vòng tròn</option><option>Loại trực tiếp</option></select></label><label>Số cặp VĐV<input name="pairCount" type="number" min="2" max="4" value="4" readonly></label></div><h3>Danh sách cặp VĐV</h3><div class="tx-note">Nhập đầy đủ tên 2 VĐV cho mỗi cặp trong bảng đấu.</div><div class="tx-pair-list">${playerRows}</div><label>Ghi chú (tùy chọn)<textarea name="note" rows="3" maxlength="200"></textarea></label><div class="tx-sticky-actions"><button type="button" class="tx-secondary" data-tx="groups">Hủy</button><button class="tx-primary">Lưu bảng đấu</button></div></form>`,{title:'Thêm bảng đấu',subtitle:t.name,back:'groups'});
}

function groupHeader(t,g){
  const entries=groupEntries(t,g),matches=t.schedule.filter(m=>m.groupId===g.id),court=resource(t.structure.courts,g.courtId||matches[0]?.courtId,'Chưa xác định sân');
  const tabs=[['athletes','Danh sách VĐV'],['schedule','Lịch thi đấu'],['results','Kết quả'],['standings','Bảng xếp hạng']];
  return `<section class="tx-group-hero"><div class="tx-group-letter">${escape(g.label.replace('Bảng ','').slice(0,1))}</div><div><b>${escape(g.label)}</b><small>${escape(g.category||'Chưa có nội dung')} · ${escape(g.formatLabel||'Vòng bảng')}</small><i class="tx-status ${matches.some(m=>m.matchSessionId)?'live':'upcoming'}">${matches.some(m=>m.matchSessionId)?'Đang diễn ra':'Chưa bắt đầu'}</i></div><dl><div><dt>Ngày</dt><dd>${fmtDate(t.startsAt)}</dd></div><div><dt>Sân</dt><dd>${escape(court)}</dd></div><div><dt>VĐV</dt><dd>${entries.length} cặp</dd></div></dl></section><nav class="tx-group-tabs">${tabs.map(([id,label])=>`<button class="${groupTab===id?'active':''}" data-tx="groupTab:${id}">${label}</button>`).join('')}</nav>`;
}

function resultFor(t,match){return currentResult(t,match.id)}
function groupRows(t,g){
  return projectStandings(t,g).rows;
}

function renderGroup(){
  screen='group';const t=selected(),g=t.structure.groups.find(item=>item.id===groupId);if(!g)return renderGroups();
  const entries=groupEntries(t,g),matches=t.schedule.filter(m=>m.groupId===g.id);let body='';
  if(groupTab==='athletes')body=`<div class="tx-section-head"><h3>Danh sách cặp VĐV (${entries.length} cặp)</h3></div><div class="tx-athlete-list">${entries.map((entry,index)=>`<div><span>${index+1}</span><b>${entryPlayers(t,entry.id).map(escape).join('<br>')}</b><strong>›</strong></div>`).join('')}</div><section class="tx-format-card"><div class="tx-section-head"><h3>Thông tin thể thức thi đấu</h3><button data-tx="rules">Xem chi tiết ›</button></div><p>Áp dụng theo cài đặt của giải đấu cho ${escape(g.formatLabel||'Vòng bảng')}.</p>${formatSummary(t)}</section><div class="tx-quick-stats"><div><b>${entries.length}</b><small>Cặp VĐV</small></div><div><b>${matches.length}</b><small>Trận đấu</small></div><div><b>${matches.filter(m=>resultFor(t,m)?.status==='CONFIRMED').length}</b><small>Đã hoàn thành</small></div><div><b>${matches.filter(m=>!m.matchSessionId).length}</b><small>Chưa thi đấu</small></div></div><button class="tx-secondary" data-tx="shareSchedule">Xuất lịch thi đấu</button><button class="tx-primary" data-tx="beginGroup">Bắt đầu thi đấu</button>`;
  if(groupTab==='schedule')body=`<div class="tx-day-tabs"><span class="active">${fmtDate(t.startsAt)}</span></div><div class="tx-section-head"><h3>Danh sách trận đấu (${matches.length} trận)</h3></div><div class="tx-match-list">${matches.map((m,index)=>matchRow(t,m,index,true)).join('')||'<p class="tx-muted">Chưa có lịch thi đấu.</p>'}</div><section class="tx-rule-line">Thể thức: ${formatInline(t)}</section><button class="tx-secondary" data-tx="shareSchedule">Xuất lịch thi đấu</button><button class="tx-primary" data-tx="beginGroup">Vào trận đang diễn ra</button>`;
  if(groupTab==='results')body=`<div class="tx-day-tabs"><span class="active">${fmtDate(t.startsAt)}</span></div>${standingsTable(t,g,true)}<div class="tx-section-head"><h3>Kết quả thi đấu (${matches.length} trận)</h3><small>Cập nhật từ kết quả đã xác nhận</small></div><div class="tx-match-list">${matches.map((m,index)=>matchRow(t,m,index,false)).join('')}</div>`;
  if(groupTab==='standings')body=`${standingsTable(t,g,false)}<section class="tx-ranking-note"><h3>Cách xếp hạng</h3><p>Chỉ sử dụng tiêu chí đã được cấu hình trong giải. Khi chưa đủ quy định, hệ thống giữ trạng thái cần xác nhận và không tự đoán thứ hạng.</p></section><button class="tx-secondary" data-tx="shareStandings">Xuất bảng xếp hạng</button>`;
  shell(`${groupHeader(t,g)}${body}`,{title:g.label,subtitle:t.name,back:'groups'});
}

function formatSummary(t){const f=t.rulesVersions.find(v=>v.id===t.activeRulesVersionId)?.format;return `<dl class="tx-format-summary"><div><dt>Số game</dt><dd>${f?.sets||'Chưa có'}</dd></div><div><dt>Điểm mỗi game</dt><dd>${f?.points||'Chưa có'}</dd></div><div><dt>Cách biệt thắng</dt><dd>${f?f.rule==='touch'?'Chạm điểm':'Cách 2 điểm':'Chưa có'}</dd></div><div><dt>Giới hạn điểm</dt><dd>${f?.cap||'Không có'}</dd></div></dl>`}
function formatInline(t){const f=t.rulesVersions.find(v=>v.id===t.activeRulesVersionId)?.format;return f?`${f.sets} game · đến ${f.points}${f.rule==='touch'?', chạm điểm':', cách 2'}${f.cap?` · tối đa ${f.cap}`:''}`:'Chưa có cấu hình'}
function matchRow(t,m,index){
  const sessions=matchRepo.load().matches;
  const view=projectMatch(t,m,sessions,nextReadyMatchId(t,m.groupId)),labels={COMPLETED:'Đã kết thúc',LIVE:'Đang diễn ra',NEXT:'Tiếp theo',NOT_STARTED:'Chưa diễn ra'};
  const playerSide=side=>`<span class="tx-match-team ${view.winner===side?'winner':''}">${entryPlayers(t,m.entrantIds[side]).map(name=>`<span>${escape(name)}</span>`).join('')||'Chưa xác định'}</span>`;
  return `<button class="tx-match-row state-${view.status.toLowerCase()}" data-tx="match:${m.id}"><span class="tx-match-meta"><b>${escape(m.label||`Trận ${index+1}`)}</b><small>${escape(resource(t.structure.courts,m.courtId,'Chưa xác định sân'))}</small></span>${playerSide('A')}<span class="tx-score-horizontal" aria-label="${view.scoreKind==='MATCH_GAMES_WON'?'Game thắng':'Điểm game'}"><b class="${view.winner==='A'?'winner':''}">${view.points?.A??'–'}</b><span>–</span><b class="${view.winner==='B'?'winner':''}">${view.points?.B??'–'}</b></span>${playerSide('B')}<i class="tx-match-status">${labels[view.status]}</i><span aria-hidden="true">›</span></button>`;
}
function standingsTable(t,g,compact){const rows=groupRows(t,g);return `<section class="tx-standings ${compact?'compact':''}"><h3>${escape(g.label)} — ${escape(g.category||'Chưa có nội dung')}</h3><div class="tx-table-head"><span>Cặp VĐV</span><span>Trận</span><span>Thắng</span><span>Thua</span><span>Hiệu số</span><span>Điểm</span></div>${rows.map(row=>`<div class="tx-table-row"><i>${row.rank??'—'}</i><b>${entryPlayers(t,row.entry.id).map(escape).join(' / ')}</b><span>${row.played}</span><span>${row.wins}</span><span>${row.losses}</span><span>${row.pointsFor-row.pointsAgainst>=0?'+':''}${row.pointsFor-row.pointsAgainst}</span><strong>—</strong></div>`).join('')}</section>`}

function scheduleShareText(t,g){const matches=t.schedule.filter(m=>m.groupId===g.id);return [`${t.name} · ${g.label}`,`${g.category||'Chưa có nội dung'} · ${fmtDate(t.startsAt)}`,...matches.map((m,index)=>`${m.label||`Trận ${index+1}`}: ${entryLabel(t,m.entrantIds.A)} — ${entryLabel(t,m.entrantIds.B)} · ${resource(t.structure.courts,m.courtId,'Chưa xác định sân')}`)].join('\n')}
function standingsShareText(t,g){const rows=groupRows(t,g);return [`${t.name} · Bảng xếp hạng ${g.label}`,...rows.map(row=>`${row.rank??'—'}. ${entryLabel(t,row.entry.id)} · ${row.wins} thắng · HS ${row.pointsFor-row.pointsAgainst>=0?'+':''}${row.pointsFor-row.pointsAgainst}`)].join('\n')}
async function shareText(title,text){if(navigator.share){await navigator.share({title,text});return}await navigator.clipboard.writeText(text);alert('Đã sao chép nội dung để chia sẻ.')}

function change(mutator){const t=selected();mutator(t);repo.save(t);renderCurrent()}
function saveTournament(t){repo.save(t);tournamentId=t.id;return t}
function renderCurrent(){if(screen==='list')renderList();else if(screen==='create')renderCreate();else if(screen==='success')renderSuccess();else if(screen==='info')renderInfo();else if(screen==='assignment')renderAssignment();else if(screen==='rules')renderRules();else if(screen==='ruleEditor')renderRuleEditor();else if(screen==='courts')renderCourts();else if(screen==='groups')renderGroups();else if(screen==='addGroup')renderAddGroup();else renderGroup()}

document.addEventListener('submit',event=>{
  const form=event.target.closest('[data-tx-form]');if(!form)return;event.preventDefault();event.stopImmediatePropagation();const data=new FormData(form);
  try{
    if(form.dataset.txForm==='create'){
      const t=createTournament(data.get('name'));t.description=String(data.get('description')||'').trim();t.startsAt=data.get('startsAt');t.endsAt=data.get('endsAt');t.location=String(data.get('location')||'').trim();t.workPlan={startsAt:`${t.startsAt}T${data.get('workStart')}:00+07:00`,endsAt:`${t.startsAt}T${data.get('workEnd')}:00+07:00`,location:t.location};saveTournament(t);return renderSuccess();
    }
    if(form.dataset.txForm==='assignment')return change(t=>{let courtId=data.get('courtId');if(courtId==='new'){const label=String(data.get('courtLabel')||'').trim();if(!label)throw Error('Nhập tên sân mới.');courtId=addResource(t,'courts',label).id}const assignment=createAssignment(t,{label:`${resource(t.structure.courts,courtId,'Sân')} · ${fmtDate(data.get('date'))}`,scopeKind:'court',scopeIds:[courtId]});assignment.workPlan={startsAt:`${data.get('date')}T${data.get('start')}:00+07:00`,endsAt:`${data.get('date')}T${data.get('end')}:00+07:00`,location:t.location,note:String(data.get('note')||'')};screen='courts'});
    if(form.dataset.txForm==='rules')return change(t=>{const points=Number(data.get('points')),rule=data.get('rule'),cap=Number(data.get('cap'))||undefined;addRulesVersion(t,{label:`Cài đặt ${new Date().toLocaleDateString('vi-VN')}`,authority:'Cài đặt của trọng tài',scoring:'side-out',format:{sets:Number(data.get('sets')),points,rule,...(cap?{cap}:{})},procedures:{equipmentCheck:'unknown'}});screen='rules'});
    if(form.dataset.txForm==='group')return change(t=>{const g=addResource(t,'groups',data.get('label'));g.category=String(data.get('category'));g.formatLabel=String(data.get('format'));g.courtId=data.get('courtId');g.note=String(data.get('note')||'');g.entryIds=[];for(let i=0;i<4;i++){const names=[String(data.get(`p${i}a`)||'').trim(),String(data.get(`p${i}b`)||'').trim()];if(names.every(Boolean)){const playerIds=names.map(displayName=>addPlayer(t,{displayName}).id);g.entryIds.push(addEntry(t,{type:'double',playerIds}).id)}}for(let i=0,n=1;i<g.entryIds.length;i++)for(let j=i+1;j<g.entryIds.length;j++,n++)addScheduledMatch(t,{label:`Trận ${n}`,groupId:g.id,courtId:g.courtId,type:'double',entrantIds:{A:g.entryIds[i],B:g.entryIds[j]}});groupId=g.id;groupTab='athletes';screen='group'});
  }catch(error){alert(error.message)}
},true);

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-tx]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();const action=button.dataset.tx;
  if(action==='list')return renderList();if(action==='create')return renderCreate();
  if(action.startsWith('filter:')){listFilter=action.slice(7);return renderList()}
  if(action.startsWith('open:')){tournamentId=action.slice(5);return renderGroups()}
  if(['info','rules','courts','groups','assignment'].includes(action))return ({info:renderInfo,rules:renderRules,courts:renderCourts,groups:renderGroups,assignment:renderAssignment}[action]());
  if(action==='configureRules')return renderRuleEditor();if(action==='addGroup')return renderAddGroup();
  if(action.startsWith('group:')){groupId=action.slice(6);groupTab='athletes';return renderGroup()}
  if(action.startsWith('groupTab:')){groupTab=action.slice(9);return renderGroup()}
  if(action.startsWith('courtMatches:')){const t=selected(),courtId=action.slice(13),match=t.schedule.find(item=>item.courtId===courtId);if(!match)return renderGroups();groupId=match.groupId;groupTab='schedule';return renderGroup()}
  if(action==='shareSchedule'||action==='shareStandings'){const t=selected(),g=t.structure.groups.find(item=>item.id===groupId);if(!g)return;const title=`${t.name} · ${g.label}`,text=action==='shareSchedule'?scheduleShareText(t,g):standingsShareText(t,g);shareText(title,text).catch(error=>{if(error.name!=='AbortError')alert(error.message)});return}
  if(action.startsWith('startAssignment:')){const assignmentId=action.slice(16),t=selected();let active=t.workSessions.find(s=>s.status==='active');if(!active){try{active=startWorkSession(t,assignmentId);repo.save(t,{activeWorkSession:active.id})}catch(error){alert(error.message);return}}window.dispatchEvent(new CustomEvent('application-resume',{detail:{kind:'tournament',screen:'court',tournamentId:t.id,workSessionId:active.id,matchId:null}}));return}
  if(action==='beginGroup'){const t=selected(),active=t.workSessions.find(s=>s.status==='active');if(active)return window.dispatchEvent(new CustomEvent('application-resume',{detail:{kind:'tournament',screen:'court',tournamentId:t.id,workSessionId:active.id,matchId:null}}));return renderCourts()}
  if(action.startsWith('match:')){
    const t=selected(),match=t.schedule.find(m=>m.id===action.slice(6));if(!match)return renderGroups();
    const session=match.matchSessionId?matchRepo.get(match.matchSessionId):null;
    if(session&&session.status!=='finished')return window.dispatchEvent(new CustomEvent('tournament-match-open',{detail:session}));
    const active=t.workSessions.find(s=>s.status==='active');
    if(session?.status==='finished'||resultFor(t,match))return window.dispatchEvent(new CustomEvent('application-resume',{detail:{kind:'tournament',screen:'result',tournamentId:t.id,workSessionId:active?.id||null,matchId:match.id}}));
    if(active)return window.dispatchEvent(new CustomEvent('application-resume',{detail:{kind:'tournament',screen:'operations',tournamentId:t.id,workSessionId:active.id,matchId:match.id}}));
    return renderCourts();
  }
});

export function openTournamentExperience(detail={}){
  const target=detail?.tournamentId&&repo.get(detail.tournamentId);if(target){tournamentId=target.id;return detail.screen==='info'?renderInfo():renderGroups()}
  renderList();
}

window.addEventListener('tournament-open',event=>openTournamentExperience(event.detail));
