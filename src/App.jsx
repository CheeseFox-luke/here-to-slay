/**
 * App — 引导流程编排器（Demo 用组件切换，无 react-router）
 *
 * 职责：Landing → Create/Join → Lobby → 挂载 GameBoard，不实现联网与对战规则。
 *
 * [Requires]
 * - main.jsx 将本组件挂到 #root
 * - screens/* 通过回调上报用户操作
 * - room/demoRoom.js 提供 Demo RoomInfo（上线后换真实房间 API）
 * - GameBoard 在 screen === 'game' 且 room 非空时渲染
 *
 * [Provides]
 * - 各 Screen 的 onXxx 回调与 room 状态
 * - GameBoard.playerCount ← room.maxPlayers
 *
 * [Replace later]
 * - demoRoom 工厂函数 → 服务端 create/join
 * - screen 状态机 → 路由或服务端推送的 phase
 */
import { useState } from 'react'
import GameBoard from './components/GameBoard.jsx'
import {
  createDemoRoomFromCreate,
  createDemoRoomFromJoin,
  generateDemoRoomCode,
} from './room/demoRoom.js'
import CreateRoom from './screens/CreateRoom.jsx'
import JoinRoom from './screens/JoinRoom.jsx'
import Lobby from './screens/Lobby.jsx'
import StartScreen from './screens/StartScreen.jsx'

/** @typedef {'start' | 'create' | 'join' | 'lobby' | 'game'} AppScreen */
/** @typedef {'create' | 'join'} LobbySource */
/** @typedef {import('./room/demoRoom.js').RoomInfo} RoomInfo */

export default function App() {
  /** 当前引导页；'game' 时改渲染 GameBoard */
  const [screen, setScreen] = useState(/** @type {AppScreen} */ ('start'))
  /** 大厅展示用房间快照；进对局后仍保留供 GameBoard 读 maxPlayers */
  const [room, setRoom] = useState(/** @type {RoomInfo | null} */ (null))
  /** Lobby 点 Back 时回到 create 或 join（Demo 无历史栈） */
  const [lobbySource, setLobbySource] = useState(
    /** @type {LobbySource} */ ('create'),
  )

  /** CreateRoom 回调：本地生成房间码并写入占位 RoomInfo */
  function handleCreateRoom(maxPlayers) {
    const roomId = generateDemoRoomCode()
    setRoom(createDemoRoomFromCreate(roomId, maxPlayers))
    setLobbySource('create')
    setScreen('lobby')
  }

  /** JoinRoom 回调：仅 trim 非空，不校验房间是否存在 */
  function handleJoinRoom(roomCode) {
    setRoom(createDemoRoomFromJoin(roomCode))
    setLobbySource('join')
    setScreen('lobby')
  }

  /** Lobby Back：丢弃 room，回到进入大厅前的 create 或 join 页 */
  function handleLobbyBack() {
    setRoom(null)
    setScreen(lobbySource === 'create' ? 'create' : 'join')
  }

  /** Lobby 回调：进入既有对局 UI；key 变化会 remount GameBoard 并重新 initGame */
  function handleStartGame() {
    setScreen('game')
  }

  // --- 渲染分支：与 Unity 按 GameState 切换 Scene 类似，此处用 if 切换“界面” ---
  if (screen === 'game' && room) {
    return <GameBoard key={room.roomId} playerCount={room.maxPlayers} />
  }

  if (screen === 'lobby' && room) {
    return (
      <Lobby
        room={room}
        onStartGame={handleStartGame}
        onBack={handleLobbyBack}
      />
    )
  }

  if (screen === 'create') {
    return (
      <CreateRoom
        onCreate={handleCreateRoom}
        onBack={() => setScreen('start')}
      />
    )
  }

  if (screen === 'join') {
    return (
      <JoinRoom
        onJoin={handleJoinRoom}
        onBack={() => setScreen('start')}
      />
    )
  }

  return (
    <StartScreen
      onCreateRoom={() => setScreen('create')}
      onJoinRoom={() => setScreen('join')}
    />
  )
}
