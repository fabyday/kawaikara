import { DisposableStore } from './Disposable';
import { webPopupPolicy } from './SiteUtilities';
import type {
  NewWindowPolicy,
  SiteBrowserIdentityOptions,
  SiteContext,
} from './SiteContext';
import type {
  ShortFormVideoContribution,
  ShortFormVideoPublisher,
} from './ShortFormVideo';

/** Defines the site permission type. */
export type SitePermission =
  | 'navigation'
  | 'internal-view'
  | 'plugin-view'
  | 'script-injection'
  | 'cookies'
  | 'network-interception'
  | 'external-browser';

/** Describes the site menu contribution contract. */
export interface SiteMenuContribution {
  /** The category value. */
  readonly category: string;
  /** The order value. */
  readonly order?: number;
  /** The icon value. */
  readonly icon?: string;
  /** @deprecated Use panels with an internal PluginView contribution. */
  readonly panel?: string;
  /** Panels displayed in the shared PluginView area while this Provider is selected. */
  readonly panels?: readonly PluginViewPanelContribution[];
}

/** Defines the plugin view panel content type. */
export type PluginViewPanelContent =
  | {
      /** An application-owned Renderer panel. Third-party Bundles cannot add view ids. */
      readonly kind: 'internal';
      /** The view ID value. */
      readonly viewId: string;
    }
  | {
      /** A sandboxed document with no Kawaikara IPC or parent-origin access. */
      readonly kind: 'html';
      /** The HTML value. */
      readonly html: string;
    };

/** Describes the plugin view panel contribution contract. */
export interface PluginViewPanelContribution {
  /** Stable id scoped to the contributing Provider or Plugin. */
  readonly id: string;
  /** Display title. Duplicate titles are allowed because selection uses the scoped id. */
  readonly title: ProviderLocalizedText;
  /** The order value. */
  readonly order?: number;
  /** The content value. */
  readonly content: PluginViewPanelContent;
}

/** Describes the site shortcut contribution contract. */
export interface SiteShortcutContribution {
  /** Electron accelerator used until the user supplies an override. */
  readonly defaultKey?: string;
  /** Provider-local actions added to the shared Shortcut preference page. */
  readonly actions?: readonly SiteActionShortcutContribution[];
}

/** Describes the site action shortcut contribution contract. */
export interface SiteActionShortcutContribution {
  /** Globally unique preference id, conventionally provider:<provider-id>:<action>. */
  readonly id: string;
  /** The title value. */
  readonly title: ProviderLocalizedText;
  /** The description value. */
  readonly description?: ProviderLocalizedText;
  /** The default key value. */
  readonly defaultKey: string;
  /** Value delivered to AbstractProvider.onAction while this Provider is active. */
  readonly action: string;
}

/** Defines the provider localized text type. */
export type ProviderLocalizedText =
  | string
  | Readonly<Record<string, string>>;

/** Describes the provider setting list item contract. */
export interface ProviderSettingListItem {
  /** The ID value. */
  readonly id: string;
  /** The label value. */
  readonly label: string;
  /** The description value. */
  readonly description?: string;
  /** The image URL value. */
  readonly imageUrl?: string;
}

/** Describes the provider setting contribution base contract. */
interface ProviderSettingContributionBase {
  /** The key value. */
  readonly key: string;
  /** The title value. */
  readonly title: ProviderLocalizedText;
  /** The description value. */
  readonly description?: ProviderLocalizedText;
}

/** Describes the provider boolean setting contribution contract. */
export interface ProviderBooleanSettingContribution
  extends ProviderSettingContributionBase {
  /** The type value. */
  readonly type: 'boolean';
  /** Whether the default value option is enabled. */
  readonly defaultValue: boolean;
}

/** Describes the provider item list setting contribution contract. */
export interface ProviderItemListSettingContribution
  extends ProviderSettingContributionBase {
  /** The type value. */
  readonly type: 'item-list';
  /** The empty text value. */
  readonly emptyText?: ProviderLocalizedText;
}

/** Defines the provider setting contribution type. */
export type ProviderSettingContribution =
  | ProviderBooleanSettingContribution
  | ProviderItemListSettingContribution;

