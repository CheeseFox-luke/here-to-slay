import CardDisplay from './CardDisplay.jsx'
import { ATTACK_MONSTER_AP_COST } from '../gameState.js'
import './ActiveMonsters.css'

/**
 * @param {{
 *   monsters: import('../gameState.js').CardInstance[]
 *   onAttack?: (monster: import('../gameState.js').CardInstance) => void
 *   canAttack?: boolean
 * }} props
 */
function ActiveMonsters({ monsters, onAttack, canAttack = false }) {
  if (monsters.length === 0) {
    return <p className="active-monsters__empty">No active monsters</p>
  }

  return (
    <div className="active-monsters">
      {monsters.map((monster) => {
        const attackEnabled = canAttack && onAttack

        return (
          <div key={monster.instanceId} className="active-monsters__slot">
            {attackEnabled ? (
              <button
                type="button"
                className="active-monsters__btn"
                onClick={() => onAttack(monster)}
                title={`Attack (${ATTACK_MONSTER_AP_COST} AP)`}
              >
                <CardDisplay card={monster} faceUp />
              </button>
            ) : (
              <CardDisplay card={monster} faceUp />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ActiveMonsters
