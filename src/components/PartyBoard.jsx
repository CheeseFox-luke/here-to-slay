import CardDisplay from './CardDisplay.jsx'
import PartySlot from './PartySlot.jsx'
import {
  PARTY_GRID_COLS,
  PARTY_SLOT_COUNT,
  SLAIN_MONSTER_SLOT_COUNT,
} from '../gameState.js'
import './PartyBoard.css'

/**
 * @param {{
 *   leader: import('../gameState.js').CardInstance
 *   leaderItems?: import('../gameState.js').CardInstance[]
 *   partySlots: (import('../gameState.js').PartySlot | null)[]
 *   slainMonsters?: import('../gameState.js').CardInstance[]
 *   onHeroSkillClick?: (hero: import('../gameState.js').CardInstance) => void
 *   allowHeroClickWhenSkillUsed?: boolean
 *   heroSkillClickable?: boolean
 *   onHeroEquipClick?: (hero: import('../gameState.js').CardInstance) => void
 *   heroEquipSelectable?: boolean
 *   selectionMode?: 'destroy' | 'steal' | 'sacrifice' | null
 * }} props
 */
function PartyBoard({
  leader,
  leaderItems = [],
  partySlots,
  slainMonsters = [],
  onHeroSkillClick,
  allowHeroClickWhenSkillUsed = false,
  heroSkillClickable = false,
  onHeroEquipClick,
  heroEquipSelectable = false,
  selectionMode = null,
}) {
  return (
    <div className="party-board">
      <div className="party-board__leader">
        <PartySlot hero={leader} items={leaderItems} />
        <span className="party-board__label">Leader</span>
      </div>

      <div
        className="party-board__grid"
        style={{ '--party-cols': PARTY_GRID_COLS }}
      >
        {Array.from({ length: PARTY_SLOT_COUNT }, (_, index) => {
          const slot = partySlots[index]

          return (
            <div key={index} className="party-board__cell">
              {slot ? (
                <PartySlot
                  hero={slot.hero}
                  items={slot.items}
                  skillUsedThisTurn={slot.skillUsedThisTurn}
                  onHeroClick={onHeroSkillClick}
                  allowHeroClickWhenSkillUsed={allowHeroClickWhenSkillUsed}
                  heroClickable={heroSkillClickable}
                  onHeroEquipClick={onHeroEquipClick}
                  heroEquipSelectable={heroEquipSelectable}
                  selectionMode={selectionMode}
                />
              ) : (
                <div className="party-board__placeholder" aria-hidden />
              )}
            </div>
          )
        })}
      </div>

      <div className="party-board__slain">
        <span className="party-board__label">Slain monsters</span>
        <div className="party-board__slain-row">
          {Array.from({ length: SLAIN_MONSTER_SLOT_COUNT }, (_, index) => {
            const monster = slainMonsters[index]

            return (
              <div key={index} className="party-board__slain-cell">
                {monster ? (
                  <CardDisplay
                    card={monster}
                    faceUp={monster.faceUp ?? true}
                  />
                ) : (
                  <div
                    className="party-board__placeholder party-board__placeholder--monster"
                    aria-hidden
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default PartyBoard
