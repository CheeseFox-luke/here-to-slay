import { CARD_TYPES, HERO_CLASSES, REQUIREMENT_HERO } from './data/cardUtils.js'
import { applyOnModifierPlayPassives } from './monsterPassives.js'
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
  changeHeroClass,
  destroy as destroyEffect,
  discard as discardEffect,
  draw as drawEffect,
  give as giveEffect,
  pull as pullEffect,
  removeCardFromHand,
  sacrifice as sacrificeEffect,
  steal as stealEffect,
  swapHero as swapHeroEffect,
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
  CARD_TYPES.CURSED_ITEM,
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
export function isPendingGiveActive(game) {
  return game.pendingGive !== null
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
export function isPendingItemSelectionActive(game) {
  return (game.pendingItemSelection ?? null) !== null
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
export function isPendingHeroPlayChoiceActive(game) {
  return game.pendingHeroPlayChoice !== null
}

/**
 * @param {GameState} game
 */
export function isPendingHeroFromHandPlayActive(game) {
  return game.pendingHeroFromHandPlay !== null
}

/**
 * @param {GameState} game
 */
export function isPendingLeaderWizardDrawActive(game) {
  return (game.pendingLeaderWizardDraw ?? null) !== null
}

export function isInterruptPhaseActive(game) {
  return (
    isChallengeWindowActive(game) ||
    isModifierPhaseActive(game) ||
    isEffectTargetSelectionActive(game) ||
    isEffectHeroTargetSelectionActive(game) ||
    isPendingCardPullActive(game) ||
    isPendingDiscardActive(game) ||
    isPendingGiveActive(game) ||
    isPendingStagedCardPickActive(game) ||
    isPendingHeroSelectionActive(game) ||
    isPendingQiBearSelectionActive(game) ||
    isPendingHeroPlayChoiceActive(game) ||
    isPendingHeroFromHandPlayActive(game) ||
    isPendingItemSelectionActive(game) ||
    isPendingLeaderWizardDrawActive(game)
  )
}

/**
 * If the active player has leader 104 (Wizard), set pendingLeaderWizardDraw
 * so the UI can prompt "draw a card?" after a magic card is played.
 * @param {GameState} game
 * @param {number} playerIndex
 * @returns {GameState}
 */
function maybeQueueWizardDraw(game, playerIndex) {
  const player = game.players[playerIndex]
  if (player?.leader?.effectId === 'leaderWizardDraw') {
    return { ...game, pendingLeaderWizardDraw: { playerIndex } }
  }
  return game
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

  if (isPendingGiveActive(game)) {
    const giverIndex = game.pendingGive.giverQueue[0]
    return (
      giverIndex === playerIndex &&
      game.players[playerIndex].hand.some((c) => c.instanceId === card.instanceId)
    )
  }

  if (isPendingStagedCardPickActive(game)) {
    return false
  }

  if (isPendingHeroSelectionActive(game)) {
    return false
  }

  if (isPendingHeroFromHandPlayActive(game)) {
    const pending = game.pendingHeroFromHandPlay
    return (
      pending.sourcePlayerIndex === playerIndex &&
      card.type === CARD_TYPES.HERO &&
      game.players[playerIndex].hand.some((c) => c.instanceId === card.instanceId)
    )
  }

  if (isEffectTargetSelectionActive(game)) {
    return false
  }

  if (isModifierPhaseActive(game)) {
    if (card.type !== CARD_TYPES.MODIFIER) {
      return false
    }
    if (game.antiModifier === true) {
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
    if (game.antiChallenge === true) {
      return false
    }
    // Any player except the one who made the play can respond with a Challenge card
    return playerIndex !== game.pendingChallenge.stagedPlay.attackerIndex
  }

  if (card.type === CARD_TYPES.CHALLENGE && game.antiChallenge === true) {
    return false
  }

  if (card.type === CARD_TYPES.MODIFIER && game.antiModifier === true) {
    return false
  }

  if (playerIndex !== game.currentPlayerIndex) {
    return false
  }

  if (card.type === CARD_TYPES.ITEM) {
    return partyHasHero(game.players[playerIndex].partySlots)
  }

  if (card.type === CARD_TYPES.CURSED_ITEM) {
    return game.players.some((p, i) => i !== playerIndex && partyHasHero(p.partySlots))
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
 * Clear antiSteal / antiDestroy from every hero in a party.
 * Called at the START of a player's turn so protections applied on their
 * previous turn expire exactly when their next turn begins.
 * @param {(PartySlot | null)[]} partySlots
 */
function clearPartyProtectionFlags(partySlots) {
  return partySlots.map((slot) =>
    slot ? { ...slot, hero: { ...slot.hero, antiSteal: false, antiDestroy: false } } : null,
  )
}

/**
 * Find the items equipped on a hero across all players' party slots.
 * @param {GameState} game
 * @param {string} heroInstanceId
 * @returns {CardInstance[]}
 */
function findHeroItems(game, heroInstanceId) {
  for (const player of game.players) {
    const slot = player.partySlots.find((s) => s?.hero.instanceId === heroInstanceId)
    if (slot) return slot.items
  }
  return []
}

/**
 * Apply leader passive bonuses to a hero-effect roll.
 * Called after applyHeroRollCurses so leader bonus always shows as a separate label.
 * @param {GameState} game
 * @param {import('./gameState.js').PendingRoll} roll
 * @param {number} rollingPlayerIndex
 * @returns {import('./gameState.js').PendingRoll}
 */
function applyLeaderPassives(game, roll, rollingPlayerIndex) {
  const player = game.players[rollingPlayerIndex]
  let result = roll

  // Leader 106 (Bard): +1 to all hero effect rolls
  if (player?.leader?.effectId === 'leaderHeroRollBonus') {
    result = applyDeltaToPendingRoll(result, 1, player.leader.name)
  }

  // Slain monster passives that grant +1 to hero effect rolls (e.g. 203 Dark Dragon King)
  for (const monster of (player?.slainMonsters ?? [])) {
    if (monster.effectId === 'slainMonsterHeroRollBonus') {
      result = applyDeltaToPendingRoll(result, 1, monster.name)
    }
  }

  return result
}

/**
 * Apply passive cursed-item roll penalties to a freshly rolled pendingRoll.
 * Does NOT apply globalRollBonus — that is handled by openModifierWindow.
 * @param {import('./gameState.js').PendingRoll} roll
 * @param {CardInstance[]} items
 * @returns {import('./gameState.js').PendingRoll}
 */
function applyHeroRollCurses(roll, items) {
  let result = roll
  for (const item of items) {
    if (item.effectId === 'snakesEyesCurse') {
      result = applyDeltaToPendingRoll(result, -2, 'Curse of the Snake\'s Eyes')
    }
    if (item.effectId === 'bigRing') {
      result = applyDeltaToPendingRoll(result, +2, 'Really Big Ring')
    }
  }
  return result
}

/**
 * Open the modifier window for a roll.
 * Automatically applies any active globalRollBonus (e.g. Enchanted Spell) so
 * the +2 shows up in the modifier display for ALL roll types without any
 * player action during the window.
 * @param {GameState} game
 * @param {import('./gameState.js').PendingRoll} pendingRoll
 * @returns {{ pendingRoll: import('./gameState.js').PendingRoll, modifierPassedBy: number[], modifierStartedAt: number }}
 */
function openModifierWindow(game, pendingRoll) {
  let roll = pendingRoll
  if (roll && game.globalRollBonus) {
    roll = applyDeltaToPendingRoll(roll, game.globalRollBonus, 'Enchanted Spell')
  }
  return { pendingRoll: roll, modifierPassedBy: [], modifierStartedAt: Date.now() }
}

/**
 * After a successful hero roll, apply any passive on-success item effects on the rolling hero.
 * Currently handles: Suspiciously Shiny Coin (discard 1), Particularly Rusty Coin (draw 1).
 * @param {GameState} game - game state after the effect has resolved, pendingRoll already cleared
 * @param {PendingRoll} pending - the roll that just resolved
 * @returns {GameState}
 */
function applyOnSuccessItemEffects(game, pending) {
  if (!pending.rollingHeroInstanceId) return game
  const items = findHeroItems(game, pending.rollingHeroInstanceId)

  const ownerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === pending.rollingHeroInstanceId),
  )
  if (ownerIndex === -1) return game

  let result = game

  for (const item of items) {
    if (item.effectId === 'shinyCoinCurse') {
      const count = Math.min(1, result.players[ownerIndex].hand.length)
      if (count > 0) {
        result = {
          ...result,
          pendingDiscard: {
            playerIndex: ownerIndex,
            sourcePlayerIndex: ownerIndex,
            count,
            sourceLabel: 'Suspiciously Shiny Coin',
          },
        }
      }
    }

    if (item.effectId === 'rustyCoin') {
      const { game: afterDraw } = drawEffect(result, { playerIndex: ownerIndex, count: 1 })
      result = afterDraw
    }
  }

  return result
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
    rollingHeroInstanceId: heroCard.instanceId,
    ...(heroCard.effectId
      ? {
          effectId: heroCard.effectId,
          effectSourcePlayerIndex: sourcePlayerIndex,
          sourceHeroInstanceId: heroCard.instanceId,
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
        sourceHeroInstanceId: played.instanceId,
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
        scope: played.heroTargetScope ?? 'any',
        sourceHeroInstanceId: played.instanceId,
        ...(played.heroTargetCount && played.heroTargetCount > 1
          ? { maxTargets: played.heroTargetCount, selectedTargets: [] }
          : {}),
      }
    } else if (played.targeted && played.effectId) {
      // 先选玩家目标，再投骰
      pendingEffectTargetSelection = {
        sourcePlayerIndex: attackerIndex,
        effectId: played.effectId,
        heroName: played.name,
        rollRequirement: played.rollRequirement ?? 6,
        sourceHeroInstanceId: played.instanceId,
      }
    } else {
      const baseRoll = rollForHeroEffect(played.rollRequirement ?? 6, attackerIndex)
      const leaderRoll = applyLeaderPassives(game, baseRoll, attackerIndex)
      pendingRoll = attachHeroEffectMeta(leaderRoll, played, attackerIndex)
    }
  } else if (cardType === CARD_TYPES.MAGIC) {
    discardPile = [...discardPile, played]
    if (played.effectId === 'entanglingTrap') {
      const attackerPlayer = game.players[attackerIndex]
      const handAfterPlay = attackerPlayer.hand // card already removed in beginStagedPlay
      if (handAfterPlay.length >= 2) {
        const players = game.players.map((p, i) => i === attackerIndex ? { ...p, partySlots } : p)
        return {
          game: maybeQueueWizardDraw({
            ...game,
            players,
            discardPile,
            pendingDiscard: {
              playerIndex: attackerIndex,
              sourcePlayerIndex: attackerIndex,
              count: 2,
              sourceLabel: 'Entangling Trap',
              afterEffect: 'stealHero',
            },
            pendingRoll: null,
            pendingEffectTargetSelection: null,
            pendingEffectHeroTargetSelection: null,
            pendingQiBearSelection: null,
          }, attackerIndex),
          diceRoll: null,
          error: null,
        }
      }
      // Not enough cards — effect fizzles, card still goes to discard
      const fizzlePlayers = game.players.map((p, i) => i === attackerIndex ? { ...p, partySlots } : p)
      return {
        game: maybeQueueWizardDraw({ ...game, players: fizzlePlayers, discardPile, pendingRoll: null, pendingEffectTargetSelection: null, pendingEffectHeroTargetSelection: null, pendingQiBearSelection: null }, attackerIndex),
        diceRoll: null,
        error: null,
      }
    }
    if (played.effectId === 'forcefulWinds') {
      const players = game.players.map((p) => {
        const returnedItems = p.partySlots.flatMap((s) => s ? s.items.map((it) => ({ ...it, faceUp: false })) : [])
        const clearedSlots = p.partySlots.map((s) => s ? { ...s, items: [] } : null)
        return { ...p, partySlots: clearedSlots, hand: [...p.hand, ...returnedItems] }
      })
      return {
        game: maybeQueueWizardDraw({ ...game, players, discardPile, pendingRoll: null, pendingEffectTargetSelection: null, pendingEffectHeroTargetSelection: null, pendingQiBearSelection: null }, attackerIndex),
        diceRoll: null,
        error: null,
      }
    }
    if (played.effectId === 'windsOfChange') {
      const players = game.players.map((p, i) => i === attackerIndex ? { ...p, partySlots } : p)
      const tempGame = { ...game, players, discardPile }
      const anyEquipped = tempGame.players.some((p) => p.partySlots.some((s) => s && s.items.length > 0))
      if (!anyEquipped) {
        // No items on the board — skip the return step, just draw 1
        const { game: afterDraw } = drawEffect(tempGame, { playerIndex: attackerIndex, count: 1 })
        return {
          game: maybeQueueWizardDraw({ ...afterDraw, pendingRoll: null, pendingEffectTargetSelection: null, pendingEffectHeroTargetSelection: null, pendingQiBearSelection: null }, attackerIndex),
          diceRoll: null,
          error: null,
        }
      }
      return {
        game: maybeQueueWizardDraw({
          ...tempGame,
          pendingItemSelection: { sourcePlayerIndex: attackerIndex, sourceLabel: 'Winds of Change' },
          pendingRoll: null,
          pendingEffectTargetSelection: null,
          pendingEffectHeroTargetSelection: null,
          pendingQiBearSelection: null,
        }, attackerIndex),
        diceRoll: null,
        error: null,
      }
    }
    if (played.effectId === 'enchantedSpell') {
      const bonus = (game.globalRollBonus ?? 0) + 2
      const players = game.players.map((p, i) => i === attackerIndex ? { ...p, partySlots } : p)
      return {
        game: maybeQueueWizardDraw({ ...game, players, discardPile, globalRollBonus: bonus, pendingRoll: null, pendingEffectTargetSelection: null, pendingEffectHeroTargetSelection: null, pendingQiBearSelection: null }, attackerIndex),
        diceRoll: null,
        error: null,
      }
    }
    if (played.effectId === 'criticalBoost') {
      const { game: afterDraw } = drawEffect(game, { playerIndex: attackerIndex, count: 3 })
      const players = afterDraw.players.map((p, i) => i === attackerIndex ? { ...p, partySlots } : p)
      return {
        game: maybeQueueWizardDraw({
          ...afterDraw,
          players,
          discardPile,
          pendingDiscard: {
            playerIndex: attackerIndex,
            sourcePlayerIndex: attackerIndex,
            count: 1,
            sourceLabel: 'Critical Boost',
          },
          pendingRoll: null,
          pendingEffectTargetSelection: null,
          pendingEffectHeroTargetSelection: null,
          pendingQiBearSelection: null,
        }, attackerIndex),
        diceRoll: null,
        error: null,
      }
    }
    if (played.effectId === 'destructiveSpell') {
      const players = game.players.map((p, i) => i === attackerIndex ? { ...p, partySlots } : p)
      return {
        game: maybeQueueWizardDraw({
          ...game,
          players,
          discardPile,
          pendingDiscard: {
            playerIndex: attackerIndex,
            sourcePlayerIndex: attackerIndex,
            count: 1,
            sourceLabel: 'Destructive Spell',
            afterEffect: 'destroyHero',
          },
          pendingRoll: null,
          pendingEffectTargetSelection: null,
          pendingEffectHeroTargetSelection: null,
          pendingQiBearSelection: null,
        }, attackerIndex),
        diceRoll: null,
        error: null,
      }
    }
    if (played.effectId === 'callToFallen') {
      const heroesInDiscard = game.discardPile.filter((c) => c.type === 'Hero')
      const players = game.players.map((p, i) => i === attackerIndex ? { ...p, partySlots } : p)
      if (heroesInDiscard.length === 0) {
        // No heroes in discard — fizzle
        return {
          game: maybeQueueWizardDraw({ ...game, players, discardPile, pendingRoll: null, pendingEffectTargetSelection: null, pendingEffectHeroTargetSelection: null, pendingQiBearSelection: null }, attackerIndex),
          diceRoll: null,
          error: null,
        }
      }
      const discardWithoutHeroes = game.discardPile.filter((c) => c.type !== 'Hero')
      if (heroesInDiscard.length === 1) {
        const updatedPlayers = players.map((p, i) =>
          i === attackerIndex ? { ...p, hand: [...p.hand, { ...heroesInDiscard[0], faceUp: true }] } : p,
        )
        return {
          game: maybeQueueWizardDraw({ ...game, players: updatedPlayers, discardPile: discardWithoutHeroes, pendingRoll: null, pendingEffectTargetSelection: null, pendingEffectHeroTargetSelection: null, pendingQiBearSelection: null }, attackerIndex),
          diceRoll: null,
          error: null,
        }
      }
      return {
        game: maybeQueueWizardDraw({
          ...game,
          players,
          discardPile: discardWithoutHeroes,
          pendingStagedCardPick: {
            sourcePlayerIndex: attackerIndex,
            sourceLabel: 'Call to the Fallen',
            stagedCards: heroesInDiscard.map((c) => ({ ...c, faceUp: true })),
            source: 'discardPile',
          },
          pendingRoll: null,
          pendingEffectTargetSelection: null,
          pendingEffectHeroTargetSelection: null,
          pendingQiBearSelection: null,
        }, attackerIndex),
        diceRoll: null,
        error: null,
      }
    }
    if (played.effectId === 'forcedExchange') {
      const anyOwnHero = game.players[attackerIndex].partySlots.some((s) => s !== null)
      const anyOpponentHero = game.players.some((p, i) => i !== attackerIndex && p.partySlots.some((s) => s !== null))
      const players = game.players.map((p, i) => i === attackerIndex ? { ...p, partySlots } : p)
      if (!anyOwnHero || !anyOpponentHero) {
        // No valid swap possible — fizzle
        return {
          game: maybeQueueWizardDraw({ ...game, players, discardPile, pendingRoll: null, pendingEffectTargetSelection: null, pendingEffectHeroTargetSelection: null, pendingQiBearSelection: null }, attackerIndex),
          diceRoll: null,
          error: null,
        }
      }
      return {
        game: maybeQueueWizardDraw({
          ...game,
          players,
          discardPile,
          pendingHeroSelection: {
            sourcePlayerIndex: attackerIndex,
            scope: 'own',
            action: 'swapSource',
            sourceLabel: 'Forced Exchange',
          },
          pendingRoll: null,
          pendingEffectTargetSelection: null,
          pendingEffectHeroTargetSelection: null,
          pendingQiBearSelection: null,
        }, attackerIndex),
        diceRoll: null,
        error: null,
      }
    }
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
    if (played.targetClass) {
      const heroInstanceId = partySlots[itemSlotIndex].hero.instanceId
      const players = game.players.map((p, i) =>
        i === attackerIndex ? { ...p, partySlots } : p,
      )
      const { game: afterClass } = changeHeroClass({ ...game, players }, {
        heroInstanceId,
        newClass: played.targetClass,
      })
      return { game: { ...afterClass, discardPile, pendingRoll: null, pendingEffectTargetSelection: null, pendingEffectHeroTargetSelection: null, pendingQiBearSelection: null }, diceRoll: null, error: null }
    }
  } else if (cardType === CARD_TYPES.CURSED_ITEM) {
    const tIdx = staged.targetPlayerIndex
    if (tIdx === undefined || itemSlotIndex === undefined || itemSlotIndex < 0) {
      return { game, diceRoll: null, error: 'Invalid cursed item target.' }
    }
    const targetSlots = clonePartySlots(game.players[tIdx].partySlots)
    const tSlot = targetSlots[itemSlotIndex]
    if (!tSlot) {
      return { game, diceRoll: null, error: 'Target hero slot not found.' }
    }
    targetSlots[itemSlotIndex] = { ...tSlot, items: [...tSlot.items, played] }
    const updatedPlayers = game.players.map((p, i) =>
      i === tIdx ? { ...p, partySlots: targetSlots } : i === attackerIndex ? { ...p, partySlots } : p,
    )
    let resolvedGame = { ...game, players: updatedPlayers }
    if (played.targetClass) {
      const heroInstanceId = targetSlots[itemSlotIndex].hero.instanceId
      const { game: afterClass } = changeHeroClass(resolvedGame, {
        heroInstanceId,
        newClass: played.targetClass,
      })
      resolvedGame = afterClass
    }
    return { game: resolvedGame, diceRoll: null, error: null }
  }

  const players = game.players.map((p, index) =>
    index === attackerIndex ? { ...p, partySlots } : p,
  )

  const mw = openModifierWindow(game, pendingRoll)
  return {
    game: {
      ...game,
      players,
      discardPile,
      pendingEffectTargetSelection,
      pendingEffectHeroTargetSelection,
      pendingQiBearSelection,
      ...mw,
    },
    diceRoll: mw.pendingRoll,
    error: null,
  }
}

/**
 * @param {GameState} game
 * @param {string} instanceId
 * @param {number} [itemSlotIndex]
 * @param {number} [targetPlayerIndex]
 */
function beginStagedPlay(game, instanceId, itemSlotIndex, targetPlayerIndex) {
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

  if (card.type === CARD_TYPES.CURSED_ITEM) {
    const hasOpponentHero = game.players.some(
      (p, i) => i !== playerIndex && partyHasHero(p.partySlots),
    )
    if (!hasOpponentHero) {
      return { game, error: 'No opponent has a hero to equip this cursed item on.' }
    }
    if (targetPlayerIndex === undefined || itemSlotIndex === undefined) {
      return { game, error: 'Choose an opponent hero to equip this cursed item.' }
    }
    const targetPlayer = game.players[targetPlayerIndex]
    if (!targetPlayer || targetPlayerIndex === playerIndex) {
      return { game, error: 'Choose an opponent hero.' }
    }
    const slot = targetPlayer.partySlots[itemSlotIndex]
    if (!slot) {
      return { game, error: 'Choose a hero in an opponent party.' }
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
    ...(targetPlayerIndex !== undefined ? { targetPlayerIndex } : {}),
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
      challengePassedBy: [],
      challengeStartedAt: Date.now(),
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

  if (card.type === CARD_TYPES.CURSED_ITEM) {
    return { game, diceRoll: null, error: 'Select an opponent hero to equip this cursed item.' }
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
 * @param {string} instanceId
 * @param {string} heroInstanceId
 */
export function playCursedItemOnHero(game, instanceId, heroInstanceId) {
  const playerIndex = game.currentPlayerIndex
  for (let tIdx = 0; tIdx < game.players.length; tIdx++) {
    if (tIdx === playerIndex) continue
    const slotIndex = game.players[tIdx].partySlots.findIndex(
      (slot) => slot?.hero.instanceId === heroInstanceId,
    )
    if (slotIndex !== -1) {
      const { game: nextGame, error } = beginStagedPlay(game, instanceId, slotIndex, tIdx)
      return { game: nextGame, diceRoll: null, error }
    }
  }
  return { game, diceRoll: null, error: 'Hero not found in any opponent party.' }
}

/**
 * Resolve "Winds of Change": return the chosen equipped item to its owner's hand,
 * then the source player draws a card.
 * @param {GameState} game
 * @param {string} heroInstanceId - hero whose item is being returned
 * @param {string} itemInstanceId - the item to return
 */
export function resolveWindsOfChange(game, heroInstanceId, itemInstanceId) {
  const sel = game.pendingItemSelection
  if (!sel) return { game, error: 'No item selection pending.' }

  // Find the item's owner and slot
  let ownerIndex = -1
  let slotIndex = -1
  for (let pi = 0; pi < game.players.length; pi++) {
    const si = game.players[pi].partySlots.findIndex(
      (s) => s?.hero.instanceId === heroInstanceId,
    )
    if (si !== -1) { ownerIndex = pi; slotIndex = si; break }
  }
  if (ownerIndex === -1) return { game, error: 'Hero not found.' }

  const ownerSlot = game.players[ownerIndex].partySlots[slotIndex]
  const item = ownerSlot.items.find((it) => it.instanceId === itemInstanceId)
  if (!item) return { game, error: 'Item not found on that hero.' }

  // Remove item from slot
  const newItems = ownerSlot.items.filter((it) => it.instanceId !== itemInstanceId)
  const newSlots = game.players[ownerIndex].partySlots.map((s, i) =>
    i === slotIndex ? { ...s, items: newItems } : s,
  )

  // Return item (face-down) to owner's hand
  const returnedItem = { ...item, faceUp: false }
  let players = game.players.map((p, i) =>
    i === ownerIndex
      ? { ...p, partySlots: newSlots, hand: [...p.hand, returnedItem] }
      : p,
  )

  let nextGame = { ...game, players, pendingItemSelection: null }

  // Source player draws a card
  const { game: afterDraw } = drawEffect(nextGame, { playerIndex: sel.sourcePlayerIndex, count: 1 })
  return { game: afterDraw }
}

/**
 * Holy Curselifter: return a cursed item from one of the source player's own party heroes to their hand.
 * @param {GameState} game
 * @param {string} heroInstanceId
 * @param {string} itemInstanceId
 */
export function resolveHolyCurselifter(game, heroInstanceId, itemInstanceId) {
  const sel = game.pendingItemSelection
  if (!sel) return { game, error: 'No item selection pending.' }

  const sourcePlayer = game.players[sel.sourcePlayerIndex]
  const slotIndex = sourcePlayer?.partySlots.findIndex((s) => s?.hero.instanceId === heroInstanceId) ?? -1
  if (slotIndex === -1) return { game, error: 'Hero not found in your party.' }

  const slot = sourcePlayer.partySlots[slotIndex]
  const item = slot.items.find((it) => it.instanceId === itemInstanceId)
  if (!item) return { game, error: 'Item not found on that hero.' }
  if (item.type !== 'CursedItem') return { game, error: 'That item is not a cursed item.' }

  const newItems = slot.items.filter((it) => it.instanceId !== itemInstanceId)
  const newSlots = sourcePlayer.partySlots.map((s, i) =>
    i === slotIndex ? { ...s, items: newItems } : s,
  )
  const returnedItem = { ...item, faceUp: false }
  const players = game.players.map((p, i) =>
    i === sel.sourcePlayerIndex
      ? { ...p, partySlots: newSlots, hand: [...p.hand, returnedItem] }
      : p,
  )
  return { game: { ...game, players, pendingItemSelection: null } }
}

/**
 * Pass (no choose) for item selection phases that allow it (e.g. Holy Curselifter).
 * @param {GameState} game
 */
export function passItemSelection(game) {
  if (!game.pendingItemSelection) return { game, error: 'No item selection pending.' }
  return { game: { ...game, pendingItemSelection: null } }
}

// ─── Bullseye (055) ──────────────────────────────────────────────────────────

/**
 * @param {GameState} game
 */
export function isPendingTopDeckPickActive(game) {
  return (game.pendingTopDeckPick ?? null) !== null
}

/**
 * Resolve a pick step for Bullseye.
 * Phase 'pick': player picks 1 card to keep (goes to hand); if 2 remain → phase 'order'.
 * Phase 'order': player picks which of the 2 remaining goes on top; the other goes second.
 * @param {GameState} game
 * @param {string} instanceId
 */
export function resolveTopDeckPick(game, instanceId) {
  const pending = game.pendingTopDeckPick
  if (!pending) return { game, error: 'No top-deck pick pending.' }

  const cardIndex = pending.cards.findIndex((c) => c.instanceId === instanceId)
  if (cardIndex === -1) return { game, error: 'Card not found in top-deck selection.' }

  const picked = pending.cards[cardIndex]
  const rest = pending.cards.filter((_, i) => i !== cardIndex)

  if (pending.phase === 'pick') {
    const players = game.players.map((p, i) =>
      i === pending.sourcePlayerIndex
        ? { ...p, hand: [...p.hand, { ...picked, faceUp: true }] }
        : p,
    )
    if (rest.length === 0) {
      return { game: { ...game, players, pendingTopDeckPick: null } }
    }
    if (rest.length === 1) {
      // Only 1 card left — put it back on top, no ordering needed
      return {
        game: {
          ...game,
          players,
          mainDeck: [{ ...rest[0], faceUp: false }, ...game.mainDeck],
          pendingTopDeckPick: null,
        },
      }
    }
    // 2 remain — move to ordering phase
    return {
      game: {
        ...game,
        players,
        pendingTopDeckPick: { ...pending, cards: rest, phase: 'order' },
      },
    }
  }

  // Phase 'order': picked card goes on top, the other goes second
  const other = rest[0]
  return {
    game: {
      ...game,
      mainDeck: [
        { ...picked, faceUp: false },
        { ...other, faceUp: false },
        ...game.mainDeck,
      ],
      pendingTopDeckPick: null,
    },
  }
}

// ─── Quick Draw (056) / Hook (057) ───────────────────────────────────────────

/**
 * @param {GameState} game
 */
export function isPendingBonusItemPlayActive(game) {
  return (game.pendingBonusItemPlay ?? null) !== null
}

/**
 * Player picks an item from their hand to equip as a bonus (no AP cost).
 * Moves directly to a hero in their own party (for ITEM) or an opponent hero (for CURSED_ITEM).
 * After equipping, draws `drawAfter` cards.
 * @param {GameState} game
 * @param {string} itemInstanceId
 * @param {number} heroOwnerIndex - player who owns the target hero
 * @param {number} slotIndex - party slot to equip to
 */
export function resolveBonusItemPlay(game, itemInstanceId, heroOwnerIndex, slotIndex) {
  const pending = game.pendingBonusItemPlay
  if (!pending) return { game, error: 'No bonus item play pending.' }

  const { sourcePlayerIndex } = pending
  const player = game.players[sourcePlayerIndex]
  const cardIndex = player.hand.findIndex((c) => c.instanceId === itemInstanceId)
  if (cardIndex === -1) return { game, error: 'Item not found in hand.' }

  const card = player.hand[cardIndex]
  const isItem = card.type === CARD_TYPES.ITEM
  const isCursedItem = card.type === CARD_TYPES.CURSED_ITEM
  if (!isItem && !isCursedItem) return { game, error: 'Not an item card.' }

  // Validate eligibility
  if (pending.eligibleInstanceIds !== null && !pending.eligibleInstanceIds.includes(itemInstanceId)) {
    return { game, error: 'That card is not eligible for this effect.' }
  }

  // Validate target
  if (isItem && heroOwnerIndex !== sourcePlayerIndex) {
    return { game, error: 'Regular items must be equipped to your own heroes.' }
  }
  if (isCursedItem && heroOwnerIndex === sourcePlayerIndex) {
    return { game, error: 'Cursed items must be equipped to opponent heroes.' }
  }

  const targetPlayer = game.players[heroOwnerIndex]
  const slot = targetPlayer?.partySlots[slotIndex]
  if (!slot) return { game, error: 'No hero in that slot.' }

  // Remove item from source hand
  const newHand = player.hand.filter((_, i) => i !== cardIndex)
  const equippedItem = { ...card, faceUp: true }

  // Add item to target hero slot
  const newSlots = targetPlayer.partySlots.map((s, i) =>
    i === slotIndex ? { ...s, items: [...s.items, equippedItem] } : s,
  )

  let players = game.players.map((p, i) => {
    if (i === sourcePlayerIndex && i === heroOwnerIndex) {
      return { ...p, hand: newHand, partySlots: newSlots }
    }
    if (i === sourcePlayerIndex) return { ...p, hand: newHand }
    if (i === heroOwnerIndex) return { ...p, partySlots: newSlots }
    return p
  })

  let nextGame = { ...game, players, pendingBonusItemPlay: null }

  if (pending.drawAfter > 0) {
    const { game: afterDraw } = drawEffect(nextGame, { playerIndex: sourcePlayerIndex, count: pending.drawAfter })
    nextGame = afterDraw
  }

  return { game: nextGame }
}

/**
 * Pass the bonus item play (skip equipping) and draw `drawAfter` cards.
 * @param {GameState} game
 */
export function passBonusItemPlay(game) {
  const pending = game.pendingBonusItemPlay
  if (!pending) return { game, error: 'No bonus item play pending.' }
  let nextGame = { ...game, pendingBonusItemPlay: null }
  if (pending.drawAfter > 0) {
    const { game: afterDraw } = drawEffect(nextGame, { playerIndex: pending.sourcePlayerIndex, count: pending.drawAfter })
    nextGame = afterDraw
  }
  return { game: nextGame }
}

// ─── Magic Play Choice (Snowball 067, Buttons 072) ───────────────────────────

/**
 * @param {GameState} game
 */
export function isPendingMagicPlayChoiceActive(game) {
  return (game.pendingMagicPlayChoice ?? null) !== null
}

/**
 * Source player confirms playing the drawn/pulled Magic card immediately.
 * Removes it from hand, discards it, runs its effect, then draws `drawAfterPlay` cards.
 * @param {GameState} game
 */
export function confirmMagicPlayChoice(game) {
  const pending = game.pendingMagicPlayChoice
  if (!pending) return { game, error: 'No magic play choice pending.' }

  const player = game.players[pending.sourcePlayerIndex]
  const handIndex = player?.hand.findIndex((c) => c.instanceId === pending.magicCard.instanceId) ?? -1
  if (handIndex === -1) return { game: { ...game, pendingMagicPlayChoice: null } }

  const card = withFaceUp(player.hand[handIndex])
  const hand = player.hand.filter((_, i) => i !== handIndex)
  const players = game.players.map((p, i) =>
    i === pending.sourcePlayerIndex ? { ...p, hand } : p,
  )

  const cleared = { ...game, players, pendingMagicPlayChoice: null }

  // Draw bonus cards first, then run magic effect via staged play (no AP, no challenge)
  let afterDraw = cleared
  if ((pending.drawAfterPlay ?? 0) > 0) {
    const { game: gd } = drawEffect(cleared, { playerIndex: pending.sourcePlayerIndex, count: pending.drawAfterPlay })
    afterDraw = gd
  }

  /** @type {StagedPlay} */
  const staged = { card, attackerIndex: pending.sourcePlayerIndex, cardType: CARD_TYPES.MAGIC }
  return resolveStagedPlay(afterDraw, staged)
}

/**
 * Source player declines playing the Magic card — it stays in their hand.
 * @param {GameState} game
 */
export function declineMagicPlayChoice(game) {
  if (!game.pendingMagicPlayChoice) return { game, error: 'No magic play choice pending.' }
  return { game: { ...game, pendingMagicPlayChoice: null } }
}

// ─── Wiggles (069) bonus hero skill roll ─────────────────────────────────────

/**
 * @param {GameState} game
 */
export function isPendingWigglesRollActive(game) {
  return (game.pendingWigglesRoll ?? null) !== null
}

/**
 * Source player confirms rolling for the stolen hero's ability (bonus — no AP cost).
 * @param {GameState} game
 */
export function confirmWigglesRoll(game) {
  const pending = game.pendingWigglesRoll
  if (!pending) return { game, diceRoll: null, error: 'No Wiggles roll pending.' }

  // Find the stolen hero in source player's party
  const player = game.players[pending.sourcePlayerIndex]
  const slot = player?.partySlots.find((s) => s?.hero.instanceId === pending.stolenHeroInstanceId)
  if (!slot) return { game: { ...game, pendingWigglesRoll: null }, diceRoll: null }

  const hero = slot.hero
  const baseRoll = rollForHeroEffect(hero.rollRequirement ?? 6, pending.sourcePlayerIndex)
  const cursedRoll = applyHeroRollCurses(baseRoll, slot.items)
  const leaderRoll = applyLeaderPassives(game, cursedRoll, pending.sourcePlayerIndex)
  const pendingRoll = attachHeroEffectMeta(leaderRoll, hero, pending.sourcePlayerIndex)

  const mw = openModifierWindow(game, pendingRoll)
  return {
    game: { ...game, pendingWigglesRoll: null, ...mw },
    diceRoll: mw.pendingRoll,
  }
}

/**
 * Source player declines rolling for the stolen hero's ability.
 * @param {GameState} game
 */
export function declineWigglesRoll(game) {
  if (!game.pendingWigglesRoll) return { game, error: 'No Wiggles roll pending.' }
  return { game: { ...game, pendingWigglesRoll: null } }
}

/**
 * @param {GameState} game
 */
export function passChallengeWindow(game, playerIndex = null) {
  if (!game.pendingChallenge) {
    return { game, diceRoll: null }
  }

  const attackerIndex = game.pendingChallenge.stagedPlay.attackerIndex

  if (playerIndex !== null) {
    const passedBy = [...(game.challengePassedBy ?? []), playerIndex]
    const nonAttackers = game.players.map((_, i) => i).filter((i) => i !== attackerIndex)
    const allPassed = nonAttackers.every((i) => passedBy.includes(i))

    if (!allPassed) {
      return {
        game: { ...game, challengePassedBy: passedBy },
        diceRoll: null,
      }
    }
  }

  const staged = game.pendingChallenge.stagedPlay
  const cleared = { ...game, pendingChallenge: null, challengePassedBy: [], challengeStartedAt: null }
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

  if (game.antiChallenge === true) {
    return { game, error: 'Challenge cards are blocked right now.' }
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

  let pendingRoll = rollForChallenge(
    staged.attackerIndex,
    challengerIndex,
    attacker.name,
    challenger.name,
    staged,
  )

  // Leader 103: +2 to the owning player's side of every challenge roll
  if (game.players[staged.attackerIndex]?.leader?.effectId === 'leaderChallengeRollBonus') {
    pendingRoll = applyDeltaToChallengeRoll(pendingRoll, 2, game.players[staged.attackerIndex].leader.name, 'attacker')
  }
  if (game.players[challengerIndex]?.leader?.effectId === 'leaderChallengeRollBonus') {
    pendingRoll = applyDeltaToChallengeRoll(pendingRoll, 2, game.players[challengerIndex].leader.name, 'challenger')
  }

  const hand = challenger.hand.filter((_, index) => index !== handIndex)
  const discardPile = [...game.discardPile, withFaceUp(card)]

  const players = game.players.map((p, index) =>
    index === challengerIndex ? { ...p, hand } : p,
  )

  const mw = openModifierWindow(game, pendingRoll)
  return {
    game: {
      ...game,
      players,
      discardPile,
      pendingChallenge: null,
      challengePassedBy: [],
      challengeStartedAt: null,
      ...mw,
    },
    pendingRoll: mw.pendingRoll,
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

  if (slot.items.some((item) => item.effectId === 'sealingKey')) {
    return {
      game,
      diceRoll: null,
      error: `${slot.hero.name}'s skill is sealed by Sealing Key.`,
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
          sourceHeroInstanceId: slot.hero.instanceId,
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
          scope: slot.hero.heroTargetScope ?? 'any',
          sourceHeroInstanceId: slot.hero.instanceId,
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
          sourceHeroInstanceId: slot.hero.instanceId,
        },
      },
      diceRoll: null,
    }
  }

  const baseRoll = rollForHeroEffect(slot.hero.rollRequirement ?? 6, playerIndex)
  const cursedRoll = applyHeroRollCurses(baseRoll, slot.items)
  const leaderRoll = applyLeaderPassives(game, cursedRoll, playerIndex)
  const pendingRoll = attachHeroEffectMeta(leaderRoll, slot.hero, playerIndex)

  const mw = openModifierWindow(game, pendingRoll)
  return {
    game: {
      ...game,
      players,
      actionPoints: game.actionPoints - 1,
      ...mw,
    },
    diceRoll: mw.pendingRoll,
  }
}

/**
 * @param {GameState} game
 * @param {string} monsterInstanceId
 */
/**
 * Recursively check if all monster requirements can be matched to distinct heroes.
 * Each hero / leader slot satisfies at most one requirement.
 * REQUIREMENT_HERO matches any class; a specific class string matches only that class.
 *
 * @param {string[]} requirements
 * @param {string[]} available - one entry per available hero (their current class string)
 * @returns {boolean}
 */
function canMatchRequirements(requirements, available) {
  if (requirements.length === 0) return true
  const [first, ...rest] = requirements
  for (let i = 0; i < available.length; i++) {
    const cls = available[i]
    if (first === REQUIREMENT_HERO || cls === first) {
      const remaining = [...available.slice(0, i), ...available.slice(i + 1)]
      if (canMatchRequirements(rest, remaining)) return true
    }
  }
  return false
}

/**
 * Check whether a player's party (+ leader) meets a monster's requirements.
 * Leader counts as exactly one hero with their class.
 * A single hero cannot satisfy two requirements simultaneously.
 *
 * @param {GameState} game
 * @param {number} playerIndex
 * @param {import('./gameState.js').CardInstance} monster
 * @returns {boolean}
 */
function meetsMonsterRequirements(game, playerIndex, monster) {
  const requirements = monster.requirement ?? []
  if (requirements.length === 0) return true

  const player = game.players[playerIndex]
  /** @type {string[]} */
  const available = []

  // Leader provides one hero slot with their class
  if (player.leader?.class) available.push(player.leader.class)

  // Each occupied party slot provides one slot with the hero's current class
  for (const slot of player.partySlots) {
    if (slot) available.push(slot.hero.class)
  }

  return canMatchRequirements(requirements, available)
}

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

  if (!meetsMonsterRequirements(game, playerIndex, monster)) {
    return { game, diceRoll: null, error: "Your party doesn't meet this monster's requirements." }
  }

  let pendingRoll = rollForMonsterAttack(
    monster.instanceId,
    monster.name,
    playerIndex,
    monster.failAtOrBelow ?? 5,
    monster.successAtOrAbove ?? 8,
  )
  if (game.players[playerIndex]?.leader?.effectId === 'leaderMonsterRollBonus') {
    pendingRoll = applyDeltaToPendingRoll(pendingRoll, 1, game.players[playerIndex].leader.name)
  }
  const mw = openModifierWindow(game, pendingRoll)
  return {
    game: {
      ...game,
      actionPoints: game.actionPoints - ATTACK_MONSTER_AP_COST,
      ...mw,
    },
    diceRoll: mw.pendingRoll,
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

  if (game.antiModifier === true) {
    return { game, error: 'Modifier cards are blocked right now.' }
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

  // Leader 101: after playing any modifier, grant a free +1/-1 choice on the same roll
  const hasLeaderBonus = game.players[playerIndex]?.leader?.effectId === 'leaderModifierBonus'
  const leaderBonus = hasLeaderBonus
    ? {
        pendingLeaderModifierBonus: {
          playerIndex,
          leaderName: game.players[playerIndex].leader.name,
          challengeTarget: challengeTarget ?? null,
        },
      }
    : {}

  const baseGame = {
    ...game,
    players,
    discardPile,
    pendingRoll,
    modifierPassedBy: [],
    modifierStartedAt: Date.now(),
    ...leaderBonus,
  }

  // 205 Crowned Serpent: any player playing a Modifier lets passive holder draw a card.
  // If leader 101 bonus is pending, defer — it will be checked in resolveLeaderModifierBonus.
  const finalGame = hasLeaderBonus
    ? baseGame
    : applyOnModifierPlayPassives(baseGame)

  return { game: finalGame, pendingRoll }
}

/**
 * Activate the leader's active skill (costs 1 AP).
 * Sets pendingLeaderSkillTarget so the player can choose a target player.
 * @param {GameState} game
 * @param {number} playerIndex
 */
export function activateLeaderSkill(game, playerIndex) {
  if (game.currentPlayerIndex !== playerIndex) {
    return { game, error: 'Not your turn.' }
  }
  if (isInterruptPhaseActive(game)) {
    return { game, error: 'Finish the current action first.' }
  }
  const leader = game.players[playerIndex]?.leader
  if (!leader?.effectId) {
    return { game, error: 'Leader has no active skill.' }
  }
  const ACTIVE_SKILL_IDS = ['leaderActivePull']
  if (!ACTIVE_SKILL_IDS.includes(leader.effectId)) {
    return { game, error: 'Leader skill is passive, not active.' }
  }
  if (game.actionPoints < 1) {
    return { game, error: 'Not enough action points (costs 1 AP).' }
  }
  return {
    game: {
      ...game,
      actionPoints: game.actionPoints - 1,
      pendingLeaderSkillTarget: {
        sourcePlayerIndex: playerIndex,
        skillId: leader.effectId,
      },
    },
  }
}

/**
 * Resolve the leader skill target selection.
 * @param {GameState} game
 * @param {number} targetPlayerIndex
 */
export function selectLeaderSkillTarget(game, targetPlayerIndex) {
  const pending = game.pendingLeaderSkillTarget
  if (!pending) return { game, error: 'No leader skill pending.' }

  const cleared = { ...game, pendingLeaderSkillTarget: null }
  const leader = game.players[pending.sourcePlayerIndex]?.leader

  if (pending.skillId === 'leaderActivePull') {
    const target = cleared.players[targetPlayerIndex]
    if (!target || target.hand.length === 0) return { game: cleared }
    return {
      game: {
        ...cleared,
        pendingCardPull: {
          sourcePlayerIndex: pending.sourcePlayerIndex,
          targetPlayerIndex,
          bonusTriggerType: null,
          sourceLabel: leader?.name ?? 'Leader',
        },
      },
    }
  }

  return { game: cleared }
}

/**
 * @param {GameState} game
 */
export function isPendingLeaderSkillTargetActive(game) {
  return (game.pendingLeaderSkillTarget ?? null) !== null
}

/**
 * Leader 101: player chose +1 or -1 after playing a modifier.
 * Applies the delta to the current pendingRoll (same side as the triggering modifier)
 * without consuming any card or touching the discard pile.
 *
 * @param {GameState} game
 * @param {number} delta  +1 or -1
 */
export function resolveLeaderModifierBonus(game, delta) {
  const pending = game.pendingLeaderModifierBonus
  if (!pending) return { game, error: 'No leader modifier bonus pending.' }
  if (!game.pendingRoll) return { game: { ...game, pendingLeaderModifierBonus: null } }

  const label = `${pending.leaderName}: ${delta >= 0 ? '+' : ''}${delta}`
  const pendingRoll =
    game.pendingRoll.rollType === 'challenge' && pending.challengeTarget
      ? applyDeltaToChallengeRoll(game.pendingRoll, delta, label, pending.challengeTarget)
      : applyDeltaToPendingRoll(game.pendingRoll, delta, label)

  // After leader 101 resolves, check Crowned Serpent passive (deferred from modifier play)
  const afterBonus = { ...game, pendingRoll, pendingLeaderModifierBonus: null }
  const finalGame = applyOnModifierPlayPassives(afterBonus)

  return { game: finalGame, pendingRoll }
}

/**
 * Resolve the Wizard leader's "draw a card?" bonus.
 * @param {GameState} game
 * @param {boolean} shouldDraw - true if the player chose to draw
 * @returns {{ game: GameState, error: string | null }}
 */
export function resolveLeaderWizardDraw(game, shouldDraw) {
  const pending = game.pendingLeaderWizardDraw
  if (!pending) return { game, error: 'No wizard draw pending.' }
  let nextGame = { ...game, pendingLeaderWizardDraw: null }
  if (shouldDraw) {
    const { game: afterDraw } = drawEffect(nextGame, { playerIndex: pending.playerIndex, count: 1 })
    nextGame = afterDraw
  }
  return { game: nextGame, error: null }
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
    const resolvedGame = { ...game, pendingRoll: null, pendingDestroyTargets: [] }
    const gameWithCoin = success ? applyOnSuccessItemEffects(resolvedGame, pending) : resolvedGame
    return { game: gameWithCoin, diceRoll: null }
  }

  const { game: afterEffect, error } = runCardEffect(game, pending.effectId, {
    sourcePlayerIndex: pending.effectSourcePlayerIndex,
    targetPlayerIndex: pending.effectTargetPlayerIndex,
    sourceLabel: pending.heroName,
    count: pending.qiBearCount,
    heroTargets: game.pendingDestroyTargets,
    sourceHeroInstanceId: pending.sourceHeroInstanceId,
  })

  const resolvedGame = { ...afterEffect, pendingRoll: null, pendingDestroyTargets: [] }
  const gameWithCoin = applyOnSuccessItemEffects(resolvedGame, pending)
  return {
    game: gameWithCoin,
    diceRoll: null,
    effectError: error,
  }
}

/**
 * Resolve a monster attack roll after the modifier phase completes.
 * - sum >= successAtOrAbove (8): monster slain → move to player's slainMonsters,
 *   draw next monster from deck to fill the gap.
 * - sum <= failAtOrBelow (5): failure → player must sacrifice one of their own heroes.
 * - otherwise: nothing happens.
 *
 * @param {GameState} game
 * @returns {{ game: GameState, monsterSlain?: boolean }}
 */
function finalizeMonsterRoll(game) {
  const roll = game.pendingRoll
  if (!roll || roll.rollType !== 'monster') return { game }

  const { currentSum, rollingPlayerIndex, targetMonsterInstanceId } = roll

  const cleared = { ...game, pendingRoll: null }

  // Look up the monster to check for custom (possibly reversed) thresholds
  const monster = cleared.activeMonsters.find(
    (m) => m.instanceId === targetMonsterInstanceId,
  )

  // Determine success/failure based on monster-specific thresholds.
  // Dracos (and any future reversed monsters) use successAtOrBelow/failAtOrAbove.
  const isReversed = monster?.successAtOrBelow !== undefined
  const isSuccess = isReversed
    ? currentSum <= (monster.successAtOrBelow ?? 5)
    : currentSum >= (monster?.successAtOrAbove ?? roll.successAtOrAbove ?? 8)
  const isFailure = isReversed
    ? currentSum >= (monster.failAtOrAbove ?? 8)
    : currentSum <= (monster?.failAtOrBelow ?? roll.failAtOrBelow ?? 5)

  if (isSuccess) {
    // ── Success: slay the monster ──────────────────────────────────────────
    if (!monster) return { game: cleared }

    const newActiveMonsters = cleared.activeMonsters.filter(
      (m) => m.instanceId !== targetMonsterInstanceId,
    )

    // Draw replacement from monster deck (if any remain)
    const [nextMonster, ...remainingDeck] = cleared.monsterDeck
    const refilled = nextMonster
      ? [...newActiveMonsters, withFaceUp(nextMonster)]
      : newActiveMonsters

    // Add to the slaying player's slainMonsters
    const players = cleared.players.map((p, i) =>
      i === rollingPlayerIndex
        ? { ...p, slainMonsters: [...p.slainMonsters, withFaceUp(monster)] }
        : p,
    )

    return {
      game: {
        ...cleared,
        players,
        activeMonsters: refilled,
        monsterDeck: nextMonster ? remainingDeck : cleared.monsterDeck,
      },
      monsterSlain: true,
    }
  }

  if (isFailure) {
    const monsterName = monster?.name ?? 'Monster'

    // ── Custom failure: Discard N cards (e.g. Orthus) ─────────────────────
    if (monster?.failEffectId === 'discardCards') {
      const count = monster.failEffectCount ?? 2
      return {
        game: {
          ...cleared,
          pendingDiscard: {
            playerIndex: rollingPlayerIndex,
            sourcePlayerIndex: rollingPlayerIndex,
            count,
            sourceLabel: `${monsterName}: Attack Failed`,
          },
        },
      }
    }

    // ── Default failure: sacrifice a hero ──────────────────────────────────
    const player = cleared.players[rollingPlayerIndex]
    const hasHero = player?.partySlots.some((s) => s !== null)
    if (!hasHero) return { game: cleared }

    return {
      game: {
        ...cleared,
        pendingHeroSelection: {
          sourcePlayerIndex: rollingPlayerIndex,
          scope: 'own',
          action: 'sacrifice',
          sourceLabel: 'Monster Attack Failed',
        },
      },
    }
  }

  // Neutral — nothing happens
  return { game: cleared }
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

  if (game.pendingRoll.rollType === 'monster') {
    return finalizeMonsterRoll(game).game
  }

  return { ...game, pendingRoll: null }
}

/**
 * @param {GameState} game
 */
export function passModifierPhaseWithResult(game, playerIndex = null) {
  if (!game.pendingRoll) {
    return { game, diceRoll: null, challengeSuccess: false }
  }

  if (playerIndex !== null) {
    const passedBy = [...(game.modifierPassedBy ?? []), playerIndex]
    const allPassed = game.players.every((_, i) => passedBy.includes(i))

    if (!allPassed) {
      return {
        game: { ...game, modifierPassedBy: passedBy },
        diceRoll: null,
        challengeSuccess: false,
      }
    }
  }

  const cleared = { ...game, modifierPassedBy: [] }

  if (cleared.pendingRoll.rollType === 'challenge') {
    return finalizeChallenge(cleared)
  }

  if (cleared.pendingRoll.rollType === 'hero') {
    return { ...finalizeHeroRoll(cleared), challengeSuccess: false }
  }

  if (cleared.pendingRoll.rollType === 'monster') {
    const { game: afterMonster, monsterSlain } = finalizeMonsterRoll(cleared)
    return { game: afterMonster, diceRoll: null, challengeSuccess: false, monsterSlain }
  }

  return {
    game: { ...cleared, pendingRoll: null },
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
  const sourceItems = sel.sourceHeroInstanceId ? findHeroItems(game, sel.sourceHeroInstanceId) : []
  const cursedRoll = applyHeroRollCurses(baseRoll, sourceItems)
  const leaderRoll = applyLeaderPassives(game, cursedRoll, sel.sourcePlayerIndex)
  /** @type {PendingRoll} */
  const pendingRoll = {
    ...leaderRoll,
    heroName: sel.heroName,
    targetLabel: `${sel.heroName} → ${targetName}`,
    effectId: sel.effectId,
    effectSourcePlayerIndex: sel.sourcePlayerIndex,
    effectTargetPlayerIndex: targetPlayerIndex,
    rollingHeroInstanceId: sel.sourceHeroInstanceId,
  }

  const mw = openModifierWindow(game, pendingRoll)
  return {
    game: { ...game, pendingEffectTargetSelection: null, ...mw },
    pendingRoll: mw.pendingRoll,
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

  // Plundering Puma-style: more pulls still queued
  const currentRemaining = pending.remainingPulls ?? 1
  const targetHandAfter = afterPull.players[pending.targetPlayerIndex].hand
  /** @type {import('./gameState.js').PendingCardPull | null} */
  let nextCardPull = null

  if (currentRemaining > 1 && targetHandAfter.length > 0) {
    nextCardPull = {
      sourcePlayerIndex: pending.sourcePlayerIndex,
      targetPlayerIndex: pending.targetPlayerIndex,
      bonusTriggerType: pending.bonusTriggerType,
      sourceLabel: pending.sourceLabel,
      remainingPulls: currentRemaining - 1,
      drawForTargetAfter: pending.drawForTargetAfter,
    }
  } else {
    // Check for bonus pull (only once — bonusTriggerType is null on the bonus pick)
    const bonusTriggered =
      pending.bonusTriggerType !== null &&
      card.type === pending.bonusTriggerType &&
      targetHandAfter.length > 0
    if (bonusTriggered) {
      nextCardPull = {
        sourcePlayerIndex: pending.sourcePlayerIndex,
        targetPlayerIndex: pending.targetPlayerIndex,
        bonusTriggerType: null,
        sourceLabel: pending.sourceLabel,
        allowImmediateHeroPlay: pending.allowImmediateHeroPlay,
        isBonusPull: true,
      }
    }
  }

  // After last pull: draw compensation cards for target if requested
  let gameAfterExtras = afterPull
  if (!nextCardPull && (pending.drawForTargetAfter ?? 0) > 0) {
    const { game: gd } = drawEffect(afterPull, {
      playerIndex: pending.targetPlayerIndex,
      count: pending.drawForTargetAfter,
    })
    gameAfterExtras = gd
  }

  // Lucky Bucky-style follow-up: if the pulled card is Hero, allow immediate play.
  const openHeroPlayChoice =
    pending.allowImmediateHeroPlay === true &&
    card.type === CARD_TYPES.HERO

  // Sly Pickings-style follow-up: if the pulled card is an item, allow immediate play.
  const openItemPlayChoice =
    pending.allowImmediateItemPlay === true &&
    (card.type === CARD_TYPES.ITEM || card.type === CARD_TYPES.CURSED_ITEM)

  // Buttons-style follow-up: if the pulled card is a Magic card, allow immediate play.
  const openMagicPlayChoice =
    pending.allowImmediateMagicPlay === true &&
    card.type === CARD_TYPES.MAGIC

  return {
    game: {
      ...gameAfterExtras,
      pendingCardPull: nextCardPull,
      ...(openHeroPlayChoice
        ? {
            pendingHeroPlayChoice: {
              sourcePlayerIndex: pending.sourcePlayerIndex,
              heroCard: withFaceUp(card),
              sourceLabel: pending.sourceLabel,
            },
          }
        : {}),
      ...(openItemPlayChoice
        ? {
            pendingBonusItemPlay: {
              sourcePlayerIndex: pending.sourcePlayerIndex,
              sourceLabel: pending.sourceLabel,
              eligibleInstanceIds: [card.instanceId],
              drawAfter: 0,
            },
          }
        : {}),
      ...(openMagicPlayChoice
        ? {
            pendingMagicPlayChoice: {
              sourcePlayerIndex: pending.sourcePlayerIndex,
              magicCard: withFaceUp(card),
              sourceLabel: pending.sourceLabel,
              drawAfterPlay: 0,
            },
          }
        : {}),
    },
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

  // Multi-target accumulation (e.g. Fluffy needs 2 targets before rolling)
  const maxTargets = sel.maxTargets ?? 1
  if (maxTargets > 1) {
    const alreadySelected = sel.selectedTargets ?? []
    if (alreadySelected.includes(heroInstanceId)) {
      return { game, error: 'That hero is already selected.' }
    }
    const newSelected = [...alreadySelected, heroInstanceId]
    if (newSelected.length < maxTargets) {
      // Still need more targets — update selection state, highlight chosen heroes
      return {
        game: {
          ...game,
          pendingEffectHeroTargetSelection: { ...sel, selectedTargets: newSelected },
          pendingDestroyTargets: newSelected,
        },
      }
    }
    // All targets collected — now roll
    const baseRoll = rollForHeroEffect(sel.rollRequirement, sel.sourcePlayerIndex)
    const sourceItems = sel.sourceHeroInstanceId ? findHeroItems(game, sel.sourceHeroInstanceId) : []
    const cursedRoll = applyHeroRollCurses(baseRoll, sourceItems)
    const leaderRoll = applyLeaderPassives(game, cursedRoll, sel.sourcePlayerIndex)
    /** @type {PendingRoll} */
    const pendingRoll = {
      ...leaderRoll,
      heroName: sel.heroName,
      targetLabel: `${sel.heroName} → ${newSelected.length} heroes`,
      effectId: sel.effectId,
      effectSourcePlayerIndex: sel.sourcePlayerIndex,
      sourceHeroInstanceId: sel.sourceHeroInstanceId,
      rollingHeroInstanceId: sel.sourceHeroInstanceId,
    }
    const mw = openModifierWindow(game, pendingRoll)
    return {
      game: { ...game, pendingEffectHeroTargetSelection: null, pendingDestroyTargets: newSelected, ...mw },
      pendingRoll: mw.pendingRoll,
    }
  }

  // Single-target path (original behaviour)
  const baseRoll = rollForHeroEffect(sel.rollRequirement, sel.sourcePlayerIndex)
  const sourceItems = sel.sourceHeroInstanceId ? findHeroItems(game, sel.sourceHeroInstanceId) : []
  const cursedRoll = applyHeroRollCurses(baseRoll, sourceItems)
  const leaderRoll = applyLeaderPassives(game, cursedRoll, sel.sourcePlayerIndex)
  /** @type {PendingRoll} */
  const pendingRoll = {
    ...leaderRoll,
    heroName: sel.heroName,
    targetLabel: `${sel.heroName} → ${targetHeroName}`,
    effectId: sel.effectId,
    effectSourcePlayerIndex: sel.sourcePlayerIndex,
    sourceHeroInstanceId: sel.sourceHeroInstanceId,
    rollingHeroInstanceId: sel.sourceHeroInstanceId,
  }

  const mw = openModifierWindow(game, pendingRoll)
  return {
    game: { ...game, pendingEffectHeroTargetSelection: null, pendingDestroyTargets: [heroInstanceId], ...mw },
    pendingRoll: mw.pendingRoll,
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
  const sourceItems = sel.sourceHeroInstanceId ? findHeroItems(game, sel.sourceHeroInstanceId) : []
  const cursedRoll = applyHeroRollCurses(baseRoll, sourceItems)
  const leaderRoll = applyLeaderPassives(game, cursedRoll, sel.sourcePlayerIndex)
  /** @type {PendingRoll} */
  const pendingRoll = {
    ...leaderRoll,
    heroName: sel.heroName,
    targetLabel:
      sel.count > 0
        ? `${sel.heroName}: discard ${sel.count}, destroy ${sel.count}`
        : `${sel.heroName} skill`,
    effectId: sel.effectId,
    effectSourcePlayerIndex: sel.sourcePlayerIndex,
    qiBearCount: sel.count,
    rollingHeroInstanceId: sel.sourceHeroInstanceId,
  }

  const mw = openModifierWindow(game, pendingRoll)
  return {
    game: { ...game, pendingQiBearSelection: null, pendingDestroyTargets: sel.heroTargets, ...mw },
    pendingRoll: mw.pendingRoll,
  }
}

/**
 * Cancel the current hero selection (destroy/steal/swap) without doing anything.
 * @param {GameState} game
 */
export function cancelHeroSelection(game) {
  return { game: { ...game, pendingHeroSelection: null } }
}

/**
 * Cancel the pre-roll hero target selection (Bad Axe / Tipsy Tootie style) without doing anything.
 * @param {GameState} game
 */
export function cancelEffectHeroTargetSelection(game) {
  return { game: { ...game, pendingEffectHeroTargetSelection: null } }
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
  } else if (sel.action === 'swapSource') {
    // First step of Forced Exchange: record the chosen hero, open opponent selection
    return {
      game: {
        ...game,
        pendingHeroSelection: {
          ...sel,
          action: 'swapTarget',
          scope: 'opponents',
          swapSourceHeroInstanceId: heroInstanceId,
          swapSourcePlayerIndex: partyOwnerIndex,
        },
      },
    }
  } else if (sel.action === 'swapTarget') {
    result = swapHeroEffect(game, {
      playerAIndex: sel.swapSourcePlayerIndex,
      heroAInstanceId: sel.swapSourceHeroInstanceId,
      playerBIndex: partyOwnerIndex,
      heroBInstanceId: heroInstanceId,
    })
  } else {
    return { game, error: `Unknown hero-selection action: ${sel.action}` }
  }

  if (result.error) {
    return { game, error: result.error }
  }

  const continuation = sel.afterPendingDiscard ?? null
  const nextHeroSel = sel.afterHeroSelection ?? null
  return {
    game: {
      ...result.game,
      pendingHeroSelection: nextHeroSel,
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
  let discardPile
  if (pick.source === 'discardPile') {
    // remainder goes back to discard pile (they were temporarily pulled out for display)
    discardPile = [...game.discardPile, ...remainder.map((c) => withFaceUp(c))]
  } else {
    discardPile = [...game.discardPile, ...remainder.map((c) => withFaceUp(c))]
  }
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

  if (remaining === 0 && pending.afterEffect === 'destroyHero') {
    const anyHero = afterDiscard.players.some((p) =>
      p.partySlots.some((s) => s !== null),
    )
    return {
      game: {
        ...afterDiscard,
        pendingDiscard: null,
        ...(anyHero
          ? {
              pendingHeroSelection: {
                sourcePlayerIndex: pending.sourcePlayerIndex,
                scope: 'any',
                action: 'destroy',
                sourceLabel: pending.sourceLabel,
              },
            }
          : {}),
      },
    }
  }

  if (remaining === 0 && pending.afterEffect === 'stealHero') {
    const hasOpponentHero = afterDiscard.players.some((p, i) =>
      i !== pending.sourcePlayerIndex && p.partySlots.some((s) => s !== null),
    )
    return {
      game: {
        ...afterDiscard,
        pendingDiscard: null,
        ...(hasOpponentHero
          ? {
              pendingHeroSelection: {
                sourcePlayerIndex: pending.sourcePlayerIndex,
                scope: 'opponents',
                action: 'steal',
                sourceLabel: pending.sourceLabel,
              },
            }
          : {}),
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
 * Greedy Cheeks: current giver selects one card from their hand to give to the target.
 * Resolves the first index in `pendingGive.giverQueue`, then advances the queue.
 *
 * @param {GameState} game
 * @param {number} giverPlayerIndex
 * @param {string} instanceId
 */
export function giveForPendingGive(game, giverPlayerIndex, instanceId) {
  const pending = game.pendingGive
  if (!pending) {
    return { game, error: 'No give required.' }
  }

  const expectedGiver = pending.giverQueue[0]
  if (expectedGiver !== giverPlayerIndex) {
    return { game, error: 'This player is not currently giving.' }
  }

  const { game: afterGive, error } = giveEffect(game, {
    sourcePlayerIndex: giverPlayerIndex,
    targetPlayerIndex: pending.targetPlayerIndex,
    instanceId,
  })
  if (error) {
    return { game, error }
  }

  // advance to next giver; skip players who now have empty hands
  let queue = pending.giverQueue.slice(1)
  while (queue.length > 0 && afterGive.players[queue[0]]?.hand.length === 0) {
    queue = queue.slice(1)
  }

  return {
    game: {
      ...afterGive,
      pendingGive:
        queue.length > 0
          ? { ...pending, giverQueue: queue }
          : null,
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

const ALL_HERO_CLASSES = Object.values(HERO_CLASSES)

/**
 * Check if a player has met either win condition.
 * Returns the winning playerIndex, or -1 if no winner yet.
 * @param {GameState} game
 * @param {number} playerIndex
 */
function checkWinCondition(game, playerIndex) {
  const player = game.players[playerIndex]
  if (!player) return false

  // Condition 1: slain 3+ monsters
  if (player.slainMonsters.length >= 3) return true

  // Condition 2: at least one hero of every class in party (leader counts too)
  const classesInParty = new Set(
    player.partySlots
      .filter((s) => s !== null)
      .map((s) => s.hero.class),
  )
  if (player.leader?.class) classesInParty.add(player.leader.class)
  if (ALL_HERO_CLASSES.every((cls) => classesInParty.has(cls))) return true

  return false
}

/**
 * @param {GameState} game
 */
export function endTurn(game) {
  if (game.winner != null) return game
  const nextIndex = (game.currentPlayerIndex + 1) % game.players.length

  const players = game.players.map((p, index) => ({
    ...p,
    partySlots:
      index === game.currentPlayerIndex
        ? resetPartySkillUsage(p.partySlots)
        : index === nextIndex
          ? clearPartyProtectionFlags(p.partySlots)
          : p.partySlots,
  }))

  return {
    ...game,
    players,
    currentPlayerIndex: nextIndex,
    actionPoints: (game.debugInfiniteAp && nextIndex === 0) ? 999 : INITIAL_ACTION_POINTS,
    pendingRoll: null,
    pendingChallenge: null,
    pendingEffectTargetSelection: null,
    pendingEffectHeroTargetSelection: null,
    pendingCardPull: null,
    pendingDiscard: null,
    pendingGive: null,
    pendingStagedCardPick: null,
    pendingHeroSelection: null,
    pendingQiBearSelection: null,
    pendingHeroPlayChoice: null,
    pendingHeroFromHandPlay: null,
    pendingDestroyTargets: [],
    globalRollBonus: 0,
    pendingItemSelection: null,
    pendingTopDeckPick: null,
    pendingBonusItemPlay: null,
    pendingMagicPlayChoice: null,
    pendingWigglesRoll: null,
    pendingLeaderModifierBonus: null,
    pendingLeaderSkillTarget: null,
    pendingLeaderWizardDraw: null,
    antiChallenge: false,
    antiModifier: false,
    challengePassedBy: [],
    modifierPassedBy: [],
    challengeStartedAt: null,
    modifierStartedAt: null,
    // Party protections expire when it becomes that player's turn again
    partyAntiSteal: game.partyAntiSteal === nextIndex ? null : (game.partyAntiSteal ?? null),
    partyAntiDestroy: game.partyAntiDestroy === nextIndex ? null : (game.partyAntiDestroy ?? null),
    winner: checkWinCondition(game, game.currentPlayerIndex) ? game.currentPlayerIndex : null,
  }
}

/**
 * Fuzzy Cheeks: source player selected a Hero card from their hand to play immediately.
 * This does NOT cost AP and does NOT open a challenge window.
 *
 * @param {GameState} game
 * @param {number} playerIndex
 * @param {string} instanceId
 */
export function playHeroFromHandForPending(game, playerIndex, instanceId) {
  const pending = game.pendingHeroFromHandPlay
  if (!pending) {
    return { game, diceRoll: null, error: 'No hero-from-hand play pending.' }
  }
  if (pending.sourcePlayerIndex !== playerIndex) {
    return { game, diceRoll: null, error: 'Only the source player may choose.' }
  }

  const player = game.players[playerIndex]
  if (!player) {
    return { game, diceRoll: null, error: 'Invalid player.' }
  }

  const handIndex = player.hand.findIndex((c) => c.instanceId === instanceId)
  if (handIndex === -1) {
    return { game, diceRoll: null, error: 'Card not in hand.' }
  }
  const card = player.hand[handIndex]
  if (card.type !== CARD_TYPES.HERO) {
    return { game, diceRoll: null, error: 'You must choose a Hero card.' }
  }

  const emptyIndex = findFirstEmptyPartyIndex(player.partySlots)
  if (emptyIndex === -1) {
    return { game, diceRoll: null, error: 'No empty party slot.' }
  }

  const hand = player.hand.filter((_, idx) => idx !== handIndex)
  const players = game.players.map((p, idx) =>
    idx === playerIndex ? { ...p, hand } : p,
  )

  const cleared = {
    ...game,
    players,
    pendingHeroFromHandPlay: null,
  }

  /** @type {StagedPlay} */
  const staged = {
    card: withFaceUp(card),
    attackerIndex: playerIndex,
    cardType: CARD_TYPES.HERO,
  }

  return resolveStagedPlay(cleared, staged)
}

/**
 * Mellow Dee: source player chose to play the drawn hero immediately.
 * Pulls it from hand, places it in their first empty party slot, and starts
 * that hero's normal effect chain (roll/target/qi bear selection/etc).
 * Does NOT cost AP and does NOT open a challenge window — it's a bonus play.
 *
 * @param {GameState} game
 */
export function confirmHeroPlayChoice(game) {
  const pending = game.pendingHeroPlayChoice
  if (!pending) {
    return { game, diceRoll: null, error: 'No hero play choice pending.' }
  }

  const player = game.players[pending.sourcePlayerIndex]
  if (!player) {
    return { game, diceRoll: null, error: 'Invalid player.' }
  }

  const handIndex = player.hand.findIndex(
    (c) => c.instanceId === pending.heroCard.instanceId,
  )
  if (handIndex === -1) {
    return { game, diceRoll: null, error: 'Drawn hero is no longer in hand.' }
  }

  const emptyIndex = findFirstEmptyPartyIndex(player.partySlots)
  if (emptyIndex === -1) {
    return { game, diceRoll: null, error: 'No empty party slot.' }
  }

  const card = player.hand[handIndex]
  const hand = player.hand.filter((_, idx) => idx !== handIndex)
  const players = game.players.map((p, idx) =>
    idx === pending.sourcePlayerIndex ? { ...p, hand } : p,
  )

  const cleared = {
    ...game,
    players,
    pendingHeroPlayChoice: null,
  }

  /** @type {StagedPlay} */
  const staged = {
    card: withFaceUp(card),
    attackerIndex: pending.sourcePlayerIndex,
    cardType: CARD_TYPES.HERO,
  }

  return resolveStagedPlay(cleared, staged)
}

/**
 * Mellow Dee: source player declined to play the drawn hero immediately.
 * The card stays in their hand and the prompt closes.
 *
 * @param {GameState} game
 */
export function declineHeroPlayChoice(game) {
  if (!game.pendingHeroPlayChoice) {
    return { game, error: 'No hero play choice pending.' }
  }
  return { game: { ...game, pendingHeroPlayChoice: null } }
}
