import CardDisplay from './CardDisplay.jsx'
import './PartySlot.css'

/**
 * @param {{
 *   hero: import('../gameState.js').CardInstance
 *   items?: import('../gameState.js').CardInstance[]
 *   skillUsedThisTurn?: boolean
 *   onHeroClick?: (hero: import('../gameState.js').CardInstance) => void
 *   allowHeroClickWhenSkillUsed?: boolean
 *   heroClickable?: boolean
 *   onHeroEquipClick?: (hero: import('../gameState.js').CardInstance) => void
 *   heroEquipSelectable?: boolean
 *   selectionMode?: 'destroy' | 'steal' | 'sacrifice' | null
 *   pendingDestroyMode?: boolean
 *   pendingDestroy?: boolean
 * }} props
 */
function PartySlot({
  hero,
  items = [],
  skillUsedThisTurn = false,
  onHeroClick,
  allowHeroClickWhenSkillUsed = false,
  heroClickable = false,
  onHeroEquipClick,
  heroEquipSelectable = false,
  selectionMode = null,
  pendingDestroyMode = false,
  pendingDestroy = false,
}) {
  const canEquipItem =
    heroEquipSelectable && onHeroEquipClick
  const canPendingDestroyTarget = !canEquipItem && pendingDestroyMode && onHeroClick
  const canTriggerSkill =
    !canEquipItem &&
    !canPendingDestroyTarget &&
    heroClickable &&
    onHeroClick &&
    (allowHeroClickWhenSkillUsed || !skillUsedThisTurn)

  const selectionClass = selectionMode
    ? ` party-slot__hero-btn--select party-slot__hero-btn--select-${selectionMode}`
    : ''
  const selectionTitle =
    selectionMode === 'destroy'
      ? `Destroy ${hero.name}`
      : selectionMode === 'steal'
        ? `Steal ${hero.name}`
        : selectionMode === 'sacrifice'
          ? `Sacrifice ${hero.name}`
          : `Trigger ${hero.name}'s skill (1 AP)`

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
        ) : canPendingDestroyTarget ? (
          <button
            type="button"
            className={`party-slot__hero-btn party-slot__hero-btn--select${
              pendingDestroy
                ? ' party-slot__hero-btn--pending-destroy-selected'
                : ' party-slot__hero-btn--pending-destroy-target'
            }`}
            onClick={() => onHeroClick(hero)}
            title={pendingDestroy ? `Deselect ${hero.name}` : `Select ${hero.name} to destroy`}
          >
            <CardDisplay card={hero} faceUp={hero.faceUp ?? true} />
          </button>
        ) : canTriggerSkill ? (
          <button
            type="button"
            className={`party-slot__hero-btn${selectionClass}`}
            onClick={() => onHeroClick(hero)}
            title={selectionTitle}
          >
            <CardDisplay card={hero} faceUp={hero.faceUp ?? true} />
          </button>
        ) : pendingDestroy ? (
          <div className="party-slot__hero-pending-destroy-mark">
            <CardDisplay card={hero} faceUp={hero.faceUp ?? true} />
          </div>
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
