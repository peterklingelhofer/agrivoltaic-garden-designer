# The bundled example garden

The app used to open on a bare starting plot over an empty grid. A visitor had to draw a plot,
place an array and wait out a bake before the product showed them anything, so every claim it
makes about light, shade and crop response was invisible until they had done the work.

It now opens on a worked example: a real `PersistedDesign`, with a `DliRaster` this simulation
baked, loaded when and only when the browser holds no design of its own. Nothing in it is a picture
of a result. The design is authored, every number is produced.

Rebuild it with `bun run bake-example`, or `node scripts/bake-example-garden.mjs --dry-run` to bake
and report without writing. `--no-cache` forces the upstream fetches, without it the archive
responses are cached under `node_modules/.cache/`, because Open-Meteo answers 429 to the third
identical request in a row and an archive year does not change between two runs. Format the result
afterwards: the written JSON is not formatted, and `bunx biome check --write public/data` does it.

Two things about running it, both learned the hard way on 2026-09-01:

- **The script fetches through the Worker proxy path**, `/api/proxy/<upstream>/...`, which several
  lookups moved behind so the Worker can identify itself to them. That path is relative and only
  resolves against a page, so in Node it threw `ERR_INVALID_URL` and the script could not bake at
  all. Its `globalThis.fetch` shim now rewrites those back to the upstream's own origin using
  `upstreamOrigin` from `src/data/http.ts`. **If another lookup moves behind the proxy, that shim
  is what has to learn about it.**
- **The written design carries `rowAzimuthDeg`, and the loader recomputes the scene extent from
  it.** `exampleGridMatches` derives `sceneExtent` from the stored arrays and compares the grid to
  the raster's, so a stored azimuth that no longer describes the same array makes
  `loadExampleGarden` return null. There is no error anywhere: the app simply opens on the empty
  starting plot. That is exactly what happened when the row-axis convention was corrected, and it
  is the failure mode to suspect if the example ever silently stops appearing.

## 1. What is authored, and what is not

Authored, in `scripts/bake-example-garden.mjs`: the site (Amherst, Massachusetts, the app's own
default), the plot boundary, one three-row south-facing array at 9 m pitch and 2.6 m clearance,
four beds, the hour the scene is posed at, and the bake resolution. That is the whole of it.

The array's rows run east-west and are spaced north-south, which is what the four bed northings are
measured against: the row centres land on -9, 0 and +9. `rowAzimuthDeg` is the direction the rows
RUN, so east-west is **90**. It read 180 until 2026-09-01, when `panelSnapshot` had its two
horizontal axes exchanged and 180 was what produced the arrangement described here. The three
rasters are byte-identical across that change, because the array itself was never wrong, only the
field naming its orientation was.

Produced, by the same modules the browser runs, loaded out of `src/` through Vite so there is no
second implementation to drift from the first:

| What | By | Result |
|---|---|---|
| site, weather, soil, hardiness, Köppen | `resolveSite` | real Open-Meteo TMY over 8 760 hours, the bundled 2023 PRISM and Beck grids read off disk |
| the light field | `runSimulation`, `cpu-reference` backend | 65 × 88 cells at 0.4 m, tregenza-mf1 sky, 1 255 binned sun directions, 2 sub-steps an hour |
| per-bed light, compliance | `bedLight`, `checkAllRegimes` | derived in the browser at load, never shipped |
| the crops in the beds | `runRecommendations` → `suggestPolycultures` → `derivePlanting` | ranked against this bake, written through the one path that refuses a planting it cannot derive |

The four beds are placed at northings −13.5, −4.5, +0.8 and +4.5 m. The rows stand at −9, 0 and
+9 and face south, so their shadows sweep north across the year: the deepest annual shade is a
little north of a row and the brightest ground under the array a little south of the next one.
One bed is outside the array entirely. That spread is the point, and the ranking reads it:

