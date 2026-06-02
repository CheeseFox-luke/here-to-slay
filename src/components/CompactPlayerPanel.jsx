import { useState } from 'react'
import { PARTY_SLOT_COUNT, SLAIN_MONSTER_SLOT_COUNT } from '../gameState.js'
import './CompactPlayerPanel.css'

/**
 * Compact player panel for the new game layout.
 * Click the left section (leader image) to toggle between hero party and slain monsters.
 *
 * @param {{
 *   player: import('../gameState.js').PlayerState
 *   isCurrent?: boolean
 *   isMe?: boolean
 *   onHeroSkillClick?: (hero: import('../gameState.js').CardInstance) => void
 *   heroSkillClickable?: boolean
 *   allowHeroClickWhenSkillUsed?: boolean
 *   onHeroEquipClick?: (hero: import('../gameState.js').CardInstance) => void
 *   heroEquipSelectable?: boolean
 *   selectionMode?: string | null
 *   pendingDestroyMode?: boolean
 *   pendingDestroyIds?: string[]
 *   onItemClick?: (hero: import('../gameState.js').CardInstance, item: import('../gameState.js').CardInstance) => void
 *   itemsSelectable?: boolean
 * }} props
 */
function CompactPlayerPanel({
  player,
  isCurrent = false,
  isMe = false,
  onHeroSkillClick,
  heroSkillClickable = false,
  allowHeroClickWhenSkillUsed = false,
  onHeroEquipClick,
  heroEquipSelectable = false,
  selectionMode = null,
  pendingDestroyMode = false,
  pendingDestroyIds = [],
  onItemClick,
  itemsSelectable = false,
}) {
  const [showMonsters, setShowMonsters] = useState(false)

  const handCount = player.hand?.length ?? 0

  const panelClasses = [
    'compact-panel',
    isCurrent ? 'compact-panel--current' : '',
    isMe ? 'compact-panel--me' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={panelClasses}>
      {/* Left: leader image + name, click to toggle */}
      <div
        className="compact-panel__left"
        onClick={() => setShowMonsters((v) => !v)}
        title={showMonsters ? 'Show hero party' : 'Show slain monsters'}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowMonsters((v) => !v) }}
      >
        {handCount > 0 && (
          <span className="compact-panel__hand-badge">{handCount}</span>
        )}
        {player.leader?.imageUrl && (
          <img
            src={player.leader.imageUrl}
            alt={player.leader.name}
            className="compact-panel__leader-img"
            draggable={false}
          />
        )}
        <span className="compact-panel__name">{player.name}</span>
        <span className="compact-panel__toggle-hint">
          {showMonsters ? '⚔ party' : '💀 slain'}
        </span>
      </div>

      {/* Right: hero grid or monster view */}
      <div className="compact-panel__right">
        {showMonsters ? (
          <MonsterView slainMonsters={player.slainMonsters ?? []} />
        ) : (
          <HeroGrid
            partySlots={player.partySlots}
            onHeroSkillClick={onHeroSkillClick}
            heroSkillClickable={heroSkillClickable}
            allowHeroClickWhenSkillUsed={allowHeroClickWhenSkillUsed}
            onHeroEquipClick={onHeroEquipClick}
            heroEquipSelectable={heroEquipSelectable}
            selectionMode={selectionMode}
            pendingDestroyMode={pendingDestroyMode}
            pendingDestroyIds={pendingDestroyIds}
            onItemClick={onItemClick}
            itemsSelectable={itemsSelectable}
          />
        )}
      </div>
    </div>
  )
}

function HeroGrid({
  partySlots,
  onHeroSkillClick,
  heroSkillClickable,
  allowHeroClickWhenSkillUsed,
  onHeroEquipClick,
  heroEquipSelectable,
  selectionMode,
  pendingDestroyMode,
  pendingDestroyIds,
  onItemClick,
  itemsSelectable,
}) {
  return (
    <div className="compact-panel__hero-grid">
      {Array.from({ length: PARTY_SLOT_COUNT }, (_, index) => {
        const slot = partySlots?.[index] ?? null
        if (!slot) {
          return (
            <div key={index} className="compact-panel__hero-cell">
              <div className="compact-panel__hero-placeholder" aria-hidden />
            </div>
          )
        }

        const hero = slot.hero
        const skillUsed = slot.skillUsedThisTurn
        const isDestroyTarget = pendingDestroyIds.includes(hero.instanceId)
        const isSealed = slot.items.some((item) => item.effectId === 'sealingKey')

        const isClickable =
          (heroSkillClickable && onHeroSkillClick && (!skillUsed || allowHeroClickWhenSkillUsed) && !isSealed) ||
          (heroEquipSelectable && onHeroEquipClick)

        const cellExtraClass = isDestroyTarget && pendingDestroyMode
          ? ' compact-panel__hero-cell--destroy'
          : ''

        function handleClick() {
          if (heroEquipSelectable && onHeroEquipClick) {
            onHeroEquipClick(hero)
            return
          }
          if (heroSkillClickable && onHeroSkillClick && (!skillUsed || allowHeroClickWhenSkillUsed) && !isSealed) {
            onHeroSkillClick(hero)
          }
        }

        const imgClass = `compact-panel__hero-img${skillUsed && !allowHeroClickWhenSkillUsed ? ' compact-panel__hero-img--used' : ''}`

        const inner = (
          <>
            <img
              src={hero.imageUrl}
              alt={hero.name}
              className={imgClass}
              draggable={false}
            />
            {skillUsed && (
              <span className="compact-panel__skill-check">✓</span>
            )}
            {slot.items.length > 0 && (
              <div className="compact-panel__item-dots">
                {slot.items.map((item) => (
                  <span
                    key={item.instanceId}
                    className="compact-panel__item-dot"
                    title={item.name}
                    onClick={
                      itemsSelectable && onItemClick
                        ? (e) => { e.stopPropagation(); onItemClick(hero, item) }
                        : undefined
                    }
                    style={itemsSelectable && onItemClick ? { cursor: 'pointer' } : undefined}
                  />
                ))}
              </div>
            )}
          </>
        )

        if (isClickable) {
          return (
            <div key={index} className={`compact-panel__hero-cell${cellExtraClass}`}>
              <button
                type="button"
                className="compact-panel__hero-cell--btn"
                onClick={handleClick}
                title={hero.name}
              >
                {inner}
              </button>
            </div>
          )
        }

        return (
          <div key={index} className={`compact-panel__hero-cell${cellExtraClass}`}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}

function MonsterView({ slainMonsters }) {
  return (
    <div>
      <span className="compact-panel__view-label">Slain monsters</span>
      <div className="compact-panel__monster-grid">
        {Array.from({ length: SLAIN_MONSTER_SLOT_COUNT }, (_, index) => {
          const monster = slainMonsters[index]
          if (!monster) {
            return (
              <div key={index} className="compact-panel__monster-placeholder" aria-hidden />
            )
          }
          return (
            <img
              key={index}
              src={monster.imageUrl}
              alt={monster.name}
              className="compact-panel__monster-img"
              draggable={false}
            />
          )
        })}
      </div>
    </div>
  )
}

export default CompactPlayerPanel
