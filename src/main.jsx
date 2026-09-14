import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!phone.trim() || !password.trim()) {
      setError('Vui lòng nhập số điện thoại và mật khẩu.')
      return
    }

    setError('')
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Đăng nhập PICKLEBALL REFEREE">
        <h1>PICKLEBALL REFEREE</h1>

        <form onSubmit={handleSubmit} noValidate>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            aria-label="Số điện thoại"
            placeholder="Số điện thoại"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              setError('')
            }}
          />

          <input
            type="password"
            autoComplete="current-password"
            enterKeyHint="go"
            aria-label="Mật khẩu"
            placeholder="Mật khẩu"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
          />

          <button type="submit">Đăng nhập</button>
        </form>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
