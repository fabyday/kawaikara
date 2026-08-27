# Documentation Languages

English files in `docs/Developer` are the canonical App contributor
documentation. Translations mirror the same relative path below
`i18n/<locale>`:

```text
docs/Developer/1.BranchesAndChannels.md
docs/Developer/i18n/ko/1.BranchesAndChannels.md
docs/Developer/i18n/ja/1.BranchesAndChannels.md
```

Supported locale directories are `ko` and `ja`; English uses the canonical file. A missing translated file falls back to the canonical English document. Keep code identifiers, branch names, version strings, file paths, and API symbol names unchanged in translations.

When the canonical structure changes, update the translated heading order and links in the same change whenever possible. A translation may lag behind content changes, but it must not claim a different implementation or release status.

This tree owns the authored App guides. Site API and Bundle source references
are generated from the matching packages in the same App checkout. If those
packages gain authored guides, they may keep their locale mirrors beside their
package source; the App documentation workflow still exports every section as
one versioned snapshot.

## Generated API reference

Do not copy TypeDoc output into `i18n/<locale>`. API Markdown is regenerated for
every application tag, so duplicated translated output would become stale as
soon as a symbol or signature changes.

The documentation site translates the generated structure after import:

- symbol-kind badges, section headings, category counts, and navigation labels;
- generated overview and category descriptions;
- repeated fallback descriptions such as module indexes and simple value fields.

Code identifiers, signatures, literal values, source paths, and linked type names
remain unchanged. Source-authored TSDoc prose uses English as its canonical
fallback. Longer API prose translations belong in locale sidecar catalogs keyed
by a stable Symbol Key and guarded by a hash of the canonical prose; generated
Markdown is never edited directly. Add reusable generated wording to the
documentation translation catalog in
`kawaikara.github.io/src/i18n/documentation.ts`; keep longer App design
explanations in the mirrored Markdown files described above.

This split lets one App release action regenerate App, Site API, Bundle, and
Built-in Bundle reference pages without overwriting translations, while the
site can update common Korean and Japanese wording independently of generated
source pages.
