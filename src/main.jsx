import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    const cleanPhone = phone.trim()
    if (!cleanPhone || !password.trim()) {
      setError('Anh nhập số điện thoại và mật khẩu để tiếp tục.')
      return
    }
    localStorage.setItem('pr_logged_in', '1')
    localStorage.setItem('pr_phone', cleanPhone)
    onLogin(cleanPhone)
  }

  return (
    <main className="simple-login-page">
      <section className="simple-login-card">
        <div className="simple-logo">P</div>
        <h1>PICKLEBALL REFEREE</h1>
        <p>Trọng tài trong tay bạn</p>

        <form onSubmit={submit}>
          <label>
            <span>Số điện thoại</span>
            <input
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Nhập số điện thoại"
            />
          </label>

          <label>
            <span>Mật khẩu</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu"
            />
          </label>

          {error ? <div className="login-error">{error}</div> : null}
          <button className="login-submit" type="submit">ĐĂNG NHẬP</button>
        </form>

        <small>Bản thử nghiệm V1 · Chỉ cần nhập đủ 2 ô để vào app</small>
      </section>
    </main>
  )
}

function HomeScreen({ phone, onLogout }) {
  return (
    <main className="home-page">
      <header className="home-header">
        <div>
          <span>PICKLEBALL</span>
          <strong>REFEREE</strong>
        </div>
        <button onClick={onLogout}>Đăng xuất</button>
      </header>

      <section className="welcome-card">
        <p>Xin chào</p>
        <h1>{phone || 'Trọng tài'}</h1>
        <span>Ứng dụng đã chạy thực tế.</span>
      </section>

      <section className="quick-actions">
        <button>
          <b>＋</b>
          <span>Tạo trận đấu</span>
        </button>
        <button>
          <b>▦</b>
          <span>Lịch sử trận</span>
        </button>
        <button>
          <b>✓</b>
          <span>Luật thi đấu</span>
        </button>
        <button>
          <b>⚙</b>
          <span>Cài đặt</span>
        </button>
      </section>

      <section className="status-card">
        <div className="status-dot" />
        <div>
          <strong>Hệ thống sẵn sàng</strong>
          <p>Đây là màn hình chính đầu tiên của PICKLEBALL REFEREE V1.</p>
        </div>
      </section>
    </main>
  )
}

function App() {
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem('pr_logged_in') === '1')
  const [phone, setPhone] = useState(() => localStorage.getItem('pr_phone') || '')

  useEffect(() => {
    document.title = 'Pickleball Referee'
  }, [])

  const login = (value) => {
    setPhone(value)
    setLoggedIn(true)
  }

  const logout = () => {
    localStorage.removeItem('pr_logged_in')
    localStorage.removeItem('pr_phone')
    setLoggedIn(false)
    setPhone('')
  }

  return loggedIn ? <HomeScreen phone={phone} onLogout={logout} /> : <LoginScreen onLogin={login} />
}

createRoot(document.getElementById('root')).render(<App />)
