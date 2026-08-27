import { serializePageInjectionWithOptions } from './Serialize';

/** Describes the page picture in picture policy injection options contract. */
export interface PagePictureInPicturePolicyInjectionOptions {
  /** The page request policy value. */
  readonly pageRequestPolicy: 'block' | 'transient' | 'allow';
  /** The selectors value. */
  readonly selectors: readonly string[];
}

/** Describes the page picture in picture policy state contract. */
interface PagePictureInPicturePolicyState {
  /** The observer value. */
  readonly observer: MutationObserver;
  /** Callback used to handle refresh. */
  readonly refresh: () => void;
}

/**
 * Installs Kawaikara's page-owned PiP suppression policy in the page world.
 *
 * createPagePictureInPicturePolicyInjectionScript() serializes this function.
 * SiteManager.installPagePictureInPicturePolicy() registers the result with
 * SitePagePipeline for dom-ready and did-finish-load execution. Provider
 * selectors originate from manifest/decorator PiP metadata; Provider code
 * never executes this function directly.
 */
function installPagePictureInPicturePolicy(
  options: PagePictureInPicturePolicyInjectionOptions,
): {
  /** The installed value. */
  readonly installed: true;
  /** Whether the reused option is enabled. */
  readonly reused: boolean;
} {
  const pageGlobal = globalThis as typeof globalThis & {
    __kawaikaraPagePictureInPicturePolicy?: PagePictureInPicturePolicyState;
    documentPictureInPicture?: {
      /** Callback used to handle request window. */
      requestWindow?: (...args: unknown[]) => Promise<unknown>;
    };
  };
  const existing = pageGlobal.__kawaikaraPagePictureInPicturePolicy;
  if (existing) {
    existing.refresh();
    return {
      /** The installed value. */
      installed: true,
      /** The reused value. */
      reused: true,
    };
  }

  const allowPageRequests = options.pageRequestPolicy !== 'block';
  const allowProgrammaticControlActivation =
    options.pageRequestPolicy === 'allow';
  const transientExitDelayMs = 250;
  const observedRoots = new WeakSet<Document | ShadowRoot>();
  const semanticPattern =
    /(?:^|[\s_\-/])pip(?:$|[\s_\-/])|picture[\s_\-]*(?:in|&)[\s_\-]*picture|화면\s*속\s*화면|ピクチャー?・?イン・?ピクチャー/i;
  const interactiveSelector =
    'button,[role="button"],input[type="button"],input[type="image"]';

  /** Performs the matches selector operation. */
  const matchesSelector = (element: Element, selector: string): boolean => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  };
  /** Performs the query selector all operation. */
  const querySelectorAll = (
    root: ParentNode,
    selector: string,
  ): readonly Element[] => {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  };
  /** Performs the semantic label operation. */
  const semanticLabel = (element: Element): string => [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('label'),
    element.getAttribute('data-testid'),
    element.getAttribute('data-a-target'),
    element.getAttribute('data-control'),
    element.getAttribute('data-tooltip'),
    typeof element.className === 'string' ? element.className : '',
    (element.textContent ?? '').slice(0, 240),
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  /** Determines whether the picture in picture control condition applies. */
  const isPictureInPictureControl = (element: Element): boolean =>
    options.selectors.some((selector) => matchesSelector(element, selector)) ||
    (matchesSelector(element, interactiveSelector) &&
      semanticPattern.test(semanticLabel(element)));
  /** Performs the suppress control operation. */
  const suppressControl = (element: Element): void => {
    if (!(element instanceof HTMLElement)) return;
    element.dataset.kawaikaraPagePipSuppressed = 'true';
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('tabindex', '-1');
    element.style.setProperty('display', 'none', 'important');
    element.style.setProperty('visibility', 'hidden', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
    const disableable = element as HTMLElement & { disabled?: boolean
    };
    if (!allowProgrammaticControlActivation && 'disabled' in disableable) {
      try {
        if (!disableable.disabled) {
          element.dataset.kawaikaraPagePipDisabled = 'true';
          disableable.disabled = true;
        }
      } catch {
        // Some custom controls expose a read-only disabled property.
      }
    } else if (
      allowProgrammaticControlActivation &&
      element.dataset.kawaikaraPagePipDisabled === 'true' &&
      'disabled' in disableable
    ) {
      try {
        disableable.disabled = false;
        delete element.dataset.kawaikaraPagePipDisabled;
      } catch {
        // The visual/pointer suppression still protects read-only controls.
      }
    }
  };
  /** Performs the suppress video operation. */
  const suppressVideo = (video: HTMLVideoElement): void => {
    if (allowPageRequests) {
      if (video.disablePictureInPicture) video.disablePictureInPicture = false;
      if (video.hasAttribute('disablepictureinpicture')) {
        video.removeAttribute('disablepictureinpicture');
      }
      return;
    }
    if (!video.disablePictureInPicture) video.disablePictureInPicture = true;
    if (!video.hasAttribute('disablepictureinpicture')) {
      video.setAttribute('disablepictureinpicture', '');
    }
  };

  let observer: MutationObserver;
  /** Performs the scan operation. */
  const scan = (root: ParentNode | Element = document): void => {
    if (root instanceof HTMLVideoElement) suppressVideo(root);
    if (root instanceof Element && isPictureInPictureControl(root)) {
      suppressControl(root.closest(interactiveSelector) ?? root);
    }
    querySelectorAll(root, 'video').forEach((element) => {
      if (element instanceof HTMLVideoElement) suppressVideo(element);
    });
    options.selectors.forEach((selector) => {
      querySelectorAll(root, selector).forEach((element) => {
        suppressControl(element.closest(interactiveSelector) ?? element);
      });
    });
    querySelectorAll(root, interactiveSelector).forEach((element) => {
      if (isPictureInPictureControl(element)) suppressControl(element);
    });
    querySelectorAll(root, '*').forEach((element) => {
      if (element instanceof HTMLElement && element.shadowRoot) {
        observe(element.shadowRoot);
      }
    });
  };
  /** Performs the observe operation. */
  const observe = (root: Document | ShadowRoot): void => {
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
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        if (target instanceof HTMLVideoElement) suppressVideo(target);
        if (target instanceof Element && isPictureInPictureControl(target)) {
          suppressControl(target.closest(interactiveSelector) ?? target);
        }
        return;
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element || node instanceof ShadowRoot) scan(node);
      });
      const target = mutation.target;
      if (
        target instanceof Element &&
        target.matches(interactiveSelector) &&
        isPictureInPictureControl(target)
      ) {
        suppressControl(target);
      }
    });
  });

  /** Finds the control. */
  const findControl = (event: Event): Element | undefined =>
    event.composedPath().find((candidate): candidate is Element =>
      candidate instanceof Element &&
      matchesSelector(candidate, interactiveSelector) &&
      isPictureInPictureControl(candidate),
    );
  /** Performs the block control operation. */
  const blockControl = (event: Event): void => {
    if (allowProgrammaticControlActivation && !event.isTrusted) return;
    const control = findControl(event);
    if (!control) return;
    suppressControl(control);
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  document.addEventListener('click', blockControl, true);
  document.addEventListener('keydown', blockControl, true);

  /** Performs the blocked request operation. */
  const blockedRequest = (): Promise<never> => Promise.reject(
    new DOMException('Use Kawaikara Picture in Picture.', 'NotAllowedError'),
  );
  if (!allowPageRequests) {
    try {
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        configurable: true,
        get: () => false,
      });
    } catch {
      // Sites can lock the property; control suppression remains active.
    }
    try {
      Object.defineProperty(HTMLVideoElement.prototype, 'requestPictureInPicture', {
        configurable: true,
        writable: false,
        value: blockedRequest,
      });
    } catch {
      // Chromium variants can expose a non-configurable implementation.
    }
    try {
      const documentPictureInPicture = pageGlobal.documentPictureInPicture;
      if (typeof documentPictureInPicture?.requestWindow === 'function') {
        Object.defineProperty(documentPictureInPicture, 'requestWindow', {
          configurable: true,
          writable: false,
          value: blockedRequest,
        });
      }
    } catch {
      // Document PiP is optional and may not be configurable.
    }
  }

  let transientExitTimer: ReturnType<typeof setTimeout> | undefined;
  /** Performs the exit page picture in picture operation. */
  const exitPagePictureInPicture = (): void => {
    if (!document.pictureInPictureElement) return;
    void document.exitPictureInPicture().catch(() => undefined);
  };
  /** Handles the page picture in picture entry. */
  const handlePagePictureInPictureEntry = (): void => {
    if (options.pageRequestPolicy === 'block') {
      exitPagePictureInPicture();
      return;
    }
    if (options.pageRequestPolicy === 'allow') {
      console.info('[Kawaikara/PiP] Allowing Provider page PiP lifecycle.');
      return;
    }
    console.info('[Kawaikara/PiP] Allowing transient page PiP lifecycle.');
    if (transientExitTimer !== undefined) clearTimeout(transientExitTimer);
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
  if (document.pictureInPictureElement) handlePagePictureInPictureEntry();

  pageGlobal.__kawaikaraPagePictureInPicturePolicy = {
    observer,
    refresh: () => scan(document),
  };
  observe(document);
  return {
    /** The installed value. */
    installed: true,
    /** The reused value. */
    reused: false,
  };
}

/** Creates the page picture in picture policy injection script. */
export function createPagePictureInPicturePolicyInjectionScript(
  options: PagePictureInPicturePolicyInjectionOptions,
): string {
  return serializePageInjectionWithOptions(
    installPagePictureInPicturePolicy,
    options,
  );
}
