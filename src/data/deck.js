import {
  heroCards,
  itemCards,
  magicCards,
  modifierCards,
  challengeCards,
  actionCards,
} from './cards.js'
import { monsterCards } from './monsters.js'
import { leaderCards } from './leaders.js'
import { expandDeck, shuffleDeck } from './cardUtils.js'

/**
 * 玩家抽牌库（卡面定义）：英雄 + Item + Magic + Modifier + Challenge
 * 对局开始时用 createPlayerDrawDeck() 展开并洗牌
 */
export const playerDrawDeckCards = [
  ...heroCards,
  ...actionCards,
]

/** 玩家抽牌库展开后的实例（未洗牌，供预览或自行 shuffle） */
export const playerDrawDeck = expandDeck(playerDrawDeckCards)

/** 怪物公共牌区（卡面定义 + 展开实例） */
export const monsterDeckCards = monsterCards
export const monsterDeck = expandDeck(monsterCards)

/** 领袖卡（不进玩家抽牌库 / 怪物公共牌区） */
export const leaderDeckCards = leaderCards

export function createPlayerDrawDeck() {
  return shuffleDeck(expandDeck(playerDrawDeckCards))
}

export function createMonsterDeck() {
  return shuffleDeck(expandDeck(monsterDeckCards))
}

export {
  heroCards,
  itemCards,
  magicCards,
  modifierCards,
  challengeCards,
  actionCards,
  monsterCards,
  leaderCards,
}
