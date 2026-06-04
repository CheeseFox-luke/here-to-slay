import {
  ATTACK_MONSTER_AP_COST,
  DRAW_CARD_AP_COST,
  RESTOCK_HAND_AP_COST,
} from '../gameState.js'

/**
 * 固定底栏操作台：按钮 + Challenge attacker 等待文案 + 无牌红字 cue。
 * 回合/AP 等旧状态栏已移除，改在他处展示。
 *
 * @param {{
 *   mode: import('../actionConsoleHelpers.js').ActionConsoleMode
 *   challengeAttackerWaiting?: import('react').ReactNode
 *   missingCardHint?: string | null
 *   debugMode: boolean
 *   onToggleDebug: () => void
 *   canDraw: boolean
 *   canRestock: boolean
 *   canEndTurn: boolean
 *   restockLabel: string
 *   onDraw: () => void
 *   onRestock: () => void
 *   onEndTurn: () => void
 *   canConsoleChallenge: boolean
 *   canConsoleModify: boolean
 *   hasSelection: boolean
 *   onConsoleChallenge: () => void
 *   onConsoleModify: () => void
 *   onPassChallenge: () => void
 *   onPassModifierClick: () => void
 *   challengePassDisabled: boolean
 *   modifierPassDisabled: boolean
 * }} props
 */
export default function ActionConsole({
  mode,
  challengeAttackerWaiting = null,
  missingCardHint = null,
  debugMode,
  onToggleDebug,
  canDraw,
  canRestock,
  canEndTurn,
  restockLabel,
  onDraw,
  onRestock,
  onEndTurn,
  canConsoleChallenge,
  canConsoleModify,
  hasSelection,
  onConsoleChallenge,
  onConsoleModify,
  onPassChallenge,
  onPassModifierClick,
  challengePassDisabled,
  modifierPassDisabled,
}) {
  const hideMainToolbar =
    mode === 'idle' ||
    mode === 'challenge-wait' ||
    mode === 'modifier-passed'

  const debugBtn = (
    <button
      type="button"
      className={`game-actions__btn debug-toggle${debugMode ? ' debug-toggle--on' : ''}`}
      onClick={onToggleDebug}
    >
      Debug {debugMode ? 'ON' : 'OFF'}
    </button>
  )

  return (
    <div
      className={`action-console${hideMainToolbar ? ' action-console--minimal' : ''}`}
      role="toolbar"
      aria-label="Actions"
    >
      {challengeAttackerWaiting ? (
        <p className="action-console__attacker-wait">{challengeAttackerWaiting}</p>
      ) : null}
      {missingCardHint ? (
        <p className="action-console__cue" role="alert">
          {missingCardHint}
        </p>
      ) : null}

      {!hideMainToolbar ? (
        <div className="action-console__toolbar">
          <div className="action-console__actions-main">
            {mode === 'turn' && (
              <>
                <button
                  type="button"
                  className="game-actions__btn"
                  onClick={onDraw}
                  disabled={!canDraw}
                  title={`Costs ${DRAW_CARD_AP_COST} AP`}
                >
                  Draw ({DRAW_CARD_AP_COST} AP)
                </button>
                <button
                  type="button"
                  className="game-actions__btn game-actions__btn--placeholder"
                  disabled
                  title="Coming soon (req 5)"
                >
                  Play ({DRAW_CARD_AP_COST} AP)
                </button>
                <button
                  type="button"
                  className="game-actions__btn game-actions__btn--placeholder"
                  disabled
                  title="Coming soon"
                >
                  Slay ({ATTACK_MONSTER_AP_COST} AP)
                </button>
                <button
                  type="button"
                  className="game-actions__btn"
                  onClick={onRestock}
                  disabled={!canRestock}
                  title={`Costs ${RESTOCK_HAND_AP_COST} AP`}
                >
                  {restockLabel} ({RESTOCK_HAND_AP_COST} AP)
                </button>
                <button
                  type="button"
                  className="game-actions__btn game-actions__btn--primary"
                  onClick={onEndTurn}
                  disabled={!canEndTurn}
                >
                  End turn
                </button>
              </>
            )}

            {mode === 'challenge-respond' && (
              <>
                <button
                  type="button"
                  className="game-actions__btn game-actions__btn--primary"
                  onClick={onConsoleChallenge}
                  disabled={!canConsoleChallenge || !hasSelection}
                  title={
                    hasSelection
                      ? 'Play selected Challenge card'
                      : 'Select a Challenge card in your hand first'
                  }
                >
                  Challenge
                </button>
                <button
                  type="button"
                  className="game-actions__btn"
                  onClick={onPassChallenge}
                  disabled={challengePassDisabled}
                >
                  Pass
                </button>
              </>
            )}

            {mode === 'modifier-respond' && (
              <>
                <button
                  type="button"
                  className="game-actions__btn game-actions__btn--primary"
                  onClick={onConsoleModify}
                  disabled={!canConsoleModify || !hasSelection}
                  title={
                    hasSelection
                      ? 'Play selected Modifier card'
                      : 'Select a Modifier card in your hand first'
                  }
                >
                  Modify
                </button>
                <button
                  type="button"
                  className="game-actions__btn"
                  onClick={onPassModifierClick}
                  disabled={modifierPassDisabled}
                >
                  {modifierPassDisabled ? 'Passed' : 'Pass'}
                </button>
              </>
            )}
          </div>

          <div className="action-console__actions-debug">{debugBtn}</div>
        </div>
      ) : (
        <div className="action-console__actions-debug action-console__actions-debug--solo">
          {debugBtn}
        </div>
      )}
    </div>
  )
}
