# Turning this into a game

> **Where this ended, 2026-09-03.** The prototype this document narrates from section 8d onward,
> `prototypes/solarpunk/play/`, was audited (`docs/CONVERGENCE.md`), merged into the designer as the
> simulation mode (`src/simulation/`, Decision Record 14) and deleted. What survives of the
> directory is the coarse light driver and its comparison against the bake, renamed
> `prototypes/light-harness/` and, on 2026-09-04, moved into `src/sim/` as `gap.test.ts` and
> `testkit.ts`, `prototypes/` is gone. Everything below is the record of how the mode was arrived
> at, and the paths it names are historical

An assessment of porting the agrivoltaic garden designer into a simulation game, plausibly in
Rust, keeping the provenance discipline that makes this project what it is.

Written 2026-08-31. Nothing here has been built. This is a decision document, and its main job is
to be honest about what is easy, what is hard, and what would kill it.

> Not in `render-docs.mjs`'s `PUBLISHED` whitelist, so it stays off the deployed site, like
> `ARCHITECTURE.md`.

---

## 1. The short answer

**The physics is done and portable. The game does not exist and is most of the work.**

The instinct that this codebase is halfway to a game is wrong in an interesting way. What exists
is a *domain model*: a defensible answer to "how much light reaches this bed, how much
electricity comes off that panel, and can this crop live there". Games are built on domain
models, but almost none of the fun lives in one. There is no economy here, no time progression
past a calendar year, no citizens, no scarcity, no failure state, no progression, and only one
plot. Those are the game.

A fair split of the existing 58,347 source lines:

| Layer | Lines | Fate in a game |
|---|---|---|
| `types/` | 2,784 | **Ports.** Mostly a vocabulary, and a better one in Rust |
| `sim/` | 5,575 | **Ports.** Pure numerics, no DOM in the core |
| `data/` | 13,714 | **Ports**, and 7,411 of it is data-as-code that barely needs porting |
| `recommend/` | 6,904 | **Ports.** Ranking, water balance, companion rules, planting |
| `state/` | 5,272 | Rewritten. Zustand and browser persistence |
| `scene/` | 5,282 | Rewritten. three.js and react-three-fiber |
| `ui/` | 14,316 | Rewritten. React |
| `agent/` | 4,500 | Out of scope by request |

So roughly **29,000 lines survive and 25,000 do not**. That looks like a 54% head start. It is
not, because of the number in the next row:

| Also | Lines |
|---|---|
| Tests | **32,902** |
| Docs | 9,960 across 17 files |
| Citations | 188 entries, 253 KB of CSL-JSON |

The tests are the actual asset. They are the only reason anyone should believe the Perez
transposition or the DIRINT decomposition in this repo is right. A rewrite that leaves them behind
is not a port of a validated model, it is a fresh implementation of the same equations with the
validation thrown away. Section 5 is about how to avoid that, and it is the single most important
engineering decision in this document.

---

## 2. What is genuinely portable, measured

The physics core has no browser in it. Checked rather than assumed:

```
src/sim/solar.ts           0 real DOM references
src/sim/transposition.ts   0
src/sim/decomposition.ts   0
src/sim/pv/dc.ts           0
src/sim/pv/chain.ts        0
src/sim/shading.ts         0
src/sim/cpu.ts             0
```

`compliance.ts` appears to reference `window` eleven times, every one is the *growing season
window*, not the browser global. The only genuinely web-bound files in `sim/` are `gpu/webgl2.ts`
(577 lines) and the worker plumbing, and both are one backend behind `backend.ts` with a CPU path
already sitting beside them.

**The citations are the most portable thing in the repository.** They live in
`docs/CITATIONS.csl.json` as standard CSL-JSON, not in a bespoke format: 188 entries across
horticulture (59), solar (47), agrivoltaics (24), TEK (24), climate (13), software (11) and
standards (10). `serde` reads that file on day one with no conversion step. Whatever else
happens, the research corpus transfers intact.

---

## 3. The central tension, stated plainly

**Simulation games are fun because they lie, and this project exists because it does not.**

SimCity's traffic model is not a traffic model. Cities: Skylines' agents pathfind in ways no
transport planner would defend. Oxygen Not Included's thermodynamics are internally consistent and
physically wrong. That is not laziness, legibility requires simplification, and a player who cannot
predict the consequence of an action is not playing, they are watching.

This codebase is built on the opposite commitment. Its doctrine is that the only thing hidden is
detail, and a caveat is never detail. `compliance.ts` will tell you that a figure has no standing
because the regulator mandates its own tool. The water balance names the fraction of rain the
panels intercept before it reaches the bed. That honesty is the product.

Put those together and you get the design problem: **a light bake takes seconds and returns an
answer with five caveats, a game loop has sixteen milliseconds and needs an answer a player can act
on.** Every decision below is downstream of that.

There are three ways out, and only the third is any good.

1. **Keep the fidelity, accept the pace.** A turn-based or seasonal-tick game rather than a
   real-time one. Honest, and narrows the audience to people who already like spreadsheets.
2. **Keep the pace, drop the fidelity.** Approximate everything, cite nothing. This is a normal
   game, and the reason to build it on this repo evaporates.
3. **Split the clock.** Cheap approximations drive the moment-to-moment loop, the real model runs on
   commit, on season boundaries, or when the player asks. The player feels a responsive game and the
   *scored* outcomes come from the defensible model. The bake already takes its quality as options
   (`SimulationOptions`: sky subdivision, sun samples an hour, cell size), and the app carried a
   coarse tier beside `FINAL_OPTIONS` until 2026-09-17, dropping it once the full bake proved fast
   enough for every path. A second options set is all the cheap tier would be.

Take option 3. It is the only one where the provenance survives contact with a game loop, and
half of it exists.

---

## 4. The idea worth building the game around

The best mechanic in this project has already been implemented, for a different reason.

`types/evidence.ts` grades every claim:

```
DataTier            A | B | C
EvidenceGrade       A | B (scoreable)  C (experimental)  D | E (folklore)
CitationVerification  crossref-verified | datacite-verified | url-verified | unverified
```

and `Cited<T>` is a five-variant union: `verbatim`, `derived`, `inferred`, `computed`,
`unsourced`.

**Make the evidence tier mechanically load-bearing rather than decorative.** A mechanic backed by
a crossref-verified A-tier source behaves deterministically. A C-tier experimental one has
variance. A D/E folklore one, and there are 24 TEK citations already carrying that grade, is a
hypothesis the player can *test in play*: it might work here, it might not, and the game does not
know either.

That single move does several things at once:

- provenance stops being a UI panel nobody opens and becomes the thing the player reasons about
- uncertainty becomes a resource to manage rather than a disclaimer to dismiss
- the TEK layer gets treated with the seriousness `docs/05-tek-agroecology.md` argues for, as
  knowledge with a different epistemic basis rather than as flavour text
- and it is honest: the game's confidence in a mechanic is exactly the project's confidence in
  the claim behind it

I am not aware of a game that does this. Kerbal has real orbital mechanics, Terra Nil and Timberborn
are solarpunk-adjacent with invented systems, none of them models *how well the designers know what
they modelled*. That is either an empty niche or a graveyard, and the honest answer is that nobody
knows which.

---

## 5. Rust: what it buys, what it costs

### What Rust genuinely buys here

**The type system this project has been faking.** `Cited<T>` is a tagged union that TypeScript can
only approximate, note `seal()` in `types/cited.ts`, a cast that exists to fake nominal typing. In
Rust it is an `enum` with exhaustive matching, and the compiler enforces what a convention currently
enforces. Same for the units: `Meters`, `Fraction`, `DayOfYear` are branded types today, which is a
comment the compiler mostly believes. Rust newtypes, or `uom`, make them real.

**Parallelism, but not where you would hope.** `rayon` is a real gain for the CPU-side work:
weather decomposition, the recommendation ranking, the design search. It is **not** a gain for
the light bake, and section 5a is the correction.

**ECS fits a city builder.** Bevy's model is a good match for thousands of plants, panels,
barrels and citizens with heterogeneous behaviour.

### What Rust costs, and this is underweighted

**You lose the distribution, but only on one of the two paths, and it took measuring to find
out which.** This project's deploy story is genuinely excellent: static assets on Cloudflare
Workers, opens instantly from a link, works on a phone. The assumption written here first was
that any Rust web build gives that up. **That is true of Bevy and false of wgpu**, by a factor of
twenty-five. Section 5b has the numbers and they change which option in "the move that resolves
it" is the right one.

**You lose the tests, unless you are deliberate.** Though far less than the 32,902 in the table
above suggests, and this is the correction that most changes the estimate. The physics oracle is
`sim/`'s own **2,807 lines**, and they are written against specifications rather than against
this implementation:

- `solar.test.ts` reproduces the NREL/TP-560-34302 rev. Jan 2008 Appendix A.5 worked example to
  better than 0.001 degrees
- `transposition.test.ts` checks Perez at the degenerate tilts where the F1/F2 terms cancel
  analytically, against closed-form values
- `skydome.test.ts` asserts the patch counts fixed by the Decision Record and that each
  subdivision tiles the hemisphere
- **there is not one snapshot test in `sim/`**

Nothing there is pinned to a TypeScript behaviour, so the cases port as *data* and only the
harness syntax changes. The rest of the 32,902 is e2e and UI, which a game would not want.

**The GPU path gets harder, but it is smaller than it looks.** `webgl2.ts` is 578 lines of which
**106 are GLSL**: a 5-line vertex shader and a 101-line fragment shader. That is the entire
non-portable surface of the physics. Everything else in the file is buffer and uniform plumbing,
and everything else in `sim/` is CPU math. `webgpu.ts` is a 27-line availability check, so there
is no existing wgpu work to build on.

### 5a. Rust will not speed up the light bake, measured

The tempting sentence is "port the bake to Rust and stop waiting for it". It is wrong, and the
numbers say so clearly enough to settle it.

**The bake is already on the GPU, and it is not slow.** Timed against the shipped example garden
on ANGLE Metal, through the UI:

| | Quick light check | Full light check |
|---|---|---|
| Example garden, 6 panels | 260 ms | **799 ms** |

`useAutoLight.ts` says in its own comment that "a full bake on every nudge would be minutes of
work nobody asked for". On this hardware it is eight tenths of a second. That justification is
two orders of magnitude out of date, even though the rule it defends is still right for the
reason in the last row of the next table.

**How it scales**, same machine, varying only the array:

| Panels | Quick | Full |
|---|---|---|
| 6 | 260 ms | 799 ms |
| 36 | 297 ms | 795 ms |
| 120 | 808 ms | 1,812 ms |
| 300 | 816 ms | 3,309 ms |
| Example garden on SwiftShader | 4,681 ms | **13,431 ms** |

Two things fall out. The full check is roughly `450 ms + 9.5 ms per panel`, so at garden scale it is
dominated by fixed overhead and at 300 panels by the panels. And the weakest device is **17x**
slower than a real GPU, which is where the two-tier design actually earns its keep, not on the
laptop it was tuned on.

**Why Rust cannot help this.** The hot loop is a GLSL fragment shader, one invocation per ground
cell, looping over every sun direction and inside that over every panel:

