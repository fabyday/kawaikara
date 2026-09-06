import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import extractZip from 'extract-zip';
import type {
  ApplicationLogRuntimeMetadata,
} from '../../Common/IPC';
import type { ReleaseChannel } from '../../Common/BuildConfig';

/** Defines the Kawai log archive extension. */
export const KAWAI_LOG_ARCHIVE_EXTENSION = '.kawailog';
/** Defines the maximum number of logs in one archive. */
const ARCHIVE_LOG_COUNT_LIMIT = 128;
/** Defines the maximum uncompressed size of one log. */
const ARCHIVE_LOG_SIZE_LIMIT = 16 * 1024 * 1024;
/** Defines the maximum combined uncompressed archive size. */
const ARCHIVE_TOTAL_SIZE_LIMIT = 64 * 1024 * 1024;
/** Defines the maximum metadata document size. */
const ARCHIVE_METADATA_SIZE_LIMIT = 1024 * 1024;
/** Defines the Kawai log archive metadata entry. */
const ARCHIVE_METADATA_ENTRY = 'metadata.json';
/** Defines the Kawai log archive log directory. */
const ARCHIVE_LOG_DIRECTORY = 'logs/';
/** Defines the ZIP UTF-8 file-name flag. */
const ZIP_UTF8_FLAG = 0x0800;
/** Defines the ZIP Deflate compression method. */
const ZIP_DEFLATE_METHOD = 8;
/** Defines the ZIP Store compression method. */
const ZIP_STORE_METHOD = 0;

/** Describes metadata identifying the application that creates an archive. */
export interface KawaiLogArchiveCreator {
  /** The application name value. */
  readonly applicationName: string;
  /** The application version value. */
  readonly version: string;
  /** The release channel value. */
  readonly channel: ReleaseChannel;
  /** The operating system label value. */
  readonly platform: string;
  /** The processor architecture value. */
  readonly arch: string;
  /** The Site API version value. */
  readonly siteApiVersion: number;
  /** The runtime version values. */
  readonly runtime: ApplicationLogRuntimeMetadata;
  /** The readable installation ID value. */
  readonly deviceId: string;
}

/** Describes one source log captured in an archive. */
export interface KawaiLogArchiveSource {
  /** The original file name value. */
  readonly fileName: string;
  /** The immutable log contents value. */
  readonly contents: Buffer;
}

/** Describes one safely validated log read from an archive. */
export interface KawaiLogArchiveLog {
  /** The original file name value. */
  readonly fileName: string;
  /** The validated log contents value. */
  readonly contents: Buffer;
}

/** Describes the safely validated contents of a Kawai log archive. */
export interface KawaiLogArchiveContents {
  /** The archive alias value. */
  readonly alias: string;
  /** The source installation ID value. */
  readonly deviceId: string;
  /** The safely validated log values. */
  readonly logs: readonly KawaiLogArchiveLog[];
}

/** Defines a Kawai log archive validation error code. */
export type KawaiLogArchiveErrorCode =
  | 'invalid-format'
  | 'too-large'
  | 'unsafe-file';

/** Represents a rejected or unsafe Kawai log archive. */
export class KawaiLogArchiveError extends Error {
  /** Creates the error. */
  constructor(
    /** The validation error code value. */
    readonly code: KawaiLogArchiveErrorCode,
  ) {
    super(`Kawai log archive validation failed: ${code}`);
    this.name = 'KawaiLogArchiveError';
  }
}

