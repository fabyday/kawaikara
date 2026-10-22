import { ExternalAppPermissionCards } from './ExternalAppPermissionCards';
import { ExternalAppRegistrations } from './ExternalAppRegistrations';
import { useEffect, useRef, useState } from 'react';
import { Button, Flex, Stack, Text } from '@kawaikara/kawai-ui';
import type { AppMessages } from '../../../Common/IPC';
import type {
    ExternalAppSettingsState,
    ExternalAppPermissionChoices,
} from '../../../Common/ExternalApps';
import './Tabs/WebExtensionControl.css';

/** Settings-only consent UI with independent, initially unchecked resource grants. */
export function ExternalAppApproval({
    messages,
    showRegistrations = false,
    onComplete,
}: {
    /** Localized UI copy; app-supplied identities remain plain text. */
    readonly messages: AppMessages['externalApps'];
    /** Advanced settings also displays finalized registrations with revoke controls. */
    readonly showRegistrations?: boolean;
    /** Closes a standalone consent surface after its pending decisions finish. */
    readonly onComplete?: () => void;
}) {
    const [state, setState] = useState<ExternalAppSettingsState>({
        registrations: [],
    });
    const [cookieChoice, setCookieChoice] = useState('deny');
    const [choices, setChoices] = useState<ExternalAppPermissionChoices>({});
    const grants = Object.keys(choices).filter((id) => choices[id] !== 'deny');
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
        setChoices(state.approval?.initialChoices ?? {});
        setCookieChoice('deny');
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
                approve
                    ? !state.approval.cookiePermission
                        ? 'approve-choices'
                        : remember
                          ? 'allow-always'
                          : 'approve'
                    : 'deny',
                id,
                approve
                    ? state.approval.cookiePermission
                        ? [state.approval.cookiePermission]
                        : choices
                    : undefined,
            );
            completed.current.add(id);
            setState(next);
            if (!next.approval) onComplete?.();
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
            className="web-extension-dialog external-app-approval"
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
                <ExternalAppPermissionCards
                    permissions={(
                        state.approval?.descriptor.permissions ?? []
                    ).filter(
                        (permission) =>
                            !state.approval?.cookiePermission ||
                            permission.id === state.approval.cookiePermission,
                    )}
                    choices={choices}
                    cookieChoice={
                        state.approval?.cookiePermission
                            ? cookieChoice
                            : undefined
                    }
                    onCookieChoice={setCookieChoice}
                    onChoices={setChoices}
                    messages={messages}
                    disabled={busy}
                />
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
                {error && <Text>{messages.error}</Text>}
                <Flex
                    className="external-app-approval-actions"
                    justify="end"
                    gap="sm">
                    <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void decide(false)}>
                        {state.approval?.cookiePermission
                            ? messages.denied
                            : messages.cancel}
                    </Button>
                    <Button
                        disabled={busy}
                        onClick={() =>
                            void decide(
                                !state.approval?.cookiePermission ||
                                    cookieChoice !== 'deny',
                                Boolean(state.approval?.cookiePermission) &&
                                    cookieChoice === 'always',
                            )
                        }>
                        {state.approval?.cookiePermission
                            ? messages.confirmChoice
                            : messages.approve}
                    </Button>
                </Flex>
            </Stack>
        </dialog>
    );
}
