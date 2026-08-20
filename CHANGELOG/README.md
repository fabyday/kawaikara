# Kawaikara release notes

Release notes are stored by base application version:

```text
CHANGELOG/
└── 3.0.0/
    ├── PATCHNOTE.EN.MD
    ├── PATCHNOTE.KR.MD
    └── PATCHNOTE.JA.MD  # optional; English is the app fallback
```

Staging and Nightly versions derived from `3.0.0` both use the files under
`CHANGELOG/3.0.0`. Add a new directory whenever the base version changes.

The development-channel release workflow combines the available languages into
the GitHub Release body. Kawaikara selects the matching language for its
Update Notes view and falls back to English when that language is absent.

The English and Korean files are required for publishing. Keep the first H1
equal to the base version. Lower headings and Markdown lists are supported.
