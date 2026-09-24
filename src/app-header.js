// Shared header: never substitute a stock portrait for the referee's identity.
export function appHeader(bell){
  return `<header class="app-header"><div class="app-avatar" aria-label="Hồ sơ trọng tài">TT</div><div class="app-brand">PICKLEBALL REFEREE</div><button class="app-bell" data-shell="notifications" aria-label="Thông báo">${bell}</button></header>`;
}