| Bed | Where | Annual mean DLI | What the pipeline planted |
|---|---|---|---|
| 1 | open sky, clear of the southernmost row | 28.6 mol/m²/d | tomato, pole bean, napa cabbage |
| 2 | between the southern and middle rows | 20.4 mol/m²/d | brussels sprouts, crimson clover, teff |
| 3 | the shade band of the middle row | 10.8 mol/m²/d | ramps, wild ginger |
| 4 | between the middle and northern rows | 20.2 mol/m²/d | brussels sprouts, crimson clover, teff |

Nobody chose those crops. A full-sun bed gets a tomato and a shade bed gets ramps because the
light gate and the polyculture scorer say so, which is the product's entire argument in one
picture.

**These are not the crops this table carried before.** The asset was baked on 2026-09-11, before the
catalogue gained teff two days later. Beds 2 and 4 had room for a third crop and now fill it with
teff, next to the brussels sprouts and crimson clover already there, beds 1 and 3 are untouched. The
`.raster` file comes back byte-identical across the rebake: the shade this picture argues from
stayed put, and only the crop set changed. **A bake is only as current as the ranking it was taken
from**: any change to the catalogue or the climate and light gates dates every shipped example,
silently, because nothing recomputes them.

## 2. The encoding, and what it costs

A `DliRaster` is 27 `Float32Array`s over the grid, plus two more per time window. Written as JSON
this example is **2.73 MB**, as raw float32 it is **603 kB**. Neither is a first-paint asset.

`AGDR v1`, written by `encodeExampleRaster` and read by `decodeExampleRaster` in
`src/data/example-raster.ts` — one module, so the format has one definition:

1. **Per-slice quantisation to 4 096 levels.** Each slice carries its own minimum and maximum.
2. **A raster-order predictor.** A cell is coded against the cell to its left, and the first cell
   of a row against the cell above it, so a smoothly varying field costs a small delta per cell.
3. **Zigzag varints with a zero-run escape.** A non-zero delta is `zigzag(delta) + 1`, one byte for
   anything within 63 steps, a token of 0 introduces a run of unchanged cells. That escape is what
   pays for the format: thirteen of the twenty-seven slices are open-sky fields with no panel above
   them, uniform across the grid, and they collapse to a handful of bytes each.

No decompression stream in the browser, and the file still gzips on the way out. Same trade as
the climate grids in `docs/STATIC-LAYERS.md`.

### Bake resolution

| Cell size | Grid | float32 | JSON | AGDR | AGDR gzipped |
|---|---|---|---|---|---|
| 0.25 m | 104 × 140 | 1 536 kB | 6.95 MB | 208.5 kB | 110.6 kB |
| **0.40 m, shipped** | **65 × 88** | **603 kB** | **2.73 MB** | **93.7 kB** | **67.1 kB** |
| 0.60 m | 44 × 59 | 274 kB | 1.24 MB | 46.6 kB | 30.6 kB |

The overlay uploads the quantity as a half-float texture and interpolates between cells, so a
coarser grid does not pixelate, what it costs is the sharpness of the shade band's edge, which is
the one thing this picture is for. 0.4 m puts 22 cells across the 9 m pitch and 4 across the 1.5 m
depth of a bed, so a bed still has a light gradient inside it rather than one value. 0.6 m puts 15
and 2. That is where the choice was made, and it is a judgement about legibility rather than a
measurement, the bytes are the measurement. This is an example, not the visitor's design, and their
own bake runs at 0.12 m.

### Quantisation

| Levels | AGDR | Worst round-trip error |
|---|---|---|
| 65 536 | 123.8 kB | 0.00028 mol/m²/d |
| **4 096, shipped** | **93.7 kB** | **0.0045 mol/m²/d** |
| 1 024 | 76.7 kB | 0.018 mol/m²/d |
| 256 | 69.4 kB | 0.072 mol/m²/d |

The error is measured, not predicted: `quantisationErrorOf` encodes and decodes and reports the
largest disagreement, so what the asset records includes the float32 storage as well as the
quantisation. Two things set the floor. `contourStep` draws iso-lines every 5 mol/m²/d on a field of
this range and the legend prints its ticks at the same interval, so 0.0045 is a thousandth of one
line. The colour ramp has 256 entries, about 0.16 mol/m²/d apart on this field, so 256 levels would
put one quantisation step on one ramp entry and band the picture, 4 096 puts sixteen levels inside
every ramp entry.

