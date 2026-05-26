import './DeckPile.css'

/**
 * @param {{
 *   count: number
 *   backImageUrl: string
 *   label?: string
 *   variant?: 'main' | 'monster'
 * }} props
 */
function DeckPile({ count, backImageUrl, label = 'Deck', variant = 'main' }) {
  if (count === 0) {
    return <p className="deck-pile deck-pile--empty">Empty</p>
  }

  return (
    <div className={`deck-pile deck-pile--${variant}`}>
      <div className="deck-pile__stack" aria-label={`${label}, ${count} cards`}>
        <span className="deck-pile__layer deck-pile__layer--3" aria-hidden />
        <span className="deck-pile__layer deck-pile__layer--2" aria-hidden />
        <span className="deck-pile__layer deck-pile__layer--1" aria-hidden />
        <img
          className="deck-pile__top"
          src={backImageUrl}
          alt=""
          draggable={false}
        />
      </div>
      <span className="deck-pile__count">{count}</span>
    </div>
  )
}

export default DeckPile
