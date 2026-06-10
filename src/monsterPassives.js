/**
 * monsterPassives.js
 *
 * All passive effects granted to a player when they slay a monster.
 * Each passive is keyed by the monster's `effectId`.
 *
 * Passives are grouped by their trigger event:
 *   - ON_HERO_DESTROYED    : fires when one of the passive-holder's heroes is destroyed
 *   - ON_DRAW_MAGIC_CARD   : fires when the passive-holder draws a Magic-type card
 *   - (future) ON_ROLL     : fires when the passive-holder makes any roll
 *   etc.
 *
 * Each handler receives (game, playerIndex) and returns a new GameState.
 */

import { CARD_TYPES } from './data/cardUtils.js'

/** @typedef {import('./gameState.js').GameState} GameState */
/** @typedef {import('./gameState.js').CardInstance} CardInstance */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Queue the "may draw a card" prompt for a player.
 * Reuses the same pendingLeaderWizardDraw state as the Wizard leader (104).
 *
 * @param {GameState} game
 * @param {number} playerIndex
 * @param {string} sourceLabel - label shown in the dialog title
 * @returns {GameState}
 */
function queueMayDraw(game, playerIndex, sourceLabel) {
  return { ...game, pendingLeaderWizardDraw: { playerIndex, sourceLabel } }
}

// ---------------------------------------------------------------------------
// ON_DRAW_MAGIC_CARD passives
// Triggered after the passive-holder draws one or more cards and at least one
// of them is a Magic type. Called with the first Magic card found.
// Handler signature: (game: GameState, playerIndex: number, magicCard: CardInstance) => GameState
// ---------------------------------------------------------------------------

/** @type {Record<string, (game: GameState, playerIndex: number, magicCard: CardInstance) => GameState>} */
const ON_DRAW_MAGIC_CARD = {
  /**
   * 202 Orthus
   * "Each time you Draw a magic card, you may play it immediately."
   * Reuses the existing pendingMagicPlayChoice mechanism.
   */
  slainMonsterDrawMagicPlay: (game, playerIndex, magicCard) => {
    // Don't overwrite an existing pending choice
    if (game.pendingMagicPlayChoice != null) return game
    return {
      ...game,
      pendingMagicPlayChoice: {
        sourcePlayerIndex: playerIndex,
        magicCard: { ...magicCard, faceUp: true },
        sourceLabel: 'Orthus',
        drawAfterPlay: 0,
      },
    }
  },
}

// ---------------------------------------------------------------------------
// ON_DRAW_ITEM_CARD passives
// Triggered after the passive-holder draws one or more cards and at least one
// of them is an Item type. Called with the first Item card found.
// Handler signature: (game: GameState, playerIndex: number, itemCard: CardInstance) => GameState
// ---------------------------------------------------------------------------

/** @type {Record<string, (game: GameState, playerIndex: number, itemCard: CardInstance) => GameState>} */
const ON_DRAW_ITEM_CARD = {
  /**
   * 214 Malamammoth
   * "Each time you draw an item card, you may play it immediately."
   * Reuses the existing pendingBonusItemPlay mechanism.
   */
  slainMonsterDrawItemPlay: (game, playerIndex, itemCard) => {
    if (game.pendingBonusItemPlay != null) return game
    return {
      ...game,
      pendingBonusItemPlay: {
        sourcePlayerIndex: playerIndex,
        sourceLabel: 'Malamammoth',
        eligibleInstanceIds: [itemCard.instanceId],
        drawAfter: 0,
      },
    }
  },
}

// ---------------------------------------------------------------------------
// ON_DRAW_MODIFIER_CARD passives
// Triggered after the passive-holder draws one or more cards and at least one
// of them is a Modifier type. Called with the first Modifier card found.
// Handler signature: (game: GameState, playerIndex: number, modifierCard: CardInstance) => GameState
// ---------------------------------------------------------------------------

/** @type {Record<string, (game: GameState, playerIndex: number, modifierCard: CardInstance) => GameState>} */
const ON_DRAW_MODIFIER_CARD = {
  /**
   * 215 Rex Major
   * "Each time you draw a Modifier card, you may reveal it to all other players and draw a second card."
   * Sets pendingModifierReveal with phase 'choice' so the holder can decide to reveal.
   */
  slainMonsterDrawModifierReveal: (game, playerIndex, modifierCard) => {
    // Don't overwrite an existing pending reveal
    if (game.pendingModifierReveal != null) return game
    return {
      ...game,
      pendingModifierReveal: {
        playerIndex,
        card: modifierCard,
        phase: 'choice',
      },
    }
  },
}

// ---------------------------------------------------------------------------
// ON_HERO_DESTROYED passives
// Triggered after one of the passive-holder's heroes is destroyed (not sacrificed).
// Handler signature: (game: GameState, playerIndex: number) => GameState
// ---------------------------------------------------------------------------

