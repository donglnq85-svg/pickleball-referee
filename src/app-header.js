// Shared header: never substitute a stock portrait for the referee's identity.
export function appHeader(bell,{unreadCount=0,online=typeof navigator!=='undefined'&&navigator.onLine}={}){
  return `<header class="app-header"><button class="app-avatar ${online?'is-online':''}" data-shell="tab:profile" aria-label="Hồ sơ trọng tài">TT</button><div class="app-brand">PICKLEBALL REFEREE</div><button class="app-bell ${unreadCount>0?'has-unread':''}" data-shell="notifications" aria-label="Thông báo">${bell}</button></header>`;
}
