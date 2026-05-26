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
 * Internal: move a hero (with its items) from a player's party to the discard pile.
 * Both `sacrifice` and `destroy` share this; they differ only in who is allowed to
 * pick the hero (own vs opponent), which is enforced at the action / pending-selection
 * layer, not here.
 *
 * @param {GameState} game
 * @param {number} ownerPlayerIndex
 * @param {string} heroInstanceId
 */
function removeHeroToDiscard(game, ownerPlayerIndex, heroInstanceId) {
  const owner = game.players[ownerPlayerIndex]
  if (!owner) {
    return { game, error: 'Invalid player.' }
  }
  const slotIndex = owner.partySlots.findIndex(
    (s) => s?.hero.instanceId === heroInstanceId,
  )
  if (slotIndex === -1) {
    return { game, error: 'Hero not in that party.' }
  }
  const slot = owner.partySlots[slotIndex]
  const partySlots = clonePartySlots(owner.partySlots)
  partySlots[slotIndex] = null
  const discarded = [
    withFaceUp(slot.hero),
    ...slot.items.map((c) => withFaceUp(c)),
  ]
  const discardPile = [...game.discardPile, ...discarded]
  const next = {
    ...updatePlayer(game, ownerPlayerIndex, { partySlots }),
    discardPile,
  }
  return { game: next, discarded }
}

/**
 * SACRIFICE: a player sends one of *their own* heroes to the discard pile.
 * `playerIndex` here is both the source AND the owner of the hero. The scope
 * restriction (only your own heroes) is the caller's responsibility.
 *
 * @param {GameState} game
 * @param {{ playerIndex: number, heroInstanceId: string }} params
 */
export function sacrifice(game, { playerIndex, heroInstanceId }) {
  return removeHeroToDiscard(game, playerIndex, heroInstanceId)
}

/**
 * DESTROY: a player sends a hero owned by a *different* player to the discard pile.
 * `sourcePlayerIndex` is who's running the effect; `targetPlayerIndex` is the
 * victim. If they are the same, this is rejected — use `sacrifice` instead.
 *
 * @param {GameState} game
 * @param {{
 *   sourcePlayerIndex: number,
 *   targetPlayerIndex: number,
 *   heroInstanceId: string,
 * }} params
 */
export function destroy(game, { sourcePlayerIndex, targetPlayerIndex, heroInstanceId }) {
  if (sourcePlayerIndex === targetPlayerIndex) {
    return { game, error: 'Use sacrifice to remove your own hero.' }
  }
  return removeHeroToDiscard(game, targetPlayerIndex, heroInstanceId)
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

