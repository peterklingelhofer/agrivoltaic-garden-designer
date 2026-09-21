# Continuous integration

> The workflow is at `.github/workflows/ci.yml` and has three jobs: `checks` (typecheck, lint,
> format, unit, build), `rust` (fmt, clippy, test, wasm) and `e2e (functional, macos)`.
>
> A fourth job, `e2e-visual`, ran the `visual` Playwright project (2 tests, 3 screenshots) on
> macOS. It was deleted on 2026-09-12, the fallback this file already named for when macOS
> minutes became the binding cost. Historical cost, from when both e2e jobs ran there: the
> functional job took 14m51s and the visual job 2m1s, about **169 billed minutes** for one push
> at the private repo's 10x macOS multiplier. The `visual` project itself stays runnable
> locally on macOS, see "Why the visual project runs on macOS" below.
>
> Two functional tests skip under the `CI` environment variable, because they wait on a settled
> GPU frame that GitHub's macOS runners do not produce:
>
> | test | file | reason |
> |---|---|---|
> | `the guided camera move runs, and the first pointer event stops it dead` | `e2e/example.spec.ts` | waits on a settled GPU frame, macOS runners have none |
> | `a wetted surface loses more to the sky occlusion than the same surface dry` | `e2e/specular-occlusion.spec.ts` | waits on a settled GPU frame, macOS runners have none |
>
> **Public since 2026-09-12.** Hosted runners are free on public repositories, so the workflow
> runs on every push. The first public run: `checks` and `rust` green, `e2e (functional, macos)`
> 216 tests in 19.8 minutes, 166 passed, 49 skipped, one failure in `e2e/persistence.spec.ts`, a
> timing race in which the boot-time site lookup's soil copy-in scheduled a save before the test
> read the storage notice. Fixed the same day in `src/state/store.ts`: the copy-in is not an edit,
> so it schedules no save and cannot displace the shipped example. The second run (c2b7f8a)
> passed that spec and lost one test to a renderer hang on the runner's virtual GPU (Metal
> command-buffer errors after a layout was applied, the browser context took nine minutes to
> close). The functional project now retries a failed test once under `CI`, and only there.

The workflow runs on every push to `main` and on every pull request. A
`concurrency` group keyed on the ref cancels superseded runs, so a rapid push sequence
only pays for the last commit. Every step below is a gate: the job fails if it fails.

## What runs

Three jobs, run in parallel because nothing in one depends on another.

**`checks` (ubuntu-latest)**

| Step | Command | What it protects |
| --- | --- | --- |
| Generated artifacts | `bun run generate` then `git diff --exit-code` | the citekey union and `docs/CITATIONS.md` against their CSL-JSON source |
| Types | `bun run typecheck` | all four TS projects (`tsc -b`) |
| Lint | `bun run lint` | Biome's rule set plus the fourteen React Compiler rules only ESLint has |
| Format | `bunx biome check .` | formatting and import order, which nothing enforced before |
| Agent model | `bun run fetch-agent-model`, cached | the sentence-embedding weights, which are gitignored and which `bun run test` now refuses to run without |
| Unit | `bun run test` | 2,245 `bun test` tests in 188 files (2026-09-12), including the layer-boundary, provenance and citekey-consistency guards. Two runs: `test:dom` for the 184 files that want a DOM (2,201 tests: 2,188 pass, 13 skip), `test:scene` for the four that must not have one (44 tests) |
| Build | `bun run build` | the production bundle |

**`rust` (ubuntu-latest)** runs `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`
and a release build for `wasm32-unknown-unknown`, all against the physics core in
`crates/agv-sim`. The crate has no dependencies, so there is nothing to install.

**`e2e-functional` (macos-latest)** runs the `functional` Playwright project: 216 tests
(2026-09-11) covering journeys, invariants, water compliance, array energy, degradation, site
search, the rendered overlay's colour against its legend, and the runtime WCAG contrast audit.
169 of them run by default, the other 47 are the agent's and skip unless `VITE_AGENT=on`. It is
on macOS rather than Linux for the GPU, which the long note in `ci.yml` measures.

**The agent's weights are fetched in `checks` only, as of 2026-09-07.** `models/` is 58 MB and
gitignored, so CI has none unless it asks. `checks` still asks, because `src/agent/model-presence.ts`
makes their absence a hard failure under `CI` rather than skipping eight unit tests, which had
left the embedding router with no coverage in the only place that gates a merge. The held-out
sets also assert `COLLAPSE_FLOOR`, an alarm for a router that has fallen over rather than a score
to tune towards.