/** Describes the provider setting category contribution contract. */
export interface ProviderSettingCategoryContribution {
  /** The ID value. */
  readonly id: string;
  /** The title value. */
  readonly title: ProviderLocalizedText;
  /** The description value. */
  readonly description?: ProviderLocalizedText;
  /** The settings value. */
  readonly settings: readonly ProviderSettingContribution[];
}

/** Describes the provider settings contribution contract. */
export interface ProviderSettingsContribution {
  /** The categories value. */
  readonly categories: readonly ProviderSettingCategoryContribution[];
}

/** Describes the site locale contribution contract. */
export interface SiteLocaleContribution {
  /** Provider-relative JSON resource containing locale -> message key -> text. */
  readonly resource?: string;
  /** Locales the site integration can receive through SiteContext.locale. */
  readonly supportedLocales?: readonly string[];
  /** Falls back to the containing plugin locale when omitted or set to inherit. */
  readonly defaultLocale?: string;
}

/** Describes the site isolation contribution contract. */
export interface SiteIsolationContribution {
  /**
   * Plugin-local browser profile id used by default. Omit it to isolate the
   * site in its own persistent Session.
   */
  readonly defaultBrowserProfile?: string;
  /** Marks a DRM integration so the app can warn before sharing its Session. */
  readonly drm?: boolean;
}

/** Describes the site picture in picture contribution contract. */
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
  /**
   * Controls page-originated HTML video PiP requests while page controls are
   * suppressed. `block` is the default. `transient` lets a site's automatic
   * request enter briefly and then closes it, preserving SPA enter/leave
   * cleanup hooks without exposing a second user-controlled PiP lifecycle.
   */
  readonly pageRequestPolicy?: 'block' | 'transient' | 'allow';
  /** Provider-specific selectors added to Kawaikara's generic PiP controls. */
  readonly pageControlSelectors?: readonly string[];
  /**
   * Page-rendered overlays that remain visible above the video in unified PiP.
   * Use this for subtitle/caption containers rendered outside the video element.
   */
  readonly contentOverlaySelectors?: readonly string[];
}

/** Describes the site address contribution contract. */
export interface SiteAddressContribution {
  /** Host names accepted by the shared Kawaikara address bar. Subdomains match too. */
  readonly hosts: readonly string[];
}

/** Describes the provider metadata contract. */
export interface ProviderMetadata {
  /** The ID value. */
  readonly id: string;
  /** The title value. */
  readonly title: string;
  /** The description value. */
  readonly description?: string;
  /** The menu value. */
  readonly menu: SiteMenuContribution;
  /** The shortcut value. */
  readonly shortcut?: SiteShortcutContribution;
  /** The settings value. */
  readonly settings?: ProviderSettingsContribution;
  /** The short form video value. */
  readonly shortFormVideo?: ShortFormVideoContribution;
  /** The locale value. */
  readonly locale?: SiteLocaleContribution;
  /** Whether the isolation option is enabled. */
  readonly isolation?: SiteIsolationContribution;
  /** The picture in picture value. */
  readonly pictureInPicture?: SitePictureInPictureContribution;
  /** The address value. */
  readonly address?: SiteAddressContribution;
  /** Browser identity applied by the app before Provider.load(). */
  readonly browserIdentity?: SiteBrowserIdentityOptions;
  /** The permissions value. */
  readonly permissions?: readonly SitePermission[];
}

/**
 * Code-owned Provider contributions. Keep installation/discovery metadata in
 * the manifest; settings and site-specific runtime policy belong here, with
 * translated copy imported from the Provider's locale resource.
 */
