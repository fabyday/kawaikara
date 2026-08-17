# Bundle, Provider, and Plugin

Kawaikara's extension system consists of three main concepts: **Bundle**, **Provider**, and **Plugin**.

## Bundle

A **Bundle** is the distribution and management unit for Providers and Plugins.

There are two types of bundles:

* **ProviderBundle** — contains one or more Providers and may optionally include PluginBundles.
* **PluginBundle** — contains one or more Plugins and can be distributed independently.

```text
Bundle
├── ProviderBundle
│   ├── Provider[]
│   └── PluginBundle[]  // optional
│       └── Plugin[]
│
└── PluginBundle
    └── Plugin[]
```

A ProviderBundle does not have to contain a PluginBundle.

## Provider

A **Provider** defines how Kawaikara integrates and displays a specific website or service.

Provider replaces the previous `SiteDescriptor` concept and may contain site-specific configuration, view behavior, and injection logic.

For example:

```text
YouTubeProvider
├── Site Configuration
├── View
└── Inject

ChzzkProvider
├── Site Configuration
├── View
└── Inject

NetflixProvider
├── Site Configuration
└── View
```

Multiple Providers can be distributed together in a single `ProviderBundle`.

## Plugin

A **Plugin** is an extension component that adds or modifies functionality in Kawaikara.

Plugins may provide general Kawaikara functionality or functionality intended for a specific Provider.

For example:

```text
PluginBundle
├── YouTubeAdBlockPlugin
├── ShortsPlugin
└── ChzzkAdBlockPlugin
```

A `PluginBundle` can be distributed independently or included with a `ProviderBundle`.

## Example

A complete YouTube integration could be distributed as:

```text
YouTubeProviderBundle
│
├── YouTubeProvider
│   ├── Site Configuration
│   ├── View
│   └── Inject
│
└── YouTubePluginBundle
    ├── YouTubeAdBlockPlugin
    └── ShortsPlugin
```

The resulting hierarchy is:

```text
Bundle
├── ProviderBundle
│   ├── Provider
│   └── PluginBundle (optional)
│       └── Plugin
│
└── PluginBundle
    └── Plugin
```
