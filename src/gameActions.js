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
import { runCardEffect } from './cardEffects.js'
import {
  destroy as destroyEffect,
  discard as discardEffect,
  pull as pullEffect,
  removeCardFromHand,
  sacrifice as sacrificeEffect,
  steal as stealEffect,
} from './effects.js'
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
export function isPendingStagedCardPickActive(game) {
  return game.pendingStagedCardPick !== null
}

/**
 * @param {GameState} game
 */
export function isPendingHeroSelectionActive(game) {
  return game.pendingHeroSelection !== null
}

/**
 * @param {GameState} game
 */
export function isEffectHeroTargetSelectionActive(game) {
  return game.pendingEffectHeroTargetSelection !== null
}

/**
 * @param {GameState} game
 */
export function isPendingCardPullActive(game) {
  return game.pendingCardPull !== null
}

/**
 * Is the given party a valid pick target for the currently-open
 * pre-roll hero target selection (Bad Axe style)?
 * @param {GameState} game
 * @param {number} partyOwnerIndex
 */
export function isPartyClickableForHeroTargetSelection(game, partyOwnerIndex) {
  const sel = game.pendingEffectHeroTargetSelection
  if (!sel) return false
  if (sel.scope === 'own') return partyOwnerIndex === sel.sourcePlayerIndex
  if (sel.scope === 'opponents') return partyOwnerIndex !== sel.sourcePlayerIndex
  return true // 'any'
}

/**
 * @param {GameState} game
 */
export function isPendingQiBearSelectionActive(game) {
  return game.pendingQiBearSelection !== null
}

/**
 * @param {GameState} game
 */
export function isInterruptPhaseActive(game) {
  return (
    isChallengeWindowActive(game) ||
    isModifierPhaseActive(game) ||
    isEffectTargetSelectionActive(game) ||
    isEffectHeroTargetSelectionActive(game) ||
    isPendingCardPullActive(game) ||
    isPendingDiscardActive(game) ||
    isPendingStagedCardPickActive(game) ||
    isPendingHeroSelectionActive(game) ||
    isPendingQiBearSelectionActive(game)
  )
}

/**
 * Is the given party (owned by `partyOwnerIndex`) a valid pick target for the
 * currently-open hero selection?
 * @param {GameState} game
 * @param {number} partyOwnerIndex
 */
export function isPartyClickableForSelection(game, partyOwnerIndex) {
  const sel = game.pendingHeroSelection
  if (!sel) {
    return false
  }
  if (sel.scope === 'own') {
    return partyOwnerIndex === sel.sourcePlayerIndex
  }
  if (sel.scope === 'opponents') {
    return partyOwnerIndex !== sel.sourcePlayerIndex
  }
  if (sel.scope === 'specific') {
    return partyOwnerIndex === sel.targetPlayerIndex
  }
  return true
}

/**
 * Returns the index of the player whose card play opened the challenge window.
 * Any other player may respond with a Challenge card.
 * @param {GameState} game
 */
