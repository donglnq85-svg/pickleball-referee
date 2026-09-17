import './styles.css'

const root = document.getElementById('root')
let screen = 'login'
let scoreA = 6
let scoreB = 4
let serving = 'A'

function button(text, action, cls = '') {
  return `<button class="${cls}" data-action="${action}">${text}</button>`
}

function render() {
  if (!root) return

  if (screen === 'login') {
    root.innerHTML = `<main class="page center"><section class="login"><h1>PICKLEBALL<br>REFEREE</h1><p>Chính xác. Công bằng. Phát triển.</p><input placeholder="Số điện thoại" inputmode="tel"><input placeholder="Mật khẩu" type="password">${button('Đăng nhập','home')}</section></main>`
  } else if (screen === 'home') {
    root.innerHTML = `<main class="page"><header><span>Xin chào</span><h2>Trọng tài</h2></header><section class="card"><b>Trận tiếp theo</b><small>Sân 1 · 10:00 · Hôm nay</small><h3>Nguyễn An / Trần Bình</h3><small>VS</small><h3>Lê Minh / Phạm Huy</h3>${button('Bắt đầu điều hành','match')}</section>${button('＋ Tạo trận mới <span>›</span>','create','row')}${button('Lịch thi đấu <span>›</span>','noop','row')}${button('Lịch sử trận đấu <span>›</span>','noop','row')}</main>`
  } else if (screen === 'create') {
    root.innerHTML = `<main class="page"><nav data-action="home">‹ <b>Tạo trận đấu</b></nav><label>Sân thi đấu</label><input value="Sân 1"><label>Loại trận</label><input value="Đôi nam"><label>Đội A</label><input value="Nguyễn An / Trần Bình"><label>Đội B</label><input value="Lê Minh / Phạm Huy">${button('Tạo trận đấu','match')}</main>`
  } else if (screen === 'match') {
    root.innerHTML = `<main class="page match"><nav data-action="home">‹ <b>Trận đấu</b></nav><small>Sân 1 · Game 1</small><div class="teams"><section><b>ĐỘI A</b><p>Nguyễn An<br>Trần Bình</p><strong>${scoreA}</strong></section><section><b>ĐỘI B</b><p>Lê Minh<br>Phạm Huy</p><strong>${scoreB}</strong></section></div>${button(`● Đội ${serving} giao bóng`,'serve','serve')}<div class="scoreBtns">${button('−<small>Điểm A</small>','a-')}${button('＋<small>Điểm A</small>','a+')}${button('−<small>Điểm B</small>','b-')}${button('＋<small>Điểm B</small>','b+')}</div>${button('Kết thúc game','end','secondary')}</main>`
  } else {
    const winner = scoreA > scoreB ? 'Đội A' : scoreB > scoreA ? 'Đội B' : 'Chưa xác định'
    root.innerHTML = `<main class="page center"><section class="login"><h2>Kết thúc game</h2><strong class="final">${scoreA} - ${scoreB}</strong><p>Game thắng thuộc về</p><h2>${winner}</h2>${button('Chơi game tiếp theo','next')}${button('Về trang chủ','home','secondary')}</section></main>`
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]')
  if (!target) return
  const action = target.dataset.action
  if (['home','create','match','end'].includes(action)) screen = action
  if (action === 'serve') serving = serving === 'A' ? 'B' : 'A'
  if (action === 'a-') scoreA = Math.max(0, scoreA - 1)
  if (action === 'a+') scoreA++
  if (action === 'b-') scoreB = Math.max(0, scoreB - 1)
  if (action === 'b+') scoreB++
  if (action === 'next') { scoreA = 0; scoreB = 0; screen = 'match' }
  render()
})

render()
