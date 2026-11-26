# Breedhaven Dating Sim

An adult dating sim in which every conversation is written live by an LLM. You play one of the rare fertile men at
Breedhaven University, a modern magitech city university where women outnumber men seven to one, through a year of
classes, jobs, dates, parties and festivals. The scenes are written by the model you point it at; everything around
them is ordinary game logic: the calendar, your money and stats, courses and grades, relationships and what each woman
will and won't do, pregnancy and children, a house to build, and a dungeon under the campus.

For adults only (18+). It asks once, before anything is shown.

## What's in it

- **Twenty-one love interests**, each with her own personality, voice, schedule, wardrobe, story beats and secrets.
  Scenes with her are written by the LLM from a prompt the game builds, and what she says is checked against the
  game's rules before anything changes.
- **A year at university**: enroll in courses, sit midterms and finals, take a job, join societies, go to the
  Societies Fair, the Lantern Festival, a masquerade, a hot-spring trip.
- **Relationships and family**: arrangements from casual to exclusive or a throuple, birth control the women choose
  to stop, pregnancy, births, and a house of your own to fill with them and your children.
- **The Undercroft**: a turn-based dungeon beneath the University, fought with a party of the women you know.
- **An editor** for characters, locations, jobs, societies, groups and looks, with art drawn on your own ComfyUI.
  What you make is kept as an add-on, apart from the game's own content.
- **Voices and sound**: recorded tours, cutscenes, story beats, reactions and catch phrases, ambience for every
  place, weather and music.

## Getting started

