import { Button } from '@kawaikara/kawai-ui';
import { RightArrowIcon } from './RightArrowIcon';
import './BackIconButton.css';

/** Shared, clearly bounded navigation control for detail views. */
export function BackIconButton({ label, onClick }: {
    /** Localized accessible name and tooltip. */
    readonly label: string;
    /** Returns to the parent view. */
    readonly onClick: () => void;
}) {
    return (
        <Button
            className="back-icon-button"
            size="icon"
            variant="secondary"
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
        >
            <RightArrowIcon className="back-icon-button-arrow" />
        </Button>
    );
}
