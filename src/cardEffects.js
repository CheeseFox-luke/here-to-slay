import { CARD_TYPES, HERO_CLASSES } from './data/cardUtils.js'
import { applyPartyAntiDestroy, applyPartyAntiSteal, destroy, destroyAndTakeItems, draw, give, pull, sacrifice, steal, swapHands, swapHero } from './effects.js'
import { withFaceUp } from './gameState.js'

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
 * Lucky Bucky: pull 1 card from another player's hand.
 * If the pulled card is a Hero, you may play it immediately.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, targetPlayerIndex: number, sourceLabel?: string }} params
 */
export function luckyBuckyEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Lucky Bucky' }) {
  const target = game.players[targetPlayerIndex]
  if (!target) return { game, error: 'Invalid target.' }
  if (target.hand.length === 0) return { game }
  return {
    game: {
      ...game,
      pendingCardPull: {
        sourcePlayerIndex,
        targetPlayerIndex,
        bonusTriggerType: null,
        sourceLabel,
        allowImmediateHeroPlay: true,
      },
    },
  }
}

/**
 * Bad Axe: destroy the pre-selected hero (chosen before the dice roll).
 * `heroTargets[0]` is the instanceId locked in during `pendingEffectHeroTargetSelection`.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, heroTargets?: string[] }} params
 */
export function badAxeEffect(game, { sourcePlayerIndex, heroTargets = [] }) {
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

/**
 * Peanut: draw 2 cards.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number }} params
 */
export function peanutEffect(game, { sourcePlayerIndex }) {
  return draw(game, { playerIndex: sourcePlayerIndex, count: 2 })
}

/**
 * Tipsy Tootie: choose an opponent's hero (pre-roll), then swap Tipsy Tootie
 * with that hero between the two parties. Items follow each hero.
 *
 * `heroTargets[0]` is the chosen opponent hero's instanceId (locked in during
 * `pendingEffectHeroTargetSelection`). `sourceHeroInstanceId` is Tipsy Tootie's
 * own instanceId in the source player's party.
 *
 * @param {GameState} game
 * @param {{
 *   sourcePlayerIndex: number,
 *   sourceHeroInstanceId?: string,
 *   heroTargets?: string[],
 * }} params
 */
export function tipsyTootieEffect(game, { sourcePlayerIndex, sourceHeroInstanceId, heroTargets = [] }) {
  const targetHeroId = heroTargets[0]
  if (!targetHeroId || !sourceHeroInstanceId) {
    return { game }
  }

  const targetOwnerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === targetHeroId),
  )
  if (targetOwnerIndex === -1) {
    return { game }
  }

  return swapHero(game, {
    playerAIndex: sourcePlayerIndex,
    heroAInstanceId: sourceHeroInstanceId,
    playerBIndex: targetOwnerIndex,
    heroBInstanceId: targetHeroId,
  })
}

/**
 * Mellow Dee: draw 1 card. If it's a Hero card and the player has an empty
 * party slot, prompt them to play it immediately (which will also trigger
 * the drawn hero's skill). Otherwise the card just stays in hand.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, sourceLabel?: string }} params
 */
export function mellowDeeEffect(game, { sourcePlayerIndex, sourceLabel = 'Mellow Dee' }) {
  const { game: afterDraw, drawn = [] } = draw(game, {
    playerIndex: sourcePlayerIndex,
    count: 1,
  })

  const drawnCard = drawn[0]
  if (!drawnCard || drawnCard.type !== CARD_TYPES.HERO) {
    return { game: afterDraw }
  }

  const player = afterDraw.players[sourcePlayerIndex]
  const hasEmptySlot = player?.partySlots.some((s) => s === null)
  if (!hasEmptySlot) {
    return { game: afterDraw }
  }

  return {
    game: {
      ...afterDraw,
      pendingHeroPlayChoice: {
        sourcePlayerIndex,
        heroCard: drawnCard,
        sourceLabel,
      },
    },
  }
}

/**
 * Greedy Cheeks: each other player must give you 1 card from their hand
 * (the giving player chooses which card).
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, sourceLabel?: string }} params
 */
