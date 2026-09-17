/** Selects one release language; untranslated releases fall back to English. */
export function selectLocalizedReleaseNotes(
  value: string | undefined,
  locale: string,
): string {
  const notes = value?.replace(/\r\n?/g, '\n').trim();
  if (!notes) return '';
  const boundaries = Array.from(notes.matchAll(
    /^#{1,2}[\t ]+(English|한국어|日本語|Build metadata)[\t ]*#*[\t ]*$/gim,
  ));
  const languages = boundaries.filter(section =>
    section[1].toLowerCase() !== 'build metadata',
  );
  if (languages.length === 0) return notes;

  const normalized = locale.toLowerCase();
  const preferred = normalized.startsWith('ko') ? '한국어'
    : normalized.startsWith('ja') ? '日本語' : 'english';
  /** Collects complete sections without mistaking patch-note subheadings for boundaries. */
  const collect = (language: string) => boundaries.flatMap((section, index) => {
    if (section[1].toLowerCase() !== language) return [];
    const start = section.index! + section[0].length;
    const end = boundaries[index + 1]?.index ?? notes.length;
    const body = notes.slice(start, end).trim();
    return body ? [body] : [];
  }).join('\n\n');
  // Never fall back to the entire multilingual body, including build metadata.
  return collect(preferred) || collect('english') ||
    languages.map(section => collect(section[1].toLowerCase())).find(Boolean) || '';
}
