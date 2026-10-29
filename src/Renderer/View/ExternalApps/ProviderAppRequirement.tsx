import { useEffect, useState } from 'react';
import { Button, Stack, Text } from '@kawaikara/kawai-ui';
import type { AppMessages } from '../../../Common/IPC';
import type { ExternalAppSetupRequest } from '../../../Common/ExternalAppResources';
import type { DistributionPreview } from '../../../Common/ExternalAppDistribution';
import { ExternalAppSetupPanel } from './ExternalAppSetupPanel';
import { DistributionControls } from './DistributionControls';

/** Presents a Provider-declared third-party dependency without inventing an adapter or installation status. */
export function ProviderAppRequirement({
    request,
    labels,
    onClose,
}: {
    /** Main-resolved identity, manifest and original Provider source. */
    readonly request: ExternalAppSetupRequest;
    /** Localized distribution presentation. */
    readonly labels: AppMessages['externalApps']['distribution'];
    /** Dismisses the requirement and preserves the underlying Provider. */
    readonly onClose: () => void;
}) {
    const [preview, setPreview] = useState<DistributionPreview>();
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [missing, setMissing] = useState(false);
    const [denied, setDenied] = useState(false);
    useEffect(() => {
        let active = true;
        if (request.distributionUrl)
            void window.kawaikara.appDistribution
                .preview(request.distributionUrl, request.appId)
                .then((value) => {
                    if (active) setPreview(value);
                })
                .catch(() => {
                    if (active) setFailed(true);
                });
        return () => {
            active = false;
        };
    }, [request]);
    /** Re-dispatches through the registered Provider and normal app permission boundary. */
    const retry = async () => {
        setBusy(true);
        setFailed(false);
        setDenied(false);
        try {
            const result = await window.kawaikara.providerActions.request(
                request.sourceUrl,
                request.providerId,
            );
            if (result.accepted) onClose();
            else {
                setDenied(result.code === 'permission-denied');
                setMissing(result.code !== 'permission-denied');
                if (request.distributionUrl)
                    setPreview(
                        await window.kawaikara.appDistribution.preview(
                            request.distributionUrl,
                            request.appId,
                        ),
                    );
            }
        } catch {
            setFailed(true);
        } finally {
            setBusy(false);
        }
    };
    return (
        <ExternalAppSetupPanel
            app={{
                name: preview?.descriptor.name ?? request.appId,
                image: preview?.icon,
            }}
            status={
                denied
                    ? labels.permissionDenied
                    : missing || !request.distributionUrl
                    ? labels.missing
                    : failed
                      ? labels.error
                      : preview
                        ? labels.available
                        : labels.loading
            }
            closeLabel={labels.close}
            onClose={onClose}>
            <Stack gap="sm">
                {preview && (
                    <DistributionControls
                        preview={preview}
                        api={window.kawaikara.appDistribution}
                        labels={labels}
                    />
                )}
                <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void retry()}>
                    {labels.refresh}
                </Button>
                {failed && (
                    <Text role="alert" tone="danger">
                        {labels.error}
                    </Text>
                )}
            </Stack>
        </ExternalAppSetupPanel>
    );
}
