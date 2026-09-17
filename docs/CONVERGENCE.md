# The designer, the game, and the simulation they converge on

An audit of the whole repository on 2026-09-03, and the approach it recommends. Written because six
rounds of game prototype had each ended with "more game", some of that code was written by agents
running below full effort, and nobody had read what came out of them against the numbers. Read
`docs/00-DECISIONS.md` first, as always: nothing here overrides it, and section 4.3 names the two
places it would need to change.

## 0. The answer in one paragraph

Three things are converging and have to become one. The **designer** optimises a layout for a real
site. The **game** lets a person try things at that site and fail safely. What both of them are
actually running is a **simulation** of a garden under panels that is defensible from the
literature. They stay maintainable only if there is **one state model, one science, one scene and
one calendar**. Today the game carries a second of each of those four, and every defect this audit
found lives in one of the seconds. The recommendation is that the simulation becomes a MODE of the
designer: the designer's own plot, run forward one season at a time through years the site actually
had, with the ground remembering, pests pressing, and the evidence mechanic on top. The 7x7 board,
its light driver, its economy and its screen do not survive that, the rules that were right about
the science do, ported into `src/` with their units fixed and their tests moved. A game done right
is the same thing as an accurate simulation, and it is what gets people to learn this and then try
it outside, the 3D is what makes it fun to stay. Section 4 has the order. Nothing in it starts
before `rust-sim-core` has a PR.

## 1. The three forces, as the code has them today

| | the designer, `src/` | the game, `prototypes/solarpunk/play/` | the simulation both need |
|---|---|---|---|
| what it answers | what is the best layout for this site | what happens if I try this here | what happens on this ground, this year, given what grew here before |
| state | `GardenPlot`: polygonal beds, `Planting`s with sow and harvest days, arrays, irrigation, in a zustand store (`src/state/slices.ts`) | `World`: 49 `Tile`s, each an array kind, one crop, one practice and a soil memory, in a pure reducer (`game.ts`) | the designer's, plus a history |
| time | an instant (`timeUtcMillis`) for the sun and the scene, a per-crop calendar (`src/recommend/calendar.ts`), a month scrubber for the light overlay. No year two | a counter that ticks once a month and is called a season | seasons and years, with memory |
| weather | one typical year, assembled month by month from ten measured years (`assembleTypicalYear`), the other nine discarded | the same typical year, plus per-tile noise called weather | the ten measured years, drawn from |
| light | the GPU raster bake, per bed per month (`BedLight`) | closed-form infinite rows plus a finite-run sky view factor (`coarse-light.ts`, now `src/sim/testkit.ts`), within 1.1% of the bake | the bake |
| yield | the Laub curve with bands, gated on water limitation (`src/recommend/yield.ts`) | the same call | the same call, on the year's own water balance |
| water | FAO-56 balance, irrigation per bed, runoff-harvesting flags (`src/data/water.ts`, `Bed.irrigation`) | the same functions, both flags hardcoded `false` | the same functions, with the flags live |
| rotation | `rotationViolation` in `src/recommend/stages/interactions.ts:85`, fed by `historyByYear`, which `pipeline.ts:57` stubs as this year only | `refuseToPlant`, a second implementation of the same rows over `FamilyRecord` | one rule, fed by a real history |
| pests | none | dilution by unrelated green neighbours, repeats, site degree-days, suppression by companion rule kind and grade | the game's model, in years, over bed geometry |
| companions | compatibility scoring, folklore structurally unable to move a layout (Decision Record 3.4) | grade-dependent behaviour, a hidden truth for grade D and E, trials and a reveal | the game's mechanic, labelled as a hypothesis |
| scene | `src/scene/`: store-free primitives under store-bound components | the primitives, plus a second `PvArrayMesh`, `PlantInstances`, `SkyLight` and sun in `Board3D.tsx` | the designer's components |
| size | 84,319 lines, 138 test files | 5,551 lines in `play/` and 1,178 in the harness beside it, `game.ts` is 43% comment by line |  |

## 2. What the audit found

Ordered by what it costs a player. Every number was measured on 2026-09-03 with a throwaway probe
over the fixture site, `prototypes/solarpunk/fixture.ts`, so the sizes are the fixture's, the
defects are not.

### 2.1 The rules break their own units, and the tests pin the breakage

Round 8i found rotation intervals being compared in months and fixed that one. The same conflation
is in four more places, and in each the suite asserts the wrong behaviour as the intended one.

| where | what it says | what it does | measured |
|---|---|---|---|
| `game.ts:1761`, `runs: (previous?.runs ?? 0) + 1` | "seasons this family has already been taken off this tile" | increments on every MONTH a bed yields anything | a tomato bed with eight unrelated neighbours (crowding 0.11) reaches full pest pressure on its fourth month and stays there, its harvest falls from 0.99 to between 0.5 and 0.7 for the rest of the season. From month four on, the arrangement of the beds, which is the whole pest mechanic, has no effect at all |
| `game.ts:1605`, `occupiedUntil: world.season + practice.costsSeasons` | a whole-bed practice "takes the bed for a season" | one advance, which is one month, `marigold-cover-nematode`'s own text asks for 60 to 90 days | occupied for exactly one press: `[true, false, false, false]`. `game.test.ts:575` asserts this |
| `game.ts:1467`, `TRIALS_TO_REVEAL = 6` | six seasons of evidence | six months in which the bed was lit | in Amherst that is one summer, the README's "after six seasons" is one growing season |
| `game.ts:1800`, the management budget | "this season's management budget" | reset on every advance, unspent actions vanish every month |  |
| `App.tsx:661` | `wait N seasons before it grows here again` | N is `minIntervalYears` | a four-year rule reads as four seasons |

