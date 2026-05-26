import { CARD_TYPES } from './data/cardUtils.js'
import { draw } from './effects.js'

/** @typedef {import('./gameState.js').GameState} GameState */
/** @typedef {import('./gameState.js').CardInstance} CardInstance */

/* ------------------------------------------------------ *
 * Card effects (composed from atomic effects + UI prompts) *
 * ------------------------------------------------------ */

/**
 * Heavy Bear: target player discards 2 cards (or their entire hand if fewer).
 * Sets up a `pendingDiscard` that the target player resolves card-by-card.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, targetPlayerIndex: number, sourceLabel?: string }} params
 */
export function heavyBearEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Heavy Bear' }) {
  const target = game.players[targetPlayerIndex]
  if (!target) {
    return { game, error: 'Invalid target.' }
  }
  const count = Math.min(2, target.hand.length)
  if (count === 0) {
    return { game }
  }
  return {
    game: {
      ...game,
      pendingDiscard: {
        playerIndex: targetPlayerIndex,
        sourcePlayerIndex,
        count,
        sourceLabel,
      },
    },
  }
}

/**
 * Pan Chucks: draw 2 cards; if at least one is a Challenge card, destroy a Hero
 * on any party (own or opponent).
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, sourceLabel?: string }} params
 */
export function panChucksEffect(game, { sourcePlayerIndex, sourceLabel = 'Pan Chucks' }) {
  const { game: afterDraw, drawn = [] } = draw(game, {
    playerIndex: sourcePlayerIndex,
    count: 2,
  })

  const hasChallenge = drawn.some((c) => c.type === CARD_TYPES.CHALLENGE)
  if (!hasChallenge) {
    return { game: afterDraw }
  }

  const hasHero = afterDraw.players.some((p) =>
    p.partySlots.some((s) => s !== null),
  )
  if (!hasHero) {
    return { game: afterDraw }
  }

  return {
    game: {
      ...afterDraw,
      pendingHeroSelection: {
        sourcePlayerIndex,
        scope: 'any',
        action: 'destroy',
        sourceLabel,
      },
    },
  }
}

/**
 * Qi Bear: discard up to 3 cards; for each discarded card, destroy a Hero.
 *
 * Implementation: optional `pendingDiscard` (Pass anytime) with
 * `destroyHeroPerDiscard` so each discarded card interleaves one destroy.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, sourceLabel?: string }} params
 */
export function qiBearEffect(game, { sourcePlayerIndex, sourceLabel = 'Qi Bear' }) {
  const player = game.players[sourcePlayerIndex]
  if (!player) {
    return { game, error: 'Invalid player.' }
  }

  const count = Math.min(3, player.hand.length)
  if (count <= 0) {
    return { game }
  }

  return {
    game: {
      ...game,
      pendingDiscard: {
        playerIndex: sourcePlayerIndex,
        sourcePlayerIndex,
        count,
        sourceLabel,
        optional: true,
        destroyHeroPerDiscard: true,
      },
    },
  }
}

/** @type {Record<string, (game: GameState, params: any) => { game: GameState, error?: string }>} */
const CARD_EFFECTS = {
  heavyBear: heavyBearEffect,
  panChucks: panChucksEffect,
  qiBear: qiBearEffect,
}

/**
 * @param {string} effectId
 */
export function getCardEffect(effectId) {
  return CARD_EFFECTS[effectId] ?? null
}

/**
 * @param {GameState} game
 * @param {string} effectId
 * @param {any} params
 */
export function runCardEffect(game, effectId, params) {
  const fn = getCardEffect(effectId)
  if (!fn) {
    return { game, error: `Unknown effect: ${effectId}` }
  }
  return fn(game, params)
}
