import { VIEW_RANGE, type ComfortState } from '../state/useComfort.js';

/**
 * The comfort settings: how much impacts shake the view, and how wide it is.
 * Folded away until opened — most players never need it, and those who do
 * should find it without opening the debug tools.
 */
export const ComfortControls = ({ comfort, setShake, setView }: ComfortState) => (
  <details className="comfort">
    <summary>Comfort</summary>
    <label className="toggle">
      shake
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={comfort.shake}
        onChange={(event) => setShake(Number(event.target.value))}
        aria-label="Screen shake"
      />
    </label>
    <label className="toggle">
      view
      <input
        type="range"
        min={VIEW_RANGE.min}
        max={VIEW_RANGE.max}
        step={0.05}
        value={comfort.view}
        onChange={(event) => setView(Number(event.target.value))}
        aria-label="Field of view"
      />
    </label>
  </details>
);
