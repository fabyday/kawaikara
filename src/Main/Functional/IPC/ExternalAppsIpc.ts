import { launchManualConnection } from '../ExternalApps/ManualConnection';
import type { ExternalAppProviderGrant } from '../../../Common/ExternalApps';
import type { ProviderManager } from '../../Manager/ProviderManager';
import { IPC_CHANNELS } from '../../../Common/IPC';
import type { ExternalAppManager } from '../../Manager/ExternalAppManager';
import { requireSettingsSender } from './SettingsSender';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Exposes only registration decisions/revocation to the trusted application settings frame. */
export function connectExternalAppsIpc(
    externalApps: ExternalAppManager,
    sites: ProviderManager,
): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.handle(
            IPC_CHANNELS.application.externalApps,
            async (event, operation: unknown, id: unknown, grants: unknown) => {
                requireSettingsSender(event);
                if (
                    operation === 'approve' ||
                    operation === 'deny' ||
                    operation === 'allow-always'
                ) {
                    if (
                        typeof id !== 'string' ||
                        (operation !== 'deny' &&
                            (!Array.isArray(grants) ||
                                grants.some(
                                    (value) => typeof value !== 'string',
                                )))
                    )
                        throw new Error(
                            'Invalid external app permission decision.',
                        );
                    externalApps.permissions.decide(
                        id,
                        operation !== 'deny' ? (grants as string[]) : undefined,
                        operation === 'allow-always',
                    );
                } else if (operation === 'approve-choices') {
                    if (typeof id !== 'string')
                        throw new Error('Invalid approval identity.');
                    externalApps.permissions.decideChoices(id, grants);
                } else if (operation === 'configure') {
                    const descriptor = externalApps
                        .descriptors()
                        .find((item) => item.id === id);
                    const grant = grants as ExternalAppProviderGrant;
                    if (
                        !descriptor ||
                        !grant ||
                        !sites
                            .listExternalAppProviders()
                            .some(
                                (provider) =>
                                    provider.id === grant.providerId &&
                                    provider.appIds.includes(descriptor.id),
                            )
                    )
                        throw new Error('Undeclared external app Provider.');
                    await externalApps.permissions.configureProvider(
                        descriptor,
                        grant,
                    );
                } else if (operation === 'launch') {
                    await launchManualConnection();
                } else if (operation === 'connect') {
                    if (
                        typeof id !== 'string' ||
                        !externalApps.developmentConnection
                    )
                        throw new Error('Invalid connection request.');
                    await externalApps.developmentConnection.connect(id);
                } else if (operation === 'automatic') {
                    if (
                        (id !== 'true' && id !== 'false') ||
                        !externalApps.developmentConnection
                    )
                        throw new Error('Invalid connection preference.');
                    await externalApps.developmentConnection.setAutomatic(
                        id === 'true',
                    );
                } else if (operation === 'revoke') {
                    if (typeof id !== 'string')
                        throw new Error('Invalid external app identity.');
                    await externalApps.developmentConnection?.forget(id);
                    await externalApps.permissions.revoke(id);
                } else if (operation !== 'status')
                    throw new Error('Unknown external app operation.');
                await externalApps.developmentConnection?.reconcile();
                return {
                    connectionAutomatic:
                        externalApps.developmentConnection?.automatic,
                    connectionCandidates:
                        await externalApps.developmentConnection?.candidates(),
                    ...(await externalApps.permissions.status()),
                    providers: sites.listExternalAppProviders(),
                    descriptors: externalApps.descriptors(),
                    icons: externalApps.developmentConnection?.iconCache?.snapshot(),
                    development: externalApps.developmentConnection
                        ? externalApps.descriptors().map((item) => ({
                              appId: item.id,
                              online: externalApps.developmentConnection!.online(
                                  item.id,
                              ),
                          }))
                        : undefined,
                };
            },
        );
    });
}
