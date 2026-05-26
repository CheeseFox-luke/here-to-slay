export const HERO_FAIL_THRESHOLD = 6
export const MONSTER_FAIL_AT_OR_BELOW = 5
export const MONSTER_SUCCESS_AT_OR_ABOVE = 8

/**
 * @returns {{ d1: number, d2: number, sum: number }}
 */
export function rollTwoD6() {
  const d1 = Math.floor(Math.random() * 6) + 1
  const d2 = Math.floor(Math.random() * 6) + 1
  return { d1, d2, sum: d1 + d2 }
}

/**
 * @param {number} sum
 * @param {number} requirement
 */
export function evaluateHeroRoll(sum, requirement) {
  return {
    showGreen: sum >= requirement,
    showRed: sum < HERO_FAIL_THRESHOLD,
    showGray: false,
    showFail: false,
  }
}

/**
 * @param {number} sum
 * @param {number} [failAtOrBelow]
 * @param {number} [successAtOrAbove]
 */
export function evaluateMonsterRoll(
  sum,
  failAtOrBelow = MONSTER_FAIL_AT_OR_BELOW,
  successAtOrAbove = MONSTER_SUCCESS_AT_OR_ABOVE,
) {
  const showRed = sum <= failAtOrBelow
  const showGreen = sum >= successAtOrAbove
  return {
    showGreen,
    showRed,
    showGray: !showGreen && !showRed,
    showFail: showRed,
  }
}

/**
 * @param {import('./gameState.js').PendingRoll} pending
 * @returns {import('./gameState.js').PendingRoll}
 */
/**
 * @param {import('./gameState.js').PendingRoll} pending
 */
export function evaluateChallengeRoll(pending) {
  const attackerSum = pending.attackerRoll?.currentSum ?? 0
  const challengerSum = pending.challengerRoll?.currentSum ?? 0
  const challengerLeading = challengerSum >= attackerSum
  return {
    showGreen: challengerLeading,
    showRed: !challengerLeading,
    showGray: false,
    showFail: false,
  }
}

/**
 * @param {import('./gameState.js').PendingRoll} pending
 * @returns {import('./gameState.js').PendingRoll}
 */
export function reevaluatePendingRoll(pending) {
  if (pending.rollType === 'challenge') {
    return { ...pending, ...evaluateChallengeRoll(pending) }
  }

  if (pending.rollType === 'monster') {
    const indicators = evaluateMonsterRoll(
      pending.currentSum,
      pending.failAtOrBelow,
      pending.successAtOrAbove,
    )
    return { ...pending, ...indicators }
  }

  const indicators = evaluateHeroRoll(
    pending.currentSum,
    pending.requirement ?? 6,
  )
  return { ...pending, ...indicators }
}

/**
 * @param {number} requirement
 * @param {number} rollingPlayerIndex
 */
export function rollForHeroEffect(requirement, rollingPlayerIndex) {
  const { d1, d2, sum } = rollTwoD6()
  return createPendingRollFromHero(d1, d2, sum, requirement, rollingPlayerIndex)
}

/**
 * @param {string} monsterInstanceId
 * @param {string} monsterName
 * @param {number} rollingPlayerIndex
 * @param {number} [failAtOrBelow]
 * @param {number} [successAtOrAbove]
 */
export function rollForMonsterAttack(
  monsterInstanceId,
  monsterName,
  rollingPlayerIndex,
  failAtOrBelow = MONSTER_FAIL_AT_OR_BELOW,
  successAtOrAbove = MONSTER_SUCCESS_AT_OR_ABOVE,
) {
  const { d1, d2, sum } = rollTwoD6()
  return createPendingRollFromMonster(
    d1,
    d2,
    sum,
    monsterInstanceId,
    monsterName,
    rollingPlayerIndex,
    failAtOrBelow,
    successAtOrAbove,
  )
}

/**
 * @param {number} d1
 * @param {number} d2
 * @param {number} baseSum
 * @param {number} requirement
 * @param {number} rollingPlayerIndex
 */
export function createPendingRollFromHero(
  d1,
  d2,
  baseSum,
  requirement,
  rollingPlayerIndex,
) {
  const indicators = evaluateHeroRoll(baseSum, requirement)
  return {
    rollType: 'hero',
    d1,
    d2,
    baseSum,
    currentSum: baseSum,
    requirement,
    rollingPlayerIndex,
    modifierLabels: [],
    targetLabel: 'Hero effect',
    ...indicators,
  }
}