`World.season` is documented as "NOT a year". It is not a season either, it is a month, and
everything named after it inherits the mistake. There is also no crop duration anywhere: lettuce and
garlic both harvest in every in-season month, because there is no sowing, no maturity and no harvest
window. The designer has all three (`siteMaturityDays` and the crop calendar in
`src/recommend/calendar.ts`, `seasonalScale` in `src/state/season.ts`) and the game calls none of
them. That is the 8i rule broken in the other direction: not inventing science, but leaving it out.

### 2.2 Two site quantities are still the fixture's

| where | claim | reality |
|---|---|---|
| `game.ts:587`, `GROWING_MONTHS = [3, 4, 5, 6, 7, 8]` | the shade ratio is "taken over the growing months rather than the year" | over April to September at every site. `season.growingMonths` is computed at `game.ts:735`, 150 lines later in the same function, and never used here. The shade ratio is the x-axis of the Laub curve and the argument to `panelRainSplit` (`game.ts:818`), so both the yield and the rain a Phoenix bed gets are read off a Massachusetts window. On the fixture the site's own window is February to December, 0.481 against 0.500, small because the fixture is temperate, a southern-hemisphere garden is scored on its winter |
| `game.ts:1086`, `ELECTRICITY_FLOOR_KWH_PER_M2 = 72.8` | "Not invented: it is the sole-use reference the application's own land-equivalent-ratio machinery scores against" | it is that reference for the fixture site and no other: `referenceArray` (`src/sim/pv/ler.ts:31`) at latitude 42.37 gives tilt 35, pitch 6.0 m and 72.816 kWh/m2 a year. Frozen as a constant in the round that made the site variable, so a Fairbanks board earns its actions against a Massachusetts solar farm. The function is one call away |

### 2.3 The screen divides by the wrong thing

`App.tsx:848` shows a trial's mean harvest as `totalYield / seasons`. `totalYield` is summed over
every bed running the practice, `Trial.beds` exists for exactly this and is never read. One bed
shows 0.77 "against 1.00 for a bed with nothing on it", eight beds running the same practice for the
same one month show 5.63. The mechanic the game exists to test reports a number eight times too
large the moment a player paints more than one bed, and painting the board is the first thing
everybody does.

### 2.4 "Weather" is per-tile noise

`game.ts:1189`, `weatherLuck = 0.85 + 0.3 * unit(seed, index, season)`: a separate draw for every
tile every month, so two beds 6.5 m apart get different weather. It is noise labelled weather, and it
is the exact thing real variability was meant to replace. The ten measured years are
already fetched for every site and `assembleTypicalYear` (`src/data/tmy.ts:253`) keeps one month
from each and throws the rest away. A drought is one of those years. It is not a dial.

### 2.5 The invented numbers are not nine and are not in one object

`game.ts:974` says "EVERY INVENTED NUMBER IN THIS GAME, in one object" and `game.ts:989` says
"thresholds and integers rather than rates, deliberately". Outside `DIALS`, still in `game.ts`: the
weather band (0.85, 0.3), the grade C yield band (0.95 + 0.45u, line 1163), the grade C pest band
(0.75 + 0.35u, line 1356), the hidden-truth effect sizes (1.18 on yield at line 1165, 0.8 on pests at
line 1358), the prior that a folklore claim is true (0.5, line 1112), the reveal threshold (6), the
whole-bed thresholds (0.9 of the bed, 60 days, line 321), the coach thresholds (0.65 and 0.55, lines
1941 and 1947), the array geometry (2.4 m, 30 degrees, 2.8 m, pitches of 6.5 and 4.5 m), the module
(1.13 by 1.72 m, 430 Wp, 0.7, 0.05), the starting month (April, line 1067), and the 72.8 above. About
twenty-five, and most of them are rates.

One of them sets a RANKING, which is the one thing the rule written above `DIALS` forbids. A grade C
rule, "a mechanism and no measured effect", averages a 17.5% yield bonus (0.95 + 0.45 times 0.5).
Grade A `ler-cereal-legume` net of its own competition penalty applies about 1.02, and a grade D
claim is 1.18 in the half of worlds where it is true, so 1.09 in expectation. On the harvest, the
evidence order this game exists to teach is C, then D, then A.

### 2.6 The build cost charges the wrong axis

`buildDebt` (`game.ts:1278`) counts a run down a column, because `lightAt` reads runs that way. The
panel rows run east-west along a tile row (`rowAzimuthDeg: 90`), so tiles adjacent along a row hold
one continuous panel row, and tiles adjacent down a column hold parallel rows a pitch apart.
Measured: three panels down a column cost 5 actions, the same three along one row cost 9, and a
two-by-two block costs 8. Extending a row, the cheapest thing in real solar, is charged as three
separate connections, and the coach's "a run of them costs less than the same panels scattered" is
true in one direction only.

