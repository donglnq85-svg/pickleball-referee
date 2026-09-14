import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const SUPABASE_URL = 'https://brlyzsprmaxxgqotglmt.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybHl6c3BybWF4eGdxb3RnbG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTgwNzQsImV4cCI6MjEwNDk3NDA3NH0.R9jMX2UwH2G9GEuGezrtSAADAn0wg0ei6Ddu3aNLxYY'

const initialConfig = {
  team1: 'ĐỘI 1',
  team2: 'ĐỘI 2',
  target: 11,
  winBy: 2,
}

const defaultPlayers = [
  ['Nguyễn Văn Nam', 'Trần Hoàng Minh'],
  ['Lê Quốc Hùng', 'Phạm Anh Tuấn'],
]

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Supabase request failed: ${response.status}`)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

function App() {
  const [screen, setScreen] = useState('home')
  const [config, setConfig] = useState(initialConfig)
  const [score, setScore] = useState([0, 0])
  const [games, setGames] = useState([0, 0])
  const [serving, setServing] = useState(0)
  const [serverNumber, setServerNumber] = useState(1)
  const [gameNumber, setGameNumber] = useState(1)
  const [history, setHistory] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [completedGames, setCompletedGames] = useState([])
  const [matchId, setMatchId] = useState(null)
  const [syncStatus, setSyncStatus] = useState('ĐANG KIỂM TRA DỮ LIỆU')
  const [timeouts, setTimeouts] = useState([[1, 1], [1, 1]])

  const gameWinner = useMemo(() => {
    const [a, b] = score
    if (a >= config.target && a - b >= config.winBy) return 0
    if (b >= config.target && b - a >= config.winBy) return 1
    return null
  }, [score, config])

  const currentSnapshot = () => ({
    score: [...score],
    games: [...games],
    serving,
    serverNumber,
    gameNumber,
    completedGames: [...completedGames],
  })

  const restoreSnapshot = (snapshot) => {
    setScore(snapshot.score)
    setGames(snapshot.games)
    setServing(snapshot.serving)
    setServerNumber(snapshot.serverNumber || 1)
    setGameNumber(snapshot.gameNumber)
    setCompletedGames(snapshot.completedGames)
  }

  const recordEvent = async (eventType, payload = {}, snapshot = currentSnapshot()) => {
    if (!matchId) return
    try {
      await supabaseRequest('/rest/v1/match_events', {
        method: 'POST',
        body: JSON.stringify({
          match_id: matchId,
          event_type: eventType,
          payload,
          snapshot,
        }),
      })
    } catch (error) {
      console.error('Event log error', error)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function restoreActiveMatch() {
      try {
        const rows = await supabaseRequest('/rest/v1/matches?status=eq.IN_PROGRESS&order=updated_at.desc&limit=1')
        if (cancelled) return

        if (rows?.length) {
          const match = rows[0]
          setConfig({
            team1: match.team1,
            team2: match.team2,
            target: match.target,
            winBy: match.win_by,
          })
          setScore([match.score1, match.score2])
          setGames([match.games1, match.games2])
          setServing(match.serving)
          setGameNumber(match.game_number)
          setCompletedGames(Array.isArray(match.completed_games) ? match.completed_games : [])
          setHistory(Array.isArray(match.history) ? match.history : [])
          setMatchId(match.id)
          setScreen('match')
          setSyncStatus('ĐÃ KHÔI PHỤC TRẬN ĐANG DIỄN RA')
        } else {
          setSyncStatus('SẴN SÀNG')
        }
      } catch (error) {
        console.error(error)
        if (!cancelled) setSyncStatus('CHƯA KẾT NỐI DỮ LIỆU')
      }
    }

    restoreActiveMatch()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!matchId || screen !== 'match') return

    const timer = setTimeout(async () => {
      try {
        setSyncStatus('ĐANG LƯU')
        await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            team1: config.team1,
            team2: config.team2,
            target: config.target,
            win_by: config.winBy,
            score1: score[0],
            score2: score[1],
            games1: games[0],
            games2: games[1],
            serving,
            game_number: gameNumber,
            completed_games: completedGames,
            history,
            updated_at: new Date().toISOString(),
          }),
        })
        setSyncStatus('ĐÃ LƯU')
      } catch (error) {
        console.error(error)
        setSyncStatus('LỖI LƯU DỮ LIỆU')
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [matchId, screen, config, score, games, serving, gameNumber, completedGames, history])

  const pushHistory = () => {
    const snapshot = currentSnapshot()
    setHistory((prev) => [...prev, snapshot].slice(-100))
    setRedoStack([])
    return snapshot
  }

  const startMatch = async () => {
    try {
      setSyncStatus('ĐANG TẠO TRẬN')
      const rows = await supabaseRequest('/rest/v1/matches', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          team1: config.team1 || 'ĐỘI 1',
          team2: config.team2 || 'ĐỘI 2',
          target: config.target,
          win_by: config.winBy,
          score1: 0,
          score2: 0,
          games1: 0,
          games2: 0,
          serving: 0,
          game_number: 1,
          completed_games: [],
          history: [],
          status: 'IN_PROGRESS',
        }),
      })

      const id = rows?.[0]?.id || null
      setScore([0, 0])
      setGames([0, 0])
      setServing(0)
      setServerNumber(1)
      setGameNumber(1)
      setHistory([])
      setRedoStack([])
      setCompletedGames([])
      setMatchId(id)
      setScreen('match')
      setSyncStatus('ĐÃ LƯU')

      if (id) {
        await supabaseRequest('/rest/v1/match_events', {
          method: 'POST',
          body: JSON.stringify({
            match_id: id,
            event_type: 'MATCH_STARTED',
            payload: { target: config.target, winBy: config.winBy },
            snapshot: { score: [0, 0], games: [0, 0], serving: 0, gameNumber: 1, completedGames: [] },
          }),
        })
      }
    } catch (error) {
      console.error(error)
      setSyncStatus('LỖI TẠO TRẬN')
    }
  }

  const addPoint = (side) => {
    if (gameWinner !== null) return
    const before = pushHistory()
    const nextScore = score.map((value, index) => (index === side ? value + 1 : value))
    setScore(nextScore)
    void recordEvent('POINT_ADDED', { side }, { ...before, score: nextScore })
  }

  const changeServe = () => {
    const before = pushHistory()
    const nextServing = serving === 0 ? 1 : 0
    setServing(nextServing)
    setServerNumber(1)
    void recordEvent('SERVE_CHANGED', { from: serving, to: nextServing }, { ...before, serving: nextServing })
  }

  const undo = () => {
    const last = history.at(-1)
    if (!last) return
    const beforeUndo = currentSnapshot()
    setRedoStack((prev) => [...prev, beforeUndo].slice(-100))
    restoreSnapshot(last)
    setHistory((prev) => prev.slice(0, -1))
    void recordEvent('UNDO_APPLIED', { revertedFrom: beforeUndo }, last)
  }

  const redo = () => {
    const next = redoStack.at(-1)
    if (!next) return
    const beforeRedo = currentSnapshot()
    setHistory((prev) => [...prev, beforeRedo].slice(-100))
    restoreSnapshot(next)
    setRedoStack((prev) => prev.slice(0, -1))
    void recordEvent('REDO_APPLIED', { restoredTo: next }, next)
  }

  const useTimeout = (team, type) => {
    setTimeouts((prev) => {
      const next = prev.map((row) => [...row])
      if (next[team][type] > 0) next[team][type] -= 1
      return next
    })
  }

  const completeGame = () => {
    if (gameWinner === null) return
    const before = pushHistory()
    const nextGames = games.map((value, index) => (index === gameWinner ? value + 1 : value))
    const nextCompleted = [...completedGames, { game: gameNumber, score: [...score], winner: gameWinner }]
    const nextGameNumber = gameNumber + 1

    setGames(nextGames)
    setCompletedGames(nextCompleted)
    setScore([0, 0])
    setServing(gameWinner)
    setServerNumber(1)
    setGameNumber(nextGameNumber)

    void recordEvent('GAME_COMPLETED', { winner: gameWinner, completedScore: [...score] }, {
      ...before,
      score: [0, 0],
      games: nextGames,
      serving: gameWinner,
      gameNumber: nextGameNumber,
      completedGames: nextCompleted,
    })
  }

  const finishMatch = async () => {
    if (games[0] === games[1]) return
    if (matchId) {
      try {
        setSyncStatus('ĐANG HOÀN TẤT')
        await recordEvent('MATCH_COMPLETED', { winner: games[0] > games[1] ? 0 : 1 })
        await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            score1: score[0], score2: score[1], games1: games[0], games2: games[1], serving,
            game_number: gameNumber, completed_games: completedGames, history, status: 'COMPLETED',
            updated_at: new Date().toISOString(),
          }),
        })
        setSyncStatus('ĐÃ HOÀN TẤT')
      } catch (error) {
        console.error(error)
        setSyncStatus('LỖI HOÀN TẤT')
        return
      }
    }
    setScreen('complete')
  }

  const startNewMatch = () => {
    setMatchId(null)
    setScore([0, 0])
    setGames([0, 0])
    setServing(0)
    setServerNumber(1)
    setGameNumber(1)
    setHistory([])
    setRedoStack([])
    setCompletedGames([])
    setSyncStatus('SẴN SÀNG')
    setScreen('home')
  }

  if (screen === 'setup') {
    return (
      <main className="shell dark-shell">
        <section className="card setup-card">
          <div className="badge">CORE MATCH</div>
          <h1>TẠO TRẬN ĐẤU</h1>
          <p>Thiết lập trận đấu mới để bắt đầu luồng trọng tài.</p>
          <div className="form-grid">
            <label>Đội 1<input value={config.team1} onChange={(e) => setConfig({ ...config, team1: e.target.value })} /></label>
            <label>Đội 2<input value={config.team2} onChange={(e) => setConfig({ ...config, team2: e.target.value })} /></label>
            <label>Điểm thắng game<select value={config.target} onChange={(e) => setConfig({ ...config, target: Number(e.target.value) })}><option value="11">11 điểm</option><option value="15">15 điểm</option><option value="21">21 điểm</option></select></label>
            <label>Thắng cách biệt<select value={config.winBy} onChange={(e) => setConfig({ ...config, winBy: Number(e.target.value) })}><option value="2">2 điểm</option></select></label>
          </div>
          <button onClick={startMatch}>BẮT ĐẦU TRẬN ĐẤU</button>
          <button className="secondary" onClick={() => setScreen('home')}>QUAY LẠI</button>
          <small>{syncStatus}</small>
        </section>
      </main>
    )
  }

  if (screen === 'match') {
    const team1Name = config.team1 || 'ĐỘI 1'
    const team2Name = config.team2 || 'ĐỘI 2'
    const setLabel = `SET ${Math.min(gameNumber, 3)}/3`

    return (
      <main className="referee-page">
        <div className="phone-canvas">
          <header className="ref-header">
            <button className="header-action exit" onClick={() => setScreen('home')}><span>‹</span> Thoát trận</button>
            <div className="brand">
              <div className="brand-ball">●</div>
              <div><strong>PICKLEBALL</strong><b>REFEREE</b><small>TRỌNG TÀI TRONG TAY BẠN</small></div>
            </div>
            <button className="header-action options" onClick={changeServe}><span>⚙</span> Tùy chọn</button>
          </header>

          <section className="score-hero">
            <div className="hero-card green-card"><span>ĐIỂM ĐỘI GIAO</span><strong>{score[serving]}</strong><small>{serving === 0 ? team1Name : team2Name}</small></div>
            <div className="hero-card blue-card"><span>ĐIỂM ĐỘI NHẬN</span><strong>{score[serving === 0 ? 1 : 0]}</strong><small>{serving === 0 ? team2Name : team1Name}</small></div>
            <div className="hero-card yellow-card"><span>LƯỢT GIAO</span><strong>{serverNumber}</strong></div>
          </section>

          <section className="set-row">
            <div className="team-tab"><i className="dot green-dot" />{team1Name}</div>
            <div className="set-center"><b>{setLabel}</b><strong>{games[0]} <span>-</span> {games[1]}</strong></div>
            <div className="team-tab">{team2Name}<i className="dot blue-dot" /></div>
          </section>

          <section className="roster-row">
            <div className="roster-card left"><i className="dot green-dot" /><div><span>{defaultPlayers[0][0]}</span><span>{defaultPlayers[0][1]}</span></div><b>›</b></div>
            <div className="roster-card right"><i className="dot blue-dot" /><div><span>{defaultPlayers[1][0]}</span><span>{defaultPlayers[1][1]}</span></div><b>›</b></div>
          </section>

          <section className="court" aria-label="Sơ đồ sân">
            <div className="court-side court-green">
              <div className="player-box top"><span className="player-number">2</span><p>{defaultPlayers[0][0]}</p></div>
              <div className="player-box bottom active-player"><span className="player-number">1</span><p>{defaultPlayers[0][1]}</p>{serving === 0 && <span className="ball">●</span>}</div>
            </div>
            <div className="kitchen left-kitchen" />
            <div className="net"><span /><span /><span /><span /><span /><span /><span /></div>
            <div className="kitchen right-kitchen" />
            <div className="court-side court-blue">
              <div className="player-box top"><span className="player-number">1</span><p>{defaultPlayers[1][0]}</p>{serving === 1 && <span className="ball">●</span>}</div>
              <div className="player-box bottom"><span className="player-number">2</span><p>{defaultPlayers[1][1]}</p></div>
            </div>
            <div className={`serve-arrow ${serving === 1 ? 'reverse' : ''}`}>➜</div>
          </section>

          <section className="point-actions">
            <button className="point-button team1-point" disabled={gameWinner !== null} onClick={() => addPoint(0)}>＋ <strong>ĐIỂM</strong><span>{team1Name}</span></button>
            <button className="point-button team2-point" disabled={gameWinner !== null} onClick={() => addPoint(1)}>＋ <strong>ĐIỂM</strong><span>{team2Name}</span></button>
          </section>

          <section className="undo-row">
            <button disabled={!history.length} onClick={undo}><span>↶</span> HOÀN TÁC</button>
            <button disabled={!redoStack.length} onClick={redo}><span>↷</span> LÀM LẠI</button>
          </section>

          {gameWinner !== null && (
            <section className="game-ready compact-ready">
              <strong>{gameWinner === 0 ? team1Name : team2Name} đủ điều kiện thắng game</strong>
              <button className="success" onClick={completeGame}>XÁC NHẬN KẾT THÚC GAME</button>
            </section>
          )}

          <section className="timeouts-grid">
            {[0, 1].map((team) => (
              <div className={`timeout-card ${team === 0 ? 'team-green' : 'team-blue'}`} key={team}>
                <h3>{team === 0 ? team1Name : team2Name}</h3>
                <div className="timeout-options">
                  <button onClick={() => useTimeout(team, 0)} disabled={!timeouts[team][0]}><span className="timer-icon">⏱</span><div><b>Time-out</b><small>1 phút</small><em>{timeouts[team][0] ? `Còn ${timeouts[team][0]}` : 'Đã dùng'}</em></div></button>
                  <button onClick={() => useTimeout(team, 1)} disabled={!timeouts[team][1]}><span className="medical-icon">✚</span><div><b>Y tế</b><small>3 phút</small><em>{timeouts[team][1] ? `Còn ${timeouts[team][1]}` : 'Đã dùng'}</em></div></button>
                </div>
              </div>
            ))}
          </section>

          <section className="ref-tip"><span>💡</span><div><b>Mẹo trọng tài</b><p>Luôn kiểm tra vị trí VĐV và người giao bóng trước mỗi lượt.</p></div></section>
          <div className="sync-foot"><span className="sync-dot" />{syncStatus}</div>
          {completedGames.length > 0 && <button className="finish-link" disabled={games[0] === games[1]} onClick={finishMatch}>KẾT THÚC TRẬN ĐẤU</button>}
        </div>
      </main>
    )
  }

  if (screen === 'complete') {
    const winner = games[0] > games[1] ? 0 : 1
    return (
      <main className="shell dark-shell"><section className="card"><div className="badge">HOÀN TẤT</div><h1>KẾT THÚC TRẬN ĐẤU</h1><p className="winner">{winner === 0 ? config.team1 : config.team2} thắng trận</p><div className="final-score">{games[0]} — {games[1]}</div><div className="sync-line"><span className="sync-dot" /> {syncStatus}</div><button onClick={startNewMatch}>VỀ TRANG ĐẦU</button></section></main>
    )
  }

  return (
    <main className="shell dark-shell"><section className="card"><div className="badge">THOC SOFTWARE</div><h1>PICKLEBALL REFEREE</h1><p>Ứng dụng hỗ trợ trọng tài điều hành trận đấu Pickleball.</p><div className="status"><span /> Hệ thống đã chạy thành công</div><button onClick={() => setScreen('setup')}>TẠO TRẬN ĐẤU</button><small>{syncStatus}</small></section></main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