export function greedyCheeksEffect(game, { sourcePlayerIndex, sourceLabel = 'Greedy Cheeks' }) {
  // Build queue of other players who currently have cards
  const giverQueue = game.players
    .map((_, index) => index)
    .filter((index) => index !== sourcePlayerIndex && game.players[index].hand.length > 0)

  if (giverQueue.length === 0) {
    return { game }
  }

  // NOTE: The actual transfer is handled by `giveForPendingGive` in gameActions.
  return {
    game: {
      ...game,
      pendingGive: {
        targetPlayerIndex: sourcePlayerIndex,
        giverQueue,
        sourceLabel,
      },
    },
  }
}

/**
 * Dodgy Dealer: trade hands with another player.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, targetPlayerIndex: number, sourceLabel?: string }} params
 */
export function dodgyDealerEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Dodgy Dealer' }) {
  if (targetPlayerIndex === undefined || targetPlayerIndex === null) {
    return { game, error: `${sourceLabel}: targetPlayerIndex is required.` }
  }
  return swapHands(game, { playerAIndex: sourcePlayerIndex, playerBIndex: targetPlayerIndex })
}

/**
 * Fuzzy Cheeks: draw 1 card, then play a Hero card from your hand and trigger that hero's ability.
 * The hero is played immediately (no AP cost) and does not open a challenge window.
 *
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number, sourceLabel?: string }} params
 */
export function fuzzyCheeksEffect(game, { sourcePlayerIndex, sourceLabel = 'Fuzzy Cheeks' }) {
  const { game: afterDraw } = draw(game, { playerIndex: sourcePlayerIndex, count: 1 })
  const player = afterDraw.players[sourcePlayerIndex]
  if (!player) return { game: afterDraw, error: 'Invalid player.' }

  const hasEmptySlot = player.partySlots.some((s) => s === null)
  if (!hasEmptySlot) return { game: afterDraw }

  const hasHeroInHand = player.hand.some((c) => c.type === CARD_TYPES.HERO)
  if (!hasHeroInHand) return { game: afterDraw }

  return {
    game: {
      ...afterDraw,
      pendingHeroFromHandPlay: {
        sourcePlayerIndex,
        sourceLabel,
      },
    },
  }
}

/**
 * Calming Voice (043): protect your entire party from steal until your next turn.
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number }} params
 */
export function calmingVoiceAntiStealEffect(game, { sourcePlayerIndex }) {
  return applyPartyAntiSteal(game, { playerIndex: sourcePlayerIndex })
}

/**
 * Mighty Blade (045): protect your entire party from destroy until your next turn.
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number }} params
 */
export function calmingVoiceAntiDestroyEffect(game, { sourcePlayerIndex }) {
  return applyPartyAntiDestroy(game, { playerIndex: sourcePlayerIndex })
}

/**
 * Iron Resolve (047): prevent challenges for the rest of your turn.
 * @param {GameState} game
 */
export function ironResolveEffect(game) {
  return { game: { ...game, antiChallenge: true } }
}

/**
 * Wise Shield (044): +3 to all rolls until end of turn.
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number }} params
 */
export function wiseShieldEffect(game) {
  return { game: { ...game, globalRollBonus: (game.globalRollBonus ?? 0) + 3 } }
}

/**
 * Vibrant Glow (049): +5 to all rolls until end of turn.
 * @param {GameState} game
 */
export function vibrantGlowEffect(game) {
  return { game: { ...game, globalRollBonus: (game.globalRollBonus ?? 0) + 5 } }
}

/**
 * Guiding Light (050): search the discard pile for a Hero card and add it to hand.
 * Identical logic to Call to the Fallen; reused here as a hero effect.
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number }} params
 */
