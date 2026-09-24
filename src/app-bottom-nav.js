// GLOBAL BOTTOM NAVIGATION V1.1 — one renderer, one geometry in app-shell.css.
const items=[['today','home','Hôm nay'],['tournament','tournament','Giải đấu'],['matches','match','Trận đấu'],['notifications','notice','Thông báo'],['profile','profile','Hồ sơ']];
const paths={
 home:'<path d="m2 10 10-8 10 8-2 2-1-1v11h-5v-7h-4v7H5V11l-1 1Z"/>',
 tournament:'<rect x="3" y="5" width="18" height="17" rx="2"/><path d="M8 2v6m8-6v6M3 11h18m-13 4h1m3 0h1m3 0h1m-9 4h1m3 0h1m3 0h1"/>',
 match:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18M8 3v6m0 6v6m8-18v6m0 6v6"/>',
 notice:'<path d="M5 3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-7l-6 4v-4H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="M7 11h.1m4.9 0h.1m4.9 0h.1"/>',
 profile:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2Z"/>'
};
export function bottomNav(active='today',{unreadCount=0}={}){
 return `<nav class="app-bottom-nav" aria-label="Điều hướng chính">${items.map(([id,glyph,label])=>`<button class="nav-item ${active===id?'active':''}" data-shell="tab:${id}" aria-current="${active===id?'page':'false'}"><span class="nav-symbol"><svg viewBox="0 0 24 24" fill="${id==='today'&&active===id?'currentColor':'none'}" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[glyph]}</svg>${id==='notifications'&&unreadCount>0?'<span class="nav-unread" aria-label="Có thông báo chưa đọc"></span>':''}</span><span>${label}</span></button>`).join('')}</nav>`;
}