/**
 * @param {number} d1
 * @param {number} d2
 * @param {number} baseSum
 * @param {string} monsterInstanceId
 * @param {string} monsterName
 * @param {number} rollingPlayerIndex
 * @param {number} failAtOrBelow
 * @param {number} successAtOrAbove
 */
export function createPendingRollFromMonster(
  d1,
  d2,
  baseSum,
  monsterInstanceId,
  monsterName,
  rollingPlayerIndex,
  failAtOrBelow,
  successAtOrAbove,
) {
  const indicators = evaluateMonsterRoll(
    baseSum,
    failAtOrBelow,
    successAtOrAbove,
  )
  return {
    rollType: 'monster',
    d1,
    d2,
    baseSum,
    currentSum: baseSum,
    failAtOrBelow,
    successAtOrAbove,
    targetMonsterInstanceId: monsterInstanceId,
    targetLabel: `Attack ${monsterName}`,
    rollingPlayerIndex,
    modifierLabels: [],
    ...indicators,
  }
}

/**
 * @param {import('./gameState.js').PendingRoll} pending
 * @param {number} delta
 * @param {string} modifierLabel
 */
export function applyDeltaToPendingRoll(pending, delta, modifierLabel) {
  const updated = {
    ...pending,
    currentSum: pending.currentSum + delta,
    modifierLabels: [...pending.modifierLabels, modifierLabel],
    lastModifierLabel: modifierLabel,
  }
  return reevaluatePendingRoll(updated)
}

/**
 * @param {import('./gameState.js').PendingRoll} pending
 * @param {number} delta
 * @param {string} modifierLabel
 * @param {'attacker' | 'challenger'} target
 */
export function applyDeltaToChallengeRoll(
  pending,
  delta,
  modifierLabel,
  target,
) {
  const sideKey = target === 'attacker' ? 'attackerRoll' : 'challengerRoll'
  const side = pending[sideKey]
  if (!side) {
    return pending
  }

  const updatedSide = {
    ...side,
    currentSum: side.currentSum + delta,
    modifierLabels: [...side.modifierLabels, modifierLabel],
  }

  const updated = {
    ...pending,
    [sideKey]: updatedSide,
    modifierLabels: [
      ...pending.modifierLabels,
      `${modifierLabel} (${target === 'attacker' ? 'attacker' : 'challenger'} roll)`,
    ],
    lastModifierLabel: modifierLabel,
  }
  return reevaluatePendingRoll(updated)
}

/**
 * @param {number} attackerIndex
 * @param {number} challengerIndex
 * @param {string} attackerName
 * @param {string} challengerName
 * @param {import('./gameState.js').StagedPlay} stagedPlay
 */
export function rollForChallenge(
  attackerIndex,
  challengerIndex,
  attackerName,
  challengerName,
  stagedPlay,
) {
  const attacker = rollTwoD6()
  const challenger = rollTwoD6()

  return createPendingRollFromChallenge(
    attackerIndex,
    challengerIndex,
    attackerName,
    challengerName,
    attacker.d1,
    attacker.d2,
    attacker.sum,
    challenger.d1,
    challenger.d2,
    challenger.sum,
    stagedPlay,
  )
}

/**
 * @param {number} attackerIndex
 * @param {number} challengerIndex
 * @param {string} attackerName
 * @param {string} challengerName
 * @param {number} aD1
 * @param {number} aD2
 * @param {number} aSum
 * @param {number} cD1
 * @param {number} cD2
 * @param {number} cSum
 * @param {import('./gameState.js').StagedPlay} stagedPlay
 */
export function createPendingRollFromChallenge(
  attackerIndex,
  challengerIndex,
  attackerName,
  challengerName,
  aD1,
  aD2,
  aSum,
  cD1,
  cD2,
  cSum,
  stagedPlay,
) {
  /** @type {import('./gameState.js').PendingRoll} */
  const pending = {
    rollType: 'challenge',
    d1: cD1,
    d2: cD2,
    baseSum: cSum,
    currentSum: cSum,
    rollingPlayerIndex: challengerIndex,
    attackerIndex,
    challengerIndex,
    attackerRoll: {
      d1: aD1,
      d2: aD2,
      baseSum: aSum,
      currentSum: aSum,
      modifierLabels: [],
    },
    challengerRoll: {
      d1: cD1,
      d2: cD2,
      baseSum: cSum,
      currentSum: cSum,
      modifierLabels: [],
    },
    stagedPlay,
    modifierLabels: [],
    targetLabel: `Challenge: ${challengerName} vs ${attackerName}`,
    showGreen: false,
    showRed: false,
    showGray: false,
    showFail: false,
  }
  return reevaluatePendingRoll(pending)
}