export function guidingLightEffect(game, { sourcePlayerIndex, sourceLabel = 'Guiding Light' }) {
  const heroesInDiscard = game.discardPile.filter((c) => c.type === CARD_TYPES.HERO)
  if (heroesInDiscard.length === 0) return { game }
  const discardWithoutHeroes = game.discardPile.filter((c) => c.type !== CARD_TYPES.HERO)
  if (heroesInDiscard.length === 1) {
    const updatedPlayers = game.players.map((p, i) =>
      i === sourcePlayerIndex ? { ...p, hand: [...p.hand, { ...heroesInDiscard[0], faceUp: true }] } : p,
    )
    return { game: { ...game, players: updatedPlayers, discardPile: discardWithoutHeroes } }
  }
  return {
    game: {
      ...game,
      discardPile: discardWithoutHeroes,
      pendingStagedCardPick: {
        sourcePlayerIndex,
        sourceLabel,
        stagedCards: heroesInDiscard.map((c) => ({ ...c, faceUp: true })),
        source: 'discardPile',
      },
    },
  }
}

/**
 * Radiant Horn (046): search the discard pile for a Modifier card and add it to hand.
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number }} params
 */
export function radiantHornEffect(game, { sourcePlayerIndex, sourceLabel = 'Radiant Horn' }) {
  const modifiersInDiscard = game.discardPile.filter((c) => c.type === CARD_TYPES.MODIFIER)
  if (modifiersInDiscard.length === 0) return { game }
  const discardWithoutModifiers = game.discardPile.filter((c) => c.type !== CARD_TYPES.MODIFIER)
  if (modifiersInDiscard.length === 1) {
    const updatedPlayers = game.players.map((p, i) =>
      i === sourcePlayerIndex ? { ...p, hand: [...p.hand, { ...modifiersInDiscard[0], faceUp: true }] } : p,
    )
    return { game: { ...game, players: updatedPlayers, discardPile: discardWithoutModifiers } }
  }
  return {
    game: {
      ...game,
      discardPile: discardWithoutModifiers,
      pendingStagedCardPick: {
        sourcePlayerIndex,
        sourceLabel,
        stagedCards: modifiersInDiscard.map((c) => ({ ...c, faceUp: true })),
        source: 'discardPile',
      },
    },
  }
}

/**
 * Holy Curselifter (048): open a selection for the player to pick a cursed item
 * from their own party to return to their hand. Pass (no choose) is allowed.
 * @param {GameState} game
 * @param {{ sourcePlayerIndex: number }} params
 */
export function holyCurselifterEffect(game, { sourcePlayerIndex, sourceLabel = 'Holy Curselifter' }) {
  const hasCursedItem = game.players[sourcePlayerIndex]?.partySlots.some(
    (s) => s !== null && s.items.some((it) => it.type === CARD_TYPES.CURSED_ITEM),
  )
  if (!hasCursedItem) return { game }
  return {
    game: {
      ...game,
      pendingItemSelection: { sourcePlayerIndex, sourceLabel, kind: 'holyCurselifter' },
    },
  }
}

// ─── Ranger Effects ──────────────────────────────────────────────────────────

/**
 * Sharp Fox (051): look at another player's hand face-up and pull one card.
 */
export function sharpFoxEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Sharp Fox' }) {
  const target = game.players[targetPlayerIndex]
  if (!target) return { game, error: 'Invalid target.' }
  if (target.hand.length === 0) return { game }
  return {
    game: {
      ...game,
      pendingCardPull: {
        sourcePlayerIndex,
        targetPlayerIndex,
        bonusTriggerType: null,
        sourceLabel,
        showFaceUp: true,
      },
    },
  }
}

/**
 * Wildshot (052): draw 3 cards, then discard 1.
 */
export function wildshotEffect(game, { sourcePlayerIndex, sourceLabel = 'Wildshot' }) {
  const { game: afterDraw } = draw(game, { playerIndex: sourcePlayerIndex, count: 3 })
  const count = Math.min(1, afterDraw.players[sourcePlayerIndex].hand.length)
  if (count === 0) return { game: afterDraw }
  return {
    game: {
      ...afterDraw,
      pendingDiscard: {
        playerIndex: sourcePlayerIndex,
        sourcePlayerIndex,
        count,
        sourceLabel,
      },
    },
  }
}

/**
 * Wily Red (053): draw cards until you have 7 in hand.
 */
