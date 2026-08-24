# *KAWAIKARA*

<p align="center">
  <img src="./imgs/kawaikara_banner_title3.png" />
</p>
<p align="center">
<strong>KAWAIKARA</strong> is
<strong>OTT-Viewer</strong> based on 
<strong>Electron</strong>
</p>




<!-- Badges  -->
![Windows Support](https://img.shields.io/badge/Windows-Supported-0078D4?style=flat&logo=windows)
![macOS Support](https://img.shields.io/badge/macOS-Supported-0078D4?style=flat&logo=apple)
[![](https://dcbadge.vercel.app/api/server/JJs974BX45?style=flat)](https://discord.gg/JJs974BX45)



<!-- Download Badges -->
[![GitHub release](https://img.shields.io/github/release/fabyday/kawaikara.svg?logo=github)](https://github.com/fabyday/kawaikara/releases/2.1.2)
[![GitHub downloads](https://img.shields.io/github/downloads/fabyday/kawaikara/latest/total.svg?logo=github)](https://github.com/fabyday/kawaikara/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/fabyday/kawaikara/total.svg?logo=github)](https://github.com/fabyday/kawaikara/releases)


<!-- Build Status Badges -->

![build](https://github.com/fabyday/kawaikara/actions/workflows/publish.yaml/badge.svg)
![build](https://github.com/fabyday/kawaikara/actions/workflows/build-dev-branch.yaml/badge.svg)

<!-- Badge End -->

<!-- Intorudction Start -->
I enjoy streaming on Discord and watching videos with my friends, and Discord's broadcasting works really well for me. However, there are a few limitations. Discord captures a single application window, and many streaming services use DRM.

Watching streaming services directly in a browser can be an alternative, but browsers waste a lot of screen space. I don't want actual fullscreen — I just want the content itself, without the address bar, scrollbars, tabs, and other browser UI.

That's why I decided to build Kawaikara — a super-duper tight & fit viewer for OTT and streaming services.

Over time, Kawaikara has grown beyond a simple OTT viewer. It's becoming a more flexible media platform, with local video playback, Discord-friendly streaming, browser integration, and an extensible Bundle & Plugin system — while keeping the original goal simple: just the content, without the clutter.

<!-- Intorudction End -->
## Features
- **Focused OTT Viewing**
- **Discord-Friendly Streaming**
- **Local Video Playback**
- **Extensible Bundle & Plugin System**
- **Cross-Platform** (Windows / macOS)
- **Browser Integration** — Kawaikara Protocol & Chrome / Firefox Extension
## Release channels

Each channel is installed and updated independently. Its application identity,
updater feed, Chromium session data, Bundles, preferences, and video-library
history are isolated, so Stable, Staging, and Nightly can be installed together.

| Channel | Purpose | Releases |
| --- | --- | --- |
| **Stable** | Recommended production builds with the most conservative update cadence. | [Download Stable](https://github.com/fabyday/kawaikara/releases/latest) |
| **Staging (Beta)** | Manually promoted beta builds for validating changes before Stable. | [Download Staging](https://github.com/Kawaikara/kawaikara-staging/releases/latest) |
| **Nightly** | Automated development snapshots from `dev`; newest features and highest change risk. | [Download Nightly](https://github.com/Kawaikara/kawaikara-nightly/releases/latest) |





### For more information, visit Home Page

[![github-page](https://img.shields.io/badge/kawaikara-webpage-blue?style=for-the-badge&labelColor=gray)](./README.MD)

### See Also 

#### KawaiDownloader

* It's Stand-alone KAWAI Video Downloader
* Simple, Intuitive Usage
* Extendable, Versatile

#### Kawaikara Web Extension [ Chrome | Firefox ]

* Open websties directly in **Kawaikara**
* Easily Share links with your friends


## Bundle & Plugin System

Kawaikara provides an extensible Bundle & Plugin System that allows support for websites and services to be added without modifying Kawaikara itself.

Bundle is a package that adds support for a specific website or service to Kawaikara. A Bundle can contain Providers and Plugins that define how Kawaikara interacts with and extends the service.

Provider defines how Kawaikara recognizes and interacts with a website or service. It provides the core integration required for Kawaikara to support that service.

Plugin extends a Provider with additional features or behaviors. Plugins can modify or enhance the experience without changing the Provider itself.
```
Bundle
├── Provider
│   └── Core service integration
│
└── Plugins
    ├── Additional feature
    ├── UI enhancement
    └── Custom behavior
```
This architecture makes Kawaikara extensible: new services and features can be distributed as Bundles and Plugins independently from the main application.


## MIT License

Copyright (c) 2024 fabyday

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.



