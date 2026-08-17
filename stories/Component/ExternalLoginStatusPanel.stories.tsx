import type { Meta, StoryObj } from '@storybook/react-vite';
import { Center } from '@kawaikara/kawai-ui';
import { ExternalLoginStatusPanel } from '../../src/Renderer/View/ExternalLogin/ExternalLoginStatusPanel';

const meta = {
  title: 'Component/External Login Status Panel',
  component: ExternalLoginStatusPanel,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Center className="external-login-shell">
        <Story />
      </Center>
    ),
  ],
  args: {
    siteTitle: 'Netflix',
    title: 'Continue in your external browser',
    description:
      'Kawaikara will return to the signed-in site automatically when login is complete.',
    waitingLabel: 'Waiting for login',
    secureLabel: 'External browser opened',
  },
} satisfies Meta<typeof ExternalLoginStatusPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const English = {} satisfies Story;

export const Korean = {
  args: {
    siteTitle: 'Coupang Play',
    title: '외부 브라우저에서 계속해 주세요',
    description:
      '로그인이 완료되면 Kawaikara가 로그인된 사이트로 자동 복귀합니다.',
    waitingLabel: '로그인 완료 대기 중',
    secureLabel: '외부 브라우저 열림',
  },
} satisfies Story;

export const Japanese = {
  args: {
    title: '外部ブラウザで続行してください',
    description:
      'ログインが完了すると、Kawaikaraはログイン済みのサイトへ自動的に戻ります。',
    waitingLabel: 'ログイン完了を待っています',
    secureLabel: '外部ブラウザを開きました',
  },
} satisfies Story;