export function wilyRedEffect(game, { sourcePlayerIndex }) {
  const current = game.players[sourcePlayerIndex].hand.length
  const needed = Math.max(0, 7 - current)
  if (needed === 0) return { game }
  return draw(game, { playerIndex: sourcePlayerIndex, count: needed })
}

/**
 * Lookie Rookie (054): search the discard pile for an item (or cursed item) and add to hand.
 */
export function lookieRookieEffect(game, { sourcePlayerIndex, sourceLabel = 'Lookie Rookie' }) {
  const itemsInDiscard = game.discardPile.filter(
    (c) => c.type === CARD_TYPES.ITEM || c.type === CARD_TYPES.CURSED_ITEM,
  )
  if (itemsInDiscard.length === 0) return { game }
  const discardWithoutItems = game.discardPile.filter(
    (c) => c.type !== CARD_TYPES.ITEM && c.type !== CARD_TYPES.CURSED_ITEM,
  )
  if (itemsInDiscard.length === 1) {
    const updatedPlayers = game.players.map((p, i) =>
      i === sourcePlayerIndex ? { ...p, hand: [...p.hand, { ...itemsInDiscard[0], faceUp: true }] } : p,
    )
    return { game: { ...game, players: updatedPlayers, discardPile: discardWithoutItems } }
  }
  return {
    game: {
      ...game,
      discardPile: discardWithoutItems,
      pendingStagedCardPick: {
        sourcePlayerIndex,
        sourceLabel,
        stagedCards: itemsInDiscard.map((c) => ({ ...c, faceUp: true })),
        source: 'discardPile',
      },
    },
  }
}

/**
 * Bullseye (055): look at the top 3 cards of the deck.
 * Add one to hand, return the other two in any order.
 */
export function bullseyeEffect(game, { sourcePlayerIndex, sourceLabel = 'Bullseye' }) {
  const topCards = game.mainDeck.slice(0, 3)
  if (topCards.length === 0) return { game }
  const remainingDeck = game.mainDeck.slice(topCards.length)
  return {
    game: {
      ...game,
      mainDeck: remainingDeck,
      pendingTopDeckPick: {
        sourcePlayerIndex,
        sourceLabel,
        cards: topCards.map((c) => ({ ...c, faceUp: true })),
        phase: 'pick',
      },
    },
  }
}

/**
 * Quick Draw (056): draw 2 cards.
 * If at least one is an item/cursed item, may play one immediately.
 */
export function quickDrawEffect(game, { sourcePlayerIndex, sourceLabel = 'Quick Draw' }) {
  const { game: afterDraw, drawn } = draw(game, { playerIndex: sourcePlayerIndex, count: 2 })
  const drawnItems = drawn.filter(
    (c) => c.type === CARD_TYPES.ITEM || c.type === CARD_TYPES.CURSED_ITEM,
  )
  if (drawnItems.length === 0) return { game: afterDraw }
  return {
    game: {
      ...afterDraw,
      pendingBonusItemPlay: {
        sourcePlayerIndex,
        sourceLabel,
        eligibleInstanceIds: drawnItems.map((c) => c.instanceId),
        drawAfter: 0,
      },
    },
  }
}

/**
 * Hook (057): play an item from hand immediately, then draw 1.
 * If no item in hand, just draw 1.
 */
export function hookEffect(game, { sourcePlayerIndex, sourceLabel = 'Hook' }) {
  const player = game.players[sourcePlayerIndex]
  const hasItem = player.hand.some(
    (c) => c.type === CARD_TYPES.ITEM || c.type === CARD_TYPES.CURSED_ITEM,
  )
  if (!hasItem) {
    return draw(game, { playerIndex: sourcePlayerIndex, count: 1 })
  }
  return {
    game: {
      ...game,
      pendingBonusItemPlay: {
        sourcePlayerIndex,
        sourceLabel,
        eligibleInstanceIds: null,
        drawAfter: 1,
      },
    },
  }
}

/**
 * Serious Grey (058): destroy a hero card, then draw 1.
 */