export function getChallengeAttackerIndex(game) {
  return game.pendingChallenge?.stagedPlay.attackerIndex ?? -1
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

  if (isPendingStagedCardPickActive(game)) {
    return false
  }

  if (isPendingHeroSelectionActive(game)) {
    return false
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
    // Any player except the one who made the play can respond with a Challenge card
    return playerIndex !== game.pendingChallenge.stagedPlay.attackerIndex
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
 * Attach effect metadata to a fresh hero pendingRoll (non-targeted heroes only).
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
          effectSourcePlayerIndex: sourcePlayerIndex,
        }
      : {}),
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
  /** @type {import('./gameState.js').PendingEffectTargetSelection | null} */
  let pendingEffectTargetSelection = null
  /** @type {import('./gameState.js').PendingEffectHeroTargetSelection | null} */
  let pendingEffectHeroTargetSelection = null
  /** @type {import('./gameState.js').PendingQiBearSelection | null} */
  let pendingQiBearSelection = null

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
    if (played.effectId === 'qiBear') {
      const maxCount = Math.min(3, game.players[attackerIndex].hand.length)
      pendingQiBearSelection = {
        sourcePlayerIndex: attackerIndex,
        effectId: played.effectId,
        heroName: played.name,
        rollRequirement: played.rollRequirement ?? 6,
        count: 0,
        maxCount,
        heroTargets: [],
      }
    } else if (played.heroTargeted && played.effectId) {
      // 先选 hero 目标，再投骰
      pendingEffectHeroTargetSelection = {
        sourcePlayerIndex: attackerIndex,
        effectId: played.effectId,
        heroName: played.name,
        rollRequirement: played.rollRequirement ?? 6,
        scope: 'any',
      }
    } else if (played.targeted && played.effectId) {
      // 先选玩家目标，再投骰
      pendingEffectTargetSelection = {
        sourcePlayerIndex: attackerIndex,
        effectId: played.effectId,
        heroName: played.name,
        rollRequirement: played.rollRequirement ?? 6,
      }
    } else {
      const baseRoll = rollForHeroEffect(played.rollRequirement ?? 6, attackerIndex)
      pendingRoll = attachHeroEffectMeta(baseRoll, played, attackerIndex)
    }
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

  return {
    game: {
      ...game,
      players,
      discardPile,
      pendingRoll,
      pendingEffectTargetSelection,
      pendingEffectHeroTargetSelection,
      pendingQiBearSelection,
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
      pendingChallenge: { stagedPlay },
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

  if (challengerIndex === game.pendingChallenge.stagedPlay.attackerIndex) {
    return { game, error: 'You cannot challenge your own play.' }
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

  const players = game.players.map((p, index) =>
    index === playerIndex ? { ...p, partySlots } : p,
  )

  if (slot.hero.effectId === 'qiBear') {
    const maxCount = Math.min(3, player.hand.length)
    return {
      game: {
        ...game,
        players,
        actionPoints: game.actionPoints - 1,
        pendingQiBearSelection: {
          sourcePlayerIndex: playerIndex,
          effectId: slot.hero.effectId,
          heroName: slot.hero.name,
          rollRequirement: slot.hero.rollRequirement ?? 6,
          count: 0,
          maxCount,
          heroTargets: [],
        },
      },
      diceRoll: null,
    }
  }

  if (slot.hero.heroTargeted && slot.hero.effectId) {
    // 先选 hero 目标，再投骰
    return {
      game: {
        ...game,
        players,
        actionPoints: game.actionPoints - 1,
        pendingEffectHeroTargetSelection: {
          sourcePlayerIndex: playerIndex,
          effectId: slot.hero.effectId,
          heroName: slot.hero.name,
          rollRequirement: slot.hero.rollRequirement ?? 6,
          scope: 'any',
        },
      },
      diceRoll: null,
    }
  }

  if (slot.hero.targeted && slot.hero.effectId) {
    // 先选玩家目标，再投骰
    return {
      game: {
        ...game,
        players,
        actionPoints: game.actionPoints - 1,
        pendingEffectTargetSelection: {
          sourcePlayerIndex: playerIndex,
          effectId: slot.hero.effectId,
          heroName: slot.hero.name,
          rollRequirement: slot.hero.rollRequirement ?? 6,
        },
      },
      diceRoll: null,
    }
  }

  const baseRoll = rollForHeroEffect(slot.hero.rollRequirement ?? 6, playerIndex)
  const pendingRoll = attachHeroEffectMeta(baseRoll, slot.hero, playerIndex)

  return {
    game: {
      ...game,
      players,
      actionPoints: game.actionPoints - 1,
      pendingRoll,
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

  if (!pending.effectId || !success) {
    return {
      game: { ...game, pendingRoll: null, pendingDestroyTargets: [] },
      diceRoll: null,
    }
  }

  const { game: afterEffect, error } = runCardEffect(game, pending.effectId, {
    sourcePlayerIndex: pending.effectSourcePlayerIndex,
    targetPlayerIndex: pending.effectTargetPlayerIndex,
    sourceLabel: pending.heroName,
    count: pending.qiBearCount,
    heroTargets: game.pendingDestroyTargets,
  })

  return {
    game: { ...afterEffect, pendingRoll: null, pendingDestroyTargets: [] },
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
 * Rolls the dice and opens the modifier window once the target is confirmed.
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

  // 目标已确认，现在才投骰并开 modifier 窗口
  const baseRoll = rollForHeroEffect(sel.rollRequirement, sel.sourcePlayerIndex)
  /** @type {PendingRoll} */
  const pendingRoll = {
    ...baseRoll,
    heroName: sel.heroName,
    targetLabel: `${sel.heroName} → ${targetName}`,
    effectId: sel.effectId,
    effectSourcePlayerIndex: sel.sourcePlayerIndex,
    effectTargetPlayerIndex: targetPlayerIndex,
  }

  return {
    game: {
      ...game,
      pendingEffectTargetSelection: null,
      pendingRoll,
    },
    pendingRoll,
  }
}

/**
 * Source player picks a card from the target's face-down hand (Fury Knuckle / Bear Claw).
 * If the pulled card matches `bonusTriggerType`, a second pick is opened immediately.
 *
 * @param {GameState} game
 * @param {string} instanceId - instanceId of the chosen card
 */
export function resolveCardPull(game, instanceId) {
  const pending = game.pendingCardPull
  if (!pending) {
    return { game, error: 'No card pull pending.' }
  }

  const target = game.players[pending.targetPlayerIndex]
  if (!target) {
    return { game, error: 'Invalid target.' }
  }

  const card = target.hand.find((c) => c.instanceId === instanceId)
  if (!card) {
    return { game, error: 'Card not found in target hand.' }
  }

  // Execute the pull — move the card to source's hand
  const { game: afterPull, error } = pullEffect(game, {
    sourcePlayerIndex: pending.sourcePlayerIndex,
    targetPlayerIndex: pending.targetPlayerIndex,
    instanceId,
  })
  if (error) {
    return { game, error }
  }

  // Check for bonus pull (only once — bonusTriggerType is null on the bonus pick)
  const bonusTriggered =
    pending.bonusTriggerType !== null &&
    card.type === pending.bonusTriggerType &&
    afterPull.players[pending.targetPlayerIndex].hand.length > 0

  /** @type {import('./gameState.js').PendingCardPull | null} */
  const nextCardPull = bonusTriggered
    ? {
        sourcePlayerIndex: pending.sourcePlayerIndex,
        targetPlayerIndex: pending.targetPlayerIndex,
        bonusTriggerType: null,
        sourceLabel: pending.sourceLabel,
        isBonusPull: true,
      }
    : null

  return {
    game: { ...afterPull, pendingCardPull: nextCardPull },
    card,
  }
}

/**
 * Player who initiated a hero-targeted effect picks which specific hero to target.
 * Adds the hero to `pendingDestroyTargets` (red highlight), rolls dice, and opens
 * the modifier window — analogous to `selectEffectTarget` but at the hero level.
 *
 * @param {GameState} game
 * @param {string} heroInstanceId
 */
export function selectEffectHeroTarget(game, heroInstanceId) {
  const sel = game.pendingEffectHeroTargetSelection
  if (!sel) {
    return { game, error: 'No hero target selection pending.' }
  }

  // Find the owner of the hero
  const ownerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
  )
  if (ownerIndex === -1) {
    return { game, error: 'Hero not found.' }
  }

  // Validate scope
  if (sel.scope === 'own' && ownerIndex !== sel.sourcePlayerIndex) {
    return { game, error: 'You must pick your own hero.' }
  }
  if (sel.scope === 'opponents' && ownerIndex === sel.sourcePlayerIndex) {
    return { game, error: "You must pick an opponent's hero." }
  }

  const heroSlot = game.players[ownerIndex].partySlots.find(
    (s) => s?.hero.instanceId === heroInstanceId,
  )
  const targetHeroName = heroSlot?.hero.name ?? 'Hero'

  // Target confirmed — roll dice and open modifier window
  const baseRoll = rollForHeroEffect(sel.rollRequirement, sel.sourcePlayerIndex)
  /** @type {PendingRoll} */
  const pendingRoll = {
    ...baseRoll,
    heroName: sel.heroName,
    targetLabel: `${sel.heroName} → ${targetHeroName}`,
    effectId: sel.effectId,
    effectSourcePlayerIndex: sel.sourcePlayerIndex,
  }

  return {
    game: {
      ...game,
      pendingEffectHeroTargetSelection: null,
      pendingDestroyTargets: [heroInstanceId],
      pendingRoll,
    },
    pendingRoll,
  }
}

/**
 * Set the discard/destroy count for an open Qi Bear selection (0..maxCount).
 * Shrinks heroTargets if the new count is lower.
 *
 * @param {GameState} game
 * @param {number} sourcePlayerIndex
 * @param {number} count
 */
export function setQiBearCount(game, sourcePlayerIndex, count) {
  const sel = game.pendingQiBearSelection
  if (!sel) return { game, error: 'No Qi Bear selection pending.' }
  if (sel.sourcePlayerIndex !== sourcePlayerIndex) return { game, error: 'Not your selection.' }
  if (count < 0 || count > sel.maxCount) return { game, error: 'Invalid count.' }
  return {
    game: {
      ...game,
      pendingQiBearSelection: {
        ...sel,
        count,
        heroTargets: sel.heroTargets.slice(0, count),
      },
    },
  }
}

/**
 * Toggle a hero as a Qi Bear destroy target.
 * Clicking a hero that is already selected deselects it.
 * Clicking a new hero is only allowed when heroTargets.length < count.
 *
 * @param {GameState} game
 * @param {number} sourcePlayerIndex
 * @param {string} heroInstanceId
 */
export function toggleQiBearHeroTarget(game, sourcePlayerIndex, heroInstanceId) {
  const sel = game.pendingQiBearSelection
  if (!sel) return { game, error: 'No Qi Bear selection pending.' }
  if (sel.sourcePlayerIndex !== sourcePlayerIndex) return { game, error: 'Not your selection.' }

  const alreadySelected = sel.heroTargets.includes(heroInstanceId)
  let heroTargets
  if (alreadySelected) {
    heroTargets = sel.heroTargets.filter((id) => id !== heroInstanceId)
  } else {
    if (sel.heroTargets.length >= sel.count) {
      return { game, error: 'Deselect a hero first, or increase the count.' }
    }
    heroTargets = [...sel.heroTargets, heroInstanceId]
  }
  return {
    game: {
      ...game,
      pendingQiBearSelection: { ...sel, heroTargets },
    },
  }
}

/**
 * Confirm the Qi Bear pre-roll selection: roll the dice and open the modifier window.
 *
 * @param {GameState} game
 * @param {number} sourcePlayerIndex
 */
export function confirmQiBearSelection(game, sourcePlayerIndex) {
  const sel = game.pendingQiBearSelection
  if (!sel) return { game, error: 'No Qi Bear selection pending.' }
  if (sel.sourcePlayerIndex !== sourcePlayerIndex) return { game, error: 'Not your selection.' }
  if (sel.heroTargets.length !== sel.count) {
    return {
      game,
      error: `Select exactly ${sel.count} hero${sel.count !== 1 ? 'es' : ''} to destroy.`,
    }
  }

  const baseRoll = rollForHeroEffect(sel.rollRequirement, sel.sourcePlayerIndex)
  /** @type {PendingRoll} */
  const pendingRoll = {
    ...baseRoll,
    heroName: sel.heroName,
    targetLabel:
      sel.count > 0
        ? `${sel.heroName}: discard ${sel.count}, destroy ${sel.count}`
        : `${sel.heroName} skill`,
    effectId: sel.effectId,
    effectSourcePlayerIndex: sel.sourcePlayerIndex,
    qiBearCount: sel.count,
  }

  return {
    game: {
      ...game,
      pendingQiBearSelection: null,
      pendingRoll,
      pendingDestroyTargets: sel.heroTargets,
    },
    pendingRoll,
  }
}

/**
 * Source player clicked a hero in some party while a `pendingHeroSelection`
 * is open. Validates the click against the selection's scope and runs the
 * appropriate atomic effect (sacrifice / destroy / steal), then clears the
 * selection.
 *
 * @param {GameState} game
 * @param {number} partyOwnerIndex - whose party the picked hero belongs to
 * @param {string} heroInstanceId
 */
export function selectHeroForPendingAction(game, partyOwnerIndex, heroInstanceId) {
  const sel = game.pendingHeroSelection
  if (!sel) {
    return { game, error: 'No hero selection pending.' }
  }
  if (!isPartyClickableForSelection(game, partyOwnerIndex)) {
    if (sel.scope === 'own') {
      return { game, error: 'You must pick one of your own heroes.' }
    }
    if (sel.scope === 'opponents') {
      return { game, error: "You must pick an opponent's hero." }
    }
    if (sel.scope === 'specific') {
      return { game, error: 'You must pick a hero from the targeted player.' }
    }
    return { game, error: 'Invalid party.' }
  }

  /** @type {{ game: GameState, error?: string }} */
  let result
  if (sel.action === 'sacrifice') {
    result = sacrificeEffect(game, {
      playerIndex: partyOwnerIndex,
      heroInstanceId,
    })
  } else if (sel.action === 'destroy') {
    // Pan Chucks–style cards have scope: 'any' and may target the source player's
    // own hero. The atomic `destroy` rejects self-targeting (since semantically
    // that's a sacrifice). Route automatically — the board operation is identical.
    if (partyOwnerIndex === sel.sourcePlayerIndex) {
      result = sacrificeEffect(game, {
        playerIndex: partyOwnerIndex,
        heroInstanceId,
      })
    } else {
      result = destroyEffect(game, {
        sourcePlayerIndex: sel.sourcePlayerIndex,
        targetPlayerIndex: partyOwnerIndex,
        heroInstanceId,
      })
    }
  } else if (sel.action === 'steal') {
    result = stealEffect(game, {
      sourcePlayerIndex: sel.sourcePlayerIndex,
      targetPlayerIndex: partyOwnerIndex,
      heroInstanceId,
    })
  } else {
    return { game, error: `Unknown hero-selection action: ${sel.action}` }
  }

  if (result.error) {
    return { game, error: result.error }
  }

  const continuation = sel.afterPendingDiscard ?? null
  return {
    game: {
      ...result.game,
      pendingHeroSelection: null,
      pendingDiscard: continuation,
    },
  }
}

/**
 * Stop an optional discard early (Qi Bear). Clears pending discard without
 * triggering further destroys for cards not yet discarded.
 *
 * @param {GameState} game
 * @param {number} playerIndex
 */
/**
 * After all opponents have staged a discard for Beary Wise, either auto-take the
 * sole card or open the pick prompt for the source player.
 *
 * @param {GameState} game
 * @param {number} sourcePlayerIndex
 * @param {string} sourceLabel
 * @param {CardInstance[]} stagedCards
 */
function resolveBearyWiseStagedCards(
  game,
  sourcePlayerIndex,
  sourceLabel,
  stagedCards,
) {
  if (stagedCards.length === 0) {
    return {
      ...game,
      pendingDiscard: null,
      pendingStagedCardPick: null,
    }
  }

  if (stagedCards.length === 1) {
    const players = game.players.map((p, index) =>
      index === sourcePlayerIndex
        ? { ...p, hand: [...p.hand, stagedCards[0]] }
        : p,
    )
    return {
      ...game,
      players,
      pendingDiscard: null,
      pendingStagedCardPick: null,
    }
  }

  return {
    ...game,
    pendingDiscard: null,
    pendingStagedCardPick: {
      sourcePlayerIndex,
      sourceLabel,
      stagedCards,
    },
  }
}

/**
 * Beary Wise: source player takes one staged card; the rest go to the discard pile.
 *
 * @param {GameState} game
 * @param {number} playerIndex
 * @param {string} instanceId
 */
export function pickStagedCard(game, playerIndex, instanceId) {
  const pick = game.pendingStagedCardPick
  if (!pick) {
    return { game, error: 'No staged card pick pending.' }
  }
  if (playerIndex !== pick.sourcePlayerIndex) {
    return { game, error: 'Only the player who triggered the effect may choose.' }
  }
  if (game.currentPlayerIndex !== pick.sourcePlayerIndex) {
    return { game, error: 'Only the current player may choose.' }
  }

  const chosen = pick.stagedCards.find((c) => c.instanceId === instanceId)
  if (!chosen) {
    return { game, error: 'That card is not in the staged pool.' }
  }

  const remainder = pick.stagedCards.filter((c) => c.instanceId !== instanceId)
  const discardPile = [
    ...game.discardPile,
    ...remainder.map((c) => withFaceUp(c)),
  ]
  const players = game.players.map((p, index) =>
    index === pick.sourcePlayerIndex
      ? { ...p, hand: [...p.hand, withFaceUp(chosen)] }
      : p,
  )

  return {
    game: {
      ...game,
      players,
      discardPile,
      pendingStagedCardPick: null,
    },
  }
}

export function passPendingDiscard(game, playerIndex) {
  const pending = game.pendingDiscard
  if (!pending) {
    return { game, error: 'No discard in progress.' }
  }
  if (pending.kind === 'opponentEach' || pending.kind === 'opponentEachPile') {
    return { game, error: 'This discard cannot be skipped.' }
  }
  if (!pending.optional) {
    return { game, error: 'This discard cannot be skipped.' }
  }
  if (pending.playerIndex !== playerIndex) {
    return { game, error: 'Only the discarding player may pass.' }
  }
  return {
    game: { ...game, pendingDiscard: null },
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

  if (pending.kind === 'opponentEach' || pending.kind === 'opponentEachPile') {
    const queue = pending.opponentDiscardQueue ?? []
    const nextPending = (afterState) => {
      if (queue.length === 0) {
        if (pending.kind === 'opponentEach') {
          return resolveBearyWiseStagedCards(
            afterState,
            pending.sourcePlayerIndex,
            pending.sourceLabel,
            pending.stagedCards ?? [],
          )
        }
        return { ...afterState, pendingDiscard: null }
      }
      const [nextPlayer, ...rest] = queue
      return {
        ...afterState,
        pendingDiscard: {
          kind: pending.kind,
          playerIndex: nextPlayer,
          sourcePlayerIndex: pending.sourcePlayerIndex,
          count: 1,
          sourceLabel: pending.sourceLabel,
          opponentDiscardQueue: rest,
          ...(pending.kind === 'opponentEach'
            ? { stagedCards: pending.stagedCards ?? [] }
            : {}),
        },
      }
    }

    if (pending.kind === 'opponentEach') {
      const { game: afterRemove, card, error } = removeCardFromHand(game, {
        playerIndex,
        instanceId,
      })
      if (error || !card) {
        return { game: afterRemove, error: error ?? 'Could not remove card.' }
      }

      const stagedCards = [...(pending.stagedCards ?? []), card]
      if (queue.length > 0) {
        const [nextPlayer, ...rest] = queue
        return {
          game: {
            ...afterRemove,
            pendingDiscard: {
              kind: 'opponentEach',
              playerIndex: nextPlayer,
              sourcePlayerIndex: pending.sourcePlayerIndex,
              count: 1,
              sourceLabel: pending.sourceLabel,
              opponentDiscardQueue: rest,
              stagedCards,
            },
          },
        }
      }

      return {
        game: resolveBearyWiseStagedCards(
          afterRemove,
          pending.sourcePlayerIndex,
          pending.sourceLabel,
          stagedCards,
        ),
      }
    }

    const { game: afterDiscard, error } = discardEffect(game, {
      playerIndex,
      instanceId,
    })
    if (error) {
      return { game, error }
    }

    return { game: nextPending(afterDiscard) }
  }

  const { game: afterDiscard, error } = discardEffect(game, {
    playerIndex,
    instanceId,
  })
  if (error) {
    return { game, error }
  }
  const remaining = pending.count - 1

  // Qi Bear chain: interleave a "destroy a hero" selection after every discard.
  // The `afterPendingDiscard` continuation carries the remaining discard count
  // forward so the cycle resumes once the hero is destroyed.
  if (pending.destroyHeroPerDiscard) {
    const anyHero = afterDiscard.players.some((p) =>
      p.partySlots.some((s) => s !== null),
    )
    if (!anyHero) {
      // no targets left — abort the chain gracefully and skip remaining discards
      return {
        game: { ...afterDiscard, pendingDiscard: null },
      }
    }
    const continuation =
      remaining > 0
        ? { ...pending, count: remaining }
        : null
    return {
      game: {
        ...afterDiscard,
        pendingDiscard: null,
        pendingHeroSelection: {
          sourcePlayerIndex: pending.sourcePlayerIndex,
          scope: 'any',
          action: 'destroy',
          sourceLabel: pending.sourceLabel,
          afterPendingDiscard: continuation,
        },
      },
    }
  }

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
    pendingEffectHeroTargetSelection: null,
    pendingCardPull: null,
    pendingDiscard: null,
    pendingStagedCardPick: null,
    pendingHeroSelection: null,
    pendingQiBearSelection: null,
    pendingDestroyTargets: [],
  }
}
