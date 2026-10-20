// Supplies the same mock behaviors through their new explicit owner slots.
// This is a test adapter only; production callers use concrete owner methods.
exports.asViewerRuntime = (mock) => ({
    windows: mock,
    viewer: mock,
    site: mock,
    video: mock,
    pip: mock,
    input: mock,
    diagnostics: mock,
    lifecycle: mock,
});