**The e2e job doesn't fetch them any more.** `playwright.config.ts` used to build the webServer
with `VITE_AGENT=on`, which made the weights mandatory there too, it builds the way a deploy
builds now. `agent.spec.ts` skips itself, the agent halves of `a11y` and `contrast` are guarded
by `AGENT_IN_BUILD`, and 47 of the 223 functional tests skip, taking the local suite from about
2.9 minutes to 1.4. `VITE_AGENT=on bunx playwright test` restores all of it, and needs `models/`
present. Put the fetch step back in the e2e job when the flag goes back on.

`visual` (2 tests, 3 screenshots) stopped running as a CI job on 2026-09-12, it still runs
locally on macOS.

The e2e job passes `--forbid-only` so a stray `test.only` cannot narrow the suite into a
false green, and `--trace=retain-on-failure` so a red build ships a trace. The
`playwright-report/` and `test-results/` directories upload as artifacts on pass and on
fail, which is what makes a red build diagnosable without reproducing it locally.

## No job here reaches a live upstream

None of the three jobs above touch a live upstream: `e2e/fixtures/app.ts` stubs every weather,
elevation, soil and geocoding request the functional suite makes, and the unit suite never
leaves the process. `bun run verify-deploy` doesn't either, it only reads the deployed HTML and
JS over HTTP and checks the bytes are what they claim to be. `bun run verify-live [url]` is the
check that does: a real headless browser against the deployed site, production by default,
running a real place lookup, geocoder search, bake, layout search and ranking with nothing
stubbed. Run it before pointing anyone at the site and again after every deploy. It picks a
town nobody has looked up so the Worker's cache can't hide an outage, which costs about one
fresh lookup of the pooled Open-Meteo allowance, so it stays a manual check and never a cron.

## Why the visual project runs on macOS

`e2e/visual.spec.ts-snapshots/` holds three baselines, all suffixed `-darwin`. Playwright
suffixes snapshot filenames by `process.platform`, so a Linux runner looks for `-linux.png`
files that do not exist. Three options were on the table, this repo takes **(a), run the
`visual` project on macOS**.

The reasoning:

- Two of the three baselines are text and CSS gradients rendered by the browser's own
  font stack, not by the rasteriser. Those will never match between macOS and Linux no
  matter how deterministic SwiftShader is, so option (b) does not produce one portable
  set, it produces two sets that must both be refreshed for every deliberate UI change.
- Worse for (b): a contributor who changes a legend colour could regenerate the darwin
  bytes on their laptop but would have to round-trip through CI to get the linux bytes.
  Baselines that cannot be regenerated where the change is made rot, and rotted baselines
  get `--update-snapshots=all`'d into meaninglessness.
- Option (c), functional-only, gives up the only instrument that can see the three things
  with no DOM representation: the baked overlay's colour ramp applied to real cells, the
  legend gradient carrying the meaning of those colours, and the calendar swatches. The
  header comment in `e2e/visual.spec.ts` argues at length that a screenshot is the wrong
  tool for anything a selector can assert and the only tool for these three. Dropping the
  gate would concede the argument.
- `macos-latest` is arm64 on macOS 15, which is what the committed baselines were recorded
  on, so the one committed set stays authoritative and stays regenerable locally.

The cost was real: this was a private repository, so macOS minutes billed at a 10x
multiplier, for 2 tests, in a job that ran separately from the functional suite. The
documented fallback here was (c): delete the `e2e-visual` job. It was taken on 2026-09-12,
visual regressions are gated locally now, not in CI. See the note at the top of this file.

### No silent baseline writes

The visual job passed `--update-snapshots=none` while it ran in CI. Playwright's default
mode is `missing`, which writes an absent baseline to disk and, on a fresh runner with no
committed file, turns "there is no baseline" into an artifact nobody reviews. `none` made a
missing baseline a hard failure there. Only a human writes a baseline now, deliberately, with
the command below.

### Timeout headroom under software rasterisation

