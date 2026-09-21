// Trang 06 owns only the pre-match assistant. Page 04/05 supply read-only snapshots.
(function () {
  const app = document.getElementById('app');
  const titles = ['Xác nhận trận', 'Kiểm tra trước trận', 'Phổ biến cho VĐV', 'Khởi động', 'Sẵn sàng'];
  const checks = {
    confirm: [
      ['players', 'VĐV và thể thức đúng', 'Đọc lại tên, hình thức thi đấu và điểm thắng đã thiết lập.'],
      ['positions', 'Quyền giao và vị trí đúng', 'Đối chiếu đội giao trước, người giao, người đỡ và hai bên sân.'],
      ['score', 'Tỷ số bắt đầu đúng', 'Kiểm tra điểm chấp và số lượt giao đầu tiên.']
    ],
    inspect: [
      ['court', 'Sân và lưới sẵn sàng', 'Quan sát mặt sân, vạch, lưới và khu vực xung quanh.'],
      ['equipment', 'Bóng và vợt đã kiểm tra', 'Đối chiếu bóng, vợt với yêu cầu của trận hoặc ban tổ chức.'],
      ['safety', 'Điều kiện thi đấu an toàn', 'Xử lý vật cản, khu vực trơn trượt hoặc điều kiện bất thường.']
    ],
    brief: [
      ['call', 'Thông báo cách xướng điểm', 'Nhắc VĐV chờ trọng tài xướng xong tỷ số trước khi giao.'],
      ['lines', 'Thống nhất trách nhiệm gọi bóng', 'Làm rõ ai gọi vạch theo quy định áp dụng cho trận này.'],
      ['requests', 'Giải thích cách yêu cầu tạm dừng', 'Yêu cầu VĐV báo trọng tài rõ ràng ở thời điểm hợp lệ.'],
      ['questions', 'Hai đội đã được hỏi', 'Hỏi VĐV có câu hỏi hoặc điều kiện sân cần làm rõ hay không.']
    ],
    ready: [
      ['onCourt', 'Hai đội đã vào đúng vị trí', 'Nhìn lại người giao, người đỡ và bên sân theo thiết lập.'],
      ['referee', 'Trọng tài sẵn sàng xướng điểm', 'Kiểm tra bóng, bảng điểm và sự tập trung của hai đội.']
    ]
  };
  let setup = null;
  let page = 0;
  let checked = {};
  let warmMinutes = 3;
  let warmStarted = false;
  let warmDone = false;
  let remaining = 180;
  let deadline = 0;
  let interval = null;
  let lastSecond = null;
  let page04 = {};
  let page05Html = '';

  function safe(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function own(selector) { return app.querySelector(selector); }
  function readPage04() {
    const players = {};
    app.querySelectorAll('[data-player]').forEach(input => { players[input.dataset.player] = input.value.trim(); });
    const pressed = selector => {
      const item = app.querySelector(selector + '[aria-pressed="true"]') || app.querySelector(selector + '.on');
      return item ? item.textContent.trim() : '';
    };
    page04 = {
      players, type: pressed('.q4mChoices button') || 'Đánh đôi',
      sets: pressed('.q4mFormats button') || '1 set',
      target: pressed('.q4mPointChoices button') || app.querySelector('[aria-label="Điểm thắng tùy chỉnh"]')?.textContent || '11',
      rule: pressed('.q4mWinChoices button') || 'Chạm điểm',
      cap: pressed('.q4mCapChoices button'),
      note: app.querySelector('#match-note')?.value.trim() || ''
    };
  }
  // Capture the Page 04 form before Page 05's existing handler replaces it.
  window.addEventListener('click', event => {
    if (event.target.closest('[data-a="saveInfo"]')) readPage04();
  }, true);

  function readPage05(detail) {
    const snapshot = document.createElement('div');
    snapshot.innerHTML = detail.html;
    const labels = [...snapshot.querySelectorAll('.p5v3labels span')];
    const left = labels[0]?.textContent.match(/ĐỘI ([AB])/)?.[1] || 'A';
    const side = { A: left === 'A' ? 'trái' : 'phải', B: left === 'B' ? 'trái' : 'phải' };
    const people = { A: [], B: [] };
    const right = {};
    let serverPlayer = 0, receiverPlayer = 0;
    let serverName = '', receiverName = '';
    snapshot.querySelectorAll('.p5v3p').forEach(element => {
      const id = element.querySelector('.p5v3pid')?.textContent || '';
      const team = id[0], number = Number(id[1]) - 1;
      if (!people[team] || number < 0) return;
      const name = element.querySelector('.p5v3pname')?.textContent || '';
      people[team][number] = name;
      const isBottom = parseFloat(element.style.top) > 50;
      if ((team === left && isBottom) || (team !== left && !isBottom)) right[team] = number;
      if (element.classList.contains('server')) { serverPlayer = number; serverName = name; }
      if (element.classList.contains('receiver')) { receiverPlayer = number; receiverName = name; }
    });
    for (const team of ['A', 'B']) for (let n = 0; n < 2; n++) {
      people[team][n] ||= page04.players[team.toLowerCase() + (n + 1)] || 'VĐV ' + team + (n + 1);
    }
    const serveTeam = detail.serveTeam === 'B' ? 'B' : 'A';
    const startA = Number(detail.startA) || 0, startB = Number(detail.startB) || 0;
    return {
      people, side, right, serveTeam, serverPlayer, receiverPlayer, serverName, receiverName,
      startA, startB, call: serveTeam === 'A' ? `${startA}–${startB}–2` : `${startB}–${startA}–2`
    };
  }
  function stopClock() { if (interval) clearInterval(interval); interval = null; }
  function currentRemaining() {
    return warmStarted && !warmDone ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : remaining;
  }
  function format(seconds) {
    const value = Math.max(0, seconds);
    return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
  }
  function tick() {
    const next = currentRemaining();
    if (next === lastSecond) return;
    lastSecond = next;
    const clock = own('[data-p6clock]');
    if (clock) clock.textContent = format(next);
    const bar = own('[data-p6bar]');
    if (bar) bar.style.width = Math.min(100, next / (warmMinutes * 60) * 100) + '%';
    if (!next && warmStarted && !warmDone) { warmDone = true; warmStarted = false; stopClock(); render(); }
  }
  function rows(group) {
    return checks[group].map(([key, title, help]) =>
      `<label class="p6row"><input type="checkbox" data-p6check="${key}" ${checked[key] ? 'checked' : ''}><span><b>${title}</b><small>${help}</small></span></label>`).join('');
  }
  function complete(group) { return checks[group].every(([key]) => checked[key]); }
  function matchCard() {
    const names = team => setup.people[team].slice(0, page04.type.includes('Đánh đơn') ? 1 : 2).map(name => `<span>${safe(name)}</span>`).join('');
    return `<section class="p6panel"><h2>Thông tin từ thiết lập trận</h2>
      <div class="p6pair"><div class="p6team"><b>ĐỘI A</b>${names('A')}</div><div class="p6team"><b>ĐỘI B</b>${names('B')}</div></div>
      <div class="p6facts"><div class="p6fact"><small>Hình thức</small><strong>${safe(page04.type)}</strong></div>
      <div class="p6fact"><small>Thể thức</small><strong>${safe(page04.sets)}</strong></div>
      <div class="p6fact"><small>Điểm thắng</small><strong>${safe(page04.target)}</strong></div>
      <div class="p6fact"><small>Cách thắng</small><strong>${safe(page04.rule)}</strong></div></div>
      ${page04.cap ? `<p style="margin-top:10px">Giới hạn: ${safe(page04.cap)}</p>` : ''}
      ${page04.note ? `<p style="margin-top:10px">Ghi chú: ${safe(page04.note)}</p>` : ''}</section>
      <section class="p6panel"><h2>Giao bóng và vị trí xuất phát</h2>
      <div class="p6call"><small>ĐỘI ${setup.serveTeam} GIAO TRƯỚC · LƯỢT GIAO 2</small><strong>${setup.call}</strong></div>
      <div class="p6facts"><div class="p6fact"><small>Người giao</small><strong>${safe(setup.serverName)}</strong></div>
      <div class="p6fact"><small>Người đỡ</small><strong>${safe(setup.receiverName)}</strong></div></div>
      <div class="p6court" style="margin-top:10px"><div class="p6side"><small>BÊN TRÁI TRỌNG TÀI</small><b>Đội ${setup.side.A === 'trái' ? 'A' : 'B'}</b></div>
      <div class="p6side"><small>BÊN PHẢI TRỌNG TÀI</small><b>Đội ${setup.side.A === 'phải' ? 'A' : 'B'}</b></div></div></section>`;
  }
  function content() {
    if (page === 0) return `<p class="p6intro">Đối chiếu thông tin đã chốt với hai đội. Nếu cần đổi dữ liệu trận, quay lại màn thiết lập trước khi xác nhận.</p>${matchCard()}<section class="p6panel"><h2>Xác nhận với hai đội</h2>${rows('confirm')}</section>`;
    if (page === 1) return `<p class="p6intro">Kiểm tra nhanh điều kiện thực tế trước khi VĐV khởi động. Các mục dưới đây là gợi ý công việc cho trọng tài; yêu cầu của ban tổ chức vẫn được ưu tiên.</p><section class="p6panel"><h2>Kiểm tra sân và dụng cụ</h2>${rows('inspect')}</section><div class="p6note">Nếu phát hiện vấn đề an toàn, xử lý trước khi tiếp tục và báo ban tổ chức khi cần.</div>`;
    if (page === 2) return `<p class="p6intro">Dùng các câu nhắc ngắn để hai đội hiểu cách trọng tài điều hành trận. Xác nhận từng mục sau khi đã trao đổi.</p><section class="p6panel"><h2>Nội dung cần trao đổi</h2>${rows('brief')}</section><div class="p6note">Nội dung về line call và thời lượng tạm dừng phụ thuộc thể thức, lực lượng trọng tài và quy định giải; cần đối chiếu trước trận.</div>`;
    if (page === 3 && !warmStarted && !warmDone) return `<p class="p6intro">Chọn thời lượng khởi động theo thông báo của giải hoặc thống nhất trên sân. Đồng hồ là công cụ hỗ trợ, không mặc định một thời lượng luật định.</p><section class="p6panel"><h2>Thời lượng khởi động</h2><div class="p6times">${[1,2,3,5].map(n => `<button type="button" data-p6minute="${n}" class="${warmMinutes === n ? 'on' : ''}">${n} phút</button>`).join('')}</div><label class="p6custom">Thời lượng khác <input type="number" data-p6custom min="1" max="30" inputmode="numeric" value="${warmMinutes}" aria-label="Thời lượng khởi động (phút)"> phút</label></section>`;
    if (page === 3) return `<section class="p6panel"><h2>${warmDone ? 'Đã kết thúc khởi động' : 'Đang khởi động'}</h2><div class="p6timer"><strong data-p6clock>${format(currentRemaining())}</strong><small>${warmDone ? 'Chuyển sang kiểm tra sẵn sàng' : 'Đồng hồ vẫn chạy khi chuyển ứng dụng trong cùng phiên'}</small><div class="p6timerBar"><i data-p6bar style="width:${currentRemaining() / (warmMinutes * 60) * 100}%"></i></div></div>${warmDone ? '' : '<div class="p6timerTools"><button data-p6action="add">+30 giây</button><button data-p6action="end">Kết thúc sớm</button></div>'}</section>`;
    return `<p class="p6intro">Kiểm tra lần cuối trước khi xướng tỷ số bắt đầu. Tất cả dữ liệu đã chuyển từ phần thiết lập, không cần nhập lại.</p>
      <section class="p6panel"><h2>Kiểm tra trên sân</h2>${rows('ready')}</section>
      <section class="p6panel p6ready"><strong>Đội ${setup.serveTeam} giao trước · ${setup.call}</strong><br>
      ${safe(setup.serverName)} giao bóng → ${safe(setup.receiverName)} đỡ bóng.<br>
      Bên trái trọng tài: Đội ${setup.side.A === 'trái' ? 'A' : 'B'}.</section>`;
  }
  function render() {
    if (!setup) return;
    const enabled = page === 0 ? complete('confirm') : page === 1 ? complete('inspect') :
      page === 2 ? complete('brief') : page === 3 ? warmDone : complete('ready');
    const action = page === 3 && !warmStarted && !warmDone ? 'Bắt đầu khởi động' :
      page === 3 && warmStarted ? 'Đang khởi động…' : page === 4 ? 'BẮT ĐẦU TRẬN' : 'Tiếp tục';
    app.innerHTML = `<main class="p6guide"><header class="p6head"><div class="p6headTop"><button type="button" class="p6back" data-p6action="back" aria-label="Quay lại">‹</button><b>TRỢ LÝ TRỌNG TÀI · 06</b><span>${page + 1}/5</span></div>
      <h1>Chuẩn bị trước trận</h1><p>Xác nhận · Kiểm tra · Phổ biến · Khởi động · Sẵn sàng</p>
      <div class="p6progress" aria-label="Bước ${page + 1} trong 5">${titles.map((_,i) => `<i class="${i <= page ? 'done' : ''}"></i>`).join('')}</div></header>
      <div class="p6body"><div class="p6eyebrow">BƯỚC ${String(page + 1).padStart(2,'0')} / 05</div>
      <h2 class="p6title">${titles[page]}</h2>${content()}</div>
      <footer class="p6footer"><button class="p6primary" data-p6action="next" ${page === 3 && warmStarted || page !== 3 && !enabled ? 'disabled' : ''}>${action}</button>
      <small>${page === 3 && warmStarted ? 'Có thể kết thúc sớm khi trọng tài xác nhận' : !enabled && page !== 3 ? 'Hoàn tất các mục để tiếp tục' : 'Dữ liệu của Trang 04–05 được giữ nguyên'}</small></footer></main>`;
    lastSecond = null;
    if (warmStarted) tick();
  }
  window.addEventListener('p5-ready', event => {
    stopClock();
    page05Html = event.detail.html;
    setup = readPage05(event.detail);
    checked = {};
    page = 0;
    warmStarted = warmDone = false;
    warmMinutes = 3;
    remaining = 180;
    render();
  });
  document.addEventListener('change', event => {
    const key = event.target.dataset.p6check;
    if (key && setup) { checked[key] = event.target.checked; render(); }
    if (event.target.matches('[data-p6custom]')) {
      warmMinutes = Math.min(30, Math.max(1, Math.round(Number(event.target.value) || 3)));
      remaining = warmMinutes * 60;
      render();
    }
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-p6action],[data-p6minute]');
    if (!button || !setup) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.dataset.p6minute) {
      warmMinutes = Number(button.dataset.p6minute);
      remaining = warmMinutes * 60;
      return render();
    }
    switch (button.dataset.p6action) {
      case 'back':
        if (page) { page--; return render(); }
        stopClock(); setup = null; app.innerHTML = page05Html; break;
      case 'add': deadline += 30000; tick(); break;
      case 'end': remaining = currentRemaining(); warmStarted = false; warmDone = true; stopClock(); render(); break;
      case 'next':
        if (button.disabled) return;
        if (page === 3 && !warmDone) {
          warmStarted = true;
          deadline = Date.now() + warmMinutes * 60000;
          lastSecond = null;
          stopClock();
          interval = setInterval(tick, 250);
          return render();
        }
        if (page < 4) { page++; return render(); }
        if (!complete('ready')) return;
        stopClock();
        window.dispatchEvent(new CustomEvent('p6-start-match', { detail: setup }));
        setup = null;
    }
  }, true);
})();
