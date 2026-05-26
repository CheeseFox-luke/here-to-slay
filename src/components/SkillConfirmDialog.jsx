import './SkillConfirmDialog.css'

/**
 * @param {{
 *   heroName: string
 *   open: boolean
 *   onConfirm: () => void
 *   onCancel: () => void
 * }} props
 */
function SkillConfirmDialog({ heroName, open, onConfirm, onCancel }) {
  if (!open) {
    return null
  }

  return (
    <div className="skill-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="skill-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="skill-dialog-title" className="skill-dialog__title">
          Trigger skill?
        </h3>
        <p className="skill-dialog__body">
          Use <strong>{heroName}</strong>&apos;s skill? This costs 1 action point
          and rolls 2d6 for the effect.
        </p>
        <div className="skill-dialog__actions">
          <button type="button" className="skill-dialog__btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="skill-dialog__btn skill-dialog__btn--primary"
            onClick={onConfirm}
          >
            Trigger skill
          </button>
        </div>
      </div>
    </div>
  )
}

export default SkillConfirmDialog
