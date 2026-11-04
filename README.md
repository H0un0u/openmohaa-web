# OpenMoHAA Web Port

A separate WebAssembly/browser port based on the upstream OpenMoHAA project. This repository focuses on running the single-player experience in a web browser and contains browser-specific code and build changes. It is not the upstream OpenMoHAA repository, and web-specific changes here are not automatically part of upstream.

> **Current scope: single-player only. Multiplayer is not available in this web port yet.**

The upstream native OpenMoHAA project supports multiplayer; that capability does not apply to this browser build yet.

## Quick start on Windows

1. Install [Node.js](https://nodejs.org/) if it is not already installed.
2. Put your Medal of Honor: Allied Assault game files in the `main/` folder at the repository root. Keep the `.pk3` files and any loose `sound/` files together there. The game files are not included in this repository.
3. Double-click [`Run Web Port.bat`](<Run Web Port.bat>). It starts a local web server and opens the game in your default browser.

The prebuilt WebAssembly client is included, so you do not need to install CMake or Emscripten to run it. If a supplemental sound pack is not already available, the launcher packages loose sound files locally on first run (Python 3 required). Without that pack, the game still starts, but loose sounds are unavailable. Keep the launcher window open while playing; press **Ctrl+C** there to stop the local server.

The browser saves game settings and saves in that browser's local storage. Multiplayer is unavailable in this web port.

## Game data

Original Medal of Honor game assets are not included. Provide game data from a copy you are legally entitled to use for local builds. The local `main/` directory is ignored by Git and must not be committed.

## Upstream and license

- Upstream source: [openmoh/openmohaa](https://github.com/openmoh/openmohaa)
- Upstream documentation: [openmoh.github.io/openmohaa](https://openmoh.github.io/openmohaa)
- Upstream base: snapshot of openmoh/openmohaa at commit [a2f3401](https://github.com/openmoh/openmohaa/commit/a2f340195975f4f042e28a60b62561dd9a0b2700) (April 2026); the web-port changes sit on top of that base
- See [COPYING.txt](COPYING.txt) for the license and [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance.
