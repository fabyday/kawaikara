import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.youtube',
  address: { hosts: ['youtube.com', 'youtu.be'] },
  title: 'YouTube',
  shortcut: { defaultKey: 'Control+Alt+5' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { defaultBrowserProfile: 'google' },
  menu: { category: 'Video', order: 10, icon: 'https://www.youtube.com/favicon.ico' },
  permissions: ['navigation', 'script-injection'],
})
export class YouTubeSite extends UrlSiteDescriptor {
  protected readonly url = 'https://www.youtube.com/';

  protected async afterLoad(): Promise<void> {
    await this.context.viewer.executeJavaScript(`
      (() => {
        document.documentElement.dataset.kawaikaraSite = 'youtube';
        if (window.__kawaikaraYouTubeShorts) return;

        const state = {
          advancing: false,
          lastAdvancedUrl: undefined,
          progressGeneration: 0,
        };
        window.__kawaikaraYouTubeShorts = state;

        const progressByVideo = new WeakMap();

        const isShortsPage = () =>
          /^\\/shorts\\/[^/?#]+\\/?$/.test(location.pathname);
        const isActiveShortsVideo = (candidate) => {
          if (!(candidate instanceof HTMLVideoElement) || !candidate.isConnected) {
            return false;
          }
          const rect = candidate.getBoundingClientRect();
          const visibleWidth = Math.max(
            0,
            Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
          );
          const visibleHeight = Math.max(
            0,
            Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
          );
          const area = rect.width * rect.height;
          return (
            candidate.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            area > 0 &&
            (visibleWidth * visibleHeight) / area >= 0.5
          );
        };
        const advanceToNextShort = (video) => {
          if (
            !isShortsPage() ||
            state.advancing ||
            state.lastAdvancedUrl === location.href ||
            !isActiveShortsVideo(video)
          ) {
            return;
          }

          const currentUrl = location.href;
          const nextButton = document.querySelector(
            'ytd-shorts #navigation-button-down button',
          );
          if (!(nextButton instanceof HTMLButtonElement) || nextButton.disabled) {
            return;
          }
          state.advancing = true;
          state.lastAdvancedUrl = currentUrl;
          nextButton.click();
          setTimeout(() => {
            state.advancing = false;
            if (location.href === currentUrl) state.lastAdvancedUrl = undefined;
          }, 1200);
        };

        document.addEventListener(
          'ended',
          (event) => {
            const video = event.target;
            if (video instanceof HTMLVideoElement) progressByVideo.delete(video);
            advanceToNextShort(video);
          },
          true,
        );
        document.addEventListener(
          'timeupdate',
          (event) => {
            const video = event.target;
            if (!(video instanceof HTMLVideoElement)) return;
            if (
              !isShortsPage() ||
              !isActiveShortsVideo(video) ||
              video.paused ||
              video.ended ||
              !Number.isFinite(video.duration) ||
              video.duration <= 0 ||
              !Number.isFinite(video.currentTime)
            ) {
              progressByVideo.delete(video);
              return;
            }

            const now = performance.now();
            const progress = {
              currentTime: video.currentTime,
              duration: video.duration,
              generation: state.progressGeneration,
              observedAt: now,
              url: location.href,
            };
            const previous = progressByVideo.get(video);
            progressByVideo.set(video, progress);
            if (
              !previous ||
              previous.url !== progress.url ||
              previous.generation !== progress.generation
            ) {
              return;
            }

            // Shorts videos loop instead of emitting the ended event. Advance only after
            // a real end-to-start wrap; being close to the end is not completion.
            const endThreshold = Math.min(
              1,
              Math.max(0.35, Math.abs(video.playbackRate) * 0.5),
            );
            const wrappedAtEnd =
              previous.currentTime >= previous.duration - endThreshold &&
              progress.currentTime <= endThreshold &&
              previous.currentTime - progress.currentTime >=
                progress.duration * 0.5 &&
              now - previous.observedAt <= 2000;
            if (wrappedAtEnd) {
              advanceToNextShort(video);
            }
          },
          true,
        );
        document.addEventListener(
          'kawaikara:picture-in-picture-transition',
          () => {
            state.progressGeneration += 1;
          },
          true,
        );
      })();
    `);
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
}
