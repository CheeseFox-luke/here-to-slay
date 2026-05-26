import { shuffleDeck } from './data/cardUtils.js'
import {
  createPlayerDrawDeck,
  createMonsterDeck,
  leaderCards,
} from './data/deck.js'

export const INITIAL_HAND_SIZE = 5
export const INITIAL_ACTION_POINTS = 3
export const ACTIVE_MONSTER_LIMIT = 3
export const MONSTERS_TO_REVEAL = 3
export const PARTY_SLOT_COUNT = 10
export const PARTY_GRID_COLS = 5
export const PARTY_GRID_ROWS = 2
export const SLAIN_MONSTER_SLOT_COUNT = 3

/** @returns {(PartySlot | null)[]} */
export function createEmptyPartySlots() {
  return Array.from({ length: PARTY_SLOT_COUNT }, () => null)
}

/**
 * @param {(PartySlot | null)[]} partySlots
 * @returns {number}
 */
export function findFirstEmptyPartyIndex(partySlots) {
  return partySlots.findIndex((slot) => slot === null)
}

/**
 * @param {(PartySlot | null)[]} partySlots
 * @returns {number}
 */
export function findLastFilledPartyIndex(partySlots) {
  for (let i = partySlots.length - 1; i >= 0; i--) {
    if (partySlots[i]) {
      return i
    }
  }
  return -1
}

/**
 * @param {(PartySlot | null)[]} partySlots
 */
export function partyHasHero(partySlots) {
  return partySlots.some((slot) => slot !== null)
}

/**
 * @typedef {import('./data/cardUtils.js').CardType} CardType
 * @typedef {import('./data/cardUtils.js').HeroClass} HeroClass
 */

/**
 * @typedef {Object} CardInstance
 * @property {string} id
 * @property {string} name
 * @property {CardType} type
 * @property {string} imageUrl
 * @property {string} [backImageUrl]
 * @property {string} instanceId
 * @property {boolean} faceUp
 * @property {HeroClass} [class]
 * @property {boolean} [isLarge]
 * @property {number} [rollRequirement]
 * @property {import('./data/modifierEffects.js').ModifierEffect} [modifierEffect]
 * @property {boolean} [targeted]
 * @property {string} [effectId]
 * @property {string} [effect]
 */

/**
 * @typedef {'hero' | 'monster' | 'challenge'} RollType
 */

/**
 * @typedef {Object} ChallengeRollSide
 * @property {number} d1
 * @property {number} d2
 * @property {number} baseSum
 * @property {number} currentSum
 * @property {string[]} modifierLabels
 */

/**
 * @typedef {Object} StagedPlay
 * @property {CardInstance} card
 * @property {number} attackerIndex
 * @property {import('./data/cardUtils.js').CardType} cardType
 * @property {number} [itemSlotIndex]
 */

/**
 * @typedef {Object} PendingChallengeWindow
 * @property {StagedPlay} stagedPlay
 * @property {number} defenderIndex
 */

/**
 * @typedef {Object} PendingRoll
 * @property {RollType} rollType
 * @property {number} d1
 * @property {number} d2
 * @property {number} baseSum
 * @property {number} currentSum
 * @property {number} rollingPlayerIndex
 * @property {string[]} modifierLabels
 * @property {string} targetLabel
 * @property {number} [requirement]
 * @property {number} [failAtOrBelow]
 * @property {number} [successAtOrAbove]
 * @property {string} [targetMonsterInstanceId]
 * @property {boolean} showGreen
 * @property {boolean} showRed
 * @property {boolean} showGray
 * @property {boolean} showFail
 * @property {string} [lastModifierLabel]
 * @property {number} [attackerIndex]
 * @property {number} [challengerIndex]
 * @property {ChallengeRollSide} [attackerRoll]
 * @property {ChallengeRollSide} [challengerRoll]
 * @property {StagedPlay} [stagedPlay]
 * @property {boolean} [challengeResolved]
 * @property {boolean} [challengeSuccess]
 * @property {string} [effectId]
 * @property {boolean} [effectTargeted]
 * @property {number} [effectSourcePlayerIndex]
 * @property {number} [effectTargetPlayerIndex]
 * @property {'pre-target' | 'post-target'} [effectPhase]
 * @property {string} [heroName]
 */

/**
 * @typedef {Object} PendingDiscard
 * @property {number} playerIndex - whose hand gets discarded from
 * @property {number} sourcePlayerIndex - who initiated the effect
 * @property {number} count - how many more cards still need discarding
 * @property {string} sourceLabel - label shown in the UI (e.g. "Heavy Bear")
 * @property {boolean} [destroyHeroPerDiscard] - Qi Bear chain: after each
 *   discard, open a `pendingHeroSelection` to destroy one hero before resuming
 *   the next discard.
 * @property {boolean} [optional] - if true, the player may Pass to stop
 *   discarding early (no further destroys for undiscarded cards).
 */

/**
 * @typedef {Object} PendingEffectTargetSelection
 * @property {number} sourcePlayerIndex
 * @property {string} effectId
 * @property {string} heroName
 * @property {PendingRoll} resumeRoll - pendingRoll to restore once a target is chosen
 */

