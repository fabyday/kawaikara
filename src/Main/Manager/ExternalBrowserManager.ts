import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import type { CookiesSetDetails, Session } from 'electron';
import {
  chromium,
  type BrowserContext,
  type Cookie,
  type Frame,
  type Page,
} from 'patchright';
import type {
  ExternalLoginOptions,
  ExternalLoginResult,
} from '@kawaikara/site-api';

interface ActiveLogin {
  cancel(): Promise<void>;
}

export class ExternalBrowserManager {
  private activeLogin?: ActiveLogin;

  async login(
    options: ExternalLoginOptions,
    targetSession: Session,
  ): Promise<ExternalLoginResult> {
    await this.close();

    const completionPattern = new RegExp(
      options.completionUrlPattern,
      options.completionUrlFlags,
    );
    const profilePath = await mkdtemp(
      path.join(os.tmpdir(), 'kawaikara-external-login-'),
    );

    let browserContext: BrowserContext | undefined;
    try {
      browserContext = await this.launchBrowser(profilePath);
      const page =
        browserContext.pages()[0] ?? (await browserContext.newPage());
      const result = await this.waitForLogin(
        browserContext,
        page,
        profilePath,
        completionPattern,
        options.startUrl,
        targetSession,
      );
      return result;
    } catch (error) {
      if (browserContext) {
        await browserContext.close().catch(() => undefined);
      }
      await removeTemporaryProfile(profilePath);
      throw error;
    }
  }

  async close(): Promise<void> {
    const activeLogin = this.activeLogin;
    if (!activeLogin) {
      return;
    }
    await activeLogin.cancel();
  }

  private async launchBrowser(profilePath: string): Promise<BrowserContext> {
    const args = ['--app=data:text/html,<html></html>'];
    const channels = ['chrome', 'msedge'] as const;
    const launchErrors: unknown[] = [];

    for (const channel of channels) {
      try {
        return await chromium.launchPersistentContext(profilePath, {
          channel,
          headless: false,
          args,
        });
      } catch (error) {
        launchErrors.push(error);
      }
    }

    try {
      return await chromium.launchPersistentContext(profilePath, {
        headless: false,
        args,
      });
    } catch (error) {
      launchErrors.push(error);
      throw new AggregateError(
        launchErrors,
        'Chrome, Edge, or the Patchright Chromium browser could not be launched.',
      );
    }
  }