```glsl
for (int j = 0; j < uDirCount; j += 1) { ... visibility(p, row0.xyz) ... }
float visibility(vec3 p, vec3 d) {
  for (int i = 0; i < uPanelCount; i += 1) { if (panelBlocks(p, d, i) > 0.5) return 0.0; }
}
```

Rust compiled to wasm runs on the CPU. Moving this off the GPU is a regression of one to two
orders of magnitude, and the SwiftShader row above is very nearly a measurement of that idea:
0.8 s becomes 13.4 s. SwiftShader is a mature SIMD software rasteriser, so hand-written wasm
would not obviously beat it, and wasm SIMD is narrower than native.

**What would actually make it faster, none of which needs Rust.** The kernel above is brute
force: no acceleration structure, no culling, and an early-out that depends on panel ordering.
The backend is called `webgl2-shadowmap` and does not do shadow mapping. Rendering the panels
into a depth buffer once per direction turns `cells x directions x panels` into
`directions x (panels + cells)`, which is where the 9.5 ms per panel goes. Beyond that: cull
panels per direction, coarsen the 2 degree sun binning that produces 2,223 directions, or
finish `gpu/webgpu.ts`, currently a 27-line availability check, as a compute shader.

So the honest ordering is: the algorithm is worth improving, the GPU path is worth finishing, and
the language is not the lever. Rust remains worth doing for the reasons above it, which are about
types, testability and reuse, it should not be sold as a performance fix for the bake.

### The move that resolves it

**Do not rewrite. Extract.**

Make `sim/` and the numeric half of `recommend/` a standalone Rust crate. Compile it to wasm and
have the *existing web app* consume it, in place, behind the `backend.ts` seam that already
exists. Then the game, whenever it happens, links the same crate natively.

The reason this is the right call is not code reuse. It is that it gives you a **differential
test oracle**: run the TypeScript and the Rust implementations over the same inputs and assert
they agree to tolerance. The 2,807 lines of physics tests stop being a sunk cost and become the
specification the port is checked against. You find out the port is correct rather than hoping.

It also fails gracefully. If the game never happens, the web app got a better-typed physics core
and lost nothing. Every other path is all-or-nothing.

**And the pattern for keeping two kernels honest is already in the repository.** `BackendKind` is
`'webgpu-raycast' | 'webgl2-shadowmap' | 'cpu-reference'`, and `webgl2.test.ts:124` runs the GPU
kernel and `createCpuReferenceBackend()` over the same scene and asserts they agree on every
cell, for beam, diffuse and sky view factor. So the *semantics* of the visibility kernel live in
`cpu.ts`, which is 168 lines of pure CPU code that ports to Rust directly, and any number of
shaders are checked against it.

That resolves the 106 lines of GLSL. Two options, and the second is probably right:

1. **One kernel in WGSL through wgpu**, which targets native, WebGL2 and WebGPU from one source.
   Genuinely single-source. This used to carry a warning that the wasm bundle cost was unmeasured
   and had to be obtained before committing. **It has been measured: 129 kB brotli**, against the
   269 kB the three.js chunk already costs. Section 5b. The warning is withdrawn and this is now
   the better of the two options rather than the riskier one.
2. **Two shaders, one specification.** Keep the GLSL for the web and write a WGSL twin for the
   game, and hold both to the Rust CPU reference with the cross-check that already exists. For
   106 lines this is a smaller and more honest trade than it sounds: the single source of truth
   is the reference implementation and the conformance test, not the shader text.

### 5b. What a Rust web build actually weighs, measured 2026-09-01

Four probes, each built for `wasm32-unknown-unknown` at `opt-level = "z"` with LTO, then through
`wasm-opt -Oz`, then brotli, which is what a CDN serves. Compared against this repository's own
`dist` compressed the same way.

| | brotli |
|---|---|
| `agv-sim` as it stands: solar, transposition, decomposition | **27 kB** |
| **wgpu**: instance, adapter, device, shader module, render pipeline, render pass | **129 kB** |
| **Leptos** client-side, rendering real DOM: a heading, a list, three `aria-pressed` buttons, reactive state | **167 kB** |
| **Bevy** minimal 3D: one PBR cube, one directional light, one camera, `webgl2` feature | **3 194 kB** |
| | |
| *the app today, all JS* | *686 kB* |
| *... minus the agent and the citations corpus* | *503 kB* |
| *... `SceneCanvas`, which is three.js plus the whole 5,282-line scene layer* | *269 kB* |
| *... `index`, which is React plus all 14,346 lines of UI, state, data and recommend* | *206 kB* |

Two of those rows overturn what this document assumed.

**wgpu is cheaper than three.js.** 129 kB against 269 kB, and the three.js figure carries the
scene layer with it while the wgpu figure carries nothing but the renderer. So the graphics
dependency is not what makes a Rust web build heavy, and section 5's flat claim that a Rust
build loses the distribution was wrong about the renderer specifically.

**Bevy is 4.7 times the entire current application, to draw one cube.** 28.7 MB raw, 14.6 MB
after `wasm-opt`, 3.2 MB brotli, before any asset, any UI or any game. That is the claim section 5
made from intuition and it holds, emphatically. What it means is narrower than it first looks:
Bevy is a defensible cost for a *game*, where a player expects to wait once, and it is not a
defensible cost for the *designer*, whose best property is that a link opens instantly.

**Leptos is more expensive than React, which is the direction nobody guesses.** Its floor, 167 kB
for a panel with three buttons, is most of what this app's entire UI bundle costs today. Rust does
not tree-shake the way an ES module graph does, and monomorphisation adds rather than removes. A
Rust DOM framework is viable on size, it is not a saving.

#### The decision this actually turns on is DOM versus canvas

Not Rust versus TypeScript. The two Rust UI families differ from each other far more than either
differs from React:

- **Leptos and Dioxus render real DOM.** Everything this project has built on top of the DOM keeps
  working: `e2e/a11y.spec.ts`'s axe sweep, `e2e/contrast.spec.ts`'s audit of every text pair and
  focus indicator in both colour schemes, all 185 e2e tests, biome's `a11y: { "preset": "all" }`,
  text selection, screen readers, and the Sources tab where every citation in the app is a control
  that jumps to its own row.
- **Bevy and egui render a canvas.** None of it survives. Invariant 10, contrast, becomes unenforceable, the
  two accessibility specs have nothing to read, and the 86 aria attributes and 108 list elements
  in `src/ui` become pixels.

The designer's entire claim is that it is both easy and honest. That claim lives in the DOM. A
canvas-rendered designer would keep every number and lose what the numbers are for.

**So: the game may be a canvas and the designer may not.** That is not a compromise between two
codebases, it is the correct answer for each of them, and it is why "one program" is the wrong
target even though "one model" is the right one.

#### What this means for the fork worry

The concern that prompted these measurements was maintaining the designer and a game equally
rather than watching one rot. Worth separating two things that sound alike:

- **A fork in the shells is not a fork.** A design tool and a game should have different
  interaction models, and merging them into one shell does not halve the maintenance, it moves it
  somewhere worse.
- **A fork in the model is the real risk**, and section 5c already names where it happens quietly:
  `data/catalog/rows.ts` is 3,715 lines of hand-maintained TypeScript with a generated companion.
  Until the catalogue is a neutral format both languages read, "one engine" is not true no matter
  how the shells are arranged.

There is also a third option this document has never stated, and it deserves to be on the page
because it is the genuine minimum-fork answer: **build the game in TypeScript on the existing
model layers.** Zero porting, zero divergence, both hosted, shares 100% of the science on day one.
What it costs is the game's performance ceiling and the type-system argument at the top of section
5. It is not the recommendation, but a plan that has not considered it has not earned the Rust
one.

Finally, a risk no repository layout addresses: a game is plausibly an order of magnitude more
work than what remains on the designer, and attention follows the fun. That is a scheduling
problem and it is the most likely way one of the two rots.

### 5c. The condition, and it is the whole justification

**Single source of truth is achieved only if the web app actually migrates.**

Extract the crate for the game, leave the TypeScript running in the web app, and there are now two
implementations of the same physics with nothing forcing them to agree. That is strictly worse than
today, when there is one. Stage 1 in section 8 is therefore not a warm-up for the game, it is the
thing that makes the whole argument true, a plan that quietly defers it has inverted its own
rationale.

Two things are also less shared than "one engine" suggests, and both are worth knowing before
the word gets used in a plan:

- **The data is not in a neutral format.** `data/catalog/rows.ts` is 3,715 lines of
  hand-maintained TypeScript, and `native-ranges.generated.ts` is generated from it by
  `scripts/fetch-plant-traits.mjs`. Real single-sourcing means moving the catalogue to JSON or
  TOML that both languages read, or making the generator emit both. Mechanical, and easy to
  leave undone until it has already forked.
- **The granularity differs.** This engine bakes a 0.12 m raster for *one* plot. A city-scale game
  wants coarse per-tile figures for thousands of them. The functions are shared, the driver and the
  resolution are not. "Same engine" honestly means one crate with more than one entry point, not the
  game calling `runSimulation`.

---

## 6. The proposed mechanics, assessed one at a time

### Rain barrels and catchment: already half-built

`types/garden.ts` already carries:

```ts
interface WaterHarvestingElement {
  readonly scale: WaterHarvestingScale
  readonly footprint: Polygon2D
  readonly tiedToArrayDripLine: boolean
}
```

and `Bed.irrigation.harvestsPanelRunoff`, and `recommend/water.ts` already reports the fraction
of annual rain the panels intercept and the fraction returned as captured runoff, with citations.
Sizing rules for cisterns and first-flush diverters are well documented in the rainwater
harvesting literature. **This is an extension of a modelled system, not a new one.** Lowest risk
mechanic on the list.

### Atmospheric water generation: the most interesting one, and it is a trap

The player-facing pitch is "surplus electricity, dry spell, pull water out of the air". Assessed
properly, three things are true and the third is the good one.

**The input data already exists.** `data/tmy.ts` fetches and stores hourly `dew_point_2m` and
`surface_pressure` alongside temperature, and `types/weather.ts` carries `dewPointC` as a
`Float32Array`. Absolute humidity, and therefore condensation yield, is computable from what the
app already downloads. No new upstream, no new proxy route.

**The physics is unforgiving.** Condensation requires cooling air below its dew point, so yield
collapses as humidity falls, exactly in the climates and seasons where irrigation is most needed.
Real condensation-type units land in the region of hundreds of watt-hours to over a kilowatt-hour
per litre in moderate conditions, and worse in dry air. A garden's irrigation demand is measured
in hundreds of litres.

**So a provenance-honest model will show that AWG is usually a bad idea, and that is the mechanic.**
The interesting version of this feature is not a free upgrade, it is a device the game lets you
build, models truthfully, and thereby teaches you to distrust. Compare it against a cistern that
stores winter rain for summer and it will lose almost everywhere, which is a real finding about real
technology and precisely the kind of thing this project exists to say. A game where the shiny
high-tech option is usually wrong and the boring one usually wins is more solarpunk, not less.

