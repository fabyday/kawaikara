import type { Meta, StoryObj } from '@storybook/react';
import { KawaiComp } from './test';

const MetaData: Meta<typeof KawaiComp> = {
    title: 'Component/KawaiCompTest',
    component: KawaiComp,
};

export default MetaData;
type Story = StoryObj<typeof KawaiComp>;

export const Primary: Story = {
    args: {},
};
