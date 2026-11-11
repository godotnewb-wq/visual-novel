# Sequel concept

A working note on where the next game goes. It records the directions brainstormed after Breedhaven reached a
public release, the choices made, and why. It is meant to grow: add to it, strike through what changes, keep the
reasons.

## Principles carried out of Breedhaven

Breedhaven is a dating sim where an LLM writes the scenes and deterministic systems own everything around them.
It worked, and it taught these:

- **Deterministic around the LLM.** Every place the LLM was let near game state had to be re-checked by code
  anyway. The LLM writes prose, chooses among options the game offers, and proposes changes the game validates.
  Nothing else.
- **The asset matrix is the cost center.** Characters × outfits × seven faces × pregnant form × poses × three
  skin tones. One new love interest is days of generation and hand-fixing. The LLM is free to invent; the art is
  not.
- **Hidden tags are fragile.** `[LEAVES: Tamsin]` broke on full-width colons, transliterated names and model
  drift. Tool calls with schemas are the robust channel for state changes.
- **Content needs ids, speaker ids and tokens from day one.** Retrofitting them for translation cost a whole pass.
- **Pre-recorded voice does not translate**, and anything generated on the player's machine excludes the players
  who cannot run it.

## The two decisions

### Ship complete: no player-side generation

The player needs nothing but the game and an LLM. No image generation, no voice service account, no GPU.
Everything the game shows or plays is made by the developer and shipped; the ComfyUI and voice pipelines stay
developer tools.

- **Layered sprites.** Body once, outfit once, face once, composed from shipped layers. N × M becomes N + M for
  the developer; the player still gets finished art. A pregnant form, where a pack has one, is a body layer, not a
  redraw of every outfit.
- **Voice at development time, per language.** Every pre-written line is recorded for each shipped language and
  the files ship, so a translated game is not silent. LLM-written lines are text. A local text-to-speech option is
  at most an opt-in extra, never needed, never the default.
- **The LLM has three doors.** A cloud key, as now; a local server found on localhost with no setup (Ollama,
  llama.cpp, LM Studio); and a no-LLM mode in which the pre-written content (beats, cutscenes, tours) and every
  deterministic system still play, with scenes reduced to choice menus. The third door is what makes the game
  installable by anyone.
- **Accessibility in the ordinary sense too.** Text size, high contrast, reduced motion, remappable keys, screen
  reader labels, a subtitle for every sound. The browser gives most of this for free.

### Web technology, on Electron

The interface is text: long wrapping prose, emphasis, CJK, input methods, fonts, several languages. A browser is
the best text engine there is, and the shipped WebP and MP4 play natively. The game logic (21k lines of pure
TypeScript with 11k lines of tests), the editor, the translation overlay and the pipelines carry over whole.

Considered and set aside:

- **Tauri.** The same renderer on a 10 MB shell with less RAM. The 6k lines of Electron main would move to Rust or
  a sidecar, and the system webview is inconsistent across platforms. Worth revisiting only if download size or
  RAM become player complaints.
- **Godot.** A real engine, with console and mobile paths, a native feel and a large modding community. It would
  cost a rewrite of 36k lines of interface and editor, a port of the logic and its tests, and a plugin or sprite
  sheets in place of MP4. Months before the sequel's own features begin. It earns that only if the dungeon becomes
  real-time, or consoles matter.

Whatever the shell, game logic stays a pure, tested library with the interface a thin layer over it, as now. That
is what keeps a later engine move survivable.

## One engine, many packs

`content/default` is nearly a pack already, the editor exists, and add-ons layer over the base. The sequel is the
engine; each setting is a pack. A pack declares:

- the premise: what the player is, what is rare, what the meters are called, what the institutions are;
- the cast, the places, the calendar, the institutions (courses, contracts, duties) and the story beats;
- which protagonists it supports, with a cast for each and shared NPCs;
- which content modules it offers.

The fertility assumptions come out of the core and into a module: Sire, birth control, conception, children, the
Office. Relationship stages, meters and institutions are named per pack. Intimacy art is parameterized by its
participants, not "her with a man".

## Inclusive by construction

- **Protagonist creator:** gender, pronouns, body, look. The art pipeline gets a player avatar layer.
- **Love interests of any gender**, each with an orientation, so some are friend routes for a given player, and
  the game says so honestly.
- **Kinks as opt-in content modules** (pregnancy, D/s, exhibitionism, …). Each adds prompt rules, tools, poses,
  outfits and compatibility flags. The content profile is set at new game; characters without a module's flag do
  not take part in it, and the LLM is told so. Breedhaven's traits (`sex-addict`, `exhibitionist`) generalize
  into this.
- **Intimacy art:** POV first (cheap, nearly gender-neutral, what Breedhaven has), third-person pairs as the
  avatar layer matures, since much of the female audience prefers to see the pair.
