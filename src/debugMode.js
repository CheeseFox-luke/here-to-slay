import { withFaceUp } from './gameState.js'

/** @typedef {import('./gameState.js').GameState} GameState */
/** @typedef {import('./gameState.js').CardInstance} CardInstance */

export const DEBUG_MODE_STORAGE_KEY = 'hts-debug-mode'

/** @typedef {'mainDeck' | 'discardPile'} DebugCardSource */

/**
 * @param {string} input
 * @returns {{ numeric: string | null, text: string } | null}
 */
export function normalizeCardQuery(input) {
  const trimmed = String(input).trim()
  if (!trimmed) {
    return null
  }
  if (/^\d+$/.test(trimmed)) {
    return { numeric: trimmed.padStart(3, '0'), text: trimmed }
  }
  return { numeric: null, text: trimmed.toLowerCase() }
}

/**
 * @param {CardInstance} card
 * @returns {string | null}
 */
export function extractBaseNumber(card) {
  const url = card.imageUrl ?? ''
  const match = url.match(/HtS-Base-(\d+)/i)
  return match ? match[1].padStart(3, '0') : null
}

/**
 * @param {CardInstance} card
 * @param {string} query
 */
export function cardMatchesQuery(card, query) {
  const norm = normalizeCardQuery(query)
  if (!norm) {
    return false
  }

  const baseNumber = extractBaseNumber(card)

  if (norm.numeric && baseNumber === norm.numeric) {
    return true
  }

  if (card.id === norm.text || card.id.toLowerCase() === norm.text) {
    return true
  }

  if (baseNumber && baseNumber.replace(/^0+/, '') === norm.text.replace(/^0+/, '')) {
    return true
  }

  return false
}

export function loadDebugModeEnabled() {
  try {
    return localStorage.getItem(DEBUG_MODE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * @param {boolean} enabled
 */
export function saveDebugModeEnabled(enabled) {
  try {
    localStorage.setItem(DEBUG_MODE_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Remove the first matching card from a pile and add it to the current player's hand.
 * @param {GameState} game
 * @param {{ cardQuery: string, source: DebugCardSource }} params
 */
export function debugDrawCardToHand(game, { cardQuery, source }) {
  const norm = normalizeCardQuery(cardQuery)
  if (!norm) {
    return { game, error: 'Enter a card number (e.g. 027) or card id.' }
  }

  const pileKey = source === 'discardPile' ? 'discardPile' : 'mainDeck'
  const pile = game[pileKey]
  const index = pile.findIndex((card) => cardMatchesQuery(card, cardQuery))

  if (index === -1) {
    const where = source === 'discardPile' ? 'discard pile' : 'main deck'
    return { game, error: `No matching card in the ${where}.` }
  }

  const [card, ...remaining] = [
    pile[index],
    ...pile.slice(0, index),
    ...pile.slice(index + 1),
  ]

  const playerIndex = game.currentPlayerIndex
  const players = game.players.map((p, i) =>
    i === playerIndex ? { ...p, hand: [...p.hand, withFaceUp(card)] } : p,
  )

  return {
    game: {
      ...game,
      [pileKey]: remaining,
      players,
    },
    card,
    error: null,
  }
}
