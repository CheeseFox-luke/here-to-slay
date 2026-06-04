import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LobbyScreen from './components/LobbyScreen.jsx'
import { getRoomParams, loadRoomConfig } from './roomSync.js'

const { room, seat } = getRoomParams()

let rootEl
if (room !== null && seat !== null) {
  const config = loadRoomConfig(room)
  const playerCount = config?.playerCount ?? 3
  rootEl = <App roomCode={room} mySeat={seat} playerCount={playerCount} />
} else {
  rootEl = <LobbyScreen />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>{rootEl}</StrictMode>
)