You need [Node.js](https://nodejs.org) 22 or newer, and an LLM to write the scenes: any OpenAI-compatible endpoint
(OpenRouter, a hosted provider, or a model running on your own machine).

```sh
npm install
npm run dev
```

Then, in the app:

1. Confirm you are 18 or over.
2. Open **Settings → LLMs**, select or create a named connection, enter its base URL, API key and model, and
   **Save**. Assign it to **Main LLM**. **NSFW LLM** is optional: it handles NSFW scenes and refusal fallback.
3. Start a **New Game**: choose your name and skin tone, and the year begins with orientation.

Optional, for making content rather than playing it:

- **ComfyUI** for drawing art from the editor: set the server address in Settings, or in the editor's ComfyUI tab.
- **ElevenLabs** for recording voices and sound: put `ELEVENLABS_API_KEY=...` in a `.env` file at the project root.
  Only the scripts below use it; the game plays what is already recorded.

Your saves, settings and add-ons are kept in the app's user-data folder (`%APPDATA%\breedhaven-dating-sim\` on
Windows): `saves\` holds `auto.json` and `slot1.json` to `slot40.json`, and `addons\` holds whatever you made in the
editor.

## Commands

### Running, testing, building

| Command | What it does |
|---|---|
| `npm run dev` | Run the app with hot reload. Run from source, the editor edits the game's own content (set `BREEDHAVEN_ADDONS=1` to play it as a player would, add-ons and all). |
| `npm run dev:isolated` | Run with separate settings, saves, add-ons, and browser storage in the Git-ignored `.dev-data/user-data/` folder. Uses player add-on mode. |
| `npm start` | Run the last build |
| `npm run build` | Build main, preload and renderer into `out/` |
| `npm run typecheck` | Type-check everything, tests and scripts included |
| `npm test` | Run the unit tests (`npx vitest run <file>` for one file) |
| `npm run build:win` | Package for Windows, unpacked into `dist/win-unpacked/` (run the `.exe` there) |
| `npm run build:win:installer` | Package a Windows installer instead |
| `npm run build:mac` | Package a macOS `.dmg` (run on a Mac) |
| `npm run build:linux` | Package a Linux AppImage and `.tar.gz` |
| `npm run build:unpack` | Package an unpacked app, without an installer |

To sign and notarize the macOS build, copy `electron-builder.env.example` to `electron-builder.env` and fill in the
Apple credentials. Without that file the build is left unsigned.

For isolated development, use `npm run dev:isolated`. It starts with empty data unless you copy a backup into
`.dev-data/user-data/` while the game is closed. `BREEDHAVEN_USER_DATA_DIR` can select another absolute directory
for a source run; it must be separate from the live user-data directory, including its parents and children.
The override also selects player add-on mode and is ignored by packaged builds. Standalone save and media scripts
do not use this override; they retain their existing paths.

Connection settings use version 3. The first launch converts older LLM settings and preserves the original in a
unique `settings.json.pre-v3-*.bak` beside the settings file. Existing connections, values, and credentials are retained;
generation starts in Legacy with Writer and Manager unassigned. Keep full user-data backups, including `Local State`,
for encrypted-key recovery. Use `npm run dev:isolated` for feature testing with data separate from older builds.
Keep private data and detailed verification inventories in the ignored local area. Before committing, review
[commit privacy](docs/PRIVACY.md), including your Git author identity.
**Test** checks the edited connection without saving it and sends a small completion that may incur provider charges.
Connections can be renamed, duplicated without keys, and deleted after reassignment. Profile edits and global
preferences have separate Save/Cancel controls. Role selections persist immediately; they are disabled during scene
generation. Switching the profile being edited does not change the role assignments.
In **Settings → LLMs**, assign configured connections to **Writer LLM** and **Manager LLM**, then select **Dual-call**
under **Generation mode**. Connection names are yours to choose; the two roles may share a connection. The mode
applies to new scenes. A saved scene keeps its mode; older scenes resume in Legacy.

During play, open **Menu** (Esc) to switch **Main LLM** in a Legacy scene or **Writer LLM** in a Dual-call scene.
Assignments save immediately and apply to the next request without resetting the scene. Scene/photo generation
and pending writes disable the selector. NSFW retains its scene-writing and refusal-fallback role; Manager uses
its own assigned connection. Dual-call publishes a reply after both calls validate; a failed Manager can be retried
with the same unpublished reply. Validated encounter notes survive saving and undo and support existing summaries.
See [P2.5 implementation](docs/F002_P25_TRACKING_REPORT.md) and [P2.6 acceptance](docs/F002_ACCEPTANCE_REPORT.md)
for the local/mock and isolated packaged checks. Real-provider quality/performance and final owner acceptance remain open.

### Previews

Each opens the app in dev on one screen alone, for checking it without playing up to it.

| Command | What it shows |
|---|---|
| `npm run preview:loading` | The loading screen (`-- <id or first name>` for one woman; random, and a click shows another, when none is named) |
| `npm run preview:lantern` | The Lantern Festival's lantern release (`-- <id>`, or `-- <id>,<id>` for two) |
| `npm run preview:trip` | The Saltmere trip's moments, all in turn (`-- <moment>` or `-- <moment>:<id>,<id>`) |

### Content and media scripts

Run with `npx jiti scripts/<name>.ts`, or the `npm run` shortcut where there is one. Anything after `--` is passed on.

| Script | What it does |
|---|---|
| `build-catalogue.ts` | Lays out the term again (who is in which course, and when) after a character is added or changes what she studies or teaches. `--dry` to preview. |
| `prompt-size.ts` | The size of each character's opening scene prompt; `<id> --print` prints it, `--class <courseId>` a lecture's opening. |
| `make-test-save.ts` | Writes a late-game save to a slot (8 by default; `--force` to overwrite). Variants: `--midterm`, `--below`, `--booking`, `--break`, `--masquerade`, `--frost`, `--house` (two mothers and children at home) and `--epilogue` (the year over: loading it opens the epilogue). |
| `generate-icons.ts` (`npm run icons`) | Paints the emblems for jobs, places, societies, stalls, weather and Undercroft stops on ComfyUI. `-- <group or id>`, `--overwrite`, `--dry`. |
| `generate-items.ts` (`npm run items`) | Draws every item's picture on ComfyUI. `-- <ids>`, `--overwrite`, `--dry`. |
| `generate-below.ts` (`npm run below`) | Draws the Undercroft on ComfyUI: depths, enemies and relics. `--depths`, `--enemies`, `--relics`, `--overwrite`, `--dry`. |
| `generate-walks.ts` (`npm run walks`) | Draws each love interest's walking profile for the loading screen. `-- <ids>`, `--overwrite`, `--dry`. |
| `generate-clips.ts` (`npm run clips`) | Animates sex-act pictures into clips on ComfyUI, in a batch. Long-running. |
| `generate-births.ts` (`npm run births`) | Draws each woman's birth pictures, one per tone her child can have. `--tone` for only some. Long-running. |
| `generate-voice.ts` | Designs a love interest's voice on ElevenLabs and records her reactions and catch phrases in it: `<id> --design` for three previews, `<id> --pick <n>` to keep one, then `<id>` to record (`--overwrite` to redo). |
| `voice-lines.ts` | Records the lines written ahead (tours, orientation, the Societies Fair, first lines, the house, every story beat) in their speakers' voices. `--dry` to see what is missing, `--list <speaker>`, `--redo <keys>`. Run it after changing a line. |
| `generate-cues.ts` | The interface's sound cues on ElevenLabs as one set: takes into `out/cue-takes/` to listen to, and `--use cue=take` to put one in. |
| `generate-ambience.ts` | A place's 30-second ambience loop on ElevenLabs. `<ids>`, `--overwrite`. The prompts are in the script. |

## Project layout

```
content/default/   The game's content as JSON: characters, curriculum, locations, events, story beats, sounds
src/shared/model/  zod schemas: the shape of the content and of a save
src/shared/game/   The game's rules, as pure functions, with their tests
src/shared/i18n/   Every string the code writes, and the message format
src/main/          Electron main: loading content, saves, LLM calls, ComfyUI
src/renderer/src/  The React interface
scripts/           The scripts above
docs/              How the game works, system by system
```

## How the game works

Every system, from the calendar and the LLM prompt to pregnancy, the house, the Undercroft and the sound, is described
in **[docs/SYSTEMS.md](docs/SYSTEMS.md)**: what it does, the content that tunes it and the code that runs it.

## License

Copyright (C) 2026 Potatoman760.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full terms.
