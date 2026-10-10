import type { SitePictureInPictureDescriptor } from '@kawaikara/site-api';
import { createPagePictureInPicturePolicyInjectionScript } from '../../../Inject/PagePictureInPicturePolicy';

/** Defines the shared default page PiP control selectors constant. */
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

/** Determines whether the suppress page picture in picture condition applies. */
export function shouldSuppressPagePictureInPicture(
    descriptor: SitePictureInPictureDescriptor | undefined,
): boolean {
    return descriptor?.suppressPageControls !== false;
}

/** Describes the page picture in picture policy options contract. */
interface PagePictureInPicturePolicyOptions {
    /** The page request policy value. */
    readonly pageRequestPolicy?: 'block' | 'transient' | 'allow';
    /** The provider selectors value. */
    readonly providerSelectors?: readonly string[];
}

/**
 * Resolves application defaults and Provider selector declarations.
 *
 * ProviderManager.installPagePictureInPicturePolicy() is the only caller. The
 * executable page-world TypeScript lives in
 * Main/Inject/PagePictureInPicturePolicy.ts so this Functional module contains
 * policy selection only.
 */
export function createPagePictureInPicturePolicyScript(
    options: PagePictureInPicturePolicyOptions = {},
): string {
    return createPagePictureInPicturePolicyInjectionScript({
        /** The page request policy value. */
        pageRequestPolicy: options.pageRequestPolicy ?? 'block',
        /** The selectors value. */
        selectors: [
            ...new Set([
                ...DEFAULT_PAGE_PIP_CONTROL_SELECTORS,
                ...(options.providerSelectors ?? [])
                    .map((selector) => selector.trim())
                    .filter(Boolean),
            ]),
        ],
    });
}