  private async waitForLogin(
    browserContext: BrowserContext,
    page: Page,
    profilePath: string,
    completionPattern: RegExp,
    startUrl: string,
    targetSession: Session,
  ): Promise<ExternalLoginResult> {
    let settled = false;
    let emptyWindowTimer: ReturnType<typeof setTimeout> | undefined;
    const trackedPages = new Map<Page, () => void>();

    return await new Promise<ExternalLoginResult>((resolve, reject) => {
      const cleanup = async (): Promise<void> => {
        if (emptyWindowTimer !== undefined) clearTimeout(emptyWindowTimer);
        browserContext.off('page', onPageCreated);
        browserContext.off('close', onContextClosed);
        for (const [trackedPage, closeListener] of trackedPages) {
          trackedPage.off('framenavigated', onFrameNavigated);
          trackedPage.off('close', closeListener);
        }
        trackedPages.clear();
        if (this.activeLogin?.cancel === cancel) {
          this.activeLogin = undefined;
        }
        await browserContext.close().catch(() => undefined);
        void removeTemporaryProfile(profilePath).catch((error: unknown) => {
          console.warn(
            `Temporary external-login profile cleanup failed: ${profilePath}`,
            error,
          );
        });
      };

      const finish = async (
        result: ExternalLoginResult,
        error?: unknown,
      ): Promise<void> => {
        if (settled) {
          return;
        }
        settled = true;

        try {
          if (result === 'completed') {
            await this.syncCookies(await browserContext.cookies(), targetSession);
          }
        } catch (syncError) {
          error = syncError;
        } finally {
          await cleanup().catch((cleanupError: unknown) => {
            console.warn(
              `External login cleanup did not finish for ${profilePath}.`,
              cleanupError,
            );
          });
        }

        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      };

      const cancel = async (): Promise<void> => {
        await finish('cancelled');
      };

      const onFrameNavigated = (frame: Frame): void => {
        if (frame !== frame.page().mainFrame()) {
          return;
        }
        completionPattern.lastIndex = 0;
        if (completionPattern.test(frame.url())) {
          void finish('completed');
        }
      };

      const onPageCreated = (nextPage: Page): void => {
        if (emptyWindowTimer !== undefined) {
          clearTimeout(emptyWindowTimer);
          emptyWindowTimer = undefined;
        }
        if (trackedPages.has(nextPage)) return;
        const onPageClosed = () => {
          trackedPages.delete(nextPage);
          if (settled || trackedPages.size > 0) return;
          // Some Windows login flows replace the app-mode page with a new
          // page. Allow a brief hand-off before treating the browser as closed.
          emptyWindowTimer = setTimeout(() => {
            emptyWindowTimer = undefined;
            if (
              !settled &&
              browserContext.pages().every((candidate) => candidate.isClosed())
            ) {
              void finish('cancelled');
            }
          }, 750);
        };
        trackedPages.set(nextPage, onPageClosed);
        nextPage.on('framenavigated', onFrameNavigated);
        nextPage.once('close', onPageClosed);
      };

      const onContextClosed = (): void => {
        void finish('cancelled');
      };

      this.activeLogin = { cancel };
      browserContext.on('page', onPageCreated);
      browserContext.once('close', onContextClosed);
      for (const existingPage of browserContext.pages()) {
        onPageCreated(existingPage);
      }

      void page.goto(startUrl).catch((error: unknown) => {
        // Login SPAs can replace the first document while goto is waiting.
        // Patchright reports that successful hand-off as ERR_ABORTED.
        if (!isExpectedNavigationInterruption(error)) {
          void finish('cancelled', error);
        }
      });
    });
  }

  private async syncCookies(cookies: Cookie[], targetSession: Session): Promise<void> {
    const results = await Promise.allSettled(
      cookies.map((cookie) =>
        targetSession.cookies.set(this.toElectronCookie(cookie)),
      ),
    );
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      console.warn(
        `External login completed, but ${failures.length} cookie(s) could not be synchronized.`,
      );
    }
    await targetSession.cookies.flushStore();
  }

  private toElectronCookie(cookie: Cookie): CookiesSetDetails {
    const domain = cookie.domain.replace(/^\./, '');
    const cookiePath = cookie.path || '/';
    const details: CookiesSetDetails = {
      url: `${cookie.secure ? 'https' : 'http'}://${domain}${cookiePath}`,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookiePath,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite:
        cookie.sameSite === 'None'
          ? 'no_restriction'
          : cookie.sameSite.toLowerCase() as 'lax' | 'strict',
    };

    if (cookie.expires > 0) {
      details.expirationDate = cookie.expires;
    }

    return details;
  }
}

function isExpectedNavigationInterruption(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:net::)?ERR_ABORTED|navigation.*(?:interrupted|aborted)/i.test(message);
}

async function removeTemporaryProfile(profilePath: string): Promise<void> {
  const retryDelays = [0, 80, 220, 500, 1_000] as const;
  let lastError: unknown;
  for (const delay of retryDelays) {
    if (delay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
    try {
      await rm(profilePath, { recursive: true, force: true, maxRetries: 2 });
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableProfileCleanupError(error)) throw error;
    }
  }
  console.warn(
    `Temporary external-login profile is still locked and will be left for the operating system to clean: ${profilePath}`,
    lastError,
  );
}

function isRetryableProfileCleanupError(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : '';
  return code === 'EBUSY' || code === 'EPERM' || code === 'ENOTEMPTY';
}
