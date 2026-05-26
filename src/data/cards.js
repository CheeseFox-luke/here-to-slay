import {
  CARD_TYPES,
  HERO_CLASSES,
  CARD_BACKS,
  cardImage,
  parseCardCount,
} from './cardUtils.js'
import { MODIFIER_EFFECTS_BY_ID } from './modifierEffects.js'

export {
  CARD_TYPES,
  HERO_CLASSES,
  CARD_BACKS,
  parseCardCount,
  expandDeck,
  shuffleDeck,
} from './cardUtils.js'

/**
 * @param {string} id
 * @param {string} filename
 * @param {import('./cardUtils.js').CardType} type
 * @param {import('./cardUtils.js').HeroClass} [heroClass]
 */
function createCard(id, filename, type, heroClass) {
  return {
    id,
    name: id,
    type,
    ...(heroClass ? { class: heroClass } : {}),
    imageUrl: cardImage(filename),
    backImageUrl: CARD_BACKS.MAIN,
    count: parseCardCount(filename),
    rollRequirement: 2,
    effect: '',
  }
}

export const HERO_ROLL_REQUIREMENT = 6

/**
 * @param {string} id
 * @param {string} filename
 * @param {import('./cardUtils.js').HeroClass} heroClass
 * @param {{
 *   rollRequirement?: number,
 *   targeted?: boolean,
 *   effectId?: string,
 *   effect?: string,
 * }} [options]
 */
function createHeroCard(id, filename, heroClass, options = {}) {
  return {
    ...createCard(id, filename, CARD_TYPES.HERO, heroClass),
    rollRequirement: options.rollRequirement ?? HERO_ROLL_REQUIREMENT,
    targeted: options.targeted ?? false,
    heroTargeted: options.heroTargeted ?? false,
    ...(options.effectId ? { effectId: options.effectId } : {}),
    ...(options.effect ? { effect: options.effect } : {}),
  }
}

