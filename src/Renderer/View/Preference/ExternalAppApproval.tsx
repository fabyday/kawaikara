import { ExternalAppRegistrations } from './ExternalAppRegistrations';
import { useEffect, useRef, useState } from 'react';
import { Button, Flex, Stack, Text } from '@kawaikara/kawai-ui';
import type { AppMessages } from '../../../Common/IPC';
import type { ExternalAppSettingsState } from '../../../Common/ExternalApps';
import './Tabs/WebExtensionControl.css';

/** Settings-only consent UI with independent, initially unchecked resource grants. */
export function ExternalAppApproval({
    messages,
    showRegistrations = false,
}: {
    /** Localized UI copy; app-supplied identities remain plain text. */
    readonly messages: AppMessages['externalApps'];
    /** Advanced settings also displays finalized registrations with revoke controls. */
    readonly showRegistrations?: boolean;
}) {
    const [state, setState] = useState<ExternalAppSettingsState>({
        registrations: [],
    });
    const [grants, setGrants] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const completed = useRef(new Set<string>());
    const pendingId = useRef<string | undefined>(undefined);
    useEffect(() => {
        let active = true;
        /** Polls only public registration metadata while this settings view is mounted. */
        const refresh = () =>
            void window.kawaikara.application
                .externalApps?.('status')
                .then((next) => {
                    if (active)
                        setState(
                            next.approval &&
                                completed.current.has(next.approval.id)
                                ? { ...next, approval: undefined }
                                : next,
                        );
                })
                .catch(() => undefined);
        refresh();
        const timer = setInterval(refresh, 500);
        return () => {
            active = false;
            clearInterval(timer);
            if (!showRegistrations && pendingId.current)
                void window.kawaikara.application
                    .externalApps('deny', pendingId.current)
                    .catch(() => {});
        };
    }, [showRegistrations]);
    useEffect(() => {
        if (showRegistrations) return;
        pendingId.current = state.approval?.id;
        setGrants([]);
        setError(false);
        if (state.approval) dialog.current?.showModal();
        else dialog.current?.close();
    }, [state.approval?.id, showRegistrations]);
    /** Submits the current prompt once, preserving unselected permissions as denied. */
    const decide = async (approve: boolean, remember = false) => {
        if (!state.approval || busy) return;
        setBusy(true);
        try {
            const id = state.approval.id;
            const next = await window.kawaikara.application.externalApps(
                approve ? (remember ? 'allow-always' : 'approve') : 'deny',
                id,
                approve
                    ? state.approval.cookiePermission
                        ? [state.approval.cookiePermission]
                        : grants
                    : undefined,
            );
            completed.current.add(id);
            setState(next);
        } catch {
            setError(true);
        } finally {
            setBusy(false);
        }
    };
    if (showRegistrations)
        return (
            <ExternalAppRegistrations
                state={state}
                messages={messages}
                onState={setState}
            />
        );
    return (
        <dialog
            ref={dialog}
            className="web-extension-dialog"
            aria-labelledby="external-app-approval-title"
            onCancel={(event) => {
                event.preventDefault();
                void decide(false);
            }}>
            <Stack gap="md">
                <h2 id="external-app-approval-title">
                    {messages.review}: {state.approval?.descriptor.name}
                </h2>
                <Text size="sm" tone="muted">
                    {state.approval?.cookiePermission
                        ? messages.cookieReview
                        : messages.description}
                </Text>
                {state.approval?.provider && (
                    <Text weight="semibold">
                        {state.approval.provider.name}
                    </Text>
                )}
                {!state.approval?.cookiePermission &&
                    state.approval?.descriptor.permissions.map((permission) => (
                        <label key={permission.id} style={{ display: 'block' }}>
                            <input
                                type="checkbox"
                                checked={grants.includes(permission.id)}
                                disabled={busy}
                                onChange={(event) => {
                                    setGrants((current) =>
                                        event.target.checked
                                            ? [...current, permission.id]
                                            : current.filter(
                                                  (id) => id !== permission.id,
                                              ),
                                    );
                                }}
                            />{' '}
                            {permission.kind === 'cookies.read'
                                ? messages.cookies
                                : messages.url}
                            <div
                                style={{
                                    overflowWrap: 'anywhere',
                                    opacity: 0.7,
                                    marginLeft: 24,
                                }}>
                                {permission.origins.join(', ')}
                            </div>
                        </label>
                    ))}
                {!state.approval?.cookiePermission && (
                    <Text size="sm">
                        {messages.actions}:{' '}
                        {!state.approval?.cookiePermission &&
                            state.approval?.descriptor.actions
                                .map(
                                    (action) =>
                                        `${action.id}${action.permissions.every((id) => grants.includes(id)) ? ' ✓' : ' —'}`,
                                )
                                .join(', ')}
                    </Text>
                )}
                {state.approval?.cookiePermission && (
                    <Text size="sm" tone="muted">
                        {state.approval.descriptor.permissions
                            .find(
                                (item) =>
                                    item.id ===
                                    state.approval?.cookiePermission,
                            )
                            ?.origins.join(', ')}
                    </Text>
                )}
                {error && <Text>{messages.error}</Text>}
                <Flex justify="end" gap="sm">
                    <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void decide(false)}>
                        {state.approval?.cookiePermission
                            ? messages.denied
                            : messages.cancel}
                    </Button>
                    <Button disabled={busy} onClick={() => void decide(true)}>
                        {state.approval?.cookiePermission
                            ? messages.once
                            : messages.approve}
                    </Button>
                    {state.approval?.cookiePermission && (
                        <Button
                            disabled={busy}
                            onClick={() => void decide(true, true)}>
                            {messages.always}
                        </Button>
                    )}
                </Flex>
            </Stack>
        </dialog>
    );
}
