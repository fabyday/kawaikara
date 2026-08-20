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
  readonly pageRequestPolicy?: 'block' | 'transient';
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
  const allowTransientPageRequests = options.pageRequestPolicy === 'transient';
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
      const allowTransientPageRequests = ${JSON.stringify(allowTransientPageRequests)};
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
      const isPictureInPictureControl = (element) =>
        selectors.some((selector) => matchesSelector(element, selector)) ||
        semanticPattern.test(semanticLabel(element));
      const suppressControl = (element) => {
        if (!(element instanceof HTMLElement)) return;
        element.dataset.kawaikaraPagePipSuppressed = 'true';
        element.setAttribute('aria-hidden', 'true');
        element.setAttribute('tabindex', '-1');
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
        if ('disabled' in element) {
          try {
            element.disabled = true;
          } catch {}
        }
      };
      const suppressVideo = (video) => {
        if (!(video instanceof HTMLVideoElement)) return;
        if (allowTransientPageRequests) {
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
          const interactive = candidate.matches(interactiveSelector)
            ? candidate
            : candidate.closest(interactiveSelector);
          if (interactive && isPictureInPictureControl(interactive)) {
            return interactive;
          }
          if (isPictureInPictureControl(candidate)) return candidate;
        }
        return null;
      };
      const blockControl = (event) => {
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
      if (!allowTransientPageRequests) {
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
      let transientExitTimer;
      const exitPagePictureInPicture = () => {
        if (!document.pictureInPictureElement) return;
        void document.exitPictureInPicture().catch(() => undefined);
      };
      const handlePagePictureInPictureEntry = () => {
        if (!allowTransientPageRequests) {
          exitPagePictureInPicture();
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
