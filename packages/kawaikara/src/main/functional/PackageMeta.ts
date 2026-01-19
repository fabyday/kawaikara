import { app } from 'electron';
import os from 'os';

type OSType = 'windows' | 'macos' | 'linux' | 'unknown';
type ArchType = 'x64' | 'arm64' | 'ia32' | 'unknown';

interface OSTypeData {
    OSName: 'windows' | 'macos' | 'linux' | 'unknown';
    version: string;
    arch: string;
}

interface ProgramTypeData {
    version: string;
    isPortable: boolean;
}

function _getOSName(): OSType {
    switch (os.platform()) {
        case 'win32':
            return 'windows';
        case 'darwin':
            return 'macos';
        case 'linux':
            return 'linux';
        default:
            return 'unknown';
    }
}

function _getOSArch(): ArchType {
    switch (os.arch()) {
        case 'x64':
            return 'x64';
        case 'arm64':
            return 'arm64';
        case 'ia32':
            return 'ia32';
        default:
            return 'unknown';
    }
}

function _isPortable(): boolean {
    return true;
}

function _getWindowversion(): string {
    const release = os.release();
    const buildNumber = parseInt(release.split('.')[2], 10);

    if (buildNumber >= 22000) {
        return '11';
    }
    if (buildNumber >= 10240) {
        return '10';
    }
    return 'older version';
}

function _releaseInfo(): string {
    if (process.platform === 'win32') {
        return `Windows ${_getWindowversion()} (${os.release()})`;
    }
    return os.release();
}

export function getSystemInfo(): OSTypeData {
    return { OSName: _getOSName(), version: _releaseInfo(), arch: _getOSArch() };
}

export function validateDeploymentMode(): ProgramTypeData {
    if (_isPortable()) {
        return { version: app.getVersion(), isPortable: true };
    }
    return { version: app.getVersion(), isPortable: false };
}
