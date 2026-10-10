import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    ProviderFileDropDescriptor,
    ProviderMetadata,
} from '@kawaikara/site-api';
import type { FileDropResult } from '../../Common/DragDrop';
import { validateFileDropDescriptor } from '../Functional/Bundle/Provider/FileDropDescriptors';

/** One installed Provider's declarative file-drop route. */
export interface RegisteredFileDrop {
    /** Registration owner; never supplied by an untrusted page. */
    readonly providerId: string;
    /** Provider display name for conflict resolution. */
    readonly title: string;
    /** Validated, detached registration policy. */
    readonly descriptor: ProviderFileDropDescriptor;
}

/** Routes OS file drops without coupling preload/IPC to any Provider ID. */
export class DragDropManager {
    /** Registrations live as long as their Bundle, not the active page. */
    private readonly registrations = new Map<string, RegisteredFileDrop>();
    /** Prevents overlapping gestures from starting competing native players. */
    private pending = false;

    /** Registers a validated Provider after the whole Bundle passed staging. */
    registerProvider(metadata: ProviderMetadata): void {
        if (!metadata.fileDrop) return;
        validateFileDropDescriptor(metadata);
        if (this.registrations.has(metadata.id))
            throw new Error(`Duplicate drop owner: ${metadata.id}`);
        this.registrations.set(metadata.id, {
            providerId: metadata.id,
            title: metadata.title,
            descriptor: Object.freeze({
                ...metadata.fileDrop,
                extensions: Object.freeze([...metadata.fileDrop.extensions]),
            }),
        });
    }

    /** Removes an owner during Bundle rollback, removal, or development reload. */
    unregisterProvider(providerId: string): void {
        this.registrations.delete(providerId);
    }

    /** Validates once on drop, resolves candidates, and invokes exactly one route. */
    async openFiles(
        value: unknown,
        getActiveProvider: () => string | undefined,
        execute: (
            registration: RegisteredFileDrop,
            paths: readonly string[],
        ) => Promise<boolean>,
    ): Promise<FileDropResult> {
        if (this.pending)
            return {
                /** Keep the current handoff exclusive. */
                status: 'busy',
            };
        if (
            !Array.isArray(value) ||
            value.length === 0 ||
            value.length > 256 ||
            value.some(
                (item) =>
                    typeof item !== 'string' ||
                    item.length > 32768 ||
                    item.includes('\0') ||
                    !path.isAbsolute(item),
            )
        )
            return {
                /** Malformed paths never reach Provider code. */
                status: 'unsupported',
            };
        this.pending = true;
        try {
            const targetProvider = getActiveProvider();
            const registrations = [...this.registrations.values()];
            const files: string[] = [];
            for (const file of new Set(
                (value as string[]).map((item) => path.resolve(item)),
            )) {
                if (
                    !registrations.some((item) =>
                        item.descriptor.extensions.includes(
                            path.extname(file).toLowerCase(),
                        ),
                    )
                )
                    continue;
                try {
                    if ((await fs.stat(file)).isFile()) files.push(file);
                } catch {
                    /* Not a usable file. */
                }
            }
            const activeProvider = getActiveProvider();
            const candidates = registrations.filter(
                (item) =>
                    this.registrations.get(item.providerId) === item &&
                    (item.descriptor.scope === 'global' ||
                        (item.providerId === targetProvider &&
                            activeProvider === targetProvider)) &&
                    files.some((file) =>
                        item.descriptor.extensions.includes(
                            path.extname(file).toLowerCase(),
                        ),
                    ),
            );
            if (candidates.length === 0)
                return {
                    /** No currently eligible owner accepts a usable file. */
                    status: 'unsupported',
                };
            if (candidates.length > 1)
                return {
                    /** Do not infer user intent from priority or registration order. */
                    status: 'selection-required',
                    /** Keep absolute paths in Main. */
                    providers: candidates.map((item) => ({
                        id: item.providerId,
                        title: item.title,
                    })),
                };
            const selected = candidates[0];
            const matched = files.filter((file) =>
                selected.descriptor.extensions.includes(
                    path.extname(file).toLowerCase(),
                ),
            );
            return {
                /** Reflects the selected adapter's handoff outcome. */
                status: (await execute(selected, matched))
                    ? 'opened'
                    : 'unsupported',
            };
        } finally {
            this.pending = false;
        }
    }
}
