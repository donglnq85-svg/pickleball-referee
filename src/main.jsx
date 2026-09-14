import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const initialConfig = {
  team1: 'ĐỘI 1',
  team2: 'ĐỘI 2',
  target: 11,
  winBy: 2,
}

function App() {
  const [screen, setScreen] = useState('home')
  const [config, setConfig] = useState(initialConfig)
  const [score, setScore] = useState([0, 0])
  const [games, setGames] = useState([0, 0])
  const [serving, setServing] = useState(0)
  const [gameNumber, setGameNumber] = useState(1)
  const [history, setHistory] = useState([])
  const [completedGames, setCompletedGames] = useState([])

  const gameWinner = useMemo(() => {
    const [a, b] = score
    if (a >= config.target && a - b >= config.winBy) return 0
    if (b >= config.target && b - a >= config.winBy) return 1
    return null
  }, [score, config])

  const pushHistory = () => {
    setHistory((prev) => [
      ...prev,
      { score: [...score], games: [...games], serving, gameNumber, completedGames: [...completedGames] },
    ])
  }

  const startMatch = () => {
    setScore([0, 0])
    setGames([0, 0])
    setServing(0)
    setGameNumber(1)
    setHistory([])
    setCompletedGames([])
    setScreen('match')
  }

  const addPoint = (side) => {
    if (gameWinner !== null) return
    pushHistory()
    setScore((prev) => prev.map((value, index) => (index === side ? value + 1 : value)))
  }

  const changeServe = () => {
    pushHistory()
    setServing((prev) => (prev === 0 ? 1 : 0))
  }

  const undo = () => {
    const last = history.at(-1)
    if (!last) return
    setScore(last.score)
    setGames(last.games)
    setServing(last.serving)
    setGameNumber(last.gameNumber)
    setCompletedGames(last.completedGames)
    setHistory((prev) => prev.slice(0, -1))
  }

  const completeGame = () => {
    if (gameWinner === null) return
    pushHistory()
    const nextGames = games.map((value, index) => (index === gameWinner ? value + 1 : value))
    setGames(nextGames)
    setCompletedGames((prev) => [
      ...prev,
      { game: gameNumber, score: [...score], winner: gameWinner },
    ])
    setScore([0, 0])
    setServing(gameWinner)
    setGameNumber((prev) => prev + 1)
  }

  const finishMatch = () => {
    if (games[0] === games[1]) return
    setScreen('complete')
  }

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
              <input value={config.team1} onChange={(e) => setConfig({ ...config, team1: e.target.value })} />
            </label>
            <label>
              Đội 2
              <input value={config.team2} onChange={(e) => setConfig({ ...config, team2: e.target.value })} />
            </label>
            <label>
              Điểm thắng game
              <select value={config.target} onChange={(e) => setConfig({ ...config, target: Number(e.target.value) })}>
                <option value="11">11 điểm</option>
                <option value="15">15 điểm</option>
                <option value="21">21 điểm</option>
              </select>
            </label>
            <label>
              Thắng cách biệt
              <select value={config.winBy} onChange={(e) => setConfig({ ...config, winBy: Number(e.target.value) })}>
                <option value="2">2 điểm</option>
              </select>
            </label>
          </div>

          <button onClick={startMatch}>BẮT ĐẦU TRẬN ĐẤU</button>
          <button className="secondary" onClick={() => setScreen('home')}>QUAY LẠI</button>
        </section>
      </main>
    )
  }

  if (screen === 'match') {
    return (
      <main className="shell">
        <section className="card match-card">
          <div className="topline">
            <div className="badge">TRẬN ĐẤU ĐANG DIỄN RA</div>
            <div className="game-label">GAME {gameNumber}</div>
          </div>

          <div className="games-strip">
            <span>GAME: {games[0]}</span>
            <strong>—</strong>
            <span>{games[1]}</span>
          </div>

          <div className="scoreboard">
            <div className={`team ${serving === 0 ? 'serving' : ''}`}>
              <div className="serve-chip">{serving === 0 ? 'ĐANG GIAO BÓNG' : 'NHẬN BÓNG'}</div>
              <div className="team-name">{config.team1 || 'ĐỘI 1'}</div>
              <div className="score">{score[0]}</div>
              <button disabled={gameWinner !== null} onClick={() => addPoint(0)}>+ ĐIỂM ĐỘI 1</button>
            </div>

            <div className="dash">—</div>

            <div className={`team ${serving === 1 ? 'serving' : ''}`}>
              <div className="serve-chip">{serving === 1 ? 'ĐANG GIAO BÓNG' : 'NHẬN BÓNG'}</div>
              <div className="team-name">{config.team2 || 'ĐỘI 2'}</div>
              <div className="score">{score[1]}</div>
              <button disabled={gameWinner !== null} onClick={() => addPoint(1)}>+ ĐIỂM ĐỘI 2</button>
            </div>
          </div>

          <div className="meta">
            <span className="pill">Mục tiêu {config.target}</span>
            <span className="pill">Cách biệt {config.winBy}</span>
            <span className="pill">IN_PROGRESS</span>
          </div>

          {gameWinner !== null && (
            <div className="game-ready">
              <strong>{gameWinner === 0 ? config.team1 : config.team2} đủ điều kiện thắng game</strong>
              <span>{score[0]} — {score[1]}</span>
              <button className="success" onClick={completeGame}>XÁC NHẬN KẾT THÚC GAME</button>
            </div>
          )}

          <div className="control-grid">
            <button className="secondary" onClick={changeServe}>ĐỔI QUYỀN GIAO BÓNG</button>
            <button className="secondary" disabled={!history.length} onClick={undo}>HOÀN TÁC</button>
          </div>

          {completedGames.length > 0 && (
            <div className="game-history">
              {completedGames.map((item) => (
                <div key={item.game}>
                  <span>Game {item.game}</span>
                  <strong>{item.score[0]} — {item.score[1]}</strong>
                </div>
              ))}
            </div>
          )}

          <button className="danger" disabled={games[0] === games[1]} onClick={finishMatch}>KẾT THÚC TRẬN ĐẤU</button>
          <small>Scoring đang ở chế độ điều khiển thủ công; luật giao bóng chi tiết sẽ được gắn vào Match Engine sau.</small>
        </section>
      </main>
    )
  }

  if (screen === 'complete') {
    const winner = games[0] > games[1] ? 0 : 1
    return (
      <main className="shell">
        <section className="card">
          <div className="badge">HOÀN TẤT</div>
          <h1>KẾT THÚC TRẬN ĐẤU</h1>
          <p className="winner">{winner === 0 ? config.team1 : config.team2} thắng trận</p>
          <div className="final-score">{games[0]} — {games[1]}</div>
          <button onClick={() => setScreen('home')}>VỀ TRANG ĐẦU</button>
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
