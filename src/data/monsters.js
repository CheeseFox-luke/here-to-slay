import {
  CARD_TYPES,
  CARD_BACKS,
  HERO_CLASSES,
  REQUIREMENT_HERO,
  cardImage,
  parseCardCount,
} from './cardUtils.js'

import {
  MONSTER_FAIL_AT_OR_BELOW,
  MONSTER_SUCCESS_AT_OR_ABOVE,
} from '../dice.js'

/** 打怪判定：≤5 失败，≥8 成功，中间为灰色 */
export const MONSTER_ATTACK_THRESHOLDS = {
  failAtOrBelow: MONSTER_FAIL_AT_OR_BELOW,
  successAtOrAbove: MONSTER_SUCCESS_AT_OR_ABOVE,
}

/**
 * @param {string} id
 * @param {string} filename
 * @param {import('./cardUtils.js').HeroClass[]} [requirement]
 * @param {{
 *   name?: string,
 *   effectId?: string,
 *   effect?: string,
 *   successAtOrAbove?: number,
 *   failAtOrBelow?: number,
 *   successAtOrBelow?: number,
 *   failAtOrAbove?: number,
 *   failEffectId?: string,
 *   failEffectCount?: number,
 * }} [options]
 */
function createMonsterCard(id, filename, requirement = [REQUIREMENT_HERO], options = {}) {
  const reversed = options.successAtOrBelow !== undefined
  return {
    id,
    name: options.name ?? id,
    type: CARD_TYPES.MONSTER,
    imageUrl: cardImage(filename),
    backImageUrl: CARD_BACKS.MONSTER,
    count: parseCardCount(filename),
    requirement,
    // Normal thresholds (default); one of the two pairs will be used.
    failAtOrBelow: reversed ? undefined : (options.failAtOrBelow ?? MONSTER_ATTACK_THRESHOLDS.failAtOrBelow),
    successAtOrAbove: reversed ? undefined : (options.successAtOrAbove ?? MONSTER_ATTACK_THRESHOLDS.successAtOrAbove),
    // Reversed thresholds: low roll = slay, high roll = sacrifice
    successAtOrBelow: options.successAtOrBelow,
    failAtOrAbove: options.failAtOrAbove,
    // Custom failure effect
    ...(options.failEffectId ? { failEffectId: options.failEffectId, failEffectCount: options.failEffectCount ?? 1 } : {}),
    isLarge: true,
    effect: options.effect ?? '',
    ...(options.effectId ? { effectId: options.effectId } : {}),
  }
}