### What ships

| File | On disk | Gzipped |
|---|---|---|
| `public/data/example-garden-low.raster` | 94 352 B | 65 191 B |
| `public/data/example-garden-low.json` | 11 478 B | 2 118 B |
| `public/data/example-garden-temperate.raster` | 95 904 B | 68 493 B |
| `public/data/example-garden-temperate.json` | 12 218 B | 2 186 B |
| `public/data/example-garden-high.raster` | 100 965 B | 73 075 B |
| `public/data/example-garden-high.json` | 10 698 B | 2 035 B |
| **A visitor fetches ONE pair** | **~106-113 kB** | **~67-75 kB** |

**Only one pair is ever fetched.** What a second band costs is repository and deploy size, not load
time, which is the whole reason having more than one is affordable. They are fetched once, on first
paint, and only by a visitor with no saved design, a returning visitor requests neither.

### Which band

`example-garden-<band>.{json,raster}`, where the band comes from the visitor's own time zone through
`src/data/timezone-bands.ts`, generated from tzdb `zone.tab` coordinates by
`scripts/generate-timezone-bands.mjs`. Reading real coordinates matters: `America/Denver` and
`America/Phoenix` share a prefix and six degrees of latitude, and any table written by hand from
zone names would put them in the same band. Bands are `low` under 35 deg, `temperate` to 50, and
`high` above, 235 of 418 zones are `low`, so that is the omitted default and the table only carries
the other 183 (1.9 kB gzipped).

Bake one with `bun run bake-example -- --band=high`, then run the formatter over `public/data`: the
script writes JSON that Biome has an opinion about. `SHIPPED_BANDS` in `src/state/example.ts`
lists what actually exists, and `bandsToTry` filters to it so a band with nothing baked goes
straight to the temperate fallback instead of paying for a 404. All three ship now, so that
filter is currently guarding against a half-deployed `public/data` rather than a missing bake.

**`low` was held back for two releases and is now shipped.** Baked at Phoenix it first returned
ramps, an eastern North American woodland ephemeral, as the only crop for beds reading
40.6 mol/m²/d of full desert sun. Two defects were behind that, both since fixed: the
shade-benefit bonus was paid on site heat and water with no reference to whether the bed had any
shade in it, and `growingSeasonMeanTempC` scored a perennial over its growing window only, so the
July that would kill it was never read.

What it ships with is **one empty bed of four**, and that is the honest answer rather than a defect.
Bed 3 stands in 71 to 79 % cumulative shade, above the 0.6 `maxDesignRsr` ceiling every annual in
the catalogue carries, the only three crops with a measured ceiling above it are woodland perennials
the climate gate rules out of Phoenix on the July they would have to stand through. Nothing in a
182-crop catalogue is both that shade-tolerant and that heat-tolerant. An empty bed makes
`lightDemandClause` return null, so the narration falls back to its generic sentence instead of
asserting an ordering it cannot support.

Bergen, by contrast, came back with aronia, comfrey, red currant, sorrel, good king henry and
lemon balm across a 16.5 to 8.3 mol/m²/d gradient.

## 3. It cannot drift from the schema, and cannot drift from itself

The design is a `PersistEnvelope`, read by `decodeEnvelope` in `src/state/persist.ts` — the same
function `loadDesign` uses for a design restored from `localStorage`. There is no second decoder
and no second shape. Two things are stricter than for a saved design:

- **Any dropped field is fatal.** A stored design with one unreadable field is repaired and
  reported, an example with one is refused outright. A saved design is the visitor's work and worth
  salvaging. An example that is half itself is worse than no example.
- **The raster must belong to the design.** `exampleGridMatches` recomputes the grid the shipped
  design would be baked on today and compares it to the grid inside the shipped raster. A change
  to the scene margin, the grid sizing or the array geometry makes the pair inconsistent, and an
  overlay drawn on the wrong cells is a lie the picture tells convincingly.