This is the mechanic to build first, because it is the one that proves the whole thesis: that
citation-backed modelling produces *better game design*, not just more defensible numbers.

### Surplus-electricity scheduling generally

Once there is a load to schedule, the existing PV chain becomes a game system rather than a
readout. Pumps, AWG, cold storage for harvest, battery or thermal buffering. `sim/pv/chain.ts`
already produces the generation profile. This is the natural bridge between the solar half and
the garden half, and today those two halves barely interact outside the shading model.

### What is missing and has no head start

Economy, money, costs, labour, citizens, seasons past year one, progression, failure states,
multiple sites. All of it new. Budget accordingly: this is the bulk of a game and none of it is
in the repo.

---

## 7. What would kill this

Ranked by how likely they are to actually be what goes wrong.

1. **Starting it before the current branch lands.** `agent-conversational` merged on 2026-08-31,
   so that instance is retired and the risk moved rather than went away: `rust-sim-core` is now
   16 commits deep with no PR, and CI has never run on it. A Rust game is a much more attractive
   thing to think about than finishing that. Two unfinished large efforts is the failure mode
   here, and it is still the most probable one on this list.
2. **Rewriting the tests by hand.** If the port does not use differential testing against the
   existing suite, it will either take far longer than planned or ship unvalidated. Section 5.
3. **Building the simulator and calling it a game.** The pleasant work is porting physics. The
   work that decides whether anyone plays it is economy, progression and failure, and none of it
   is in this repository. It is entirely possible to spend six months and have a beautiful,
   well-cited thing nobody wants to play.
4. **Provenance as a museum.** If the citations end up in a codex nobody opens, the whole premise
   was decorative and a normal game engine would have been the right choice. Section 4 is the
   defence against this and it needs to be in the design from the first prototype, not retrofitted.
5. **The fidelity/pace tension going unresolved.** Picking neither option in section 3 gives a
   game that is both slow and approximate.

---

## 8. If it goes ahead: a staged order

Each stage is useful on its own and can be stopped after without waste. That property is the
point.

**Stage 0. Land what exists.** Resolve the agent branch, merged or abandoned. Do not start this
with that open.

**Stage 1. Extract the physics to a Rust crate, wasm-compiled, consumed by the existing app.**
Behind the `backend.ts` seam. Differential-tested against the TypeScript. Deliverable: the
current app with a validated Rust core. Useful even if everything stops here.

> **Done on `rust-sim-core`, and further than the heading asks.** `crates/agv-sim` is not a parallel
> implementation behind a seam any more: it is the ONLY implementation. 2,679 lines of TypeScript
> physics were deleted on 2026-09-02, so `bun run test` and `bun run build` both need a Rust
> toolchain and a build with the core switched off refuses every number rather than degrading. Four
> modules stay dual on purpose. At the port: 43 Rust tests, 1,724 TypeScript, 222 functional e2e,
> `docs/CI.md` carries the current numbers. See section 8a.

**Stage 2. One mechanic, end to end, in the existing web app.** Atmospheric water generation,
because section 6 argues it is the thesis in miniature. Cite it, model it, let it lose to a rain
barrel. Deliverable: evidence that citation-backed mechanics are interesting rather than worthy.

**Stage 3. A prototype with no graphics.** Economy, seasons, failure. Text or the crudest
possible 2D. This is where you find out whether there is a game, and it is much cheaper to find
out here than after building a renderer.

> **Built, 2026-09-02.** `prototypes/solarpunk/loop.ts` was the affordable half and had no screen
> and no player, `prototypes/solarpunk/play/` is the rest of it, and section 8d records what it is
> and how to read the result. `bun run prototype:play`. What is left of this stage is not code: it
> is an hour with a person in front of it.

**Stage 4. Bevy, if and only if stage 3 was fun.**

### 8a. Where stage 1 actually stands

Done, and checked:

| | |
|---|---|
| `crates/agv-sim` | The whole physics: SPA and delta-T, Perez 1990 transposition, Erbs, DISC, DIRINT and Engerer 2, array geometry and the four trackers, shadow projection and the infinite-row closed forms, view factors, interreflection, rear-side POA, snow, the PVWatts chain end to end. No dependencies, 101 kB of wasm, 37 kB brotli |
| The ONLY implementation | 2,679 lines of TypeScript physics deleted. `bun run test` and `bun run build` run `bun run rust:wasm` first, a build with the core off refuses every number rather than degrading |
| Right | `tests/nrel_spa.rs` against NREL Appendix A.5, better than 0.001 degrees, `tests/pvlib_decomposition.rs` against pvlib's own output, within a watt, `tests/geometry_spec.rs` against closed forms and PVWatts' published defaults, written BEFORE the deletion because those modules had only parity evidence |
| Not diverged | `src/sim/rust-geometry-parity.test.ts`, over the four modules still deliberately dual |
| Wired | `src/sim/core.ts` holds the installed core and `requirePhysicsCore` throws rather than degrading, `src/main.tsx` awaits `ensurePhysicsCore` before the first render |
| One copy of the tables | only `perez_tables.rs` is generated now, `spa_tables.rs` and `dirint_tables.rs` are the only copies and are hand-maintained |
| Gated | a `rust` CI job for fmt, clippy and tests |

Three decisions worth knowing before continuing:

- **No wasm-bindgen.** The boundary is f64 in and f64 out, so `src/wasm.rs` exports a plain C ABI
  and `src/sim/rust-core.ts` reads it back. Revisit when the boundary needs strings, structs or
  errors, it does not yet.
- **The core is installed, not injected.** `src/sim/core.ts` is module state, which is normally a
  smell and here is the only design that works: the bake runs in a Worker, and a `RustCore` is a
  set of closures over a `WebAssembly.Instance`, so it cannot cross `postMessage`. Each module
  graph instantiates its own. That is why `ensurePhysicsCore` is called in two places.
- **On by default now, and the switch only turns it OFF.** `VITE_RUST_CORE` disables the core
  only on the exact string `off`, and that build renders the shell and refuses every number,
  which is useful for exactly one thing: proving the refusal is loud. There is no TypeScript to
  fall back to. **A deploy made without a Rust toolchain no longer ships an app that works, it
  fails at the build step**, which is the correct failure and the reason the Workers Builds
  command needs `rustup target add wasm32-unknown-unknown` in front of it.

Transposition landed 2026-09-01 and behaved better than solar position did: across 1,296 swept sky
states the two implementations are **bit-identical**, worst disagreement 0.0. That is not luck and
it is not a guarantee either. Solar position accumulates hundreds of transcendental terms and cannot
manage it, transposition is a short chain of arithmetic over a few table lookups, so both sides land
on the same bits.

Decomposition landed the same day and is bit-identical too, in all four models, for a different
and more interesting reason: `src/sim` stores every irradiance series in a `Float32Array`, so both
sides narrow to single precision at the same six points and the last-bit differences that `exp`
and `pow` really do produce between two libm implementations are rounded away before anything
reads them. `math::through_f32` exists to reproduce that narrowing rather than improve on it.

**That narrowing also sets what the parity sweep can see, and it is worth knowing the number.**
Seven perturbations of the Rust were measured against it, and the tolerance is counted in f32 ulps
rather than in watts because an absolute tolerance in watts is really an ulp tolerance that
changes with the magnitude. At one ulp the sweep catches an Erbs coefficient wrong in its eighth
digit. It does **not** catch a DIRINT coefficient wrong in its fifth, and that is structural
rather than fixable: DIRINT selects a table row on a step function, so it is bit-identical or it
is tens of watts, with nothing in between. What covers DIRINT's small errors is the pvlib
reference test, not the sweep. Neither file is sufficient alone, which was already the argument
for having both.

The PV chain landed, and then so did the deletion, which is further than this stage asked. What is
left of stage 1 is the visibility kernel, where the bundle question that used to gate the wgpu
route is answered in section 5b, and a measurement: the four modules still implemented twice sit
on synchronous paths in `state/derive.ts` and the CPU reference backend, and what crossing the
wasm boundary costs there has not been measured. The race that used to exist between the wasm
fetch and the first main-thread call is gone: `src/main.tsx` awaits the install before rendering,
because there is no second implementation to compute with while the fetch is in flight.

**One finding from this stage belongs in every future port, not just this one.** A parity test
holds two implementations to EACH OTHER, so a convention both copies share is invisible to it at
any tolerance. `panel_snapshot` carried a row-axis error into the Rust faithfully, comment and
all, and the sweep agreed with itself while the application overstated light under an array by
about 23%. Section 8c has the account. Budget an oracle that is not the other implementation for
anything ported after this.

The honest expectation is that most of the value is in stages 1 and 2, and that stage 3 is where
the project either becomes real or stops. Stage 3 costing very little is deliberate.

---

## 8b. Costing the second entry point, measured 2026-09-01

Section 5b concluded that the right shape is one model and two web shells. This is what that
costs, in the units that can actually be counted.

### The entry point itself is nearly free, and this was spiked rather than estimated

A throwaway `game.html`, six lines of `rollupOptions.input` in `vite.config.ts`, and a
seventeen-line entry importing decomposition, solar position, transposition, the PV chain, the
crop catalogue and the ranker. Built, measured, reverted.

| | brotli |
|---|---|
| core app before | 503,039 |
| core app with a second entry pulling in the whole model | 504,239 |
| **delta** | **+1,200 bytes** |

The `main` chunk went **down**, 205,870 to 192,233, and a shared `chain` chunk of 14,821 appeared.
That is a hoist and not a duplication: rolldown shares the model between entries on its own, so
"one model, two shells" costs the wire about a kilobyte of chunk-boundary overhead and nothing
else. This was the one thing about option 2 that could have been quietly expensive, and it is not.

One thing does need fixing when this is done for real: `not_found_handling:
"single-page-application"` in `wrangler.jsonc` answers `/game` with `index.html`. Either link
`/game.html` directly or add a pathname branch to `workers/entry.ts`, which is nineteen lines and
already branches on pathname for the proxy.

### What has to be in the shared crate, counted

Source lines only, tests excluded, split by whether a coarse per-tile game loop needs a version of
the thing at all:

| | shared with a game | designer-only, or per-shell |
|---|---|---|
| `types/` | 2,552 | 232 |
| `sim/`, already ported | **1,563** | |
| `sim/`, left to port | 1,641 | 1,169 |
| `sim/`, stays TypeScript either way | | 1,750 (worker and browser plumbing, wasm glue) |
| `recommend/` | 3,220 | 3,684 |
| `data/` | 12,045 (catalogue, schema, reference tables) | 1,669 (network I/O, example raster) |

The `sim/` split within "left to port": both shells need the PV chain (745), geometry (306), shading
(136), view factor (113), the CPU visibility reference (168), units (64) and snow (109). Compliance
(394), the raster (151), the accumulator (143) and the MF:2 skydome (481) are shaped for the
designer's one-plot 0.12 m bake, a game wants coarse per-tile figures for thousands of plots, which
is section 5c's point that the driver and the resolution are not shared even when the functions are.

### The anchor: the port already done, rather than a guess

