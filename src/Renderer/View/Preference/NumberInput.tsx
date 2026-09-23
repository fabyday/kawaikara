import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

/** Describes the number input props contract. */
export interface NumberInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'max' | 'min' | 'onChange' | 'size' | 'step' | 'type' | 'value'
  > {
  /** The container class name value. */
  readonly containerClassName?: string;
  /** The decrement label value. */
  readonly decrementLabel?: string;
  /** The description value. */
  readonly description?: ReactNode;
  /** The increment label value. */
  readonly incrementLabel?: string;
  /** The label value. */
  readonly label: ReactNode;
  /** The layout value. */
  readonly layout?: 'inline' | 'stacked';
  /** Commits each valid in-range draft while the user types. */
  readonly live?: boolean;
  /** The max value. */
  readonly max: number;
  /** The min value. */
  readonly min: number;
  /** Callback used to handle on value change. */
  readonly onValueChange: (value: number) => void;
  /** Reject out-of-range drafts with this message instead of silently clamping. */
  readonly rangeMessage?: string;
  /** The step value. */
  readonly step?: number;
  /** The unit value. */
  readonly unit?: ReactNode;
  /** The value value. */
  readonly value: number;
}

/** Preference compatibility entry for the KawaiUI NumberInput introduced after 0.1.1. */
export function NumberInput({
  className,
  containerClassName,
  decrementLabel,
  description,
  disabled = false,
  id,
  incrementLabel,
  label,
  layout = 'inline',
  live = false,
  max,
  min,
  onBlur,
  onKeyDown,
  onValueChange,
  rangeMessage,
  step = 1,
  unit,
  value,
  ...props
}: NumberInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const rangeMessageId = `${inputId}-range-message`;
  const [draft, setDraft] = useState(String(value));
  const [rangeError, setRangeError] = useState(false);
  const lastEmittedValue = useRef(value);

  useEffect(() => {
    lastEmittedValue.current = value;
    setDraft(String(value));
    setRangeError(false);
  }, [value]);

  /** Emits each numeric value at most once while the owner applies it. */
  const emitValue = (next: number) => {
    if (next === lastEmittedValue.current) return;
    lastEmittedValue.current = next;
    onValueChange(next);
  };

  /** Performs the commit operation. */
  const commit = (candidate: number) => {
    if (rangeMessage && (!Number.isFinite(candidate) || candidate < min || candidate > max)) {
      setRangeError(true);
      return;
    }
    setRangeError(false);
    const next = normalizeNumber(candidate, value, min, max, step);
    setDraft(String(next));
    emitValue(next);
  };
  const accessibleLabel = typeof label === 'string' ? label : 'Value';

  return (
    <label
      aria-disabled={disabled || undefined}
      className={[
        'number-preference-control',
        layout === 'stacked' ? 'is-stacked' : '',
        disabled ? 'is-disabled' : '',
        containerClassName ?? '',
      ].filter(Boolean).join(' ')}
      htmlFor={inputId}
    >
      <span className="number-preference-copy">
        <strong>{label}</strong>
        {description ? <small id={descriptionId}>{description}</small> : null}
        {rangeError && rangeMessage ? (
          <small className="number-preference-error" id={rangeMessageId} role="alert">{rangeMessage}</small>
        ) : null}
      </span>
      <span className="number-preference-field">
        <span className="number-preference-input-group">
          <input
            {...props}
            aria-describedby={[descriptionId, rangeError ? rangeMessageId : undefined].filter(Boolean).join(' ') || undefined}
            aria-invalid={rangeError || undefined}
            aria-label={props['aria-label'] ?? accessibleLabel}
            aria-valuemax={max}
            aria-valuemin={min}
            aria-valuenow={value}
            className={className}
            disabled={disabled}
            id={inputId}
            inputMode="decimal"
            pattern="-?[0-9]*[.]?[0-9]*"
            role="spinbutton"
            type="text"
            value={draft}
            onBlur={(event) => {
              const candidate = event.currentTarget.value;
              commit(rangeMessage && !candidate.trim() ? NaN : Number(candidate));
              onBlur?.(event);
            }}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (/^-?(?:\d+(?:\.\d*)?|\.\d*)?$/.test(next)) {
                setDraft(next);
                const candidate = Number(next);
                const invalidRange = Boolean(
                  next.trim() && Number.isFinite(candidate) &&
                  (candidate < min || candidate > max),
                );
                setRangeError(Boolean(rangeMessage && invalidRange));
                if (
                  live &&
                  next.trim() &&
                  Number.isFinite(candidate) &&
                  !invalidRange
                ) {
                  emitValue(normalizeNumber(candidate, value, min, max, step));
                }
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (value < max) commit(Math.min(max, value + step));
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (value > min) commit(Math.max(min, value - step));
              }
              onKeyDown?.(event);
            }}
          />
          <span className="number-preference-steppers">
            <button
              aria-label={incrementLabel ?? `${accessibleLabel} +`}
              disabled={disabled || value >= max}
              tabIndex={-1}
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => commit(value + step)}
            >
              +
            </button>
            <button
              aria-label={decrementLabel ?? `${accessibleLabel} −`}
              disabled={disabled || value <= min}
              tabIndex={-1}
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => commit(value - step)}
            >
              −
            </button>
          </span>
        </span>
        {unit ? <span className="number-preference-unit">{unit}</span> : null}
      </span>
    </label>
  );
}

/** Normalizes the number. */
function normalizeNumber(
  candidate: number,
  fallback: number,
  min: number,
  max: number,
  step: number,
): number {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const precision = Math.max(
    decimalPlaces(safeStep),
    decimalPlaces(min),
    decimalPlaces(max),
  );
  const rounded = Math.round(candidate / safeStep) * safeStep;
  return Number.isFinite(candidate)
    ? Number(Math.min(max, Math.max(min, rounded)).toFixed(precision))
    : fallback;
}

/** Performs the decimal places operation. */
function decimalPlaces(value: number): number {
  const [, fraction = '', exponent = '0'] = String(value).match(
    /^(?:\d+)(?:\.(\d+))?(?:e-?(\d+))?$/i,
  ) ?? [];
  return Math.max(fraction.length, Number(exponent) || 0);
}
