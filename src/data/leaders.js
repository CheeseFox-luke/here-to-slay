import {
  CARD_TYPES,
  HERO_CLASSES,
  CARD_BACKS,
  cardImage,
  parseCardCount,
} from './cardUtils.js'

/**
 * @param {string} id
 * @param {string} filename
 * @param {import('./cardUtils.js').HeroClass} heroClass
 * @param {{ effectId?: string, effect?: string }} [options]
 */
function createLeaderCard(id, filename, heroClass, options = {}) {
  return {
    id,
    name: id,
    type: CARD_TYPES.LEADER,
    class: heroClass,
    imageUrl: cardImage(filename),
    backImageUrl: CARD_BACKS.LEADER,
    count: parseCardCount(filename),
    rollRequirement: 2,
    isLarge: true,
    effect: options.effect ?? '',
    ...(options.effectId ? { effectId: options.effectId } : {}),
  }
}

/** 领袖卡（独立牌组，不进主公共牌区 / 怪物公共牌区） */
export const leaderCardsByClass = {
  [HERO_CLASSES.GUARDIAN]: [
    createLeaderCard('101', 'HtS-Base-Hero-Guardian-101.png', HERO_CLASSES.GUARDIAN, {
      effectId: 'leaderModifierBonus',
      effect: 'Each time you play a modifier card, apply an additional free +1 or -1 to that roll.',
    }),
  ],
  [HERO_CLASSES.THIEF]: [
    createLeaderCard('102', 'HtS-Base-Hero-Thief-102.png', HERO_CLASSES.THIEF, {
      effectId: 'leaderActivePull',
      effect: 'Active (1 AP): choose a player and pull 1 card from their hand.',
    }),
  ],
  [HERO_CLASSES.FIGHTER]: [
    createLeaderCard('103', 'HtS-Base-Hero-Fighter-103.png', HERO_CLASSES.FIGHTER, {
      effectId: 'leaderChallengeRollBonus',
      effect: '+2 to all of your Challenge card rolls.',
    }),
  ],
  [HERO_CLASSES.WIZARD]: [
    createLeaderCard('104', 'HtS-Base-Hero-Wizard-104.png', HERO_CLASSES.WIZARD, {
      effectId: 'leaderWizardDraw',
      effect: 'Each time you play a Magic card, you may draw 1 card.',
    }),
  ],
  [HERO_CLASSES.RANGER]: [
    createLeaderCard('105', 'HtS-Base-Hero-Ranger-105.png', HERO_CLASSES.RANGER, {
      effectId: 'leaderMonsterRollBonus',
      effect: 'Each time you roll to attack a monster, +1 to that roll.',
    }),
  ],
  [HERO_CLASSES.BARD]: [
    createLeaderCard('106', 'HtS-Base-Hero-Bard-106.png', HERO_CLASSES.BARD, {
      effectId: 'leaderHeroRollBonus',
      effect: "Each time you roll to use a hero card's effect, +1 to that roll.",
    }),
  ],
}

export const leaderCards = Object.values(leaderCardsByClass).flat()
