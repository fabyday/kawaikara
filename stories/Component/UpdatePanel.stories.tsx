import type { Meta, StoryObj } from '@storybook/react-vite';
import { UpdatePanel } from '../../src/Renderer/View/Update/UpdatePanel';

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/Update Panel',
  /** The component value. */
  component: UpdatePanel,
  /** The tags value. */
  tags: ['autodocs'],
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'fullscreen' },
  /** The args value. */
  args: {
    /** The locale value. */
    locale: 'en-US',
    /** The state value. */
    state: {
      /** The phase value. */
      phase: 'available',
      /** The origin value. */
      origin: 'manual',
      /** The channel value. */
      channel: 'staging',
      /** The current version value. */
      currentVersion: '3.0.0-staging.12',
      /** The latest version value. */
      latestVersion: '3.0.0-staging.13',
      /** The release notes value. */
      releaseNotes:
        'Provider sessions are now isolated by profile.\n\nVideo playback and Picture in Picture transitions are smoother.',
    },
    /** The on dismiss value. */
    onDismiss: () => undefined,
    /** The on download value. */
    onDownload: () => undefined,
    /** The on install value. */
    onInstall: () => undefined,
    /** The on retry value. */
    onRetry: () => undefined,
  },
} satisfies Meta<typeof UpdatePanel>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the update available value. */
export const UpdateAvailable = {} satisfies Story;

/** Stores the release notes value. */
export const ReleaseNotes = {
  /** The args value. */
  args: {
    /** The locale value. */
    locale: 'ko-KR',
    /** The initial view value. */
    initialView: 'release-notes',
    /** The state value. */
    state: {
      /** The phase value. */
      phase: 'available',
      /** The origin value. */
      origin: 'manual',
      /** The channel value. */
      channel: 'staging',
      /** The current version value. */
      currentVersion: '3.0.0-staging.12',
      /** The latest version value. */
      latestVersion: '3.0.0-staging.13',
      /** The release notes value. */
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

/** Stores the checking value. */
export const Checking = {
  /** The args value. */
  args: {
    /** The state value. */
    state: {
      /** The phase value. */
      phase: 'checking',
      /** The origin value. */
      origin: 'manual',
      /** The channel value. */
      channel: 'stable',
      /** The current version value. */
      currentVersion: '3.0.0',
    },
  },
} satisfies Story;

/** Stores the downloading automatically value. */
export const DownloadingAutomatically = {
  /** The args value. */
  args: {
    /** The locale value. */
    locale: 'ko-KR',
    /** The state value. */
    state: {
      /** The phase value. */
      phase: 'downloading',
      /** The origin value. */
      origin: 'automatic',
      /** The channel value. */
      channel: 'nightly',
      /** The current version value. */
      currentVersion: '3.0.0-nightly.20260819.204.1.g891f02a1',
      /** The latest version value. */
      latestVersion: '3.0.0-nightly.20260820.205.1.g2c13bd91',
      /** The release notes value. */
      releaseNotes:
        'Provider 업데이트 로딩 안정성을 개선했습니다.\nVideo 재생 프레임 전달을 최적화했습니다.',
      /** The progress value. */
      progress: {
        /** The percent value. */
        percent: 63.4,
        /** The bytes per second value. */
        bytesPerSecond: 5_800_000,
        /** The transferred value. */
        transferred: 63_400_000,
        /** The total value. */
        total: 100_000_000,
      },
    },
  },
} satisfies Story;

/** Stores the ready to restart value. */
export const ReadyToRestart = {
  /** The args value. */
  args: {
    /** The state value. */
    state: {
      /** The phase value. */
      phase: 'downloaded',
      /** The origin value. */
      origin: 'automatic',
      /** The channel value. */
      channel: 'staging',
      /** The current version value. */
      currentVersion: '3.0.0-staging.12',
      /** The latest version value. */
      latestVersion: '3.0.0-staging.13',
      /** The release notes value. */
      releaseNotes: 'The update was downloaded successfully.',
      /** The progress value. */
      progress: {
        /** The percent value. */
        percent: 100,
        /** The bytes per second value. */
        bytesPerSecond: 0,
        /** The transferred value. */
        transferred: 100_000_000,
        /** The total value. */
        total: 100_000_000,
      },
    },
  },
} satisfies Story;

/** Stores the up to date value. */
export const UpToDate = {
  /** The args value. */
  args: {
    /** The state value. */
    state: {
      /** The phase value. */
      phase: 'up-to-date',
      /** The origin value. */
      origin: 'manual',
      /** The channel value. */
      channel: 'stable',
      /** The current version value. */
      currentVersion: '3.0.0',
      /** The latest version value. */
      latestVersion: '3.0.0',
    },
  },
} satisfies Story;

/** Stores the error value. */
export const Error = {
  /** The args value. */
  args: {
    /** The state value. */
    state: {
      /** The phase value. */
      phase: 'error',
      /** The origin value. */
      origin: 'manual',
      /** The channel value. */
      channel: 'staging',
      /** The current version value. */
      currentVersion: '3.0.0-staging.12',
      /** The error value. */
      error: 'The update server could not be reached.',
    },
  },
} satisfies Story;