- **What the genre's female audience wants and Breedhaven lacks:** fewer, deeper love interests; routes with
  exclusivity choices that cost something; slow-burn pacing the player controls, as a setting rather than an
  accident of meters; the love interest's inner life on show between scenes.

## Consequence without breeding

In Breedhaven, intimacy mattered because of pregnancy, children, the house and the Office. A kink-agnostic game
needs other things to make intimacy and choice matter. Four, all of them chosen:

1. **Commitment as a system.** Stages are decisions: seeing, committed, bonded, each asked and answered.
   Exclusivity asked, given or refused; polyamory needs the others' consent, a conversation the LLM runs and the
   game resolves by trust and traits. One who wants more and is not given it drifts; one promised exclusivity and
   betrayed leaves. Cohabitation: who shares the player's room.
2. **A social graph.** Love interests know each other and have meters with each other. An overnight tick (a cheap
   model, schema-validated) produces events: two grow close, a falling-out, gossip about the player reaches
   someone. Reputation is a meter the player feels in who will deal with them, and who will date them.
3. **Their own arcs.** Four to six beats per love interest tied to a goal of their own (a debt, a lost sibling, a
   curse, a rival's hold) with branches on the player's choices and on others' involvement. Missable. An arc can
   end with them leaving, whatever the romance. The player is part of their life, not its purpose.
4. **Modules.** Everything Breedhaven built for pregnancy stays available as one.

## First pack: the company hall

### The world

A company of adventurers holds a hall in a town built over a ruin. The player joins as a new member, of any gender.

- **The hall** is the house: rooms, upgrades, comfort, who sleeps where. Supper is the daily group scene.
- **The town** is the map: tavern, market, temple, bathhouse, smith, clinic, the rival company's hall.
- **Below** is the Undercroft made central: depths, anchors, relics, echoes, now the reason the company exists.
- **Time:** days in town, expeditions of hours or days, a campaign of chapters in place of a term.
- **Contracts** replace courses: jobs with deadlines and requirements. The charter renewal replaces exams. A rival
  company replaces the Vesperan League.

### The loop

Morning in town (talk, train, shop, run a contract's errand), below with a party of two or three, night in the
hall (supper, who sits with whom, who comes to the player's room). Reputation with the town and standing with the
company gate contracts and depths.

### Companions

Eight to ten, each with: a role below; an orientation; kink compatibility; a quest of their own with its own
beats; standing relationships with the others (a sibling pair, an ex-couple, a rivalry, a mentor); a reason to be
here and a goal that can conflict with the player's or another's. Party composition matters: an ex and a current
partner below together costs footing; a bonded pair fights better.

### Between scenes

Letters or a sending stone in place of the phone. The feed becomes the company's noticeboard and the tavern's
gossip.

### What carries over

Expedition (combat, roles, ultimates, relics, echoes), housing, the calendar, relationships and stages, scene
parsing and looks, the editor, the translation overlay, the voice and sprite pipelines made layered, societies as
town factions.

### Risks

- The dungeon has to be fun enough to carry a campaign; in Breedhaven it was a side system.
- Per-companion LLM calls multiply cost in group scenes, and a director adds a call per chapter.
- Companion games with scripted romances set the bar. The LLM-written scenes are the difference, and they have to
  be visibly better than scripted ones to justify the dependency.

## LLM architecture

- **Director and actor.** A slow call plans a chapter: which arcs advance, which rival moves, what the depth
  throws up, what the pacing needs. Fast calls write scenes inside the plan. The director emits a schema the game
  validates; it never touches state.
- **Tool calls, not tags**, for every state change: leave, outfit, move, propose, and whatever a module adds.
- **Per-character knowledge.** In a group scene each companion's call sees only what they know, so secrets,
  gossip and jealousy are earned rather than narrated.
- **Off-screen life.** The overnight tick that drives the social graph.
- **Structured memory.** Promises, grudges and facts as records the game enforces (a promise becomes an
  obligation with a deadline), beside the editable paragraph per scene.
- **Three doors** to the model, as above.

## Settings considered

For a kink-agnostic game: a **resort season** (staff and guests, a closed world, a season per pack; contemporary,
no lore burden), **first year in the city** (post-graduate life with the phone as hub; broadest appeal, least
distinctive), a **supernatural city** (large fandom draw; non-human bodies cost more art). The company hall won
because it reuses the most and the genre's convention is already inclusive.

For a Breedhaven-premise sequel, had one been wanted: **Yuelan's clan allotment** (the Bureau of Lineages, clan
politics, the lore already written), a **frontier colony** where fertility is survival and children grow up, a
**workplace** (strong structure, but hierarchy plus that premise reads as coercion unless the player is a peer),
and a **royal court**. Set aside with the premise.

## Not recommended

- More love interests on the current pipeline.
- Letting the LLM own state: combat outcomes, money, conception.
- Generation on the player's machine for anything the game needs to run.
- One model writing a whole group scene forever; per-character calls are the next step.
