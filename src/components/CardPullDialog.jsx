import CardDisplay from './CardDisplay.jsx'
import './CardPullDialog.css'

/**
 * @param {{
 *   open: boolean
 *   sourceLabel: string
 *   targetPlayerName: string
 *   cards: import('../gameState.js').CardInstance[]
 *   isBonusPull?: boolean
 *   bonusTriggerHint?: string
 *   showFaceUp?: boolean
 *   onPick: (instanceId: string) => void
 * }} props
 */
function CardPullDialog({
  open,
  sourceLabel,
  targetPlayerName,
  cards,
  isBonusPull = false,
  bonusTriggerHint,
  showFaceUp = false,
  onPick,
}) {
  if (!open || !cards || cards.length === 0) return null

  return (
    <div className="card-pull-backdrop">
      <div className="card-pull-dialog">
        <h3 className="card-pull-dialog__title">{sourceLabel}</h3>
        <p className="card-pull-dialog__desc">
          {isBonusPull ? (
            <>
              Bonus pull! Choose <strong>another card</strong> from{' '}
              <strong>{targetPlayerName}</strong>&apos;s hand.
            </>
          ) : (
            <>
              Choose a card from <strong>{targetPlayerName}</strong>&apos;s hand.
              {bonusTriggerHint && (
                <span className="card-pull-dialog__hint"> {bonusTriggerHint}</span>
              )}
            </>
          )}
        </p>
        <div className="card-pull-dialog__cards">
          {cards.map((card) => (
            <button
              key={card.instanceId}
              type="button"
              className="card-pull-dialog__card-btn"
              onClick={() => onPick(card.instanceId)}
              title="Click to pull this card"
            >
              <CardDisplay card={card} faceUp={showFaceUp} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CardPullDialog