export function seriousGreyEffect(game, { sourcePlayerIndex, heroTargets = [], sourceLabel = 'Serious Grey' }) {
  const heroInstanceId = heroTargets[0]
  if (!heroInstanceId) return { game }
  const ownerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
  )
  if (ownerIndex === -1) return { game }

  let afterDestroy
  if (ownerIndex === sourcePlayerIndex) {
    const result = sacrifice(game, { playerIndex: ownerIndex, heroInstanceId })
    afterDestroy = result.game
  } else {
    const result = destroy(game, { sourcePlayerIndex, targetPlayerIndex: ownerIndex, heroInstanceId })
    afterDestroy = result.game
  }
  return draw(afterDestroy, { playerIndex: sourcePlayerIndex, count: 1 })
}

// ─── Thief Effects ───────────────────────────────────────────────────────────

/**
 * Smooth Minimeow (059): pull 1 random card from each other player who has a
 * Thief-class hero in their party.
 */
export function smoothMinimeowEffect(game, { sourcePlayerIndex }) {
  let g = game
  for (let i = 0; i < game.players.length; i++) {
    if (i === sourcePlayerIndex) continue
    const player = g.players[i]
    const hasThief = player.partySlots.some(
      (s) => s !== null && s.hero.class === HERO_CLASSES.THIEF,
    )
    if (!hasThief || player.hand.length === 0) continue
    const card = player.hand[Math.floor(Math.random() * player.hand.length)]
    const { game: next, error } = pull(g, { sourcePlayerIndex, targetPlayerIndex: i, instanceId: card.instanceId })
    if (!error) g = next
  }
  return { game: g }
}

/**
 * Plundering Puma (060): pull 2 cards from another player's hand.
 * That player may then draw 1 card.
 */
export function plunderingPumaEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Plundering Puma' }) {
  const target = game.players[targetPlayerIndex]
  if (!target) return { game, error: 'Invalid target.' }
  if (target.hand.length === 0) return { game }
  return {
    game: {
      ...game,
      pendingCardPull: {
        sourcePlayerIndex,
        targetPlayerIndex,
        bonusTriggerType: null,
        sourceLabel,
        remainingPulls: 2,
        drawForTargetAfter: 1,
      },
    },
  }
}

/**
 * Shurikitty (061): destroy a hero. If that hero has an item equipped,
 * the item goes to your hand instead of the discard pile.
 */
export function shurikittyEffect(game, { sourcePlayerIndex, heroTargets = [] }) {
  const heroInstanceId = heroTargets[0]
  if (!heroInstanceId) return { game }
  const ownerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
  )
  if (ownerIndex === -1) return { game }
  if (ownerIndex === sourcePlayerIndex) return { game, error: 'Cannot target your own hero.' }
  return destroyAndTakeItems(game, { sourcePlayerIndex, targetPlayerIndex: ownerIndex, heroInstanceId })
}

/**
 * Meowzio (062): steal a hero, then pull 1 card from that player's hand.
 */
export function meowzioEffect(game, { sourcePlayerIndex, heroTargets = [], sourceLabel = 'Meowzio' }) {
  const heroInstanceId = heroTargets[0]
  if (!heroInstanceId) return { game }
  const ownerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
  )
  if (ownerIndex === -1) return { game }
  if (ownerIndex === sourcePlayerIndex) return { game, error: 'Cannot target your own hero.' }

  const { game: afterSteal, error } = steal(game, { sourcePlayerIndex, targetPlayerIndex: ownerIndex, heroInstanceId })
  if (error) return { game, error }

  if (afterSteal.players[ownerIndex].hand.length === 0) return { game: afterSteal }
  return {
    game: {
      ...afterSteal,
      pendingCardPull: {
        sourcePlayerIndex,
        targetPlayerIndex: ownerIndex,
        bonusTriggerType: null,
        sourceLabel,
      },
    },
  }
}

/**
 * Slippery Paws (063): pull 2 random cards from another player's hand, then
 * add 1 to your hand (the other goes to the discard pile).
 */
