import { execFile } from 'node:child_process';
import path from 'node:path';
import type { AppUpdater, VerifyUpdateCodeSignature } from 'electron-updater';

/** Describes the Windows updater surface that exposes signature verification. */
export interface WindowsSignatureUpdater {
  /** Verifies a downloaded NSIS installer before it can be executed. */
  verifyUpdateCodeSignature?: VerifyUpdateCodeSignature;
}

/** Describes the logging surface used by Windows update verification. */
export interface WindowsUpdateSignatureLogger {
  /** Records an accepted certificate-continuity fallback. */
  info(message: string, detail?: unknown): void;
  /** Records a fallback inspection failure while retaining the default rejection. */
  warn(message: string, detail?: unknown): void;
}

/** Describes one Authenticode identity returned by PowerShell. */
export interface WindowsAuthenticodeIdentity {
  /** The exact file inspected by PowerShell. */
  readonly path: string;
  /** The Authenticode status name. */
  readonly status: string;
  /** The signer certificate SHA-1 thumbprint. */
  readonly thumbprint: string;
  /** The signer certificate distinguished name. */
  readonly subject: string;
  /** Whether the certificate chain is valid when its self-signed root is pinned. */
  readonly chainValid: boolean;
  /** The remaining chain errors after allowing an unknown certificate authority. */
  readonly chainStatus: readonly string[];
}

/** Describes both sides of a Windows signer-continuity check. */
export interface WindowsSignatureInspection {
  /** The currently installed application executable. */
  readonly current: WindowsAuthenticodeIdentity;
  /** The newly downloaded NSIS installer. */
  readonly update: WindowsAuthenticodeIdentity;
}

/** Reads Authenticode identities for the current executable and downloaded installer. */
export type WindowsSignatureInspector = (
  currentExecutablePath: string,
  updateInstallerPath: string,
) => Promise<WindowsSignatureInspection>;