### 2.7 Duplication with the designer

Everything the game re-implemented that `src/` already had, and where the designer's version is.

| the game's | the designer's | note |
|---|---|---|
| `Board3D.tsx:471` `Sky` | `src/scene/SkyLight.tsx` | the same body, with `sunAt(location, time)` from `src/state/sun.ts` replaced by a sinusoid at `Board3D.tsx:96`. A third sun model in the repository, beside the SPA in Rust and SunCalc in the UI |
| `Board3D.tsx:242` `PanelRow` | `src/scene/PvArrayMesh.tsx` | same geometry and material calls, the physical glass the game is proud of is already at `PvArrayMesh.tsx:37` |
| `Board3D.tsx:355` `Planting` and its growth lerp | `src/scene/PlantInstances.tsx` with `seasonalScale` | the designer already grows a planting by day of year |
| `Board3D.tsx:126` `TileGround` and `soil.ts` | `src/scene/Ground.tsx` and the DLI overlay (`OverlayChannel`, `src/state/slices.ts:224`) | the soil ramp IS the light overlay, redrawn |
| `game.ts` `refuseToPlant` | `rotationViolation`, `src/recommend/stages/interactions.ts:85` | same rows, same rule, the designer's version already counts in years |
| `game.ts` `World` and `reduce` | `src/state/store.ts` | a second state model over the same nouns |
| `game.ts` `createSim` | `src/recommend/design.ts`, `src/sim/pipeline.ts` | a second orchestration of site to numbers |
| `coarse-light.ts` | the bake | deliberately second, tied to the first by `gap.test.ts`, and only needed at town scale |
| `Boot.tsx`, `site.ts` | `src/ui/SitePanel.tsx`, `useAddressSearch.ts`, `resolveSite` in the store | a second site picker |

Two of the game's claims about the designer are wrong the other way round.
`loadRotationConstraints()` "was referenced from NOWHERE in the application" (`game.ts` above
`CROP_IDS` and GAME-PORT 8g): `src/recommend/pipeline.ts` has read those rows since the repository's
first commit on 2026-07-30, and `src/ui/PlantingStep.tsx:41` reads them too. And the designer's
scene already had the physical glass, only the prototype's own earlier version had flat rectangles.

### 2.8 Tests that pass for the wrong reason

- `game.test.ts:575` "takes the bed for a season" and `:750` "builds on ground that keeps growing
  the same family" assert the month-for-season behaviour of 2.1.
- `:892` "takes its growing season from the site frost curves rather than a constant" asserts only
  that the window has between 1 and 12 months and that autumn follows spring. A constant passes.
  Nothing anywhere compares `shadeRatio` with `season.growingMonths`, which is why 2.2 was invisible.
- `:938` "scores a crop against the climate it is actually being grown in" asserts the score is
  between 0 and 1. A constant 1 passes.
- `:417` "sums its twelve months back to the figure the single annual run gives" no longer does:
  `annualAcKwhPerTile` IS the sum of the months, and the test's own comment says so. The check that
  caught an 18% error in 8f cannot catch it again.
- The suite runs on a fixture whose reference evapotranspiration is 115 mm a year against a real
  800, so its water index is never limited and the `waterLimited` branch of the yield curve, the
  single most consequential line 8i changed, is never executed by any test.

### 2.9 The repository tracks its own build output

3,401 of the 3,972 files in git are under `crates/agv-sim/target/`, the Rust build directory, 126 MB
on disk. They were added on 2026-09-01, on `main`, which is deployed. `.gitignore` names `target/`
today, so they went in around it. Every `cargo` run since has shown up as thousands of modified
files in `git status`, and any `git add -A` re-commits them. Untracked on this branch on 2026-09-03,
the files stay on disk and `bun run rust:wasm` rebuilds them.

### 2.10 The documents have outrun the code

The maintainer's working log, kept outside the repository, grew from 392 lines on 2026-08-03 to 851
on 08-10, 2,240 on 08-25, 3,636 on 08-30 and 4,391 today: a journal with a cold-start summary at the
top, and the same sprawl in prose. `docs/GAME-PORT.md` is 1,652 lines, `docs/` is 11,722. The game's
own `README.md` claims nine invented numbers in one object (2.5), a pest denominator of nine
(changed in 8h), and that nothing in it is invented, a few lines above the table that says nine
things are.

The pattern across all of it: a finding is written up at length, at the moment it is found, in the
confident voice of the decision record, and then the number underneath it moves. The 8g claim about
rotation constraints was false on the day it was written. The voice that makes these documents good
to read is what makes a wrong claim in them hard to doubt.

### 2.11 Smaller things, for whoever moves the code

- `Boot.tsx:84`: the place search has no abort, so a slow first search can land on top of a second.
- `styles.css` has no `prefers-reduced-motion` rule, the growth lerp and the wind run regardless.
- `game.ts:1067`: every world starts in April, whatever hemisphere it is in.
- `game.ts:818`: `panelRainSplit` is given the growing-season shade ratio where its parameter is
  named `annualRsr`.