/**
 * Prompt: the source player must click a hero in some other party (or their own).
 * Used by destroy / steal / sacrifice card effects.
 *
 * @typedef {Object} PendingHeroSelection
 * @property {number} sourcePlayerIndex - the player making the choice
 * @property {'own' | 'opponents' | 'any'} scope - which parties are valid
 * @property {'destroy' | 'steal' | 'sacrifice'} action - which atomic effect to run
 * @property {string} sourceLabel - label shown in the UI (e.g. card name)
 * @property {PendingDiscard | null} [afterPendingDiscard] - continuation to
 *   restore as `pendingDiscard` once the selection completes (Qi Bear chain).
 */

/**
 * @typedef {Object} PartySlot
 * @property {CardInstance} hero
 * @property {CardInstance[]} items
 * @property {boolean} skillUsedThisTurn
 */

/**
 * @typedef {Object} Player
 * @property {number} id
 * @property {string} name
 * @property {CardInstance} leader
 * @property {CardInstance[]} hand
 * @property {(PartySlot | null)[]} partySlots
 * @property {CardInstance[]} leaderItems
 * @property {CardInstance[]} slainMonsters
 */

/**
 * @typedef {Object} GameState
 * @property {Player[]} players
 * @property {number} currentPlayerIndex
 * @property {number} actionPoints
 * @property {CardInstance[]} mainDeck
 * @property {CardInstance[]} discardPile
 * @property {CardInstance[]} monsterDeck
 * @property {CardInstance[]} activeMonsters
 * @property {PendingRoll | null} pendingRoll
 * @property {PendingChallengeWindow | null} pendingChallenge
 * @property {PendingEffectTargetSelection | null} pendingEffectTargetSelection
 * @property {PendingDiscard | null} pendingDiscard
 * @property {PendingHeroSelection | null} pendingHeroSelection
 */

/**
 * @typedef {Object} DiceRollFeedback
 * @property {number} d1
 * @property {number} d2
 * @property {number} sum
 * @property {number} requirement
 * @property {boolean} showGreen
 * @property {boolean} showRed
 */

/** @param {Omit<CardInstance, 'faceUp'> & { faceUp?: boolean }} card */
export function withFaceUp(card, faceUp = true) {
  return { ...card, faceUp }
}

/** @param {Omit<CardInstance, 'faceUp'> & { faceUp?: boolean }} card */
export function withFaceDown(card) {
  return withFaceUp(card, false)
}

/**
 * @param {Omit<CardInstance, 'faceUp'>[]} deck
 * @param {number} count
 */
function drawFromDeck(deck, count) {
  const drawn = deck.slice(0, count)
  const remaining = deck.slice(count)
  return { drawn, remaining }
}

/** 初始游戏状态模板（需经 initGame 补全） */
export const initialGameState = {
  players: [],
  currentPlayerIndex: 0,
  actionPoints: INITIAL_ACTION_POINTS,
  mainDeck: [],
  discardPile: [],
  monsterDeck: [],
  activeMonsters: [],
  pendingRoll: null,
  pendingChallenge: null,
  pendingEffectTargetSelection: null,
  pendingDiscard: null,
  pendingHeroSelection: null,
}

export const RESTOCK_HAND_AP_COST = 3
export const RESTOCK_HAND_SIZE = 5
export const MODIFIER_WINDOW_MS = 10000
export const CHALLENGE_WINDOW_MS = 10000
export const ATTACK_MONSTER_AP_COST = 2
export const DRAW_CARD_AP_COST = 1

/**
 * @param {number} playerCount
 * @returns {GameState}
 */
export function initGame(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > 6) {
    throw new Error('playerCount must be an integer between 1 and 6')
  }

  let mainDeck = createPlayerDrawDeck().map((card) => withFaceDown(card))
  let monsterDeck = createMonsterDeck().map((card) => withFaceDown(card))

  const shuffledLeaders = shuffleDeck([...leaderCards])
  /** @type {Player[]} */
  const players = Array.from({ length: playerCount }, (_, index) => {
    const leader = withFaceUp(shuffledLeaders[index])

    const { drawn, remaining } = drawFromDeck(mainDeck, INITIAL_HAND_SIZE)
    mainDeck = remaining
    const hand = drawn.map((card) => withFaceUp(card))

    return {
      id: index,
      name: `Player ${index + 1}`,
      leader,
      hand,
      partySlots: createEmptyPartySlots(),
      leaderItems: [],
      slainMonsters: [],
    }
  })

  const revealed = monsterDeck
    .slice(0, MONSTERS_TO_REVEAL)
    .map((card) => withFaceUp(card))
  const remainingMonsters = monsterDeck.slice(MONSTERS_TO_REVEAL)

  return {
    players,
    currentPlayerIndex: 0,
    actionPoints: INITIAL_ACTION_POINTS,
    mainDeck,
    discardPile: [],
    monsterDeck: remainingMonsters,
    activeMonsters: revealed,
    pendingRoll: null,
    pendingChallenge: null,
    pendingEffectTargetSelection: null,
    pendingDiscard: null,
    pendingHeroSelection: null,
  }
}