/** 英雄卡（玩家抽牌库组成部分） */
export const heroCardsByClass = {
  [HERO_CLASSES.FIGHTER]: [
    createHeroCard('Pan Chucks', 'HtS-Base-027-Hero-Fighter.png', HERO_CLASSES.FIGHTER, {
      rollRequirement: 8,
      effectId: 'panChucks',
      effect: 'Draw 2 cards. If at least one is a Challenge card, destroy a Hero.',
    }),
    createHeroCard('Heavy Bear', 'HtS-Base-028-Hero-Fighter.png', HERO_CLASSES.FIGHTER, {
      rollRequirement: 5,
      targeted: true,
      effectId: 'heavyBear',
      effect: 'Choose a player. That player discards 2 cards.',
    }),
    createHeroCard('Qi Bear', 'HtS-Base-029-Hero-Fighter.png', HERO_CLASSES.FIGHTER, {
      rollRequirement: 10,
      effectId: 'qiBear',
      effect: 'Discard up to 3 cards. For each card discarded, destroy a Hero.',
    }),
    createHeroCard('Beary Wise', 'HtS-Base-030-Hero-Fighter.png', HERO_CLASSES.FIGHTER, {
      rollRequirement: 7,
      effectId: 'bearyWise',
      effect:
        'Each other player discards 1 card. Choose 1 of those cards to add to your hand.',
    }),
    createHeroCard('Tough Teddy', 'HtS-Base-031-Hero-Fighter.png', HERO_CLASSES.FIGHTER, {
      rollRequirement: 4,
      effectId: 'toughTeddy',
      effect:
        'Each other player with a Fighter in their party discards 1 card.',
    }),
    createHeroCard('Fury Knuckle', 'HtS-Base-032-Hero-Fighter.png', HERO_CLASSES.FIGHTER, {
      rollRequirement: 5,
      targeted: true,
      effectId: 'furyKnuckle',
      effect: "Pull a card from another player's hand. If it's a Challenge card, pull another one.",
    }),
    createHeroCard('Bear Claw', 'HtS-Base-033-Hero-Fighter.png', HERO_CLASSES.FIGHTER, {
      rollRequirement: 7,
      targeted: true,
      effectId: 'bearClaw',
      effect: "Pull a card from another player's hand. If it's a Hero card, pull another one.",
    }),
    createHeroCard('Bad Axe', 'HtS-Base-034--Hero-Fighter.png', HERO_CLASSES.FIGHTER, {
      rollRequirement: 8,
      heroTargeted: true,
      effectId: 'badAxe',
      effect: 'Destroy a Hero.',
    }),
  ],
  [HERO_CLASSES.BARD]: [
    createHeroCard('035', 'HtS-Base-035-Hero-Bard.png', HERO_CLASSES.BARD),
    createHeroCard('036', 'HtS-Base-036-Hero-Bard.png', HERO_CLASSES.BARD),
    createHeroCard('037', 'HtS-Base-037-Hero-Bard.png', HERO_CLASSES.BARD),
    createHeroCard('038', 'HtS-Base-038-Hero-Bard.png', HERO_CLASSES.BARD),
    createHeroCard('039', 'HtS-Base-039-Hero-Bard.png', HERO_CLASSES.BARD),
    createHeroCard('040', 'HtS-Base-040-Hero-Bard.png', HERO_CLASSES.BARD),
    createHeroCard('041', 'HtS-Base-041-Hero-Bard.png', HERO_CLASSES.BARD),
    createHeroCard('042', 'HtS-Base-042-Hero-Bard.png', HERO_CLASSES.BARD),
  ],
  [HERO_CLASSES.GUARDIAN]: [
    createHeroCard('043', 'HtS-Base-043-Hero-Guardian.png', HERO_CLASSES.GUARDIAN),
    createHeroCard('044', 'HtS-Base-044-Hero-Guardian.png', HERO_CLASSES.GUARDIAN),
    createHeroCard('045', 'HtS-Base-045-Hero-Guardian.png', HERO_CLASSES.GUARDIAN),
    createHeroCard('046', 'HtS-Base-046-Hero-Guardian.png', HERO_CLASSES.GUARDIAN),
    createHeroCard('047', 'HtS-Base-047-Hero-Guardian.png', HERO_CLASSES.GUARDIAN),
    createHeroCard('048', 'HtS-Base-048-Hero-Guardian.png', HERO_CLASSES.GUARDIAN),
    createHeroCard('049', 'HtS-Base-049-Hero-Guardian.png', HERO_CLASSES.GUARDIAN),
    createHeroCard('050', 'HtS-Base-050-Hero-Guardian.png', HERO_CLASSES.GUARDIAN),
  ],
  [HERO_CLASSES.RANGER]: [
    createHeroCard('051', 'HtS-Base-051-Hero-Ranger.png', HERO_CLASSES.RANGER),
    createHeroCard('052', 'HtS-Base-052-Hero-Ranger.png', HERO_CLASSES.RANGER),
    createHeroCard('053', 'HtS-Base-053-Hero-Ranger.png', HERO_CLASSES.RANGER),
    createHeroCard('054', 'HtS-Base-054-Hero-Ranger.png', HERO_CLASSES.RANGER),
    createHeroCard('055', 'HtS-Base-055-Hero-Ranger.png', HERO_CLASSES.RANGER),
    createHeroCard('056', 'HtS-Base-056-Hero-Ranger.png', HERO_CLASSES.RANGER),
    createHeroCard('057', 'HtS-Base-057-Hero-Ranger.png', HERO_CLASSES.RANGER),
    createHeroCard('058', 'HtS-Base-058-Hero-Ranger.png', HERO_CLASSES.RANGER),
  ],
  [HERO_CLASSES.THIEF]: [
    createHeroCard('059', 'HtS-Base-059-Hero-Thief.png', HERO_CLASSES.THIEF),
    createHeroCard('060', 'HtS-Base-060-Hero-Thief.png', HERO_CLASSES.THIEF),
    createHeroCard('061', 'HtS-Base-061-Hero-Thief.png', HERO_CLASSES.THIEF),
    createHeroCard('062', 'HtS-Base-062-Hero-Thief.png', HERO_CLASSES.THIEF),
    createHeroCard('063', 'HtS-Base-063-Hero-Thief.png', HERO_CLASSES.THIEF),
    createHeroCard('064', 'HtS-Base-064-Hero-Thief.png', HERO_CLASSES.THIEF),
    createHeroCard('065', 'HtS-Base-065-Hero-Thief.png', HERO_CLASSES.THIEF),
    createHeroCard('066', 'HtS-Base-066-Hero-Thief.png', HERO_CLASSES.THIEF),
  ],
  [HERO_CLASSES.WIZARD]: [
    createHeroCard('067', 'HtS-Base-067-Hero-Wizard.png', HERO_CLASSES.WIZARD),
    createHeroCard('068', 'HtS-Base-068-Hero-Wizard.png', HERO_CLASSES.WIZARD),
    createHeroCard('069', 'HtS-Base-069-Hero-Wizard.png', HERO_CLASSES.WIZARD),
    createHeroCard('070', 'HtS-Base-070-Hero-Wizard.png', HERO_CLASSES.WIZARD),
    createHeroCard('071', 'HtS-Base-071-Hero-Wizard.png', HERO_CLASSES.WIZARD),
    createHeroCard('072', 'HtS-Base-072-Hero-Wizard.png', HERO_CLASSES.WIZARD),
    createHeroCard('073', 'HtS-Base-073-Hero-Wizard.png', HERO_CLASSES.WIZARD),
    createHeroCard('074', 'HtS-Base-074-Hero-Wizard.png', HERO_CLASSES.WIZARD),
  ],
}