- `lightAt`: a bed with a run above it and another below it sees only the one above.
- `reduce`, `crop`: changing a bed's crop drops its practice and the actions spent on it, silently.
- `App.tsx` is one 929-line component, fine for a prototype, not for anything that moves.

### 2.12 What is good, and should survive the move

- The rule **"the game holds RULES, `src/` holds SCIENCE"** is right, and it is the reason the merge
  is cheap: the science calls already exist and mostly already have the right arguments.
- **The evidence mechanic**: grade-dependent behaviour, `hiddenTruth` rolled once per world and
  never shown, trials and a reveal. 8i is right that this is the most valuable thing in the
  prototype and that the designer has no home for it yet.
- **The pest mechanism**, transcribed from `undersown-cover-host-finding`'s own mechanism text, and
  the wrong-animal rule in `pestSuppression`. Both are the corpus speaking rather than a designer.
- **Crowding kept apart from pressure** in `pestAt`, so advice names what a player can change.
- **The run-aware light** in `coarse-light.ts`, validated to 1.1% against the bake, and
  `gap.test.ts`, which is the test that found the row-axis bug. Both are in `src/sim` since
  2026-09-04, as `testkit.ts` and `gap.test.ts`.
- **The `.sr-only` tile grid**: the canvas is `aria-hidden` and every tile is a real button. That is
  the right shape for any 3D interface here, and the designer's own scene should be held to it.
- **The picture**: the designer's sky, materials, plants and colour pipeline, with
  `toneMapped={false}` on annotations. All of it came from `src/scene/` and none of it needs to go
  back.
- **`PlayContext`** as the one seam: a `Site`, a `TmySeries`, a country code. The mode below takes
  the same three things.

## 3. Why this keeps happening

Every defect in section 2 is in one of the four seconds. The second state model, where a unit
drifts between `World.season`, `Trial.seasons`, `FamilyRecord.runs` and `minIntervalYears`. The
second calendar, where a month is called a season and a window is hardcoded. The second sun, a
sinusoid beside the SPA. The second orchestration, where a site-specific reference is frozen as a
constant. A second implementation is a second place for a unit to be wrong, and a prototype that
grows for six rounds acquires its seconds one round at a time, each for a good local reason.

The other cause is effort spent in the wrong place. `game.ts` is 1,039 lines of code under 796 lines
of comment. The comments are excellent, and several describe a behaviour the code beside them does
not have (2.1, 2.2, 2.5). The tests were then written to the comments. The measurements in this
audit took an hour, the prose they contradict took far longer.

## 4. The approach: the simulation is a mode of the designer

### 4.1 What "a simulation" is here

One function, in `src/`, pure:

```
season(plot, site, year, history, seed) -> SeasonReport
```

`plot` is the designer's `GardenPlot`. `year` is one of the site's measured years, or the typical
one. `history` is what grew in each bed in each earlier year. The report says, per planting: whether
it matured inside that year's frost window (`siteMaturityDays` against that year's frost-free days),
the light it had (the bake, per bed per month), its yield band (Laub, on that year's water balance
rather than the typical one), what the pests took, what the ground now remembers, and the provenance
of every term. The designer's existing recommendation is this computation run on the typical year
with no history, the practice mode is the same computation run forward. That is the single source of
truth: not two products agreeing, but one function called twice.

### 4.2 Where each thing goes

| today | becomes | where |
|---|---|---|
| ten years fetched, nine discarded (`assembleTypicalYear`) | keep the stack, `yearSeries(stack, year)`, the series labelled `isTypicalMeteorologicalYear: false` with its year in `yearsCovered` | `src/data/tmy.ts` |
| `FamilyRecord`, `refuseToPlant` | a `BedHistory` feeding the `historyByYear` that `rotationViolation` already takes, the stub at `pipeline.ts:57` goes away | `src/recommend/stages/interactions.ts`, a history slice in `src/state` |
| `pestAt`, `pestSuppression`, `PEST_KINDS` | `src/recommend/pests.ts`, in years, over bed footprints: non-host green area within a radius rather than eight tiles. `Planting.role` (`insectary`, `trap`, `cover`) is already the vocabulary | `src/recommend` |
| `relative * practiceEffect * luck * (1 - pestLoss)` per month | `season()` per planting per year, with the calendar deciding whether there was a harvest at all | `src/recommend/season.ts` |
| `hiddenTruth`, `Trial`, `reveal` | the same, keyed by a garden seed, in a practice slice, outcomes typed as simulated hypotheses that no recommendation can consume | `src/state`, `src/recommend` |
| `coach` | a function of the `SeasonReport` | `src/ui` |
| `Board3D.tsx` | the designer's scene reading the report: `PlantInstances` already scales by day, add the starved and eaten tints | `src/scene` |
| `Boot.tsx`, `site.ts` | the designer's site panel | gone |
| the 7x7 grid, `lightAt`, `coarse-light.ts`, `loop.ts`, `harness.test.ts` | gone, `gap.test.ts` and the driver moved to `src/sim/gap.test.ts` and `src/sim/testkit.ts` on 2026-09-04 |  |
| `DIALS`, `buildDebt`, `costToPlace`, the management budget | not in the first merge, see 4.5 |  |
| the play `README.md`, GAME-PORT 8d to 8i | GAME-PORT stays as the record of what was learned, the README goes with its directory |  |

