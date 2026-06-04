import { useState } from 'react'
import { CARD_TYPES } from '../data/cardUtils.js'
import CardDisplay from './CardDisplay.jsx'
import './BonusItemPlayDialog.css'

/**
 * @param {{
 *   open: boolean
 *   sourceLabel: string
 *   eligibleItems: import('../gameState.js').CardInstance[]
 *   players: import('../gameState.js').Player[]
 *   sourcePlayerIndex: number
 *   drawAfter: number
 *   onEquip: (itemInstanceId: string, heroOwnerIndex: number, slotIndex: number) => void
 *   onPass: () => void
 * }} props
 */
function BonusItemPlayDialog({ open, sourceLabel, eligibleItems, players, sourcePlayerIndex, drawAfter, onEquip, onPass }) {
  const [selectedItemId, setSelectedItemId] = useState(null)

  if (!open || !eligibleItems || eligibleItems.length === 0) return null

  const selectedItem = selectedItemId ? eligibleItems.find((c) => c.instanceId === selectedItemId) : null
  const isCursed = selectedItem?.type === CARD_TYPES.CURSED_ITEM

  const drawHint = drawAfter > 0 ? ` Then draw ${drawAfter} card${drawAfter > 1 ? 's' : ''}.` : ''

  function handleSelectItem(id) {
    setSelectedItemId(prev => prev === id ? null : id)
  }

  function handleHeroClick(ownerIndex, slotIndex) {
    if (!selectedItemId) return
    onEquip(selectedItemId, ownerIndex, slotIndex)
    setSelectedItemId(null)
  }

  // Build hero options based on item type
  const heroOptions = []
  players.forEach((player, pi) => {
    const isOwn = pi === sourcePlayerIndex
    const isOpponent = !isOwn
    if (selectedItem) {
      if (!isCursed && !isOwn) return
      if (isCursed && isOwn) return
    }
    player.partySlots.forEach((slot, si) => {
      if (!slot) return
      heroOptions.push({ ownerIndex: pi, slotIndex: si, heroName: slot.hero.name, playerName: player.name, isOpponent })
    })
  })

  return (
    <div className="bonus-item-backdrop">
      <div className="bonus-item-dialog">
        <h3 className="bonus-item-dialog__title">{sourceLabel}</h3>
        <p className="bonus-item-dialog__desc">
          Choose an item to equip for free.{drawHint}
        </p>

        <div className="bonus-item-dialog__items">
          {eligibleItems.map((card) => (
            <button
              key={card.instanceId}
              type="button"
              className={`bonus-item-dialog__item-btn${selectedItemId === card.instanceId ? ' bonus-item-dialog__item-btn--selected' : ''}`}
              onClick={() => handleSelectItem(card.instanceId)}
            >
              <CardDisplay card={card} faceUp={true} />
            </button>
          ))}
        </div>

        {selectedItem && (
          <div className="bonus-item-dialog__heroes">
            <p className="bonus-item-dialog__section-label">
              {isCursed ? 'Choose an opponent hero to equip:' : 'Choose one of your heroes to equip:'}
            </p>
            <div className="bonus-item-dialog__hero-list">
              {heroOptions.map(({ ownerIndex, slotIndex, heroName, playerName }) => (
                <button
                  key={`${ownerIndex}-${slotIndex}`}
                  type="button"
                  className="bonus-item-dialog__hero-btn"
                  onClick={() => handleHeroClick(ownerIndex, slotIndex)}
                >
                  {isCursed ? `${playerName}: ${heroName}` : heroName}
                </button>
              ))}
              {heroOptions.length === 0 && (
                <span style={{ color: 'var(--text)', fontSize: '0.88rem' }}>No valid heroes available.</span>
              )}
            </div>
          </div>
        )}

        <div className="bonus-item-dialog__actions">
          <button type="button" className="bonus-item-dialog__pass-btn" onClick={onPass}>
            Pass{drawAfter > 0 ? ` (Draw ${drawAfter})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BonusItemPlayDialog