Solar position, Perez transposition and beam/diffuse decomposition are **1,018 TypeScript lines**
of physics. Porting them to the standard this crate holds itself to produced **1,692 hand-written
Rust lines, 674 generated table lines, 596 lines of parity test** and the wiring: 4,045 insertions
across 25 files in four commits.

So roughly **four lines of output per TypeScript line ported**, at a standard that includes a
published-value test, a parity sweep and measured detection thresholds. Applied to the 1,641
shared `sim/` lines remaining, that is on the order of 6,500 lines of output. Applied to
`recommend/`'s 3,220, about 13,000.

**But `recommend/` will not port as well as `sim/` did, and the reason is worth stating before
anyone budgets it as more of the same.** The physics ported cleanly because it has external
oracles: NREL publishes a worked example, pvlib publishes DISC and DIRINT output, and the
degenerate tilts have closed forms. `recommend/` has none. Its tests are spec-level but the specs
are this project's own decisions, so a port can be checked for agreement with the TypeScript and
for nothing else. That is the weaker of the two claims in every test table in this repository,
and for `recommend/` it would be the only one available.

### What has no head start, and it is still most of the work

Everything in section 6's last subsection: economy, money, costs, labour, citizens, seasons past
year one, progression, failure states, multiple sites. Plus two things this section adds:

- **A coarse per-tile light driver.** The existing pipeline bakes one plot at 0.12 m. Nothing in
  the repository computes light for a thousand tiles cheaply, and that driver is what decides
  whether the game runs at all.
- **The game's own renderer.** Section 5b priced both routes: wgpu at 129 kB brotli, where you write
  the scene layer yourself, or Bevy at 3,194 kB, where you do not. The designer's 5,282-line scene
  layer does not transfer, it is three.js-shaped.

### The order, and why each step stands alone

The property worth preserving is section 5's: every step pays for itself even if the game never
happens.

| | | value if the game never happens |
|---|---|---|
| 0 | Solar, transposition, decomposition, wired behind a flag | **done** |
| 1 | Finish the shared physics: PV chain, geometry, shading, view factor, CPU reference, units, snow | the designer's numbers have one implementation |
| 2 | Move the catalogue to a format both languages read | the generator emits both, the drift check covers it |
| 3 | Delete the TypeScript physics | "single source of truth" becomes true rather than aspirational |
| 4 | Second entry point | measured above: about a kilobyte and an afternoon |
| 5 | The game | nothing. This is the bet |

Steps 1 to 3 are the whole of section 5c's condition and they are worth doing on their own terms.
Step 4 is cheap enough that it is not worth planning around. **Step 5 is where the honest estimate
in section 9 applies unchanged: the hard, boring, valuable 30% is what steps 0 to 4 buy, and none
of the 70% that makes something a game is in this repository or in this plan.**

### The step most likely to be skipped, and it is step 2

`data/catalog/rows.ts` is 3,715 lines of hand-maintained TypeScript, and
`native-ranges.generated.ts` is 3,696 more generated from it. Until both languages read one file,
"one engine" is not true however the shells are arranged, and this is the step with no visible
symptom when it is missed: the two catalogues simply drift, slowly, and nothing fails.

The pattern for fixing it already exists in the repository. `src/types/citation-ids.generated.ts`
is a compile-time union generated from `docs/CITATIONS.csl.json`, which is exactly the shape
needed: data in a neutral file, types generated for whichever language wants them, and a CI drift
check. `scripts/generate-rust-tables.mjs` is the same idea pointed at Rust. Neither is new work of
a kind this project has not already done twice.

---

## 8c. The prototype, and what it found

Section 8b ends by saying the measurements are not what decides this, and that the cheap way to
test the part that does is to prototype the hardest unknown before paying for any architecture.
That was done, in `prototypes/solarpunk/`, which is a throwaway and says so.

**Speed is solved.** A cached tile costs 2.5 us, a town of 4,096 tiles resolves in 10 ms, a full
monthly tick of that town costs 0.59 ms. The reason is the one thing from the prototype worth
carrying forward: cost is per array CONFIGURATION, not per tile, because the infinite-row closed
forms this repository already has and already tests take an array's description and not a position.
A thousand tiles carrying five layouts is five evaluations.

**Accuracy is solved too.** The driver converges on the shipped pipeline's own raster as the
array grows, exactly as an infinite-row approximation should: **-5.1%** at 9 x 18, **-0.4%** at
15 x 30, **+1.1%** at 21 x 40. Term by term at the largest, over its interior cells:

| | full raster bake | coarse driver | |
|---|---|---|---|
| beam | 3.10 | 3.10 | -0.2% |
| diffuse | 8.63 | 8.77 | +1.6% |
| **total** | **11.73** | **11.86** | **+1.1%** |
| sky view factor | 0.653 | 0.649 | -0.5% |

all in mol/m2/day. An independent analytic 2D integral of the same configuration puts the true
sky view factor at 0.6495, which is the closed form's answer to within 0.1%, and a Monte Carlo
estimate agrees with both quadratures of the sky dome at the same point.

**So the coarse driver is not a second model.** It is the same model evaluated cheaply, and the
worry section 8b raised, that a game on a coarse driver would fork the MODEL rather than the shell,
does not apply to this driver. Holding it there needs one differential test, not a testing
discipline, `prototypes/solarpunk/gap.test.ts` is that test.

**The first answer was 25% dark, and it was measuring the application.** For a day this section
recorded that the driver read 33.1% / 28.9% / 24.9% low and that "the entire gap is in how the
array is modelled as blocking light". The second half was true in a way nobody meant: the gap was
not in either light model but in the ARRAY both were given. `panelSnapshot` stepped a fixed
array's rows perpendicular to the direction the modules face, on this repository's own default
array, producing rows that stood shoulder to shoulder and shaded almost nothing. Cross the two
axes deliberately today and the gap comes straight back, from 1.1% to 17.8%.

That was fixed on 2026-09-01, in `src/sim/geometry.ts` and `crates/agv-sim/src/geometry.rs`
together, `crates/agv-sim/README.md` describes it in full under *What holds it up*. The shipped app
had been overstating light under an array by about 23%.

It is recorded here because it is the reason this section's numbers changed, and because of what it
says about evidence. **A prototype built to test a game found the largest correctness bug in the
designer.** It found it by comparing the raster against the closed form on an array shaped the way
real ones are: `src/sim/shading.test.ts` already made that comparison and passed, because its
fixture set the row azimuth equal to the surface azimuth, which is the one array shape the broken
code got right. The test existed, the FIXTURE was the blind spot.

**What section 8c still does NOT answer** is whether any of it is fun. That needs a person and a
screen, and section 7 item 3 is about exactly the temptation to let a number stand in for that.
Section 8d is the screen.

## 8d. Testing it for fun: the page, and how to read what it says

Section 8c answered the two questions a harness can answer, and neither of them was whether
anybody wants to play this. This section is what standing a person in front of it required, what
that cost, and what the result means either way. It is built: `bun run prototype:play`.

### The three gaps `loop.ts` had, and how the page closes them

Written before building it, kept because the third is the one that decides whether any of this is
worth doing and is the easiest to quietly drop.

1. **No screen and no player.** `loop.ts` runs under vitest and `createTown` takes a frozen
   `readonly Tile[]`, so the loop advanced a world nobody was playing. *Closed:* a grid that can
   be pressed, four verbs and an undo.
2. **No decision.** The loop counted `thriving`, `starved` and `energyKwh` and never put them
   against each other. *Closed:* panels and bed share a tile, so the panel that earns is the
   panel that shades, and the readout says both numbers for the tile in front of you.
3. **The mechanic that might make it novel was absent entirely**, and this is the one that
   matters. Section 4 argues the interesting move is making the evidence tier load-bearing, and
   section 7 item 4 says it has to be in the design **from the first prototype, not retrofitted**.
   `loop.ts` had none of it: every crop was one number, `cropDliMin`, and every claim behaved the
   same. A fun test built on that measures whether people enjoy a small city-builder about
   sunlight, which is a question this repository has no special standing to ask and no advantage
   in answering. *Closed:* the grade decides the behaviour, and `game.test.ts` fails if it stops
   doing so.

The material for the third was already here and not hypothetical: **10 A, 20 B, 2 C, 12 D and 14 E
graded claims** across the data files, plus `Cited<T>` and the verification states in
`types/evidence.ts`. Nothing had to be invented, it had to be wired to an outcome.

### What was NOT needed, and this is the useful half

Nothing in stages 1, 2 or 4, and none of it turned out to be needed in the building either:

- **No Rust, no wasm, no shared crate.** The driver that makes a town affordable is
  `prototypes/solarpunk/coarse-light.ts`, 169 lines of TypeScript over closed forms the app
  already ships, and section 8c measures it within 1.1% of the full bake at 2.1 us a tile. The
  6,500 to 13,000 lines section 8b prices buy nothing a fun test can use.
- **No Bevy, no renderer, no canvas.** Section 5b's whole argument is that the DOM-versus-canvas
  choice is the expensive one, a grid of coloured cells is DOM and costs nothing to abandon.
- **No second entry point.** Section 8b spiked one at +1,200 bytes, and even that is more
  commitment than this needs. A page under `prototypes/` that is never built or deployed is
  enough, and being unable to ship it is a feature.

So the fun test is affordable in a way the rest of this document is not, and it is the step that
decides whether any of the rest is worth doing. That ordering is worth stating plainly: **section
8b's cost tables only start to matter after this step says yes.**

### It is built, and the estimate held

`prototypes/solarpunk/play/`, run with `bun run prototype:play`. A 7x7 board where a tile is one row
pitch of ground, panels over a bed, a crop from the catalogue, a practice from the companion
rules, a month per press and an undo. No Rust beyond the core the app already ships, no renderer,
no second entry point: `vite.config.ts` of its own, never built with the application.

Nothing in it is invented. Ground light is `coarse-light.ts`, within 1.1% of the shipped raster
bake. Electricity is `runAnnualChain` scaled by land area, so the two hard-coded constants the
previous loop admitted to are gone: one tile of spaced array makes 2,884 kWh a year and one of
dense makes 4,048, and closing the rows up takes the ground under it from 24.6 to 12.1 mol/m2/day.
That is the trade, in one square.

The evidence tier is the mechanic and it is wired to outcomes rather than to a panel:

| grade | how it behaves | why |
|---|---|---|
| A, B | the measured effect, every season | `ler-cereal-legume` is 1.22 to 1.32 across 90 studies |
| C | varies season to season | a mechanism and no measured effect, so it has to be averaged |
| D, E | true or false in THIS world, rolled once from the seed and never shown | the literature has not settled it, so neither has the game |
| contradicted | false in every world | that is not an open question |

The pairing that makes the point came out of the data rather than a designer:
`marigold-cover-nematode` is grade C, works, and asks for the whole bed for a season, because its
`requiresManagement` says a dense stand held 60 to 90 days, `marigold-interplanted-nematode` is
grade E, free, and does nothing. Same claim, two forms, and choosing between them is this
repository's thesis as one decision. The crops split the same way without being arranged to: sweet
corn is offered grade A and B practices, tomato is offered D and E.