### 4.3 Two decisions the decision record has to make first

1. **A measured year may drive a yield band.** Decision Record 4 says weather input must be a TMY,
   and `docs/ARCHITECTURE.md` section 6 says `isTypicalMeteorologicalYear` must be true before a
   yield band is produced. The practice mode wants the opposite, on purpose: a year the site
   actually had, labelled as such. The resolution is that a `SeasonReport` carries its year in its
   provenance and is never presented as a recommendation, the recommendation stays on the TMY. That
   needs a numbered entry.
2. **A folklore claim may move a simulated outcome.** Decision Record 3.4 makes grade D and E rules
   structurally unable to move a layout, and the types enforce it. The evidence mechanic needs them
   to move a hidden, seeded, simulated outcome. The resolution is a distinct outcome type that no
   recommendation or score can consume, so the invariant holds where it matters and the mechanic
   exists where it is wanted. That needs an entry too, and it is where GAME-PORT section 10's
   worry about TEK material lands: a game blurs the line between "tested here" and "endorsed", so
   the label on the outcome is the product.

### 4.4 The order, each step standing alone

0. **Open the PR for `rust-sim-core`.** Unchanged, and still first.
1. **Untrack the build output.** Done on this branch (2.9).
2. **Write the two decisions** into `docs/00-DECISIONS.md`.
3. **Keep the years.** `src/data/tmy.ts` returns the stack beside the typical year, `yearSeries`,
   the driest, wettest and hottest year by the site's own balance. Tests. The designer can show "a
   dry year here looks like this" in the water panel the same day, which is the first thing a grower
   asks.
4. **`src/recommend/season.ts` and `src/recommend/pests.ts`**, pure, with the game's tests ported
   and their units fixed: seasons are years, a whole-bed practice holds the bed for its rule's own
   duration, repeats count harvests, the shade ratio is over the site's window, the sole-use floor
   is `referenceArray` at the site. The fixture gets a diurnal swing so the water-limited branch
   runs in a test.
5. **A history slice and `advanceSeason(yearChoice)`** in the store, persisted with the design.
   `historyByYear` becomes real, and the designer's own rotation check starts refusing what the
   ground refuses.
6. **The practice surface**: choose a year, advance, read the report on the scene, trial and reveal.
   The `.sr-only` discipline from the prototype applies to the designer's canvas.
7. **Delete `prototypes/solarpunk/play/`, `loop.ts` and `harness.test.ts`**, after `gap.test.ts`'s
   comparison has moved into `src/sim`. `coarse-light.ts` goes with them, GAME-PORT 8c keeps the
   finding. Done in full on 2026-09-04, when the comparison reached `src/sim/gap.test.ts`.

Steps 3 and 4 are `src/` changes with tests and no screen, which is the shape 8i said every addition
should have. Step 6 is the only one a player sees.

### 4.5 What is deliberately not in it

- **The economy.** Management actions, the build cost and the connection term rest on nine
  invented scales, and one of them charges the wrong axis. A cost model with a source can exist:
  NREL's annual PV cost benchmarks break balance of system out by system size, and
  `RuleScope.requiresManagement` already prices labour in authored entries. Until a source is cited
  a budget is a dial, and the designer does not carry dials.
- **Town scale.** `coarse-light.ts` and the harness answered whether a thousand tiles are
  affordable, and they are. A garden is what a person can go outside and build, which is the stated
  goal, so the plot is the unit and the bake is the light. If a town is ever wanted, 8c
  says what it costs.
- **A second entry point.** GAME-PORT 8b measured it at 1.2 kB. The entry point was never the cost,
  the second everything behind it is.

### 4.6 The alternatives

- **Freeze it.** Keep `prototypes/solarpunk/play/` as it is, fix nothing, stop adding. Honest and
  cheap, and it leaves the best mechanic in the repository behind a page that is never built.
- **Delete it.** Everything above is in git and in GAME-PORT. It loses nothing that cannot be
  recovered, and it loses the momentum of six rounds.
- **Keep building it as a separate game.** The one answer this audit argues against: it is the path
  that produced every defect in section 2, and every round widens the four seconds.

## 5. The documents

- The working log should shrink to its cold-start section and the invariants, under 400 lines.
  Everything below that is a journal and should be one, `docs/JOURNAL.md`, appended to and never
  read cold.
- A number in a document that can be measured should say when it was measured, and the
  measurement should be a test or a script somebody can rerun. Every claim in 2.10 would have
  failed one.
- The claims in the prototype's README and in `game.ts`'s own comments listed in 2.5 and 2.7 are
  left standing, because the directory is proposed for deletion, a note at the top of the README
  points here.

## 6. What was done, 2026-09-03

The merge was chosen and named the simulation. Steps 1 to 7 of 4.4 are
done, in four commits behind this note:

- **The years are kept.** `normaliseWeather` returns the ten measured years beside the typical
  one, with the rain that fell in them (Open-Meteo and NASA POWER now ask for it), and
  `siteForYear` turns a year into the `Site` it would have made. `resolveSite` hands both back.
- **`src/simulation/`** is the layer: `year.ts` picks a year, `history.ts` is the ground's
  memory, `pests.ts` and `evidence.ts` are the two mechanics the prototype got right with their
  units fixed, `season.ts` is the one function, `coach.ts` the sentence. Forty-eight tests, on
  a fixture with a diurnal swing. The rotation rule in `src/recommend` now matches by family,
  which it did not.
- **The store** keeps `simulation` with the design (schema 3, migrated), the sidebar has a step
  called "What happens over the years?", and the shipped examples carry the key.
- **Deleted**: `prototypes/solarpunk/play/`, `loop.ts`, `harness.test.ts`. Kept and renamed:
  `prototypes/light-harness/`, the coarse driver and `gap.test.ts`, because the comparison against
  the bake is the test that found the row-axis bug. On 2026-09-03 it was too slow to be a gate
  anywhere (33 minutes at 0.5 m cells, two of three tests over their 15-minute timeouts), on
  2026-09-04 it was measured at 2 m cells, where the same three arrays take 5.5 s and the gap moves
  by half a percent, and it moved into `src/sim/` as `gap.test.ts` with the driver and fixture as
  `testkit.ts`. `prototypes/` is gone.

Done the same day, after the merge:

- **The picture.** `PlantInstances` reads the last season's report and draws it: a frosted bed
  grey and collapsed, a starved one sallow and small, an eaten one leaning toward the colour of
  a bed the pests are winning (`outcomeLook` in `src/scene/sceneMath.ts`, reflectances only).
  The tooltip over a plant says what the last season did to it, off the same report.
- **A standing.** `src/simulation/score.ts` reads the designer's own land equivalent ratio off
  the seasons run, crop partial plus electricity partial, after five seasons and with a food
  floor of half a crop, so a solar farm cannot win it by covering every bed. The panel says it
  in a sentence.

Done later the same day, on a reading of this section and Decision Record 14 together:

- **The picture follows the season** (Decision Record 14.5), which is what item 2 below should
  have said. As written it read as a per-year light bake, and 14.1 forbids exactly that: a
  season's shade ratio is geometry off the typical year. What was actually wrong is that two
  things were saying which year it was and neither was the simulation. A season now moves the
  scene's clock to the year it ran, keeping the grower's day and hour, and the scene draws the
  garden at the greater of the slider's year and the seasons run, so a garden that has had five
  seasons is drawn five years old and one drawn at year 3 is never made younger by a season.
- **The panel teaches**, because a mode nobody can start is not a mode. Before the first season
  it says what the loop is in three sentences and then stops saying it. It names the record it
  offers extremes out of, by count and by year, rather than promising "the hottest year on
  record here" and never showing the record.
- **A blocker now carries the press that settles it.** `seasonBlocker` said what was missing beside
  a dead button, it now borrows the remedy from whichever step already owns the fix
  (`seasonRequirement` in `src/ui/requirement.ts`), so "compute the light again" here and on the
  light step are one press with one label. The one a grower actually meets is stale light, which is
  reachable in the middle of the loop the mode exists for, the first three lock the step before the
  panel is ever mounted.
- **Every season is on screen**, oldest first, one line each off `seasonLine`. The mode is a
  comparison, and until this only the newest season was shown, so the one thing it exists to
  demonstrate had to be held in the grower's head.
- **The advice reaches its bed.** `Advice.bedId` had been carried since the mode landed and read by
  nothing, the sentence that names a bed now has the press that selects it.
- **The mode had no end-to-end coverage at all**, in a repository with 222 e2e checks. All four
  personas in `e2e/first-time-user.spec.ts` now finish on the seasons step: told what it is,
  told what years they have, one press to a report on their own plantings, a second press to two
  seasons side by side. That spec is where the claim "an ordinary person gets a real garden out
  of this" is kept, and the mode is now part of the claim.

Still open, in order:

1. **The fun test**, which no code answers: a person, an hour, their own address.

Done since: `gap.test.ts` into `src/sim` (2026-09-04, above), the outcomes' shape (7.1 item 6: three
counts first, and losses before harvests in the list), and the economy, bounded, on four answers
(2026-09-04, 7.3 item 5, sources in `docs/08-economy-sources.md`).

## 7. Eight strangers tried the simulation, 2026-09-03

The maintainer asked, before running the fun test themselves, that scripted personas try
the mode, that the graphics be made as good as the designer's, and that a young child be able to
use it and learn from it. Eight personas were briefed and given a browser harness
(a Playwright visit on ANGLE Metal that walks the shipped example
to the seasons step, runs five years, and saves screenshots and every word on screen). Five
reported: a nine-year-old alone, a middle-school science teacher, a seventy-year-old allotment
gardener, a game designer, and an agrivoltaics researcher as the guardrail. Three died on the
session's rate limit before reporting: a parent with a six-year-old, a 3D artist, and an
accessibility reviewer. The answers to the three questions the trial raised: one plain
voice for everyone, all three graphics stages, readable alone at eight to ten.