Every refusal returns null and the app opens on the starting plot it always opened on, with no
light run behind it: a missing asset, a 404, an envelope this build cannot migrate, a wrong magic
number, an unknown codec, a
header whose lengths overrun the buffer, a metadata block that is not the shape it claims, or a
delta stream that does not fill every slice exactly. `src/state/example.test.ts` and
`src/data/example-raster.test.ts` cover all of them, and `e2e/example.spec.ts` covers the
unreadable asset end to end.

## 4. It is visibly an example, and it is never the visitor's

`ExampleBanner` sits over the canvas, not in the sidebar: the guided panel is already there, and
the example is the thing behind the questions rather than a second thing to dismiss. It says in
plain words that nothing on screen is yours yet, prints the provenance of the light field it is
showing, and carries one control that clears it.

Nothing about the example is written to storage. `loadExample` tells the persistence writer what is
coming before the state moves, so the writer sees the example arrive and stays quiet, the first edit
the visitor authors moves the design off the example and is saved exactly as any other edit is.
`loadExample` also refuses to run at all if the browser already holds a design, and stands down if
an edit lands while the asset is still in flight.

## 5. The camera

`src/scene/framing.ts` computes where to stand from the array's own geometry rather than storing a
pose, so the framing cannot drift from the design. At the default camera the open ground is nearly
uniform and the contours have nothing to say, the field varies across the pitch and nowhere else. So
the camera is placed on the side the panels face, 38° off the pitch axis so the rows recede rather
than stack, at 27° elevation and 1.12 times the array's longest span.

`useGuidedTour` turns that view slowly, at **2.4 degrees a second**, held in degrees per second
rather than in OrbitControls' `autoRotateSpeed`, which steps per frame: on the software
rasteriser the e2e suite runs, per-frame stepping is a tenth of the speed a visitor with a GPU
sees, and an orbit whose speed is a property of the machine is not an orbit anyone chose.

It stops on the first `pointerdown`, `wheel`, `keydown` or `touchstart`, and never restarts: the
latch is a state flag with nothing that clears it, so a re-render, a tab change or the example
being cleared cannot bring the motion back. Under `prefers-reduced-motion` the orbit never
starts, while the framing still happens — the framing is where to stand, and only the orbit is
motion.

`e2e/example.spec.ts` asserts all three by reading a strip of sky rather than the whole canvas.
Foliage has wind in its vertex shader off a shared clock, so the canvas is never twice the same
image and "the orbit stopped" cannot be asserted from it. Above the horizon there is nothing but the
Preetham sky, which is a function of the hour and the view direction, the hour is fixed by the
example, so that strip changes when and only when the camera turns.

## 6. What the rest of the e2e suite does about it

`stubUpstreams` serves an unreadable body for `**/data/example-garden-*` unless a test passes
`exampleGarden: true`. Every other spec in the suite asserts something about a design the test
itself builds, and an example loading underneath would change the plot, the DOM and every visual
baseline. It is refused rather than cleared after the fact, because clearing races the fetch.

An unreadable body rather than a 404, because a 404 puts a console error on every page in the
suite and several specs assert the absence of those.

No visual baseline moved. At the shipped comparison settings both snapshots match exactly, 0
differing pixels, at `threshold: 0`, where every sub-perceptual difference counts, `dli-overlay.png`
reports 33 031 differing pixels and a build of the commit before this work, in a throwaway worktree
against the same baseline file, reports 33 743. That residue is the rasteriser's and it predates
this change.

## 7. The contrast audit had to get sharper first

`backdropOf` in `e2e/fixtures/contrast.ts` marked an element unresolvable if any ancestor carried
a background-image, and `.canvas-host` carries the pre-paint sky gradient, so nothing drawn over
the canvas could be audited at all: the banner reported zero text elements checked, which the
collector's own floor turns into a failure rather than a pass.

A fully opaque background-color hides everything painted before it, gradients included, so it now
clears that flag, a background-image on the same element sets it again, because it paints over its
own colour. All eighteen contrast tests pass with the sharper resolver, including the self-test that
proves the audit can still fail.
