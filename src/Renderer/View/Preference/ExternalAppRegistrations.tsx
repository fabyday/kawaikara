import { useEffect, useRef, useState } from 'react';
import {
    Button,
    Flex,
    Panel,
    Select,
    Stack,
    Switch,
    Text,
} from '@kawaikara/kawai-ui';
import type { AppMessages } from '../../../Common/IPC';
import type {
    ExternalAppProviderGrant,
    ExternalAppSettingsState,
    ExternalAppCookiePolicy,
} from '../../../Common/ExternalApps';
import './ExternalAppRegistrations.css';

/** Compact registrations with independently editable permissions in a modal detail panel. */
export function ExternalAppRegistrations({
    state,
    messages,
    onState,
}: {
    /** The state value. */
    readonly state: ExternalAppSettingsState;
    /** The messages value. */
    readonly messages: AppMessages['externalApps'];
    /** Callback used to handle on state. */
    readonly onState: (state: ExternalAppSettingsState) => void;
}) {
    const [busy, setBusy] = useState(false);
    const locked = useRef(false);
    const [error, setError] = useState(false);
    const [choosing, setChoosing] = useState(false);
    const [requested, setRequested] = useState(false);
    const [selectedId, setSelectedId] = useState<string>();
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (!requested) return;
        const timer = setTimeout(() => setRequested(false), 8000);
        return () => clearTimeout(timer);
    }, [requested]);
    const selected = state.registrations.find(
        (item) => item.appId === selectedId,
    );
    const descriptor = state.descriptors?.find(
        (item) => item.id === selectedId,
    );
    useEffect(() => {
        if (selected) dialog.current?.showModal();
        else dialog.current?.close();
    }, [selected?.appId]);

    /** Persists each permission immediately; closing the popup never discards a hidden draft. */
    const change = async (
        operation: 'configure' | 'revoke' | 'status' | 'connect' | 'automatic' | 'launch',
        appId: string,
        grant?: ExternalAppProviderGrant,
    ) => {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setError(false);
        try {
            onState(
                await window.kawaikara.application.externalApps(
                    operation,
                    appId,
                    grant,
                ),
            );
            if (operation === 'connect') {
                setChoosing(false);
                setRequested(true);
            }
        } catch {
            setError(true);
        } finally {
            locked.current = false;
            setBusy(false);
        }
    };
    /** Performs the icon operation. */
    const icon = (id: string, name: string) => (
        <span className="external-app-icon" aria-hidden="true">
            {state.icons?.[id] ? (
                <img src={state.icons[id]} alt="" draggable={false} />
            ) : (
                name.slice(0, 1).toUpperCase()
            )}
        </span>
    );
    /** Performs the status operation. */
    const status = (id: string) =>
        state.development
            ? state.development.find((item) => item.appId === id)?.online
                ? messages.developmentConnected
                : messages.developmentWaiting
            : messages.registered;
    return (
        <Panel padding="md" radius="md">
            <Stack gap="sm">
                <Text weight="semibold">{messages.title}</Text>
                <Text size="sm" tone="muted">{messages.manualConnectionHelp}</Text>
                <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void change('launch', '')}>
                    {messages.manualConnection}
                </Button>
                {state.development && (
                    <>
                        <Text size="sm" tone="muted">
                            {messages.connectionHelp}
                        </Text>
                        <Flex align="center" gap="sm" wrap>
                            <Switch
                                label={messages.automaticConnection}
                                checked={state.connectionAutomatic !== false}
                                disabled={busy}
                                onCheckedChange={(enabled) =>
                                    void change('automatic', String(enabled))
                                }
                            />
                            <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() => {
                                    setChoosing(!choosing);
                                    setRequested(false);
                                    void change('status', '');
                                }}>
                                {messages.runningConnections}
                            </Button>
                        </Flex>
                        {choosing && (
                            <Stack gap="sm">
                                {!state.connectionCandidates?.length && (
                                    <Text size="sm" tone="muted">
                                        {messages.noCandidates}
                                    </Text>
                                )}
                                {state.connectionCandidates?.map(
                                    (candidate) => (
                                        <Button
                                            key={candidate.clientId}
                                            variant="secondary"
                                            disabled={busy}
                                            onClick={() =>
                                                void change(
                                                    'connect',
                                                    candidate.clientId,
                                                )
                                            }>
                                            {state.descriptors?.find(
                                                (item) =>
                                                    item.id === candidate.appId,
                                            )?.name ?? candidate.appId}{' '}
                                            · {candidate.clientId.slice(0, 8)}
                                        </Button>
                                    ),
                                )}
                            </Stack>
                        )}
                        {requested && (
                            <Text size="sm" role="status">
                                {messages.connectionRequested}
                            </Text>
                        )}
                    </>
                )}
                {!state.development && !state.registrations.length && (
                    <Text size="sm" tone="muted">
                        {state.development
                            ? messages.developmentHelp
                            : messages.empty}
                    </Text>
                )}
                {state.registrations.map((registration) => (
                    <div className="external-app-row" key={registration.appId}>
                        {icon(registration.appId, registration.name)}
                        <div className="external-app-identity">
                            <Text weight="semibold">{registration.name}</Text>
                            <Text size="sm" tone="muted">
                                {status(registration.appId)}
                            </Text>
                        </div>
                        <div className="external-app-actions">
                            <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() => {
                                    setError(false);
                                    setSelectedId(registration.appId);
                                }}>
                                {messages.permissions}
                            </Button>
                            <Button
                                variant="secondary"
                                className="external-app-revoke"
                                disabled={busy}
                                onClick={() =>
                                    void change('revoke', registration.appId)
                                }>
                                {messages.revoke}
                            </Button>
                        </div>
                    </div>
                ))}
                {error && !selected && (
                    <Text role="alert">{messages.error}</Text>
                )}
            </Stack>
            <dialog
                ref={dialog}
                className="web-extension-dialog external-app-permissions"
                aria-label={messages.permissions}
                onClose={() => setSelectedId(undefined)}
                onCancel={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!busy) dialog.current?.close();
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') event.stopPropagation();
                }}
                onClick={(event) => {
                    if (event.target !== event.currentTarget) return;
                    event.stopPropagation();
                    const box = event.currentTarget.getBoundingClientRect();
                    if (
                        !busy &&
                        (event.clientX < box.left ||
                            event.clientX > box.right ||
                            event.clientY < box.top ||
                            event.clientY > box.bottom)
                    )
                        event.currentTarget.close();
                }}>
                {selected && (
                    <Stack gap="md">
                        <div className="web-extension-dialog-header">
                            <Flex align="center" gap="sm">
                                {icon(selected.appId, selected.name)}
                                <div>
                                    <h2>{selected.name}</h2>
                                    <Text size="sm" tone="muted">
                                        {messages.permissions}
                                    </Text>
                                </div>
                            </Flex>
                            <Button
                                className="web-extension-icon-button"
                                variant="secondary"
                                aria-label={messages.close}
                                disabled={busy}
                                onClick={() => dialog.current?.close()}>
                                ×
                            </Button>
                        </div>
                        <Text size="sm" tone="muted">
                            {messages.permissionHelp}
                        </Text>
                        {state.development && (
                            <Text size="sm" tone="muted">
                                {messages.developmentHelp}
                            </Text>
                        )}
                        {(state.providers ?? [])
                            .filter((provider) =>
                                provider.appIds.includes(selected.appId),
                            )
                            .map((provider) => {
                                const grant: ExternalAppProviderGrant =
                                    selected.providers?.find(
                                        (item) =>
                                            item.providerId === provider.id,
                                    ) ?? {
                                        providerId: provider.id,
                                        enabled: false,
                                        grants: [],
                                        cookies: {},
                                    };
                                return (
                                    <fieldset
                                        key={provider.id}
                                        disabled={busy}
                                        className="external-app-provider">
                                        <legend>{provider.name}</legend>
                                        <Stack gap="md">
                                            <Switch
                                                checked={grant.enabled}
                                                label={messages.enabled}
                                                onCheckedChange={(enabled) =>
                                                    void change(
                                                        'configure',
                                                        selected.appId,
                                                        { ...grant, enabled },
                                                    )
                                                }
                                            />
                                            {descriptor?.permissions.map(
                                                (permission) =>
                                                    permission.kind ===
                                                    'cookies.read' ? (
                                                        <Select
                                                            listClassName="external-app-permission-options"
                                                            key={permission.id}
                                                            disabled={busy}
                                                            label={
                                                                messages.cookies
                                                            }
                                                            aria-label={`${provider.name} ${messages.cookies}`}
                                                            value={
                                                                grant.cookies[
                                                                    permission
                                                                        .id
                                                                ] ?? 'deny'
                                                            }
                                                            options={[
                                                                {
                                                                    value: 'ask',
                                                                    label: messages.ask,
                                                                },
                                                                {
                                                                    value: 'allow',
                                                                    label: messages.always,
                                                                },
                                                                {
                                                                    value: 'deny',
                                                                    label: messages.denied,
                                                                },
                                                            ]}
                                                            onValueChange={(
                                                                value,
                                                            ) =>
                                                                void change(
                                                                    'configure',
                                                                    selected.appId,
                                                                    {
                                                                        ...grant,
                                                                        cookies:
                                                                            {
                                                                                ...grant.cookies,
                                                                                [permission.id]:
                                                                                    value as ExternalAppCookiePolicy,
                                                                            },
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    ) : (
                                                        <Switch
                                                            key={permission.id}
                                                            checked={grant.grants.includes(
                                                                permission.id,
                                                            )}
                                                            label={messages.url}
                                                            onCheckedChange={(
                                                                enabled,
                                                            ) =>
                                                                void change(
                                                                    'configure',
                                                                    selected.appId,
                                                                    {
                                                                        ...grant,
                                                                        grants: enabled
                                                                            ? [
                                                                                  ...new Set(
                                                                                      [
                                                                                          ...grant.grants,
                                                                                          permission.id,
                                                                                      ],
                                                                                  ),
                                                                              ]
                                                                            : grant.grants.filter(
                                                                                  (
                                                                                      id,
                                                                                  ) =>
                                                                                      id !==
                                                                                      permission.id,
                                                                              ),
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    ),
                                            )}
                                        </Stack>
                                    </fieldset>
                                );
                            })}
                        {error && <Text role="alert">{messages.error}</Text>}
                    </Stack>
                )}
            </dialog>
        </Panel>
    );
}
