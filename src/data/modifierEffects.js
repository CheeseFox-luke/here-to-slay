/** @typedef {{ label: string, delta: number }} ModifierOption */
/** @typedef {{ type: 'fixed', delta: number }} FixedModifierEffect */
/** @typedef {{ type: 'choice', options: ModifierOption[] }} ChoiceModifierEffect */
/** @typedef {FixedModifierEffect | ChoiceModifierEffect} ModifierEffect */

/** @type {Record<string, ModifierEffect>} */
export const MODIFIER_EFFECTS_BY_ID = {
  '021': {
    type: 'choice',
    options: [
      { label: '+2', delta: 2 },
      { label: '-2', delta: -2 },
    ],
  },
  '022': { type: 'fixed', delta: -4 },
  '023': { type: 'fixed', delta: 4 },
  '024': {
    type: 'choice',
    options: [
      { label: '+1', delta: 1 },
      { label: '-3', delta: -3 },
    ],
  },
  '025': {
    type: 'choice',
    options: [
      { label: '+3', delta: 3 },
      { label: '-1', delta: -1 },
    ],
  },
}

/**
 * @param {string} cardId
 * @returns {ModifierEffect | undefined}
 */
export function getModifierEffect(cardId) {
  return MODIFIER_EFFECTS_BY_ID[cardId]
}

/**
 * @param {ModifierEffect} effect
 * @param {number} [choiceIndex]
 * @returns {number | null}
 */
export function resolveModifierDelta(effect, choiceIndex) {
  if (effect.type === 'fixed') {
    return effect.delta
  }
  if (
    choiceIndex === undefined ||
    choiceIndex < 0 ||
    choiceIndex >= effect.options.length
  ) {
    return null
  }
  return effect.options[choiceIndex].delta
}