Played through once: seven seasons of a grade D practice showed a mean harvest of 1.10 against
1.00, and the reveal answered *"Anecdotal, untested, no proposed mechanism"*. Six seasons of the
contradicted grade E practice showed 0.97, and the reveal handed over `finch-collier2003` and
`uvah-coaker1984-mixed-cropping`. That is the loop working: the player does the trial, and the
game tells them what is known afterwards.

`game.ts` is pure and `game.test.ts` holds the twelve assertions that matter, chiefly that the
grade actually changes behaviour, because a page that quietly treated all five grades the same
would look exactly like a page that did not.

### How to know it failed

The two ways to read the result:

- **It is fun, and the evidence tier is why.** People replay a folklore-grade planting to find out
  whether it works here. That is the signal section 4 predicts, and it is the only result that
  justifies section 8b's estimate.
- **It is fun, but the evidence tier is decoration.** People enjoy placing panels and ignore the
  grades. This is section 7 item 4 arriving early and cheaply, and it means a normal game engine
  was always the right choice: the answer is then to build it elsewhere, or not at all, rather
  than to spend the shared crate on it.

A third outcome, that it is not fun, is the cheapest of the three and the one this step exists to
buy. Nothing about that verdict touches the designer, which keeps its own numbers either way.

### One thing to fix before a person sees it

`loop.ts` invents its energy: `KWP_PER_ARRAY_TILE = 1.5` and `KWH_PER_KWP_YEAR = 1200`, hard-coded
beside a comment admitting it. The light half of that loop is the application's own and now agrees
with the bake to 1.1%, the electricity half is a guess. For a fun test that is defensible, and it
must not survive the test: a game whose whole premise is that its numbers mean something cannot have
a made-up figure on one side of its central tradeoff. `runAnnualChain` already produces the real one
per configuration, and it memoises the same way the light does.

---

---

## 8e. Making it 3D with the designer's own plants, measured 2026-09-02

The question was whether the game could show the same 3D plants and the same crop sprites the
designer already has, and what a full immersive version of that would cost. It was spiked rather
than estimated, because the previous two sections were and because the answer turned out to
depend on a distinction nobody would have guessed from reading.

**It is built and it works.** `prototypes/solarpunk/play/Board3D.tsx`, 412 lines, plus 92 lines
of changes across the other three files. `bun run prototype:play`.

### The finding: `src/scene/` is two layers, and only one of them is reusable

This is the whole result, and it was not visible before looking.

| | imports from `src/state` | reusable by a game |
|---|---|---|
| `foliage.ts`, `panelGeometry.ts`, `materials.ts`, `textures.ts`, `lighting.ts`, `agx.ts`, `cascades.ts`, `ambientOcclusion.ts` | **nothing** | **yes, as they are** |
| `PlantInstances`, `PvArrayMesh`, `BedMesh`, `Ground`, `SunRig`, `SkyLight`, `DliOverlay`, `PlotBoundary`, `GardenScene` | `useAppStore` directly, every one | no |

So the *primitives* are already a rendering library with no application in them, and the *React
components* are welded to the designer's store. The board reuses the first row unchanged and
reimplements the second, which is why it is 412 lines rather than 40 and also why it is 412
rather than 3,000.

**There are no 3D models in this repository, and that is good news.** A plant is not an asset: it
is `canopyCards(shape, budget)` in `foliage.ts`, which builds a cluster of alpha-tested leaf cards
along a profile chosen by the crop's own `footprint.canopyShape` from the catalogue. Ten shapes
cover all 163 crops. Nothing is loaded, nothing is licensed, nothing has to be authored, and a
crop added to the catalogue is drawable the day it is added. `PLANT_SPRITES` are the same idea one
dimension down: 20 pixel forms plus a three-colour palette, `src/ui/crop-sprite-forms.ts`.

The sprites went into the game in **one import and two call sites**, and they are the same
`CropPicture` the app's own lists use, `aria-hidden` and all.

### What did NOT come for free, and both are units problems

Neither was predictable from reading and both were instant on screen.

1. **Scale.** The designer draws a bed a person is standing beside, so a 0.3 m carrot is a big
   object. A game tile is 6.5 m of ground seen from 30 m up, and a fixed sixteen plants in it reads
   as scattered litter. Fixed by spacing plants at the crop's own mature width, which the catalogue
   already holds, a tile now carries between 4 and 121 plants depending on the crop.
2. **Photometric units, and this is the one to remember.** `keyLight` returns a PHYSICAL irradiance
   in the hundreds of watts, because the designer's exposure is 0.0315 under AgX and its sky is a
   real radiance model. Every colour a game author picks is an ordinary 0-to-1 sRGB colour. Mixed
   under that exposure the sun is right and everything hand-picked is crushed to near black. The
   first build was white-out, the second was an olive murk. **Reflectances stay in 0-to-1, emissive
   and background colours have to be lifted into the beam's scale.** Take `RENDERER_SETTINGS` and
   `keyLight` together or take neither: they are one setting.

### What it would cost to go from this to a game people would call immersive

The spike is a board with light, shade, growth and a camera. It is not yet a game that looks
designed. Honest buckets, and the ordering matters more than the numbers:

- **Art direction, 60 to 70% of the remaining work and the only real risk.** Everything above is
  mechanical, making it *look* like a place is not, and it is the part this repository has no head
  start on. The designer's renderer is tuned to be photographic and legible, which is the correct
  target for a design tool and the wrong one for a game people call cute. A stylised look is a
  different lighting model, different materials and probably different foliage, and at that point
  `src/scene/`'s primitives stop being an advantage.
- **Ground and water as a surface** rather than 49 quads, so the board reads as a place: one
  displaced mesh, paths, edges. Days, not weeks, and it is what buys most of the "immersive".
- **Buildings, people, anything that is not a plant or a panel.** No head start at all. This is
  where a real asset pipeline and its licensing arrive, and it is the first point at which the
  claim that the game costs no new art stops being true.
- **Camera, selection and placement affordances** at game quality rather than click-a-quad.
- **Performance at city scale.** 49 tiles is nothing, the instancing story here is per tile and
  would want to be per crop across the whole board, and `PlantInstances` has a comment about
  regressing past ~5,000 objects that will matter.

### What this changes about the rest of this document

Two things, and the second is a correction.

**Section 5b's DOM-versus-canvas argument now has a worked example, and it went the way 5b
predicted.** The first build put the 3D above a visible grid of buttons, which was two pictures of
one board, the grid was removed a session later and the board is now placed on directly, by pressing
the ground. That is the right call for a game and it is exactly the moment 5b warns about, because
the obvious next step is to delete the buttons along with the grid.

They were not deleted, they were made `.sr-only`. A canvas takes no focus and announces nothing,
so deleting them is the difference between a game that is a canvas and a game that is mouse-only.
Measured after the change: the tile grid is 1x1 px and still focusable, still carries each tile's
whole state in its text, and `:focus-within` brings it back on screen at 400x2005 so a sighted
keyboard user can see where they are. **Cost: one CSS class.** Everything renders from one
`world`, so the picture and the controls cannot disagree.

The general form is worth stating because it will come up again: *a canvas game keeps its
accessibility by keeping a real control layer, not by describing the canvas.* The `aria-hidden`
canvas is the picture, the hidden buttons are the interface. Anything that can only be done by
pointing at pixels is a thing some players cannot do.

**The claim that a game "shares the designer's visuals" needs narrowing.** It shares the geometry
generators and the colour pipeline, which is genuinely most of the hard part and cost about a day.
It does not share the scene, the lighting rig, or any of the nine components that actually draw the
designer, and it shares nothing at all for the half of a game that is not plants and panels. "One
engine, one look" was never going to be true, "one plant model and one catalogue" is true, is worth
having, and is what was actually demonstrated.

**A note for whoever picks this up.** `prototypes/solarpunk/tsconfig.json` was added because the
prototype was in NO typecheck at all: `tsconfig.app.json` includes only `src`. That is worth
knowing before trusting that a green `bun run typecheck` says anything about this directory.

---

## 8f. What eleven scripted personas found, 2026-09-02

Six player personas (8, 13, 22, 35, 45 and 70 years old, with different reference games) and four
system designers were pointed at the prototype and told to actually drive its pure rules core
headlessly rather than read it. Their reports agreed on a root cause none of them was told about,
and it was a **defect against this repository's own standards**, not a missing feature.

### The root cause: the game invented a step function where the repo ships a cited curve

`yielded = (dli >= crop.dliMin ? 1 : 0)`. One binary gate, and it caused nearly every dead choice
the personas measured independently:

- **crops were interchangeable**, differing only in a threshold, so carrot strictly dominated:
  it needs the least light, and every crop yielded the same 1.0 when lit. Measured over 24
  seasons: carrot 881.5 against tomato 686.3.
- **surplus light was worth nothing.** Tomato yielded 1.150 at 15.7 mol/m2/day and 1.150 at 33.8.
- **two of five crops were permanent silent zeros.** Strawberry cleared its threshold under NO
  array, sweet corn cleared it under no dense one. A player spends 147 presses to find out.

Meanwhile `src/recommend/yield.ts` already interpolates the **Laub et al. 2022** shade-response
curve with 95% bands and per-group study counts, `src/data/crops.ts` exposes `laubCurve`, and
every crop in the catalogue already carries the `laubGroup` that selects it. The prototype's own
README says nothing in it is invented. It was.

**Fixed.** Yield is now `laubCentralRelativeYield` on the season relative shade ratio. Measured
after the change, at 50% shade under a dense array:

| crop | open sky | dense | 95% band | studies |
|---|---|---|---|---|
| strawberry | 100% | **100%** | 75-100 | 5 |
| tomato | 100% | 95% | 56-100 | 3 |
| carrot | 100% | 50% | **28-89** | 2 |
| pole bean | 100% | 40% | 31-51 | 14 |
| sweet corn | 100% | 35% | 27-45 | 10 |

Two things worth noticing. Under open sky every crop scores 1, which is correct and is the point:
**the panels are now the entire reason crop choice is a choice.** And the bands differ enormously
by evidence base: carrot's 50% rests on two studies and spans 28 to 89, while pole bean's 40%
rests on fourteen and spans 31 to 51. Those are different KINDS of number, and section 4's whole
argument is that a game about evidence must be able to say so. This moves the evidence tier off
six companion rules a player might never touch and onto the main verb, choosing what to plant.

### Three more defects the playtests found, all now fixed

**The evidence mechanic could be skipped in one press.** Trials were counted once per BED per
advance, not per season, so six painted beds plus a single Advance read as six seasons of evidence
and revealed the claim. Painting the board is the first thing every player does. A season is now a
season however many beds ran it, beds are still summed, because a mean over more beds is a better
estimate, but replication across beds must not buy replication across time. Pinned by a test that
fails with "expected 8 to be 1" against the old code.

**Grade A was free money.** `practiceEffect` dropped `competitionPenalty` entirely, so
`ler-cereal-legume` paid a flat 1.27 while the rule's own notes say each component almost always
yields less than in monoculture. Net of its own penalty it is now **1.02**, and
`three-sisters-root-foraging` is **0.90**: a grade B measured practice that loses yield on the bed
while still being good land use, which is exactly what a land equivalent ratio means. A grade that
is always worth taking is not a decision.

