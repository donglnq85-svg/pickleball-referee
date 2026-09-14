import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function LoginScreen() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)

  const submit = (event) => {
    event.preventDefault()
    alert('Màn hình đăng nhập V1 đã sẵn sàng. Xác thực tài khoản sẽ được kết nối ở bước tiếp theo.')
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="brand-mark" aria-label="Pickleball Referee">
          <div className="ball">●</div>
          <div>
            <strong>PICKLEBALL</strong>
            <b>REFEREE</b>
          </div>
        </div>
        <p className="brand-values">CÔNG BẰNG · CHUYÊN NGHIỆP · PHÁT TRIỂN</p>
        <div className="hero-copy">Fair Play<br />Better Pickleball</div>
      </section>

      <section className="login-card">
        <header>
          <h1>Đăng nhập</h1>
          <h2>Pickleball Referee</h2>
          <p>Trợ lý trọng tài của bạn</p>
        </header>

        <form onSubmit={submit}>
          <label className="field">
            <span>Số điện thoại</span>
            <input
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Nhập số điện thoại"
            />
          </label>

          <label className="field password-field">
            <span>Mật khẩu</span>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu"
            />
            <button className="eye" type="button" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </label>

          <div className="login-options">
            <label className="remember">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span>Ghi nhớ đăng nhập</span>
            </label>
            <button type="button" className="link-button">Quên mật khẩu?</button>
          </div>

          <button className="primary-button" type="submit">ĐĂNG NHẬP <span>→</span></button>
        </form>

        <div className="divider"><span>hoặc</span></div>

        <div className="biometric-grid">
          <button type="button">◉ <span>Đăng nhập<br />bằng Face ID</span></button>
          <button type="button">◎ <span>Đăng nhập<br />bằng Touch ID</span></button>
        </div>

        <blockquote>“Trọng tài tốt hơn,<br />để Pickleball phát triển hơn mỗi ngày!”</blockquote>
        <footer>
          <span>Phiên bản 1.0.0</span>
          <span>Bảo mật · Ổn định · Dễ sử dụng</span>
        </footer>
      </section>

      <section className="principles">
        <div><strong>♧</strong><span>KẾT NỐI<br />CỘNG ĐỒNG</span></div>
        <div><strong>◇</strong><span>MINH BẠCH<br />CÔNG BẰNG</span></div>
        <div><strong>▥</strong><span>VÌ SỰ PHÁT TRIỂN<br />PICKLEBALL</span></div>
      </section>
    </main>
  )
}

function App() {
  return <LoginScreen />
}

createRoot(document.getElementById('root')).render(<App />)
