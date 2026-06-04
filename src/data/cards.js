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
 *   heroTargeted?: boolean,
 *   heroTargetScope?: 'own' | 'opponents' | 'any',
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
    ...(options.heroTargetScope ? { heroTargetScope: options.heroTargetScope } : {}),
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
    createHeroCard('Peanut', 'HtS-Base-035-Hero-Bard.png', HERO_CLASSES.BARD, {
      rollRequirement: 7,
      effectId: 'peanut',
      effect: 'Draw 2 cards.',
    }),
    createHeroCard('Napping Nibbles', 'HtS-Base-036-Hero-Bard.png', HERO_CLASSES.BARD, {
      rollRequirement: 2,
      effect: '',
    }),
    createHeroCard('Mellow Dee', 'HtS-Base-037-Hero-Bard.png', HERO_CLASSES.BARD, {
      rollRequirement: 7,
      effectId: 'mellowDee',
      effect: 'Draw 1 card. If it\'s a Hero, you may play it immediately and trigger its ability.',
    }),
    createHeroCard('Greedy Cheeks', 'HtS-Base-038-Hero-Bard.png', HERO_CLASSES.BARD, {
      rollRequirement: 8,
      effectId: 'greedyCheeks',
      effect: 'Each other player must give you 1 card from their hand.',
    }),
    createHeroCard('Fuzzy Cheeks', 'HtS-Base-039-Hero-Bard.png', HERO_CLASSES.BARD, {
      rollRequirement: 8,
      effectId: 'fuzzyCheeks',
      effect: "Draw 1 card and play a Hero card from your hand (and trigger that Hero's ability).",
    }),
    createHeroCard('Tipsy Tootie', 'HtS-Base-040-Hero-Bard.png', HERO_CLASSES.BARD, {
      rollRequirement: 6,
      heroTargeted: true,
      heroTargetScope: 'opponents',
      effectId: 'tipsyTootie',
      effect:
        "Choose a player. STEAL a Hero card from that player's Party and move Tipsy Tootie to that player's Party.",
    }),
    createHeroCard('Dodgy Dealer', 'HtS-Base-041-Hero-Bard.png', HERO_CLASSES.BARD, {
      rollRequirement: 9,
      targeted: true,
      effectId: 'dodgyDealer',
      effect: 'Trade hands with another player.',
    }),
    createHeroCard('Lucky Bucky', 'HtS-Base-042-Hero-Bard.png', HERO_CLASSES.BARD, {
      rollRequirement: 7,
      targeted: true,
      effectId: 'luckyBucky',
      effect:
        "Pull a card from another player's hand. If it is a Hero card, you may play it immediately.",
    }),
  ],
  [HERO_CLASSES.GUARDIAN]: [
    createHeroCard('Calming Voice', 'HtS-Base-043-Hero-Guardian.png', HERO_CLASSES.GUARDIAN, {
      rollRequirement: 9,
      effectId: 'calmingVoiceAntiSteal',
      effect: 'Hero cards in your party cannot be stolen until your next turn.',
    }),
    createHeroCard('Wise Shield', 'HtS-Base-044-Hero-Guardian.png', HERO_CLASSES.GUARDIAN, {
      rollRequirement: 6,
      effectId: 'wiseShield',
      effect: '+3 to all of your rolls until the end of your turn.',
    }),
    createHeroCard('Calming Voice', 'HtS-Base-045-Hero-Guardian.png', HERO_CLASSES.GUARDIAN, {
      rollRequirement: 8,
      effectId: 'calmingVoiceAntiDestroy',
      effect: 'Hero cards in your party cannot be destroyed until your next turn.',
    }),
    createHeroCard('Radiant Horn', 'HtS-Base-046-Hero-Guardian.png', HERO_CLASSES.GUARDIAN, {
      rollRequirement: 6,
      effectId: 'radiantHorn',
      effect: 'Search the discard pile for a modifier card and add it to your hand.',
    }),
    createHeroCard('Iron Resolve', 'HtS-Base-047-Hero-Guardian.png', HERO_CLASSES.GUARDIAN, {
      rollRequirement: 8,
      effectId: 'ironResolve',
      effect: 'Cards you played cannot be challenged for the rest of your turn.',
    }),
    createHeroCard('Holy Curselifter', 'HtS-Base-048-Hero-Guardian.png', HERO_CLASSES.GUARDIAN, {
      rollRequirement: 5,
      effectId: 'holyCurselifter',
      effect: 'Return a cursed Item card equipped to a hero card in your party to your hand.',
    }),
    createHeroCard('Vibrant Glow', 'HtS-Base-049-Hero-Guardian.png', HERO_CLASSES.GUARDIAN, {
      rollRequirement: 9,
      effectId: 'vibrantGlow',
      effect: '+5 to all of your rolls until the end of your turn.',
    }),
    createHeroCard('Guiding Light', 'HtS-Base-050-Hero-Guardian.png', HERO_CLASSES.GUARDIAN, {
      rollRequirement: 7,
      effectId: 'guidingLight',
      effect: 'Search the discard pile for a hero card and add it to your hand.',
    }),
  ],
  [HERO_CLASSES.RANGER]: [
    createHeroCard('051', 'HtS-Base-051-Hero-Ranger.png', HERO_CLASSES.RANGER, {
      rollRequirement: 5,
      targeted: true,
      effectId: 'sharpFox',
      effect: "Look at another player's hand and pull one card.",
    }),
    createHeroCard('052', 'HtS-Base-052-Hero-Ranger.png', HERO_CLASSES.RANGER, {
      rollRequirement: 8,
      effectId: 'wildshot',
      effect: 'Draw 3 cards and discard a card.',
    }),
    createHeroCard('053', 'HtS-Base-053-Hero-Ranger.png', HERO_CLASSES.RANGER, {
      rollRequirement: 10,
      effectId: 'wilyRed',
      effect: 'Draw cards until you have 7 cards in your hand.',
    }),
    createHeroCard('054', 'HtS-Base-054-Hero-Ranger.png', HERO_CLASSES.RANGER, {
      rollRequirement: 5,
      effectId: 'lookieRookie',
      effect: 'Search the discard pile for an item card and add it to your hand.',
    }),
    createHeroCard('055', 'HtS-Base-055-Hero-Ranger.png', HERO_CLASSES.RANGER, {
      rollRequirement: 7,
      effectId: 'bullseye',
      effect: 'Look at the top 3 cards of the deck. Add one to your hand, then return the other two to the top in any order.',
    }),
    createHeroCard('056', 'HtS-Base-056-Hero-Ranger.png', HERO_CLASSES.RANGER, {
      rollRequirement: 8,
      effectId: 'quickDraw',
      effect: 'Draw 2 cards. If at least one is an item card, you may play one of them immediately.',
    }),
    createHeroCard('057', 'HtS-Base-057-Hero-Ranger.png', HERO_CLASSES.RANGER, {
      rollRequirement: 6,
      effectId: 'hook',
      effect: 'Play an item card from your hand immediately and draw a card.',
    }),
    createHeroCard('058', 'HtS-Base-058-Hero-Ranger.png', HERO_CLASSES.RANGER, {
      rollRequirement: 9,
      heroTargeted: true,
      heroTargetScope: 'any',
      effectId: 'seriousGrey',
      effect: 'Destroy a hero card and draw a card.',
    }),
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
  { ...createCard('004', 'HtS-Base-004-Item.png', CARD_TYPES.ITEM), name: 'Bard Mask', effectId: 'changeClass', targetClass: HERO_CLASSES.BARD, effect: 'The equipped hero\'s class becomes Bard.' },
  { ...createCard('005', 'HtS-Base-005-Item.png', CARD_TYPES.ITEM), name: 'Ranger Mask', effectId: 'changeClass', targetClass: HERO_CLASSES.RANGER, effect: 'The equipped hero\'s class becomes Ranger.' },
  { ...createCard('006', 'HtS-Base-006-Item.png', CARD_TYPES.ITEM), name: 'Wizard Mask', effectId: 'changeClass', targetClass: HERO_CLASSES.WIZARD, effect: 'The equipped hero\'s class becomes Wizard.' },
  { ...createCard('007', 'HtS-Base-007-Item.png', CARD_TYPES.ITEM), name: 'Fighter Mask', effectId: 'changeClass', targetClass: HERO_CLASSES.FIGHTER, effect: 'The equipped hero\'s class becomes Fighter.' },
  { ...createCard('008', 'HtS-Base-008-Item.png', CARD_TYPES.ITEM), name: 'Guardian Mask', effectId: 'changeClass', targetClass: HERO_CLASSES.GUARDIAN, effect: 'The equipped hero\'s class becomes Guardian.' },
  { ...createCard('009', 'HtS-Base-009-Item.png', CARD_TYPES.ITEM), name: 'Thief Mask', effectId: 'changeClass', targetClass: HERO_CLASSES.THIEF, effect: 'The equipped hero\'s class becomes Thief.' },
  { ...createCard('010', 'HtS-Base-010-Item_2.png', CARD_TYPES.ITEM), name: 'Really Big Ring', effectId: 'bigRing', effect: '+2 to the roll.' },
  { ...createCard('011', 'HtS-Base-011-Item_2.png', CARD_TYPES.ITEM), name: 'Particularly Rusty Coin', effectId: 'rustyCoin', effect: 'If successfully roll to use, draw a card.' },
  { ...createCard('012', 'HtS-Base-012-Item.png', CARD_TYPES.ITEM), name: 'Decoy Doll', effectId: 'decoyDoll', effect: 'If equipped hero would be sacrificed or destroyed, instead remove Decoy Doll to the discard pile.' },
]

