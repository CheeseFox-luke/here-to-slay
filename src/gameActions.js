import { CARD_TYPES } from './data/cardUtils.js'
import {
  getModifierEffect,
  resolveModifierDelta,
} from './data/modifierEffects.js'
import { canDrawFromMainDeck, drawFromMainDeck } from './deckHelpers.js'
import {
  applyDeltaToChallengeRoll,
  applyDeltaToPendingRoll,
  rollForChallenge,
  rollForHeroEffect,
  rollForMonsterAttack,
} from './dice.js'
import { discard as discardEffect, runCardEffect } from './effects.js'
import {
  ATTACK_MONSTER_AP_COST,
  DRAW_CARD_AP_COST,
  INITIAL_ACTION_POINTS,
  RESTOCK_HAND_AP_COST,
  RESTOCK_HAND_SIZE,
  findFirstEmptyPartyIndex,
  partyHasHero,
  withFaceUp,
} from './gameState.js'

/** @typedef {import('./gameState.js').GameState} GameState */
/** @typedef {import('./gameState.js').CardInstance} CardInstance */
/** @typedef {import('./gameState.js').PartySlot} PartySlot */
/** @typedef {import('./gameState.js').PendingRoll} PendingRoll */
/** @typedef {import('./gameState.js').StagedPlay} StagedPlay */

export const PLAYABLE_CARD_TYPES = [
  CARD_TYPES.HERO,
  CARD_TYPES.MAGIC,
  CARD_TYPES.ITEM,
]

export const RESTOCK_HAND_ACTION_NAME = 'Restock Hand'
export const ATTACK_MONSTER_ACTION_NAME = 'Attack Monster'

/**
 * @param {GameState} game
 */
export function isModifierPhaseActive(game) {
  return game.pendingRoll !== null
}

/**
 * @param {GameState} game
 */
export function isChallengeWindowActive(game) {
  return game.pendingChallenge !== null
}

/**
 * @param {GameState} game
 */
export function isEffectTargetSelectionActive(game) {
  return game.pendingEffectTargetSelection !== null
}

/**
 * @param {GameState} game
 */
export function isPendingDiscardActive(game) {
  return game.pendingDiscard !== null
}

/**
 * @param {GameState} game
 */
export function isInterruptPhaseActive(game) {
  return (
    isChallengeWindowActive(game) ||
    isModifierPhaseActive(game) ||
    isEffectTargetSelectionActive(game) ||
    isPendingDiscardActive(game)
  )
}

/**
 * @param {GameState} game
 */
export function getChallengeDefenderIndex(game) {
  return game.pendingChallenge?.defenderIndex ?? -1
}

/**
 * @param {CardInstance} card
 * @param {GameState} game
 * @param {number} playerIndex
 */
export function isPlayableFromHand(card, game, playerIndex) {
  if (isPendingDiscardActive(game)) {
    return (
      game.pendingDiscard.playerIndex === playerIndex &&
      game.players[playerIndex].hand.some(
        (c) => c.instanceId === card.instanceId,
      )
    )
  }

  if (isEffectTargetSelectionActive(game)) {
    return false
  }

  if (isModifierPhaseActive(game)) {
    if (card.type !== CARD_TYPES.MODIFIER) {
      return false
    }
    return game.players[playerIndex].hand.some(
      (c) => c.instanceId === card.instanceId,
    )
  }

  if (isChallengeWindowActive(game)) {
    if (card.type !== CARD_TYPES.CHALLENGE) {
      return false
    }
    return playerIndex === game.pendingChallenge.defenderIndex
  }

  if (playerIndex !== game.currentPlayerIndex) {
    return false
  }

  if (card.type === CARD_TYPES.ITEM) {
    return partyHasHero(game.players[playerIndex].partySlots)
  }

  return PLAYABLE_CARD_TYPES.includes(card.type)
}

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
 * @param {(PartySlot | null)[]} partySlots
 */
export function resetPartySkillUsage(partySlots) {
  return partySlots.map((slot) =>
    slot ? { ...slot, skillUsedThisTurn: false } : null,
  )
}

/**
 * Attach effect metadata to a fresh hero pendingRoll.
 * @param {PendingRoll} pendingRoll
 * @param {CardInstance} heroCard
 * @param {number} sourcePlayerIndex
 */
