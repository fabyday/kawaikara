import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';

/** Describes the descriptive select option contract. */
export interface DescriptiveSelectOption {
  /** The description value. */
  readonly description: string;
  /** The label value. */
  readonly label: string;
  /** The value value. */
  readonly value: string;
}

/** Describes the descriptive select props contract. */
export interface DescriptiveSelectProps {
  /** Whether the disabled option is enabled. */
  readonly disabled?: boolean;
  /** The description value. */
  readonly description?: string;
  /** The label value. */
  readonly label: string;
  /** The options value. */
  readonly options: readonly DescriptiveSelectOption[];
  /** The value value. */
  readonly value: string;
  /** Callback used to handle on value change. */
  readonly onValueChange: (value: string) => void;
}

/** Performs the descriptive select operation. */
export function DescriptiveSelect({
  disabled = false,
  description,
  label,
  options,
  value,
  onValueChange,
}: DescriptiveSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [listMaxHeight, setListMaxHeight] = useState(320);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    /** Handles the pointer down. */
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  /** Performs the choose operation. */
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onValueChange(option.value);
    setOpen(false);
  };

  /** Opens the list. */
  const openList = () => {
    const trigger = triggerRef.current;
    const boundary = trigger?.closest('.preference-tab-scroll');
    if (trigger && boundary) {
      const triggerBounds = trigger.getBoundingClientRect();
      const boundaryBounds = boundary.getBoundingClientRect();
      const spaceBelow = Math.max(0, boundaryBounds.bottom - triggerBounds.bottom - 8);
      const spaceAbove = Math.max(0, triggerBounds.top - boundaryBounds.top - 8);
      const nextPlacement = spaceBelow >= spaceAbove ? 'bottom' : 'top';
      setPlacement(nextPlacement);
      setListMaxHeight(
        Math.max(160, Math.min(360, nextPlacement === 'bottom' ? spaceBelow : spaceAbove)),
      );
    }
    setOpen(true);
  };

  /** Handles the key down. */
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        openList();
        setActiveIndex(selectedIndex);
      } else {
        setActiveIndex((current) =>
          (current + direction + options.length) % options.length,
        );
      }
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(activeIndex);
    }
  };

  if (!selected) return null;

  return (
    <div ref={rootRef} className="descriptive-select">
      <span className="descriptive-select-label" id={`${id}-label`}>
        {label}
      </span>
      <div className="descriptive-select-control">
        <button
          ref={triggerRef}
          aria-controls={`${id}-listbox`}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={`${id}-label`}
          className="descriptive-select-trigger"
          disabled={disabled}
          tabIndex={-1}
          type="button"
          onClick={() => {
            if (open) setOpen(false);
            else openList();
          }}
          onKeyDown={handleKeyDown}
        >
          <span className="descriptive-select-copy">
            <strong>{selected.label}</strong>
            <small>{selected.description}</small>
          </span>
          <svg aria-hidden="true" viewBox="0 0 20 20">
            <path d="m6 8 4 4 4-4" />
          </svg>
        </button>
        {open ? (
          <div
            className={`descriptive-select-list is-${placement}`}
            id={`${id}-listbox`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            style={{ maxHeight: listMaxHeight
            } as CSSProperties}
          >
            {options.map((option, index) => (
              <button
                aria-selected={option.value === value}
                className={`${index === activeIndex ? 'is-active' : ''}${
                  option.value === value ? ' is-selected' : ''
                }`}
                key={option.value}
                role="option"
                tabIndex={-1}
                type="button"
                onClick={() => choose(index)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="descriptive-select-copy">
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                {option.value === value ? (
                  <span aria-hidden="true">✓</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {description ? (
        <small className="descriptive-select-help">{description}</small>
      ) : null}
    </div>
  );
}
