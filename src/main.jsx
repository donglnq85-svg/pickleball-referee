import './styles.css'

const root = document.getElementById('root')
let screen = 'login'
let scoreA = 6
let scoreB = 4
let serving = 'A'
let server = 'Nguyễn An'
let receiver = 'Lê Minh'

const teamA = ['Nguyễn An', 'Trần Bình']
const teamB = ['Lê Minh', 'Phạm Huy']

function button(text, action, cls = '') {
  return `<button class="${cls}" data-action="${action}">${text}</button>`
}

function playerChoice(name, role, selected) {
  return `<button class="setup-player ${selected ? 'is-selected' : ''}" data-role="${role}" data-player="${name}"><span class="setup-avatar">${name.split(' ').slice(-1)[0].charAt(0)}</span><span><b>${name}</b><small>${selected ? (role === 'server' ? 'Người giao bóng' : 'Người đỡ bóng') : 'Chạm để chọn'}</small></span><i>${selected ? '✓' : ''}</i></button>`
}

function renderSetup() {
  const servingTeam = teamA.includes(server) ? 'A' : 'B'
  const receivingPlayers = servingTeam === 'A' ? teamB : teamA
  if (!receivingPlayers.includes(receiver)) receiver = receivingPlayers[0]
  const servingPlayers = servingTeam === 'A' ? teamA : teamB

  return `<main class="page setup-page">
    <div class="setup-topbar"><button class="setup-back" data-action="create" aria-label="Quay lại">‹</button><div><small>TRƯỚC KHI BẮT ĐẦU</small><h2>Thiết lập trận đấu</h2></div><span class="setup-step">04</span></div>

    <section class="setup-summary">
      <div><span>SÂN 1</span><b>Đôi nam · Game 1</b></div>
      <div class="setup-vs"><span>A</span><i>VS</i><span>B</span></div>
      <p><b>Nguyễn An · Trần Bình</b><em>—</em><b>Lê Minh · Phạm Huy</b></p>
    </section>

    <section class="setup-section">
      <div class="setup-section-title"><span>1</span><div><h3>Ai giao bóng đầu tiên?</h3><p>Chọn 1 VĐV. Vị trí giao bóng được app tự xác định theo luật.</p></div></div>
      <div class="setup-team-switch">
        <button class="${servingTeam === 'A' ? 'active' : ''}" data-action="serve-team-a">ĐỘI A</button>
        <button class="${servingTeam === 'B' ? 'active' : ''}" data-action="serve-team-b">ĐỘI B</button>
      </div>
      <div class="setup-player-list">${servingPlayers.map(p => playerChoice(p, 'server', p === server)).join('')}</div>
    </section>

    <section class="setup-section">
      <div class="setup-section-title"><span>2</span><div><h3>Ai đỡ bóng đầu tiên?</h3><p>Chỉ hiển thị VĐV của đội nhận giao bóng.</p></div></div>
      <div class="setup-player-list">${receivingPlayers.map(p => playerChoice(p, 'receiver', p === receiver)).join('')}</div>
    </section>

    <section class="setup-court-card">
      <div class="setup-court-head"><div><small>GÓC NHÌN TRỌNG TÀI CHÍNH</small><b>Vị trí xuất phát</b></div><span>App tự xếp ✓</span></div>
      <div class="mini-court">
        <div class="court-half court-left"><span class="court-player top">${servingTeam === 'A' ? teamA[1] : teamB[1]}</span><span class="court-player bottom server-dot">● ${server}</span></div>
        <div class="court-net"></div>
        <div class="court-half court-right"><span class="court-player top receiver-dot">◎ ${receiver}</span><span class="court-player bottom">${receivingPlayers.find(p => p !== receiver)}</span></div>
      </div>
      <div class="court-legend"><span><i class="legend-serve"></i> Giao bóng</span><span><i class="legend-receive"></i> Đỡ bóng</span></div>
    </section>

    <div class="setup-ready"><span>✓</span><p><b>Sẵn sàng bắt đầu</b><small>${server} giao bóng · ${receiver} đỡ bóng</small></p></div>
    ${button('BẮT ĐẦU TRẬN  →','match','setup-start')}
  </main>`
}

