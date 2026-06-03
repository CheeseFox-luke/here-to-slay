/**
 * StartScreen — 首页（Landing）
 *
 * 职责：仅提供 Create Room / Join Room 两个入口，无业务状态。
 *
 * [Requires]（由 App 注入）
 * - onCreateRoom: () => void — 切到创建房间页
 * - onJoinRoom: () => void — 切到加入房间页
 *
 * [Provides]
 * - 用户点击意图（通过回调上报，自身不持有 room）
 *
 * [Depends]
 * - FlowScreens.css（布局与按钮样式）
 * - index.css 中的 CSS 变量（--text-h, --accent 等）
 */
import './FlowScreens.css'

/**
 * @param {{ onCreateRoom: () => void, onJoinRoom: () => void }} props
 */
export default function StartScreen({ onCreateRoom, onJoinRoom }) {
  return (
    <div className="flow-screen">
      <h1>Here to Slay</h1>
      <p className="flow-screen__subtitle">Web Demo</p>
      <div className="flow-screen__actions">
        <button
          type="button"
          className="flow-screen__btn flow-screen__btn--primary"
          onClick={onCreateRoom}
        >
          Create Room
        </button>
        <button type="button" className="flow-screen__btn" onClick={onJoinRoom}>
          Join Room
        </button>
      </div>
    </div>
  )
}
