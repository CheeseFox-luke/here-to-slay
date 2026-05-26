import { shuffleDeck } from './data/cardUtils.js'
import { withFaceDown, withFaceUp } from './gameState.js'

/** @typedef {import('./gameState.js').GameState} GameState */
/** @typedef {import('./gameState.js').CardInstance} CardInstance */

/**
 * @param {GameState} game
 * @returns {GameState}
 */
export function recycleDiscardIntoMainDeck(game) {
  if (game.mainDeck.length > 0 || game.discardPile.length === 0) {
    return game
  }

  return {
    ...game,
    mainDeck: shuffleDeck(game.discardPile.map((card) => withFaceDown(card))),
    discardPile: [],
  }
}

/**
 * @param {GameState} game
 * @returns {boolean}
 */
export function canDrawFromMainDeck(game) {
  return game.mainDeck.length > 0 || game.discardPile.length > 0
}

/**
 * @param {GameState} game
 * @param {number} count
 * @returns {{ game: GameState, drawn: CardInstance[] }}
 */
export function drawFromMainDeck(game, count) {
  let state = recycleDiscardIntoMainDeck(game)
  const drawn = []

  for (let i = 0; i < count; i++) {
    if (state.mainDeck.length === 0) {
      state = recycleDiscardIntoMainDeck(state)
    }
    if (state.mainDeck.length === 0) {
      break
    }
    const [card, ...remaining] = state.mainDeck
    drawn.push(withFaceUp(card))
    state = { ...state, mainDeck: remaining }
  }

  return { game: state, drawn }
}