function attachHeroEffectMeta(pendingRoll, heroCard, sourcePlayerIndex) {
  return {
    ...pendingRoll,
    heroName: heroCard.name,
    targetLabel: `${heroCard.name} skill`,
    ...(heroCard.effectId
      ? {
          effectId: heroCard.effectId,
          effectTargeted: heroCard.targeted === true,
          effectSourcePlayerIndex: sourcePlayerIndex,
          effectPhase: 'pre-target',
        }
      : {}),
  }
}

/**
 * If a targeted hero rolled a success on the first try, skip the pre-target
 * modifier window: jump straight to target selection. Otherwise the roll keeps
 * a normal pendingRoll so the modifier window opens.
 * @param {PendingRoll} pendingRoll
 * @returns {{
 *   pendingRoll: PendingRoll | null,
 *   pendingEffectTargetSelection: import('./gameState.js').PendingEffectTargetSelection | null,
 * }}
 */
function distributeHeroRoll(pendingRoll) {
  if (!pendingRoll.effectId || !pendingRoll.effectTargeted) {
    return { pendingRoll, pendingEffectTargetSelection: null }
  }
  const success = pendingRoll.currentSum >= (pendingRoll.requirement ?? 6)
  if (!success) {
    return { pendingRoll, pendingEffectTargetSelection: null }
  }
  return {
    pendingRoll: null,
    pendingEffectTargetSelection: {
      sourcePlayerIndex: pendingRoll.effectSourcePlayerIndex ?? 0,
      effectId: pendingRoll.effectId,
      heroName: pendingRoll.heroName ?? 'Hero',
      resumeRoll: pendingRoll,
    },
  }
}

/**
 * @param {GameState} game
 * @param {StagedPlay} staged
 */
function resolveStagedPlay(game, staged) {
  const { card, attackerIndex, cardType, itemSlotIndex } = staged
  const player = game.players[attackerIndex]
  let partySlots = clonePartySlots(player.partySlots)
  let discardPile = game.discardPile
  /** @type {PendingRoll | null} */
  let pendingRoll = null

  const played = withFaceUp(card)

  if (cardType === CARD_TYPES.HERO) {
    const emptyIndex = findFirstEmptyPartyIndex(partySlots)
    if (emptyIndex === -1) {
      return { game, diceRoll: null, error: 'No empty party slot.' }
    }
    partySlots = [...partySlots]
    partySlots[emptyIndex] = {
      hero: played,
      items: [],
      skillUsedThisTurn: true,
    }
    const baseRoll = rollForHeroEffect(
      played.rollRequirement ?? 6,
      attackerIndex,
    )
    pendingRoll = attachHeroEffectMeta(baseRoll, played, attackerIndex)
  } else if (cardType === CARD_TYPES.MAGIC) {
    discardPile = [...discardPile, played]
  } else if (cardType === CARD_TYPES.ITEM) {
    if (itemSlotIndex === undefined || itemSlotIndex < 0) {
      return { game, diceRoll: null, error: 'Invalid item target.' }
    }
    const slot = partySlots[itemSlotIndex]
    if (!slot) {
      return { game, diceRoll: null, error: 'Hero slot not found.' }
    }
    partySlots = [...partySlots]
    partySlots[itemSlotIndex] = {
      ...slot,
      items: [...slot.items, played],
    }
  }

  const players = game.players.map((p, index) =>
    index === attackerIndex ? { ...p, partySlots } : p,
  )

  const distributed = pendingRoll
    ? distributeHeroRoll(pendingRoll)
    : { pendingRoll: null, pendingEffectTargetSelection: null }

  return {
    game: {
      ...game,
      players,
      discardPile,
      pendingRoll: distributed.pendingRoll,
      pendingEffectTargetSelection: distributed.pendingEffectTargetSelection,
    },
    diceRoll: pendingRoll,
    error: null,
  }
}

/**
 * @param {GameState} game
 * @param {string} instanceId
 * @param {number} [itemSlotIndex]
 */
