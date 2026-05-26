import { useState } from 'react'

/**
 * @param {{
 *   onDraw: (cardQuery: string, source: 'mainDeck' | 'discardPile') => void,
 *   lastMessage?: string | null,
 * }} props
 */
export default function DebugPanel({ onDraw, lastMessage }) {
  const [cardQuery, setCardQuery] = useState('')
  const [source, setSource] = useState(
    /** @type {'mainDeck' | 'discardPile'} */ ('mainDeck'),
  )

  function handleSubmit(event) {
    event.preventDefault()
    onDraw(cardQuery, source)
  }

  return (
    <section className="debug-panel" aria-label="Debug mode">
      <h2 className="debug-panel__title">Debug — add card to hand</h2>
      <p className="debug-panel__hint">
        Enter card number (e.g. <code>027</code>, <code>30</code>) or card id. Pulls one
        copy from the chosen pile; does not cost action points.
      </p>
      <form className="debug-panel__form" onSubmit={handleSubmit}>
        <label className="debug-panel__field">
          <span className="debug-panel__label">Card #</span>
          <input
            type="text"
            className="debug-panel__input"
            value={cardQuery}
            onChange={(e) => setCardQuery(e.target.value)}
            placeholder="027"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <fieldset className="debug-panel__source">
          <legend className="debug-panel__label">From</legend>
          <label className="debug-panel__radio">
            <input
              type="radio"
              name="debug-source"
              value="mainDeck"
              checked={source === 'mainDeck'}
              onChange={() => setSource('mainDeck')}
            />
            Main deck
          </label>
          <label className="debug-panel__radio">
            <input
              type="radio"
              name="debug-source"
              value="discardPile"
              checked={source === 'discardPile'}
              onChange={() => setSource('discardPile')}
            />
            Discard pile
          </label>
        </fieldset>
        <button type="submit" className="game-actions__btn game-actions__btn--primary">
          Add to hand
        </button>
      </form>
      {lastMessage && <p className="debug-panel__message">{lastMessage}</p>}
    </section>
  )
}