### 7.1 What they found, in the order it mattered

1. **Two visits ran seasons on a sun 280 times too weak and did not know it.** One Open-Meteo 429
   sent the lookup to NASA POWER, under `community=AG` its hourly irradiance is MJ/hr and the
   decoder reads W/m², and its hourly rain is a mm/day RATE that was summed per hour. Measured
   against the live API: noon 2.34 under AG, 649.85 Wh/m² under RE, and 24 hourly rain values
   summing to 50.2 on a 2.1 mm day. The gardener saw "0 kWh" beside "63% of a solar farm's
   electricity" and "23,971 mm of rain" in the thirstiest year, and trusted nothing after it. Fixed
   on 2026-09-03: `community=RE`, the rate divided by 24, and `implausibleWeather`, a gate on annual
   sun and rain that makes a source whose year cannot have happened fall through the chain like a
   timeout. It is one more defect of the kind the log keeps recording, found the only way any of
   them has been found: by running the thing and comparing a number against another number. It is
   the first found by somebody using the app rather than by a test.
2. **The first press made the garden younger.** The example is drawn at year 3, a season wrote
   `plantYear = 1`, the biggest shrub vanished, and every persona read it as the season killing it.
   The age is now derived where the scene reads it (`gardenAge`, Decision Record 14.5).
3. **Nobody could read it.** "Plasmodiophora brassicae (clubroot) (rotation-brassica-clubroot)",
   "drawn inside the literature's 88% to 108% for 1% shade, pests took 3%, a pest rule cut the pests
   to 35% The band itself is 88-108%, 95% confidence interval", "grade E, untested, and doubted in
   this form: 5 seasons over 40 bed-seasons", "a land equivalent ratio of 1.58". The child skipped
   them, the teacher could not tell whether "cut the pests to 35%" was good or bad, the gardener
   would not repeat them over a fence. The panel is rewritten for a nine-year-old reading alone, the
   figures are the same, the Latin, the bands and the intervals sit behind a "Why?" on every row.
   The researcher's table of what each number may be called without becoming false governed the
   wording, and two of its rules are now on screen: the bug and thirst numbers say "about" and the
   Why? says they are this game's own best guess, and the food floor says it is the line we drew for
   this game.
4. **The year cards hid the hand.** "The thirstiest year on record here" and "the hottest" were both
   2016 at Amherst, and two personas ran them back to back and got the same season twice. Each card
   now names its year, its hot days and its rain, and says when it is also another card's year.
   `seasonYears` is computed when the place resolves rather than on the first press, so the cards
   can say it before anything is run.
5. **"Show me Bed 1" lit a bed and stopped.** It is now "Fix Bed 1": the bed is selected, the
   sidebar lands on the step that owns the fix, by `Advice.id`, and the plants step scrolls to
   that bed's own list, because the step lists every bed in turn and a press that landed on
   Bed 4's list after naming Bed 1 was the next thing a persona pressed and did not understand.
6. **Nothing said whether you won**, and the tally was 2,400 px of prose. The season now opens
   on three counts (harvested, died or never ripened, the ground said no), the harvest against
   last season's, and five dots for the five seasons a standing needs.
7. **The step summary said "5 seasons run" after a reset**, because the sidebar's subscription
   key did not include the season count. It does.
8. **Harvest share silently changes what it averages** (a refused planting is left out, a frosted
   one counts as zero), **the drought sign-flip never shows at Amherst** (its driest year never
   crosses the water-limited index), **a perennial is refused for not rotating**, and **the trials
   have no control group**. All four were ruled on and built on 2026-09-04, 7.3 has the rulings.

### 7.2 The graphics, in the order chosen

1. **Done.** The outcome is visible: the light overlay is not drawn while the seasons step is
   open, frost lies flat and bleached, a refused planting is bare soil, a thirsty bed's topsoil
   is paler (Decision Record 14.5).
2. **Done.** A season plays: Run sweeps the clock from the last spring frost to the day the
   grower had, the plants grow as it goes, and the outcome lands at the end
   (`ui/useSeasonSweep.ts`). It ends on the grower's day and not the first fall frost, because
   by the first fall frost every annual is past its harvest and the garden the outcome would
   land on is bare.
3. **Done.** Weather you can see, from the year's own hours: the cloud over the hour the clock
   is on, read as the clearness index of the measured sun (`src/sim/clearness.ts`), the rain
   that hour as a point cloud over the plot, and snow on the ground from the year's own normals
   rather than the typical ones (`sceneCloud`, `sceneRainMmPerHour`, `seasonYearShown`). All of
   it on the seasons step only, so the designer's pictures and their baselines are untouched.
   Heat haze was in the option's description and is not built: it would be a look with no
   number behind it.

### 7.3 The four questions, ruled on 2026-09-04

Put as a choice with the options and their costs, and built the same day. Each is one science
call and nothing is invented.

