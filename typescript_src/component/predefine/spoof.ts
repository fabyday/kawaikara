// /// spoofing code
// // preload.ts

// const spoofedUA =
//     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';

// Object.defineProperty(window.navigator, 'userAgent', {
//     get: () => spoofedUA,
// });

// Object.defineProperty(window.navigator, 'platform', {
//     get: () => 'Win32',
// });

// Object.defineProperty(window.navigator, 'userAgentData', {
//     get: () => ({
//         brands: [
//             { brand: 'Chromium', version: '122' },
//             { brand: 'Google Chrome', version: '122' },
//             { brand: 'Not-A.Brand', version: '99' },
//         ],
//         mobile: false,
//         platform: 'Windows',
//         getHighEntropyValues: async (hints: string[]) => {
//             const data: Record<string, string | boolean | object[]> = {
//                 architecture: 'x86',
//                 model: '',
//                 platform: 'Windows',
//                 platformVersion: '10.0.0',
//                 uaFullVersion: '122.0.0.0',
//                 fullVersionList: [
//                     { brand: 'Chromium', version: '122.0.0.0' },
//                     { brand: 'Google Chrome', version: '122.0.0.0' },
//                     { brand: 'Not-A.Brand', version: '99.0.0.0' },
//                 ],
//                 bitness: '64',
//                 wow64: false,
//             };
//             const result: Record<string, any> = {};
//             hints.forEach((key) => {
//                 result[key] = data[key];
//             });
//             return result;
//         },
//     }),
// });

/// spoofing code
// preload.ts
export const platforms = {
    win32: {
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        platform: 'Win32',
        userAgentData: {
            platform: 'Windows',
            platformVersion: '10.0.0',
            architecture: 'x86',
            model: '',
        },
    },
    darwin: {
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3_1) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        platform: 'MacIntel',
        userAgentData: {
            platform: 'macOS',
            platformVersion: '13.3.1',
            architecture: 'x86', // Intel Mac; M1/M2이면 'arm'
            model: 'MacBookPro',
        },
    },
    linux: {
        userAgent:
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        platform: 'Linux x86_64',
        userAgentData: {
            platform: 'Linux',
            platformVersion: '5.15',
            architecture: 'x86_64',
            model: '',
        },
    },
    openbsd: {
        userAgent:
            'Mozilla/5.0 (X11; Unix) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        platform: 'Unix',
        userAgentData: {
            platform: 'Unix',
            platformVersion: '',
            architecture: '',
            model: '',
        },
    },
    freebsd: {
        userAgent:
            'Mozilla/5.0 (X11; Unix) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        platform: 'Unix',
        userAgentData: {
            platform: 'Unix',
            platformVersion: '',
            architecture: '',
            model: '',
        },
    },
};

export function applySpoofing(targetPlatform: keyof typeof platforms) {
    const config = platforms[targetPlatform];

    Object.defineProperty(window.navigator, 'userAgent', {
        get: () => config.userAgent,
    });

    Object.defineProperty(window.navigator, 'platform', {
        get: () => config.platform,
    });

    Object.defineProperty(window.navigator, 'userAgentData', {
        get: () => ({
            brands: [
                { brand: 'Chromium', version: '122' },
                { brand: 'Google Chrome', version: '122' },
                { brand: 'Not-A.Brand', version: '99' },
            ],
            mobile: false,
            platform: config.userAgentData.platform,
            getHighEntropyValues: async (hints: string[]) => {
                const data: Record<string, any> = {
                    architecture: config.userAgentData.architecture,
                    model: config.userAgentData.model,
                    platform: config.userAgentData.platform,
                    platformVersion: config.userAgentData.platformVersion,
                    uaFullVersion: '122.0.0.0',
                    fullVersionList: [
                        { brand: 'Chromium', version: '122.0.0.0' },
                        { brand: 'Google Chrome', version: '122.0.0.0' },
                        { brand: 'Not-A.Brand', version: '99.0.0.0' },
                    ],
                    bitness: '64',
                    wow64: false,
                };
                const result: Record<string, any> = {};
                hints.forEach((key) => {
                    result[key] = data[key];
                });
                return result;
            },
        }),
    });
}
