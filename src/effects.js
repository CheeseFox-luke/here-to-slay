import { CARD_TYPES } from './data/cardUtils.js'
import { drawFromMainDeck } from './deckHelpers.js'
import { withFaceUp } from './gameState.js'

/** @typedef {import('./gameState.js').GameState} GameState */
/** @typedef {import('./gameState.js').CardInstance} CardInstance */
/** @typedef {import('./gameState.js').PartySlot} PartySlot */

/**
 * @param {(PartySlot | null)[]} partySlots
 */
function clonePartySlots(partySlots) {
  return partySlots.map((slot) =>
    slot
      ? {
          hero: slot.hero,
          items: [...slot.items],
          skillUsedThisTurn: slot.skillUsedThisTurn,
        }
      : null,
  )
}

/**
 * @param {GameState} game
 * @param {number} playerIndex
 * @param {Partial<import('./gameState.js').Player>} patch
 */
function updatePlayer(game, playerIndex, patch) {
  const players = game.players.map((p, i) =>
    i === playerIndex ? { ...p, ...patch } : p,
  )
  return { ...game, players }
}

/* ------------------------------------------------------------------ *
 * Atomic effects (each is a pure function that returns new GameState) *
 * ------------------------------------------------------------------ */

/**
 * draw N cards from the main deck into a player's hand.
 * @param {GameState} game
 * @param {{ playerIndex: number, count: number }} params
 */
export function draw(game, { playerIndex, count }) {
  if (count <= 0) {
    return { game }
  }
  const { game: afterDraw, drawn } = drawFromMainDeck(game, count)
  const player = afterDraw.players[playerIndex]
  if (!player) {
    return { game: afterDraw }
  }
  const next = updatePlayer(afterDraw, playerIndex, {
    hand: [...player.hand, ...drawn],
  })
  return { game: next, drawn }
}

/**
 * discard a specific card from a player's hand to the discard pile.
 * @param {GameState} game
 * @param {{ playerIndex: number, instanceId: string }} params
 */
export function discard(game, { playerIndex, instanceId }) {
  const player = game.players[playerIndex]
  if (!player) {
    return { game, error: 'Invalid player.' }
  }
  const card = player.hand.find((c) => c.instanceId === instanceId)
  if (!card) {
    return { game, error: 'Card not in hand.' }
  }
  const hand = player.hand.filter((c) => c.instanceId !== instanceId)
  const discardPile = [...game.discardPile, withFaceUp(card)]
  const next = { ...updatePlayer(game, playerIndex, { hand }), discardPile }
  return { game: next, card }
}

/**
 * remove one of your own heroes from your party and send it to the discard pile.
 * (any equipped items go with it).
 * @param {GameState} game
 * @param {{ playerIndex: number, heroInstanceId: string }} params
 */
export function sacrifice(game, { playerIndex, heroInstanceId }) {
  const player = game.players[playerIndex]
  if (!player) {
    return { game, error: 'Invalid player.' }
  }
  const slotIndex = player.partySlots.findIndex(
    (s) => s?.hero.instanceId === heroInstanceId,
  )
  if (slotIndex === -1) {
    return { game, error: 'Hero not in your party.' }
  }
  const slot = player.partySlots[slotIndex]
  const partySlots = clonePartySlots(player.partySlots)
  partySlots[slotIndex] = null
  const discarded = [
    withFaceUp(slot.hero),
    ...slot.items.map((c) => withFaceUp(c)),
  ]
  const discardPile = [...game.discardPile, ...discarded]
  const next = { ...updatePlayer(game, playerIndex, { partySlots }), discardPile }
  return { game: next, discarded }
}

/**
 * remove another player's hero from their party and send it to the discard pile.
 * @param {GameState} game
 * @param {{ targetPlayerIndex: number, heroInstanceId: string }} params
 */
export function destroy(game, { targetPlayerIndex, heroInstanceId }) {
  return sacrifice(game, {
    playerIndex: targetPlayerIndex,
    heroInstanceId,
  })
}

