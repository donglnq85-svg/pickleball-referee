import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  return (
    <main className="shell">
      <section className="card">
        <div className="badge">THOC SOFTWARE</div>
        <h1>PICKLEBALL REFEREE</h1>
        <p>Ứng dụng hỗ trợ trọng tài điều hành trận đấu Pickleball.</p>
        <div className="status"><span></span> Hệ thống đã chạy thành công</div>
        <button>TẠO TRẬN ĐẤU</button>
        <small>Runnable V1 · Core Match</small>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