1. **Every planned planting counts in the harvest share.** `harvestIndex` is the mean of
   `realised` over every outcome in the report, so a planting the ground, the climate or the soil
   refused is a zero the same as a frosted one, because the standing it feeds is a land equivalent
   ratio and that is per bed of ground, not per successful sowing. The ground's memory is
   unchanged: it remembers only what went in. The panel says "across the N plantings you
   planned", the status line says "across all N", and the Why? under the readouts carries the
   rule. The shipped Amherst example has eleven plantings, four of which the old rule dropped from
   the mean from season 2 (three brussels sprouts after clubroot and the ramps), so its share
   moves in both directions.
2. **A perennial stays in the ground.** In `simulateSeason` a `perennial` or `woody-perennial` crop
   whose bed's memory holds the same crop in the season just gone is standing, not sown, and
   `rotationViolation` is not asked of it, in the season it is first planted the rule applies as it
   does to anything else, because a new perennial after an infected crop of the same family is a
   real rotation question and the designer asks it too. `rotationViolation` itself is untouched. The
   ramps bed is no longer told it is banned from itself for forty years.
3. **The thirstiest-year card says when the year was not dry enough.** `thirstLine` in the panel
   asks `shadeBenefitScale` (widened to take an index alone) whether the year's own water index
   clears the foot of the designer's ramp, and says either "Dry enough that shade helps the plants
   here" or the year's index against `WATER_LIMITED_INDEX` in plain words. Every year's description
   carries it, the driest card carries it as "Even this year".
4. **A trial has a control group.** `trialComparison` in `src/simulation/evidence.ts` reads, off the
   season reports, the harvested plantings of the same seasons that did not run the rule, and the
   row says what they made beside what the trying beds made, with both numbers off the same seasons,
   where every harvested planting ran it, the row says so and calls that the lesson. A Why? says why
   beds in one garden are a fairer comparison than one year against the next, and why it is still a
   hint and not proof.

5. **The economy, bounded.** Asked with the sources read first (`docs/08-economy-sources.md`): build
   it bounded, the price by US state through EIA and null everywhere else, below the standing in its
   own block, never in the verdict, the build cost as a band across all three crop-mount structures
   rather than a mapping to the array's mount. Built as `src/data/economy.ts` (the cited $/W
   figures, `buildCostUsdBand`, `electricityValueUsd`, `paybackYearsBand`),
   `src/data/retail-price.ts` (`usStateOf` off the site's TDWG level 3 code, `fetchRetailPrice`
   through the proxy, a plausibility gate of 3 to 70 cents), an `eia` Worker route that signs the
   request with `EIA_API_KEY` and caches a month, `SeasonEconomy` on the report with labour as the
   distinct `requiresManagement` tasks of the applied rules, and a "What it costs" block on the
   panel with every caveat behind Why?. Two citations were added and regenerated
   (`horowitz2020-dual-use-capital-costs`, `eia-electric-power-monthly-5-6-a`). The store fetches
   the price when the place resolves without blocking it, guarded by a token like the runs, and
   never persists it. The block is not drawn where there is neither an array nor a task.

6. **The words, again.** The grade 4-5 rewrite of 7.1 item 3 read as riddles
   ("Where the garden stands", "One field doing the work of", "the line we drew for this game").
   On 2026-09-04 every user-facing string in the app moved to `docs/VOICE.md`: plain adult
   English, literal, real terms glossed once, contractions in prose, no first person, and none of
   the contrast constructions ("x, not y", "x rather than y") or the slop tells that sheet lists.
   The figures and the citations did not move. Where this section and that sheet disagree about
   wording, the sheet wins.

Edges reported by the agents that built them, and left: a non-hardy perennial is still frost-gated
at its sow day every season, and one the frost took last season still reads as standing, because the
ground's memory carries only `harvested` and no kind (latent: no fixture has such a crop), a trial's
"after N seasons" is the persisted tally while its shares are read off the last twelve reports, and
`ruleAppliesInContext` puts `carrots-love-tomatoes` on the tomato's `tried` and not the carrot's, so
the beds "not trying it" can include the plant the saying is about. Reports persisted before the
first ruling keep their old denominators, which matters to nobody: the mode has never been deployed.

### 7.4 Six ages tried to get a garden, 2026-09-05

The next trial before the fun test called for five, eight, ten, twelve, fifteen and
eighteen year olds, each in its own browser, from a cold visit to a garden of their own, a swapped
crop and a year run. The whole of it, with the press counts, the words each age could not read,
the reading grade of every surface, the defects it turned up, the design for marking the next
step and the verdict on a model in the browser, is the newcomer audit, kept outside the repository. Its section 8 was
the order to build in, and its section 9 records what was built from it the same day: everything
but the model.

That file kept growing as the maintainer kept asking. Section 10 is their own walk of 2026-09-06 and
the weather lookup's real limits, section 11 is the audience round, four personas for the people
this is meant for, a Master Gardener, a Rutgers plant scientist, an extension educator and a market
grower, section 12 is the five things that round asked for and did not get, built the day after, and
section 13 is a critical read of whether this is ready to show, and what was done about what it
found. `docs/VALIDATION.md` came out of that last one and is the file to hand a researcher first: it
says which numbers have been checked against something outside this app and which have only ever
been checked against the app's own earlier decisions.
