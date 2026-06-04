import './ApStatusBadge.css'

/**
 * 支线任务 2：右上 AP 状态盘（粗框圆牌），数据来自 gameState.actionPoints。
 *
 * @param {{
 *   actionPoints: number
 *   maxActionPoints: number
 *   turnLine: string
 *   isMyTurn: boolean
 * }} props
 */
export default function ApStatusBadge({
  actionPoints,
  maxActionPoints,
  turnLine,
  isMyTurn,
}) {
  return (
    <div
      className={`ap-status-badge${isMyTurn ? ' ap-status-badge--my-turn' : ''}`}
      role="status"
      aria-label={`${turnLine}. Action points ${actionPoints} of ${maxActionPoints}`}
    >
      <span className="ap-status-badge__turn">{turnLine}</span>
      <span className="ap-status-badge__value" aria-hidden="false">
        {actionPoints}/{maxActionPoints}
      </span>
      <span className="ap-status-badge__label">AP</span>
    </div>
  )
}
