import type { SitePictureInPictureContribution } from '@kawaikara/site-api';

const DEFAULT_PAGE_PIP_CONTROL_SELECTORS = [
  '.vjs-picture-in-picture-control',
  '.ytp-pip-button',
  '[data-a-target="player-picture-in-picture-button"]',
  '[data-testid*="picture-in-picture" i]',
  '[data-testid="pip-button" i]',
  '[data-control*="picture-in-picture" i]',
  'button[aria-label="pip" i]',
  '[role="button"][aria-label="pip" i]',
  'button[aria-label*="picture in picture" i]',
  '[role="button"][aria-label*="picture in picture" i]',
  'button[aria-label*="picture-in-picture" i]',
  '[role="button"][aria-label*="picture-in-picture" i]',
  'button[title="pip" i]',
  '[role="button"][title="pip" i]',
  'button[class*="pip-button" i]',
  '[role="button"][class*="pip-button" i]',
  'button[class*="picture-in-picture" i]',
  '[role="button"][class*="picture-in-picture" i]',
] as const;

export function shouldSuppressPagePictureInPicture(
  contribution: SitePictureInPictureContribution | undefined,
): boolean {
  return contribution?.suppressPageControls !== false;
}

interface PagePictureInPicturePolicyOptions {
  readonly pageRequestPolicy?: 'block' | 'transient' | 'allow';
  readonly providerSelectors?: readonly string[];
}

/**
 * Creates a page-world policy. This is an application-owned injection rather
 * than a Provider script-injection permission: the Provider only declares the
 * selectors needed to keep its player inside Kawaikara's PiP lifecycle.
 */
