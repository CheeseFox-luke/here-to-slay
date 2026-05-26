import { createPortal } from 'react-dom'
import './CardHoverPreview.css'

const OFFSET = 16
const WIDTH_NORMAL = 280
const WIDTH_LARGE = 320

/**
 * @param {{ x: number, y: number, isLarge: boolean }} pos
 */
function clampPosition(pos) {
  const width = pos.isLarge ? WIDTH_LARGE : WIDTH_NORMAL
  const height = Math.round(width * 1.4)

  let x = pos.x + OFFSET
  let y = pos.y + OFFSET

  if (x + width > window.innerWidth - 8) {
    x = pos.x - width - OFFSET
  }
  if (y + height > window.innerHeight - 8) {
    y = pos.y - height - OFFSET
  }

  return {
    x: Math.max(8, x),
    y: Math.max(8, y),
  }
}

/**
 * @param {{
 *   src: string
 *   alt: string
 *   isLarge?: boolean
 *   x: number
 *   y: number
 * }} props
 */
function CardHoverPreview({ src, alt, isLarge = false, x, y }) {
  const { x: left, y: top } = clampPosition({ x, y, isLarge })

  return createPortal(
    <div
      className={`card-hover-preview${isLarge ? ' card-hover-preview--large' : ''}`}
      style={{ left, top }}
      role="presentation"
      aria-hidden
    >
      <img src={src} alt={alt} draggable={false} />
    </div>,
    document.body,
  )
}

export default CardHoverPreview
