import { selectPlatform } from './Runtime';
import * as darwin from './Darwin/DistributionInstaller';
import * as windows from './Windows/DistributionInstaller';
import * as linux from './Linux/DistributionInstaller';

/** Native provenance operations; installation orchestration stays outside Platform. */
const implementation = selectPlatform({
    /** macOS quarantine metadata. */
    darwin,
    /** Windows internet zone provenance. */
    win32: windows,
    /** Linux manual-download policy. */
    linux,
});
/** Records download provenance while retaining the OS's normal security checks. */
export const markDownloadedFile = implementation.markDownloadedFile;