export function createPagePictureInPicturePolicyScript(
  options: PagePictureInPicturePolicyOptions = {},
): string {
  const providerSelectors = options.providerSelectors ?? [];
  const pageRequestPolicy = options.pageRequestPolicy ?? 'block';
  const selectors = [
    ...new Set([
      ...DEFAULT_PAGE_PIP_CONTROL_SELECTORS,
      ...providerSelectors.map((selector) => selector.trim()).filter(Boolean),
    ]),
  ];

  return `
    (() => {
      const stateKey = '__kawaikaraPagePictureInPicturePolicy';
      const selectors = ${JSON.stringify(selectors)};
      const pageRequestPolicy = ${JSON.stringify(pageRequestPolicy)};
      const allowPageRequests = pageRequestPolicy !== 'block';
      const allowProgrammaticControlActivation = pageRequestPolicy === 'allow';
      const transientExitDelayMs = 250;
      const existing = globalThis[stateKey];
      if (existing && typeof existing.refresh === 'function') {
        existing.refresh();
        return { installed: true, reused: true };
      }

      const observedRoots = new WeakSet();
      const semanticPattern =
        /(?:^|[\\s_\\-/])pip(?:$|[\\s_\\-/])|picture[\\s_\\-]*(?:in|&)[\\s_\\-]*picture|화면\\s*속\\s*화면|ピクチャー?・?イン・?ピクチャー/i;
      const interactiveSelector =
        'button,[role="button"],input[type="button"],input[type="image"]';

      const matchesSelector = (element, selector) => {
        try {
          return element.matches(selector);
        } catch {
          return false;
        }
      };
      const querySelectorAll = (root, selector) => {
        try {
          return root.querySelectorAll(selector);
        } catch {
          return [];
        }
      };
      const semanticLabel = (element) => [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('label'),
        element.getAttribute('data-testid'),
        element.getAttribute('data-a-target'),
        element.getAttribute('data-control'),
        element.getAttribute('data-tooltip'),
        typeof element.className === 'string' ? element.className : '',
        (element.textContent ?? '').slice(0, 240),
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\\s+/g, ' ')
        .trim();
      const isPictureInPictureControl = (element) => {
        if (selectors.some((selector) => matchesSelector(element, selector))) {
          return true;
        }
        // Only use text/class heuristics for the interactive control itself.
        // Player toolbars and CHZZK's automatic mini-player contain the PIP
        // button as a descendant, so their combined text also contains “PIP”.
        // Treating those containers as controls hides the entire control bar
        // or the mini-player while its audio continues in the background.
        return (
          matchesSelector(element, interactiveSelector) &&
          semanticPattern.test(semanticLabel(element))
        );
      };
      const suppressControl = (element) => {
        if (!(element instanceof HTMLElement)) return;
        element.dataset.kawaikaraPagePipSuppressed = 'true';
        element.setAttribute('aria-hidden', 'true');
        element.setAttribute('tabindex', '-1');
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
        if (
          !allowProgrammaticControlActivation &&
          'disabled' in element
        ) {
          try {
            if (!element.disabled) {
              element.dataset.kawaikaraPagePipDisabled = 'true';
              element.disabled = true;
            }
          } catch {}
        } else if (
          allowProgrammaticControlActivation &&
          element.dataset.kawaikaraPagePipDisabled === 'true' &&
          'disabled' in element
        ) {
          // HTMLElement.click() is a no-op on disabled buttons. CHZZK uses
          // its hidden PIP control internally while leaving a live route, so
          // restore only the disabled state that this policy introduced.
          try {
            element.disabled = false;
            delete element.dataset.kawaikaraPagePipDisabled;
          } catch {}
        }
      };
      const suppressVideo = (video) => {
        if (!(video instanceof HTMLVideoElement)) return;
        if (allowPageRequests) {
          if (video.disablePictureInPicture) {
            video.disablePictureInPicture = false;
          }
          if (video.hasAttribute('disablepictureinpicture')) {
            video.removeAttribute('disablepictureinpicture');
          }
          return;
        }
        if (!video.disablePictureInPicture) {
          video.disablePictureInPicture = true;
        }
        if (!video.hasAttribute('disablepictureinpicture')) {
          video.setAttribute('disablepictureinpicture', '');
        }
      };
      const scan = (root = document) => {
        if (root instanceof HTMLVideoElement) suppressVideo(root);
        if (root instanceof Element && isPictureInPictureControl(root)) {
          suppressControl(root.closest(interactiveSelector) ?? root);
        }
        querySelectorAll(root, 'video').forEach(suppressVideo);
        for (const selector of selectors) {
          querySelectorAll(root, selector).forEach((element) => {
            suppressControl(element.closest(interactiveSelector) ?? element);
          });
        }
        querySelectorAll(root, interactiveSelector).forEach((element) => {
          if (isPictureInPictureControl(element)) suppressControl(element);
        });
        querySelectorAll(root, '*').forEach((element) => {
          if (element.shadowRoot) observe(element.shadowRoot);
        });
      };
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            const target = mutation.target;
            if (target instanceof HTMLVideoElement) suppressVideo(target);
            if (
              target instanceof Element &&
              isPictureInPictureControl(target)
            ) {
              suppressControl(target.closest(interactiveSelector) ?? target);
            }
            continue;
          }
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element || node instanceof ShadowRoot) scan(node);
          });
          if (
            mutation.target instanceof Element &&
            mutation.target.matches(interactiveSelector) &&
            isPictureInPictureControl(mutation.target)
          ) {
            suppressControl(mutation.target);
          }
        }
      });
      const observe = (root) => {
        if (observedRoots.has(root)) return;
        observedRoots.add(root);
        observer.observe(root, {
          attributes: true,
          attributeFilter: [
            'aria-label',
            'class',
            'data-a-target',
            'data-control',
            'data-testid',
            'disablepictureinpicture',
            'label',
            'title',
          ],
          childList: true,
          subtree: true,
        });
        scan(root);
      };
      const findControl = (event) => {
        for (const candidate of event.composedPath()) {
          if (!(candidate instanceof Element)) continue;
          if (
            matchesSelector(candidate, interactiveSelector) &&
            isPictureInPictureControl(candidate)
          ) return candidate;
        }
        return null;
      };
      const blockControl = (event) => {
        // CHZZK activates its page-owned mini-player through a synthetic click
        // while navigating away from a live stream. Keep trusted user input
        // blocked, but let that internal activation reach the player handler.
        if (allowProgrammaticControlActivation && !event.isTrusted) return;
        const control = findControl(event);
        if (!control) return;
        suppressControl(control);
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      document.addEventListener('click', blockControl, true);
      document.addEventListener('keydown', blockControl, true);

      const blockedRequest = () => Promise.reject(
        new DOMException(
          'Use Kawaikara Picture in Picture.',
          'NotAllowedError',
        ),
      );
      if (!allowPageRequests) {
        try {
          Object.defineProperty(document, 'pictureInPictureEnabled', {
            configurable: true,
            get: () => false,
          });
        } catch {}
        try {
          Object.defineProperty(
            HTMLVideoElement.prototype,
            'requestPictureInPicture',
            {
              configurable: true,
              writable: false,
              value: blockedRequest,
            },
          );
        } catch {}
      }
      if (!allowPageRequests) {
        try {
          const documentPictureInPicture = globalThis.documentPictureInPicture;
          if (
            documentPictureInPicture &&
            typeof documentPictureInPicture.requestWindow === 'function'
          ) {
            Object.defineProperty(documentPictureInPicture, 'requestWindow', {
              configurable: true,
              writable: false,
              value: blockedRequest,
            });
          }
        } catch {}
      }
      let transientExitTimer;
      const exitPagePictureInPicture = () => {
        if (!document.pictureInPictureElement) return;
        void document.exitPictureInPicture().catch(() => undefined);
      };
      const handlePagePictureInPictureEntry = () => {
        if (pageRequestPolicy === 'block') {
          exitPagePictureInPicture();
          return;
        }
        if (pageRequestPolicy === 'allow') {
          console.info('[Kawaikara/PiP] Allowing Provider page PiP lifecycle.');
          return;
        }
        console.info(
          '[Kawaikara/PiP] Allowing transient page PiP lifecycle.',
        );
        clearTimeout(transientExitTimer);
        transientExitTimer = setTimeout(() => {
          transientExitTimer = undefined;
          exitPagePictureInPicture();
        }, transientExitDelayMs);
      };
      document.addEventListener(
        'enterpictureinpicture',
        handlePagePictureInPictureEntry,
        true,
      );
      if (document.pictureInPictureElement) {
        handlePagePictureInPictureEntry();
      }

      globalThis[stateKey] = { observer, refresh: () => scan(document) };
      observe(document.documentElement);
      return { installed: true, reused: false };
    })();
  `;
}
