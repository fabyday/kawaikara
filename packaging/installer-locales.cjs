const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

/** Compile the shared JSON catalogs into NSIS strings; the installer has no renderer. */
function writeInstallerLocales(projectRoot, resourcesDirectory) {
  const escape = value => value.replace(/\$/g, '$$$$').replace(/"/g, '$\\"').replace(/\r?\n/g, '$\\r$\\n');
  const lines = ['; Generated from locales/*.json; do not edit.'];
  for (const [locale, languageId] of [['en', 1033], ['ko', 1042], ['ja', 1041]]) {
    const { installer } = JSON.parse(readFileSync(path.join(projectRoot, 'locales', `${locale}.json`), 'utf8'));
    for (const [key, value] of Object.entries(installer)) {
      if (!/^[a-zA-Z]+$/.test(key) || typeof value !== 'string') throw new Error('Invalid installer locale entry');
      // Only this build-owned placeholder may interpolate into a native product name.
      lines.push(`LangString kawai_${key} ${languageId} "${escape(value).replace(/\{app\}/g, '${PRODUCT_NAME}')}"`);
    }
  }
  const directory = path.join(resourcesDirectory, 'generated');
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'installer-locales.nsh'), `${lines.join('\n')}\n`, 'utf8');
}

module.exports = { writeInstallerLocales };
