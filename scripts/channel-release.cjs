#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync, appendFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const supportedChannels = new Set(['stable', 'staging', 'nightly']);
const command = process.argv[2] || 'resolve';
const channel = process.argv[3];

if (!supportedChannels.has(channel)) {
  fail('Channel must be stable, staging, or nightly.');
}

if (command === 'resolve') {
  resolveRelease();
} else if (command === 'metadata') {
  writeMetadata(process.argv[4]);
} else if (command === 'notes') {
  writeReleaseNotes(process.argv[4]);
} else {
  fail('Usage: channel-release.cjs <resolve|metadata|notes> <stable|staging|nightly> [path]');
}

function resolveRelease() {
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const packageBaseVersion = String(packageJson.version ?? '').replace(/-.*/, '');
  const baseVersion = process.env.KAWAIKARA_BASE_VERSION || packageBaseVersion;
  if (!/^\d+\.\d+\.\d+$/.test(baseVersion)) {
    fail(`Base version must use x.y.z format. Got: ${baseVersion}`);
  }

  const sourceSha = resolveSourceSha();
  const sourceShortSha = sourceSha.slice(0, 8);
  const runNumber = numericIdentifier(process.env.GITHUB_RUN_NUMBER, '0');
  const runAttempt = numericIdentifier(process.env.GITHUB_RUN_ATTEMPT, '1');
  const date = process.env.KAWAIKARA_RELEASE_DATE || formatKoreanDate(new Date());
  if (!/^\d{8}$/.test(date)) {
    fail(`KAWAIKARA_RELEASE_DATE must use YYYYMMDD format. Got: ${date}`);
  }

  const version = channel === 'stable'
    ? baseVersion
    : [
        baseVersion,
        `${channel}.${date}.${runNumber}.${runAttempt}.g${sourceShortSha}`,
      ].join('-');
  const tag = `v${version}`;
  const values = {
    channel,
    version,
    tag,
    base_version: baseVersion,
    source_sha: sourceSha,
    source_short_sha: sourceShortSha,
    source_branch: process.env.KAWAIKARA_SOURCE_BRANCH || defaultSourceBranch(),
    created_at: new Date().toISOString(),
  };

  writeOutputs(values);
  process.stdout.write(`${JSON.stringify(values, null, 2)}\n`);
}

function writeMetadata(outputPath) {
  if (!outputPath) fail('metadata requires an output path.');
  const version = requireEnvironment('KAWAIKARA_RELEASE_VERSION');
  const tag = process.env.KAWAIKARA_RELEASE_TAG || `v${version}`;
  const sourceCommit = requireEnvironment('KAWAIKARA_SOURCE_SHA');
  const metadata = {
    schemaVersion: 1,
    channel,
    version,
    tag,
    sourceRepository: process.env.GITHUB_REPOSITORY || 'local',
    sourceBranch: process.env.KAWAIKARA_SOURCE_BRANCH || defaultSourceBranch(),
    sourceCommit,
    sourceRunId: process.env.GITHUB_RUN_ID || null,
    sourceRunUrl:
      process.env.GITHUB_SERVER_URL &&
      process.env.GITHUB_REPOSITORY &&
      process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : null,
    createdAt: process.env.KAWAIKARA_CREATED_AT || new Date().toISOString(),
  };
  writeFileSync(path.resolve(outputPath), `${JSON.stringify(metadata, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
}

function writeReleaseNotes(outputPath) {
  if (!outputPath) fail('notes requires an output path.');
  const version = requireEnvironment('KAWAIKARA_RELEASE_VERSION');
  const baseVersion = version.replace(/-.*/, '');
  const changelogDirectory = path.join(root, 'CHANGELOG', baseVersion);
  const languages = [
    { heading: 'English', file: 'PATCHNOTE.EN.MD' },
    { heading: '한국어', file: 'PATCHNOTE.KR.MD' },
    { heading: '日本語', file: 'PATCHNOTE.JA.MD', optional: true },
  ];
  const sections = languages.flatMap(({ heading, file, optional }) => {
    const filePath = path.join(changelogDirectory, file);
    let markdown;
    try {
      markdown = readFileSync(filePath, 'utf8').trim();
    } catch (error) {
      if (optional && error && error.code === 'ENOENT') return [];
      fail(`Missing release notes for ${baseVersion}: ${filePath}`);
    }
    const body = normalizePatchNote(markdown, baseVersion);
    return [`## ${heading}\n\n### Kawaikara ${version}\n\n${body}`];
  });
  const metadata = [
    '## Build metadata',
    '',
    `Channel: ${channel}`,
    `Source repository: ${process.env.GITHUB_REPOSITORY || 'local'}`,
    `Source branch: ${process.env.KAWAIKARA_SOURCE_BRANCH || defaultSourceBranch()}`,
    `Source commit: ${requireEnvironment('KAWAIKARA_SOURCE_SHA')}`,
  ];
  if (
    process.env.GITHUB_SERVER_URL &&
    process.env.GITHUB_REPOSITORY &&
    process.env.GITHUB_RUN_ID
  ) {
    metadata.push(
      `Source run: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    );
  }
  const output = [...sections, metadata.join('\n')].join('\n\n');
  writeFileSync(path.resolve(outputPath), `${output}\n`);
  process.stdout.write(`Wrote release notes from CHANGELOG/${baseVersion}.\n`);
}

function normalizePatchNote(markdown, baseVersion) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  if (lines[0]?.trim().replace(/^#\s+/, '') === baseVersion) lines.shift();
  return lines
    .join('\n')
    .trim()
    // Language sections use H2 in the combined GitHub Release body. Demote
    // patch-note headings so the app can select one complete locale section.
    .replace(/^(#{2,6})\s+/gm, '#$1 ');
}

function resolveSourceSha() {
  const value =
    process.env.KAWAIKARA_SOURCE_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  if (!/^[0-9a-f]{40}$/i.test(value)) {
    fail(`Source SHA must be a full 40-character commit ID. Got: ${value}`);
  }
  return value.toLowerCase();
}

function formatKoreanDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((candidate) => candidate.type === type)?.value;
  return `${part('year')}${part('month')}${part('day')}`;
}

function defaultSourceBranch() {
  return channel === 'stable' ? 'main' : 'dev';
}

function numericIdentifier(value, fallback) {
  const resolved = String(value || fallback);
  if (!/^\d+$/.test(resolved)) fail(`Expected a numeric identifier. Got: ${resolved}`);
  return String(Number(resolved));
}

function writeOutputs(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  for (const [key, value] of Object.entries(values)) {
    appendFileSync(outputPath, `${key}=${value}\n`);
  }
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is required.`);
  return value;
}

function fail(message) {
  throw new Error(message);
}