/** @type {Record<string, (game: GameState, playerIndex: number) => GameState>} */
const ON_HERO_DESTROYED = {
  /**
   * 201 Dracos
   * "Each time a hero card in your Party is destroyed, you may draw a card."
   */
  slainMonsterHeroDestroyDraw: (game, playerIndex) =>
    queueMayDraw(game, playerIndex, 'Dracos'),
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Called after any player plays a Modifier card.
 * Checks ALL players for a slainMonster passive that grants a draw on modifier play
 * (e.g. 205 Crowned Serpent). Sets pendingLeaderWizardDraw for the first holder found.
 * Safe to call if pendingLeaderWizardDraw is already set (skips in that case).
 *
 * @param {GameState} game
 * @returns {GameState}
 */
export function applyOnModifierPlayPassives(game) {
  if (game.pendingLeaderWizardDraw != null) return game
  for (let pi = 0; pi < game.players.length; pi++) {
    for (const monster of (game.players[pi].slainMonsters ?? [])) {
      if (monster.effectId === 'slainMonsterModifierDraw') {
        return { ...game, pendingLeaderWizardDraw: { playerIndex: pi, sourceLabel: monster.name } }
      }
    }
  }
  return game
}

/**
 * Returns true if the target player's party is permanently protected from
 * destroy effects by a slain monster passive (e.g. 204 Terratuga).
 *
 * @param {GameState} game
 * @param {number} targetPlayerIndex
 * @returns {boolean}
 */
export function isPartyDestroyBlockedByPassive(game, targetPlayerIndex) {
  return (game.players[targetPlayerIndex]?.slainMonsters ?? []).some(
    (m) => m.effectId === 'slainMonsterPartyAntiDestroy',
  )
}

/**
 * Call this after a player draws cards. If any drawn card is a Magic type and
 * the player holds an ON_DRAW_MAGIC_CARD passive, the handler is invoked with
 * the first Magic card found among the drawn cards.
 *
 * @param {GameState} game
 * @param {number} playerIndex - player who drew the cards
 * @param {CardInstance[]} drawnCards - the cards that were just drawn
 * @returns {GameState}
 */
export function applyOnDrawMagicCardPassives(game, playerIndex, drawnCards) {
  const player = game.players[playerIndex]
  if (!player || !drawnCards?.length) return game

  const magicCard = drawnCards.find((c) => c.type === CARD_TYPES.MAGIC)
  if (!magicCard) return game

  let state = game
  for (const monster of (player.slainMonsters ?? [])) {
    const handler = monster.effectId ? ON_DRAW_MAGIC_CARD[monster.effectId] : null
    if (handler) {
      state = handler(state, playerIndex, magicCard)
    }
  }
  return state
}

/**
 * Call this after a player draws cards. If any drawn card is an Item type and
 * the player holds an ON_DRAW_ITEM_CARD passive, the handler is invoked with
 * the first Item card found among the drawn cards.
 *
 * @param {GameState} game
 * @param {number} playerIndex
 * @param {CardInstance[]} drawnCards
 * @returns {GameState}
 */
export function applyOnDrawItemCardPassives(game, playerIndex, drawnCards) {
  const player = game.players[playerIndex]
  if (!player || !drawnCards?.length) return game

  const itemCard = drawnCards.find((c) => c.type === CARD_TYPES.ITEM)
  if (!itemCard) return game

  let state = game
  for (const monster of (player.slainMonsters ?? [])) {
    const handler = monster.effectId ? ON_DRAW_ITEM_CARD[monster.effectId] : null
    if (handler) {
      state = handler(state, playerIndex, itemCard)
    }
  }
  return state
}

/**
 * Call this after a player draws cards. If any drawn card is a Modifier type and
 * the player holds an ON_DRAW_MODIFIER_CARD passive, the handler is invoked with
 * the first Modifier card found among the drawn cards.
 *
 * @param {GameState} game
 * @param {number} playerIndex - player who drew the cards
 * @param {CardInstance[]} drawnCards - the cards that were just drawn
 * @returns {GameState}
 */
export function applyOnDrawModifierCardPassives(game, playerIndex, drawnCards) {
  const player = game.players[playerIndex]
  if (!player || !drawnCards?.length) return game

  const modifierCard = drawnCards.find((c) => c.type === CARD_TYPES.MODIFIER)
  if (!modifierCard) return game

  let state = game
  for (const monster of (player.slainMonsters ?? [])) {
    const handler = monster.effectId ? ON_DRAW_MODIFIER_CARD[monster.effectId] : null
    if (handler) {
      state = handler(state, playerIndex, modifierCard)
    }
  }
  return state
}

/**
 * Call this immediately after a hero belonging to `destroyedOwnerIndex` is
 * destroyed (NOT sacrificed). Checks that player's slainMonsters for any
 * ON_HERO_DESTROYED passive and applies the first matching one.
 *
 * @param {GameState} game
 * @param {number} destroyedOwnerIndex - player whose hero was just destroyed
 * @returns {GameState}
 */
export function applyOnHeroDestroyedPassives(game, destroyedOwnerIndex) {
  const player = game.players[destroyedOwnerIndex]
  if (!player) return game

  let state = game
  for (const monster of (player.slainMonsters ?? [])) {
    const handler = monster.effectId ? ON_HERO_DESTROYED[monster.effectId] : null
    if (handler) {
      state = handler(state, destroyedOwnerIndex)
    }
  }
  return state
}
