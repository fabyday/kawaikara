import type { ExternalAppIntegration } from '@kawaikara/site-api';

/** Supported origins belong to this integration, never to the desktop host. */
const origins = ['https://www.youtube.com', 'https://youtube.com', 'https://m.youtube.com',
    'https://music.youtube.com', 'https://youtu.be', 'https://chzzk.naver.com'];

/** Shared app-owned integration used by the YouTube and CHZZK Providers. */
export const kawaiDownloaderIntegration: ExternalAppIntegration = {
    /** The descriptor value. */
    descriptor: {
        /** The schema version value. */
        schemaVersion: 1,
        /** The ID value. */
        id: 'day.faby.kawai-downloader',
        /** The name value. */
        name: 'kawai-downloader',
        /** The revision value. */
        revision: '2',
        /** The permissions value. */
        permissions: [
            {
                /** The ID value. */
                id: 'source',
                /** The kind value. */
                kind: 'resource.url',
                /** The origins value. */
                origins
            },
            {
                /** The ID value. */
                id: 'session',
                /** The kind value. */
                kind: 'cookies.read',
                /** The origins value. */
                origins
            },
        ],
        /** The actions value. */
        actions: [{
            /** The ID value. */
            id: 'open',
            /** The permissions value. */
            permissions: ['source']
        }],
    },
    /** The protocol value. */
    protocol: 'kawai-downloader',
    /** Serializes the downloader's existing protocol without changing its wire format. */
    createLaunchUrl(request, context) {
        if (request.action !== 'open' || request.parameters !== undefined)
            throw new TypeError('Invalid downloader request.');
        const url = new URL('kawai-downloader://open');
        url.searchParams.set('url', context.getUrl('source'));
        url.searchParams.set('requestId', context.callback.requestId);
        url.searchParams.set('callback', context.callback.callbackUrl);
        url.searchParams.set('token', context.callback.token);
        return url.toString();
    },
    /** Interprets downloader lifecycle events solely within the consuming Provider Bundle. */
    onEvent(value, requestId) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new TypeError('Invalid downloader event.');
        const event = value as Record<string, unknown>;
        if (event.requestId !== requestId || typeof event.timestamp !== 'string' ||
            !['request.received', 'source.accepted', 'source.rejected', 'download.queued',
                'download.progress', 'download.completed', 'download.failed'].includes(String(event.event)))
            throw new TypeError('Invalid downloader event identity.');
        return ['source.rejected', 'download.completed', 'download.failed'].includes(String(event.event));
    },
};
