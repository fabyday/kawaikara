import { CopyIconButton } from './CopyIconButton';
import './ApplicationInfoControl.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Flex,
    Head,
    Panel,
    Stack,
    Text,
} from '@kawaikara/kawai-ui';
import type {
    ApplicationLogMetadata,
    LogViewerMessages,
} from '../../Common/IPC';

/** Describes the log metadata control props contract. */
export interface ApplicationInfoControlProps {
    /** The validated metadata value. */
    readonly metadata?: ApplicationLogMetadata;
    /** The localized messages value. */
    readonly messages: LogViewerMessages;
    /** The resolved locale value. */
    readonly locale: string;
    /** Optional context-specific trigger label. */
    readonly label?: string;
}

/** Renders the metadata trigger and its dismissible context panel. */
export function ApplicationInfoControl({
    metadata,
    messages,
    locale,
    label,
}: ApplicationInfoControlProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const rootRef = useRef<HTMLElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (!open || !panelRef.current || !rootRef.current) return;
        const panel = panelRef.current;
        panel.showPopover();
        const place = () => {
            const anchor = rootRef.current!.getBoundingClientRect();
            const bounds = panel.getBoundingClientRect();
            panel.style.left = `${Math.max(16, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 16))}px`;
            const below = anchor.bottom + 6;
            const top =
                below + bounds.height <= window.innerHeight - 16
                    ? below
                    : anchor.top - bounds.height - 6;
            panel.style.top = `${Math.max(16, Math.min(top, window.innerHeight - bounds.height - 16))}px`;
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, metadata]);
    const copyTimerRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!open) return;
        // Keep the panel mounted through pointerup. Removing it on pointerdown
        // exposes the underlying button to the later click in the same gesture.
        /** Consumes outside pointer events before controls behind the popup see them. */
        const consumeOutsidePointer = (event: PointerEvent) => {
            if (rootRef.current?.contains(event.target as Node)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        /** Dismisses on the consumed click, so one gesture closes only this layer. */
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (rootRef.current?.contains(event.target as Node)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('pointerdown', consumeOutsidePointer, true);
        window.addEventListener('pointerup', consumeOutsidePointer, true);
        window.addEventListener('click', closeOnOutsideClick, true);
        return () => {
            window.removeEventListener(
                'pointerdown',
                consumeOutsidePointer,
                true,
            );
            window.removeEventListener('pointerup', consumeOutsidePointer, true);
            window.removeEventListener('click', closeOnOutsideClick, true);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    useEffect(
        () => () => {
            if (copyTimerRef.current !== undefined) {
                window.clearTimeout(copyTimerRef.current);
            }
        },
        [],
    );

    /** Copies a readable metadata table to the system clipboard. */
    const copyMetadata = async () => {
        if (!metadata) return;
        await window.kawaikara.application.copyText(
            createMetadataText(metadata),
        );
        setCopied(true);
        if (copyTimerRef.current !== undefined) {
            window.clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = window.setTimeout(() => {
            copyTimerRef.current = undefined;
            setCopied(false);
        }, 1_500);
    };

    const rows = metadata ? createMetadataRows(metadata, messages, locale) : [];
    return (
        <Box className="log-metadata-control" position="relative" ref={rootRef}>
            <Button
                aria-expanded={open}
                aria-haspopup="dialog"
                disabled={!metadata}
                size="sm"
                title={
                    metadata ? messages.metadata : messages.metadataUnavailable
                }
                variant="secondary"
                onClick={() => setOpen((value) => !value)}>
                {label ?? messages.metadata}
            </Button>
            {open && metadata ? (
                <Panel
                    ref={panelRef}
                    popover="manual"
                    aria-label={messages.metadata}
                    className="log-metadata-panel"
                    padding="md"
                    radius="md"
                    role="dialog">
                    <Flex align="center" justify="between" gap="md">
                        <Head level={2} size="sm">
                            {messages.metadata}
                        </Head>
                        <Button
                            aria-label={messages.close}
                            className="log-metadata-close"
                            size="md"
                            title={messages.close}
                            variant="secondary"
                            onClick={() => setOpen(false)}>
                            <Text as="span" aria-hidden="true">
                                ×
                            </Text>
                        </Button>
                    </Flex>
                    <Flex className="log-metadata-copy-row" justify="end">
                        <CopyIconButton label={messages.copy} onClick={() => void copyMetadata()} />
                    </Flex>
                    {copied && <div className="log-metadata-copy-notice" role="status">{messages.copied}</div>}
                    <Stack className="log-metadata-table" gap="none">
                        {rows.map(([label, value]) => (
                            <Box className="log-metadata-row" key={label}>
                                <Text as="span" size="xs" tone="muted">
                                    {label}
                                </Text>
                                <Text
                                    as="span"
                                    className="log-metadata-value"
                                    size="xs">
                                    {value}
                                </Text>
                            </Box>
                        ))}
                    </Stack>
                </Panel>
            ) : null}
        </Box>
    );
}

/** Creates the visible metadata table rows. */
function createMetadataRows(
    metadata: ApplicationLogMetadata,
    messages: LogViewerMessages,
    locale: string,
): readonly (readonly [string, string])[] {
    return [
        [messages.metadataApplication, metadata.applicationName],
        [messages.metadataVersion, metadata.version],
        [messages.metadataChannel, metadata.channel],
        [messages.metadataPlatform, `${metadata.platform} · ${metadata.arch}`],
        [messages.metadataSiteApi, `v${String(metadata.siteApiVersion)}`],
        [
            messages.metadataRuntime,
            `Electron ${metadata.runtime.electron} · Chrome ${metadata.runtime.chrome} · Node ${metadata.runtime.node} · V8 ${metadata.runtime.v8}`,
        ],
        [messages.metadataSession, metadata.sessionId],
        ...(metadata.deviceId
            ? [[messages.metadataDeviceId, metadata.deviceId] as const]
            : []),
        [
            messages.metadataCreatedAt,
            new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'medium',
            }).format(new Date(metadata.createdAt)),
        ],
    ];
}

/** Creates the localized clipboard representation of log metadata. */
function createMetadataText(metadata: ApplicationLogMetadata): string {
    return [
        metadata.applicationName,
        metadata.version,
        metadata.channel,
        `${metadata.platform} · ${metadata.arch}`,
        `v${String(metadata.siteApiVersion)}`,
        `Electron ${metadata.runtime.electron} · Chrome ${metadata.runtime.chrome} · Node ${metadata.runtime.node} · V8 ${metadata.runtime.v8}`,
        metadata.sessionId,
    ].join('\n');
}
