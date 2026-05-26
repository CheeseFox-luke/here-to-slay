import './ModifierChoiceDialog.css'

/**
 * @param {{
 *   cardName: string
 *   options: { label: string, delta: number }[]
 *   open: boolean
 *   onChoose: (choiceIndex: number) => void
 *   onCancel: () => void
 * }} props
 */
function ModifierChoiceDialog({
  cardName,
  options,
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
        aria-labelledby="modifier-choice-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="modifier-choice-title" className="modifier-choice__title">
          Choose modifier
        </h3>
        <p className="modifier-choice__body">
          Apply <strong>{cardName}</strong> to the roll:
        </p>
        <div className="modifier-choice__options">
          {options.map((option, index) => (
            <button
              key={option.label}
              type="button"
              className="modifier-choice__option"
              onClick={() => onChoose(index)}
            >
              {option.label}
            </button>
          ))}
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

export default ModifierChoiceDialog