**A rule's effect was multiplied into harvest whatever it measured.** Eight of the twelve A/B
rules in the corpus carry `effectMetric` of `pest-density-pct` or `nitrogen-transfer-pct`, where
0.5 means pests halved. None of the curated six trips it, so this was one added rule away from
turning the best-evidenced practices into the worst ones. Only `ler` and `yield-pct` may touch
yield now, and a test pins the guard precisely because nothing currently exercises it.

**December paid what June paid.** Energy was `annual / 12` on a site whose ground light swings
eightfold across the year. It is now twelve month-long runs of the shipped chain: December 117 kWh
against May 323 for a spaced tile. The check that matters is that the slices sum back to the
single full-year figure, and the first implementation did NOT: it rebuilt the weather slices but
reused one options object whose per-hour snow-cover series was still aligned to the full year, so
every month was fed January's snow and the annual total came out **18% high while every individual
month still looked plausible**. Summing them back up is the only thing that caught it.

### The board was 49 sealed copies of one tile. Fixed 2026-09-02.

`monthlyDli(kind)` took no tile index, so a bed read 32.172 mol/m2/day alone and 32.172 ringed by
eight dense arrays. Every persona measured this independently and the Factorio player proved it
arithmetically: a checkerboard scored the exact mean of all-open and all-dense. Position was worth
nothing, which is fatal for anything called SimCity.

The cause was in `coarse-light.ts` and stated plainly in its own header: **"every tile's array is
infinite in both directions."** That is a fine approximation for one plot in a design tool and it
is the whole bug in a game, because an infinite array does not have a middle or an end.

Light now depends on the RUN: how many adjacent tiles carry the same array, and where in that
stretch the tile sits. Runs go down a column, because `rowAzimuthDeg` is 90 so the panel rows run
east-west and only neighbours along the pitch can shade one another.

`skyViewFactorForRun` is `vfGroundSky2dOracle` with the row count made real: the same
crossed-strings integral over the same geometry, with only the rows that exist, and the blocked
angular bands UNIONED rather than assumed disjoint. It is held to the old function as its oracle,
which is the check that matters:

| | sky view factor | season shade | sweet corn |
|---|---|---|---|
| lone array tile | 0.771 | 16% | 77% |
| end of a 7-run | 0.616 | 30% | 58% |
| middle of a 7-run | 0.543 | 48% | 36% |
| infinite rows (the old model) | 0.510 | | |

A run of 21 reads 0.5119 against the infinite oracle's 0.5100, which is the convergence the test
pins. Measured on the board: a bed under a lone dense array now reads 26.685 mol/m2/day and the
same bed in a full column reads 17.002, where both used to read 32.172.

**An open bed beside a run is shaded too**, which is the same fault one square over: a bed with
nothing above it but panels hard against it was reading as full open sky. `lightAt` gives such a
tile an index just outside the run and the same integral answers it, because the arithmetic never
required the ground point to be under a row.

Three things this turned up that are worth carrying forward:

- **The infinite default is load-bearing.** Making a finite run the default broke `gap.test.ts`
  instantly, and rightly: that test validates this driver against the full raster bake and its
  framing is "one tile, infinite rows in both directions". The validated model stays the default
  and a finite run is something a caller asks for.
- **The tests had to be told what they meant.** Two assertions failed that were not wrong before:
  a tomato under a LONE dense array loses nothing at all, because one row shades 16% and Laub's
  fruity-vegetable group holds a full crop through that. The bed had to be moved to the middle of
  a five-run before the shade reached the harvest. That is the model working.
- **`rowCount` buys nothing in the PV chain.** Passing the run length through `runAnnualChain`
  returned 4047.56 kWh per tile for runs of 1, 3 and 7, byte-identical: the chain's row-shading is
  an infinite-row model, so a lone row already carries the interior-row penalty. The plumbing was
  reverted rather than left as dead complexity.

**The consequence to fix next, and it is a live one.** Because light is now run-aware and
electricity is not, scattering panels beats clustering them on every axis: a lone dense tile makes
the same 4,048 kWh as one buried in a column and shades a third as much ground. That is not a
modelling error, it is what the physics says, and real farms cluster anyway because land, mounting
and cabling cost money. **The game has no cost for anything**, so the panel-side optimum is now
"spread them out", which is a new dead decision replacing an old one. The counterweight is the
economy, not more physics.

Also still true: do NOT ship a rotate gizmo. `rowAzimuthDeg` and `clearanceHeightM` are both
measured no-ops in the coarse driver, and `buildYear` puts solar noon at 12:00 UTC for a site whose
real solar noon is near 17:00 UTC, so an azimuth control would teach the wrong compass direction.

Also outstanding: no progression (the palette on turn 1 is the palette on turn 60), no failure
state, electricity buys nothing, several crops in one bed, and water. **Water is the one that
flips the sign of the central trade**: `laubCentralRelativeYield` caps relative yield at 1.0
unless `waterLimited` is true, so until water exists shade is monotonically a cost and the actual
agrivoltaic finding is unreachable. It was costed at 5 days and carries a warning: the fixture's
`dewPointC` is an all-zero `Float32Array` and `dryBulbC` has no diurnal term, so Hargreaves-Samani
returns 115 mm/yr against a real 811. Budget half a day for the fixture first, or the system will
look finished while measuring nothing, which is the shape of the `panelSnapshot` blind spot again.

---

## 8g. The economy, built on the one resource that does not come back

The round after 8f asked for a cost on panels and a purpose for the electricity. The design came
from the SimCity agent in 8f's cluster and its framing is the part worth keeping: **light is
renewable and ground is not.** A bad shading decision is undone by moving the panels. A bad
planting decision is not undone at all.

### Ground memory, from three rows nothing referenced

`loadRotationConstraints()` in `src/data/companions.ts` holds three constraints, graded and cited,
and **the application referenced them from nowhere**. A tile now remembers which plant families
have grown on it, and planting is checked against them:

| rule | family | grade | effect in play |
|---|---|---|---|
| `rotation-solanaceae-wilt` | Solanaceae | B | refused for 4 seasons after a harvest |
| `rotation-brassica-clubroot` | Brassicaceae | A | refused for 3 seasons |
| `rotation-allium-white-rot` | Amaryllidaceae | A | **the tile is finished, permanently** |

The third is the strongest failure state in the design and it is one row of authored data:
`rotationEffective: false`, inoculum persistence 20 to 40 years, and an `alternativeControl` of
"Exclusion only: clean sets, clean tools, no soil movement". A garlic crop is worth having and it
costs that square for the rest of the session.

**Refusal, not a yield penalty**, and that is a deliberate constraint rather than a shortcut. The
corpus publishes the interval and publishes no loss curve, so a decaying penalty would mean
inventing the exact kind of number this design exists to avoid. `CalendarFeasibility` already
establishes refusal as this project's answer to an unmodelled quantity.

Every refusal names the rule, the pathogen, the grade and the citation, because a refusal a player
cannot trace is just the application saying no:

> **This ground is finished.** Exclusion only: clean sets, clean tools, no soil movement.
> Experimentally, diallyl disulfide germination stimulants deplete sclerotia in the absence of a
> host. *Sclerotium cepivorum* (white rot), from `rotation-allium-white-rot`, grade **A**
> (hoanghua2024-white-rot).

**Only 3 of the catalogue's 14 families carry a rule**, and the screen says which state it is in
rather than leaving the player to infer: *"No rotation rule is recorded for Fabaceae. That is not
the same as safe ground."* Rendering "no rule" the way it renders "cleared" would teach that
legumes are immune to soil disease, which is false and worse than saying nothing.

The palette went from five crops to eight to reach these families at all: the five it had covered
exactly one of the three, so the rules would have been unreachable. Garlic, cabbage and leaf
lettuce cost no art, because `canopyCards` draws any crop from its own `canopyShape` and
`CropSprite` from its own pixel form.

### What the electricity is for

A board earns MANAGEMENT ACTIONS for the share of the sole-use solar-farm floor it meets: three
with no panels, nine with the board covered. Practices are what actions buy.

**The budget's size is the one invented number in the game, and it says so in its own first line
rather than its last.** The repository has no labour model, how much management a kilowatt-hour buys
is a game dial and cannot be anything else. It is a THRESHOLD and not a rate, deliberately, because
a rate invites tuning by feel and then being quoted as though it meant something, which is exactly
how `KWP_PER_ARRAY_TILE = 1.5` got into the previous loop and had to be taken back out.

What the budget is SPENT on is authored, not priced here: a practice costs one action per entry in
its own `RuleScope.requiresManagement`. And that produces the property nobody designed:

- `marigold-cover-nematode`, grade C, wants a dense stand held 60 to 90 days: **3 actions**
- `marigold-interplanted-nematode`, the SAME claim at grade E: **free**

A player short of power is pushed toward folklore in exactly the way a grower short of labour is.
That fell out of the corpus rather than being arranged, and it is the best argument in this
repository that citation-backed data makes better game design than invented data.

### A structural finding, and it names the next system

Nine of the thirty-one companion rules carry `requiresManagement`, and **every well-evidenced one
of them measures PEST DENSITY**: `undersown-cover-host-finding` (A, 2 actions),
`insectary-strip-enemy-abundance` (A, 2), `trap-crop-managed` (B, 2). The board does not model
pests, so `practiceEffect` correctly refuses them a yield effect, and adding them would cost two
actions to do visibly nothing.

So the honest sinks today are the grade C mechanism rules, and the finding is worth stating
plainly: **the best-evidenced companion rules in this corpus are about pests, so a game that wants
management to matter needs pest pressure.** That is the next system, and it is named by the data
rather than chosen from a genre checklist.

### Still open

The scatter-dominance from 8f is only half-answered. Panels now buy management, so clustering is
no longer pointless, but there is still no per-panel BUILD cost, so a board can afford to spread
arrays out and take both the light and the budget. A build cost is the remaining half.

Also unbuilt from the same spec: the land-equivalent-ratio score (`landEquivalentRatio()` is
Dupraz et al. 2011 and the agent warns it collapses to "pour concrete over everything" unless a
food floor binds it), the map growing into unknown ground, the hidden inoculum-persistence draw
that would extend the evidence mechanic from grades to INTERVALS, and water.

---

## 8h. The two systems the data had been asking for, 2026-09-02

The round that answered "make it more fun, make it clearer how to play, make it look better",
which is three requests and turned out to be three systems.

### The build cost, and it is a connection cost

8g left the scatter hole half-open and said so. The fix is not a flat price per panel, and working
out why is the interesting part. A flat price charges the same for three arrays in a column as for
three scattered across the board, so it takes money off the player without giving them a decision:
the cheapest layout is still whichever one the light model happens to prefer, which is scatter.

What actually differs is **balance of system**. Panels scale with panel count, trenches, combiners
and the run back to the inverter scale with the number of separate ARRAYS. That is why utility solar
is built in blocks. So `buildDebt` is two terms:

```
debt = panelTiles * buildPerPanelTile + runs * buildPerConnection
```

and `costToPlace` is the delta that placing one tile would make to it. Three consequences fall out
of the delta form without being designed:

