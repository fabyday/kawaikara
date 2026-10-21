import { useLayoutEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@kawaikara/kawai-ui';
import '../../Styles/ExternalAppSetup.css';

/** Presentation-only identity supplied by bundled metadata or a Main-validated public descriptor. */
export interface ExternalAppPresentation {
    /** Display name; never used to resolve or launch an executable. */
    readonly name: string;
    /** Bundled artwork or a Main-normalized data URL; this view never fetches remote images. */
    readonly image?: string;
}

/** Centered requirement dialog shared independently of any adapter or installer. */
export function ExternalAppSetupPanel({
    app,
    status,
    closeLabel,
    onClose,
    children,
}: {
    /** Display identity only; not proof of publisher trust or registration. */
    readonly app: ExternalAppPresentation;
    /** Status measured by the local adapter, already localized. */
    readonly status: string;
    /** Accessible label for the large close control. */
    readonly closeLabel: string;
    /** Dismisses only this overlay, without navigating the Provider. */
    readonly onClose?: () => void;
    /** Adapter-specific guidance and explicitly initiated actions. */
    readonly children: ReactNode;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useLayoutEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);
    return (
        <dialog
            ref={dialog}
            className="external-app-setup-panel"
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClose?.();
            }}
            onClick={(event) => {
                if (event.target !== event.currentTarget) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                if (
                    event.clientX < bounds.left ||
                    event.clientX > bounds.right ||
                    event.clientY < bounds.top ||
                    event.clientY > bounds.bottom
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose?.();
                }
            }}>
            <div className="external-app-setup-artwork">
                {app.image ? (
                    <img src={app.image} alt="" draggable={false} />
                ) : (
                    <span aria-hidden="true">{app.name.slice(0, 1)}</span>
                )}
                {onClose ? (
                    <Button
                        autoFocus
                        className="external-app-setup-close"
                        variant="secondary"
                        aria-label={closeLabel}
                        title={closeLabel}
                        onClick={onClose}>
                        ×
                    </Button>
                ) : null}
            </div>
            <div className="external-app-setup-body">
                <header className="external-app-setup-heading">
                    <h1 id={titleId}>{app.name}</h1>
                    <p className="external-app-setup-status" role="status">
                        {status}
                    </p>
                </header>
                {children}
            </div>
        </dialog>
    );
}
