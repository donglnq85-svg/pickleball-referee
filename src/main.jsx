import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!phone.trim() || !password.trim()) {
      setMessage('Vui lòng nhập số điện thoại và mật khẩu.')
      return
    }

    setMessage('Đăng nhập thành công.')
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Đăng nhập PICKLEBALL REFEREE">
        <h1>PICKLEBALL REFEREE</h1>

        <form onSubmit={handleSubmit}>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-label="Số điện thoại"
            placeholder="Số điện thoại"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              setMessage('')
            }}
          />

          <input
            type="password"
            autoComplete="current-password"
            aria-label="Mật khẩu"
            placeholder="Mật khẩu"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setMessage('')
            }}
          />

          <button type="submit">Đăng nhập</button>
        </form>

        {message ? <p className="login-message" role="status">{message}</p> : null}
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
