import { Button } from '@kawaikara/kawai-ui';
import './CopyIconButton.css';

/** Compact, consistently sized action for copying an entire information panel. */
export function CopyIconButton({ label, onClick }: {
    /** Accessible name and tooltip describing what will be copied. */
    readonly label: string;
    /** Copies the owning panel's values. */
    readonly onClick: () => void;
}) {
    return (
        <Button className="copy-icon-button" size="sm" variant="secondary"
            aria-label={label} title={label} onClick={onClick}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M16 8V4H4v12h4" />
            </svg>
        </Button>
    );
}