/** Creates a verified Kawai log ZIP archive at the selected path. */
export async function createKawaiLogArchive(
  destinationPath: string,
  alias: string,
  creator: KawaiLogArchiveCreator,
  sources: readonly KawaiLogArchiveSource[],
): Promise<void> {
  if (sources.length === 0 || sources.length > ARCHIVE_LOG_COUNT_LIMIT) {
    throw new KawaiLogArchiveError('too-large');
  }
  const usedEntryNames = new Set<string>();
  let totalSize = 0;
  const files = sources.map((source) => {
    if (source.contents.byteLength > ARCHIVE_LOG_SIZE_LIMIT) {
      throw new KawaiLogArchiveError('too-large');
    }
    totalSize += source.contents.byteLength;
    if (totalSize > ARCHIVE_TOTAL_SIZE_LIMIT) {
      throw new KawaiLogArchiveError('too-large');
    }
    const archiveName = createUniqueArchiveLogName(
      source.fileName,
      usedEntryNames,
    );
    return {
      /** The archive entry path value. */
      path: `${ARCHIVE_LOG_DIRECTORY}${archiveName}`,
      /** The original file name value. */
      originalName: source.fileName,
      /** The uncompressed byte size value. */
      size: source.contents.byteLength,
      /** The SHA-256 content digest value. */
      sha256: createHash('sha256').update(source.contents).digest('hex'),
      /** The source log contents value. */
      contents: source.contents,
    };
  });
  const metadata = {
    /** The archive format identifier value. */
    format: 'kawaikara-log-archive',
    /** The archive schema version value. */
    schemaVersion: 1,
    /** The archive ID value. */
    archiveId: randomUUID(),
    /** The archive alias value. */
    alias: normalizeArchiveText(alias, 120),
    /** The creation timestamp value. */
    createdAt: new Date().toISOString(),
    /** The readable installation ID value. */
    deviceId: creator.deviceId,
    /** The creating application metadata value. */
    creator,
    /** The archive log manifest values. */
    files: files.map((file) => ({
      /** The archive entry path value. */
      path: file.path,
      /** The original file name value. */
      originalName: file.originalName,
      /** The uncompressed byte size value. */
      size: file.size,
      /** The SHA-256 content digest value. */
      sha256: file.sha256,
    })),
  };
  const metadataContents = Buffer.from(JSON.stringify(metadata, null, 2), 'utf8');
  if (metadataContents.byteLength > ARCHIVE_METADATA_SIZE_LIMIT) {
    throw new KawaiLogArchiveError('too-large');
  }
  await writeZipArchive(destinationPath, [
    {
      /** The ZIP entry path value. */
      name: ARCHIVE_METADATA_ENTRY,
      /** The ZIP entry contents value. */
      contents: metadataContents,
    },
    ...files.map((file) => ({
      /** The ZIP entry path value. */
      name: file.path,
      /** The ZIP entry contents value. */
      contents: file.contents,
    })),
  ]);
}

/** Reads and validates a Kawai log archive without trusting ZIP contents. */
export async function readKawaiLogArchive(
  archivePath: string,
  temporaryRoot: string,
): Promise<KawaiLogArchiveContents> {
  const archiveMetadata = await lstat(archivePath);
  if (!archiveMetadata.isFile() || archiveMetadata.isSymbolicLink()) {
    throw new KawaiLogArchiveError('unsafe-file');
  }
  if (archiveMetadata.size > ARCHIVE_TOTAL_SIZE_LIMIT) {
    throw new KawaiLogArchiveError('too-large');
  }
  await mkdir(temporaryRoot, { recursive: true
  });
  const temporaryDirectory = await mkdtemp(path.join(temporaryRoot, 'kawailog-'));
  try {
    let entryCount = 0;
    let totalUncompressedSize = 0;
    const seenEntryNames = new Set<string>();
    await extractZip(archivePath, {
      dir: temporaryDirectory,
      onEntry: (entry) => {
        validateArchiveEntryName(entry.fileName);
        const entryKey = entry.fileName.toLocaleLowerCase('en-US');
        if (seenEntryNames.has(entryKey)) {
          throw new KawaiLogArchiveError('unsafe-file');
        }
        seenEntryNames.add(entryKey);
        if ((entry.generalPurposeBitFlag & 0x1) !== 0) {
          throw new KawaiLogArchiveError('unsafe-file');
        }
        const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
        if ((unixMode & 0xf000) === 0xa000) {
          throw new KawaiLogArchiveError('unsafe-file');
        }
        if (entry.fileName.endsWith('/')) return;
        entryCount += 1;
        if (entryCount > ARCHIVE_LOG_COUNT_LIMIT + 1) {
          throw new KawaiLogArchiveError('too-large');
        }
        const entryLimit = entry.fileName === ARCHIVE_METADATA_ENTRY
          ? ARCHIVE_METADATA_SIZE_LIMIT
          : ARCHIVE_LOG_SIZE_LIMIT;
        if (entry.uncompressedSize > entryLimit) {
          throw new KawaiLogArchiveError('too-large');
        }
        totalUncompressedSize += entry.uncompressedSize;
        if (totalUncompressedSize > ARCHIVE_TOTAL_SIZE_LIMIT) {
          throw new KawaiLogArchiveError('too-large');
        }
      },
    });
    return await validateExtractedArchive(temporaryDirectory);
  } catch (reason) {
    if (reason instanceof KawaiLogArchiveError) throw reason;
    throw new KawaiLogArchiveError('invalid-format');
  } finally {
    await removeTemporaryArchiveDirectory(temporaryDirectory, temporaryRoot);
  }
}

