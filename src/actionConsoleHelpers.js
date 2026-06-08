import { CARD_TYPES } from './data/cardUtils.js'
import {
  getChallengeAttackerIndex,
  isChallengeWindowActive,
  isInterruptPhaseActive,
  isModifierPhaseActive,
  isPlayableFromHand,
} from './gameActions.js'

/** @typedef {'turn' | 'idle' | 'challenge-wait' | 'challenge-respond' | 'modifier-respond' | 'modifier-passed'} ActionConsoleMode */

/** 需求 4：手牌无可出的 Challenge / Modifier 时操作台红字（英文） */
export const NO_CHALLENGE_CARD_HINT = 'You have no Challenge card to play!'
export const NO_MODIFIER_CARD_HINT = 'You have no Modifier card to play!'

/**
 * actionConsoleHelpers — 操作台 UI 用衍生状态（不改 gameState 规则层）
 *
 * [Provides]
 * - 某玩家手牌是否还能打出 Challenge / Modifier（供需求 2 + 5 禁用按钮）
 * - 进入 challenge / modify 时每位玩家的响应快照（下一步接操作台）
 *
 * [Requires]
 * - gameActions.isPlayableFromHand（含 antiChallenge / antiModifier、attacker 等规则）
 */

/**
 * @typedef {Object} PlayerChallengeResponse
 * @property {number} playerIndex
 * @property {boolean} isAttacker
 * @property {boolean} canPlayChallenge 手牌里至少一张可出的 Challenge
 * @property {boolean} hasPassedChallenge 已点 Pass（challengePassedBy）
 * @property {'wait' | 'respond' | 'passed'} role UI 粗分：attacker 等待 / 可响应 / 已 Pass
 */

/**
 * @typedef {Object} PlayerModifierResponse
 * @property {number} playerIndex
 * @property {boolean} canPlayModifier
 * @property {boolean} hasPassedModifier
 */

/**
 * @param {import('./gameState.js').GameState} game
 * @param {number} playerIndex
 */
export function handHasPlayableChallenge(game, playerIndex) {
  if (!isChallengeWindowActive(game)) {
    return false
  }
  if (playerIndex === getChallengeAttackerIndex(game)) {
    return false
  }
  return game.players[playerIndex].hand.some(
    (card) =>
      card.type === CARD_TYPES.CHALLENGE &&
      isPlayableFromHand(card, game, playerIndex),
  )
}

/**
 * @param {import('./gameState.js').GameState} game
 * @param {number} playerIndex
 */
export function handHasPlayableModifier(game, playerIndex) {
  if (!isModifierPhaseActive(game)) {
    return false
  }
  return game.players[playerIndex].hand.some(
    (card) =>
      card.type === CARD_TYPES.MODIFIER &&
      isPlayableFromHand(card, game, playerIndex),
  )
}

/**
 * Challenge 窗开启时，为每位玩家生成响应快照（派生，不写入存档）。
 * @param {import('./gameState.js').GameState} game
 * @returns {PlayerChallengeResponse[] | null}
 */
export function getPerPlayerChallengeResponse(game) {
  if (!isChallengeWindowActive(game)) {
    return null
  }

  const attackerIndex = getChallengeAttackerIndex(game)
  const passed = game.challengePassedBy ?? []

  return game.players.map((_, playerIndex) => {
    const isAttacker = playerIndex === attackerIndex
    const hasPassedChallenge = passed.includes(playerIndex)
    const canPlayChallenge = handHasPlayableChallenge(game, playerIndex)

    /** @type {'wait' | 'respond' | 'passed'} */
    let role = 'respond'
    if (isAttacker) {
      role = 'wait'
    } else if (hasPassedChallenge) {
      role = 'passed'
    }

    return {
      playerIndex,
      isAttacker,
      canPlayChallenge,
      hasPassedChallenge,
      role,
    }
  })
}

/**
 * Modify 窗开启时，为每位玩家生成响应快照（全员需 Pass，含当前回合玩家）。
 * @param {import('./gameState.js').GameState} game
 * @returns {PlayerModifierResponse[] | null}
 */
export function getPerPlayerModifierResponse(game) {
  if (!isModifierPhaseActive(game)) {
    return null
  }

  const passed = game.modifierPassedBy ?? []

  return game.players.map((_, playerIndex) => ({
    playerIndex,
    canPlayModifier: handHasPlayableModifier(game, playerIndex),
    hasPassedModifier: passed.includes(playerIndex),
  }))
}

/**
 * 本地座位（mySeat）在 Challenge 窗的快捷字段。
 * @param {import('./gameState.js').GameState} game
 * @param {number} mySeat
 */
export function getMyChallengeResponse(game, mySeat) {
  const all = getPerPlayerChallengeResponse(game)
  return all?.[mySeat] ?? null
}

/**
 * @param {import('./gameState.js').GameState} game
 * @param {number} mySeat
 */
export function getMyModifierResponse(game, mySeat) {
  const all = getPerPlayerModifierResponse(game)
  return all?.[mySeat] ?? null
}

/**
 * 操作台四种主状态 + 已 Pass 子态（需求 2）。
 * @param {import('./gameState.js').GameState} game
 * @param {number} mySeat
 * @returns {ActionConsoleMode}
 */
export function getActionConsoleMode(game, mySeat) {
  if (isChallengeWindowActive(game) && !isModifierPhaseActive(game)) {
    const mine = getMyChallengeResponse(game, mySeat)
    if (mine?.isAttacker) {
      return 'challenge-wait'
    }
    if (mine?.hasPassedChallenge) {
      return 'idle'
    }
    return 'challenge-respond'
  }

  if (isModifierPhaseActive(game)) {
    const mine = getMyModifierResponse(game, mySeat)
    if (mine?.hasPassedModifier) {
      return 'modifier-passed'
    }
    return 'modifier-respond'
  }

  if (
    mySeat === game.currentPlayerIndex &&
    !isInterruptPhaseActive(game) &&
    game.winner == null
  ) {
    return 'turn'
  }

  return 'idle'
}