export const heroCards = Object.values(heroCardsByClass).flat()

export const itemCards = [
  createCard('001', 'HtS-Base-001-Item.png', CARD_TYPES.ITEM),
  createCard('002', 'HtS-Base-002-Item_2.png', CARD_TYPES.ITEM),
  createCard('003', 'HtS-Base-003-Item.png', CARD_TYPES.ITEM),
  createCard('004', 'HtS-Base-004-Item.png', CARD_TYPES.ITEM),
  createCard('005', 'HtS-Base-005-Item.png', CARD_TYPES.ITEM),
  createCard('006', 'HtS-Base-006-Item.png', CARD_TYPES.ITEM),
  createCard('007', 'HtS-Base-007-Item.png', CARD_TYPES.ITEM),
  createCard('008', 'HtS-Base-008-Item.png', CARD_TYPES.ITEM),
  createCard('009', 'HtS-Base-009-Item.png', CARD_TYPES.ITEM),
  createCard('010', 'HtS-Base-010-Item_2.png', CARD_TYPES.ITEM),
  createCard('011', 'HtS-Base-011-Item_2.png', CARD_TYPES.ITEM),
  createCard('012', 'HtS-Base-012-Item.png', CARD_TYPES.ITEM),
]

export const magicCards = [
  createCard('013', 'HtS-Base-013-Magic_2.png', CARD_TYPES.MAGIC),
  createCard('014', 'HtS-Base-014-Magic.png', CARD_TYPES.MAGIC),
  createCard('015', 'HtS-Base-015-Magic_2.png', CARD_TYPES.MAGIC),
  createCard('016', 'HtS-Base-016-Magic_2.png', CARD_TYPES.MAGIC),
  createCard('017', 'HtS-Base-017-Magic_2.png', CARD_TYPES.MAGIC),
  createCard('018', 'HtS-Base-018-Magic_2.png', CARD_TYPES.MAGIC),
  createCard('019', 'HtS-Base-019-Magic.png', CARD_TYPES.MAGIC),
  createCard('020', 'HtS-Base-020-Magic.png', CARD_TYPES.MAGIC),
]

/**
 * @param {string} id
 * @param {string} filename
 */
function createModifierCard(id, filename) {
  return {
    ...createCard(id, filename, CARD_TYPES.MODIFIER),
    modifierEffect: MODIFIER_EFFECTS_BY_ID[id],
  }
}

/** 文件名拼写为 Modifer，与素材保持一致 */
export const modifierCards = [
  createModifierCard('021', 'HtS-Base-021-Modifer_9.png'),
  createModifierCard('022', 'HtS-Base-022-Modifer_4.png'),
  createModifierCard('023', 'HtS-Base-023-Modifer_4.png'),
  createModifierCard('024', 'HtS-Base-024-Modifer_4.png'),
  createModifierCard('025', 'HtS-Base-025-Modifer_4.png'),
]

export const challengeCards = [
  createCard('026', 'HtS-Base-026-Challenge_14.png', CARD_TYPES.CHALLENGE),
]

/** Item / Magic / Modifier / Challenge（玩家抽牌库组成部分） */
export const actionCards = [
  ...itemCards,
  ...magicCards,
  ...modifierCards,
  ...challengeCards,
]
