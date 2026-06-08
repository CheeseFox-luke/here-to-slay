export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)]
  return c
}

export function getRoomParams() {
  if (typeof window === 'undefined') return { room: null, seat: null }
  const p = new URLSearchParams(window.location.search)
  const room = p.get('room')
  const seatRaw = p.get('seat')
  const seat = seatRaw !== null ? parseInt(seatRaw, 10) : null
  return { room, seat: Number.isNaN(seat) ? null : seat }
}

const roomKey = (code) => `hts_room_${code}`
export function saveRoomConfig(code, config) { try { localStorage.setItem(roomKey(code), JSON.stringify(config)) } catch {} }
export function loadRoomConfig(code) { try { const r = localStorage.getItem(roomKey(code)); return r ? JSON.parse(r) : null } catch { return null } }

// Game state persistence — localStorage for host reconnect fallback / page refreshes
const gameStateKey = (code) => `hts_gamestate_${code}`
export function saveGameState(code, game) {
  try { localStorage.setItem(gameStateKey(code), JSON.stringify(game)) } catch {}
}
export function loadGameState(code) {
  try {
    const raw = localStorage.getItem(gameStateKey(code))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/**
 * Connect to the WebSocket relay server for a given room.
 *
 * @param {string} roomCode
 * @param {(state: object) => void} onState - called when a STATE message arrives from the server
 * @param {() => object | null} getLocalState - called on connect; if non-null result, pushes initial state to server
 * @returns {{ send: (state: object) => void, disconnect: () => void }}
 */
export function connectToRoom(roomCode, onState, getLocalState) {
  let ws = null
  let intentionalClose = false

  function buildUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${location.host}/ws`
  }

  function connect() {
    ws = new WebSocket(buildUrl())

    ws.addEventListener('open', () => {
      // Announce which room we're joining
      ws.send(JSON.stringify({ type: 'JOIN', roomCode }))

      // If we have local state (e.g. host), push it so the server caches it
      const localState = getLocalState()
      if (localState !== null) {
        ws.send(JSON.stringify({ type: 'UPDATE', roomCode, state: localState }))
      }
    })

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'STATE') {
          onState(msg.state)
        }
      } catch {}
    })

    ws.addEventListener('close', () => {
      if (!intentionalClose) {
        setTimeout(connect, 2000)
      }
    })

    ws.addEventListener('error', () => {
      // Will trigger close, which handles reconnect
    })
  }

  connect()

  return {
    send(state) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'UPDATE', roomCode, state }))
      }
    },
    disconnect() {
      intentionalClose = true
      if (ws) ws.close()
    },
  }
}
