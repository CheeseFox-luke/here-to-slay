/**
 * Lobby — 房间大厅（Demo 只读展示 + 开局按钮）
 *
 * 职责：展示 roomId / 当前人数 / 上限；Start Game 进入 GameBoard；不等待真人凑齐。
 *
 * [Requires]（由 App 注入）
 * - room: RoomInfo — 来自 demoRoom，进 Lobby 前必须已 setRoom
 * - onStartGame: () => void — App 将 screen 设为 'game'
 * - onBack: () => void — App 清空 room 并回到 create/join
 *
 * [Provides]
 * - 无；纯展示 + 按钮事件上抛
 *
 * [Replace later]
 * - room 改为订阅服务端房间状态；currentPlayers 实时更新；Start 权限给房主
 */
import './FlowScreens.css'

/**
 * @typedef {import('../room/demoRoom.js').RoomInfo} RoomInfo
 */

/**
 * @param {{
 *   room: RoomInfo
 *   onStartGame: () => void
 *   onBack: () => void
 * }} props
 */
export default function Lobby({ room, onStartGame, onBack }) {
  return (
    <div className="flow-screen">
      <h1>Lobby</h1>
      <ul className="flow-screen__info">
        <li>
          Room Code: <strong>{room.roomId}</strong>
        </li>
        <li>
          Current Players: <strong>{room.currentPlayers}</strong>
        </li>
        <li>
          Max Players: <strong>{room.maxPlayers}</strong>
        </li>
      </ul>
      <div className="flow-screen__actions">
        <button
          type="button"
          className="flow-screen__btn flow-screen__btn--primary"
          onClick={onStartGame}
        >
          Start Game
        </button>
        <button type="button" className="flow-screen__btn" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