function beginStagedPlay(game, instanceId, itemSlotIndex) {
  if (isInterruptPhaseActive(game)) {
    return { game, error: 'Finish the current window first.' }
  }
  if (game.actionPoints <= 0) {
    return { game, error: 'Not enough action points.' }
  }

  const playerIndex = game.currentPlayerIndex
  const player = game.players[playerIndex]
  const handIndex = player.hand.findIndex((c) => c.instanceId === instanceId)

  if (handIndex === -1) {
    return { game, error: 'Card not in hand.' }
  }

  const card = player.hand[handIndex]
  if (!isPlayableFromHand(card, game, playerIndex)) {
    return { game, error: 'Cannot play this card now.' }
  }

  if (card.type === CARD_TYPES.ITEM) {
    if (!partyHasHero(player.partySlots)) {
      return { game, error: 'You need a hero in your party to equip an item.' }
    }
    if (itemSlotIndex === undefined) {
      return { game, error: 'Choose a hero to equip this item.' }
    }
    const slot = player.partySlots[itemSlotIndex]
    if (!slot) {
      return { game, error: 'Choose a hero in your party.' }
    }
  }

  if (card.type === CARD_TYPES.HERO) {
    const emptyIndex = findFirstEmptyPartyIndex(player.partySlots)
    if (emptyIndex === -1) {
      return { game, error: 'No empty party slot.' }
    }
  }

  const played = withFaceUp(card)
  const hand = player.hand.filter((_, index) => index !== handIndex)
  const defenderIndex = (playerIndex + 1) % game.players.length

  /** @type {StagedPlay} */
  const stagedPlay = {
    card: played,
    attackerIndex: playerIndex,
    cardType: card.type,
    itemSlotIndex,
  }

  const players = game.players.map((p, index) =>
    index === playerIndex ? { ...p, hand } : p,
  )

  return {
    game: {
      ...game,
      players,
      actionPoints: game.actionPoints - 1,
      pendingChallenge: { stagedPlay, defenderIndex },
    },
    error: null,
  }
}

/**
 * @param {GameState} game
 * @param {string} instanceId
 */
export function playCardFromHand(game, instanceId) {
  const playerIndex = game.currentPlayerIndex
  const player = game.players[playerIndex]
  const card = player.hand.find((c) => c.instanceId === instanceId)

  if (!card) {
    return { game, diceRoll: null, error: 'Card not in hand.' }
  }

  if (card.type === CARD_TYPES.ITEM) {
    return { game, diceRoll: null, error: 'Select a hero to equip this item.' }
  }

  const { game: nextGame, error } = beginStagedPlay(game, instanceId)
  return { game: nextGame, diceRoll: null, error }
}

/**
 * @param {GameState} game
 * @param {string} instanceId
 * @param {string} heroInstanceId
 */
export function playItemOnHero(game, instanceId, heroInstanceId) {
  const playerIndex = game.currentPlayerIndex
  const player = game.players[playerIndex]
  const slotIndex = player.partySlots.findIndex(
    (slot) => slot?.hero.instanceId === heroInstanceId,
  )

  if (slotIndex === -1) {
    return { game, diceRoll: null, error: 'Hero not found in your party.' }
  }

  const { game: nextGame, error } = beginStagedPlay(game, instanceId, slotIndex)
  return { game: nextGame, diceRoll: null, error }
}

/**
 * @param {GameState} game
 */
export function passChallengeWindow(game) {
  if (!game.pendingChallenge) {
    return { game, diceRoll: null }
  }

  const staged = game.pendingChallenge.stagedPlay
  const cleared = { ...game, pendingChallenge: null }
  return resolveStagedPlay(cleared, staged)
}

/**
 * @param {GameState} game
 * @param {number} challengerIndex
 * @param {string} instanceId
 */
export function playChallengeCard(game, challengerIndex, instanceId) {
  if (!game.pendingChallenge) {
    return { game, error: 'No play is open for a challenge.' }
  }

  if (challengerIndex !== game.pendingChallenge.defenderIndex) {
    return { game, error: 'Only the opponent may play a challenge.' }
  }

  const challenger = game.players[challengerIndex]
  const handIndex = challenger.hand.findIndex((c) => c.instanceId === instanceId)

  if (handIndex === -1) {
    return { game, error: 'Challenge card not in that player\'s hand.' }
  }

  const card = challenger.hand[handIndex]
  if (card.type !== CARD_TYPES.CHALLENGE) {
    return { game, error: 'Not a challenge card.' }
  }

  const staged = game.pendingChallenge.stagedPlay
  const attacker = game.players[staged.attackerIndex]

  const pendingRoll = rollForChallenge(
    staged.attackerIndex,
    challengerIndex,
    attacker.name,
    challenger.name,
    staged,
  )

  const hand = challenger.hand.filter((_, index) => index !== handIndex)
  const discardPile = [...game.discardPile, withFaceUp(card)]

  const players = game.players.map((p, index) =>
    index === challengerIndex ? { ...p, hand } : p,
  )

  return {
    game: {
      ...game,
      players,
      discardPile,
      pendingChallenge: null,
      pendingRoll,
    },
    pendingRoll,
    error: null,
  }
}

/**
 * @param {GameState} game
 */
