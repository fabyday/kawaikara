import { randomUUID } from 'node:crypto';
import type {
    DistributionActionResult,
    DistributionPreview,
} from '../../../../Common/ExternalAppDistribution';
import { DistributionRepository } from './Repository';
import {
    distributionAction,
    distributionResourceUrl,
    selectDistributionTarget,
} from './Descriptor';

/** Immutable source selections ensure a later click cannot silently switch the artifact or destination. */
export class DistributionCatalog {
    /** Bounded, short-lived capabilities for the trusted application UI. */
    private readonly previews = new Map<
        string,
        {
            /** Immutable selection bound to this token. */
            preview: DistributionPreview;
            /** Expiration in UTC epoch milliseconds. */
            expires: number;
        }
    >();
    /** Prevents overlapping OS installer/save dialogs from repeated clicks. */
    private busy = false;
    /** Creates a catalog with injected OS operations; no app registration authority is held here. */
    constructor(
        /** Public presentation cache, separate from app registrations. */
        private readonly repository: DistributionRepository,
        /** OS handoff for an explicitly selected HTTPS guide. */
        private readonly openPage: (url: string) => Promise<void>,
        /** Native download/installer service with its own confirmation. */
        private readonly prepare: (
            preview: DistributionPreview,
            install: boolean,
        ) => Promise<DistributionActionResult>,
        /** Host OS used for target selection. */
        private readonly platform: string = process.platform,
        /** Host process CPU architecture used for exact/universal matching. */
        private readonly arch: string = process.arch,
        /** Explicit local test server selected by the native process, never by Renderer. */
        private readonly testOrigin?: string,
    ) {}
    /** Fetches public metadata and selects a host-compatible artifact without executing it. */
    async preview(
        url: string,
        expectedId?: string,
    ): Promise<DistributionPreview> {
        const sourceUrl = distributionResourceUrl(
            url,
            undefined,
            this.testOrigin,
        );
        const record = await this.repository.load(sourceUrl, expectedId);
        const target = selectDistributionTarget(
            record.descriptor,
            this.platform,
            this.arch,
        );
        const preview: DistributionPreview = {
            token: randomUUID(),
            sourceUrl,
            ...record,
            target,
            action: distributionAction(record.descriptor, target),
        };
        for (const [token, entry] of this.previews)
            if (entry.expires < Date.now()) this.previews.delete(token);
        if (this.previews.size >= 32)
            this.previews.delete(this.previews.keys().next().value!);
        this.previews.set(preview.token, {
            preview,
            expires: Date.now() + 20 * 60_000,
        });
        return preview;
    }
    /** Uses only a previously previewed descriptor; Renderer never supplies execution paths or URLs. */
    async act(
        token: string,
        action: unknown,
    ): Promise<DistributionActionResult> {
        const entry = this.previews.get(token);
        if (!entry || entry.expires < Date.now())
            throw new Error('Preview expired. Refresh the manifest.');
        if (this.busy) throw new Error('An app action is already in progress.');
        this.busy = true;
        try {
            const { preview } = entry;
            if (action === 'guide' || action === 'connection-guide') {
                const url =
                    action === 'guide'
                        ? (preview.target?.guideUrl ??
                          preview.descriptor.guideUrl ??
                          preview.descriptor.homepage)
                        : (
                              preview.target?.connection ??
                              preview.descriptor.connection
                          )?.guideUrl;
                if (!url) throw new Error('No guide is provided.');
                await this.openPage(
                    distributionResourceUrl(url, undefined, this.testOrigin),
                );
                return 'page-opened';
            }
            if (action === 'install' || action === 'download') {
                if (
                    !preview.target?.artifact ||
                    (action === 'install' && preview.action !== 'install')
                )
                    throw new Error('Unsupported app action.');
                return await this.prepare(preview, action === 'install');
            }
            throw new Error('Unknown app action.');
        } finally {
            this.busy = false;
        }
    }
}
