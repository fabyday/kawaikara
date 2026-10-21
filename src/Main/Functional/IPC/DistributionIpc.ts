import { app, shell } from 'electron';
import { IPC_CHANNELS, type AppLocale } from '../../../Common/IPC';
import { getLocaleMessages } from '../Localization/Locale';
import { DistributionCatalog } from '../ExternalApps/Distribution/Catalog';
import { DistributionRepository } from '../ExternalApps/Distribution/Repository';
import { prepareDistributionArtifact } from '../ExternalApps/Distribution/Installer';
import { requireSettingsSender } from './SettingsSender';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Registers distribution lookup independently of adapter/permission registration. */
export function connectDistributionIpc(getLocale: () => AppLocale): DisposeIpc {
    const testing = __KAWAIKARA_EXTERNAL_APP_TESTING__
        ? (require('../ExternalApps/Distribution/LocalTesting') as typeof import('../ExternalApps/Distribution/LocalTesting')).localDistributionTest(process.env.KAWAIKARA_EXTERNAL_APP_TEST_MANIFEST)
        : undefined;
    let catalog: Promise<DistributionCatalog> | undefined;
    /** Defers disk-path initialization until an authorized UI lookup actually needs the cache. */
    const getCatalog = () =>
        (catalog ??= import('../App/UserDataPaths').then(
            ({ getKawaiDataPath }) =>
                new DistributionCatalog(
                    new DistributionRepository(
                        getKawaiDataPath(
                            'cache',
                            __KAWAIKARA_EXTERNAL_APP_TESTING__ && testing
                                ? 'app-distributions-local-test'
                                : 'app-distributions',
                        ),
                        undefined,
                        testing?.origin,
                    ),
                    (url) => shell.openExternal(url),
                    (preview, install) =>
                        prepareDistributionArtifact(
                            preview,
                            install,
                            getLocaleMessages(getLocale(), app.getLocale()).app
                                .externalApps.distribution,
                            testing?.origin,
                        ),
                    process.platform,
                    process.arch,
                    testing?.origin,
                ),
        ));
    return registerIpcBindings((ipc) => {
        ipc.handle(
            IPC_CHANNELS.application.appDistribution,
            async (
                event,
                operation: unknown,
                value: unknown,
                expectedId: unknown,
            ) => {
                requireSettingsSender(event);
                if (
                    typeof value !== 'string' ||
                    (expectedId !== undefined &&
                        (typeof expectedId !== 'string' ||
                            expectedId.length > 160))
                )
                    throw new Error('Invalid distribution request.');
                const service = await getCatalog();
                return operation === 'preview'
                    ? service.preview(
                          testing && expectedId === testing.appId
                              ? testing.manifestUrl
                              : value,
                          expectedId as string | undefined,
                      )
                    : service.act(value, operation);
            },
        );
    });
}
