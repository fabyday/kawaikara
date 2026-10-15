import { CopyIconButton } from '../../../Component/CopyIconButton';
import { BrowserIcon } from '../../../Component/BrowserIcon';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import './WebExtensionControl.css';
import { useEffect, useRef, useState } from 'react';
import { Button, Panel, Stack, Text } from '@kawaikara/kawai-ui';
import type { AppMessages } from '../../../../Common/IPC';

type Connection = Awaited<
    ReturnType<typeof window.kawaikara.application.webExtensionConnection>
>;
/** Controls pairing, channel selection, and safe connected-client metadata. */
export function WebExtensionControl({
    messages,
}: {
    readonly messages: AppMessages['webExtension'];
}) {
    const [busy, setBusy] = useState(false);
    const [copyNotice, setCopyNotice] = useState('');
    const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(copyTimer.current), []);
    const [status, setStatus] = useState('');
    const [connection, setConnection] = useState<Connection>();
    const [details, setDetails] = useState(false);
    const clientDialog = useRef<HTMLDialogElement>(null);
    const [selectedClient, setSelectedClient] = useState<NonNullable<Connection['connections']>[number]>();
    useEffect(() => { if (selectedClient) clientDialog.current?.showModal(); }, [selectedClient]);
    const [advanced, setAdvanced] = useState(false);
    const [browsers, setBrowsers] = useState<Connection['browsers']>();
    const [developmentRequest, setDevelopmentRequest] = useState(false);
    const browserDialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (browsers) browserDialog.current?.showModal();
    }, [browsers]);
    useEffect(() => {
        if (!status) return;
        const timer = setTimeout(() => setStatus(''), 7000);
        return () => clearTimeout(timer);
    }, [status]);
    const locked = useRef(false);
    const reducedMotion = useReducedMotion();
    useEffect(() => {
        let active = true;
        const refresh = () =>
            void window.kawaikara.application
                .webExtensionConnection('status')
                .then((value) => {
                    if (active && !locked.current)
                        setConnection((previous) =>
                            JSON.stringify(previous) === JSON.stringify(value)
                                ? previous
                                : value,
                        );
                })
                .catch(() => undefined);
        refresh();
        const timer = setInterval(refresh, 2000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, []);
    const run = async (
        operation: Parameters<
            typeof window.kawaikara.application.webExtensionConnection
        >[0],
        id?: string,
    ) => {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        try {
            setConnection(
                await window.kawaikara.application.webExtensionConnection(
                    operation,
                    id,
                ),
            );
            setStatus(
                operation === 'connect' || operation === 'connect-browser'
                    ? messages.connecting
                    : operation === 'copy'
                      ? messages.copied
                      : operation === 'revoke' || operation === 'revoke-client'
                        ? messages.revoked
                        : '',
            );
        } catch {
            setStatus(messages.failed);
        } finally {
            locked.current = false;
            setBusy(false);
        }
    };
    const addConnection = (development = false) => {
        setDevelopmentRequest(development);
        setBusy(true);
        void window.kawaikara.application.webExtensionConnection('browsers')
            .then(value => setBrowsers((value.browsers ?? [])))
            .catch(() => setStatus(messages.failed)).finally(() => setBusy(false));
    };
    const metadataRows = [
        [messages.extensionName, selectedClient?.extension?.name],
        [messages.versionLabel, selectedClient?.extension?.version],
        ['Extension ID', selectedClient?.client?.replace(/^[^:]+:\/\//, '')],
        [messages.connectionMode, selectedClient?.extension?.connectionMode === 'development' ? messages.pageDevelopment : selectedClient?.extension?.connectionMode === 'production' ? messages.pageProduction : undefined],
        [messages.browserLabel, selectedClient?.extension?.browser],
        [messages.browserVersion, selectedClient?.extension?.browserVersion],
        ['OS', selectedClient?.extension?.os],
        [messages.osVersion, selectedClient?.extension?.osVersion],
        [messages.cpuArchitecture, selectedClient?.extension?.cpu],
    ];
    return (
        <Panel padding="md" radius="md" className="web-extension-panel">
            <Stack gap="sm">
                <div className="web-extension-heading">
                    <Text weight="semibold">{messages.title}</Text>
                    <span
                        className={`web-extension-status ${connection?.connected ? 'is-connected' : ''}`}
                        role="status">
                        <i aria-hidden="true" />
                        {connection?.connected
                            ? messages.connected
                            : messages.disconnected}
                    </span>
                </div>
                <Text size="xs" tone="muted">
                    {messages.description}
                </Text>
                <div className="web-extension-actions">
                    <Button
                        className="web-extension-primary"
                        aria-busy={busy}
                        disabled={!connection}
                        onClick={() => connection?.connected ? addConnection() : void run('connect')}>
                        {connection?.connected ? messages.addConnection : messages.connect}
                    </Button>
                    <Button
                        variant="secondary"
                        className="web-extension-advanced-toggle"
                        aria-expanded={advanced}
                        onClick={() => setAdvanced(!advanced)}>
                        <span>{messages.advanced}</span>
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                            style={{
                                transform: advanced
                                    ? 'rotate(180deg)'
                                    : undefined,
                            }}>
                            <path
                                d="m4 6 4 4 4-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </Button>
                    <Button
                        variant="secondary"
                        className="web-extension-advanced-toggle"
                        aria-expanded={details && !!connection?.connected}
                        aria-controls="extension-connections"
                        disabled={!connection?.connected}
                        onClick={() => setDetails(!details)}>
                        <span>{messages.details}</span>
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"
                            style={{ transform: details && connection?.connected ? 'rotate(180deg)' : undefined }}>
                            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </Button>
                </div>
                    <AnimatePresence initial={false}>
                        {advanced && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                    duration: reducedMotion ? 0 : 0.2,
                                }}
                                style={{ overflow: 'hidden' }}>
                                <Stack
                                    gap="none"
                                    className="web-extension-advanced">
                                    <div className="web-extension-advanced-actions">
                                    <Button variant="secondary" disabled={busy || !connection} onClick={() => addConnection(true)}>{messages.openDevelopment}</Button>
                                    <Button
                                        aria-busy={busy}
                                        onClick={() => void run('copy')}>
                                        {messages.copy}
                                    </Button>
                                    </div>
                                    <div className="web-extension-notice" role="status" aria-live="polite">
                                        <AnimatePresence initial={false} mode="wait">
                                            {status && (
                                                <motion.div
                                                    key={status}
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{
                                                        height: { duration: reducedMotion ? 0 : 0.24, ease: 'easeInOut' },
                                                        opacity: { duration: reducedMotion ? 0 : 0.16, delay: reducedMotion ? 0 : 0.06 },
                                                    }}
                                                    style={{ overflow: 'hidden' }}>
                                                    <div className="web-extension-notice-content">
                                                        <Text size="xs">{status}</Text>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </Stack>
                            </motion.div>
                        )}
                    </AnimatePresence>
                <AnimatePresence initial={false}>
                    {details && connection?.connected && (
                        <motion.div id="extension-connections" key="connections"
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}
                            style={{ overflow: 'hidden' }}>
                            <Panel padding="sm" className="web-extension-connections" role="region" aria-label={messages.connectionsTitle}>
                                <Stack gap="sm">
                                    <Text size="xs" weight="semibold" tone="muted">{messages.connectionsTitle}</Text>
                                    {connection.connections?.map(client => (
                                        <div className="web-extension-client" key={client.id}>
                                            {client.extension?.icon && <img className="web-extension-client-icon" src={client.extension.icon} alt="" draggable={false} />}
                                            <Stack gap="xs" className="web-extension-client-name">
                                                <Text>{client.extension?.name ?? messages.title}</Text>
                                                <Text size="xs" tone="muted">{client.extension?.version ?? 'unknown'}{client.extension?.development ? ' · Development' : ''}</Text>
                                            </Stack>
                                            <span title={client.extension?.browser}><BrowserIcon browser={client.extension?.browser} /></span>
                                            <Button variant="secondary" size="sm" onClick={() => setSelectedClient(client)}>{messages.clientDetails}</Button>
                                            <Button className="web-extension-disconnect" variant="secondary" size="sm" disabled={busy} onClick={() => void run('revoke-client', client.id)}>{messages.disconnectClient}</Button>
                                        </div>
                                    ))}
                                </Stack>
                            </Panel>
                        </motion.div>
                    )}
                </AnimatePresence>
                <dialog ref={clientDialog} className="web-extension-dialog" aria-label={messages.clientDetails}
                    onClose={() => { setSelectedClient(undefined); setCopyNotice(''); clearTimeout(copyTimer.current); }}
                    onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) event.currentTarget.close(); }}>
                    <div className="web-extension-dialog-header">
                        <h2>{messages.clientDetails}</h2>
                        <Button className="web-extension-icon-button" variant="secondary" aria-label={messages.close} onClick={() => clientDialog.current?.close()}>×</Button>
                    </div>
                    <div className="web-extension-metadata-copy">
                        <CopyIconButton label={messages.copyValues} onClick={async () => {
                            clearTimeout(copyTimer.current);
                            try { await window.kawaikara.application.copyText(metadataRows.map(([, value]) => value ?? messages.unavailable).join('\n')); setCopyNotice(messages.copySuccess); }
                            catch { setCopyNotice(messages.failed); }
                            copyTimer.current = setTimeout(() => setCopyNotice(''), 2200);
                        }} />
                    </div>
                    <AnimatePresence>
                        {copyNotice && <motion.div className="web-extension-copy-toast" role="status" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .16 }}>{copyNotice}</motion.div>}
                    </AnimatePresence>
                    <div className="web-extension-client-metadata">
                        {metadataRows.map(([label, value]) => <div className="web-extension-metadata-row" key={label}>
                            <span>{label}</span><span className="web-extension-metadata-value">{value ?? messages.unavailable}</span>

                        </div>)}
                    </div>
                </dialog>
                <dialog
                    ref={browserDialog}
                    aria-label={messages.addConnection}
                    className="web-extension-dialog"
                    onCancel={() => setBrowsers(undefined)}>
                    <h2>{developmentRequest ? messages.openDevelopment : messages.addConnection}</h2>
                    <Stack gap="sm">
                        <Button variant="secondary" onClick={() => { browserDialog.current?.close(); setBrowsers(undefined); void run(developmentRequest ? 'connect-development' : 'connect'); }}>{messages.defaultBrowser}</Button>
                        {browsers?.map((browser) => (
                            <Button
                                key={browser.id}
                                variant="secondary"
                                onClick={() => {
                                    browserDialog.current?.close();
                                    setBrowsers(undefined);
                                    void run(developmentRequest ? 'connect-development-browser' : 'connect-browser', browser.id);
                                }}>
                                <BrowserIcon browser={browser.id} />
                                {browser.name}
                            </Button>
                        ))}
                        <Button
                            variant="secondary"
                            onClick={() => {
                                browserDialog.current?.close();
                                setBrowsers(undefined);
                                void run(developmentRequest ? 'connect-development-custom' : 'connect-custom');
                            }}>
                            {messages.chooseBrowserApp}
                        </Button>
                        {browsers?.length === 0 && (
                            <Text>{messages.noBrowsers}</Text>
                        )}
                        <Button
                            variant="ghost"
                            onClick={() => {
                                browserDialog.current?.close();
                                setBrowsers(undefined);
                            }}>
                            {messages.close}
                        </Button>
                    </Stack>
                </dialog>
                {!advanced && (
                    <div
                        className="web-extension-inline-notice"
                        role="status"
                        aria-live="polite">
                        <AnimatePresence initial={false}>
                            {status && status !== messages.copied && (
                                <motion.div
                                    key={status}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{
                                        duration: reducedMotion ? 0 : 0.2,
                                    }}>
                                    <Text size="xs">{status}</Text>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </Stack>
        </Panel>
    );
}