/** Describes one internal ZIP entry. */
interface ZipEntrySource {
  /** The ZIP entry path value. */
  readonly name: string;
  /** The ZIP entry contents value. */
  readonly contents: Buffer;
}

/** Describes one validated archive manifest file. */
interface ArchiveManifestFile {
  /** The archive entry path value. */
  readonly path: string;
  /** The original file name value. */
  readonly originalName: string;
  /** The expected byte size value. */
  readonly size: number;
  /** The expected SHA-256 content digest value. */
  readonly sha256: string;
}

/** Writes a standards-compliant ZIP using only Store or Deflate entries. */
async function writeZipArchive(
  destinationPath: string,
  sources: readonly ZipEntrySource[],
): Promise<void> {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const modifiedAt = new Date();
  const dosDateTime = toDosDateTime(modifiedAt);
  for (const source of sources) {
    const name = Buffer.from(source.name, 'utf8');
    const deflated = deflateRawSync(source.contents, { level: 6
    });
    const compressed = deflated.byteLength < source.contents.byteLength
      ? deflated
      : source.contents;
    const method = compressed === deflated
      ? ZIP_DEFLATE_METHOD
      : ZIP_STORE_METHOD;
    const checksum = crc32(source.contents);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosDateTime.time, 10);
    localHeader.writeUInt16LE(dosDateTime.date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.byteLength, 18);
    localHeader.writeUInt32LE(source.contents.byteLength, 22);
    localHeader.writeUInt16LE(name.byteLength, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosDateTime.time, 12);
    centralHeader.writeUInt16LE(dosDateTime.date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.byteLength, 20);
    centralHeader.writeUInt32LE(source.contents.byteLength, 24);
    centralHeader.writeUInt16LE(name.byteLength, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((0o100600 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.byteLength + name.byteLength + compressed.byteLength;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(sources.length, 8);
  endRecord.writeUInt16LE(sources.length, 10);
  endRecord.writeUInt32LE(centralDirectory.byteLength, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);
  await writeFile(
    destinationPath,
    Buffer.concat([...localParts, centralDirectory, endRecord]),
    { mode: 0o600
    },
  );
}

/** Validates one ZIP entry against the archive allowlist. */
function validateArchiveEntryName(fileName: string): void {
  if (
    fileName.includes('\\') ||
    fileName.includes('\0') ||
    fileName.startsWith('/') ||
    path.posix.normalize(fileName) !== fileName
  ) {
    throw new KawaiLogArchiveError('unsafe-file');
  }
  if (fileName === ARCHIVE_METADATA_ENTRY || fileName === ARCHIVE_LOG_DIRECTORY) {
    return;
  }
  if (/^logs\/[^/]+\.log$/i.test(fileName)) return;
  throw new KawaiLogArchiveError('unsafe-file');
}

/** Validates the extracted manifest, entry set, sizes, and hashes. */
async function validateExtractedArchive(
  directory: string,
): Promise<KawaiLogArchiveContents> {
  const rootEntries = await readdir(directory, { withFileTypes: true
  });
  if (
    rootEntries.some((entry) =>
      ![
        ARCHIVE_METADATA_ENTRY,
        ARCHIVE_LOG_DIRECTORY.slice(0, -1),
      ].includes(entry.name))
  ) {
    throw new KawaiLogArchiveError('unsafe-file');
  }
  const metadataPath = path.join(directory, ARCHIVE_METADATA_ENTRY);
  const metadataFile = await lstat(metadataPath);
  if (
    !metadataFile.isFile() ||
    metadataFile.isSymbolicLink() ||
    metadataFile.size > ARCHIVE_METADATA_SIZE_LIMIT
  ) {
    throw new KawaiLogArchiveError('unsafe-file');
  }
  const parsed: unknown = JSON.parse(await readFile(metadataPath, 'utf8'));
  const metadata = requireArchiveMetadata(parsed);
  const logDirectory = path.join(directory, ARCHIVE_LOG_DIRECTORY);
  const logDirectoryMetadata = await lstat(logDirectory);
  if (!logDirectoryMetadata.isDirectory() || logDirectoryMetadata.isSymbolicLink()) {
    throw new KawaiLogArchiveError('unsafe-file');
  }
  const logEntries = await readdir(logDirectory, { withFileTypes: true
  });
  if (
    logEntries.length !== metadata.files.length ||
    logEntries.some((entry) => !entry.isFile() || entry.isSymbolicLink())
  ) {
    throw new KawaiLogArchiveError('unsafe-file');
  }
  const manifestNames = new Set(metadata.files.map((file) => path.posix.basename(file.path)));
  if (
    manifestNames.size !== metadata.files.length ||
    logEntries.some((entry) => !manifestNames.has(entry.name))
  ) {
    throw new KawaiLogArchiveError('invalid-format');
  }
  const logs: KawaiLogArchiveLog[] = [];
  for (const file of metadata.files) {
    const filePath = path.join(logDirectory, path.posix.basename(file.path));
    const fileMetadata = await lstat(filePath);
    if (
      !fileMetadata.isFile() ||
      fileMetadata.isSymbolicLink() ||
      fileMetadata.size !== file.size ||
      fileMetadata.size > ARCHIVE_LOG_SIZE_LIMIT
    ) {
      throw new KawaiLogArchiveError('unsafe-file');
    }
    const contents = await readFile(filePath);
    const digest = createHash('sha256').update(contents).digest('hex');
    if (digest !== file.sha256) {
      throw new KawaiLogArchiveError('invalid-format');
    }
    logs.push({
      /** The original file name value. */
      fileName: file.originalName,
      /** The safely validated contents value. */
      contents,
    });
  }
  return {
    /** The archive alias value. */
    alias: metadata.alias,
    /** The source installation ID value. */
    deviceId: metadata.deviceId,
    /** The safely validated log values. */
    logs,
  };
}

/** Requires the bounded archive metadata schema. */
function requireArchiveMetadata(value: unknown): {
  /** The archive alias value. */
  readonly alias: string;
  /** The readable installation ID value. */
  readonly deviceId: string;
  /** The validated manifest file values. */
  readonly files: readonly ArchiveManifestFile[];
} {
  if (
    !isRecord(value) ||
    value.format !== 'kawaikara-log-archive' ||
    value.schemaVersion !== 1 ||
    !isBoundedString(value.archiveId, 80) ||
    !isBoundedString(value.alias, 120) ||
    typeof value.createdAt !== 'string' ||
    !isBoundedString(value.createdAt, 80) ||
    typeof value.deviceId !== 'string' ||
    !/^KAWA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value.deviceId) ||
    !isRecord(value.creator) ||
    !isBoundedString(value.creator.applicationName, 120) ||
    !isBoundedString(value.creator.version, 120) ||
    !isReleaseChannel(value.creator.channel) ||
    !isBoundedString(value.creator.platform, 160) ||
    !isBoundedString(value.creator.arch, 40) ||
    typeof value.creator.siteApiVersion !== 'number' ||
    !Number.isFinite(value.creator.siteApiVersion) ||
    value.creator.deviceId !== value.deviceId ||
    !isRecord(value.creator.runtime) ||
    !isBoundedString(value.creator.runtime.electron, 80) ||
    !isBoundedString(value.creator.runtime.chrome, 80) ||
    !isBoundedString(value.creator.runtime.node, 80) ||
    !isBoundedString(value.creator.runtime.v8, 80) ||
    !Array.isArray(value.files) ||
    value.files.length === 0 ||
    value.files.length > ARCHIVE_LOG_COUNT_LIMIT
  ) {
    throw new KawaiLogArchiveError('invalid-format');
  }
  const files = value.files.filter(isArchiveManifestFile);
  if (files.length !== value.files.length) {
    throw new KawaiLogArchiveError('invalid-format');
  }
  return {
    /** The archive alias value. */
    alias: value.alias,
    /** The readable installation ID value. */
    deviceId: value.deviceId,
    /** The validated manifest file values. */
    files,
  };
}

/** Determines whether a value is one safe archive manifest file. */
function isArchiveManifestFile(value: unknown): value is ArchiveManifestFile {
  return isRecord(value) &&
    typeof value.path === 'string' &&
    /^logs\/[^/]+\.log$/i.test(value.path) &&
    isBoundedString(value.originalName, 255) &&
    value.originalName.toLowerCase().endsWith('.log') &&
    typeof value.size === 'number' &&
    Number.isSafeInteger(value.size) &&
    value.size >= 0 &&
    value.size <= ARCHIVE_LOG_SIZE_LIMIT &&
    typeof value.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(value.sha256);
}

/** Creates one collision-free and portable archive log name. */
function createUniqueArchiveLogName(
  originalName: string,
  usedNames: Set<string>,
): string {
  const originalStem = path.basename(originalName).replace(/\.log$/i, '');
  const safeStem = originalStem
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 96) || 'log';
  for (let index = 0; index < 10_000; index += 1) {
    const suffix = index === 0 ? '' : `-${String(index)}`;
    const candidate = `${safeStem}${suffix}.log`;
    const key = candidate.toLocaleLowerCase('en-US');
    if (usedNames.has(key)) continue;
    usedNames.add(key);
    return candidate;
  }
  throw new KawaiLogArchiveError('too-large');
}

/** Converts a timestamp to the DOS date and time stored in ZIP headers. */
function toDosDateTime(value: Date): {
  /** The DOS date value. */
  readonly date: number;
  /** The DOS time value. */
  readonly time: number;
} {
  const year = Math.max(1980, value.getFullYear());
  return {
    /** The DOS date value. */
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
    /** The DOS time value. */
    time: (value.getHours() << 11) |
      (value.getMinutes() << 5) |
      Math.floor(value.getSeconds() / 2),
  };
}

/** Calculates the unsigned CRC-32 checksum required by ZIP entries. */
function crc32(value: Buffer): number {
  let checksum = 0xffffffff;
  for (const byte of value) {
    checksum = CRC32_TABLE[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

/** Creates the CRC-32 lookup table once for archive writes. */
const CRC32_TABLE = new Uint32Array(256).map((_value, index) => {
  let checksum = index;
  for (let bit = 0; bit < 8; bit += 1) {
    checksum = (checksum & 1) !== 0
      ? 0xedb88320 ^ (checksum >>> 1)
      : checksum >>> 1;
  }
  return checksum >>> 0;
});

/** Removes only the exact temporary directory created for this archive. */
async function removeTemporaryArchiveDirectory(
  directory: string,
  temporaryRoot: string,
): Promise<void> {
  const resolvedDirectory = path.resolve(directory);
  const resolvedRoot = path.resolve(temporaryRoot);
  if (
    path.dirname(resolvedDirectory) !== resolvedRoot ||
    !path.basename(resolvedDirectory).startsWith('kawailog-')
  ) {
    throw new KawaiLogArchiveError('unsafe-file');
  }
  await rm(resolvedDirectory, { force: true, recursive: true
  });
}

/** Normalizes bounded user-visible archive text. */
function normalizeArchiveText(value: string, maximumLength: number): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maximumLength);
}

/** Determines whether a value is a plain record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Determines whether a value is a bounded string. */
function isBoundedString(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string' && value.length <= maximumLength;
}

/** Determines whether a value is a supported release channel. */
function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return value === 'stable' || value === 'staging' || value === 'nightly';
}