function render() {
  if (!root) return

  if (screen === 'login') {
    root.innerHTML = `<main class="page center"><section class="login"><h1>PICKLEBALL<br>REFEREE</h1><p>Chính xác. Công bằng. Phát triển.</p><input placeholder="Số điện thoại" inputmode="tel"><input placeholder="Mật khẩu" type="password">${button('Đăng nhập','home')}</section></main>`
  } else if (screen === 'home') {
    root.innerHTML = `<main class="page"><header><span>Xin chào</span><h2>Trọng tài</h2></header><section class="card"><b>Trận tiếp theo</b><small>Sân 1 · 10:00 · Hôm nay</small><h3>Nguyễn An / Trần Bình</h3><small>VS</small><h3>Lê Minh / Phạm Huy</h3>${button('Bắt đầu điều hành','setup')}</section>${button('＋ Tạo trận mới <span>›</span>','create','row')}${button('Lịch thi đấu <span>›</span>','noop','row')}${button('Lịch sử trận đấu <span>›</span>','noop','row')}</main>`
  } else if (screen === 'create') {
    root.innerHTML = `<main class="page"><nav data-action="home">‹ <b>Tạo trận đấu</b></nav><label>Sân thi đấu</label><input value="Sân 1"><label>Loại trận</label><input value="Đôi nam"><label>Đội A</label><input value="Nguyễn An / Trần Bình"><label>Đội B</label><input value="Lê Minh / Phạm Huy">${button('Tạo trận đấu','setup')}</main>`
  } else if (screen === 'setup') {
    root.innerHTML = renderSetup()
  } else if (screen === 'match') {
    serving = teamA.includes(server) ? 'A' : 'B'
    root.innerHTML = `<main class="page match"><nav data-action="home">‹ <b>Trận đấu</b></nav><small>Sân 1 · Game 1</small><div class="teams"><section><b>ĐỘI A</b><p>Nguyễn An<br>Trần Bình</p><strong>${scoreA}</strong></section><section><b>ĐỘI B</b><p>Lê Minh<br>Phạm Huy</p><strong>${scoreB}</strong></section></div>${button(`● Đội ${serving} giao bóng`,'serve','serve')}<div class="scoreBtns">${button('−<small>Điểm A</small>','a-')}${button('＋<small>Điểm A</small>','a+')}${button('−<small>Điểm B</small>','b-')}${button('＋<small>Điểm B</small>','b+')}</div>${button('Kết thúc game','end','secondary')}</main>`
  } else {
    const winner = scoreA > scoreB ? 'Đội A' : scoreB > scoreA ? 'Đội B' : 'Chưa xác định'
    root.innerHTML = `<main class="page center"><section class="login"><h2>Kết thúc game</h2><strong class="final">${scoreA} - ${scoreB}</strong><p>Game thắng thuộc về</p><h2>${winner}</h2>${button('Chơi game tiếp theo','next')}${button('Về trang chủ','home','secondary')}</section></main>`
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action], [data-role]')
  if (!target) return
  const action = target.dataset.action
  const role = target.dataset.role

  if (role === 'server') { server = target.dataset.player; receiver = teamA.includes(server) ? teamB[0] : teamA[0] }
  if (role === 'receiver') receiver = target.dataset.player
  if (['home','create','setup','match','end'].includes(action)) screen = action
  if (action === 'serve-team-a') { server = teamA[0]; receiver = teamB[0] }
  if (action === 'serve-team-b') { server = teamB[0]; receiver = teamA[0] }
  if (action === 'serve') serving = serving === 'A' ? 'B' : 'A'
  if (action === 'a-') scoreA = Math.max(0, scoreA - 1)
  if (action === 'a+') scoreA++
  if (action === 'b-') scoreB = Math.max(0, scoreB - 1)
  if (action === 'b+') scoreB++
  if (action === 'next') { scoreA = 0; scoreB = 0; screen = 'match' }
  render()
})

render()
