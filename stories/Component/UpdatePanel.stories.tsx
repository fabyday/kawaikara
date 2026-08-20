import type { Meta, StoryObj } from '@storybook/react-vite';
import { UpdatePanel } from '../../src/Renderer/View/Update/UpdatePanel';

const meta = {
  title: 'Component/Update Panel',
  component: UpdatePanel,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    locale: 'en-US',
    state: {
      phase: 'available',
      origin: 'manual',
      channel: 'staging',
      currentVersion: '3.0.0-staging.12',
      latestVersion: '3.0.0-staging.13',
      releaseNotes:
        'Provider sessions are now isolated by profile.\n\nVideo playback and Picture in Picture transitions are smoother.',
    },
    onDismiss: () => undefined,
    onDownload: () => undefined,
    onInstall: () => undefined,
    onRetry: () => undefined,
  },
} satisfies Meta<typeof UpdatePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UpdateAvailable = {} satisfies Story;

export const ReleaseNotes = {
  args: {
    locale: 'ko-KR',
    initialView: 'release-notes',
    state: {
      phase: 'available',
      origin: 'manual',
      channel: 'staging',
      currentVersion: '3.0.0-staging.12',
      latestVersion: '3.0.0-staging.13',
      releaseNotes: `## English

### Kawaikara 3.0.0

- Added versioned release notes.
- Improved Provider isolation and update reliability.

## 한국어

### Kawaikara 3.0.0

- 버전별 업데이트 내역을 추가했습니다.
- Provider 격리와 업데이트 안정성을 개선했습니다.
- Video 재생과 PiP 복귀 동작을 부드럽게 다듬었습니다.
- 메뉴 및 Preference 레이어가 수동 업데이트 화면 뒤에 유지됩니다.
- 자동 업데이트 확인은 백그라운드에서 조용히 실행됩니다.
- 새 버전이 있을 때만 다운로드 진행 화면을 표시합니다.
- 다운로드가 끝나면 자동으로 새 버전으로 재시작합니다.
- 버전별 CHANGELOG에서 GitHub Release 본문을 생성합니다.
- GitHub App installation token으로 개발 채널을 게시합니다.

### Provider

- CHZZK 네이티브 화질 표시와 1080p 우회 상태를 분리했습니다.
- 각 Provider의 브라우저 프로필과 세션 격리를 강화했습니다.
- 외부 로그인과 페이지 Injection 복구 동작을 정리했습니다.

### Viewer

- 로컬 Video와 HLS 전환 안정성을 개선했습니다.
- PiP 복귀 시 포커스와 Always on Top 상태를 복구합니다.
- 밝은 테마와 어두운 테마를 원격 WebContents에도 적용합니다.

## Build metadata

Source commit: 0123456789abcdef`,
    },
  },
} satisfies Story;

export const Checking = {
  args: {
    state: {
      phase: 'checking',
      origin: 'manual',
      channel: 'stable',
      currentVersion: '3.0.0',
    },
  },
} satisfies Story;

export const DownloadingAutomatically = {
  args: {
    locale: 'ko-KR',
    state: {
      phase: 'downloading',
      origin: 'automatic',
      channel: 'nightly',
      currentVersion: '3.0.0-nightly.20260819.204.1.g891f02a1',
      latestVersion: '3.0.0-nightly.20260820.205.1.g2c13bd91',
      releaseNotes:
        'Provider 업데이트 로딩 안정성을 개선했습니다.\nVideo 재생 프레임 전달을 최적화했습니다.',
      progress: {
        percent: 63.4,
        bytesPerSecond: 5_800_000,
        transferred: 63_400_000,
        total: 100_000_000,
      },
    },
  },
} satisfies Story;

export const ReadyToRestart = {
  args: {
    state: {
      phase: 'downloaded',
      origin: 'automatic',
      channel: 'staging',
      currentVersion: '3.0.0-staging.12',
      latestVersion: '3.0.0-staging.13',
      releaseNotes: 'The update was downloaded successfully.',
      progress: {
        percent: 100,
        bytesPerSecond: 0,
        transferred: 100_000_000,
        total: 100_000_000,
      },
    },
  },
} satisfies Story;

export const UpToDate = {
  args: {
    state: {
      phase: 'up-to-date',
      origin: 'manual',
      channel: 'stable',
      currentVersion: '3.0.0',
      latestVersion: '3.0.0',
    },
  },
} satisfies Story;

export const Error = {
  args: {
    state: {
      phase: 'error',
      origin: 'manual',
      channel: 'staging',
      currentVersion: '3.0.0-staging.12',
      error: 'The update server could not be reached.',
    },
  },
} satisfies Story;
