export function createLoginInterceptionScript(
  marker: string,
  selector: string,
  actionUrl: string,
): string {
  return `
    (() => {
      const marker = ${JSON.stringify(marker)};
      const selector = ${JSON.stringify(selector)};
      const actionUrl = ${JSON.stringify(actionUrl)};
      const existing = window[marker];
      if (existing && typeof existing.refresh === 'function') {
        existing.refresh();
        return { installed: true, reused: true };
      }

      const state = { ready: false };
      const markControl = (control) => {
        if (!(control instanceof HTMLElement)) return;
        control.dataset.kawaikaraLoginInjected = 'true';
        control.dataset.kawaikaraLoginReady = String(state.ready);
        control.style.setProperty('filter', 'invert(1)', 'important');
        control.style.setProperty('transition', 'filter 140ms ease', 'important');
        if (state.ready) {
          control.style.removeProperty('pointer-events');
          control.style.removeProperty('cursor');
          control.removeAttribute('aria-disabled');
        } else {
          control.style.setProperty('pointer-events', 'none', 'important');
          control.style.setProperty('cursor', 'wait', 'important');
          control.setAttribute('aria-disabled', 'true');
        }
      };
      const refresh = (root = document) => {
        if (root instanceof Element && root.matches(selector)) {
          markControl(root);
        }
        if ('querySelectorAll' in root) {
          root.querySelectorAll(selector).forEach(markControl);
        }
      };
      const intercept = (event) => {
        const target = event.target;
        const loginControl = target instanceof Element
          ? target.closest(selector)
          : null;
        if (!loginControl) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!state.ready) return;
        window.location.assign(actionUrl);
      };
      document.addEventListener('click', intercept, true);

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            refresh(mutation.target);
            continue;
          }
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) refresh(node);
          });
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-uia', 'data-cy', 'href'],
        childList: true,
        subtree: true,
      });
      window[marker] = { observer, refresh, state };
      refresh();
      state.ready = true;
      refresh();
      return { installed: true, reused: false };
    })();
  `;
}

export function isLoginNavigation(
  value: string,
  hosts: readonly string[],
  paths: readonly string[],
): boolean {
  const match = /^https?:\/\/([^/?#:]+)(\/[^?#]*)?/i.exec(value);
  if (!match) return false;

  const hostname = match[1]?.toLowerCase().replace(/^www\./, '') ?? '';
  const pathname = match[2] ?? '/';
  const matchesHost = hosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
  return matchesHost && paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function createBrowserUserAgent(userAgent: string): string {
  return userAgent
    .replace(/\s(?:Electron|kawaikara)\/[^\s]+/gi, '')
    .trim();
}

export function setHeader(
  headers: Record<string, string>,
  name: string,
  value: string,
): void {
  const existingName = Object.keys(headers).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  headers[existingName ?? name] = value;
}
