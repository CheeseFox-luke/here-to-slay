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
 */
function createLeaderCard(id, filename, heroClass) {
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
    effect: '',
  }
}

/** 领袖卡（独立牌组，不进主公共牌区 / 怪物公共牌区） */
export const leaderCardsByClass = {
  [HERO_CLASSES.GUARDIAN]: [
    createLeaderCard('101', 'HtS-Base-Hero-Guardian-101.png', HERO_CLASSES.GUARDIAN),
  ],
  [HERO_CLASSES.THIEF]: [
    createLeaderCard('102', 'HtS-Base-Hero-Thief-102.png', HERO_CLASSES.THIEF),
  ],
  [HERO_CLASSES.FIGHTER]: [
    createLeaderCard('103', 'HtS-Base-Hero-Fighter-103.png', HERO_CLASSES.FIGHTER),
  ],
  [HERO_CLASSES.WIZARD]: [
    createLeaderCard('104', 'HtS-Base-Hero-Wizard-104.png', HERO_CLASSES.WIZARD),
  ],
  [HERO_CLASSES.RANGER]: [
    createLeaderCard('105', 'HtS-Base-Hero-Ranger-105.png', HERO_CLASSES.RANGER),
  ],
  [HERO_CLASSES.BARD]: [
    createLeaderCard('106', 'HtS-Base-Hero-Bard-106.png', HERO_CLASSES.BARD),
  ],
}

export const leaderCards = Object.values(leaderCardsByClass).flat()
