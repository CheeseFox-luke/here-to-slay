import { useEffect, useRef, useState } from 'react'
import ActiveMonsters from './components/ActiveMonsters.jsx'
import CardDisplay from './components/CardDisplay.jsx'
import CompactPlayerPanel from './components/CompactPlayerPanel.jsx'
import DebugPanel from './components/DebugPanel.jsx'
import DeckPile from './components/DeckPile.jsx'
import CardPullDialog from './components/CardPullDialog.jsx'
import EffectTargetDialog from './components/EffectTargetDialog.jsx'
import ModifierChoiceDialog from './components/ModifierChoiceDialog.jsx'
import ModifierTargetDialog from './components/ModifierTargetDialog.jsx'
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
  confirmHeroPlayChoice,
  confirmQiBearSelection,
  declineHeroPlayChoice,
  discardForPendingDiscard,
  giveForPendingGive,
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
  isPendingGiveActive,
  isPendingHeroFromHandPlayActive,
  isPendingHeroPlayChoiceActive,
  isPendingStagedCardPickActive,
  isPendingHeroSelectionActive,
  isPendingQiBearSelectionActive,
  isPlayableFromHand,
  pickStagedCard,
  passChallengeWindow,
  passModifierPhaseWithResult,
  playCardFromHand,
  playChallengeCard,
  playHeroFromHandForPending,
  playItemOnHero,
  playCursedItemOnHero,
  resolveWindsOfChange,
  isPendingItemSelectionActive,
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
import { openRoomChannel, saveGameState, loadGameState } from './roomSync.js'
import './App.css'

