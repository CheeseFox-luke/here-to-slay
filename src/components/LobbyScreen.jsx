import { useState } from 'react'
import { generateRoomCode, saveRoomConfig } from '../roomSync.js'
import './LobbyScreen.css'

function LobbyScreen() {
  const [playerCount, setPlayerCount] = useState(3)
  const [roomCode, setRoomCode] = useState(null)
  const [links, setLinks] = useState([])
  const [copied, setCopied] = useState({})

  function handleCreateRoom() {
    const code = generateRoomCode()
    saveRoomConfig(code, { playerCount })
    const base = `${window.location.origin}${window.location.pathname}`
    const generated = Array.from({ length: playerCount }, (_, i) =>
      `${base}?room=${code}&seat=${i}`
    )
    setRoomCode(code)
    setLinks(generated)
    setCopied({})
  }

  function handleCopy(link, index) {
    navigator.clipboard.writeText(link).then(() => {
      setCopied((prev) => ({ ...prev, [index]: true }))
      setTimeout(() => {
        setCopied((prev) => ({ ...prev, [index]: false }))
      }, 1500)
    })
  }

  return (
    <div className="lobby">
      <h1 className="lobby__title">Here to Slay</h1>

      <div className="lobby__card">
        <div>
          <p className="lobby__label">Number of players</p>
          <div className="lobby__player-btns">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`lobby__player-btn${playerCount === n ? ' lobby__player-btn--active' : ''}`}
                onClick={() => setPlayerCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="lobby__create-btn" onClick={handleCreateRoom}>
          Create Room
        </button>

        {roomCode && (
          <>
            <p className="lobby__room-code">
              Room code: <strong>{roomCode}</strong>
            </p>

            <div className="lobby__links">
              {links.map((link, i) => (
                <div key={i} className="lobby__link-row">
                  <span className="lobby__link-label">Player {i + 1}</span>
                  <div className="lobby__link-input-row">
                    <input
                      type="text"
                      readOnly
                      value={link}
                      className="lobby__link-input"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      className={`lobby__copy-btn${copied[i] ? ' lobby__copy-btn--copied' : ''}`}
                      onClick={() => handleCopy(link, i)}
                    >
                      {copied[i] ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="lobby__enter-btn"
              onClick={() => { window.location.href = links[0] }}
            >
              Enter as Player 1 →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default LobbyScreen
