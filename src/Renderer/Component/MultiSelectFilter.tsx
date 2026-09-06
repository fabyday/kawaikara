import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CheckBox,
  Flex,
  Panel,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';

/** Describes a multi-select filter option. */
export interface MultiSelectFilterOption {
  /** The option value. */
  readonly value: string;
  /** The visible option label. */
  readonly label: string;
  /** The optional class applied to the option copy. */
  readonly className?: string;
}

/** Describes the multi-select filter props contract. */
export interface MultiSelectFilterProps {
  /** The visible filter label. */
  readonly label: string;
  /** The available options. */
  readonly options: readonly MultiSelectFilterOption[];
  /** The selected option values. */
  readonly selected: ReadonlySet<string>;
  /** The select all action label. */
  readonly selectAllLabel: string;
  /** The clear all action label. */
  readonly clearAllLabel: string;
  /** Callback used when the selection changes. */
  readonly onChange: (selected: ReadonlySet<string>) => void;
}

/** Renders a compact checkbox-based multi-select filter. */
export function MultiSelectFilter({
  label,
  options,
  selected,
  selectAllLabel,
  clearAllLabel,
  onChange,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    /** Closes the popup when focus moves to a different pointer surface. */
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer, true);
  }, [open]);

  /** Toggles one selected value. */
  const toggleValue = (value: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(value);
    else next.delete(value);
    onChange(next);
  };

  return (
    <Box className="multi-select-filter" position="relative" ref={rootRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        className="multi-select-filter-trigger"
        size="sm"
        variant="secondary"
        onClick={() => setOpen((value) => !value)}
      >
        <Text as="span" size="xs">{label}</Text>
        <Text as="span" className="multi-select-filter-count" size="xs">
          {selected.size}/{options.length}
        </Text>
        <Text as="span" aria-hidden="true" size="xs">⌄</Text>
      </Button>
      {open ? (
        <Panel className="multi-select-filter-popover" padding="sm" radius="md">
          <Flex className="multi-select-filter-actions" justify="between" gap="xs">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange(new Set(options.map((option) => option.value)))}
            >
              {selectAllLabel}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(new Set())}>
              {clearAllLabel}
            </Button>
          </Flex>
          <Stack className="multi-select-filter-options" gap="xs">
            {options.map((option) => (
              <CheckBox
                checked={selected.has(option.value)}
                className="multi-select-filter-option"
                key={option.value}
                label={
                  <Text as="span" className={option.className} size="xs">
                    {option.label}
                  </Text>
                }
                value={option.value}
                onChange={(event) => toggleValue(option.value, event.currentTarget.checked)}
              />
            ))}
          </Stack>
        </Panel>
      ) : null}
    </Box>
  );
}
