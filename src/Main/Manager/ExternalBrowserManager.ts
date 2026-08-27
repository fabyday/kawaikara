import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import type {
  Cookie as ElectronCookie,
  CookiesSetDetails,
  Session,
  WebContents,
} from 'electron';
import {
  chromium,
  type BrowserContext,
  type Cookie,
  type Frame,
  type Page,
  type Request,
} from 'patchright';
import type {
  ExternalLoginOptions,
  ExternalLoginResult,
} from '@kawaikara/site-api';
import {
  createCookieJarFingerprint,
  formatObservedUrl,
  isExpectedNavigationInterruption,
  isGoogleLoginCookie,
  isGoogleMultiLoginCookie,
  normalizeCookieDomain,
  removeTemporaryProfile,
  validateResetOrigins,
  type ActiveExternalLogin,
} from '../Functional/ExternalBrowser';
import { getKawaiDataPath } from '../Functional/UserDataPaths';

/** Coordinates external browser behavior. */
export class ExternalBrowserManager {
  /** Whether the active login option is enabled. */
  private activeLogin?: ActiveExternalLogin;
  /** The browser cleanup value. */
  private browserCleanup?: Promise<void>;
  /** The removed legacy browser state value. */
  private removedLegacyBrowserState = false;

  /** Performs the login operation. */
  async login(
    options: ExternalLoginOptions,
    targetSession: Session,
    targetWebContents: WebContents,
  ): Promise<ExternalLoginResult> {
    await this.close();
    await this.browserCleanup;
    await this.removeLegacyPersistentBrowserState();

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
      if (options.seedSessionCookies) {
        await this.seedBrowserCookies(browserContext, targetSession);
      }
      const page =
        browserContext.pages()[0] ?? (await browserContext.newPage());
      const result = await this.waitForLogin(
        browserContext,
        page,
        profilePath,
        completionPattern,
        options.startUrl,
        targetSession,
        targetWebContents,
        options.resetSessionOrigins,
        options.replaceSessionCookies === true,
        options.cookieImportMode,
        options.awaitBrowserCleanup === true,
        options.cookieSettleMs,
        options.autoActivate,
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

  /** Closes the operation. */
  async close(): Promise<void> {
    const activeLogin = this.activeLogin;
    if (activeLogin) await activeLogin.cancel();
    await this.browserCleanup;
  }

  /** Performs the launch browser operation. */
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

    throw new AggregateError(
      launchErrors,
      'Chrome or Edge could not be launched for external login.',
    );
  }

  /** Waits for the for login. */
  private async waitForLogin(
    browserContext: BrowserContext,
    page: Page,
    profilePath: string,
    completionPattern: RegExp,
    startUrl: string,
    targetSession: Session,
    targetWebContents: WebContents,
    resetSessionOrigins?: readonly string[],
    replaceSessionCookies = false,
    cookieImportMode: ExternalLoginOptions['cookieImportMode'] = 'preserve-source',
    awaitBrowserCleanup = false,
    cookieSettleMs = 0,
    autoActivate?: ExternalLoginOptions['autoActivate'],
  ): Promise<ExternalLoginResult> {
    let settled = false;
    let emptyWindowTimer: ReturnType<typeof setTimeout> | undefined;
    let completionPollTimer: ReturnType<typeof setInterval> | undefined;
    const trackedPages = new Map<Page, () => void>();
    const loginStartedAt = Date.now();

    return await new Promise<ExternalLoginResult>((resolve, reject) => {
      /** Performs the cleanup operation. */
      const cleanup = async (): Promise<void> => {
        if (emptyWindowTimer !== undefined) clearTimeout(emptyWindowTimer);
        if (completionPollTimer !== undefined) clearInterval(completionPollTimer);
        browserContext.off('page', onPageCreated);
        browserContext.off('close', onContextClosed);
        for (const [trackedPage, closeListener] of trackedPages) {
          trackedPage.off('framenavigated', onFrameNavigated);
          trackedPage.off('request', onRequest);
          trackedPage.off('load', onPageLoad);
          trackedPage.off('close', closeListener);
        }
        trackedPages.clear();
        if (this.activeLogin?.cancel === cancel) {
          this.activeLogin = undefined;
        }
        await browserContext.close().catch(() => undefined);
        await removeTemporaryProfile(profilePath).catch((error: unknown) => {
          console.warn(
            `Temporary external-login profile cleanup failed: ${profilePath}`,
            error,
          );
        });
      };

      /** Performs the finish operation. */
      const finish = async (
        result: ExternalLoginResult,
        error?: unknown,
      ): Promise<void> => {
        if (settled) {
          return;
        }
        settled = true;

        const completionStartedAt = Date.now();
        if (result === 'completed') {
          console.info('External login completion detected.', {
            elapsedMs: completionStartedAt - loginStartedAt,
            pages: [...trackedPages.keys()]
              .filter((trackedPage) => !trackedPage.isClosed())
              .map((trackedPage) => formatObservedUrl(trackedPage.url())),
          });
        }
        let cookies: Cookie[] = [];
        try {
          if (result === 'completed') {
            cookies = await this.captureSettledCookies(
              browserContext,
              cookieSettleMs,
            );
            const googleCookieCount = cookies.filter(isGoogleLoginCookie).length;
            if (googleCookieCount > 0) {
              console.info('External Google login cookie capture completed.', {
                googleCookieCount,
                hasMultiLoginCookie: cookies.some(isGoogleMultiLoginCookie),
              });
            }
          }
        } catch (cookieError) {
          error = cookieError;
        }

        let cleanupPromise: Promise<void> | undefined;
        /** Starts the cleanup. */
        const startCleanup = (): Promise<void> => {
          if (cleanupPromise) return cleanupPromise;
          cleanupPromise = cleanup().catch((cleanupError: unknown) => {
            console.warn(
              `External login cleanup did not finish for ${profilePath}.`,
              cleanupError,
            );
          });
          const trackedCleanup = cleanupPromise.finally(() => {
            if (this.browserCleanup === trackedCleanup) {
              this.browserCleanup = undefined;
            }
          });
          this.browserCleanup = trackedCleanup;
          return cleanupPromise;
        };

        // Most services can close Chrome while Electron imports the captured
        // cookies. Coupang's last known-good flow performs the import first and
        // does not restore its viewer until Chrome has completely exited.
        if (!awaitBrowserCleanup) startCleanup();

        try {
          if (result === 'completed' && !error) {
            await this.replaceSessionLogin(
              cookies,
              targetSession,
              targetWebContents,
              resetSessionOrigins,
              replaceSessionCookies,
              cookieImportMode,
            );
            console.info('External login Session synchronization completed.', {
              cookieCount: cookies.length,
              durationMs: Date.now() - completionStartedAt,
            });
          }
        } catch (syncError) {
          error = syncError;
        }
        const activeCleanup = startCleanup();
        if (result !== 'completed' || error || awaitBrowserCleanup) {
          await activeCleanup;
        } else {
          // Cookie writes are already visible to the target Electron Session.
          // Do not keep its viewer on the waiting screen while Patchright waits
          // for the now-hidden browser process to finish shutting down.
          console.info('External login is ready to restore the viewer.', {
            durationMs: Date.now() - completionStartedAt,
          });
          void activeCleanup.then(() => {
            console.info('External login browser cleanup completed.', {
              durationMs: Date.now() - completionStartedAt,
            });
          });
        }

        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      };

      /** Determines whether the cel condition applies. */
      const cancel = async (): Promise<void> => {
        await finish('cancelled');
      };

      /** Performs the matches completion operation. */
      const matchesCompletion = (url: string): boolean => {
        completionPattern.lastIndex = 0;
        return completionPattern.test(url);
      };

      /** Performs the check tracked page URLs operation. */
      const checkTrackedPageUrls = (): void => {
        for (const trackedPage of trackedPages.keys()) {
          if (!trackedPage.isClosed() && matchesCompletion(trackedPage.url())) {
            void finish('completed');
            return;
          }
        }
      };

      /** Handles the frame navigated. */
      const onFrameNavigated = (frame: Frame): void => {
        if (frame !== frame.page().mainFrame()) {
          return;
        }
        if (matchesCompletion(frame.url())) void finish('completed');
      };

      /** Handles the request. */
      const onRequest = (request: Request): void => {
        const requestPage = request.frame().page();
        if (
          request.resourceType() === 'document' &&
          request.frame() === requestPage.mainFrame() &&
          matchesCompletion(requestPage.url())
        ) {
          void finish('completed');
          return;
        }
        // Match the main-branch behavior: a request *toward* the completion
        // URL is not enough. Google can still be finishing multi-login cookie
        // changes while a YouTube document request has already started.
        if (request.resourceType() === 'document') setTimeout(checkTrackedPageUrls, 0);
      };

      /** Handles the page load. */
      const onPageLoad = (): void => checkTrackedPageUrls();

      /** Handles the page created. */
      const onPageCreated = (nextPage: Page): void => {
        if (emptyWindowTimer !== undefined) {
          clearTimeout(emptyWindowTimer);
          emptyWindowTimer = undefined;
        }
        if (trackedPages.has(nextPage)) return;
        /** Handles the page closed. */
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
        nextPage.on('request', onRequest);
        nextPage.on('load', onPageLoad);
        nextPage.once('close', onPageClosed);
      };

      /** Handles the context closed. */
      const onContextClosed = (): void => {
        void finish('cancelled');
      };

      this.activeLogin = { cancel
      };
      browserContext.on('page', onPageCreated);
      browserContext.once('close', onContextClosed);
      for (const existingPage of browserContext.pages()) {
        onPageCreated(existingPage);
      }
      completionPollTimer = setInterval(checkTrackedPageUrls, 250);

      if (autoActivate) {
        void this.autoActivateLoginControl(page, autoActivate).catch(
          (error: unknown) => {
            if (!page.isClosed()) {
              console.warn(
                'External login control could not be activated automatically.',
                error,
              );
            }
          },
        );
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

  /** Performs the auto activate login control operation. */
  private async autoActivateLoginControl(
    page: Page,
    options: NonNullable<ExternalLoginOptions['autoActivate']>,
  ): Promise<void> {
    const fallbackLabels = (options.fallbackLabels ?? [])
      .map((label) => label.replace(/\s+/g, ' ').trim().toLowerCase())
      .filter(Boolean);
    // The start page is an SPA, so its login controls can appear well after
    // the first document load. Poll only this temporary page and stop as soon
    // as the original Kawaikara click has been replayed once.
    for (let attempt = 0; attempt < 40 && !page.isClosed(); attempt += 1) {
      const activated = await page.evaluate(
        ({ selector, labels }) => {
          let direct: Element | null = null;
          try {
            direct = document.querySelector(selector);
          } catch {
            return false;
          }
          /** Performs the label of operation. */
          const labelOf = (element: Element): string => [
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
            element.textContent,
          ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
          const semantic = Array.from(document.querySelectorAll(
            'a,button,[role="button"]',
          )).find((element) =>
            labels.some((label) => labelOf(element).includes(label))
          );
          const control = direct ?? semantic;
          if (!(control instanceof HTMLElement)) return false;
          control.click();
          return true;
        },
        { selector: options.selector, labels: fallbackLabels
        },
      ).catch(() => false);
      if (activated) {
        console.info('Activated the external login control automatically.');
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    }
    if (!page.isClosed()) {
      console.warn('External login control was not found for automatic activation.');
    }
  }

  /** Performs the sync cookies operation. */
  private async syncCookies(
    cookies: Cookie[],
    targetSession: Session,
    targetWebContents: WebContents,
    cookieImportMode: ExternalLoginOptions['cookieImportMode'],
  ): Promise<void> {
    const supportedCookies = cookies.filter((cookie) => !cookie.partitionKey);
    const partitionedCookies = cookies.filter((cookie) => cookie.partitionKey);
    const results = await Promise.allSettled(
      supportedCookies.map((cookie) =>
        targetSession.cookies.set(
          this.toElectronCookie(cookie, cookieImportMode),
        ),
      ),
    );
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      console.warn(
        `External login completed, but ${failures.length} cookie(s) could not be synchronized.`,
      );
    }
    if (partitionedCookies.length > 0) {
      await this.syncPartitionedCookies(partitionedCookies, targetWebContents);
    }
    await targetSession.cookies.flushStore();
    await this.verifyCookieSynchronization(supportedCookies, targetSession);
  }

  /** Performs the capture settled cookies operation. */
  private async captureSettledCookies(
    browserContext: BrowserContext,
    stabilityMs: number,
  ): Promise<Cookie[]> {
    const requiredStabilityMs = Math.max(0, Math.min(stabilityMs, 10_000));
    if (requiredStabilityMs === 0) return await browserContext.cookies();

    const startedAt = Date.now();
    const maximumWaitMs = Math.min(
      10_000,
      Math.max(2_000, requiredStabilityMs * 4),
    );
    let stableSince = startedAt;
    let previousFingerprint: string | undefined;
    let latestCookies: Cookie[] = [];

    while (Date.now() - startedAt < maximumWaitMs) {
      latestCookies = await browserContext.cookies();
      const fingerprint = createCookieJarFingerprint(latestCookies);
      const sampledAt = Date.now();
      if (fingerprint !== previousFingerprint) {
        previousFingerprint = fingerprint;
        stableSince = sampledAt;
      } else if (sampledAt - stableSince >= requiredStabilityMs) {
        console.info('External login cookie jar stabilized.', {
          durationMs: sampledAt - startedAt,
          cookieCount: latestCookies.length,
        });
        return latestCookies;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
    }

    console.info('External login cookie stability wait reached its limit.', {
      durationMs: Date.now() - startedAt,
      cookieCount: latestCookies.length,
    });
    return latestCookies;
  }

  /** Performs the seed browser cookies operation. */
  private async seedBrowserCookies(
    browserContext: BrowserContext,
    targetSession: Session,
  ): Promise<void> {
    const cookies = await targetSession.cookies.get({});
    const converted = cookies.map((cookie) => this.toBrowserCookie(cookie));
    if (converted.length === 0) return;

    try {
      await browserContext.addCookies(converted);
      console.info('Seeded external login with the existing Session cookies.', {
        cookieCount: converted.length,
      });
      return;
    } catch (batchError) {
      console.debug(
        'External login cookie seeding is retrying incompatible cookies individually.',
        batchError,
      );
    }

    const results = await Promise.allSettled(
      converted.map((cookie) => browserContext.addCookies([cookie])),
    );
    const failures = results.filter((result) => result.status === 'rejected');
    console.info('Seeded external login with the compatible Session cookies.', {
      cookieCount: converted.length - failures.length,
      skippedCount: failures.length,
    });
  }

  /** Replaces the session login. */
  private async replaceSessionLogin(
    cookies: Cookie[],
    targetSession: Session,
    targetWebContents: WebContents,
    resetSessionOrigins?: readonly string[],
    replaceSessionCookies = false,
    cookieImportMode: ExternalLoginOptions['cookieImportMode'] = 'preserve-source',
  ): Promise<void> {
    const origins = validateResetOrigins(resetSessionOrigins ?? []);
    if (origins.length > 0 || replaceSessionCookies) {
      await targetSession.closeAllConnections();
    }
    if (origins.length > 0) {
      await targetSession.clearData({
        dataTypes: [
          'cache',
          'cookies',
          'indexedDB',
          'localStorage',
          'serviceWorkers',
        ],
        origins,
        originMatchingMode: 'origin-in-all-contexts',
      });
    }
    if (replaceSessionCookies) {
      if (cookies.length === 0) {
        throw new Error(
          'External login completed without cookies; the Electron Session was left unchanged.',
        );
      }
      const previousCookieCount = (await targetSession.cookies.get({})).length;
      await targetSession.clearData({ dataTypes: ['cookies']
      });
      console.info('Cleared the target Session cookie jar before import.', {
        previousCookieCount,
      });
    }
    await this.syncCookies(
      cookies,
      targetSession,
      targetWebContents,
      cookieImportMode,
    );
    await targetSession.flushStorageData();
    await targetSession.closeAllConnections();
  }

  /** Performs the to Electron cookie operation. */
  private toElectronCookie(
    cookie: Cookie,
    cookieImportMode: ExternalLoginOptions['cookieImportMode'],
  ): CookiesSetDetails {
    const domain = cookie.domain.replace(/^\./, '');
    const cookiePath = cookie.path || '/';
    const useDomainScopedHttps = cookieImportMode === 'domain-scoped-https';
    const details: CookiesSetDetails = {
      url: `${useDomainScopedHttps || cookie.secure ? 'https' : 'http'}://${domain}${cookiePath}`,
      name: cookie.name,
      value: cookie.value,
      path: cookiePath,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite:
        cookie.sameSite === 'None'
          ? 'no_restriction'
          : cookie.sameSite.toLowerCase() as 'lax' | 'strict',
    };

    // Patchright preserves a leading dot for domain cookies. Omitting the
    // Domain attribute for host-only cookies is required for __Host- cookies
    // and preserves the source cookie's scope.
    if (useDomainScopedHttps || cookie.domain.startsWith('.')) {
      details.domain = cookie.domain;
    }

    if (cookie.expires > 0) {
      details.expirationDate = cookie.expires;
    }

    return details;
  }

  /** Performs the verify cookie synchronization operation. */
  private async verifyCookieSynchronization(
    expectedCookies: readonly Cookie[],
    targetSession: Session,
  ): Promise<void> {
    const storedCookies = await targetSession.cookies.get({});
    let matchedCount = 0;
    let missingCount = 0;
    let valueMismatchCount = 0;
    let duplicateIdentityCount = 0;

    for (const expected of expectedCookies) {
      const matches = storedCookies.filter((stored) =>
        stored.name === expected.name &&
        (stored.path || '/') === (expected.path || '/') &&
        normalizeCookieDomain(stored.domain) ===
          normalizeCookieDomain(expected.domain),
      );
      if (matches.length === 0) {
        missingCount += 1;
      } else if (matches.some((stored) => stored.value === expected.value)) {
        matchedCount += 1;
      } else {
        valueMismatchCount += 1;
      }
      if (matches.length > 1) duplicateIdentityCount += 1;
    }

    const statistics = {
      expectedCount: expectedCookies.length,
      matchedCount,
      missingCount,
      valueMismatchCount,
      duplicateIdentityCount,
      storedCookieCount: storedCookies.length,
    };
    if (missingCount > 0 || valueMismatchCount > 0) {
      console.warn('External login cookie verification found differences.', statistics);
    } else {
      console.info('External login cookie verification completed.', statistics);
    }
  }

  /** Performs the to browser cookie operation. */
  private toBrowserCookie(
    cookie: ElectronCookie,
  ): Parameters<BrowserContext['addCookies']>[0][number] {
    const domain = (cookie.domain ?? '').replace(/^\./, '');
    const cookiePath = cookie.path || '/';
    const converted: Parameters<BrowserContext['addCookies']>[0][number] = {
      name: cookie.name,
      value: cookie.value,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
    };

    if (cookie.hostOnly !== false) {
      // Patchright requires url XOR domain+path. Passing url and path together
      // rejected every host-only cookie, including Google account cookies.
      converted.url = `${cookie.secure ? 'https' : 'http'}://${domain}${cookiePath}`;
    } else {
      converted.domain = cookie.domain;
      converted.path = cookiePath;
    }
    if (!cookie.session && cookie.expirationDate && cookie.expirationDate > 0) {
      converted.expires = cookie.expirationDate;
    }
    if (cookie.sameSite === 'strict') converted.sameSite = 'Strict';
    if (cookie.sameSite === 'lax') converted.sameSite = 'Lax';
    if (cookie.sameSite === 'no_restriction') converted.sameSite = 'None';
    return converted;
  }

  /** Performs the sync partitioned cookies operation. */
  private async syncPartitionedCookies(
    cookies: Cookie[],
    targetWebContents: WebContents,
  ): Promise<void> {
    if (targetWebContents.isDestroyed()) {
      throw new Error('The target viewer was destroyed before cookie synchronization.');
    }

    const targetDebugger = targetWebContents.debugger;
    const alreadyAttached = targetDebugger.isAttached();
    if (!alreadyAttached) targetDebugger.attach('1.3');
    try {
      await targetDebugger.sendCommand('Storage.setCookies', {
        cookies: cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          ...(cookie.expires > 0 ? { expires: cookie.expires
          } : {}),
          partitionKey: {
            topLevelSite: cookie.partitionKey,
            hasCrossSiteAncestor: true,
          },
        })),
      });
      console.info('External login synchronized partitioned cookies.', {
        cookieCount: cookies.length,
      });
    } finally {
      if (!alreadyAttached && targetDebugger.isAttached()) {
        targetDebugger.detach();
      }
    }
  }

  /** Removes the legacy persistent browser state. */
  private async removeLegacyPersistentBrowserState(): Promise<void> {
    if (this.removedLegacyBrowserState) return;
    this.removedLegacyBrowserState = true;
    const legacyPath = getKawaiDataPath('external-browser');
    try {
      await rm(legacyPath, { recursive: true, force: true, maxRetries: 2
      });
      console.info('Removed legacy persistent external-browser state.');
    } catch (error) {
      this.removedLegacyBrowserState = false;
      console.warn(
        `Legacy external-browser state could not be removed: ${legacyPath}`,
        error,
      );
    }
  }
}