- joining a run is cheaper than starting one, and the price on the button visibly falls from three
  to one when a player presses the square next to the one they just pressed
- bridging two runs into a single run hands a connection BACK, so the bridging tile is free
- taking panels down refunds nothing, which is roughly what demolition is

Runs are counted exactly the way `lightAt` reads them: down a column, broken by a change of array
kind. That is not tidiness. A board that charged for one idea of a run and shaded by another would
be pricing a layout it was not simulating.

### Pests, which the corpus had already named as the next system

8g ended by saying the data names its own next system: nine of the thirty-one companion rules carry
`requiresManagement`, every well-evidenced one measures PEST DENSITY, and with no pests on the
board two thirds of the good data was unreachable. That is now built, and the mechanism is
transcribed rather than invented.

`undersown-cover-host-finding` is grade A off twelve studies and its `mechanism` field says what
the mechanism is: *"Appropriate and inappropriate landings: non-host green surface area dilutes the
landing sequence so specialist flies leave before ovipositing. The mechanism is green surface area,
not smell."*

So pest pressure on a bed is `1 - (unrelated green neighbours / 9)`, plus a term for how often that
family has come off that ground before. Two things fall out that are worth naming:

- **A lone bed is fully exposed, not safe.** Bare ground is not green, so it dilutes nothing. That
  is the classic result and it is the reason undersowing is worth doing at all, a game that made
  isolation protective would have inverted the finding it is built on.
- **Panels want to be in a block and crops of one family do not.** The two systems now pull in
  opposite directions across the same board, which is the first thing here that behaves like a
  city builder rather than a spreadsheet with a camera.

### The rule that counts the wrong animal

The best thing found in this round, and it was found by wiring the data up rather than by reading
it. `insectary-strip-enemy-abundance` is **grade A off 43 studies**, carries
`effectMetric: 'pest-density-pct'`, and its band is **1.5 to 3.0**.

Multiply pest pressure by that midpoint and the best-evidenced rule on the board more than doubles
the pests. It is not a pest density. It counts natural enemies, filed under the nearest metric the
type offers, and the rule's own notes say so: *"Grade A for natural-enemy abundance. Translation
into measurable pest suppression is a separate grade B claim."* That separate claim is
`insectary-pest-suppression`, 0.7 to 0.95, and it now sits directly below it on the palette.

`pestSuppression` therefore reads a band at or above 1 on this metric as counting the wrong animal
and applies it to nothing. **This is the same shape of defect as the `effectMetric` guard 8f added,
one level finer:** that one asks whether a number measures yield at all, and this one asks whether
a number that claims to measure pests is pointing up or down. Both were invisible until a rule
outside the original curated six was wired to something.

It is on the screen as well as in the code, because the misreading is the interesting part: pick
the grade A insectary rule and the detail panel says *"Read that number again."*

A third instance of the same thing turned up while wiring it. `practiceEffect`'s A and B branch
already refused a rule whose `effectMetric` was not about yield, but that check cannot reach the
grade C, D and E rules because none of them carries an effect figure at all. Until the board had
pests they were paid in yield for want of anywhere else to put them, which was harmless, the moment
pests existed it became **double payment from a single coin**, with `marigold-interplanted-nematode`
taking 1.18 on the harvest and 0.8 off the pests from one `hiddenTruth` roll. One hypothesis, two
answers. The fix is that a rule whose `kind` is about pest numbers is worth nothing on the harvest
at every grade, and `PEST_KINDS` is read by both functions so that the partition is stated in one
place rather than kept in step by hand.

`desmodium-interception` is refused for a different reason and by the same principle. Grade B, six
studies, pests to a fifth, and `validRegions: ['KE', 'UG', 'TZ', 'ET']`, its notes say the outcome
"is grade A but non-transferable ... and must not fire for a home-garden bed elsewhere". The board
is in Massachusetts, so `appliesHere` drops it before the palette is built. **A well-evidenced rule
that was measured somewhere else is not a rule you get to use**, and that is now enforced rather
than remembered.

### The invented numbers are now six, and they are in one object

The README said "exactly one number here is invented", which was true while the only dial was the
size of the management budget. A build cost and a pest model each need a scale this repository does
not publish, so it is six, and the response is to make the set **countable** rather than to keep
claiming it is empty. They live in one exported `DIALS` object with the rule they follow written
above them:

> **A dial may set a SCALE, never a RANKING.**

Which practice suppresses pests and by how much, what each one costs to run, which crop minds shade
most, which ground refuses a crop: all authored, graded, cited, and none of it is in `DIALS`. What
is in it is what a season of labour is worth, what steel costs and how hard a pest bites, because
there is no labour model, no cost model and no pest population model in this repository at all.

### Saying what the game is for, which it never had

Every persona in the 8f playtest said a version of the same thing and it was recorded as a copy
problem. It was not. The page explained its physics beautifully and never once said what the player
was **for**.

`coach(world, sim)` is one sentence read off the board, in `game.ts` with the rest of the rules so
that it is tested rather than eyeballed. A scripted tutorial was the obvious alternative and the
wrong one: it goes stale the first time the rules move and then confidently teaches the previous
game. Every branch here names a state that is true right now, so when a rule changes the sentence
stops firing on its own. The last branch is a status line and not advice, deliberately, because a
game that always has an instruction for you is a game you are not yet playing.

The wall of explanatory prose that used to sit above the board is folded into a `<details>`. It is
a good paragraph and it was standing between the reader and the thing they are meant to press.

### The picture, and what it cost

Four changes, three of them reuse and one of them a bug:

| | what it was | what it is |
|---|---|---|
| the sky | a flat background colour and a `hemisphereLight` at a third of the beam | `SkyDome`, the designer's Preetham field, plus a drei `Environment` and `IblGround` |
| the panels | flat dark rectangles | `meshPhysicalMaterial` at the designer's glass settings, reflecting that sky |
| the surfaces | flat colours | `soilSurface`, `groundSurface`, `aluminiumSurface`, `galvanisedSurface`, `laminateSurface` |
| the plants | one green for every crop | `foliageColour(crop.id)`, the designer's own hashed hue, tinted toward sallow by pest pressure |

The sky is the one that mattered, and it was not a decoration. The old comment beside the
`hemisphereLight` admitted it was a cheap stand-in for what the shipped `SkyLight` models properly,
and **sky light is most of what reaches ground under a panel**, which is the quantity this entire
board is about. Shaded ground now reads blue because the sky is blue, rather than grey because a
grey light was pointed at it.

Reusing it cost one extraction: `SkyDome` and `IblGround` were private components inside the
store-coupled `SkyLight.tsx` and are now `src/scene/skyDome.tsx`, which imports nothing from
`src/state`. That is the same split `foliage.ts` and `panelGeometry.ts` already have and 8e
described, this round is the first time the split was applied to something rather than observed.
`foliageColour` came out of `sceneMath.ts` the same way.

**The bug.** The selection ring and the hover ring were `meshBasicMaterial` at hand-picked 0-to-1
colours, viewed through AgX at an exposure of 0.0315. That crushes a hand-picked colour to near
black, so the selection ring on a board whose main verb is selecting had been a dark grey square
since the canvas landed. `toneMapped={false}` is the fix and the principle behind it is worth
keeping: **an annotation is not a surface and should not be exposed like one.** It is the third
time this exposure has caught something on this page, after the white-out and the olive murk, and
all three were the same misunderstanding from a different direction.

### Still open after this round

- The **hidden inoculum-persistence draw**, which would extend the evidence mechanic from grades to
  INTERVALS. `hiddenTruth` already implements exactly these epistemics for grade D and E claims.
- The **land-equivalent-ratio score**, which must not ship alone: 8f measured the energy partial at
  1.32, which beats every crop yield it costs, so maximising it means 49 dense tiles.
- **Water**, which flips the sign of the central trade, and whose fixture needs half a day first:
  `dewPointC` is an all-zero array and Hargreaves-Samani returns 115 mm/yr against a real 811.
- The board is still **one board with no failure**. Nothing ends, nothing is scored against
  anything, and the season counter runs forever. That is the largest remaining gap between this and
  something a person would call a game.

---

## 8i. Making it a place, 2026-09-03

The round that answered "let them pick where they garden, and simulate what actually happens
there". It is the largest change to the game so far and it added almost nothing to `src/`, which is
the point.

### The rule this round was built on

> **The game holds RULES. `src/` holds SCIENCE.**

A frost date, an evapotranspiration, a climate class or a shade response is the application's answer
or it is nobody's. If something is missing it gets added to `src/` with tests and called from the
game. This is written into `PlayContext`'s doc comment rather than only here, because the moment
`game.ts` starts computing climate the designer and the game become two products that quietly
disagree about the same garden.

The measure of how well it held: this round is **1 new file in `src/`** (a shared dev-proxy table,
which is config and not science) and the rest is calls.

### What a place now decides, and where each answer comes from

`createSim` takes a `PlayContext` instead of nothing. `resolveSite` does the work: four upstreams,
the bundled Köppen and hardiness grids, ten years of hourly weather assembled into a typical year.

| what the board does | whose answer it is |
|---|---|
| when the season starts and ends | `seasonAnchors` over the site's frost exceedance curves, at the designer's own `DEFAULT_FROST_PERCENTILE` |
| whether a bed grows at all this month | the same window: outside it, `yielded` is 0 and the panels still earn |
| whether a crop suits the climate | `koppenMembership` against the crop's own FAO ECOCROP envelope |
| how hard the pests press | `site.seasonGdd.base10C`, the site's own degree-day accumulation |
| what the bed wants to drink | `referenceEt` under `shadeShortwaveFactors`, FAO-56 Penman-Monteith where the weather carries dew point |
| what the panels take from the rain | `panelRainSplit`, Elamri et al. 2018 |
| whether shade can HELP | `site.waterLimitation.limited`, a FAO-56 daily balance `resolveSite` already ran |

### The one-argument change with the largest consequence

```
-laubCentralRelativeYield(curve, rsr, false)
+laubCentralRelativeYield(curve, rsr, waterLimited)
```

That literal `false` was the single line keeping the actual agrivoltaic result out of this game. The
Laub curve is allowed above 1 only where water rather than light is what binds, so with no site
there was nothing to ask and shade was monotonically a cost: **every panel was a tax on the
garden.** It is the site's own index now. The same array is a tax in Bergen and pays for itself in
Phoenix, and nothing in the game decides that.

### Two defects found by wiring it up

**Rotation intervals were being enforced twelve times too leniently.**
`RotationConstraint.minIntervalYears` is published in YEARS and was being compared against
`world.season`, a counter that ticks once per press of a button labelled *advance a month*. So
`rotation-solanaceae-wilt` asking for four years off this ground was satisfied by four months. The
rule still refused eventually, which is exactly why nothing ever looked wrong. `world.year` now
exists and the comparison uses it. This was invisible while the board had no calendar worth the
name, and became visible the moment real frost dates gave a month a meaning.

