import './ModifierChoiceDialog.css'

/**
 * @param {{
 *   cardName: string
 *   attackerLabel: string
 *   challengerLabel: string
 *   open: boolean
 *   onChoose: (target: 'attacker' | 'challenger') => void
 *   onCancel: () => void
 * }} props
 */
function ModifierTargetDialog({
  cardName,
  attackerLabel,
  challengerLabel,
  open,
  onChoose,
  onCancel,
}) {
  if (!open) {
    return null
  }

  return (
    <div className="modifier-choice-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modifier-choice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modifier-target-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="modifier-target-title" className="modifier-choice__title">
          Apply modifier to which roll?
        </h3>
        <p className="modifier-choice__body">
          <strong>{cardName}</strong> — pick whose total to change:
        </p>
        <div className="modifier-choice__options">
          <button
            type="button"
            className="modifier-choice__option"
            onClick={() => onChoose('attacker')}
          >
            {attackerLabel}
          </button>
          <button
            type="button"
            className="modifier-choice__option"
            onClick={() => onChoose('challenger')}
          >
            {challengerLabel}
          </button>
        </div>
        <button
          type="button"
          className="modifier-choice__cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default ModifierTargetDialog
