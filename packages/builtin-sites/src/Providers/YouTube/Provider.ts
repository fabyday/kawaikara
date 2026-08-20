import {
  SHORT_FORM_VIDEO_ACTIONS,
  SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING,
  SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING,
  provider,
  type ProviderSettingListItem,
  type ProviderSettings,
  type ShortFormVideoPublisher,
} from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import { UrlProvider } from '../../UrlProvider';
import {
  createYouTubeShortsCommandScript,
  createYouTubeShortsInjectionScript,
  createYouTubeShortsPublisherScript,
  type YouTubeShortsInjectionOptions,
} from './Inject/Shorts';

@provider({
  id: 'kawaikara.youtube',
  address: { hosts: ['youtube.com', 'youtu.be'] },
  title: 'YouTube',
  shortcut: { defaultKey: 'Control+Alt+5' },
  settings: {
    categories: [{
      id: 'shorts',
      title: { 'en-US': 'Shorts', 'ko-KR': '쇼츠', 'ja-JP': 'Shorts' },
      description: {
        'en-US': 'Control Shorts playback and publishers hidden from the feed.',
        'ko-KR': '쇼츠 재생과 피드에서 숨길 게시자를 관리합니다.',
        'ja-JP': 'Shorts の再生とフィードから非表示にする投稿者を管理します。',
      },
      settings: [{
        type: 'boolean',
        key: SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING,
        title: {
          'en-US': 'Play the next Short automatically',
          'ko-KR': '다음 쇼츠 자동 재생',
          'ja-JP': '次の Shorts を自動再生',
        },
        defaultValue: true,
      }, {
        type: 'item-list',
        key: SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING,
        title: {
          'en-US': 'Banned publishers',
          'ko-KR': '차단한 게시자',
          'ja-JP': 'ブロックした投稿者',
        },
        description: {
          'en-US': 'Shorts from these publishers are skipped automatically.',
          'ko-KR': '이 게시자의 쇼츠는 자동으로 건너뜁니다.',
          'ja-JP': 'これらの投稿者の Shorts は自動的にスキップされます。',
        },
        emptyText: {
          'en-US': 'No publishers are banned.',
          'ko-KR': '차단한 게시자가 없습니다.',
          'ja-JP': 'ブロックした投稿者はいません。',
        },
      }],
    }],
  },
  shortFormVideo: {
    previous: true,
    next: true,
    autoAdvance: {
      settingKey: SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING,
      defaultValue: true,
    },
    publisherBan: { settingKey: SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING },
  },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { defaultBrowserProfile: 'google' },
  menu: { category: 'Video', order: 10, icon: 'https://www.youtube.com/favicon.ico' },
  permissions: ['navigation', 'script-injection'],
})
export class YouTubeProvider extends UrlProvider {
  protected readonly url = 'https://www.youtube.com/';
  private autoAdvanceShorts = true;
  private bannedPublishers: readonly ProviderSettingListItem[] = [];
  private injectionInstalled = false;

  protected async afterLoad(): Promise<void> {
    await this.context.viewer.executeJavaScript(
      createYouTubeShortsInjectionScript(this.shortsOptions(false)),
    );
    this.injectionInstalled = true;
  }

  async onSettingsChanged(settings: ProviderSettings): Promise<void> {
    this.autoAdvanceShorts =
      typeof settings[SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING] === 'boolean'
        ? settings[SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING]
        : true;
    this.bannedPublishers = Array.isArray(
      settings[SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING],
    )
      ? settings[SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING] as readonly ProviderSettingListItem[]
      : [];
    if (!this.injectionInstalled) return;
    await this.context.viewer.executeJavaScript(
      createYouTubeShortsInjectionScript(this.shortsOptions(false)),
    );
  }

  async getShortFormVideoPublisher(): Promise<
    ShortFormVideoPublisher | undefined
  > {
    const value = await this.context.viewer.executeJavaScript(
      createYouTubeShortsPublisherScript(),
    ) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || !candidate.id.trim()) return undefined;
    return {
      id: candidate.id.trim(),
      label: typeof candidate.label === 'string' && candidate.label.trim()
        ? candidate.label.trim()
        : candidate.id.trim(),
      handle: typeof candidate.handle === 'string' && candidate.handle.trim()
        ? candidate.handle.trim()
        : undefined,
      imageUrl: typeof candidate.imageUrl === 'string' &&
        candidate.imageUrl.startsWith('https://')
        ? candidate.imageUrl
        : undefined,
    };
  }

  async onAction(action: string): Promise<boolean> {
    if (action === SHORT_FORM_VIDEO_ACTIONS.next) {
      await this.runShortsCommand('next');
      return true;
    }
    if (action === SHORT_FORM_VIDEO_ACTIONS.previous) {
      await this.runShortsCommand('previous');
      return true;
    }
    if (action === SHORT_FORM_VIDEO_ACTIONS.announceAutoAdvance) {
      await this.runShortsCommand('announce');
      return true;
    }
    if (action === SHORT_FORM_VIDEO_ACTIONS.announcePublisherBan) {
      await this.runShortsCommand('ban');
      return true;
    }
    return false;
  }

  allowPictureInPicture(value: string): boolean {
    const match =
      /^https:\/\/(?:www\.|m\.)?youtube\.com(\/[^?#]*)?(?:\?([^#]*))?(?:#|$)/i.exec(
        value,
      );
    if (!match) return false;
    const pathname = match[1] ?? '/';
    const query = match[2] ?? '';
    return (
      (pathname === '/watch' && /(?:^|&)v=[^&]+/.test(query)) ||
      /^\/(?:shorts|live)\/[^/]+\/?$/.test(pathname)
    );
  }

  private async runShortsCommand(
    command: 'next' | 'previous' | 'announce' | 'ban',
  ): Promise<void> {
    const handled = await this.context.viewer.executeJavaScript<boolean>(
      createYouTubeShortsCommandScript(command),
    );
    if (!handled && (command === 'next' || command === 'previous')) {
      this.context.viewer.sendKeyPress(
        command === 'next' ? 'ArrowDown' : 'ArrowUp',
      );
    }
  }

  private shortsOptions(announce: boolean): YouTubeShortsInjectionOptions {
    return {
      autoAdvance: this.autoAdvanceShorts,
      bannedPublishers: this.bannedPublishers,
      announce,
      labels: resolveShortsLabels(this.context.locale?.site),
    };
  }
}

function resolveShortsLabels(
  locale?: string,
): YouTubeShortsInjectionOptions['labels'] {
  if (locale?.toLowerCase().startsWith('ko')) {
    return {
      enabled: '쇼츠 자동 넘김 켜짐',
      disabled: '쇼츠 자동 넘김 꺼짐',
      banned: '이 게시자를 차단했습니다',
      next: '다음 쇼츠',
      previous: '이전 쇼츠',
    };
  }
  if (locale?.toLowerCase().startsWith('ja')) {
    return {
      enabled: 'Shorts 自動送り オン',
      disabled: 'Shorts 自動送り オフ',
      banned: 'この投稿者をブロックしました',
      next: '次の Shorts',
      previous: '前の Shorts',
    };
  }
  return {
    enabled: 'Shorts auto-advance on',
    disabled: 'Shorts auto-advance off',
    banned: 'Publisher banned',
    next: 'Next Short',
    previous: 'Previous Short',
  };
}
