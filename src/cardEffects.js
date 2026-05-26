import { CARD_TYPES, HERO_CLASSES } from './data/cardUtils.js'
import { destroy, draw, sacrifice } from './effects.js'

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
 * Qi Bear: destroy `heroTargets.length` pre-selected heroes, then set up a
 * fixed discard of `count` cards (chosen by the player one at a time).
 * Both count and targets are locked in before the dice roll.
 *
 * @param {GameState} game
 * @param {{
 *   sourcePlayerIndex: number,
 *   count?: number,
 *   heroTargets?: string[],
 *   sourceLabel?: string,
 * }} params
 */
export function qiBearEffect(game, { sourcePlayerIndex, count = 0, heroTargets = [], sourceLabel = 'Qi Bear' }) {
  const player = game.players[sourcePlayerIndex]
  if (!player) {
    return { game, error: 'Invalid player.' }
  }

  // Destroy all pre-selected heroes immediately
  let currentGame = game
  for (const heroInstanceId of heroTargets) {
    const ownerIndex = currentGame.players.findIndex((p) =>
      p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
    )
    if (ownerIndex === -1) continue
    const result =
      ownerIndex === sourcePlayerIndex
        ? sacrifice(currentGame, { playerIndex: ownerIndex, heroInstanceId })
        : destroy(currentGame, { sourcePlayerIndex, targetPlayerIndex: ownerIndex, heroInstanceId })
    if (result.game) currentGame = result.game
  }

  // Set up a fixed discard (not optional, no per-discard destroy)
  if (count <= 0) {
    return { game: currentGame }
  }
  const actualCount = Math.min(count, currentGame.players[sourcePlayerIndex].hand.length)
  if (actualCount <= 0) {
    return { game: currentGame }
  }
  return {
    game: {
      ...currentGame,
      pendingDiscard: {
        playerIndex: sourcePlayerIndex,
        sourcePlayerIndex,
        count: actualCount,
        sourceLabel,
      },
    },
  }
}

/**
 * Beary Wise: each other player discards 1 card (staged, not to discard pile).
 * Source player then picks one staged card for their hand; the rest go to discard.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, sourceLabel?: string }} params
 */
/**
 * @param {import('./gameState.js').Player} player
 */
function partyHasFighter(player) {
  if (player.leader?.class === HERO_CLASSES.FIGHTER) {
    return true
  }
  return player.partySlots.some((s) => s?.hero?.class === HERO_CLASSES.FIGHTER)
}

/**
 * @param {GameState} game
 * @param {{
 *   sourcePlayerIndex: number,
 *   sourceLabel: string,
 *   queue: number[],
 *   kind: 'opponentEach' | 'opponentEachPile',
 * }} params
 */
function startOpponentDiscardQueue(
  game,
  { sourcePlayerIndex, sourceLabel, queue, kind },
) {
  if (queue.length === 0) {
    return { game }
  }

  const [first, ...rest] = queue
  return {
    game: {
      ...game,
      pendingDiscard: {
        kind,
        playerIndex: first,
        sourcePlayerIndex,
        count: 1,
        sourceLabel,
        opponentDiscardQueue: rest,
        ...(kind === 'opponentEach' ? { stagedCards: [] } : {}),
      },
    },
  }
}

export function bearyWiseEffect(game, { sourcePlayerIndex, sourceLabel = 'Beary Wise' }) {
  const queue = game.players
    .map((_, index) => index)
    .filter(
      (index) =>
        index !== sourcePlayerIndex && game.players[index].hand.length > 0,
    )

  return startOpponentDiscardQueue(game, {
    sourcePlayerIndex,
    sourceLabel,
    queue,
    kind: 'opponentEach',
  })
}

/**
 * Tough Teddy: each other player whose party has a Fighter (leader or hero)
 * discards 1 card to the discard pile.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, sourceLabel?: string }} params
 */
export function toughTeddyEffect(game, { sourcePlayerIndex, sourceLabel = 'Tough Teddy' }) {
  const queue = game.players
    .map((_, index) => index)
    .filter(
      (index) =>
        index !== sourcePlayerIndex &&
        partyHasFighter(game.players[index]) &&
        game.players[index].hand.length > 0,
    )

  return startOpponentDiscardQueue(game, {
    sourcePlayerIndex,
    sourceLabel,
    queue,
    kind: 'opponentEachPile',
  })
}

/**
 * Fury Knuckle: open a card-pull dialog for the source player to pick one card
 * from the target's face-down hand. If the pulled card is a Challenge, they
 * get to pick one more.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, targetPlayerIndex: number, sourceLabel?: string }} params
 */
export function furyKnuckleEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Fury Knuckle' }) {
  const target = game.players[targetPlayerIndex]
  if (!target) return { game, error: 'Invalid target.' }
  if (target.hand.length === 0) return { game }
  return {
    game: {
      ...game,
      pendingCardPull: {
        sourcePlayerIndex,
        targetPlayerIndex,
        bonusTriggerType: CARD_TYPES.CHALLENGE,
        sourceLabel,
      },
    },
  }
}

/**
 * Bear Claw: open a card-pull dialog for the source player to pick one card
 * from the target's face-down hand. If the pulled card is a Hero, they
 * get to pick one more.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, targetPlayerIndex: number, sourceLabel?: string }} params
 */
export function bearClawEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Bear Claw' }) {
  const target = game.players[targetPlayerIndex]
  if (!target) return { game, error: 'Invalid target.' }
  if (target.hand.length === 0) return { game }
  return {
    game: {
      ...game,
      pendingCardPull: {
        sourcePlayerIndex,
        targetPlayerIndex,
        bonusTriggerType: CARD_TYPES.HERO,
        sourceLabel,
      },
    },
  }
}

/**
 * Bad Axe: destroy the pre-selected hero (chosen before the dice roll).
 * `heroTargets[0]` is the instanceId locked in during `pendingEffectHeroTargetSelection`.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, heroTargets?: string[], sourceLabel?: string }} params
 */
export function badAxeEffect(game, { sourcePlayerIndex, heroTargets = [], sourceLabel = 'Bad Axe' }) {
  const heroInstanceId = heroTargets[0]
  if (!heroInstanceId) return { game }

  const ownerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
  )
  if (ownerIndex === -1) return { game }

  if (ownerIndex === sourcePlayerIndex) {
    return sacrifice(game, { playerIndex: ownerIndex, heroInstanceId })
  }
  return destroy(game, { sourcePlayerIndex, targetPlayerIndex: ownerIndex, heroInstanceId })
}

/** @type {Record<string, (game: GameState, params: any) => { game: GameState, error?: string }>} */
const CARD_EFFECTS = {
  heavyBear: heavyBearEffect,
  panChucks: panChucksEffect,
  qiBear: qiBearEffect,
  bearyWise: bearyWiseEffect,
  toughTeddy: toughTeddyEffect,
  furyKnuckle: furyKnuckleEffect,
  bearClaw: bearClawEffect,
  badAxe: badAxeEffect,
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
