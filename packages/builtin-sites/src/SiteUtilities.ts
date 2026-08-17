export function createLoginInterceptionScript(
  marker: string,
  selector: string,
  actionUrl: string,
  fallbackLabels: readonly string[] = [],
): string {
  return `
    (() => {
      const marker = ${JSON.stringify(marker)};
      const selector = ${JSON.stringify(selector)};
      const actionUrl = ${JSON.stringify(actionUrl)};
      const fallbackLabels = ${JSON.stringify(fallbackLabels.map((label) => label.toLowerCase()))};
      const releaseGate = () => {
        document.documentElement?.setAttribute(
          'data-kawaikara-external-login-ready',
          'true',
        );
        document.getElementById('kawaikara-external-login-gate')?.remove();
      };
      const existing = window[marker];
      if (existing && typeof existing.refresh === 'function') {
        existing.refresh();
        releaseGate();
        return { installed: true, ready: true, reused: true };
      }

      const controlLabel = (control) => [
        control.getAttribute('aria-label'),
        control.getAttribute('title'),
        control.textContent,
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\\s+/g, ' ')
        .trim()
        .toLowerCase();
      const matchesFallbackLabel = (control) =>
        fallbackLabels.length > 0 &&
        fallbackLabels.some((fallback) => controlLabel(control).includes(fallback));
      const markControl = (control) => {
        if (!(control instanceof HTMLElement)) return;
        control.dataset.kawaikaraLoginInjected = 'true';
        control.dataset.kawaikaraLoginReady = 'true';
        control.style.setProperty('border-color', 'rgb(168 85 247)', 'important');
        control.style.setProperty(
          'box-shadow',
          '0 0 0 2px rgb(168 85 247 / 42%), 0 0 18px rgb(168 85 247 / 24%)',
          'important',
        );
        control.style.setProperty(
          'transition',
          'border-color 160ms ease, box-shadow 160ms ease',
          'important',
        );
      };
      const refresh = (root = document) => {
        if (root instanceof Element && root.matches(selector)) {
          markControl(root);
        }
        if ('querySelectorAll' in root) {
          root.querySelectorAll(selector).forEach(markControl);
          root.querySelectorAll('a,button,[role="button"]').forEach((control) => {
            if (matchesFallbackLabel(control)) markControl(control);
          });
        }
      };
      const findLoginControl = (target) => {
        if (!(target instanceof Element)) return null;
        const selected = target.closest(selector);
        if (selected) return selected;
        const candidate = target.closest('a,button,[role="button"]');
        if (!candidate || fallbackLabels.length === 0) return null;
        return matchesFallbackLabel(candidate)
          ? candidate
          : null;
      };
      const intercept = (event) => {
        const loginControl = findLoginControl(event.target);
        if (!loginControl) return;
        event.preventDefault();
        event.stopImmediatePropagation();
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
        attributeFilter: ['aria-label', 'data-cy', 'data-testid', 'data-uia', 'href'],
        childList: true,
        subtree: true,
      });
      window[marker] = { observer, ready: true, refresh };
      refresh();
      releaseGate();
      return { installed: true, ready: true, reused: false };
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
