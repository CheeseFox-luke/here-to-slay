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
 * @property {HeroClass} [originalClass]
 * @property {HeroClass} [targetClass]
 * @property {boolean} [isLarge]
 * @property {number} [rollRequirement]
 * @property {import('./data/modifierEffects.js').ModifierEffect} [modifierEffect]
 * @property {boolean} [targeted]
 * @property {boolean} [heroTargeted]
 * @property {string} [effectId]
 * @property {string} [effect]
 * @property {boolean} [antiSteal] - hero-level: this hero cannot be selected as a STEAL target.
 * @property {boolean} [antiDestroy] - hero-level: this hero cannot be selected as a DESTROY target.
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
 * @property {number} [targetPlayerIndex]
 */

/**
 * @typedef {Object} PendingChallengeWindow
 * @property {StagedPlay} stagedPlay
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
 * @property {number} [effectSourcePlayerIndex]
 * @property {number} [effectTargetPlayerIndex]
 * @property {string} [heroName]
 * @property {number} [qiBearCount]
 * @property {string} [sourceHeroInstanceId] - instanceId of the hero whose skill
 *   triggered this roll (e.g. Tipsy Tootie itself, needed for swap).
 * @property {string} [rollingHeroInstanceId] - instanceId of the hero rolling
 *   (always set for hero rolls; used to check passive cursed-item effects on finalize).
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
 * @property {'standard' | 'opponentEach' | 'opponentEachPile'} [kind] -
 *   `opponentEach` (Beary Wise): staged discards; `opponentEachPile` (Tough Teddy):
 *   normal discard to pile per qualifying opponent.
 * @property {number[]} [opponentDiscardQueue] - remaining opponents who must discard
 * @property {CardInstance[]} [stagedCards] - cards held out
 *   of the discard pile during Beary Wise
 * @property {string} [afterEffect] - effect to chain after discard completes (e.g. 'stealHero')
 */

/**
 * Greedy Cheeks: each other player gives you 1 card of their choice.
 * Resolved one player at a time by clicking a card in that player's hand.
 *
 * @typedef {Object} PendingGive
 * @property {number} targetPlayerIndex - who receives the cards
 * @property {number[]} giverQueue - remaining players who must give a card
 * @property {string} sourceLabel - label shown in the UI (e.g. "Greedy Cheeks")
 */

/**
 * Fury Knuckle / Bear Claw: source player picks a specific card from the
 * target's face-down hand. If the pulled card matches `bonusTriggerType`,
 * another pick opens (with `bonusTriggerType: null` — no further bonus).
 *
 * @typedef {Object} PendingCardPull
 * @property {number} sourcePlayerIndex
 * @property {number} targetPlayerIndex
 * @property {import('./data/cardUtils.js').CardType | null} bonusTriggerType
 * @property {string} sourceLabel
 * @property {boolean} [allowImmediateHeroPlay] - if true and the pulled card is
 *   a Hero, source player may play it immediately (using pendingHeroPlayChoice)
 * @property {boolean} [isBonusPull]
 */

/**
 * Beary Wise: source player picks one card from the staged pool.
 *
 * @typedef {Object} PendingStagedCardPick
 * @property {number} sourcePlayerIndex
 * @property {string} sourceLabel
 * @property {CardInstance[]} stagedCards
 * @property {'discardPile'} [source] - if set, remainder cards go back to discard pile instead of being discarded
 */

/**
 * Mellow Dee: player drew a Hero card and may choose to play it immediately.
 * If accepted, the hero is added to their party and its skill triggers.
 * If declined, the card stays in hand.
 *
 * @typedef {Object} PendingHeroPlayChoice
 * @property {number} sourcePlayerIndex
 * @property {CardInstance} heroCard - the drawn Hero card (already in hand)
 * @property {string} sourceLabel
 */

/**
 * Fuzzy Cheeks: after drawing 1, source player must play a Hero card from their hand
 * (if possible). The hero is played immediately without AP cost and without opening
 * a challenge window, and its ability flow begins.
 *
 * @typedef {Object} PendingHeroFromHandPlay
 * @property {number} sourcePlayerIndex
 * @property {string} sourceLabel
 */

/**
 * @typedef {Object} PendingEffectTargetSelection
 * @property {number} sourcePlayerIndex
 * @property {string} effectId
 * @property {string} heroName
 * @property {number} rollRequirement
 * @property {string} [sourceHeroInstanceId]
 */