export function slipperyPawsEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Slippery Paws' }) {
  const target = game.players[targetPlayerIndex]
  if (!target) return { game, error: 'Invalid target.' }
  if (target.hand.length === 0) return { game }

  const count = Math.min(2, target.hand.length)
  const available = [...target.hand]
  const staged = []
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * available.length)
    staged.push(withFaceUp(available[idx]))
    available.splice(idx, 1)
  }

  const stagedIds = new Set(staged.map((c) => c.instanceId))
  const newTargetHand = target.hand.filter((c) => !stagedIds.has(c.instanceId))
  const players = game.players.map((p, i) =>
    i === targetPlayerIndex ? { ...p, hand: newTargetHand } : p,
  )
  const g = { ...game, players }

  if (staged.length === 1) {
    const sourcePlayers = g.players.map((p, i) =>
      i === sourcePlayerIndex ? { ...p, hand: [...p.hand, staged[0]] } : p,
    )
    return { game: { ...g, players: sourcePlayers } }
  }

  return {
    game: {
      ...g,
      pendingStagedCardPick: {
        sourcePlayerIndex,
        sourceLabel,
        stagedCards: staged,
      },
    },
  }
}

/**
 * Sly Pickings (064): pull 1 card from another player's hand.
 * If that card is an item, you may play it immediately.
 */
export function slyPickingsEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Sly Pickings' }) {
  const target = game.players[targetPlayerIndex]
  if (!target) return { game, error: 'Invalid target.' }
  if (target.hand.length === 0) return { game }
  return {
    game: {
      ...game,
      pendingCardPull: {
        sourcePlayerIndex,
        targetPlayerIndex,
        bonusTriggerType: null,
        sourceLabel,
        allowImmediateItemPlay: true,
      },
    },
  }
}

/**
 * Kit Napper (065): steal a hero.
 */
export function kitNapperEffect(game, { sourcePlayerIndex, heroTargets = [] }) {
  const heroInstanceId = heroTargets[0]
  if (!heroInstanceId) return { game }
  const ownerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
  )
  if (ownerIndex === -1) return { game }
  if (ownerIndex === sourcePlayerIndex) return { game, error: 'Cannot target your own hero.' }
  return steal(game, { sourcePlayerIndex, targetPlayerIndex: ownerIndex, heroInstanceId })
}

/**
 * Silent Shadow (066): look at another player's hand and choose 1 card to take.
 */
export function silentShadowEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Silent Shadow' }) {
  const target = game.players[targetPlayerIndex]
  if (!target) return { game, error: 'Invalid target.' }
  if (target.hand.length === 0) return { game }
  return {
    game: {
      ...game,
      pendingCardPull: {
        sourcePlayerIndex,
        targetPlayerIndex,
        bonusTriggerType: null,
        sourceLabel,
        showFaceUp: true,
      },
    },
  }
}

// ─── Wizard Effects ──────────────────────────────────────────────────────────

/**
 * Snowball (067): draw 1 card. If it is a Magic card, may play it immediately then draw 1 more.
 */
export function snowballEffect(game, { sourcePlayerIndex, sourceLabel = 'Snowball' }) {
  const { game: afterDraw, drawn = [] } = draw(game, { playerIndex: sourcePlayerIndex, count: 1 })
  const drawnMagic = drawn.find((c) => c.type === CARD_TYPES.MAGIC)
  if (!drawnMagic) return { game: afterDraw }
  return {
    game: {
      ...afterDraw,
      pendingMagicPlayChoice: {
        sourcePlayerIndex,
        magicCard: { ...drawnMagic, faceUp: true },
        sourceLabel,
        drawAfterPlay: 1,
      },
    },
  }
}

/**
 * Bun Bun (068): search the discard pile for a Magic card and add it to hand.
 */