/** PowerShell script that validates Authenticode and the pinned self-signed chain. */
const SIGNATURE_INSPECTION_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
function Read-KawaikaraSignature([string]$Path) {
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  $chainValid = $false
  $chainStatus = @()
  if ($null -ne $signature.SignerCertificate) {
    $chain = [System.Security.Cryptography.X509Certificates.X509Chain]::new()
    try {
      $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
      $chain.ChainPolicy.VerificationFlags = [System.Security.Cryptography.X509Certificates.X509VerificationFlags]::AllowUnknownCertificateAuthority
      $chainValid = $chain.Build($signature.SignerCertificate)
      $chainStatus = @($chain.ChainStatus | ForEach-Object { $_.Status.ToString() })
    } finally {
      $chain.Dispose()
    }
  }
  [PSCustomObject]@{
    path = $signature.Path
    status = $signature.Status.ToString()
    thumbprint = $signature.SignerCertificate.Thumbprint
    subject = $signature.SignerCertificate.Subject
    chainValid = $chainValid
    chainStatus = $chainStatus
  }
}
[PSCustomObject]@{
  current = Read-KawaikaraSignature $env:KAWAIKARA_CURRENT_EXECUTABLE
  update = Read-KawaikaraSignature $env:KAWAIKARA_UPDATE_INSTALLER
} | ConvertTo-Json -Compress -Depth 5
`;

/** Installs certificate-continuity verification without weakening normal Authenticode checks. */
export function configureWindowsUpdateSignatureVerification(
  updater: AppUpdater,
  currentExecutablePath: string,
  logger: WindowsUpdateSignatureLogger,
): void {
  const windowsUpdater = updater as AppUpdater & WindowsSignatureUpdater;
  const defaultVerifier = windowsUpdater.verifyUpdateCodeSignature;
  if (typeof defaultVerifier !== 'function') return;
  windowsUpdater.verifyUpdateCodeSignature = createWindowsUpdateSignatureVerifier(
    defaultVerifier,
    currentExecutablePath,
    logger,
  );
}

/** Creates a verifier that falls back to exact signer continuity for an untrusted root only. */
export function createWindowsUpdateSignatureVerifier(
  defaultVerifier: VerifyUpdateCodeSignature,
  currentExecutablePath: string,
  logger: WindowsUpdateSignatureLogger,
  inspect: WindowsSignatureInspector = inspectWindowsUpdateSignatures,
): VerifyUpdateCodeSignature {
  return async (publisherNames, updateInstallerPath) => {
    const defaultFailure = await defaultVerifier(publisherNames, updateInstallerPath);
    if (defaultFailure === null) return null;

    try {
      const inspection = await inspect(currentExecutablePath, updateInstallerPath);
      if (isAllowedSelfSignedSignerContinuation(
        inspection,
        currentExecutablePath,
        updateInstallerPath,
        publisherNames,
      )) {
        logger.info('Accepted Windows update signed by the installed application certificate.', {
          subject: inspection.update.subject,
          thumbprint: inspection.update.thumbprint,
        });
        return null;
      }
    } catch (reason) {
      logger.warn('Could not verify Windows update certificate continuity.', reason);
    }

    return defaultFailure;
  };
}

/** Checks a self-signed installer against the exact signer of the installed executable. */
export function isAllowedSelfSignedSignerContinuation(
  inspection: WindowsSignatureInspection,
  currentExecutablePath: string,
  updateInstallerPath: string,
  publisherNames: readonly string[],
): boolean {
  const { current, update } = inspection;
  if (
    normalizeWindowsPath(current.path) !== normalizeWindowsPath(currentExecutablePath) ||
    normalizeWindowsPath(update.path) !== normalizeWindowsPath(updateInstallerPath)
  ) {
    return false;
  }

  const currentThumbprint = normalizeThumbprint(current.thumbprint);
  const updateThumbprint = normalizeThumbprint(update.thumbprint);
  if (!currentThumbprint || currentThumbprint !== updateThumbprint) return false;
  if (normalizeDistinguishedName(current.subject) !== normalizeDistinguishedName(update.subject)) {
    return false;
  }
  if (!matchesPublisher(update.subject, publisherNames)) return false;

  return isUntrustedRootOnly(current) && isUntrustedRootOnly(update);
}

/** Reads Authenticode and chain information through non-shell PowerShell execution. */
async function inspectWindowsUpdateSignatures(
  currentExecutablePath: string,
  updateInstallerPath: string,
): Promise<WindowsSignatureInspection> {
  const stdout = await runPowerShellSignatureInspection(
    currentExecutablePath,
    updateInstallerPath,
  );
  return parseSignatureInspection(stdout);
}

/** Executes the fixed signature script with file paths passed only through the environment. */
function runPowerShellSignatureInspection(
  currentExecutablePath: string,
  updateInstallerPath: string,
): Promise<string> {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    KAWAIKARA_CURRENT_EXECUTABLE: currentExecutablePath,
    KAWAIKARA_UPDATE_INSTALLER: updateInstallerPath,
  };
  // PowerShell 7 prepends incompatible Core module paths when it launches the
  // inbox Windows PowerShell. Let powershell.exe restore its own module path.
  for (const key of Object.keys(environment)) {
    if (key.toUpperCase() === 'PSMODULEPATH') delete environment[key];
  }
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-InputFormat',
        'None',
        '-Command',
        SIGNATURE_INSPECTION_SCRIPT,
      ],
      {
        encoding: 'utf8',
        env: environment,
        maxBuffer: 1024 * 1024,
        timeout: 20_000,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        if (stderr.trim()) {
          reject(new Error(`PowerShell signature inspection failed: ${stderr.trim()}`));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/** Parses and validates the small JSON contract returned by PowerShell. */
function parseSignatureInspection(value: string): WindowsSignatureInspection {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) throw new Error('Invalid Windows signature inspection result.');
  return {
    /** The current application signature value. */
    current: parseAuthenticodeIdentity(parsed.current),
    /** The update installer signature value. */
    update: parseAuthenticodeIdentity(parsed.update),
  };
}

/** Parses one Authenticode identity. */
function parseAuthenticodeIdentity(value: unknown): WindowsAuthenticodeIdentity {
  if (
    !isRecord(value) ||
    typeof value.path !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.thumbprint !== 'string' ||
    typeof value.subject !== 'string' ||
    typeof value.chainValid !== 'boolean' ||
    !Array.isArray(value.chainStatus) ||
    !value.chainStatus.every((status) => typeof status === 'string')
  ) {
    throw new Error('Invalid Windows Authenticode identity.');
  }
  return {
    /** The path value. */
    path: value.path,
    /** The status value. */
    status: value.status,
    /** The thumbprint value. */
    thumbprint: value.thumbprint,
    /** The subject value. */
    subject: value.subject,
    /** The chain valid value. */
    chainValid: value.chainValid,
    /** The chain status value. */
    chainStatus: value.chainStatus,
  };
}

/** Determines whether Authenticode failed only because its exact root is not trusted. */
function isUntrustedRootOnly(identity: WindowsAuthenticodeIdentity): boolean {
  return identity.chainValid &&
    (identity.status === 'UnknownError' || identity.status === 'NotTrusted') &&
    identity.chainStatus.length === 1 &&
    identity.chainStatus[0] === 'UntrustedRoot';
}

/** Determines whether a signer subject satisfies the packaged publisher configuration. */
function matchesPublisher(subject: string, publisherNames: readonly string[]): boolean {
  const normalizedSubject = normalizeDistinguishedName(subject);
  const commonName = /(?:^|,)CN=([^,]+)/i.exec(normalizedSubject)?.[1];
  return publisherNames.some((publisherName) => {
    const normalizedPublisher = normalizeDistinguishedName(publisherName);
    return normalizedPublisher.includes('=')
      ? normalizedPublisher === normalizedSubject
      : normalizedPublisher === commonName;
  });
}

/** Normalizes a Windows certificate thumbprint. */
function normalizeThumbprint(value: string): string | undefined {
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  return /^[A-F0-9]{40}$/.test(normalized) ? normalized : undefined;
}

/** Normalizes a simple distinguished name for stable comparison. */
function normalizeDistinguishedName(value: string): string {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(',')
    .toUpperCase();
}

/** Normalizes an inspected Windows path without resolving through a shell. */
function normalizeWindowsPath(value: string): string {
  return path.win32.normalize(value).toUpperCase();
}

/** Determines whether a value is a plain record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
