/**
 * CreateRoom — 房主创建房间（选人数）
 *
 * 职责：选择 2～5 人，点 Create 把 maxPlayers 交给上层；不生成房间码（由 demoRoom/App 做）。
 *
 * [Requires]（由 App 注入）
 * - onCreate: (maxPlayers: number) => void
 * - onBack: () => void — 回首页
 *
 * [Provides]
 * - maxPlayers（2|3|4|5）给 App → createDemoRoomFromCreate
 *
 * [Depends]
 * - initGame(playerCount) 在 gameState 支持 1～6；此处 UI 限制为 2～5 与需求一致
 */
import { useState } from 'react'
import './FlowScreens.css'

/** 与产品需求一致；改选项时需同步 gameState.initGame 上限说明 */
const PLAYER_COUNT_OPTIONS = [2, 3, 4, 5]

/**
 * @param {{ onCreate: (maxPlayers: number) => void, onBack: () => void }} props
 */
export default function CreateRoom({ onCreate, onBack }) {
  const [maxPlayers, setMaxPlayers] = useState(3)

  return (
    <div className="flow-screen">
      <h1>Create Room</h1>
      <div className="flow-screen__field">
        <label htmlFor="player-count">Player Count</label>
        <select
          id="player-count"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
        >
          {PLAYER_COUNT_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>
      <div className="flow-screen__actions">
        <button
          type="button"
          className="flow-screen__btn flow-screen__btn--primary"
          onClick={() => onCreate(maxPlayers)}
        >
          Create
        </button>
        <button type="button" className="flow-screen__btn" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
