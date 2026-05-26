import { useEffect, useState } from 'react'
import ActiveMonsters from './components/ActiveMonsters.jsx'
import CardDisplay from './components/CardDisplay.jsx'
import DebugPanel from './components/DebugPanel.jsx'
import DeckPile from './components/DeckPile.jsx'
import CardPullDialog from './components/CardPullDialog.jsx'
import EffectTargetDialog from './components/EffectTargetDialog.jsx'
import ModifierChoiceDialog from './components/ModifierChoiceDialog.jsx'
import ModifierTargetDialog from './components/ModifierTargetDialog.jsx'
import PartyBoard from './components/PartyBoard.jsx'
import RollFeedback from './components/RollFeedback.jsx'
import SkillConfirmDialog from './components/SkillConfirmDialog.jsx'
import { CARD_BACKS, CARD_TYPES } from './data/cardUtils.js'
import {
  debugDrawCardToHand,
  loadDebugModeEnabled,
  saveDebugModeEnabled,
} from './debugMode.js'
import { getModifierEffect } from './data/modifierEffects.js'
import { canDrawFromMainDeck } from './deckHelpers.js'
import {
  ATTACK_MONSTER_ACTION_NAME,
  RESTOCK_HAND_ACTION_NAME,
  attackMonster,
  confirmQiBearSelection,
  discardForPendingDiscard,
  passPendingDiscard,
  drawCard,
  endTurn,
  getChallengeAttackerIndex,
  isChallengeWindowActive,
  isEffectTargetSelectionActive,
  isEffectHeroTargetSelectionActive,
  isModifierPhaseActive,
  isPartyClickableForSelection,
  isPartyClickableForHeroTargetSelection,
  isPendingCardPullActive,
  isPendingDiscardActive,
  isPendingStagedCardPickActive,
  isPendingHeroSelectionActive,
  isPendingQiBearSelectionActive,
  isPlayableFromHand,
  pickStagedCard,
  passChallengeWindow,
  passModifierPhaseWithResult,
  playCardFromHand,
  playChallengeCard,
  playItemOnHero,
  playModifierOnPendingRoll,
  restockHand,
  resolveCardPull,
  selectEffectTarget,
  selectEffectHeroTarget,
  selectHeroForPendingAction,
  setQiBearCount,
  toggleQiBearHeroTarget,
  triggerHeroSkill,
} from './gameActions.js'
import {
  ATTACK_MONSTER_AP_COST,
  CHALLENGE_WINDOW_MS,
  DRAW_CARD_AP_COST,
  MODIFIER_WINDOW_MS,
  RESTOCK_HAND_AP_COST,
  initGame,
} from './gameState.js'
import './App.css'