function App({ roomCode = null, mySeat = 0, playerCount = 3 }) {
  const isHost = mySeat === 0

  // Game state init: try localStorage first (handles rejoins + non-host initial load).
  // Host creates & saves fresh game if nothing stored yet.
  const [game, setGame] = useState(() => {
    if (roomCode) {
      const stored = loadGameState(roomCode)
      if (stored) return stored
    }
    if (isHost || !roomCode) {
      const newGame = initGame(playerCount)
      if (roomCode) saveGameState(roomCode, newGame)
      return newGame
    }
    return null // Non-host, host hasn't joined yet
  })
  const [skillDialog, setSkillDialog] = useState(null)
  const [modifierChoice, setModifierChoice] = useState(null)
  const [modifierTargetChoice, setModifierTargetChoice] = useState(null)
  const [modifierSecondsLeft, setModifierSecondsLeft] = useState(0)
  const [challengeSecondsLeft, setChallengeSecondsLeft] = useState(0)
  const [displayRoll, setDisplayRoll] = useState(null)
  const [itemEquipInstanceId, setItemEquipInstanceId] = useState(
    /** @type {string | null} */ (null),
  )
  const [itemEquipIsCursed, setItemEquipIsCursed] = useState(false)
  const [debugMode, setDebugMode] = useState(() => loadDebugModeEnabled())
  const [debugMessage, setDebugMessage] = useState(
    /** @type {string | null} */ (null),
  )

  // BroadcastChannel refs
  const channelRef = useRef(null)
  const isFromBroadcastRef = useRef(false)
  const gameRef = useRef(game)
  useEffect(() => { gameRef.current = game }, [game])

  // BroadcastChannel setup — only carries lightweight "STATE_CHANGED" signals.
  // Full game state lives in localStorage so latecomers always find it.
  useEffect(() => {
    if (!roomCode) return
    const channel = openRoomChannel(roomCode)
    if (!channel) return
    channelRef.current = channel

    channel.onmessage = (e) => {
      if (e.data.type === 'STATE_CHANGED') {
        const newGame = loadGameState(roomCode)
        if (newGame) {
          isFromBroadcastRef.current = true
          setGame(newGame)
        }
      }
    }

    return () => { channel.close(); channelRef.current = null }
  }, [roomCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to localStorage + notify other tabs whenever game state changes.
  useEffect(() => {
    if (!game || !roomCode) return
    if (isFromBroadcastRef.current) { isFromBroadcastRef.current = false; return }
    saveGameState(roomCode, game)
    channelRef.current?.postMessage({ type: 'STATE_CHANGED' })
  }, [game, roomCode])

  // These three effects MUST be declared before any conditional return (React hooks rules).
  // They use optional chaining so they're safe when game is null.
  useEffect(() => {
    if (!game?.pendingChallenge) return undefined
    setChallengeSecondsLeft(Math.ceil(CHALLENGE_WINDOW_MS / 1000))
    const interval = window.setInterval(() => {
      setChallengeSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    const timeout = window.setTimeout(() => {
      setGame((prev) => {
        if (!prev?.pendingChallenge) return prev
        const { game: nextGame, diceRoll } = passChallengeWindow(prev)
        if (diceRoll) setDisplayRoll(diceRoll)
        return nextGame
      })
    }, CHALLENGE_WINDOW_MS)
    return () => { window.clearInterval(interval); window.clearTimeout(timeout) }
  }, [game?.pendingChallenge]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!game?.pendingRoll) return undefined
    setDisplayRoll(game.pendingRoll)
    setModifierSecondsLeft(Math.ceil(MODIFIER_WINDOW_MS / 1000))
    const interval = window.setInterval(() => {
      setModifierSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    const timeout = window.setTimeout(() => {
      setGame((prev) => {
        if (!prev?.pendingRoll) return prev
        const { game: nextGame, diceRoll } = passModifierPhaseWithResult(prev)
        if (diceRoll) setDisplayRoll(diceRoll)
        return nextGame
      })
    }, MODIFIER_WINDOW_MS)
    return () => { window.clearInterval(interval); window.clearTimeout(timeout) }
  }, [game?.pendingRoll]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game?.pendingRoll || !displayRoll) return undefined
    const timer = window.setTimeout(() => setDisplayRoll(null), 3000)
    return () => window.clearTimeout(timer)
  }, [game?.pendingRoll, displayRoll])

  // — Null guard: non-host tabs show this until host saves initial game to localStorage —
  if (!game) {
    return (
      <div className="waiting-screen">
        <h2>⏳ Waiting for host to start the game…</h2>
        <p>Room: <strong>{roomCode}</strong> · Your seat: <strong>Player {mySeat + 1}</strong></p>
        <p className="waiting-screen__hint">Ask Player 1 to open their link first.</p>
      </div>
    )
  }

  const currentPlayer = game.players[game.currentPlayerIndex]
  const modifierPhase = isModifierPhaseActive(game)
  const challengePhase = isChallengeWindowActive(game)
  const targetSelectionPhase = isEffectTargetSelectionActive(game)
  const heroTargetSelectionPhase = isEffectHeroTargetSelectionActive(game)
  const heroTargetAction =
    heroTargetSelectionPhase && game.pendingEffectHeroTargetSelection
      ? game.pendingEffectHeroTargetSelection.effectId === 'tipsyTootie'
        ? 'steal'
        : 'destroy'
      : 'destroy'
  const cardPullPhase = isPendingCardPullActive(game)
  const cardPull = game.pendingCardPull
  const pendingDiscardPhase = isPendingDiscardActive(game)
  const pendingGivePhase = isPendingGiveActive(game)
  const pendingGive = game.pendingGive
  const currentGiverIndex = pendingGive?.giverQueue?.[0] ?? -1
  const currentGiver = currentGiverIndex >= 0 ? game.players[currentGiverIndex] : null
  const heroFromHandPlayPhase = isPendingHeroFromHandPlayActive(game)
  const heroFromHandPlay = game.pendingHeroFromHandPlay
  const stagedCardPickPhase = isPendingStagedCardPickActive(game)
  const stagedCardPick = game.pendingStagedCardPick
  const heroSelectionPhase = isPendingHeroSelectionActive(game)
  const heroSelection = game.pendingHeroSelection
  const qiBearPhase = isPendingQiBearSelectionActive(game)
  const qiBearSel = game.pendingQiBearSelection
  const heroPlayChoicePhase = isPendingHeroPlayChoiceActive(game)
  const itemSelectionPhase = isPendingItemSelectionActive(game)
  const itemSelection = game.pendingItemSelection ?? null
  const heroPlayChoice = game.pendingHeroPlayChoice
  const interruptPhase =
    modifierPhase ||
    challengePhase ||
    targetSelectionPhase ||
    heroTargetSelectionPhase ||
    cardPullPhase ||
    pendingDiscardPhase ||
    pendingGivePhase ||
    stagedCardPickPhase ||
    heroSelectionPhase ||
    qiBearPhase ||
    heroPlayChoicePhase ||
    heroFromHandPlayPhase ||
    itemSelectionPhase
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


  function handlePlayCard(card, playerIndex) {
    if (heroFromHandPlayPhase && heroFromHandPlay) {
      if (playerIndex !== heroFromHandPlay.sourcePlayerIndex) {
        return
      }
      if (card.type !== CARD_TYPES.HERO) {
        return
      }
      const { game: nextGame, diceRoll, error } = playHeroFromHandForPending(
        game,
        playerIndex,
        card.instanceId,
      )
      if (error) {
        window.alert(error)
        return
      }
      setGame(nextGame)
      if (diceRoll) {
        setDisplayRoll(diceRoll)
      }
      return
    }

    if (pendingGivePhase && pendingGive) {
      if (playerIndex !== currentGiverIndex) {
        return
      }
      const { game: nextGame, error } = giveForPendingGive(
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
      setItemEquipIsCursed(false)
      return
    }

    if (card.type === CARD_TYPES.CURSED_ITEM) {
      setItemEquipInstanceId(card.instanceId)
      setItemEquipIsCursed(true)
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
    const fn = itemEquipIsCursed ? playCursedItemOnHero : playItemOnHero
    const { game: nextGame, error } = fn(game, itemEquipInstanceId, hero.instanceId)
    setItemEquipInstanceId(null)
    setItemEquipIsCursed(false)
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
  }

  function handleItemClick(hero, item) {
    if (!itemSelectionPhase) return
    const { game: nextGame, error } = resolveWindsOfChange(game, hero.instanceId, item.instanceId)
    if (error) { window.alert(error); return }
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

  function handleConfirmHeroPlayChoice() {
    const { game: nextGame, diceRoll, error } = confirmHeroPlayChoice(game)
    if (error) {
      window.alert(error)
      return
    }
    setGame(nextGame)
    if (diceRoll) {
      setDisplayRoll(diceRoll)
    }
  }

  function handleDeclineHeroPlayChoice() {
    const { game: nextGame, error } = declineHeroPlayChoice(game)
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
    setItemEquipIsCursed(false)
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
    <div className="game-layout">
      {/* Phase/status overlays */}
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

      {heroPlayChoicePhase && heroPlayChoice && (
        <div className="modifier-phase-bar challenge-phase-bar">
          <p className="challenge-phase-bar__text">
            <strong>
              {game.players[heroPlayChoice.sourcePlayerIndex]?.name}
            </strong>
            : <strong>{heroPlayChoice.sourceLabel}</strong> lets you play{' '}
            <strong>{heroPlayChoice.heroCard.name}</strong> immediately
            (and trigger its skill), or keep it in your hand?
          </p>
          <div className="card-row staged-card-row">
            <div className="hand-card">
              <CardDisplay
                card={heroPlayChoice.heroCard}
                faceUp={heroPlayChoice.heroCard.faceUp ?? true}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="game-actions__btn game-actions__btn--primary"
              disabled={
                game.currentPlayerIndex !== heroPlayChoice.sourcePlayerIndex
              }
              onClick={handleConfirmHeroPlayChoice}
            >
              Play immediately
            </button>
            <button
              type="button"
              className="game-actions__btn"
              disabled={
                game.currentPlayerIndex !== heroPlayChoice.sourcePlayerIndex
              }
              onClick={handleDeclineHeroPlayChoice}
            >
              Keep in hand
            </button>
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
            : Choose a hero to {heroTargetAction} — click a hero on any party below.
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

      {pendingGivePhase && pendingGive && currentGiver && (
        <div className="modifier-phase-bar challenge-phase-bar">
          <p className="challenge-phase-bar__text">
            <strong>{currentGiver.name}</strong>: give 1 card to{' '}
            <strong>{game.players[pendingGive.targetPlayerIndex]?.name ?? 'Player'}</strong>{' '}
            (from <strong>{pendingGive.sourceLabel}</strong>). Click a card in your hand.
          </p>
        </div>
      )}

      {heroFromHandPlayPhase && heroFromHandPlay && (
        <div className="modifier-phase-bar challenge-phase-bar">
          <p className="challenge-phase-bar__text">
            <strong>{game.players[heroFromHandPlay.sourcePlayerIndex]?.name}</strong>:
            choose a <strong>Hero</strong> card from your hand to play immediately
            (from <strong>{heroFromHandPlay.sourceLabel}</strong>).
          </p>
        </div>
      )}

      {itemSelectionPhase && itemSelection && (
        <div className="modifier-phase-bar challenge-phase-bar">
          <p className="challenge-phase-bar__text">
            <strong>{game.players[itemSelection.sourcePlayerIndex]?.name}</strong>:
            click an equipped item on any party to return it to its owner's hand
            (<strong>{itemSelection.sourceLabel}</strong>).
          </p>
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

      {/* Top: opponent panels */}
      <div className="game-opponents">
        {game.players
          .map((player, playerIndex) => ({ player, playerIndex }))
          .filter(({ playerIndex }) => playerIndex !== mySeat)
          .map(({ player, playerIndex }) => {
            const partyClickableForSelection = heroSelectionPhase && isPartyClickableForSelection(game, playerIndex)
            const partyClickableForHeroTarget = heroTargetSelectionPhase && isPartyClickableForHeroTargetSelection(game, playerIndex)
            const selectionMode = partyClickableForSelection
              ? (heroSelection?.action === 'swapSource' || heroSelection?.action === 'swapTarget' ? 'swap' : heroSelection?.action ?? null)
              : null
            return (
              <CompactPlayerPanel
                key={player.id}
                player={player}
                isCurrent={playerIndex === game.currentPlayerIndex}
                onHeroSkillClick={(hero) => handleHeroSkillClick(hero, playerIndex)}
                heroSkillClickable={partyClickableForSelection || partyClickableForHeroTarget}
                allowHeroClickWhenSkillUsed={partyClickableForSelection || partyClickableForHeroTarget}
                onHeroEquipClick={
                  itemEquipInstanceId !== null && !heroSelectionPhase && itemEquipIsCursed && playerIndex !== mySeat
                    ? handleHeroEquipClick
                    : undefined
                }
                heroEquipSelectable={itemEquipInstanceId !== null && !heroSelectionPhase && itemEquipIsCursed && playerIndex !== mySeat}
                selectionMode={selectionMode}
                pendingDestroyMode={qiBearPhase || partyClickableForHeroTarget}
                pendingDestroyIds={game.pendingDestroyTargets}
                onItemClick={itemSelectionPhase ? handleItemClick : undefined}
                itemsSelectable={itemSelectionPhase}
              />
            )
          })
        }
      </div>

      {/* Middle: game table */}
      <div className="game-table">

        {/* Left: deck piles */}
        <div className="game-table__left">
          <section className="table-section table-section--deck">
            <h3>Main deck</h3>
            <DeckPile
              count={game.mainDeck.length}
              backImageUrl={game.mainDeck[0]?.backImageUrl ?? CARD_BACKS.MAIN}
              label="Main deck"
              variant="main"
            />
            {game.discardPile.length > 0 && (
              <p className="deck-recycle-hint">Discard: {game.discardPile.length}</p>
            )}
          </section>
          <section className="table-section table-section--deck">
            <h3>Monster deck</h3>
            <DeckPile
              count={game.monsterDeck.length}
              backImageUrl={game.monsterDeck[0]?.backImageUrl ?? CARD_BACKS.MONSTER}
              label="Monster deck"
              variant="monster"
            />
          </section>
        </div>

        {/* Center: active monsters */}
        <div className="game-table__center">
          <section className="table-section">
            <h3>Active monsters</h3>
            <p className="table-hint">
              {canAttackMonster
                ? `Click to ${ATTACK_MONSTER_ACTION_NAME} (${ATTACK_MONSTER_AP_COST} AP)`
                : 'Attack costs 2 AP on your turn'}
            </p>
            <ActiveMonsters
              monsters={game.activeMonsters}
              onAttack={handleAttackMonster}
              canAttack={canAttackMonster}
            />
          </section>
        </div>

        {/* Right: discard pile */}
        <div className="game-table__right">
          <section className="table-section">
            <h3>Discard</h3>
            {game.discardPile.length === 0
              ? <p className="discard-pile__empty">Empty</p>
              : (
                <div className="discard-pile">
                  <CardDisplay card={topDiscard} faceUp />
                  <span className="discard-pile__count">{game.discardPile.length}</span>
                </div>
              )
            }
          </section>
        </div>
      </div>

      {/* Bottom: my section */}
      <div className="game-my-section">

        {/* Status + action buttons */}
        <div className="my-section__header">
          <p className="my-section__status">
            Turn: <strong>{currentPlayer.name}</strong> · AP: <strong>{game.actionPoints}</strong>/3
            {itemEquipInstanceId && (
              <span className="status-warn">
                {' '}— {itemEquipIsCursed
                  ? 'Click opponent hero to equip cursed item'
                  : 'Click your hero to equip item'}
              </span>
            )}
            {challengePhase && !modifierPhase && (
              <span className="status-warn"> — Challenge window</span>
            )}
            {modifierPhase && (
              <span className="status-warn"> — Modifier window</span>
            )}
            {targetSelectionPhase && (
              <span className="status-warn"> — Pick a target</span>
            )}
            {pendingDiscardPhase && (
              <span className="status-warn"> — Discard {pendingDiscard?.count}</span>
            )}
          </p>
          <div className="my-section__actions">
            <button
              type="button"
              className="game-actions__btn"
              onClick={handleDrawCard}
              disabled={!canDraw}
              title={`Costs ${DRAW_CARD_AP_COST} AP`}
            >
              Draw ({DRAW_CARD_AP_COST} AP)
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
            >
              Debug {debugMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {debugMode && (
          <DebugPanel onDraw={handleDebugDraw} lastMessage={debugMessage} />
        )}

        {/* My party + hand */}
        <div className="my-section__board">
          {/* Compact panel for my party */}
          <CompactPlayerPanel
            player={game.players[mySeat]}
            isCurrent={mySeat === game.currentPlayerIndex}
            isMe={true}
            onHeroSkillClick={(hero) => handleHeroSkillClick(hero, mySeat)}
            heroSkillClickable={
              (mySeat === game.currentPlayerIndex && canPlay) ||
              (heroSelectionPhase && isPartyClickableForSelection(game, mySeat)) ||
              (heroTargetSelectionPhase && isPartyClickableForHeroTargetSelection(game, mySeat))
            }
            allowHeroClickWhenSkillUsed={
              (heroSelectionPhase && isPartyClickableForSelection(game, mySeat)) ||
              (heroTargetSelectionPhase && isPartyClickableForHeroTargetSelection(game, mySeat))
            }
            onHeroEquipClick={
              itemEquipInstanceId !== null && !heroSelectionPhase && !itemEquipIsCursed
                ? handleHeroEquipClick
                : undefined
            }
            heroEquipSelectable={itemEquipInstanceId !== null && !heroSelectionPhase && !itemEquipIsCursed}
            selectionMode={
              heroSelectionPhase && isPartyClickableForSelection(game, mySeat)
                ? (heroSelection?.action === 'swapSource' || heroSelection?.action === 'swapTarget' ? 'swap' : heroSelection?.action ?? null)
                : null
            }
            pendingDestroyMode={qiBearPhase || (heroTargetSelectionPhase && isPartyClickableForHeroTargetSelection(game, mySeat))}
            pendingDestroyIds={game.pendingDestroyTargets}
            onItemClick={itemSelectionPhase ? handleItemClick : undefined}
            itemsSelectable={itemSelectionPhase}
          />

          {/* My hand */}
          <div className="my-section__hand-area">
            <h3 className="hand-heading">Hand</h3>
            <p className="game-section__hint">
              {heroSelectionPhase && heroSelection
                ? mySeat === heroSelection.sourcePlayerIndex
                  ? `Pick a hero to ${heroSelection.action}.`
                  : `Waiting for ${game.players[heroSelection.sourcePlayerIndex]?.name} to pick a hero.`
                : pendingDiscardPhase
                  ? mySeat === pendingDiscard.playerIndex
                    ? `Discard ${pendingDiscard.count} card${pendingDiscard.count === 1 ? '' : 's'}: click below.`
                    : 'Waiting for opponent to discard.'
                  : modifierPhase
                    ? 'Any player: play Modifiers, or Pass.'
                    : challengePhase
                      ? mySeat !== challengeAttackerIndex
                        ? 'Play a Challenge card, or wait.'
                        : 'Waiting for opponents — or Pass above.'
                      : mySeat === game.currentPlayerIndex
                        ? 'Hero/Magic (1 AP). Item: click item then hero. Draw (1 AP). Restock (3 AP).'
                        : 'Waiting for your turn.'}
            </p>
            <div className="card-row hand-row">
              {game.players[mySeat].hand.length === 0
                ? <p className="hand-empty">Empty hand</p>
                : game.players[mySeat].hand.map((card) => {
                    const playable = isPlayableFromHand(card, game, mySeat)
                    const enabled = pendingDiscardPhase
                      ? playable
                      : pendingGivePhase ? playable
                      : heroFromHandPlayPhase ? playable
                      : heroTargetSelectionPhase ? false
                      : targetSelectionPhase ? false
                      : modifierPhase ? playable
                      : challengePhase ? playable
                      : mySeat === game.currentPlayerIndex && (itemEquipInstanceId ? itemEquipInstanceId === card.instanceId : canPlay && playable)
                    const isSelectedItem = itemEquipInstanceId === card.instanceId
                    return (
                      <button
                        key={card.instanceId}
                        type="button"
                        className={`hand-card${enabled ? ' hand-card--playable' : ''}${modifierPhase && card.type === CARD_TYPES.MODIFIER ? ' hand-card--modifier' : ''}${challengePhase && card.type === CARD_TYPES.CHALLENGE ? ' hand-card--challenge' : ''}${pendingDiscardPhase && enabled ? ' hand-card--discard' : ''}${isSelectedItem ? ' hand-card--selected' : ''}`}
                        onClick={() => {
                          if (!pendingDiscardPhase && itemEquipInstanceId && card.instanceId === itemEquipInstanceId) {
                            setItemEquipInstanceId(null); setItemEquipIsCursed(false); return
                          }
                          handlePlayCard(card, mySeat)
                        }}
                        disabled={!enabled && !isSelectedItem}
                      >
                        <CardDisplay card={card} faceUp={card.faceUp ?? true} />
                      </button>
                    )
                  })
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
