import { useRef, useState } from 'react'
import CardHoverPreview from './CardHoverPreview.jsx'
import './CardDisplay.css'

const HOVER_DELAY_MS = 500

/**
 * @param {{
 *   card: {
 *     id: string
 *     name: string
 *     imageUrl: string
 *     backImageUrl?: string
 *     isLarge?: boolean
 *   }
 *   faceUp?: boolean
 * }} props
 */
function CardDisplay({ card, faceUp = true }) {
  const src = faceUp ? card.imageUrl : (card.backImageUrl ?? card.imageUrl)
  const canPreview = faceUp && Boolean(card.imageUrl)
  const [hover, setHover] = useState(
    /** @type {{ x: number, y: number } | null} */ (null),
  )
  const timerRef = useRef(/** @type {number | null} */ (null))
  const pendingPosRef = useRef(/** @type {{ x: number, y: number } | null} */ (null))

  function handleMouseEnter(e) {
    if (!canPreview) return
    pendingPosRef.current = { x: e.clientX, y: e.clientY }
    timerRef.current = window.setTimeout(() => {
      setHover(pendingPosRef.current)
    }, HOVER_DELAY_MS)
  }

  function handleMouseMove(e) {
    if (!canPreview) return
    pendingPosRef.current = { x: e.clientX, y: e.clientY }
    // Update position live only once the preview is already visible
    if (hover) {
      setHover({ x: e.clientX, y: e.clientY })
    }
  }

  function handleMouseLeave() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingPosRef.current = null
    setHover(null)
  }

  return (
    <span
      className="card-display-wrap"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <img
        className={`card-display${card.isLarge ? ' card-display--large' : ''}`}
        src={src}
        alt={card.name}
        draggable={false}
      />
      {hover && (
        <CardHoverPreview
          src={card.imageUrl}
          alt={card.name}
          isLarge={card.isLarge}
          x={hover.x}
          y={hover.y}
        />
      )}
    </span>
  )
}

export default CardDisplay
