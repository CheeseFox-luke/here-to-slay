/**
 * demoRoom — Demo 房间数据工厂（无网络层）
 *
 * 职责：生成/拼装 Lobby 与 App 用的 RoomInfo，不持久化、不同步多人。
 *
 * [Requires]
 * - 无外部服务；由 App.jsx 在 Create/Join 成功后调用
 *
 * [Provides]
 * - RoomInfo 对象给 Lobby 展示、给 App 传给 GameBoard（maxPlayers）
 *
 * [Replace later]
 * - 整文件可换为 roomApi.js + WebSocket 订阅，保留 RoomInfo 形状即可
 *
 * @typedef {Object} RoomInfo
 * @property {string} roomId
 * @property {number} currentPlayers
 * @property {number} maxPlayers
 */

/** 本地随机房间码，格式 ROOM-1000～9999；上线后改为服务端返回 */
export function generateDemoRoomCode() {
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `ROOM-${suffix}`
}

/**
 * Join 路径占位：人数写死，与输入的房间码无关。
 * @param {string} roomCode 已由 JoinRoom 校验非空
 * @returns {RoomInfo}
 */
export function createDemoRoomFromJoin(roomCode) {
  return {
    roomId: roomCode.trim(),
    currentPlayers: 1, // Demo：未接真实在线列表
    maxPlayers: 4, // Demo：Join 无法得知房主开局人数，固定 4
  }
}

/**
 * Create 路径：maxPlayers 来自 CreateRoom 下拉（2～5）。
 * @param {string} roomId 通常来自 generateDemoRoomCode()
 * @param {number} maxPlayers
 * @returns {RoomInfo}
 */
export function createDemoRoomFromCreate(roomId, maxPlayers) {
  return {
    roomId,
    currentPlayers: 1,
    maxPlayers,
  }
}