function finalizeChallenge(game) {
  const pending = game.pendingRoll
  if (!pending || pending.rollType !== 'challenge' || !pending.stagedPlay) {
    return { game, diceRoll: null, challengeSuccess: false }
  }

  const attackerSum = pending.attackerRoll?.currentSum ?? 0
  const challengerSum = pending.challengerRoll?.currentSum ?? 0
  const challengerWins = challengerSum >= attackerSum

  if (challengerWins) {
    const discardPile = [...game.discardPile, withFaceUp(pending.stagedPlay.card)]
    /** @type {PendingRoll} */
    const resultRoll = {
      ...pending,
      challengeResolved: true,
      challengeSuccess: true,
      targetLabel: `Challenge successful! ${pending.stagedPlay.card.name} discarded.`,
      showGreen: true,
      showRed: false,
      showGray: false,
      showFail: false,
    }

    return {
      game: {
        ...game,
        discardPile,
        pendingRoll: null,
        pendingChallenge: null,
      },
      diceRoll: resultRoll,
      challengeSuccess: true,
    }
  }

  const cleared = { ...game, pendingRoll: null }
  const resolved = resolveStagedPlay(cleared, pending.stagedPlay)
  return {
    ...resolved,
    challengeSuccess: false,
  }
}

/**
 * @param {GameState} game
 * @param {string} heroInstanceId
 */
export function triggerHeroSkill(game, heroInstanceId) {
  if (isInterruptPhaseActive(game)) {
    return { game, diceRoll: null, error: 'Finish the challenge or modifier window first.' }
  }
  if (game.actionPoints <= 0) {
    return { game, diceRoll: null, error: 'Not enough action points.' }
  }

  const playerIndex = game.currentPlayerIndex
  const player = game.players[playerIndex]
  const slotIndex = player.partySlots.findIndex(
    (slot) => slot?.hero.instanceId === heroInstanceId,
  )

  if (slotIndex === -1) {
    return { game, diceRoll: null, error: 'Hero not found on your party.' }
  }

  const slot = player.partySlots[slotIndex]
  if (!slot || slot.skillUsedThisTurn) {
    return {
      game,
      diceRoll: null,
      error: 'This hero already used their skill this turn.',
    }
  }

  const partySlots = clonePartySlots(player.partySlots)
  partySlots[slotIndex] = { ...slot, skillUsedThisTurn: true }

  const baseRoll = rollForHeroEffect(
    slot.hero.rollRequirement ?? 6,
    playerIndex,
  )
  const pendingRoll = attachHeroEffectMeta(baseRoll, slot.hero, playerIndex)
  const distributed = distributeHeroRoll(pendingRoll)

  const players = game.players.map((p, index) =>
    index === playerIndex ? { ...p, partySlots } : p,
  )

  return {
    game: {
      ...game,
      players,
      actionPoints: game.actionPoints - 1,
      pendingRoll: distributed.pendingRoll,
      pendingEffectTargetSelection: distributed.pendingEffectTargetSelection,
    },
    diceRoll: pendingRoll,
  }
}

/**
 * @param {GameState} game
 * @param {string} monsterInstanceId
 */
export function attackMonster(game, monsterInstanceId) {
  if (isInterruptPhaseActive(game)) {
    return { game, diceRoll: null, error: 'Finish the challenge or modifier window first.' }
  }
  if (game.actionPoints < ATTACK_MONSTER_AP_COST) {
    return {
      game,
      diceRoll: null,
      error: `Attack Monster costs ${ATTACK_MONSTER_AP_COST} action points.`,
    }
  }

  const playerIndex = game.currentPlayerIndex
  const monster = game.activeMonsters.find(
    (m) => m.instanceId === monsterInstanceId,
  )

  if (!monster) {
    return { game, diceRoll: null, error: 'Monster not found.' }
  }

  const pendingRoll = rollForMonsterAttack(
    monster.instanceId,
    monster.name,
    playerIndex,
    monster.failAtOrBelow ?? 5,
    monster.successAtOrAbove ?? 8,
  )

  return {
    game: {
      ...game,
      actionPoints: game.actionPoints - ATTACK_MONSTER_AP_COST,
      pendingRoll,
    },
    diceRoll: pendingRoll,
  }
}

/**
 * @param {GameState} game
 * @param {number} playerIndex
 * @param {string} instanceId
 * @param {number} [choiceIndex]
 * @param {'attacker' | 'challenger'} [challengeTarget]
 */
