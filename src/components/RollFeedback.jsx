import './RollFeedback.css'

/**
 * @param {import('../gameState.js').ChallengeRollSide} side
 */
function ChallengeSideRoll({ label, side }) {
  const adjusted = side.currentSum !== side.baseSum

  return (
    <div className="roll-feedback__challenge-side">
      <p className="roll-feedback__challenge-name">{label}</p>
      <p className="roll-feedback__dice">
        <strong>{side.d1}</strong> + <strong>{side.d2}</strong>
        {' = '}
        <strong className="roll-feedback__sum">{side.currentSum}</strong>
        {adjusted && (
          <span className="roll-feedback__base"> (rolled {side.baseSum})</span>
        )}
      </p>
      {side.modifierLabels.length > 0 && (
        <ul className="roll-feedback__modifiers roll-feedback__modifiers--inline">
          {side.modifierLabels.map((labelText, index) => (
            <li key={`${labelText}-${index}`}>{labelText}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * @param {{
 *   pendingRoll: import('../gameState.js').PendingRoll | null
 *   modifierPhaseActive?: boolean
 *   challengePhaseActive?: boolean
 *   secondsLeft?: number
 *   attackerName?: string
 *   challengerName?: string
 * }} props
 */
function RollFeedback({
  pendingRoll,
  modifierPhaseActive = false,
  challengePhaseActive = false,
  secondsLeft = 0,
  attackerName = 'Attacker',
  challengerName = 'Challenger',
}) {
  if (!pendingRoll) {
    if (challengePhaseActive && !modifierPhaseActive) {
      return (
        <div
          className="roll-feedback roll-feedback--challenge-window"
          role="status"
          aria-live="polite"
        >
          <p className="roll-feedback__timer">
            Opponents may play a Challenge, or Pass ({secondsLeft}s)
          </p>
        </div>
      )
    }
    return null
  }

  if (pendingRoll.rollType === 'challenge') {
    const attackerRoll = pendingRoll.attackerRoll
    const challengerRoll = pendingRoll.challengerRoll

    if (!attackerRoll || !challengerRoll) {
      return null
    }

    return (
      <div
        className={`roll-feedback roll-feedback--challenge${modifierPhaseActive ? ' roll-feedback--modifier' : ''}${pendingRoll.challengeResolved ? ' roll-feedback--resolved' : ''}`}
        role="status"
        aria-live="polite"
      >
        <p className="roll-feedback__context">{pendingRoll.targetLabel}</p>
        <p className="roll-feedback__hint">
          Challenger wins if their total is ≥ the attacker&apos;s total
        </p>
        <div className="roll-feedback__challenge-rolls">
          <ChallengeSideRoll label={attackerName} side={attackerRoll} />
          <span className="roll-feedback__vs">vs</span>
          <ChallengeSideRoll label={challengerName} side={challengerRoll} />
        </div>
        {pendingRoll.modifierLabels.length > 0 && (
          <ul className="roll-feedback__modifiers">
            {pendingRoll.modifierLabels.map((label, index) => (
              <li key={`${label}-${index}`}>{label}</li>
            ))}
          </ul>
        )}
        {modifierPhaseActive && (
          <p className="roll-feedback__timer">
            Play modifiers (pick which roll to change), or Pass ({secondsLeft}s)
          </p>
        )}
        {challengePhaseActive && !modifierPhaseActive && (
          <p className="roll-feedback__timer">
            Opponent may play a Challenge, or Pass ({secondsLeft}s)
          </p>
        )}
        <div className="roll-feedback__indicators">
          {pendingRoll.challengeSuccess && (
            <span className="roll-feedback__success-text">CHALLENGE SUCCESS</span>
          )}
          {pendingRoll.showGreen && !pendingRoll.challengeResolved && (
            <span
              className="roll-feedback__dot roll-feedback__dot--green"
              title="Challenger leading"
              aria-label="Challenger leading"
            />
          )}
          {pendingRoll.showRed && !pendingRoll.challengeResolved && (
            <span
              className="roll-feedback__dot roll-feedback__dot--red"
              title="Attacker leading"
              aria-label="Attacker leading"
            />
          )}
          {pendingRoll.challengeSuccess && (
            <span
              className="roll-feedback__dot roll-feedback__dot--green"
              title="Challenge succeeded"
              aria-label="Challenge succeeded"
            />
          )}
        </div>
      </div>
    )
  }

  const adjusted = pendingRoll.currentSum !== pendingRoll.baseSum

  return (
    <div
      className={`roll-feedback${modifierPhaseActive ? ' roll-feedback--modifier' : ''}`}
      role="status"
      aria-live="polite"
    >
      <p className="roll-feedback__context">{pendingRoll.targetLabel}</p>
      <p className="roll-feedback__dice">
        Dice: <strong>{pendingRoll.d1}</strong> + <strong>{pendingRoll.d2}</strong>
        {' = '}
        <strong className="roll-feedback__sum">{pendingRoll.currentSum}</strong>
        {adjusted && (
          <span className="roll-feedback__base"> (rolled {pendingRoll.baseSum})</span>
        )}
      </p>
      {pendingRoll.rollType === 'hero' && (
        <p className="roll-feedback__hint">Need {pendingRoll.requirement}+ for success</p>
      )}
      {pendingRoll.rollType === 'monster' && (
        <p className="roll-feedback__hint">
          ≤{pendingRoll.failAtOrBelow} fail · ≥{pendingRoll.successAtOrAbove} success
        </p>
      )}
      {pendingRoll.modifierLabels.length > 0 && (
        <ul className="roll-feedback__modifiers">
          {pendingRoll.modifierLabels.map((label, index) => (
            <li key={`${label}-${index}`}>{label}</li>
          ))}
        </ul>
      )}
      {modifierPhaseActive && (
        <p className="roll-feedback__timer">
          Any player may play modifiers, or Pass ({secondsLeft}s)
        </p>
      )}
      <div className="roll-feedback__indicators">
        {pendingRoll.showFail && (
          <span className="roll-feedback__fail-text">FAIL</span>
        )}
        {pendingRoll.showGreen && (
          <span
            className="roll-feedback__dot roll-feedback__dot--green"
            title="Success"
            aria-label="Success"
          />
        )}
        {pendingRoll.showRed && !pendingRoll.showFail && (
          <span
            className="roll-feedback__dot roll-feedback__dot--red"
            title="Failure"
            aria-label="Failure"
          />
        )}
        {pendingRoll.showRed && pendingRoll.showFail && (
          <span
            className="roll-feedback__dot roll-feedback__dot--red"
            title="Failure"
            aria-label="Failure"
          />
        )}
        {pendingRoll.showGray && (
          <span
            className="roll-feedback__dot roll-feedback__dot--gray"
            title="Neutral"
            aria-label="Neutral"
          />
        )}
      </div>
    </div>
  )
}

export default RollFeedback
