import CardDisplay from './CardDisplay.jsx'
import './TopDeckPickDialog.css'

/**
 * @param {{
 *   open: boolean
 *   sourceLabel: string
 *   phase: 'pick' | 'order'
 *   cards: import('../gameState.js').CardInstance[]
 *   onPick: (instanceId: string) => void
 * }} props
 */
function TopDeckPickDialog({ open, sourceLabel, phase, cards, onPick }) {
  if (!open || !cards || cards.length === 0) return null

  const desc =
    phase === 'pick'
      ? 'Choose one card to add to your hand.'
      : 'Choose which card goes on top of the deck. The other goes second.'

  return (
    <div className="top-deck-backdrop">
      <div className="top-deck-dialog">
        <h3 className="top-deck-dialog__title">{sourceLabel}</h3>
        <p className="top-deck-dialog__desc">{desc}</p>
        <div className="top-deck-dialog__cards">
          {cards.map((card) => (
            <button
              key={card.instanceId}
              type="button"
              className="top-deck-dialog__card-btn"
              onClick={() => onPick(card.instanceId)}
            >
              <CardDisplay card={card} faceUp={true} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TopDeckPickDialog