export function playModifierOnPendingRoll(
  game,
  playerIndex,
  instanceId,
  choiceIndex,
  challengeTarget,
) {
  if (!game.pendingRoll) {
    return { game, error: 'No roll is waiting for a modifier.' }
  }

  if (game.pendingRoll.rollType === 'challenge' && !challengeTarget) {
    return { game, error: 'Choose which player\'s roll to modify.' }
  }

  const player = game.players[playerIndex]
  if (!player) {
    return { game, error: 'Invalid player.' }
  }

  const handIndex = player.hand.findIndex((c) => c.instanceId === instanceId)

  if (handIndex === -1) {
    return { game, error: 'Modifier not in that player\'s hand.' }
  }

  const card = player.hand[handIndex]
  if (card.type !== CARD_TYPES.MODIFIER) {
    return { game, error: 'Not a modifier card.' }
  }

  const effect = card.modifierEffect ?? getModifierEffect(card.id)
  if (!effect) {
    return { game, error: 'Unknown modifier effect.' }
  }

  const delta = resolveModifierDelta(effect, choiceIndex)
  if (delta === null) {
    return { game, error: 'Choose a modifier option.' }
  }

  const modifierLabel =
    effect.type === 'fixed'
      ? `${player.name}: ${delta >= 0 ? '+' : ''}${delta}`
      : `${player.name}: ${effect.options[choiceIndex]?.label ?? delta}`

  const pendingRoll =
    game.pendingRoll.rollType === 'challenge'
      ? applyDeltaToChallengeRoll(
          game.pendingRoll,
          delta,
          modifierLabel,
          challengeTarget,
        )
      : applyDeltaToPendingRoll(game.pendingRoll, delta, modifierLabel)

  const hand = player.hand.filter((_, index) => index !== handIndex)
  const discardPile = [...game.discardPile, withFaceUp(card)]

  const players = game.players.map((p, index) =>
    index === playerIndex ? { ...p, hand } : p,
  )

  return {
    game: {
      ...game,
      players,
      discardPile,
      pendingRoll,
    },
    pendingRoll,
  }
}

/**
 * @param {GameState} game
 */
function finalizeHeroRoll(game) {
  const pending = game.pendingRoll
  if (!pending || pending.rollType !== 'hero') {
    return { game, diceRoll: null }
  }

  const requirement = pending.requirement ?? 6
  const success = pending.currentSum >= requirement

  if (!pending.effectId) {
    return {
      game: { ...game, pendingRoll: null },
      diceRoll: null,
    }
  }

  if (!success) {
    return {
      game: { ...game, pendingRoll: null },
      diceRoll: null,
    }
  }

  if (pending.effectTargeted && pending.effectPhase === 'pre-target') {
    /** @type {import('./gameState.js').PendingEffectTargetSelection} */
    const sel = {
      sourcePlayerIndex: pending.effectSourcePlayerIndex ?? 0,
      effectId: pending.effectId,
      heroName: pending.heroName ?? 'Hero',
      resumeRoll: pending,
    }
    return {
      game: {
        ...game,
        pendingRoll: null,
        pendingEffectTargetSelection: sel,
      },
      diceRoll: null,
    }
  }

  const { game: afterEffect, error } = runCardEffect(game, pending.effectId, {
    sourcePlayerIndex: pending.effectSourcePlayerIndex,
    targetPlayerIndex: pending.effectTargetPlayerIndex,
    sourceLabel: pending.heroName,
  })

  return {
    game: { ...afterEffect, pendingRoll: null },
    diceRoll: null,
    effectError: error,
  }
}

/**
 * @param {GameState} game
 */
export function passModifierPhase(game) {
  if (!game.pendingRoll) {
    return game
  }

  if (game.pendingRoll.rollType === 'challenge') {
    return finalizeChallenge(game).game
  }

  if (game.pendingRoll.rollType === 'hero') {
    return finalizeHeroRoll(game).game
  }

  return { ...game, pendingRoll: null }
}

/**
 * @param {GameState} game
 */
export function passModifierPhaseWithResult(game) {
  if (!game.pendingRoll) {
    return { game, diceRoll: null, challengeSuccess: false }
  }

  if (game.pendingRoll.rollType === 'challenge') {
    return finalizeChallenge(game)
  }

  if (game.pendingRoll.rollType === 'hero') {
    return { ...finalizeHeroRoll(game), challengeSuccess: false }
  }

  return {
    game: { ...game, pendingRoll: null },
    diceRoll: null,
    challengeSuccess: false,
  }
}