export const magicCards = [
  { ...createCard('013', 'HtS-Base-013-Magic_2.png', CARD_TYPES.MAGIC), name: 'Enchanted Spell', effectId: 'enchantedSpell', effect: '+2 to all rolls until the end of the turn.' },
  { ...createCard('014', 'HtS-Base-014-Magic.png', CARD_TYPES.MAGIC), name: 'Forceful Winds', effectId: 'forcefulWinds', effect: 'Return all equipped items to their respective owner\'s hand.' },
  { ...createCard('015', 'HtS-Base-015-Magic_2.png', CARD_TYPES.MAGIC), name: 'Entangling Trap', effectId: 'entanglingTrap', effect: 'Discard 2 cards, then steal a hero. If you cannot discard 2 cards, the steal does not occur.' },
  { ...createCard('016', 'HtS-Base-016-Magic_2.png', CARD_TYPES.MAGIC), name: 'Winds of Change', effectId: 'windsOfChange', effect: 'Return an equipped item to its owner\'s hand, then draw a card.' },
  { ...createCard('017', 'HtS-Base-017-Magic_2.png', CARD_TYPES.MAGIC), name: 'Critical Boost', effectId: 'criticalBoost', effect: 'Draw 3 cards, then discard 1 card.' },
  { ...createCard('018', 'HtS-Base-018-Magic_2.png', CARD_TYPES.MAGIC), name: 'Destructive Spell', effectId: 'destructiveSpell', effect: 'Discard 1 card, then destroy a hero.' },
  { ...createCard('019', 'HtS-Base-019-Magic.png', CARD_TYPES.MAGIC), name: 'Call to the Fallen', effectId: 'callToFallen', effect: 'Search the discard pile for a Hero card and add it to your hand.' },
  { ...createCard('020', 'HtS-Base-020-Magic.png', CARD_TYPES.MAGIC), name: 'Forced Exchange', effectId: 'forcedExchange', effect: 'Swap one of your heroes with an opponent\'s hero.' },
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

export const cursedItemCards = [
  {
    ...createCard('001', 'HtS-Base-001-Item.png', CARD_TYPES.CURSED_ITEM),
    name: 'Sealing Key',
    effectId: 'sealingKey',
    effect: 'You cannot use the equipped hero card\'s effect.',
  },
  {
    ...createCard('002', 'HtS-Base-002-Item_2.png', CARD_TYPES.CURSED_ITEM),
    name: 'Curse of the Snake\'s Eyes',
    effectId: 'snakesEyesCurse',
    effect: '-2 to that hero\'s roll.',
  },
  {
    ...createCard('003', 'HtS-Base-003-Item.png', CARD_TYPES.CURSED_ITEM),
    name: 'Suspiciously Shiny Coin',
    effectId: 'shinyCoinCurse',
    effect: 'If successfully roll to use this equipped hero\'s effect, discard a card.',
  },
]

/** Item / Magic / Modifier / Challenge / CursedItem（玩家抽牌库组成部分） */
export const actionCards = [
  ...itemCards,
  ...cursedItemCards,
  ...magicCards,
  ...modifierCards,
  ...challengeCards,
]