export function bunBunEffect(game, { sourcePlayerIndex, sourceLabel = 'Bun Bun' }) {
  const magicInDiscard = game.discardPile.filter((c) => c.type === CARD_TYPES.MAGIC)
  if (magicInDiscard.length === 0) return { game }
  const discardWithoutMagic = game.discardPile.filter((c) => c.type !== CARD_TYPES.MAGIC)
  if (magicInDiscard.length === 1) {
    const updatedPlayers = game.players.map((p, i) =>
      i === sourcePlayerIndex ? { ...p, hand: [...p.hand, { ...magicInDiscard[0], faceUp: true }] } : p,
    )
    return { game: { ...game, players: updatedPlayers, discardPile: discardWithoutMagic } }
  }
  return {
    game: {
      ...game,
      discardPile: discardWithoutMagic,
      pendingStagedCardPick: {
        sourcePlayerIndex,
        sourceLabel,
        stagedCards: magicInDiscard.map((c) => ({ ...c, faceUp: true })),
        source: 'discardPile',
      },
    },
  }
}

/**
 * Wiggles (069): steal a hero, then roll to use its effect immediately.
 */
export function wigglesEffect(game, { sourcePlayerIndex, heroTargets = [], sourceLabel = 'Wiggles' }) {
  const heroInstanceId = heroTargets[0]
  if (!heroInstanceId) return { game }
  const ownerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
  )
  if (ownerIndex === -1 || ownerIndex === sourcePlayerIndex) return { game }

  const heroName = game.players[ownerIndex].partySlots.find(
    (s) => s?.hero.instanceId === heroInstanceId,
  )?.hero.name ?? '???'

  const { game: afterSteal, error } = steal(game, {
    sourcePlayerIndex,
    targetPlayerIndex: ownerIndex,
    heroInstanceId,
  })
  if (error) return { game, error }

  // Check if the stolen hero has a skill to roll for
  const stolenSlot = afterSteal.players[sourcePlayerIndex].partySlots.find(
    (s) => s?.hero.instanceId === heroInstanceId,
  )
  if (!stolenSlot?.hero.effectId) return { game: afterSteal }

  return {
    game: {
      ...afterSteal,
      pendingWigglesRoll: {
        sourcePlayerIndex,
        stolenHeroInstanceId: heroInstanceId,
        stolenHeroName: heroName,
      },
    },
  }
}

/**
 * Spooky (070): each other player must sacrifice a hero.
 * Builds a chain of pendingHeroSelection via afterHeroSelection.
 */
export function spookyEffect(game, { sourcePlayerIndex, sourceLabel = 'Spooky' }) {
  const opponents = game.players
    .map((_, i) => i)
    .filter((i) => i !== sourcePlayerIndex && game.players[i].partySlots.some((s) => s !== null))

  if (opponents.length === 0) return { game }

  // Build chain from last to first
  let chain = null
  for (let i = opponents.length - 1; i >= 0; i--) {
    chain = {
      sourcePlayerIndex: opponents[i],
      scope: 'own',
      action: 'sacrifice',
      sourceLabel,
      afterHeroSelection: chain,
    }
  }

  return { game: { ...game, pendingHeroSelection: chain } }
}

/**
 * Fluffy (071): destroy 2 hero cards (both pre-selected via heroTargets[]).
 */
export function fluffyEffect(game, { sourcePlayerIndex, heroTargets = [] }) {
  let current = game
  for (const heroInstanceId of heroTargets) {
    const ownerIndex = current.players.findIndex((p) =>
      p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
    )
    if (ownerIndex === -1) continue
    if (ownerIndex === sourcePlayerIndex) {
      const r = sacrifice(current, { playerIndex: ownerIndex, heroInstanceId })
      current = r.game
    } else {
      const r = destroy(current, { sourcePlayerIndex, targetPlayerIndex: ownerIndex, heroInstanceId })
      current = r.game
    }
  }
  return { game: current }
}

/**
 * Buttons (072): pull a card from another player's hand.
 * If that card is a Magic card, may play it immediately.
 */
export function buttonsEffect(game, { sourcePlayerIndex, targetPlayerIndex, sourceLabel = 'Buttons' }) {
  const target = game.players[targetPlayerIndex]
  if (!target) return { game, error: 'Invalid target.' }
  if (target.hand.length === 0) return { game }
  return {
    game: {
      ...game,
      pendingCardPull: {
        sourcePlayerIndex,
        targetPlayerIndex,
        bonusTriggerType: null,
        sourceLabel,
        allowImmediateMagicPlay: true,
      },
    },
  }
}

