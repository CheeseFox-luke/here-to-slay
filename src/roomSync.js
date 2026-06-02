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
export function openRoomChannel(code) { if (typeof BroadcastChannel === 'undefined') return null; return new BroadcastChannel(`hts_game_${code}`) }

// Game state persistence — all tabs read/write to the same localStorage key.
// BroadcastChannel only sends a lightweight "STATE_CHANGED" signal, not the full state.
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
