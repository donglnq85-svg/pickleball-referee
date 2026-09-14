import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  const [screen, setScreen] = useState('home')

  if (screen === 'setup') {
    return (
      <main className="shell">
        <section className="card setup-card">
          <div className="badge">CORE MATCH</div>
          <h1>TẠO TRẬN ĐẤU</h1>
          <p>Thiết lập trận đấu mới để bắt đầu luồng trọng tài.</p>

          <div className="form-grid">
            <label>
              Đội 1
              <input defaultValue="ĐỘI 1" />
            </label>
            <label>
              Đội 2
              <input defaultValue="ĐỘI 2" />
            </label>
            <label>
              Điểm thắng game
              <select defaultValue="11">
                <option value="11">11 điểm</option>
                <option value="15">15 điểm</option>
                <option value="21">21 điểm</option>
              </select>
            </label>
            <label>
              Thắng cách biệt
              <select defaultValue="2">
                <option value="2">2 điểm</option>
              </select>
            </label>
          </div>

          <button onClick={() => setScreen('match')}>BẮT ĐẦU TRẬN ĐẤU</button>
          <button className="secondary" onClick={() => setScreen('home')}>QUAY LẠI</button>
        </section>
      </main>
    )
  }

  if (screen === 'match') {
    return (
      <main className="shell">
        <section className="card">
          <div className="badge">TRẬN ĐẤU ĐANG DIỄN RA</div>
          <h1>0 — 0</h1>
          <p>Vertical Slice đã đi tới màn hình điều hành trận đấu.</p>
          <div className="status"><span></span> IN_PROGRESS</div>
          <button onClick={() => setScreen('home')}>KẾT THÚC DEMO</button>
          <small>Bước tiếp theo: scoring + game completion</small>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <section className="card">
        <div className="badge">THOC SOFTWARE</div>
        <h1>PICKLEBALL REFEREE</h1>
        <p>Ứng dụng hỗ trợ trọng tài điều hành trận đấu Pickleball.</p>
        <div className="status"><span></span> Hệ thống đã chạy thành công</div>
        <button onClick={() => setScreen('setup')}>TẠO TRẬN ĐẤU</button>
        <small>Runnable V1 · Core Match</small>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
