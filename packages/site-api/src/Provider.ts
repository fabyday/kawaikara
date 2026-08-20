import { DisposableStore } from './Disposable';
import type { NewWindowPolicy, SiteContext } from './SiteContext';
import type {
  ShortFormVideoContribution,
  ShortFormVideoPublisher,
} from './ShortFormVideo';

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
  /** Optional renderer-owned panel displayed beside the shared site rail. */
  readonly panel?: string;
}

export interface SiteShortcutContribution {
  /** Electron accelerator used until the user supplies an override. */
  readonly defaultKey?: string;
  /** Provider-local actions added to the shared Shortcut preference page. */
  readonly actions?: readonly SiteActionShortcutContribution[];
}

export interface SiteActionShortcutContribution {
  /** Globally unique preference id, conventionally provider:<provider-id>:<action>. */
  readonly id: string;
  readonly title: ProviderLocalizedText;
  readonly description?: ProviderLocalizedText;
  readonly defaultKey: string;
  /** Value delivered to AbstractProvider.onAction while this Provider is active. */
  readonly action: string;
}

export type ProviderLocalizedText =
  | string
  | Readonly<Record<string, string>>;

export interface ProviderSettingListItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly imageUrl?: string;
}

interface ProviderSettingContributionBase {
  readonly key: string;
  readonly title: ProviderLocalizedText;
  readonly description?: ProviderLocalizedText;
}

export interface ProviderBooleanSettingContribution
  extends ProviderSettingContributionBase {
  readonly type: 'boolean';
  readonly defaultValue: boolean;
}

export interface ProviderItemListSettingContribution
  extends ProviderSettingContributionBase {
  readonly type: 'item-list';
  readonly emptyText?: ProviderLocalizedText;
}

export type ProviderSettingContribution =
  | ProviderBooleanSettingContribution
  | ProviderItemListSettingContribution;

export interface ProviderSettingCategoryContribution {
  readonly id: string;
  readonly title: ProviderLocalizedText;
  readonly description?: ProviderLocalizedText;
  readonly settings: readonly ProviderSettingContribution[];
}

export interface ProviderSettingsContribution {
  readonly categories: readonly ProviderSettingCategoryContribution[];
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

export interface SitePictureInPictureContribution {
  /**
   * Exposes Kawaikara's unified PiP action for this provider. Disable it for
   * integrations that never present video (for example, books or music-only
   * services). Route-level eligibility still belongs in
   * allowPictureInPicture().
   */
  readonly enabled?: boolean;
  /**
   * Hides and disables the Provider page's own PiP controls so every PiP
   * transition stays inside Kawaikara's unified window lifecycle. Defaults to
   * true independently of whether the Provider exposes Kawaikara PiP.
   */
  readonly suppressPageControls?: boolean;
  /** Provider-specific selectors added to Kawaikara's generic PiP controls. */
  readonly pageControlSelectors?: readonly string[];
}

export interface SiteAddressContribution {
  /** Host names accepted by the shared Kawaikara address bar. Subdomains match too. */
  readonly hosts: readonly string[];
}

export interface ProviderMetadata {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly menu: SiteMenuContribution;
  readonly shortcut?: SiteShortcutContribution;
  readonly settings?: ProviderSettingsContribution;
  readonly shortFormVideo?: ShortFormVideoContribution;
  readonly locale?: SiteLocaleContribution;
  readonly isolation?: SiteIsolationContribution;
  readonly pictureInPicture?: SitePictureInPictureContribution;
  readonly address?: SiteAddressContribution;
  readonly permissions?: readonly SitePermission[];
}

/** Code-owned behavior metadata; manifest identity and copy are canonical. */
export type ProviderDecoratorMetadata =
  Omit<ProviderMetadata, 'id' | 'title' | 'description'> &
  Partial<Pick<ProviderMetadata, 'id' | 'title' | 'description'>>;

export interface SiteRequestDetails {
  readonly url: string;
  readonly method: string;
  readonly requestHeaders: Readonly<Record<string, string>>;
}

export interface SiteRequestRedirect {
  readonly cancel?: boolean;
  readonly redirectURL?: string;
}

export type SiteRequestHeaders = Record<string, string>;

export type ProviderSettingValue =
  | boolean
  | number
  | string
  | null
  | readonly ProviderSettingListItem[];
export type ProviderSettings = Readonly<Record<string, ProviderSettingValue>>;

export abstract class AbstractProvider {
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

  /**
   * Receive this Provider's namespaced settings before load and whenever the
   * user saves a change. Providers should treat missing keys as defaults.
   */
  async onSettingsChanged(_settings: ProviderSettings): Promise<void> {}

  /** Resolve the active short video's publisher for the standard quick-ban action. */
  async getShortFormVideoPublisher(): Promise<
    ShortFormVideoPublisher | undefined
  > {
    return undefined;
  }

  /** Block a main-frame navigation before Electron commits it. */
  allowNavigation(_url: string): boolean {
    return true;
  }

  /** Optionally cancel or redirect a network request before it is sent. */
  onBeforeRequest(_details: SiteRequestDetails): SiteRequestRedirect | undefined {
    return undefined;
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

export type ProviderConstructor = new (
  context: SiteContext,
) => AbstractProvider;
