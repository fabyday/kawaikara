import { DisposableStore } from './Disposable';
import type { NewWindowPolicy, SiteContext } from './SiteContext';

export type SitePermission =
  | 'navigation'
  | 'internal-view'
  | 'script-injection'
  | 'cookies'
  | 'network-interception'
  | 'external-browser';

export interface SiteMenuContribution {
  readonly category: string;
  readonly order?: number;
  readonly icon?: string;
}

export interface SiteShortcutContribution {
  /** Electron accelerator used until the user supplies an override. */
  readonly defaultKey?: string;
}

export interface SiteLocaleContribution {
  /** Locales the site integration can receive through SiteContext.locale. */
  readonly supportedLocales?: readonly string[];
  /** Falls back to the containing plugin locale when omitted or set to inherit. */
  readonly defaultLocale?: string;
}

export interface SiteIsolationContribution {
  /**
   * Plugin-local browser profile id used by default. Omit it to isolate the
   * site in its own persistent Session.
   */
  readonly defaultBrowserProfile?: string;
  /** Marks a DRM integration so the app can warn before sharing its Session. */
  readonly drm?: boolean;
}

export interface SiteMetadata {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly menu: SiteMenuContribution;
  readonly shortcut?: SiteShortcutContribution;
  readonly locale?: SiteLocaleContribution;
  readonly isolation?: SiteIsolationContribution;
  readonly permissions?: readonly SitePermission[];
}

export interface SiteRequestDetails {
  readonly url: string;
  readonly method: string;
  readonly requestHeaders: Readonly<Record<string, string>>;
}

export type SiteRequestHeaders = Record<string, string>;

export abstract class AbstractSiteDescriptor {
  protected readonly subscriptions = new DisposableStore();

  protected constructor(protected readonly context: SiteContext) {}

  abstract load(): Promise<void>;

  /** Decide how a target=_blank/window.open navigation should be handled. */
  onNewWindow(_url: string): NewWindowPolicy {
    return 'viewer';
  }

  /** Handle an action URL created with context.actions.createUrl(). */
  async onAction(_action: string): Promise<boolean> {
    return false;
  }

  /** Block a main-frame navigation before Electron commits it. */
  allowNavigation(_url: string): boolean {
    return true;
  }

  /** Decide whether PiP may start for the current page URL. */
  allowPictureInPicture(_url: string): boolean {
    return true;
  }

  /** Optionally replace request headers for the current site. */
  onBeforeSendHeaders(_details: SiteRequestDetails): SiteRequestHeaders | undefined {
    return undefined;
  }

  async unload(): Promise<void> {
    this.subscriptions.dispose();
  }
}

export type SiteDescriptorConstructor = new (
  context: SiteContext,
) => AbstractSiteDescriptor;
