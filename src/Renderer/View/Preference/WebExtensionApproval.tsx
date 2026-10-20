import { useEffect, useRef, useState } from 'react';
import { Button, Flex, Text } from '@kawaikara/kawai-ui';
import type { AppMessages } from '../../../Common/IPC';
import './Tabs/WebExtensionControl.css';

/** Trusted application popup; closing or timing out never grants a request. */
export function WebExtensionApproval({
    messages,
}: {
    /** The messages value. */
    readonly messages: AppMessages['webExtension'];
}) {
    const [pending, setPending] = useState<{ id: string; detail: string }>();
    const [busy, setBusy] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const current = useRef<string | undefined>(undefined);
    useEffect(() => {
        let active = true;
        /** Performs the refresh operation. */
        const refresh = () =>
            void window.kawaikara.application
                .webExtensionConnection('status')
                .then((state) => {
                    if (!active) return;
                    setPending((previous) =>
                        previous?.id === state.approval?.id
                            ? previous
                            : state.approval,
                    );
                })
                .catch(() => undefined);
        refresh();
        const timer = setInterval(refresh, 400);
        return () => {
            active = false;
            clearInterval(timer);
            if (current.current)
                void window.kawaikara.application
                    .webExtensionConnection('deny', current.current)
                    .catch(() => undefined);
        };
    }, []);
    useEffect(() => {
        current.current = pending?.id;
        if (pending) dialog.current?.showModal();
        else dialog.current?.close();
    }, [pending?.id]);
    /** Performs the answer operation. */
    const answer = async (approved: boolean) => {
        if (!pending || busy) return;
        setBusy(true);
        try {
            await window.kawaikara.application.webExtensionConnection(
                approved ? 'approve' : 'deny',
                pending.id,
            );
            setPending(undefined);
        } catch {
            setPending(undefined);
        } finally {
            setBusy(false);
        }
    };
    return (
        <dialog
            className="web-extension-dialog"
            ref={dialog}
            aria-labelledby="extension-approval-title"
            onCancel={(event) => {
                event.preventDefault();
                void answer(false);
            }}>
            <h2 id="extension-approval-title">{messages.confirm}</h2>
            <Text size="sm" tone="muted">
                {messages.approvalDescription}
            </Text>
            <pre className="web-extension-request">{pending?.detail}</pre>
            <Flex justify="end" gap="sm">
                <Button
                    disabled={busy}
                    variant="secondary"
                    onClick={() => void answer(false)}>
                    {messages.cancel}
                </Button>
                <Button disabled={busy} onClick={() => void answer(true)}>
                    {messages.allow}
                </Button>
            </Flex>
        </dialog>
    );
}