**The fixture's second frost curve reads as the most optimistic answer possible and means the
opposite.** `frostExceedanceCurve` is computed at both `FROST_THRESHOLDS_C`, 0 °C and -2.2 °C. The
synthetic year's coldest hour is exactly -2.00 °C, so nothing crosses the second threshold and the
curve returns its no-crossing default: day 1 to day 365, 364 frost-free days. Anything reading
`frost[1]` would conclude the site never freezes. Nothing in `src/` does, so this is latent rather
than live, and it is written into `fixture.ts` beside the value.

### The pests, and what this corpus cannot say

There is **no pest-incidence-by-region data anywhere in this repository** and the game does not
invent any. What is regional and defensible is that insect development rate is close to linear in
accumulated heat above a threshold, which is what every extension IPM programme forecasts
generations from, and 10 °C is the conventional base for the pests these companion rules are about.
So `site.seasonGdd.base10C` scales the pest pressure the spatial model already produced. The driver
is measured, only the reference it is divided by is a dial.

`PestReading` now separates **crowding** from **pressure**, and that separation came out of a test.
Crowding is the arrangement alone, which is what a player put there and can undo. Pressure folds in
the site's heat. The coach advises on crowding, because telling somebody to spread their beds out
when the beds are already spread and the real answer is "you garden somewhere hot" is worse than
saying nothing.

### Why not WeatherKit

Asked directly, and the answer was already in the decision record. `docs/00-DECISIONS.md` section 4:

> Weather input must be a **TMY**, never a single year. The sign of the shade effect flips between
> normal and drought years (Weselek 2021 potato -20% to +11%, Amaducci 2018 maize gains only under
> rainfed stress).

WeatherKit is a forecast and observation service. It does not publish a multi-decade hourly record,
and section 9 records what the requirement actually is: Open-Meteo is *"the only global, keyless,
CORS-enabled, CC BY 4.0 commercial source returning GHI+DNI+DHI"*. The PV chain needs beam and
diffuse separately, not cloud cover.

There is a real use for it that this round does not need: **a game wants a distribution, not a
forecast.** Open-Meteo already returns ten years, `assembleTypicalYear` collapses them to the
typical one, and the same ten years hold the site's own measured spread, which is where a drought
year should be drawn from. A ten-day forecast cannot do that. If WeatherKit ever earns a place here
it is for "what is happening in your garden this week", it costs a Worker-side JWT and a private
key, and it sits beside the climatology rather than replacing it.

### What resolving a site actually costs, measured

Four upstreams plus four bundled grids. Measured against Open-Meteo's archive API for Phoenix:
the 30-year daily normals are 423 kB at about 5 s to first byte, and the 10-year hourly archive is
larger again. Two things were learned the hard way while checking it:

- **Open-Meteo sheds load rather than refusing cleanly.** Under a burst it returned `502 Bad
  Gateway` with a 70 to 82 second time to first byte, and then `429` once the rate limiter caught
  up. `RESPONSE_DEADLINE_MS` is 12 s and bounds headers only, so this surfaces to a player as *the
  weather service did not answer in time*, which is true and is why `Boot` says so in those words
  and offers another place.
- **`fetchTmy` has a fallback chain and `fetchDailyNormals` does not.** The typical year falls back
  open-meteo, then NASA POWER, then PVGIS, then NSRDB. The climate normals have one source, so a
  bad day at Open-Meteo fails site resolution outright. That asymmetry predates this round and is
  worth closing.

### Unifying the designer and the game

The ask is that these stop being two things. This round is most of the convergence that was
available without merging the two interfaces:

- the game has **no weather of its own** any more, only the fixture the tests use
- it has **no climate, phenology or water model of its own**, only calls
- the region filter reads the geocoder's country instead of a hardcoded `'US'`

What is still genuinely the game's, and should stay:

- `coarse-light.ts`, a cheaper light model held to the shipped raster bake within 1.1% by
  `gap.test.ts`. A deliberate second implementation with a test tying it to the first.
- `DIALS`, the nine invented game numbers, quarantined in one object and labelled.

What a real merge would take, in the order the work falls out:

1. The game's board is a 7x7 grid of 6.5 m tiles, the designer's plot is polygonal beds and arrays
   at arbitrary positions. One of the two has to give, and it should be the grid: a bed is already a
   polygon in `src/types/garden.ts`.
2. `game.ts`'s reducer and `src/state/store.ts` are two state models over the same nouns. The store
   is the survivor, and `World` becomes a slice of it.
3. Time. The designer has an instant (`timeUtcMillis`) and the game has a calendar. The game's is
   the more useful one and the designer already has `src/state/season.ts` reaching for it.
4. The evidence mechanic (`hiddenTruth`, the trials, the grade-dependent behaviour) is the one
   thing the game has that the designer has no home for, and it is the most valuable thing here.
   It wants to be a MODE of the designer rather than a page beside it.

None of that is small, and none of it should start before the branch this all sits on has a PR.

**Superseded 2026-09-03 by `docs/CONVERGENCE.md`**, a full audit of the designer, the game and what
they converge on. It keeps these four steps, adds the defects a merge has to fix first, the two
decision-record entries it needs, and the order.

---

## 9. Scope, stated without optimism

This repository is 234 commits and about a month old, which is a fast pace and should temper any
estimate downward. Even so:

- Stage 1 is the best-understood work here and still substantial: the numerics are delicate
  (SPA solar position, Perez transposition, DIRINT decomposition, all table-driven) and
  "correct" means agreeing with a validated implementation, not merely running.
- Stages 3 and 4 are a game, and a game is not a port. There is no useful multiplier from this
  codebase for the parts that decide whether it is any good.

The most defensible framing: **you have the hard, boring, valuable 30% that most game projects
never build properly, and none of the 70% that makes something a game.** That is a genuinely good
position, and it is not the same as being halfway.

---

## 10. Open questions

- Native-first or web-first? Section 5 argues the web distribution is worth more than it looks
  for this particular artifact, but that is a judgement about audience, not engineering.
- Is the audience people who want a game, or people who want this tool and would enjoy a game
  shaped like it? These lead to different products and the second is a much smaller market that
  this repo is much better suited to.
- Does the TEK material belong in a game at all? `docs/05-tek-agroecology.md` is careful about
  not presenting software as carrying a community's endorsement. A game makes that harder, not
  easier, and section 4's proposal deliberately treats folklore-grade knowledge as testable
  rather than authoritative. That needs a decision made on purpose, with the people concerned,
  before it is built.

---

## 11. Picking the Rust work up cold

Five things, in the order they save time.

1. **`cargo test --manifest-path crates/agv-sim/Cargo.toml` is the first command.** It runs in
   under a second and needs nothing installed but a Rust toolchain. If it passes, the port is
   still right against NREL's own numbers.
2. **Two kinds of test, two different claims, and you need both.** `tests/nrel_spa.rs` and
   `tests/pvlib_decomposition.rs` say the Rust is RIGHT, against published worked examples.
   `src/sim/rust-geometry-parity.test.ts` says the four modules still implemented twice have not
   DIVERGED from each other. A change that keeps one and breaks the other is telling you something
   specific, do not relax either to get green. Section 8a records exactly where each one is blind,
   and section 8c records a bug that neither kind could ever have caught, because parity holds two
   implementations to EACH OTHER and both carried it.
3. **Only `perez_tables.rs` is still generated.** `spa_tables.rs` and `dirint_tables.rs` became the
   only copies when the TypeScript physics was deleted, and they are hand-maintained against their
   published sources, their headers say so. `perez_tables.rs` is still generated from
   `src/sim/perez-tables.ts` by `scripts/generate-rust-tables.mjs`, because `skydome.ts` still reads
   that table and skydome is not ported. Do not edit that one by hand.
4. **Every parity tolerance is measured, not chosen.** Solar position: 1e-10, against a worst
   observed disagreement of 1.6e-13. Transposition and decomposition: both bit-identical, held at
   1e-9 and at one f32 ulp respectively so a different libm cannot fail them. If one starts
   failing, read the number in the failure message before touching the tolerance: a real
   algorithmic difference is a whole-degree effect, and anything in between is worth understanding
   rather than accommodating.
5. **The crate is the only physics, and the switch is inverted.** `VITE_RUST_CORE` is on unless it
   is exactly `off`, and a build with it off renders the shell and refuses every number rather than
   falling back, because there is nothing left to fall back to. `src/sim/core-wiring.test.ts` is the
   file that proves the seams are live rather than merely present, it drives each one with a core
   that answers WRONG, because a run that quietly used something else would pass for the wrong
   reason.
6. **`Float32Array` stores in `src/sim` are load-bearing** and `math::through_f32` reproduces
   them on purpose. A port that keeps everything in `f64` is a more accurate implementation of a
   different function. Three of these were found by parity, the last at 5.1e-10 relative.

### What to do next, in order

The first three items are the designer's, and they come first because the branch they sit on is
the open one section 7 item 1 names.

- **Open the PR for `rust-sim-core`** and add `rustup target add wasm32-unknown-unknown` to the
  Workers Builds command. The branch is green locally, 222 e2e included, and CI has never run on
  it because `ci.yml` triggers on `push: [main]` and `pull_request`.
- **Done 2026-09-04: `gap.test.ts`'s comparison is `src/sim/gap.test.ts`**, with the driver as
  `src/sim/testkit.ts`, at 2 m cells and nine seconds, its crossed-axes block is the regression test
  for the row-axis bug.
- **Measure before deleting the four dual modules.** `geometry.ts`, `shading.ts`, `viewfactor.ts`
  and `snow.ts` sit on synchronous paths. The question is what crossing the wasm boundary costs
  there, not whether the port is right.

Then, and only then, the game, in this order and no other:

- **Play the fun test, sections 8d and 8e.** It is built: `bun run prototype:play`, now with the
  board in 3D using the designer's own plants. What it needs is a person and an hour, and the
  thing to watch is whether anybody replays a folklore-grade practice to find out whether it
  works here. The cost tables in 5b and 8b do not start to matter until that says yes, and **the
  3D does not change that ordering**: a prettier board can only make the fun test easier to pass
  for the wrong reason, so watch the grades and not the graphics.
- **The visibility kernel**, if the answer was yes: one WGSL shader through wgpu, or two shaders
  held to one Rust reference. The bundle question that used to gate this is answered: wgpu is
  129 kB brotli, half what the three.js chunk already costs, so it is the cheaper route rather
  than the risky one. Section 5b.

### What this deliberately is not

Not a rewrite, not a performance fix, and not started on the game. Section 5a measured the bake
at 799 ms on a real GPU and Rust cannot improve on that. The reason to do this work is one
implementation of the science, provable against the reference that already exists.

The strongest argument for that reason arrived by accident on 2026-09-01, and it is recorded in
section 8c: a throwaway built to test a game found that the designer had been overstating light
under an array by about 23%, for months, with four test suites green. One implementation is worth
having because two implementations agreeing with each other is not evidence, and that is now a
fact about this repository rather than a principle about repositories.

The second-order cost is the part to budget for. Correcting the physics falsified a claim in
`docs/00-DECISIONS.md`, the authoritative decision record, along with the measured figures under
it and two sentences of shipped copy that told growers the opposite of what the app does. **A
physics correction is a documentation project**, and the docs that state things most confidently
are the ones that need reading first.
