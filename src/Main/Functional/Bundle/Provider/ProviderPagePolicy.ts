import type {
    Disposable,
    ProviderMetadata,
    SiteContext,
} from '@kawaikara/site-api';
import {
    createPagePictureInPicturePolicyScript,
    shouldSuppressPagePictureInPicture,
} from '../../Window/PictureInPicture/PagePictureInPicturePolicy';

/**
 * Installs a Provider's declared browser identity into its scoped browser capability.
 *
 * @param context - Current activation context with its permission-scoped browser capability.
 * @param metadata - Effective Provider metadata containing the optional browserIdentity declaration.
 * @returns A disposable registration, or undefined when no identity is declared.
 * @throws When identity is declared without a browser capability, or identity installation fails.
 * @remarks The activation owner must retain and dispose the result on retirement.
 * This helper neither extends permissions nor owns the Provider lifecycle.
 */
export function installProviderBrowserIdentity(
    context: SiteContext,
    metadata: ProviderMetadata,
): Disposable | undefined {
    const identity = metadata.browserIdentity;
    if (!identity) return undefined;
    if (!context.browser) {
        throw new Error(
            `Provider ${metadata.id} browserIdentity requires network-interception.`,
        );
    }
    return context.browser.useIdentity(identity);
}

/** Installed policy operations owned by one Provider activation. */
export interface ProviderPagePolicy {
    /** Releases the registered page script. */
    readonly disposable?: Disposable;
    /** Applies the policy after the Provider document has loaded. */
    readonly refresh: () => Promise<void>;
}

/**
 * Registers the application-owned page PiP policy for a Provider activation.
 *
 * @param context - Activation context containing the application page pipeline and logger.
 * @param metadata - Effective Provider metadata describing page PiP suppression and selectors.
 * @returns The optional registration disposable and a refresh operation to await after
 * Provider load. If suppression is unnecessary or no pipeline exists, refresh is a no-op.
 * @remarks Missing pipelines are logged rather than treated as installation failures.
 * The caller disposes any previous policy before installing this one and retains the
 * new disposable until retirement. Page registration and refresh failures propagate.
 */
export function installProviderPictureInPicturePolicy(
    context: SiteContext,
    metadata: ProviderMetadata,
): ProviderPagePolicy {
    const descriptor = metadata.pictureInPicture;
    if (!shouldSuppressPagePictureInPicture(descriptor)) {
        return {
            /** No page policy requires refresh. */ refresh: async () =>
                undefined,
        };
    }
    const page = context.page;
    if (!page) {
        context.logger.warn(
            'The application page pipeline is unavailable for the PiP policy.',
        );
        return {
            /** No page policy requires refresh. */ refresh: async () =>
                undefined,
        };
    }
    const script = createPagePictureInPicturePolicyScript({
        pageRequestPolicy: descriptor?.pageRequestPolicy,
        providerSelectors: descriptor?.pageControlSelectors,
    });
    return {
        /** The page pipeline owns script execution. */
        disposable: page.register({
            /** Stable page pipeline registration key. */
            id: 'kawaikara.core.picture-in-picture-policy',
            /** Application-owned serialized policy. */
            source: script,
        }),
        /** Reuses the same registered script after navigation. */
        refresh: () => page.refresh('kawaikara.core.picture-in-picture-policy'),
    };
}
