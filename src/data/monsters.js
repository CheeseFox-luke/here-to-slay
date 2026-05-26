import {
  CARD_TYPES,
  CARD_BACKS,
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
 */
function createMonsterCard(id, filename, requirement = [REQUIREMENT_HERO]) {
  return {
    id,
    name: id,
    type: CARD_TYPES.MONSTER,
    imageUrl: cardImage(filename),
    backImageUrl: CARD_BACKS.MONSTER,
    count: parseCardCount(filename),
    requirement,
    failAtOrBelow: MONSTER_ATTACK_THRESHOLDS.failAtOrBelow,
    successAtOrAbove: MONSTER_ATTACK_THRESHOLDS.successAtOrAbove,
    isLarge: true,
    effect: '',
  }
}

/** 怪物公共牌区（与主公共牌区、英雄、领袖分离） */
export const monsterCards = [
  createMonsterCard('201', 'HtS-Base-201-Monster.png'),
  createMonsterCard('202', 'HtS-Base-202-Monster.png'),
  createMonsterCard('203', 'HtS-Base-203-Monster.png'),
  createMonsterCard('204', 'HtS-Base-204-Monster.png'),
  createMonsterCard('205', 'HtS-Base-205-Monster.png'),
  createMonsterCard('206', 'HtS-Base-206-Monster.png'),
  createMonsterCard('207', 'HtS-Base-207-Monster.png'),
  createMonsterCard('208', 'HtS-Base-208-Monster.png'),
  createMonsterCard('209', 'HtS-Base-209-Monster.png'),
  createMonsterCard('210', 'HtS-Base-210-Monster.png'),
  createMonsterCard('211', 'HtS-Base-211-Monster.png'),
  createMonsterCard('212', 'HtS-Base-212-Monster.png'),
  createMonsterCard('213', 'HtS-Base-213-Monster.png'),
  createMonsterCard('214', 'HtS-Base-214-Monster.png'),
  createMonsterCard('215', 'HtS-Base-215-Monster.png'),
]