/**
 * move another player's hero (with its items) into your own party.
 * @param {GameState} game
 * @param {{
 *   sourcePlayerIndex: number,
 *   targetPlayerIndex: number,
 *   heroInstanceId: string,
 * }} params
 */
export function steal(game, { sourcePlayerIndex, targetPlayerIndex, heroInstanceId }) {
  const source = game.players[sourcePlayerIndex]
  const target = game.players[targetPlayerIndex]
  if (!source || !target) {
    return { game, error: 'Invalid players.' }
  }
  const targetSlotIndex = target.partySlots.findIndex(
    (s) => s?.hero.instanceId === heroInstanceId,
  )
  if (targetSlotIndex === -1) {
    return { game, error: 'Hero not in target party.' }
  }
  const sourceEmptyIndex = source.partySlots.findIndex((s) => s === null)
  if (sourceEmptyIndex === -1) {
    return { game, error: 'No empty party slot to receive the hero.' }
  }
  const stolen = target.partySlots[targetSlotIndex]

  const targetSlots = clonePartySlots(target.partySlots)
  targetSlots[targetSlotIndex] = null

  const sourceSlots = clonePartySlots(source.partySlots)
  sourceSlots[sourceEmptyIndex] = {
    hero: stolen.hero,
    items: [...stolen.items],
    skillUsedThisTurn: true,
  }

  let next = updatePlayer(game, targetPlayerIndex, { partySlots: targetSlots })
  next = updatePlayer(next, sourcePlayerIndex, { partySlots: sourceSlots })
  return { game: next, stolen }
}

/**
 * move a card from your hand into another player's hand.
 * @param {GameState} game
 * @param {{
 *   sourcePlayerIndex: number,
 *   targetPlayerIndex: number,
 *   instanceId: string,
 * }} params
 */
export function give(game, { sourcePlayerIndex, targetPlayerIndex, instanceId }) {
  const source = game.players[sourcePlayerIndex]
  const target = game.players[targetPlayerIndex]
  if (!source || !target) {
    return { game, error: 'Invalid players.' }
  }
  const card = source.hand.find((c) => c.instanceId === instanceId)
  if (!card) {
    return { game, error: 'Card not in your hand.' }
  }
  const sourceHand = source.hand.filter((c) => c.instanceId !== instanceId)
  const targetHand = [...target.hand, withFaceUp(card)]
  let next = updatePlayer(game, sourcePlayerIndex, { hand: sourceHand })
  next = updatePlayer(next, targetPlayerIndex, { hand: targetHand })
  return { game: next, card }
}

const SEARCHABLE_DISCARD_TYPES = new Set([
  CARD_TYPES.HERO,
  CARD_TYPES.MAGIC,
  CARD_TYPES.MODIFIER,
  CARD_TYPES.CHALLENGE,
  CARD_TYPES.ITEM,
])

/**
 * pull a specific Hero/Magic/Modifier/Challenge/Item from the discard pile
 * back to a player's hand.
 * @param {GameState} game
 * @param {{ playerIndex: number, instanceId: string }} params
 */
export function searchDiscardPile(game, { playerIndex, instanceId }) {
  const player = game.players[playerIndex]
  if (!player) {
    return { game, error: 'Invalid player.' }
  }
  const card = game.discardPile.find((c) => c.instanceId === instanceId)
  if (!card) {
    return { game, error: 'Card not in discard pile.' }
  }
  if (!SEARCHABLE_DISCARD_TYPES.has(card.type)) {
    return { game, error: 'That card type cannot be retrieved this way.' }
  }
  const discardPile = game.discardPile.filter((c) => c.instanceId !== instanceId)
  const next = updatePlayer(
    { ...game, discardPile },
    playerIndex,
    { hand: [...player.hand, withFaceUp(card)] },
  )
  return { game: next, card }
}

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

/** @type {Record<string, (game: GameState, params: any) => { game: GameState, error?: string }>} */
const CARD_EFFECTS = {
  heavyBear: heavyBearEffect,
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