The visual project launches with `--use-gl=swiftshader` and `e2e/fixtures/app.ts` sets
`CANVAS_TIMEOUT_MS = 45_000` because r3f keeps the canvas at its 300x150 intrinsic size
until it has measured its host, and software first paint is slow. Measured locally against
`vite preview` under SwiftShader, the canvas becomes visible in ~105 ms and passes the
`width > 400` check in ~160 ms, and the whole 2-test visual project finishes in 20.7 s
against per-test budgets of 420 s. That is roughly two orders of magnitude of headroom, so
a CI runner several times slower than a laptop is still comfortably inside it. The job
pins `--workers=1` anyway: the bakes are CPU-bound in software, and two of them competing
for a 3-core runner is the one plausible way to eat that headroom.

### Why the visual project used to flake, and what it was not

`dli-legend-ramp` failed intermittently and was recorded as contention at `--workers=2`. It was
not. Playwright will not screenshot an element until its box is identical across two consecutive
animation frames, and it reports that as **"element is not stable"** with no image attached,
which reads nothing like the pixel mismatch it is not. Both legends sit low in a scrolling
sidebar under lists that keep growing after the thing each test waited for is finished:

- the crop picker fills from the catalogue fetch, inserting **220 px** inside `panel-bed`, which
  moves the overlay ramp from y 1351.5 to y 1571.7 in one frame
- the DLI evidence lands and each of ~140 recommendation rows gains **63 px** of caveat, well
  above the calendar legend

`status-simulation` covers the bake and `status-autorun` covers the ranking. Neither covers
either fetch, and contention only changed how often one landed inside the five-second screenshot
window. `e2e/visual.spec.ts` now waits on both as conditions. Measured after: **5 consecutive
green runs of the visual project at `--workers=2`**, where three consecutive runs failed before,
with both baselines byte-unchanged, and the full suite 115/115 in 224 s at `--workers=2` against
367 s at `--workers=1`. The visual CI job pinned `--workers=1` for the CPU reason above.

Pinning the target's POSITION is the obvious shortcut and it is wrong: both legends have
transparent backgrounds, so `position: fixed` lands them over the app header and the baseline
records the header printing through the swatches. It also captures a pinned 340x14 element as
14 px where the recorded fractional offset gives 15 px. Tried, reverted, documented in place.

## The generated-artifact drift check

`bun run generate` is two scripts:

1. `scripts/generate-citations.mjs` reads `docs/CITATIONS.csl.json` and emits
   `src/types/citation-ids.generated.ts`, a literal union of every citekey.
2. `scripts/render-citations-md.mjs` renders `docs/CITATIONS.md` from the same JSON,
   preserving the hand-written preamble and the gaps ledger.

Both outputs are committed. CI regenerates them and fails on any diff.

A unit test already pins the union to the JSON, so a stale `citation-ids.generated.ts`
would be caught. Nothing guarded the rendered Markdown. Without this check, adding a source
to the CSL-JSON and forgetting to regenerate leaves `docs/CITATIONS.md` claiming a source
count, a verification tally and a set of `backsClaims` that no longer describe the corpus,
while every test stays green. The bibliography is the provenance story for a project whose
models are only as trustworthy as their citations, so a silent divergence there is the
expensive kind. The check also catches the reverse: a hand edit to `docs/CITATIONS.md`
inside the generated region, which would be overwritten on the next `bun run generate`.

This step runs first in the `checks` job, before `typecheck`, so a stale union reports as
"run `bun run generate`" rather than as a confusing type error somewhere downstream.

## Bun, Node and caching

`package.json` pins `"packageManager": "bun@1.4.2"` and `scripts/only-bun.mjs` exits
non-zero for npm, yarn or pnpm. `oven-sh/setup-bun@v2` takes its version from the
`BUN_VERSION` workflow env rather than from the `packageManager` pin, so those two are the
one thing here that has to be changed together. Installs use `--frozen-lockfile`.

**Every script runs as `bun run <name>`, never `bun <name>`.** `bun test` and `bun build` are
bun's own test runner and bundler, and both would run happily while doing none of what this
repo's scripts of those names do. That is the single easiest way to break this workflow.

Node is still installed and still pinned to **24**, because bun does not replace it here: the
`scripts/*.mjs` tools run under node. The unit suite no longer needs it, since `bun test`
replaced vitest on 2026-09-08. `engines` requires `>=20`, but 24 is the current
Active LTS, is what the repo is developed on, and is what `@types/node@^24` describes. Testing
against 20 as well would be a matrix this project has no reason to carry: it ships a browser
bundle, not a library consumed on older runtimes.

### `@playwright/test` is pinned exactly, and why

