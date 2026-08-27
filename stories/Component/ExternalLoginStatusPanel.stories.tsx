import type { Meta, StoryObj } from '@storybook/react-vite';
import { Center } from '@kawaikara/kawai-ui';
import { ExternalLoginStatusPanel } from '../../src/Renderer/View/ExternalLogin/ExternalLoginStatusPanel';

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/External Login Status Panel',
  /** The component value. */
  component: ExternalLoginStatusPanel,
  /** The tags value. */
  tags: ['autodocs'],
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'centered' },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <Center className="external-login-shell">
        <Story />
      </Center>
    ),
  ],
  /** The args value. */
  args: {
    /** The site title value. */
    siteTitle: 'Netflix',
    /** The title value. */
    title: 'Continue in your external browser',
    /** The description value. */
    description:
      'Kawaikara will return to the signed-in site automatically when login is complete.',
    /** The waiting label value. */
    waitingLabel: 'Waiting for login',
    /** The secure label value. */
    secureLabel: 'External browser opened',
  },
} satisfies Meta<typeof ExternalLoginStatusPanel>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the english value. */
export const English = {} satisfies Story;

/** Stores the korean value. */
export const Korean = {
  /** The args value. */
  args: {
    /** The site title value. */
    siteTitle: 'Coupang Play',
    /** The title value. */
    title: '외부 브라우저에서 계속해 주세요',
    /** The description value. */
    description:
      '로그인이 완료되면 Kawaikara가 로그인된 사이트로 자동 복귀합니다.',
    /** The waiting label value. */
    waitingLabel: '로그인 완료 대기 중',
    /** The secure label value. */
    secureLabel: '외부 브라우저 열림',
  },
} satisfies Story;

/** Stores the japanese value. */
export const Japanese = {
  /** The args value. */
  args: {
    /** The title value. */
    title: '外部ブラウザで続行してください',
    /** The description value. */
    description:
      'ログインが完了すると、Kawaikaraはログイン済みのサイトへ自動的に戻ります。',
    /** The waiting label value. */
    waitingLabel: 'ログイン完了を待っています',
    /** The secure label value. */
    secureLabel: '外部ブラウザを開きました',
  },
} satisfies Story;
