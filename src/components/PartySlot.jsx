import CardDisplay from './CardDisplay.jsx'
import './PartySlot.css'

/**
 * @param {{
 *   hero: import('../gameState.js').CardInstance
 *   items?: import('../gameState.js').CardInstance[]
 *   skillUsedThisTurn?: boolean
 *   onHeroClick?: (hero: import('../gameState.js').CardInstance) => void
 *   heroClickable?: boolean
 *   onHeroEquipClick?: (hero: import('../gameState.js').CardInstance) => void
 *   heroEquipSelectable?: boolean
 * }} props
 */
function PartySlot({
  hero,
  items = [],
  skillUsedThisTurn = false,
  onHeroClick,
  heroClickable = false,
  onHeroEquipClick,
  heroEquipSelectable = false,
}) {
  const canEquipItem =
    heroEquipSelectable && onHeroEquipClick
  const canTriggerSkill =
    !canEquipItem && heroClickable && onHeroClick && !skillUsedThisTurn

  return (
    <div className="party-slot">
      <div className="party-slot__hero">
        {canEquipItem ? (
          <button
            type="button"
            className="party-slot__hero-btn party-slot__hero-btn--equip"
            onClick={() => onHeroEquipClick(hero)}
            title={`Equip item on ${hero.name}`}
          >
            <CardDisplay card={hero} faceUp={hero.faceUp ?? true} />
          </button>
        ) : canTriggerSkill ? (
          <button
            type="button"
            className="party-slot__hero-btn"
            onClick={() => onHeroClick(hero)}
            title={`Trigger ${hero.name}'s skill (1 AP)`}
          >
            <CardDisplay card={hero} faceUp={hero.faceUp ?? true} />
          </button>
        ) : (
          <CardDisplay card={hero} faceUp={hero.faceUp ?? true} />
        )}
        {skillUsedThisTurn && (
          <span className="party-slot__skill-used" title="Skill used this turn">
            Used
          </span>
        )}
      </div>
      {items.length > 0 && (
        <div className="party-slot__items">
          {items.map((item) => (
            <div key={item.instanceId} className="party-slot__item">
              <CardDisplay card={item} faceUp={item.faceUp ?? true} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PartySlot
