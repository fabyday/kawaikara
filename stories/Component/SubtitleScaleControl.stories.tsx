import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SubtitleScaleControl } from '../../src/Renderer/Component/SubtitleScaleControl';

/** Preview the shared percentage typography control. */
const meta = {
  /** Storybook navigation title. */
  title: 'Component/Subtitle Scale Control',
  /** Shared preference component. */
  component: SubtitleScaleControl,
  /** Enable generated documentation. */
  tags: ['autodocs'],
  /** Default original-size preference. */
  args: {
    /** Accessible title. */
    label: 'PiP 자막 크기',
    /** Explain the original-size setting. */
    description: '100%는 사이트 기본 크기입니다. 지원되는 사이트 자막에 공통으로 적용합니다.',
    /** Supported range uses shared bounds rather than hard-coded percentages. */
    rangeMessage: '자막 크기는 {min}%부터 {max}%까지만 지원합니다. 범위 안의 값을 입력해주세요.',
    /** Original subtitle size. */
    value: 1,
    /** Static example callback. */
    onChange: () => undefined,
  },
} satisfies Meta<typeof SubtitleScaleControl>;
export default meta;

/** Typed component stories. */
type Story = StoryObj<typeof meta>;

/** Original-size appearance. */
export const Default = {} satisfies Story;

/** Maximum supported size; manual overflow entry shows the range warning. */
export const Maximum = {
  /** Preview the largest common subtitle multiplier. */
  args: {
    /** Largest supported multiplier. */
    value: 3,
  },
} satisfies Story;

/** Persistence-disabled appearance. */
export const Saving = {
  /** Preference save in progress. */
  args: {
    /** Disable mutations while saving. */
    disabled: true,
  },
} satisfies Story;

/** Exercise keyboard entry, validation, and increment/decrement behavior. */
export const Interactive = {
  /** Stateful preference preview. */
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <SubtitleScaleControl {...args} value={value} onChange={setValue} />;
  },
} satisfies Story;