/**
 * Pre-roll selection state for hero-targeted effects (e.g. Bad Axe):
 * player picks a specific hero before the dice are rolled.
 *
 * @typedef {Object} PendingEffectHeroTargetSelection
 * @property {number} sourcePlayerIndex
 * @property {string} effectId
 * @property {string} heroName
 * @property {number} rollRequirement
 * @property {'own' | 'opponents' | 'any'} scope - which parties contain valid heroes
 * @property {string} [sourceHeroInstanceId] - instanceId of the hero whose skill
 *   triggered this selection (e.g. Tipsy Tootie itself, needed for swap).
 */

/**
 * Pre-roll selection state for Qi Bear: player chooses how many cards to discard
 * (0–maxCount) and picks that many heroes to destroy, before the dice are rolled.
 *
 * @typedef {Object} PendingQiBearSelection
 * @property {number} sourcePlayerIndex
 * @property {string} effectId
 * @property {string} heroName
 * @property {number} rollRequirement
 * @property {number} count - currently chosen discard/destroy count (0..maxCount)
 * @property {number} maxCount - min(3, hand size at trigger time)
 * @property {string[]} heroTargets - instanceIds of heroes chosen to destroy
 * @property {string} [sourceHeroInstanceId]
 */

/**
 * Prompt: the source player must click a hero in some other party (or their own).
 * Used by destroy / steal / sacrifice card effects.
 *
 * @typedef {Object} PendingHeroSelection
 * @property {number} sourcePlayerIndex - the player making the choice
 * @property {'own' | 'opponents' | 'any' | 'specific'} scope - which parties are valid;
 *   'specific' restricts to a single player identified by `targetPlayerIndex`
 * @property {number} [targetPlayerIndex] - required when scope === 'specific'
 * @property {'destroy' | 'steal' | 'sacrifice' | 'swapSource' | 'swapTarget'} action - which atomic effect to run
 * @property {string} sourceLabel - label shown in the UI (e.g. card name)
 * @property {PendingDiscard | null} [afterPendingDiscard] - continuation to
 *   restore as `pendingDiscard` once the selection completes (Qi Bear chain).
 * @property {string} [swapSourceHeroInstanceId] - for swapTarget: instanceId of the first-picked hero
 * @property {number} [swapSourcePlayerIndex] - for swapTarget: party owner of first-picked hero
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
 * @property {PendingEffectHeroTargetSelection | null} pendingEffectHeroTargetSelection
 * @property {PendingCardPull | null} pendingCardPull
 * @property {PendingDiscard | null} pendingDiscard
 * @property {PendingGive | null} pendingGive
 * @property {PendingStagedCardPick | null} pendingStagedCardPick
 * @property {PendingHeroSelection | null} pendingHeroSelection
 * @property {PendingQiBearSelection | null} pendingQiBearSelection
 * @property {PendingHeroPlayChoice | null} pendingHeroPlayChoice
 * @property {PendingHeroFromHandPlay | null} pendingHeroFromHandPlay
 * @property {string[]} pendingDestroyTargets - instanceIds of heroes currently marked for
 *   destruction by an in-progress effect; cleared when the effect resolves or the turn ends
 * @property {boolean} [antiChallenge] - while true, no player may play a Challenge card.
 * @property {boolean} [antiModifier] - while true, no player may play a Modifier card.
 * @property {number} [globalRollBonus] - flat bonus added to every roll until end of turn.
 * @property {PendingItemSelection | null} [pendingItemSelection]
 * @property {number | null} [partyAntiSteal] - playerIndex whose entire party cannot be stolen; cleared at start of that player's next turn.
 * @property {number | null} [partyAntiDestroy] - playerIndex whose entire party cannot be destroyed; cleared at start of that player's next turn.
 */

/**
 * @typedef {Object} PendingItemSelection
 * @property {number} sourcePlayerIndex - player who triggered the effect
 * @property {string} sourceLabel
 * @property {string} [kind] - 'holyCurselifter' restricts selection to own cursed items
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
  antiChallenge: false,
  antiModifier: false,
  challengePassedBy: [],
  modifierPassedBy: [],
  challengeStartedAt: null,
  modifierStartedAt: null,
  partyAntiSteal: null,
  partyAntiDestroy: null,
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
    antiChallenge: false,
    antiModifier: false,
    challengePassedBy: [],
    modifierPassedBy: [],
    challengeStartedAt: null,
    modifierStartedAt: null,
  }
}
