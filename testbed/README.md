# Kawaikara Testbeds

`testbed` contains small, standalone Electron applications used to isolate a
single streaming service or browser behavior from the main Kawaikara runtime.
Each service owns its own directory, `package.json`, lockfile, dependencies,
profiles, and reset command. Testbed profiles must never reuse Kawaikara user
data.

Available testbeds:

- [`youtube`](./youtube): compares the Electron/browser identity surfaces used
  by YouTube and Google sign-in.

Future service probes should follow the same layout, for example
`testbed/netflix`, and stay independent unless a shared harness becomes
necessary.
