const STYLE_ID = 'pickleball-login-style'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    :root {
      --login-green: #0b7d4f;
      --login-lime: #b7ee37;
      --login-navy: #071237;
      --login-muted: #7d8194;
      --login-border: rgba(9, 21, 55, .14);
    }

    #pickleball-login-root {
      position: fixed;
      inset: 0;
      z-index: 99999;
      overflow: auto;
      background:
        radial-gradient(circle at 72% 24%, rgba(194,255,27,.98) 0 3.1%, rgba(194,255,27,.18) 3.2% 5.2%, transparent 5.3%),
        radial-gradient(circle at 14% 25%, rgba(184,239,56,.58) 0 1.4%, transparent 1.5%),
        linear-gradient(180deg, rgba(1,18,38,.34), rgba(0,35,44,.55)),
        linear-gradient(125deg, #0e4d5d 0%, #142d54 46%, #0c7250 100%);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--login-navy);
      -webkit-font-smoothing: antialiased;
    }

    #pickleball-login-root::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(160deg, transparent 0 60%, rgba(14,157,82,.68) 60.2% 66%, rgba(0,79,53,.92) 66.2%),
        repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 68px);
      pointer-events: none;
    }

    .pl-shell {
      position: relative;
      width: min(100%, 760px);
      min-height: 100%;
      margin: 0 auto;
      padding: max(22px, env(safe-area-inset-top)) 24px max(26px, env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .pl-brand {
      margin-top: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
      color: #fff;
      text-align: left;
    }

    .pl-ball-logo {
      width: 104px;
      aspect-ratio: 1;
      border-radius: 50%;
      position: relative;
      flex: 0 0 auto;
      background: radial-gradient(circle at 36% 30%, #d2ff41 0 28%, #9adf25 29% 100%);
      box-shadow: -24px 14px 0 -13px #96da31, -40px 26px 0 -24px #96da31;
    }

    .pl-ball-logo i {
      position: absolute;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #154643;
    }
    .pl-ball-logo i:nth-child(1){left:26px;top:23px}
    .pl-ball-logo i:nth-child(2){left:58px;top:18px}
    .pl-ball-logo i:nth-child(3){left:72px;top:43px}
    .pl-ball-logo i:nth-child(4){left:38px;top:49px}
    .pl-ball-logo i:nth-child(5){left:55px;top:70px}
    .pl-ball-logo i:nth-child(6){left:19px;top:62px}

    .pl-brand-copy strong,
    .pl-brand-copy b {
      display: block;
      font-size: clamp(34px, 6vw, 56px);
      line-height: .95;
      letter-spacing: -.025em;
      font-weight: 900;
    }
    .pl-brand-copy b { color: var(--login-lime); }

    .pl-values {
      margin-top: 18px;
      text-align: center;
      color: #fff;
      font-size: 13px;
      letter-spacing: .22em;
      text-transform: uppercase;
      opacity: .96;
    }

    .pl-hero-note {
      margin: 28px 0 18px;
      min-height: 128px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #fff;
    }

    .pl-script {
      font-family: "Snell Roundhand", "Segoe Script", cursive;
      font-size: clamp(36px, 7.3vw, 58px);
      line-height: 1.04;
      transform: rotate(-4deg);
      text-shadow: 0 2px 8px rgba(0,0,0,.15);
    }

    .pl-script span { display: block; }
    .pl-script::after {
      content: '';
      display: block;
      width: 128px;
      height: 7px;
      margin: 8px 0 0 88px;
      background: var(--login-lime);
      transform: rotate(-9deg);
      border-radius: 999px;
    }

    .pl-community {
      color: white;
      font-weight: 600;
      letter-spacing: .04em;
      line-height: 1.55;
      text-align: left;
      font-size: 14px;
    }
    .pl-community::after {
      content: '';
      display: block;
      width: 36px;
      height: 4px;
      margin-top: 10px;
      background: var(--login-lime);
      border-radius: 999px;
    }

    .pl-card {
      position: relative;
      width: 100%;
      background: rgba(255,255,255,.975);
      border-radius: 34px;
      padding: 42px 38px 30px;
      box-sizing: border-box;
      box-shadow: 0 24px 70px rgba(0,0,0,.18);
      overflow: hidden;
    }

    .pl-card::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 92px;
      height: 58px;
      background: #0a2943;
      border-bottom-left-radius: 28px;
      opacity: .12;
    }

    .pl-title {
      text-align: center;
      margin-bottom: 26px;
    }
    .pl-title h1 {
      margin: 0;
      font-size: clamp(36px, 6.2vw, 52px);
      line-height: 1.05;
      font-weight: 900;
      letter-spacing: -.025em;
    }
    .pl-title h2 {
      margin: 4px 0 0;
      font-size: clamp(24px, 4.7vw, 38px);
      line-height: 1.1;
      font-weight: 850;
    }
    .pl-title p {
      margin: 8px 0 0;
      color: var(--login-muted);
      font-size: 18px;
    }

    .pl-field {
      display: grid;
      grid-template-columns: 48px 1fr auto;
      align-items: center;
      min-height: 88px;
      border: 1px solid var(--login-border);
      border-radius: 18px;
      padding: 0 18px;
      margin: 14px 0;
      background: #fff;
      box-sizing: border-box;
    }

    .pl-icon {
      width: 28px;
      height: 34px;
      display: grid;
      place-items: center;
      color: var(--login-navy);
      font-size: 28px;
      user-select: none;
    }

    .pl-field-text label {
      display: block;
      color: #7d8191;
      font-size: 16px;
      margin-bottom: 3px;
    }

    .pl-field-text input {
      width: 100%;
      border: 0;
      outline: 0;
      background: transparent;
      font: inherit;
      font-size: 23px;
      font-weight: 780;
      color: var(--login-navy);
      padding: 0;
    }

    .pl-ghost-btn {
      border: 0;
      background: transparent;
      cursor: pointer;
      color: #6f7488;
      font-size: 24px;
      padding: 10px;
    }

    .pl-options {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      margin: 16px 0 20px;
      font-size: 16px;
    }
    .pl-remember {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }
    .pl-remember input { display: none; }
    .pl-check {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      background: var(--login-green);
      display: grid;
      place-items: center;
      color: #fff;
      font-weight: 900;
      box-shadow: 0 3px 8px rgba(11,125,79,.22);
    }
    .pl-remember input:not(:checked) + .pl-check {
      background: white;
      color: transparent;
      border: 1px solid var(--login-border);
      box-shadow: none;
    }
    .pl-forgot {
      color: #17694b;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
    }

    .pl-login-btn {
      width: 100%;
      min-height: 72px;
      border: 0;
      border-radius: 18px;
      background: linear-gradient(180deg, #0b8354, #087246);
      color: #fff;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: .02em;
      box-shadow: 0 8px 22px rgba(8,114,70,.22);
      cursor: pointer;
    }
    .pl-login-btn span {
      display: inline-block;
      margin-left: 16px;
      font-size: 36px;
      vertical-align: -3px;
      font-weight: 400;
    }

    .pl-divider {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 18px 0;
      color: #7f8494;
      font-size: 16px;
    }
    .pl-divider::before,
    .pl-divider::after {
      content: '';
      height: 1px;
      flex: 1;
      background: #d8dbe2;
    }

    .pl-bio-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .pl-bio-btn {
      min-height: 84px;
      border: 1px solid var(--login-border);
      border-radius: 18px;
      background: white;
      color: var(--login-navy);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 650;
      line-height: 1.35;
      text-align: left;
    }
    .pl-bio-icon {
      width: 42px;
      height: 42px;
      border: 3px solid var(--login-navy);
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 19px;
      font-weight: 900;
      flex: 0 0 auto;
    }

    .pl-quote {
      margin: 28px 0 20px;
      text-align: center;
      color: #596075;
      font-style: italic;
      font-size: 17px;
      line-height: 1.45;
    }
    .pl-quote::after {
      content: '';
      display: block;
      margin: 10px auto 0;
      width: 56px;
      height: 5px;
      border-radius: 999px;
      background: var(--login-lime);
      transform: rotate(-8deg);
    }

    .pl-card-footer {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      color: #8a8fa0;
      font-size: 13px;
    }

    .pl-footer {
      margin-top: 26px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      color: #fff;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.35;
    }
    .pl-footer-item + .pl-footer-item {
      border-left: 1px solid rgba(255,255,255,.35);
    }
    .pl-footer-icon {
      display: block;
      font-size: 30px;
      margin-bottom: 8px;
    }

    .pl-toast {
      position: fixed;
      left: 50%;
      bottom: max(20px, env(safe-area-inset-bottom));
      transform: translateX(-50%) translateY(130%);
      z-index: 100001;
      background: #071237;
      color: #fff;
      padding: 12px 18px;
      border-radius: 999px;
      font-size: 14px;
      transition: transform .25s ease;
      box-shadow: 0 8px 25px rgba(0,0,0,.24);
      white-space: nowrap;
    }
    .pl-toast.show { transform: translateX(-50%) translateY(0); }

    @media (max-width: 560px) {
      .pl-shell { padding-left: 16px; padding-right: 16px; }
      .pl-brand { margin-top: 18px; gap: 12px; }
      .pl-ball-logo { width: 78px; }
      .pl-ball-logo i { transform: scale(.8); }
      .pl-brand-copy strong, .pl-brand-copy b { font-size: 34px; }
      .pl-values { font-size: 10px; letter-spacing: .14em; }
      .pl-hero-note { min-height: 100px; margin: 18px 0 14px; }
      .pl-script { font-size: 36px; }
      .pl-community { display: none; }
      .pl-card { border-radius: 26px; padding: 32px 20px 24px; }
      .pl-title h1 { font-size: 36px; }
      .pl-title h2 { font-size: 25px; }
      .pl-title p { font-size: 16px; }
      .pl-field { min-height: 74px; grid-template-columns: 42px 1fr auto; padding: 0 12px; }
      .pl-field-text label { font-size: 14px; }
      .pl-field-text input { font-size: 20px; }
      .pl-options { font-size: 14px; }
      .pl-login-btn { min-height: 64px; }
      .pl-bio-row { gap: 10px; }
      .pl-bio-btn { min-height: 76px; font-size: 14px; gap: 9px; }
      .pl-bio-icon { width: 36px; height: 36px; }
      .pl-quote { font-size: 15px; }
      .pl-card-footer { font-size: 11px; }
      .pl-footer { font-size: 11px; }
    }
  `
  document.head.appendChild(style)
}

function showToast(message) {
  let toast = document.querySelector('.pl-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'pl-toast'
    document.body.appendChild(toast)
  }
  toast.textContent = message
  requestAnimationFrame(() => toast.classList.add('show'))
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800)
}

function closeLogin() {
  document.getElementById('pickleball-login-root')?.remove()
  sessionStorage.setItem('pickleball_referee_logged_in', '1')
}

function mountLogin() {
  if (sessionStorage.getItem('pickleball_referee_logged_in') === '1') return
  injectStyles()

  const root = document.createElement('div')
  root.id = 'pickleball-login-root'
  root.innerHTML = `
    <div class="pl-shell">
      <div class="pl-brand">
        <div class="pl-ball-logo" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="pl-brand-copy"><strong>PICKLEBALL</strong><b>REFEREE</b></div>
      </div>
      <div class="pl-values">CÔNG BẰNG&nbsp;&nbsp;•&nbsp;&nbsp;CHUYÊN NGHIỆP&nbsp;&nbsp;•&nbsp;&nbsp;PHÁT TRIỂN</div>

      <div class="pl-hero-note">
        <div class="pl-script"><span>Fair Play</span><span>Better</span><span>Pickleball</span></div>
        <div class="pl-community">PEOPLE<br>SPORT<br>COMMUNITY</div>
      </div>

      <section class="pl-card" aria-label="Đăng nhập Pickleball Referee">
        <div class="pl-title">
          <h1>Đăng nhập</h1>
          <h2>Pickleball Referee</h2>
          <p>Trợ lý trọng tài của bạn</p>
        </div>

        <div class="pl-field">
          <div class="pl-icon" aria-hidden="true">▯</div>
          <div class="pl-field-text">
            <label for="pl-phone">Số điện thoại</label>
            <input id="pl-phone" inputmode="tel" autocomplete="tel" value="0988.11.32.67" />
          </div>
        </div>

        <div class="pl-field">
          <div class="pl-icon" aria-hidden="true">♙</div>
          <div class="pl-field-text">
            <label for="pl-password">Mật khẩu</label>
            <input id="pl-password" type="password" autocomplete="current-password" value="pickleball" />
          </div>
          <button class="pl-ghost-btn" id="pl-toggle-password" type="button" aria-label="Hiện mật khẩu">◉</button>
        </div>

        <div class="pl-options">
          <label class="pl-remember">
            <input id="pl-remember" type="checkbox" checked />
            <span class="pl-check">✓</span>
            <span>Ghi nhớ đăng nhập</span>
          </label>
          <span class="pl-forgot" id="pl-forgot">Quên mật khẩu?</span>
        </div>

        <button class="pl-login-btn" id="pl-login" type="button">ĐĂNG NHẬP <span>→</span></button>

        <div class="pl-divider">hoặc</div>

        <div class="pl-bio-row">
          <button class="pl-bio-btn" id="pl-face" type="button"><span class="pl-bio-icon">⌁</span><span>Đăng nhập<br>bằng Face ID</span></button>
          <button class="pl-bio-btn" id="pl-touch" type="button"><span class="pl-bio-icon">◎</span><span>Đăng nhập<br>bằng Touch ID</span></button>
        </div>

        <div class="pl-quote">“Trọng tài tốt hơn,<br>để Pickleball phát triển hơn mỗi ngày!”</div>

        <div class="pl-card-footer">
          <span>Phiên bản 1.0.0</span>
          <span>Bảo mật&nbsp;&nbsp;•&nbsp;&nbsp;Ổn định&nbsp;&nbsp;•&nbsp;&nbsp;Dễ sử dụng</span>
        </div>
      </section>

      <footer class="pl-footer">
        <div class="pl-footer-item"><span class="pl-footer-icon">♧</span>KẾT NỐI<br>CỘNG ĐỒNG</div>
        <div class="pl-footer-item"><span class="pl-footer-icon">◇</span>MINH BẠCH<br>CÔNG BẰNG</div>
        <div class="pl-footer-item"><span class="pl-footer-icon">▥</span>VÌ SỰ PHÁT TRIỂN<br>PICKLEBALL</div>
      </footer>
    </div>
  `

  document.body.appendChild(root)

  const password = root.querySelector('#pl-password')
  const toggle = root.querySelector('#pl-toggle-password')
  toggle.addEventListener('click', () => {
    password.type = password.type === 'password' ? 'text' : 'password'
    toggle.textContent = password.type === 'password' ? '◉' : '⊘'
  })

  root.querySelector('#pl-login').addEventListener('click', () => {
    const phone = root.querySelector('#pl-phone').value.trim()
    if (!phone) {
      showToast('Vui lòng nhập số điện thoại')
      return
    }
    closeLogin()
  })

  root.querySelector('#pl-forgot').addEventListener('click', () => showToast('Tính năng khôi phục mật khẩu sẽ được kết nối ở bước tiếp theo'))
  root.querySelector('#pl-face').addEventListener('click', closeLogin)
  root.querySelector('#pl-touch').addEventListener('click', closeLogin)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountLogin, { once: true })
} else {
  mountLogin()
}
