import './ModifierChoiceDialog.css'

/**
 * @param {{
 *   open: boolean,
 *   heroName: string,
 *   sourcePlayerName: string,
 *   options: { playerIndex: number, label: string }[],
 *   onChoose: (playerIndex: number) => void,
 * }} props
 */
function EffectTargetDialog({
  open,
  heroName,
  sourcePlayerName,
  options,
  onChoose,
}) {
  if (!open) {
    return null
  }

  return (
    <div className="modifier-choice-backdrop" role="presentation">
      <div
        className="modifier-choice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="effect-target-title"
      >
        <h3 id="effect-target-title" className="modifier-choice__title">
          Choose a target
        </h3>
        <p className="modifier-choice__body">
          <strong>{sourcePlayerName}</strong>: pick a player to receive
          {' '}
          <strong>{heroName}</strong>&apos;s effect.
        </p>
        <div className="modifier-choice__options">
          {options.map((option) => (
            <button
              key={option.playerIndex}
              type="button"
              className="modifier-choice__option"
              onClick={() => onChoose(option.playerIndex)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EffectTargetDialog