/** 怪物公共牌区（与主公共牌区、英雄、领袖分离） */
export const monsterCards = [
  createMonsterCard('201', 'HtS-Base-201-Monster.png', [REQUIREMENT_HERO], {
    name: 'Dracos',
    successAtOrBelow: 5,
    failAtOrAbove: 8,
    effectId: 'slainMonsterHeroDestroyDraw',
    effect: 'Each time a hero card in your Party is destroyed, you may draw a card.',
  }),
  createMonsterCard('202', 'HtS-Base-202-Monster.png', [HERO_CLASSES.WIZARD], {
    name: 'Orthus',
    failAtOrBelow: 4,
    successAtOrAbove: 8,
    failEffectId: 'discardCards',
    failEffectCount: 2,
    effectId: 'slainMonsterDrawMagicPlay',
    effect: 'Each time you Draw a Magic card, you may play it immediately.',
  }),
  createMonsterCard('203', 'HtS-Base-203-Monster.png', [HERO_CLASSES.BARD, REQUIREMENT_HERO], {
    name: 'Dark Dragon King',
    failAtOrBelow: 4,
    successAtOrAbove: 8,
    failEffectId: 'discardCards',
    failEffectCount: 2,
    effectId: 'slainMonsterHeroRollBonus',
    effect: "Each time you roll for a hero card's effect, +1 to that roll.",
  }),
  createMonsterCard('204', 'HtS-Base-204-Monster.png', [REQUIREMENT_HERO], {
    name: 'Terratuga',
    failAtOrBelow: 7,
    successAtOrAbove: 8,
    effectId: 'slainMonsterPartyAntiDestroy',
    effect: 'Your hero cards cannot be destroyed.',
  }),
  createMonsterCard('205', 'HtS-Base-205-Monster.png', [REQUIREMENT_HERO, REQUIREMENT_HERO], {
    name: 'Crowned Serpent',
    failAtOrBelow: 7,
    successAtOrAbove: 10,
    effectId: 'slainMonsterModifierDraw',
    effect: 'Each time any player (including you) plays a Modifier, you may draw a card.',
  }),
  createMonsterCard('206', 'HtS-Base-206-Monster.png', [HERO_CLASSES.FIGHTER, REQUIREMENT_HERO], {
    name: 'Titan Wyvern',
    failAtOrBelow: 4,
    successAtOrAbove: 8,
    effectId: 'slainMonsterChallengeRollBonus',
    effect: 'Each time you roll for a challenge card, +1 to your roll.',
  }),
  createMonsterCard('207', 'HtS-Base-207-Monster.png', [REQUIREMENT_HERO, REQUIREMENT_HERO, REQUIREMENT_HERO], {
    name: 'Corrupted Sabretooth',
    failAtOrBelow: 6,
    successAtOrAbove: 9,
    effectId: 'slainMonsterStealInsteadOfDestroy',
    effect: 'Each time you would destroy a hero card, you may steal that hero card instead.',
  }),
  createMonsterCard('208', 'HtS-Base-208-Monster.png', [REQUIREMENT_HERO, REQUIREMENT_HERO, REQUIREMENT_HERO, REQUIREMENT_HERO], {
    name: 'Mega Slime',
    failAtOrBelow: 7,
    successAtOrAbove: 8,
    effectId: 'slainMonsterExtraAP',
    effect: 'You start each of your turns with 4 Action Points instead of 3.',
  }),
  createMonsterCard('209', 'HtS-Base-209-Monster.png', [HERO_CLASSES.THIEF, REQUIREMENT_HERO], {
    name: 'Warworn Owlbear',
    failAtOrBelow: 4,
    successAtOrAbove: 8,
    effectId: 'slainMonsterItemAntiChallenge',
    effect: 'Item cards you play cannot be challenged.',
  }),
  createMonsterCard('210', 'HtS-Base-210-Monster.png', [REQUIREMENT_HERO], {
    name: 'Arctic Aries',
    failAtOrBelow: 6,
    successAtOrAbove: 10,
    effectId: 'slainMonsterHeroSuccessDraw',
    effect: 'Each time you successfully roll to use a hero card\'s effect, you may draw a card.',
  }),
  createMonsterCard('211', 'HtS-Base-211-Monster.png', [REQUIREMENT_HERO, REQUIREMENT_HERO, REQUIREMENT_HERO], {
    name: 'Anuran Cauldron',
    failAtOrBelow: 6,
    successAtOrAbove: 7,
    effectId: 'slainMonsterAllRollBonus',
    effect: 'Each time you roll, +1 to your roll.',
  }),
  createMonsterCard('212', 'HtS-Base-212-Monster.png', [REQUIREMENT_HERO, REQUIREMENT_HERO], {
    name: 'Bloodwing',
    failAtOrBelow: 6,
    successAtOrAbove: 9,
    effectId: 'slainMonsterChallengeDiscard',
    effect: 'Each time another player challenges you, that player must discard a card.',
  }),
  createMonsterCard('213', 'HtS-Base-213-Monster.png', [REQUIREMENT_HERO, REQUIREMENT_HERO], {
    name: 'Abyss Queen',
    failAtOrBelow: 5,
    successAtOrAbove: 8,
    effectId: 'slainMonsterOpponentModifierBonus',
    effect: 'Each time another player plays a modifier card on one of your rolls, +1 to your roll.',
  }),
  createMonsterCard('214', 'HtS-Base-214-Monster.png', [HERO_CLASSES.RANGER, REQUIREMENT_HERO], {
    name: 'Malamammoth',
    failAtOrBelow: 4,
    successAtOrAbove: 8,
    effectId: 'slainMonsterDrawItemPlay',
    effect: 'Each time you draw an item card, you may play it immediately.',
  }),
  createMonsterCard('215', 'HtS-Base-215-Monster.png', [HERO_CLASSES.GUARDIAN, REQUIREMENT_HERO], {
    name: 'Rex Major',
    failAtOrBelow: 4,
    successAtOrAbove: 8,
    failEffectId: 'discardCards',
    failEffectCount: 2,
    effectId: 'slainMonsterDrawModifierReveal',
    effect: 'Each time you draw a Modifier card, you may reveal it to all other players and draw a second card.',
  }),
]