`"@playwright/test": "1.62.0"`, with no caret. Regenerating the lockfile for the bun move
resolved it to 1.63.0, and on 1.63.0 `e2e/mobile.spec.ts` "offers the way to plant the bed it
just selected" fails every full-suite run and passes when the file runs alone. Measured rather
than guessed: three full runs failed on 1.63.0 and the same suite passed on 1.62.0 on the same
machine minutes apart, with every runtime dependency identical.

That test taps a fixed point on the canvas and expects the bed under it to select, and the
example garden opens on a slow orbit, so it assumes a camera pose rather than waiting for one.
1.63.0 appears to shift the timing enough to matter under load. **The test is the fragile
half**, the pin buys time rather than fixing anything. Unpinning means first making that tap
wait for a settled camera instead of a wall-clock moment.

One cache, plus bun's own:

- **Bun's install cache**, handled by `oven-sh/setup-bun@v2` itself.
- **Playwright browsers**, via `actions/cache`, keyed on `runner.os` and the exact
  Playwright version resolved from the installed package. A cold Chromium download
  dominates e2e runtime otherwise. On a cache hit the job still runs
  `playwright install-deps chromium` on Linux, because the system libraries live outside
  the cached directory, on macOS there are no such deps and the step is omitted.

Keying the browser cache on the resolved version rather than on the lockfile hash means a
lockfile change that does not move Playwright still hits.

## The preview server

`playwright.config.ts` starts `vite build && vite preview --port 4173` and sets
`reuseExistingServer: !process.env.CI`. GitHub Actions sets `CI=true` on every runner, so
in CI Playwright always starts its own server and fails fast if port 4173 is already bound,
rather than testing against something it did not build. The build is Rolldown and completes
in well under a second locally, so the 60 s default `webServer.timeout` is not close to
binding.

## Reproducing a failure locally

```sh
bun install --frozen-lockfile

# the checks job, in order
bun run generate && git diff --exit-code
bun run typecheck
bun run lint
bunx biome check .   # bun run check fixes the same findings in place
bun run test
bun run build

# the e2e job; CI=true reproduces the no-reuse server behaviour
CI=true bunx playwright test --project=functional --forbid-only
# the visual project: not a CI job any more, still checked here before a deliberate snapshot update
CI=true bunx playwright test --project=visual --forbid-only --update-snapshots=none --workers=1
```

### A green exit code is not proof the suite ran

Observed repeatedly on a loaded machine (load average 80-143): Playwright exited **0** having
run only 81, 91 and 8 tests out of 100, 100 and 12. No failures, no "interrupted", nothing in
the summary to say a fifth of the suite never executed. The eight workers Playwright defaulted to
starve (the config runs two on a laptop now, for the fans), and the line reporter's tail is easy
to misread as a complete summary.

Two consequences:

- **Locally on a busy machine**, drop the worker count and read per-test status rather than the
  summary line. The JSON report cannot be truncated or misread:
  ```sh
  CI=true PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/pw.json \
    bunx playwright test --workers=2 --forbid-only --update-snapshots=none --reporter=json
  node -e "const r=require('/tmp/pw.json');let n=0;const w=s=>{for(const p of s.specs||[])for(const t of p.tests||[])n+=1;for(const c of s.suites||[])w(c)};r.suites.forEach(w);console.log(n)"
  ```
- **In CI**, assert the count. `bunx playwright test --list` prints the expected total,
  compare it against the JSON report and fail on a mismatch. Trusting the exit code alone would
  let a run that skipped a fifth of the suite report green, which is the same class of hazard as
  the `--update-snapshots=missing` default that silently writes an absent baseline and passes.

For a red e2e build, download the `playwright-functional` artifact, then:

```sh
bunx playwright show-report path/to/playwright-report
bunx playwright show-trace path/to/trace.zip
```

## Updating snapshots deliberately

Only on macOS, and only when the pixel change is the point of the commit:

```sh
bunx playwright test --project=visual --update-snapshots=changed
git diff --stat e2e/visual.spec.ts-snapshots
```

Then open both images and confirm the diff is the change you made. `--update-snapshots=all`
rewrites baselines whether or not they differ and should not be used, `changed` leaves
untouched images alone, which keeps the diff reviewable.

Two failure modes are known and are not regressions, both documented in the header of
`e2e/visual.spec.ts`: a snapshot that contains a model output changes with every bake, and
a snapshot whose box is content-derived changes size by a pixel and fails hard regardless
of `maxDiffPixelRatio`. If a baseline starts flapping, the fix is to shrink or pin the
captured element, not to widen the tolerance.
