import type {
    ExternalAppPermission,
    ExternalAppPermissionKind,
} from '@kawaikara/site-api';
import { UnclippedSelect as Select } from './UnclippedSelect';
import type { ExternalAppPermissionChoices } from '../../../Common/ExternalApps';
import type { AppMessages } from '../../../Common/IPC';
import './ExternalAppPermissionCards.css';

/** One visible capability with the exact declaration IDs submitted to Main. */
export interface PermissionGroup {
    /** Host capability; different kinds must never share a decision. */
    readonly kind: ExternalAppPermissionKind;
    /** Original permission identities, retained for consent validation. */
    readonly ids: string[];
    /** Unique exact origins; no wildcard or domain widening. */
    readonly origins: string[];
}

/** Groups equivalent capabilities for display while preserving every declared permission ID and origin. */
export function groupExternalAppPermissions(
    permissions: readonly ExternalAppPermission[],
): PermissionGroup[] {
    const groups = new Map<ExternalAppPermissionKind, PermissionGroup>();
    for (const permission of permissions) {
        let group = groups.get(permission.kind);
        if (!group) {
            group = { kind: permission.kind, ids: [], origins: [] };
            groups.set(permission.kind, group);
        }
        if (!group.ids.includes(permission.id)) group.ids.push(permission.id);
        for (const origin of permission.origins)
            if (!group.origins.includes(origin)) group.origins.push(origin);
    }
    return [...groups.values()];
}

/** Grouped permission cards; changing presentation never adds undeclared grants. */
export function ExternalAppPermissionCards({
    permissions,
    choices,
    cookieChoice,
    onCookieChoice,
    onChoices,
    messages,
    disabled,
}: {
    /** Declarations filtered to the exact prompt scope by the caller. */
    readonly permissions: readonly ExternalAppPermission[];
    /** Currently selected original declaration IDs. */
    readonly choices: ExternalAppPermissionChoices;
    /** Present for a single runtime cookie prompt. */
    readonly cookieChoice?: string;
    /** Updates a runtime cookie choice without granting it until confirmation. */
    readonly onCookieChoice: (value: string) => void;
    /** Updates the pending registration grants without saving them. */
    readonly onChoices: (value: ExternalAppPermissionChoices) => void;
    /** Shared localized approval copy. */
    readonly messages: AppMessages['externalApps'];
    /** Prevents changes while a decision is being submitted. */
    readonly disabled: boolean;
}) {
    return (
        <div className="external-permission-cards">
            {groupExternalAppPermissions(permissions).map((group) => {
                const cookies = group.kind === 'cookies.read';
                const title = cookies ? messages.cookies : messages.url;
                return (
                    <section
                        className="external-permission-card"
                        key={group.kind}
                        aria-label={title}>
                        <div className="external-permission-heading">
                            <div className="external-permission-choice">
                                <Select
                                    aria-label={title}
                                    listClassName="external-app-permission-options"
                                    disabled={disabled}
                                    value={
                                        cookieChoice ??
                                        choices[group.ids[0]] ??
                                        'deny'
                                    }
                                    options={[
                                        {
                                            value: 'deny',
                                            label: messages.denied,
                                        },
                                        { value: 'once', label: messages.once },
                                        {
                                            value: 'always',
                                            label: messages.always,
                                        },
                                    ]}
                                    onValueChange={(value) => {
                                        if (cookieChoice !== undefined)
                                            onCookieChoice(value);
                                        else
                                            onChoices({
                                                ...choices,
                                                ...Object.fromEntries(
                                                    group.ids.map((id) => [
                                                        id,
                                                        value as
                                                            | 'deny'
                                                            | 'once'
                                                            | 'always',
                                                    ]),
                                                ),
                                            });
                                    }}
                                />
                            </div>
                            <span
                                className="external-permission-symbol"
                                aria-hidden="true">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round">
                                    {cookies ? (
                                        <>
                                            <path d="M20.5 12a8.5 8.5 0 1 1-8.5-8.5 4 4 0 0 0 4 4 4 4 0 0 0 4.5 4.5Z" />
                                            <path d="M8 9h.01M9 15h.01M15 15h.01" />
                                        </>
                                    ) : (
                                        <>
                                            <path d="m10 13 4-4M8 15l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M16 9l1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" />
                                        </>
                                    )}
                                </svg>
                            </span>
                            <div className="external-permission-copy">
                                <h3>{title}</h3>
                                <p>
                                    {cookies
                                        ? messages.cookieDescription
                                        : messages.urlDescription}
                                </p>
                            </div>
                        </div>
                        <div className="external-permission-sites">
                            <span>{messages.sites}</span>
                            <ul>
                                {group.origins.map((origin) => (
                                    <li key={origin}>{origin}</li>
                                ))}
                            </ul>
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