/**
 * Player who initiated a targeted hero effect picks which player receives it.
 * Re-opens the modifier window with `effectPhase: 'post-target'`.
 *
 * @param {GameState} game
 * @param {number} targetPlayerIndex
 */
export function selectEffectTarget(game, targetPlayerIndex) {
  const sel = game.pendingEffectTargetSelection
  if (!sel) {
    return { game, error: 'No target selection pending.' }
  }
  if (!game.players[targetPlayerIndex]) {
    return { game, error: 'Invalid target.' }
  }
  if (targetPlayerIndex === sel.sourcePlayerIndex) {
    return { game, error: 'You must choose another player.' }
  }

  const targetName = game.players[targetPlayerIndex].name
  /** @type {PendingRoll} */
  const resumed = {
    ...sel.resumeRoll,
    effectPhase: 'post-target',
    effectTargetPlayerIndex: targetPlayerIndex,
    targetLabel: `${sel.heroName} → ${targetName}`,
  }

  return {
    game: {
      ...game,
      pendingEffectTargetSelection: null,
      pendingRoll: resumed,
    },
    pendingRoll: resumed,
  }
}

/**
 * Target player discards one of their cards to satisfy a pending discard.
 * @param {GameState} game
 * @param {number} playerIndex
 * @param {string} instanceId
 */
export function discardForPendingDiscard(game, playerIndex, instanceId) {
  const pending = game.pendingDiscard
  if (!pending) {
    return { game, error: 'No discard required.' }
  }
  if (pending.playerIndex !== playerIndex) {
    return { game, error: 'This is not your discard.' }
  }
  const { game: afterDiscard, error } = discardEffect(game, {
    playerIndex,
    instanceId,
  })
  if (error) {
    return { game, error }
  }
  const remaining = pending.count - 1
  return {
    game: {
      ...afterDiscard,
      pendingDiscard:
        remaining > 0 ? { ...pending, count: remaining } : null,
    },
  }
}

/**
 * @param {GameState} game
 */
export function restockHand(game) {
  if (isInterruptPhaseActive(game)) {
    return { game, error: 'Finish the challenge or modifier window first.' }
  }
  if (game.actionPoints < RESTOCK_HAND_AP_COST) {
    return {
      game,
      error: `Restock Hand costs ${RESTOCK_HAND_AP_COST} action points.`,
    }
  }

  const playerIndex = game.currentPlayerIndex
  const player = game.players[playerIndex]

  let state = {
    ...game,
    discardPile: [
      ...game.discardPile,
      ...player.hand.map((card) => withFaceUp(card)),
    ],
    actionPoints: game.actionPoints - RESTOCK_HAND_AP_COST,
  }

  const { game: afterDraw, drawn } = drawFromMainDeck(state, RESTOCK_HAND_SIZE)

  const players = afterDraw.players.map((p, index) =>
    index === playerIndex ? { ...p, hand: drawn } : p,
  )

  return { game: { ...afterDraw, players } }
}

/**
 * @param {GameState} game
 */
export function drawCard(game) {
  if (isInterruptPhaseActive(game)) {
    return { game, error: 'Finish the challenge or modifier window first.' }
  }
  if (game.actionPoints < DRAW_CARD_AP_COST) {
    return { game, error: `Draw card costs ${DRAW_CARD_AP_COST} action point.` }
  }
  if (!canDrawFromMainDeck(game)) {
    return { game, error: 'No cards left to draw.' }
  }

  const playerIndex = game.currentPlayerIndex
  const { game: afterDraw, drawn } = drawFromMainDeck(game, 1)

  if (drawn.length === 0) {
    return { game, error: 'No cards left to draw.' }
  }

  const players = afterDraw.players.map((p, index) =>
    index === playerIndex ? { ...p, hand: [...p.hand, drawn[0]] } : p,
  )

  return {
    game: {
      ...afterDraw,
      players,
      actionPoints: game.actionPoints - DRAW_CARD_AP_COST,
    },
  }
}

/**
 * @param {GameState} game
 */
export function endTurn(game) {
  const nextIndex = (game.currentPlayerIndex + 1) % game.players.length

  const players = game.players.map((p, index) => ({
    ...p,
    partySlots:
      index === nextIndex ? resetPartySkillUsage(p.partySlots) : p.partySlots,
  }))

  return {
    ...game,
    players,
    currentPlayerIndex: nextIndex,
    actionPoints: INITIAL_ACTION_POINTS,
    pendingRoll: null,
    pendingChallenge: null,
    pendingEffectTargetSelection: null,
    pendingDiscard: null,
  }
}
