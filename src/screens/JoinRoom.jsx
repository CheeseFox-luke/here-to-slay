/**
 * JoinRoom — 输入房间码加入（Demo 仅校验非空）
 *
 * 职责：收集 roomCode，本地校验 trim 后非空，再交给 App；不请求服务器。
 *
 * [Requires]（由 App 注入）
 * - onJoin: (roomCode: string) => void — 已 trim 的非空字符串
 * - onBack: () => void
 *
 * [Provides]
 * - 通过 onJoin 上报房间码；后续 RoomInfo 由 demoRoom.createDemoRoomFromJoin 占位
 *
 * [Replace later]
 * - handleJoin 内增加 API 校验房间是否存在、是否已满
 */
import { useState } from 'react'
import './FlowScreens.css'

/**
 * @param {{ onJoin: (roomCode: string) => void, onBack: () => void }} props
 */
export default function JoinRoom({ onJoin, onBack }) {
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')

  function handleJoin() {
    const trimmed = roomCode.trim()
    if (!trimmed) {
      setError('Room code is required.')
      return
    }
    setError('')
    onJoin(trimmed)
  }

  return (
    <div className="flow-screen">
      <h1>Join Room</h1>
      <div className="flow-screen__field">
        <label htmlFor="room-code">Room Code</label>
        <input
          id="room-code"
          type="text"
          value={roomCode}
          placeholder="ROOM-1234"
          onChange={(e) => {
            setRoomCode(e.target.value)
            if (error) setError('')
          }}
        />
      </div>
      {error ? <p className="flow-screen__error">{error}</p> : null}
      <div className="flow-screen__actions">
        <button
          type="button"
          className="flow-screen__btn flow-screen__btn--primary"
          onClick={handleJoin}
        >
          Join
        </button>
        <button type="button" className="flow-screen__btn" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
