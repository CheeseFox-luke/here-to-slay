import { useState } from 'react'
import CardHoverPreview from './CardHoverPreview.jsx'
import './CardDisplay.css'

/**
 * 卡面展示 + 悬停放大预览（需求 0：无延迟，mouseenter 即显示 CardHoverPreview）。
 *
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

  function handleMouseEnter(e) {
    if (!canPreview) return
    setHover({ x: e.clientX, y: e.clientY })
  }

  function handleMouseMove(e) {
    if (!canPreview) return
    setHover((prev) =>
      prev ? { x: e.clientX, y: e.clientY } : null,
    )
  }

  function handleMouseLeave() {
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