/**
 * Whiskers (073): steal a hero card, then destroy a hero card.
 */
export function whiskersEffect(game, { sourcePlayerIndex, heroTargets = [], sourceLabel = 'Whiskers' }) {
  const heroInstanceId = heroTargets[0]
  if (!heroInstanceId) return { game }
  const ownerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
  )
  if (ownerIndex === -1 || ownerIndex === sourcePlayerIndex) return { game }

  const { game: afterSteal, error } = steal(game, {
    sourcePlayerIndex,
    targetPlayerIndex: ownerIndex,
    heroInstanceId,
  })
  if (error) return { game, error }

  const anyHeroLeft = afterSteal.players.some((p) => p.partySlots.some((s) => s !== null))
  if (!anyHeroLeft) return { game: afterSteal }

  return {
    game: {
      ...afterSteal,
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
 * Hopper (074): choose a player; that player must sacrifice a hero.
 */
export function hopperEffect(game, { sourcePlayerIndex, heroTargets = [], sourceLabel = 'Hopper' }) {
  const heroInstanceId = heroTargets[0]
  if (!heroInstanceId) return { game }
  const ownerIndex = game.players.findIndex((p) =>
    p.partySlots.some((s) => s?.hero.instanceId === heroInstanceId),
  )
  if (ownerIndex === -1 || ownerIndex === sourcePlayerIndex) return { game }

  return {
    game: {
      ...game,
      pendingHeroSelection: {
        sourcePlayerIndex: ownerIndex,
        scope: 'own',
        action: 'sacrifice',
        sourceLabel,
      },
    },
  }
}

/** @type {Record<string, (game: GameState, params: any) => { game: GameState, error?: string }>} */
const CARD_EFFECTS = {
  peanut: peanutEffect,
  heavyBear: heavyBearEffect,
  panChucks: panChucksEffect,
  qiBear: qiBearEffect,
  bearyWise: bearyWiseEffect,
  toughTeddy: toughTeddyEffect,
  furyKnuckle: furyKnuckleEffect,
  bearClaw: bearClawEffect,
  luckyBucky: luckyBuckyEffect,
  badAxe: badAxeEffect,
  mellowDee: mellowDeeEffect,
  tipsyTootie: tipsyTootieEffect,
  greedyCheeks: greedyCheeksEffect,
  dodgyDealer: dodgyDealerEffect,
  fuzzyCheeks: fuzzyCheeksEffect,
  calmingVoiceAntiSteal: calmingVoiceAntiStealEffect,
  calmingVoiceAntiDestroy: calmingVoiceAntiDestroyEffect,
  ironResolve: ironResolveEffect,
  wiseShield: wiseShieldEffect,
  vibrantGlow: vibrantGlowEffect,
  guidingLight: guidingLightEffect,
  radiantHorn: radiantHornEffect,
  holyCurselifter: holyCurselifterEffect,
  sharpFox: sharpFoxEffect,
  wildshot: wildshotEffect,
  wilyRed: wilyRedEffect,
  lookieRookie: lookieRookieEffect,
  bullseye: bullseyeEffect,
  quickDraw: quickDrawEffect,
  hook: hookEffect,
  seriousGrey: seriousGreyEffect,
  snowball: snowballEffect,
  bunBun: bunBunEffect,
  wiggles: wigglesEffect,
  spooky: spookyEffect,
  fluffy: fluffyEffect,
  buttons: buttonsEffect,
  whiskers: whiskersEffect,
  hopper: hopperEffect,
  smoothMinimeow: smoothMinimeowEffect,
  plunderingPuma: plunderingPumaEffect,
  shurikitty: shurikittyEffect,
  meowzio: meowzioEffect,
  slipperyPaws: slipperyPawsEffect,
  slyPickings: slyPickingsEffect,
  kitNapper: kitNapperEffect,
  silentShadow: silentShadowEffect,
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