export type ProviderDecoratorMetadata =
  Partial<
    Omit<
      ProviderMetadata,
      'id' | 'title' | 'description' | 'permissions' | 'menu' | 'shortcut' | 'settings'
    >
  > & {
    /** The menu value. */
    readonly menu?: Omit<SiteMenuContribution, 'panels'> & {
      /** The panels value. */
      readonly panels?: readonly (Omit<PluginViewPanelContribution, 'title'> & {
        /** The title value. */
        readonly title?: ProviderLocalizedText;
      })[];
    };
    /** The shortcut value. */
    readonly shortcut?: Omit<SiteShortcutContribution, 'actions'> & {
      /** The actions value. */
      readonly actions?: readonly (Omit<SiteActionShortcutContribution, 'title'> & {
        /** The title value. */
        readonly title?: ProviderLocalizedText;
      })[];
    };
    /** The settings value. */
    readonly settings?: {
      /** The categories value. */
      readonly categories: readonly (Omit<
        ProviderSettingCategoryContribution,
        'title' | 'settings'
      > & {
        /** The title value. */
        readonly title?: ProviderLocalizedText;
        /** The settings value. */
        readonly settings: readonly (
          | (Omit<ProviderBooleanSettingContribution, 'title'> & {
              /** The title value. */
              readonly title?: ProviderLocalizedText;
            })
          | (Omit<ProviderItemListSettingContribution, 'title'> & {
              /** The title value. */
              readonly title?: ProviderLocalizedText;
            })
        )[];
      })[];
    };
  };

/** Describes the site request details contract. */
export interface SiteRequestDetails {
  /** The URL value. */
  readonly url: string;
  /** The method value. */
  readonly method: string;
  /** The request headers value. */
  readonly requestHeaders: Readonly<Record<string, string>>;
}

/** Describes the site request redirect contract. */
export interface SiteRequestRedirect {
  /** Whether the cancel option is enabled. */
  readonly cancel?: boolean;
  /** The redirect URL value. */
  readonly redirectURL?: string;
}

/** Defines the site request headers type. */
export type SiteRequestHeaders = Record<string, string>;

/** Defines the provider setting value type. */
export type ProviderSettingValue =
  | boolean
  | number
  | string
  | null
  | readonly ProviderSettingListItem[];
/** Defines the provider settings type. */
export type ProviderSettings = Readonly<Record<string, ProviderSettingValue>>;

/** Implements the abstract site provider. */
export abstract class AbstractProvider {
  /** The subscriptions value. */
  protected readonly subscriptions = new DisposableStore();

  /** Creates an instance of AbstractProvider. */
  protected constructor(
    /** The context value. */
    protected readonly context: SiteContext,
  ) {}

  /** Loads the operation. */
  abstract load(): Promise<void>;

  /** Decide how a target=_blank/window.open navigation should be handled. */
  onNewWindow(url: string): NewWindowPolicy {
    // Preserve normal browser popup/opener semantics by default. OAuth
    // providers commonly begin on the site's own callback URL before moving
    // to Apple, Google, Kakao, or another identity host, so host allowlists
    // cannot reliably recognize authentication from the first URL alone.
    return webPopupPolicy(url);
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

  /** Performs the unload operation. */
  async unload(): Promise<void> {
    this.subscriptions.dispose();
  }

  /** Performs the require page operation. */
  protected requirePage(): NonNullable<SiteContext['page']> {
    if (!this.context.page) {
      throw new Error('This Provider requires the script-injection permission.');
    }
    return this.context.page;
  }
}

/** Standard URL-backed Provider lifecycle with application-owned page hooks. */
export abstract class AbstractUrlProvider extends AbstractProvider {
  /** The URL value. */
  protected abstract readonly url: string;

  /** Creates an instance of AbstractUrlProvider. */
  constructor(context: SiteContext) {
    super(context);
  }

  /** Loads the operation. */
  async load(): Promise<void> {
    await this.beforeLoad();
    const page = this.context.page;
    if (page) {
      this.subscriptions.add(page.on('dom-ready', () => this.afterLoad()));
      this.subscriptions.add(page.on('did-finish-load', () => this.afterLoad()));
    }
    try {
      await this.context.viewer.loadURL(this.url);
    } catch (error) {
      if (!isNavigationAborted(error)) throw error;
      return;
    }
    if (page) await this.afterLoad();
  }

  /** Performs the before load operation. */
  protected async beforeLoad(): Promise<void> {}

  /** Performs the after load operation. */
  protected async afterLoad(): Promise<void> {}
}

/** Determines whether the navigation aborted condition applies. */
function isNavigationAborted(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: unknown
    }).code === 'ERR_ABORTED';
}

/** Defines the provider function Object() { [native code] } type. */
export type ProviderConstructor = new (
  context: SiteContext,
) => AbstractProvider;
