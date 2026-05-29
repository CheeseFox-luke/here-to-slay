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

/**
 * Find which player owns a given hero (by instanceId) and the slot index.
 * @param {GameState} game
 * @param {string} heroInstanceId
 * @returns {{ playerIndex: number, slotIndex: number } | null}
 */
function findHeroLocation(game, heroInstanceId) {
  for (let pi = 0; pi < game.players.length; pi++) {
    const slots = game.players[pi].partySlots
    const si = slots.findIndex((s) => s?.hero.instanceId === heroInstanceId)
    if (si !== -1) return { playerIndex: pi, slotIndex: si }
  }
  return null
}

/**
 * Set or clear a boolean flag on a specific hero (by instanceId), wherever it lives.
 * @param {GameState} game
 * @param {string} heroInstanceId
 * @param {'antiSteal' | 'antiDestroy'} flag
 * @param {boolean} value
 */
function setHeroProtectionFlag(game, heroInstanceId, flag, value) {
  const loc = findHeroLocation(game, heroInstanceId)
  if (!loc) return { game, error: 'Hero not found.' }
  const player = game.players[loc.playerIndex]
  const partySlots = clonePartySlots(player.partySlots)
  const slot = partySlots[loc.slotIndex]
  partySlots[loc.slotIndex] = {
    ...slot,
    hero: { ...slot.hero, [flag]: value },
  }
  return { game: updatePlayer(game, loc.playerIndex, { partySlots }) }
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
 * Remove a card from a player's hand without sending it to the discard pile.
 * Used when cards are staged (e.g. Beary Wise) before a later resolution.
 *
 * @param {GameState} game
 * @param {{ playerIndex: number, instanceId: string }} params
 */
export function removeCardFromHand(game, { playerIndex, instanceId }) {
  const player = game.players[playerIndex]
  if (!player) {
    return { game, error: 'Invalid player.' }
  }
  const card = player.hand.find((c) => c.instanceId === instanceId)
  if (!card) {
    return { game, error: 'Card not in hand.' }
  }
  const hand = player.hand.filter((c) => c.instanceId !== instanceId)
  const next = updatePlayer(game, playerIndex, { hand })
  return { game: next, card: withFaceUp(card) }
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
  const target = game.players[targetPlayerIndex]
  const slot = target?.partySlots.find((s) => s?.hero.instanceId === heroInstanceId)
  if (slot?.hero?.antiDestroy === true) {
    return { game, error: 'That hero cannot be destroyed (antiDestroy).' }
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
  if (target.partySlots[targetSlotIndex].hero.antiSteal === true) {
    return { game, error: 'That hero cannot be stolen (antiSteal).' }
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
 * Swap two heroes (with their items) between two different parties.
 * heroA in player A's party trades slots with heroB in player B's party.
 * Both heroes are marked `skillUsedThisTurn: true` after the swap so they
 * can't immediately re-trigger their skills.
 *
 * @param {GameState} game
 * @param {{
 *   playerAIndex: number,
 *   heroAInstanceId: string,
 *   playerBIndex: number,
 *   heroBInstanceId: string,
 * }} params
 */
export function swapHero(game, {
  playerAIndex,
  heroAInstanceId,
  playerBIndex,
  heroBInstanceId,
}) {
  if (playerAIndex === playerBIndex) {
    return { game, error: 'Cannot swap heroes within the same party.' }
  }
  const playerA = game.players[playerAIndex]
  const playerB = game.players[playerBIndex]
  if (!playerA || !playerB) {
    return { game, error: 'Invalid players.' }
  }

  const slotAIndex = playerA.partySlots.findIndex(
    (s) => s?.hero.instanceId === heroAInstanceId,
  )
  const slotBIndex = playerB.partySlots.findIndex(
    (s) => s?.hero.instanceId === heroBInstanceId,
  )
  if (slotAIndex === -1) {
    return { game, error: "Source hero not in player A's party." }
  }
  if (slotBIndex === -1) {
    return { game, error: "Target hero not in player B's party." }
  }

  const slotA = playerA.partySlots[slotAIndex]
  const slotB = playerB.partySlots[slotBIndex]

  const aSlots = clonePartySlots(playerA.partySlots)
  aSlots[slotAIndex] = {
    hero: slotB.hero,
    items: [...slotB.items],
    skillUsedThisTurn: true,
  }

  const bSlots = clonePartySlots(playerB.partySlots)
  bSlots[slotBIndex] = {
    hero: slotA.hero,
    items: [...slotA.items],
    skillUsedThisTurn: true,
  }

  let next = updatePlayer(game, playerAIndex, { partySlots: aSlots })
  next = updatePlayer(next, playerBIndex, { partySlots: bSlots })

  return {
    game: next,
    swapped: { heroFromA: slotA.hero, heroFromB: slotB.hero },
  }
}

/**
 * Take a specific card from another player's hand into your own hand.
 * @param {GameState} game
 * @param {{
 *   sourcePlayerIndex: number,
 *   targetPlayerIndex: number,
 *   instanceId: string,
 * }} params
 */
export function take(game, { sourcePlayerIndex, targetPlayerIndex, instanceId }) {
  const source = game.players[sourcePlayerIndex]
  const target = game.players[targetPlayerIndex]
  if (!source || !target) {
    return { game, error: 'Invalid players.' }
  }
  const card = target.hand.find((c) => c.instanceId === instanceId)
  if (!card) {
    return { game, error: "Card not in target's hand." }
  }
  const targetHand = target.hand.filter((c) => c.instanceId !== instanceId)
  const sourceHand = [...source.hand, withFaceUp(card)]
  let next = updatePlayer(game, targetPlayerIndex, { hand: targetHand })
  next = updatePlayer(next, sourcePlayerIndex, { hand: sourceHand })
  return { game: next, card: withFaceUp(card) }
}

/**
 * Pull a specific card from another player's hand into your own.
 * Semantically identical to `take`; exposed under a distinct name for card
 * effects that describe the action as "pulling" a card.
 *
 * @param {GameState} game
 * @param {{
 *   sourcePlayerIndex: number,
 *   targetPlayerIndex: number,
 *   instanceId: string,
 * }} params
 */
export function pull(game, { sourcePlayerIndex, targetPlayerIndex, instanceId }) {
  return take(game, { sourcePlayerIndex, targetPlayerIndex, instanceId })
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

/**
 * Swap two players' entire hands.
 * @param {GameState} game
 * @param {{ playerAIndex: number, playerBIndex: number }} params
 */
export function swapHands(game, { playerAIndex, playerBIndex }) {
  if (playerAIndex === playerBIndex) {
    return { game, error: 'Cannot swap hands with yourself.' }
  }
  const playerA = game.players[playerAIndex]
  const playerB = game.players[playerBIndex]
  if (!playerA || !playerB) {
    return { game, error: 'Invalid players.' }
  }
  const handA = playerA.hand
  const handB = playerB.hand
  let next = updatePlayer(game, playerAIndex, { hand: handB })
  next = updatePlayer(next, playerBIndex, { hand: handA })
  return { game: next }
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

/* ------------------------------------------------------------- *
 * Protection / "anti" effects                                    *
 *  - Hero-level: antiSteal / antiDestroy live on the hero card   *
 *  - Game-level: antiChallenge / antiModifier live on GameState  *
 *                                                                *
 * These atomic toggles only flip the flags. Enforcement happens  *
 * in `steal` / `destroy` (above) and in the corresponding action *
 * handlers in gameActions.js (challenge / modifier).             *
 * ------------------------------------------------------------- */

/**
 * Mark a specific hero with antiSteal so STEAL cannot select it as a target.
 * @param {GameState} game
 * @param {{ heroInstanceId: string }} params
 */
export function applyAntiSteal(game, { heroInstanceId }) {
  return setHeroProtectionFlag(game, heroInstanceId, 'antiSteal', true)
}

/**
 * Clear antiSteal from a specific hero.
 * @param {GameState} game
 * @param {{ heroInstanceId: string }} params
 */
export function clearAntiSteal(game, { heroInstanceId }) {
  return setHeroProtectionFlag(game, heroInstanceId, 'antiSteal', false)
}

/**
 * Mark a specific hero with antiDestroy so DESTROY cannot select it as a target.
 * @param {GameState} game
 * @param {{ heroInstanceId: string }} params
 */
export function applyAntiDestroy(game, { heroInstanceId }) {
  return setHeroProtectionFlag(game, heroInstanceId, 'antiDestroy', true)
}

/**
 * Clear antiDestroy from a specific hero.
 * @param {GameState} game
 * @param {{ heroInstanceId: string }} params
 */
export function clearAntiDestroy(game, { heroInstanceId }) {
  return setHeroProtectionFlag(game, heroInstanceId, 'antiDestroy', false)
}

/**
 * Block all players from playing Challenge cards until cleared.
 * @param {GameState} game
 */
export function applyAntiChallenge(game) {
  return { game: { ...game, antiChallenge: true } }
}

/**
 * Allow Challenge cards to be played again.
 * @param {GameState} game
 */
export function clearAntiChallenge(game) {
  return { game: { ...game, antiChallenge: false } }
}

/**
 * Block all players from playing Modifier cards until cleared.
 * @param {GameState} game
 */
export function applyAntiModifier(game) {
  return { game: { ...game, antiModifier: true } }
}

/**
 * Allow Modifier cards to be played again.
 * @param {GameState} game
 */
export function clearAntiModifier(game) {
  return { game: { ...game, antiModifier: false } }
}

