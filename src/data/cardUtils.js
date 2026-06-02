/** @typedef {'Hero' | 'Item' | 'CursedItem' | 'Magic' | 'Modifier' | 'Challenge' | 'Monster' | 'Leader'} CardType */
/** @typedef {'Fighter' | 'Bard' | 'Guardian' | 'Ranger' | 'Thief' | 'Wizard' | 'Hero'} HeroClass */
/** @typedef {'gte' | 'lte'} RollComparison */

export const CARD_TYPES = {
  HERO: 'Hero',
  ITEM: 'Item',
  CURSED_ITEM: 'CursedItem',
  MAGIC: 'Magic',
  MODIFIER: 'Modifier',
  CHALLENGE: 'Challenge',
  MONSTER: 'Monster',
  LEADER: 'Leader',
}

export const HERO_CLASSES = {
  FIGHTER: 'Fighter',
  BARD: 'Bard',
  GUARDIAN: 'Guardian',
  RANGER: 'Ranger',
  THIEF: 'Thief',
  WIZARD: 'Wizard',
}

/** 怪物挑战需求；`Hero` 表示场上任意英雄即可 */
export const REQUIREMENT_HERO = 'Hero'

export function cardImage(filename) {
  return new URL(`../assets/cards/${filename}`, import.meta.url).href
}

/** 各牌区卡背：cards.js → cardsBack，monsters.js → monsterBack，leaders.js → leaderBack */
export const CARD_BACKS = {
  MAIN: cardImage('cardsBack.png'),
  MONSTER: cardImage('monsterBack.png'),
  LEADER: cardImage('leaderBack.png'),
}

/** 从文件名末尾的 `_数字` 解析牌堆份数，无后缀则为 1（如 `Challenge_14` → 14） */
export function parseCardCount(filename) {
  const match = filename.match(/_(\d+)\.png$/i)
  return match ? Number.parseInt(match[1], 10) : 1
}

/** 按 count 展开为牌堆实例（每张副本带唯一 instanceId） */
export function expandDeck(cards) {
  return cards.flatMap((card) =>
    Array.from({ length: card.count }, (_, copyIndex) => ({
      ...card,
      instanceId: `${card.id}-${copyIndex}`,
    })),
  )
}

export function shuffleDeck(deck) {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