function App() {
  const [game, setGame] = useState(() => initGame(3))
  const [skillDialog, setSkillDialog] = useState(null)
  const [modifierChoice, setModifierChoice] = useState(null)
  const [modifierTargetChoice, setModifierTargetChoice] = useState(null)
  const [modifierSecondsLeft, setModifierSecondsLeft] = useState(0)
  const [challengeSecondsLeft, setChallengeSecondsLeft] = useState(0)
  const [displayRoll, setDisplayRoll] = useState(null)
  const [itemEquipInstanceId, setItemEquipInstanceId] = useState(
    /** @type {string | null} */ (null),
  )
  const [debugMode, setDebugMode] = useState(() => loadDebugModeEnabled())
  const [debugMessage, setDebugMessage] = useState(
    /** @type {string | null} */ (null),
  )

  const currentPlayer = game.players[game.currentPlayerIndex]
  const modifierPhase = isModifierPhaseActive(game)
  const challengePhase = isChallengeWindowActive(game)
  const targetSelectionPhase = isEffectTargetSelectionActive(game)
  const heroTargetSelectionPhase = isEffectHeroTargetSelectionActive(game)
  const cardPullPhase = isPendingCardPullActive(game)
  const cardPull = game.pendingCardPull
  const pendingDiscardPhase = isPendingDiscardActive(game)
  const stagedCardPickPhase = isPendingStagedCardPickActive(game)
  const stagedCardPick = game.pendingStagedCardPick
  const heroSelectionPhase = isPendingHeroSelectionActive(game)
  const heroSelection = game.pendingHeroSelection
  const qiBearPhase = isPendingQiBearSelectionActive(game)
  const qiBearSel = game.pendingQiBearSelection
  const interruptPhase =
    modifierPhase ||
    challengePhase ||
    targetSelectionPhase ||
    heroTargetSelectionPhase ||
    cardPullPhase ||
    pendingDiscardPhase ||
    stagedCardPickPhase ||
    heroSelectionPhase ||
    qiBearPhase
  const canPlay = game.actionPoints > 0 && !interruptPhase && !itemEquipInstanceId
  const canDraw =
    !interruptPhase &&
    !itemEquipInstanceId &&
    game.actionPoints >= DRAW_CARD_AP_COST &&
    canDrawFromMainDeck(game)
  const canRestock =
    !interruptPhase &&
    !itemEquipInstanceId &&
    game.actionPoints >= RESTOCK_HAND_AP_COST
  const canAttackMonster =
    !interruptPhase &&
    !itemEquipInstanceId &&
    game.actionPoints >= ATTACK_MONSTER_AP_COST
  const topDiscard = game.discardPile[game.discardPile.length - 1]
  const challengeAttackerIndex = getChallengeAttackerIndex(game)
  const challengeAttacker =
    challengeAttackerIndex >= 0 ? game.players[challengeAttackerIndex] : null
  const stagedCard = game.pendingChallenge?.stagedPlay?.card

  const rollToShow = game.pendingRoll ?? displayRoll

  const challengeAttackerName =
    rollToShow?.rollType === 'challenge' && rollToShow.attackerIndex !== undefined
      ? game.players[rollToShow.attackerIndex]?.name
      : currentPlayer.name

  const challengeChallengerName =
    rollToShow?.rollType === 'challenge' &&
    rollToShow.challengerIndex !== undefined
      ? game.players[rollToShow.challengerIndex]?.name
      : 'Challenger'

  const effectSel = game.pendingEffectTargetSelection
  const effectSourcePlayer = effectSel
    ? game.players[effectSel.sourcePlayerIndex]
    : null
  const targetOptions = effectSel
    ? game.players
        .map((p, i) => ({ playerIndex: i, label: p.name }))
        .filter((opt) => opt.playerIndex !== effectSel.sourcePlayerIndex)
    : []

  const pendingDiscard = game.pendingDiscard
  const discardingPlayer = pendingDiscard
    ? game.players[pendingDiscard.playerIndex]
    : null

  useEffect(() => {
    if (!game.pendingChallenge) {
      return undefined
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChallengeSecondsLeft(Math.ceil(CHALLENGE_WINDOW_MS / 1000))

    const interval = window.setInterval(() => {
      setChallengeSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    const timeout = window.setTimeout(() => {
      setGame((prev) => {
        if (!prev.pendingChallenge) {
          return prev
        }
        const { game: nextGame, diceRoll } = passChallengeWindow(prev)
        if (diceRoll) {
          setDisplayRoll(diceRoll)
        }
        return nextGame
      })
    }, CHALLENGE_WINDOW_MS)

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [game.pendingChallenge])

  useEffect(() => {
    if (!game.pendingRoll) {
      return undefined
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayRoll(game.pendingRoll)
    setModifierSecondsLeft(Math.ceil(MODIFIER_WINDOW_MS / 1000))

    const interval = window.setInterval(() => {
      setModifierSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    const timeout = window.setTimeout(() => {
      setGame((prev) => {
        if (!prev.pendingRoll) {
          return prev
        }
        const { game: nextGame, diceRoll } = passModifierPhaseWithResult(prev)
        if (diceRoll) {
          setDisplayRoll(diceRoll)
        }
        return nextGame
      })
    }, MODIFIER_WINDOW_MS)

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [game.pendingRoll])

  useEffect(() => {
    if (game.pendingRoll || !displayRoll) {
      return undefined
    }
    const timer = window.setTimeout(() => setDisplayRoll(null), 3000)
    return () => window.clearTimeout(timer)
  }, [game.pendingRoll, displayRoll])

  function handlePlayCard(card, playerIndex) {
    if (pendingDiscardPhase) {
      if (playerIndex !== pendingDiscard.playerIndex) {
        return
      }
      const { game: nextGame, error } = discardForPendingDiscard(
        game,
        playerIndex,
        card.instanceId,
      )
      if (error) {
        window.alert(error)
        return
      }
      setGame(nextGame)
      return
    }

    if (targetSelectionPhase) {
      return
    }

    if (challengePhase) {
      if (card.type === CARD_TYPES.CHALLENGE) {
        handleChallengeClick(card, playerIndex)
      }
      return
    }

    if (modifierPhase) {
      handleModifierClick(card, playerIndex)
      return
    }

    if (playerIndex !== game.currentPlayerIndex) {
      return
    }

    if (card.type === CARD_TYPES.ITEM) {
      setItemEquipInstanceId(card.instanceId)
      return
    }

    const { game: nextGame, error } = playCardFromHand(game, card.instanceId)
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
    setItemEquipInstanceId(null)
  }

  function handleChallengeClick(card, playerIndex) {
    const { game: nextGame, pendingRoll, error } = playChallengeCard(
      game,
      playerIndex,
      card.instanceId,
    )
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
    if (pendingRoll) {
      setDisplayRoll(pendingRoll)
    }
  }

  function handlePassChallenge() {
    const { game: nextGame, diceRoll, error } = passChallengeWindow(game)
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
    if (diceRoll) {
      setDisplayRoll(diceRoll)
    }
  }

  function handleHeroEquipClick(hero) {
    if (!itemEquipInstanceId) {
      return
    }
    const { game: nextGame, error } = playItemOnHero(
      game,
      itemEquipInstanceId,
      hero.instanceId,
    )
    setItemEquipInstanceId(null)
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
  }

  function handleSelectEffectTarget(targetPlayerIndex) {
    const { game: nextGame, pendingRoll, error } = selectEffectTarget(
      game,
      targetPlayerIndex,
    )
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
    if (pendingRoll) {
      setDisplayRoll(pendingRoll)
    }
  }

  function applyModifier(playerIndex, instanceId, choiceIndex, challengeTarget) {
    const { game: nextGame, pendingRoll, error } = playModifierOnPendingRoll(
      game,
      playerIndex,
      instanceId,
      choiceIndex,
      challengeTarget,
    )
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
    if (pendingRoll) {
      setDisplayRoll(pendingRoll)
    }
  }

  function handleModifierClick(card, playerIndex) {
    const effect = card.modifierEffect ?? getModifierEffect(card.id)
    if (!effect) {
      return
    }

    if (game.pendingRoll?.rollType === 'challenge') {
      setModifierTargetChoice({
        playerIndex,
        instanceId: card.instanceId,
        cardName: card.name,
        effect,
      })
      return
    }

    if (effect.type === 'choice') {
      setModifierChoice({
        playerIndex,
        instanceId: card.instanceId,
        cardName: card.name,
        options: effect.options,
      })
      return
    }

    applyModifier(playerIndex, card.instanceId, undefined, undefined)
  }

  function handleModifierTarget(target) {
    if (!modifierTargetChoice) {
      return
    }

    const { playerIndex, instanceId, cardName, effect } = modifierTargetChoice
    setModifierTargetChoice(null)

    if (effect.type === 'choice') {
      setModifierChoice({
        playerIndex,
        instanceId,
        cardName,
        options: effect.options,
        challengeTarget: target,
      })
      return
    }

    applyModifier(playerIndex, instanceId, undefined, target)
  }

  function handleModifierChoice(index) {
    if (!modifierChoice) {
      return
    }
    applyModifier(
      modifierChoice.playerIndex,
      modifierChoice.instanceId,
      index,
      modifierChoice.challengeTarget,
    )
    setModifierChoice(null)
  }

  function handlePassModifier() {
    const { game: nextGame, diceRoll } = passModifierPhaseWithResult(game)
    setGame(nextGame)
    setModifierChoice(null)
    setModifierTargetChoice(null)
    if (diceRoll) {
      setDisplayRoll(diceRoll)
    }
  }

  function handleSetQiBearCount(count) {
    const { game: nextGame, error } = setQiBearCount(game, game.currentPlayerIndex, count)
    if (error) { window.alert(error); return }
    setGame(nextGame)
  }

  function handleToggleQiBearTarget(heroInstanceId) {
    const { game: nextGame, error } = toggleQiBearHeroTarget(game, game.currentPlayerIndex, heroInstanceId)
    if (error) { window.alert(error); return }
    setGame(nextGame)
  }

  function handleConfirmQiBearSelection() {
    const { game: nextGame, pendingRoll, error } = confirmQiBearSelection(game, game.currentPlayerIndex)
    if (error) { window.alert(error); return }
    setGame(nextGame)
    if (pendingRoll) { setDisplayRoll(pendingRoll) }
  }

  function handlePassPendingDiscard() {
    const { game: nextGame, error } = passPendingDiscard(
      game,
      game.currentPlayerIndex,
    )
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
  }

  function handlePickStagedCard(instanceId) {
    const { game: nextGame, error } = pickStagedCard(
      game,
      game.currentPlayerIndex,
      instanceId,
    )
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
  }

  function handleDrawCard() {
    const { game: nextGame, error } = drawCard(game)
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
  }

  function handleToggleDebugMode() {
    setDebugMode((prev) => {
      const next = !prev
      saveDebugModeEnabled(next)
      if (!next) {
        setDebugMessage(null)
      }
      return next
    })
  }

  function handleDebugDraw(cardQuery, source) {
    const { game: nextGame, card, error } = debugDrawCardToHand(game, {
      cardQuery,
      source,
    })
    if (error) {
      setDebugMessage(error)
      return
    }
    setGame(nextGame)
    setDebugMessage(
      `Added ${card?.name ?? cardQuery} from ${
        source === 'discardPile' ? 'discard pile' : 'main deck'
      }.`,
    )
  }

  function handleRestockHand() {
    const { game: nextGame, error } = restockHand(game)
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
  }

  function handleAttackMonster(monster) {
    const { game: nextGame, diceRoll, error } = attackMonster(
      game,
      monster.instanceId,
    )
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
    if (diceRoll) {
      setDisplayRoll(diceRoll)
    }
  }

  function handleEndTurn() {
    setGame((prev) => endTurn(prev))
    setSkillDialog(null)
    setModifierChoice(null)
    setModifierTargetChoice(null)
    setDisplayRoll(null)
    setItemEquipInstanceId(null)
  }

  function handleResolveCardPull(instanceId) {
    const { game: nextGame, error } = resolveCardPull(game, instanceId)
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
  }

  function handleHeroSkillClick(hero, partyOwnerIndex) {
    if (qiBearPhase) {
      handleToggleQiBearTarget(hero.instanceId)
      return
    }

    if (heroTargetSelectionPhase) {
      const { game: nextGame, pendingRoll, error } = selectEffectHeroTarget(game, hero.instanceId)
      if (error) {
        window.alert(error)
        return
      }
      setGame(nextGame)
      if (pendingRoll) setDisplayRoll(pendingRoll)
      return
    }

    if (heroSelectionPhase) {
      const { game: nextGame, error } = selectHeroForPendingAction(
        game,
        partyOwnerIndex,
        hero.instanceId,
      )
      if (error) {
        window.alert(error)
        return
      }
      setGame(nextGame)
      return
    }

    if (!canPlay) return
    if (partyOwnerIndex !== game.currentPlayerIndex) return

    const slot = currentPlayer.partySlots.find(
      (s) => s?.hero.instanceId === hero.instanceId,
    )
    if (!slot || slot.skillUsedThisTurn) {
      return
    }
    setSkillDialog({
      heroInstanceId: hero.instanceId,
      heroName: hero.name,
    })
  }

  function handleConfirmSkill() {
    if (!skillDialog) {
      return
    }
    const { game: nextGame, diceRoll, error } = triggerHeroSkill(
      game,
      skillDialog.heroInstanceId,
    )
    if (error) {
      window.alert(error)
      setSkillDialog(null)
      return
    }
    setGame(nextGame)
    if (diceRoll) {
      setDisplayRoll(diceRoll)
    }
    setSkillDialog(null)
  }

  return (
    <div className="app">
      <RollFeedback
        pendingRoll={rollToShow}
        modifierPhaseActive={modifierPhase}
        challengePhaseActive={challengePhase && !rollToShow}
        secondsLeft={modifierPhase ? modifierSecondsLeft : challengeSecondsLeft}
        attackerName={challengeAttackerName}
        challengerName={challengeChallengerName}
      />

      {challengePhase && !modifierPhase && (
        <div className="modifier-phase-bar challenge-phase-bar">
          <p className="challenge-phase-bar__text">
            <strong>{challengeAttacker?.name ?? currentPlayer.name}</strong> played{' '}
            <strong>{stagedCard?.name ?? 'a card'}</strong>.{' '}
            Any opponent may play a Challenge card — or{' '}
            <strong>{challengeAttacker?.name ?? currentPlayer.name}</strong> may Pass.
          </p>
          <button
            type="button"
            className="game-actions__btn game-actions__btn--primary"
            onClick={handlePassChallenge}
          >
            Pass (no challenge)
          </button>
        </div>
      )}

      {modifierPhase && (
        <div className="modifier-phase-bar">
          <button
            type="button"
            className="game-actions__btn game-actions__btn--primary"
            onClick={handlePassModifier}
          >
            Pass
          </button>
        </div>
      )}

      {stagedCardPickPhase && stagedCardPick && (
        <div className="modifier-phase-bar challenge-phase-bar">
          <p className="challenge-phase-bar__text">
            <strong>
              {game.players[stagedCardPick.sourcePlayerIndex]?.name}
            </strong>
            : choose 1 staged card from{' '}
            <strong>{stagedCardPick.sourceLabel}</strong> to add to your hand.
          </p>
          <div className="card-row staged-card-row">
            {stagedCardPick.stagedCards.map((card) => (
              <button
                key={card.instanceId}
                type="button"
                className="hand-card hand-card--playable hand-card--staged-pick"
                disabled={
                  game.currentPlayerIndex !== stagedCardPick.sourcePlayerIndex
                }
                onClick={() => handlePickStagedCard(card.instanceId)}
              >
                <CardDisplay card={card} faceUp={card.faceUp ?? true} />
              </button>
            ))}
          </div>
        </div>
      )}

      {qiBearPhase && qiBearSel && (
        <div className="modifier-phase-bar challenge-phase-bar">
          <p className="challenge-phase-bar__text">
            <strong>Qi Bear</strong>: choose how many cards to discard (0–{qiBearSel.maxCount}),
            then click that many heroes to destroy.
            Selected: <strong>{qiBearSel.heroTargets.length}</strong> / {qiBearSel.count}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Discard count:</span>
            {Array.from({ length: qiBearSel.maxCount + 1 }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`game-actions__btn${qiBearSel.count === i ? ' game-actions__btn--primary' : ''}`}
                onClick={() => handleSetQiBearCount(i)}
              >
                {i}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="game-actions__btn game-actions__btn--primary"
            disabled={qiBearSel.heroTargets.length !== qiBearSel.count}
            onClick={handleConfirmQiBearSelection}
          >
            Confirm → Roll
          </button>
        </div>
      )}

      {heroTargetSelectionPhase && game.pendingEffectHeroTargetSelection && (
        <div className="modifier-phase-bar challenge-phase-bar">
          <p className="challenge-phase-bar__text">
            <strong>{game.pendingEffectHeroTargetSelection.heroName}</strong>
            : Choose a hero to destroy — click a hero on any party below.
          </p>
        </div>
      )}

      <CardPullDialog
        open={cardPullPhase && cardPull !== null}
        sourceLabel={cardPull?.sourceLabel ?? ''}
        targetPlayerName={
          cardPull !== null
            ? (game.players[cardPull.targetPlayerIndex]?.name ?? 'Opponent')
            : ''
        }
        cards={
          cardPull !== null
            ? (game.players[cardPull.targetPlayerIndex]?.hand ?? [])
            : []
        }
        isBonusPull={cardPull?.isBonusPull ?? false}
        bonusTriggerHint={
          cardPull?.bonusTriggerType === 'Challenge'
            ? "If it's a Challenge card, pull another one!"
            : cardPull?.bonusTriggerType === 'Hero'
              ? "If it's a Hero card, pull another one!"
              : undefined
        }
        onPick={handleResolveCardPull}
      />

      {pendingDiscardPhase && pendingDiscard && discardingPlayer && (
        <div className="modifier-phase-bar challenge-phase-bar">
          <p className="challenge-phase-bar__text">
            <strong>{discardingPlayer.name}</strong>:
            {pendingDiscard.kind === 'opponentEach' ? (
              <>
                {' '}
                discard 1 card for{' '}
                <strong>{pendingDiscard.sourceLabel}</strong> (staged, not to
                discard pile yet). Click a card in your hand.
              </>
            ) : pendingDiscard.kind === 'opponentEachPile' ? (
              <>
                {' '}
                discard 1 card for{' '}
                <strong>{pendingDiscard.sourceLabel}</strong> (Fighter in your
                party). Click a card in your hand.
              </>
            ) : pendingDiscard.optional ? (
              <>
                {' '}
                discard up to <strong>{pendingDiscard.count}</strong> more card
                {pendingDiscard.count === 1 ? '' : 's'} (from{' '}
                <strong>{pendingDiscard.sourceLabel}</strong>). Click a card in
                your hand, or Pass to stop.
              </>
            ) : (
              <>
                {' '}
                discard <strong>{pendingDiscard.count}</strong> card
                {pendingDiscard.count === 1 ? '' : 's'} (from{' '}
                <strong>{pendingDiscard.sourceLabel}</strong>). Click a card in
                your hand.
              </>
            )}
          </p>
          {pendingDiscard.optional &&
            game.currentPlayerIndex === pendingDiscard.playerIndex && (
              <button
                type="button"
                className="game-actions__btn game-actions__btn--primary"
                onClick={handlePassPendingDiscard}
              >
                Pass (stop discarding)
              </button>
            )}
        </div>
      )}

      <SkillConfirmDialog
        heroName={skillDialog?.heroName ?? ''}
        open={skillDialog !== null}
        onConfirm={handleConfirmSkill}
        onCancel={() => setSkillDialog(null)}
      />

      <ModifierTargetDialog
        cardName={modifierTargetChoice?.cardName ?? ''}
        attackerLabel={`${challengeAttackerName}'s roll`}
        challengerLabel={`${challengeChallengerName}'s roll`}
        open={modifierTargetChoice !== null}
        onChoose={handleModifierTarget}
        onCancel={() => setModifierTargetChoice(null)}
      />

      <ModifierChoiceDialog
        cardName={modifierChoice?.cardName ?? ''}
        options={modifierChoice?.options ?? []}
        open={modifierChoice !== null}
        onChoose={handleModifierChoice}
        onCancel={() => setModifierChoice(null)}
      />

      <EffectTargetDialog
        open={targetSelectionPhase && effectSel !== null}
        heroName={effectSel?.heroName ?? ''}
        sourcePlayerName={effectSourcePlayer?.name ?? ''}
        options={targetOptions}
        onChoose={handleSelectEffectTarget}
      />

      <header className="game-header">
        <h1>Here to Slay</h1>
        <p className="game-header__status">
          Current player: <strong>{currentPlayer.name}</strong>
          {' · '}
          Action points: <strong>{game.actionPoints}</strong> / 3
          {!canPlay && !interruptPhase && !itemEquipInstanceId && (
            <span className="game-header__warn"> (Not enough action points)</span>
          )}
          {itemEquipInstanceId && (
            <span className="game-header__warn">
              {' '}
              — Click a hero on your party to equip the item (or click the item
              again to cancel)
            </span>
          )}
          {challengePhase && !modifierPhase && (
            <span className="game-header__warn"> — Challenge window</span>
          )}
          {modifierPhase && (
            <span className="game-header__warn"> — Modifier window (all players)</span>
          )}
          {targetSelectionPhase && (
            <span className="game-header__warn">
              {' '}
              — {effectSourcePlayer?.name ?? 'Source'}: pick a target
            </span>
          )}
          {heroTargetSelectionPhase && game.pendingEffectHeroTargetSelection && (
            <span className="game-header__warn">
              {' '}
              —{' '}
              {game.players[game.pendingEffectHeroTargetSelection.sourcePlayerIndex]
                ?.name ?? 'Player'}
              : pick a hero to destroy
            </span>
          )}
          {pendingDiscardPhase && (
            <span className="game-header__warn">
              {' '}
              — {discardingPlayer?.name ?? 'Player'}
              {pendingDiscard?.kind === 'opponentEach' ||
              pendingDiscard?.kind === 'opponentEachPile'
                ? ` must discard 1 (${pendingDiscard?.sourceLabel})`
                : pendingDiscard?.optional
                  ? ` may discard up to ${pendingDiscard.count} (or Pass)`
                  : ` must discard ${pendingDiscard?.count}`}
            </span>
          )}
          {stagedCardPickPhase && stagedCardPick && (
            <span className="game-header__warn">
              {' '}
              — {game.players[stagedCardPick.sourcePlayerIndex]?.name}: pick 1
              staged card
            </span>
          )}
          {heroSelectionPhase && heroSelection && (
            <span className="game-header__warn">
              {' '}
              — {game.players[heroSelection.sourcePlayerIndex]?.name}: pick a
              hero ({heroSelection.scope === 'own'
                ? 'your party'
                : heroSelection.scope === 'opponents'
                  ? "an opponent's party"
                  : 'any party'}) to {heroSelection.action} ({heroSelection.sourceLabel})
            </span>
          )}
        </p>
        <div className="game-actions">
          <button
            type="button"
            className="game-actions__btn"
            onClick={handleDrawCard}
            disabled={!canDraw}
            title={`Costs ${DRAW_CARD_AP_COST} AP`}
          >
            Draw card ({DRAW_CARD_AP_COST} AP)
          </button>
          <button
            type="button"
            className="game-actions__btn"
            onClick={handleRestockHand}
            disabled={!canRestock}
            title={`Costs ${RESTOCK_HAND_AP_COST} AP`}
          >
            {RESTOCK_HAND_ACTION_NAME} ({RESTOCK_HAND_AP_COST} AP)
          </button>
          <button
            type="button"
            className="game-actions__btn game-actions__btn--primary"
            onClick={handleEndTurn}
            disabled={interruptPhase}
          >
            End turn
          </button>
          <button
            type="button"
            className={`game-actions__btn debug-toggle${debugMode ? ' debug-toggle--on' : ''}`}
            onClick={handleToggleDebugMode}
            title="Toggle debug tools (saved in this browser)"
          >
            Debug {debugMode ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      {debugMode && (
        <DebugPanel onDraw={handleDebugDraw} lastMessage={debugMessage} />
      )}

      <div className="deck-zones">
        <section className="game-section game-section--deck">
          <h2>Main deck</h2>
          <DeckPile
            count={game.mainDeck.length}
            backImageUrl={
              game.mainDeck[0]?.backImageUrl ?? CARD_BACKS.MAIN
            }
            label="Main deck"
            variant="main"
          />
          {game.discardPile.length > 0 && (
            <p className="deck-zones__recycle-hint">
              Discard pile: {game.discardPile.length} (reshuffles when deck is empty)
            </p>
          )}
        </section>

        <section className="game-section game-section--deck">
          <h2>Monster deck</h2>
          <DeckPile
            count={game.monsterDeck.length}
            backImageUrl={
              game.monsterDeck[0]?.backImageUrl ?? CARD_BACKS.MONSTER
            }
            label="Monster deck"
            variant="monster"
          />
        </section>
      </div>

      <section className="game-section">
        <div className="battlefield">
          <div className="battlefield__monsters">
            <h2>Active monsters</h2>
            <p className="game-section__hint">
              {canAttackMonster
                ? `Click a monster to ${ATTACK_MONSTER_ACTION_NAME} (${ATTACK_MONSTER_AP_COST} AP, then modifier window)`
                : 'Attack Monster costs 2 AP during your turn'}
            </p>
            <ActiveMonsters
              monsters={game.activeMonsters}
              onAttack={handleAttackMonster}
              canAttack={canAttackMonster}
            />
          </div>
          <div className="battlefield__discard">
            <h2>Discard pile</h2>
            {game.discardPile.length === 0 ? (
              <p className="discard-pile__empty">Empty</p>
            ) : (
              <div className="discard-pile">
                <CardDisplay card={topDiscard} faceUp />
                <span className="discard-pile__count">
                  {game.discardPile.length}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {game.players.map((player, playerIndex) => {
        const isCurrent = playerIndex === game.currentPlayerIndex
        const partyClickableForSelection =
          heroSelectionPhase &&
          isPartyClickableForSelection(game, playerIndex)
        const partyClickableForHeroTarget =
          heroTargetSelectionPhase &&
          isPartyClickableForHeroTargetSelection(game, playerIndex)
        const selectionMode = partyClickableForSelection
          ? heroSelection?.action ?? null
          : null

        return (
          <section key={`player-${player.id}`} className="game-section">
            <h2>
              {player.name}
              {isCurrent && ' (current)'}
              {partyClickableForSelection &&
                ` — pick a hero to ${selectionMode}`}
              {partyClickableForHeroTarget &&
                ` — pick a hero to destroy`}
            </h2>

            <PartyBoard
              leader={player.leader}
              leaderItems={player.leaderItems ?? []}
              partySlots={player.partySlots}
              slainMonsters={player.slainMonsters}
              onHeroSkillClick={(hero) => handleHeroSkillClick(hero, playerIndex)}
              heroSkillClickable={
                (isCurrent && canPlay) || partyClickableForSelection || partyClickableForHeroTarget
              }
              allowHeroClickWhenSkillUsed={partyClickableForSelection || partyClickableForHeroTarget}
              onHeroEquipClick={
                isCurrent && itemEquipInstanceId !== null && !heroSelectionPhase
                  ? handleHeroEquipClick
                  : undefined
              }
              heroEquipSelectable={
                isCurrent &&
                itemEquipInstanceId !== null &&
                !heroSelectionPhase
              }
              selectionMode={selectionMode}
              pendingDestroyMode={qiBearPhase || partyClickableForHeroTarget}
              pendingDestroyIds={game.pendingDestroyTargets}
            />

            <h3 className="hand-heading">Hand</h3>
            <p className="game-section__hint">
              {heroSelectionPhase && heroSelection
                ? playerIndex === heroSelection.sourcePlayerIndex
                  ? `Pick a hero on ${
                      heroSelection.scope === 'own'
                        ? 'your party'
                        : heroSelection.scope === 'opponents'
                          ? "an opponent's party"
                          : 'any party'
                    } to ${heroSelection.action}.`
                  : `Waiting for ${
                      game.players[heroSelection.sourcePlayerIndex]?.name
                    } to pick a hero.`
                : stagedCardPickPhase && stagedCardPick
                  ? playerIndex === stagedCardPick.sourcePlayerIndex
                    ? 'Choose 1 staged card above to add to your hand.'
                    : `Waiting for ${game.players[stagedCardPick.sourcePlayerIndex]?.name} to pick a staged card.`
                  : pendingDiscardPhase
                    ? playerIndex === pendingDiscard.playerIndex
                      ? pendingDiscard.kind === 'opponentEach'
                        ? `Discard 1 card for ${pendingDiscard.sourceLabel} (staged).`
                        : pendingDiscard.kind === 'opponentEachPile'
                          ? `Discard 1 card for ${pendingDiscard.sourceLabel} (Fighter party).`
                          : pendingDiscard.optional
                          ? `Discard up to ${pendingDiscard.count} more card${pendingDiscard.count === 1 ? '' : 's'} (click below or Pass).`
                          : `Discard ${pendingDiscard.count} card${pendingDiscard.count === 1 ? '' : 's'}: click cards below.`
                      : 'Waiting for opponent to discard.'
                    : heroTargetSelectionPhase
                      ? playerIndex === game.pendingEffectHeroTargetSelection?.sourcePlayerIndex
                        ? 'Pick a hero to destroy (click on the party above).'
                        : 'Waiting for opponent to pick a hero.'
                      : targetSelectionPhase
                        ? playerIndex === effectSel.sourcePlayerIndex
                          ? 'Choose which player receives your hero effect.'
                          : 'Waiting for opponent to choose a target.'
                        : modifierPhase
                          ? game.pendingRoll?.rollType === 'challenge'
                            ? 'Any player: play Modifiers and choose which roll to change, or Pass.'
                            : 'Any player: click Modifiers to change the roll. Play as many as you want, or Pass.'
                          : challengePhase
                            ? playerIndex !== challengeAttackerIndex
                              ? 'Play a Challenge card to oppose this play, or wait.'
                              : 'Waiting for opponents to challenge — or click Pass above.'
                            : playerIndex === game.currentPlayerIndex
                              ? 'Hero / Magic (1 AP, then challenge). Item: click item, then a hero. Draw (1 AP). Restock (3 AP).'
                              : 'Waiting for your turn.'}
            </p>
            <div className="card-row hand-row">
              {player.hand.length === 0 ? (
                <p className="hand-empty">Empty hand</p>
              ) : (
                player.hand.map((card) => {
                  const playable = isPlayableFromHand(card, game, playerIndex)
                  const enabled = pendingDiscardPhase
                    ? playable
                    : heroTargetSelectionPhase
                      ? false
                      : targetSelectionPhase
                        ? false
                        : modifierPhase
                          ? playable
                          : challengePhase
                            ? playable
                            : playerIndex === game.currentPlayerIndex &&
                              (itemEquipInstanceId
                                ? itemEquipInstanceId === card.instanceId
                                : canPlay && playable)

                  const isSelectedItem =
                    itemEquipInstanceId === card.instanceId

                  return (
                    <button
                      key={card.instanceId}
                      type="button"
                      className={`hand-card${enabled ? ' hand-card--playable' : ''}${modifierPhase && card.type === CARD_TYPES.MODIFIER ? ' hand-card--modifier' : ''}${challengePhase && card.type === CARD_TYPES.CHALLENGE ? ' hand-card--challenge' : ''}${pendingDiscardPhase && enabled ? ' hand-card--discard' : ''}${isSelectedItem ? ' hand-card--selected' : ''}`}
                      onClick={() => {
                        if (
                          !pendingDiscardPhase &&
                          itemEquipInstanceId &&
                          card.instanceId === itemEquipInstanceId
                        ) {
                          setItemEquipInstanceId(null)
                          return
                        }
                        handlePlayCard(card, playerIndex)
                      }}
                      disabled={!enabled && !isSelectedItem}
                    >
                      <CardDisplay card={card} faceUp={card.faceUp ?? true} />
                    </button>
                  )
                })
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default App
