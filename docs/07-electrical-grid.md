# Electrical and grid modelling: scope decision

Investigated 2026-07-30 at the user's request.

## BambooGrid: evaluated, NOT adopted

Source: `https://kickstage.com/blog/modeling-and-simulating-power-grids-in-the-browser--a-practical-guide-to-bamboogrid`,
repo `github.com/kickstage/bamboogrid`, MIT.

The article's "in the browser" framing does not survive reading the repo. Findings:

| Claim | Reality |
|---|---|
| Browser simulation | Solver is **server-side Python** (FastAPI + pandapower). Repo states the server-side pandapower `net` is the source of truth, per session, persisted in PostgreSQL, and "the browser never holds the full net" |
| Reusable component | It is a **whole Dockerised application**, not a library or npm package. No WASM solver to embed |
| PV modelling | Represents rooftop PV only as a **static generator at a fixed power setpoint**. It does not compute PV output from weather or geometry |

Abstraction level is wrong for this product. Its domain is buses, 2- and 3-winding
transformers, shunts, SVCs and IEEE 14-bus reference networks, solved with Newton-Raphson
power flow. That answers "does this network converge and what are the bus voltages". A
backyard or small-plot agrivoltaic array behind a single meter is a one-node problem where
power flow is degenerate.

DECISION: do not adopt. No dependency, no port.

## What the electricity side of this product actually needs

A single-node energy chain, not load flow. Every stage is citable and belongs in the
framework-free `src/sim`, reusing the plane-of-array irradiance the Perez 1990 transposition
already produces, so the PV yield and the ground DLI map continue to read one sky model.

1. **POA irradiance** — already implemented (`src/sim/transposition.ts`)
2. **Cell temperature** — Faiman, or the Sandia/King model. Both in pvlib, NREL-documented
3. **DC output** — PVWatts v5 DC model as the defensible default; De Soto single-diode if
   per-module fidelity is ever wanted
4. **Inverter** — Sandia/CEC inverter model. Needed for clipping, which is exactly what bites
   at the high DC:AC ratios agrivoltaic layouts tend toward
5. **Loss stack** — PVWatts defaults (soiling, wiring, mismatch, availability)
6. **Self-consumption vs export** — a household load profile against generation. This, not
   power flow, is the question a garden owner actually has

There is **no JS port of pvlib**; the ecosystem is Python and MATLAB only. Implement the same
way SPA and Perez were done: port the specific algorithms, validate against pvlib reference
values, cite the source in the corpus.

Bifacial gain and albedo are already partially handled by the inter-reflection term, though
note that term's 3-8% magnitude is UNVERIFIABLE per `docs/VERIFICATION.md`.

## Where grid modelling would become relevant

Only at farm or community scale, where interconnection studies are real. If this product ever
goes there, the right move is **export to pandapower JSON** and let users hand the design to a
real power-systems tool, rather than reimplementing load flow. BambooGrid consumes exactly
that format, so it becomes a downstream consumer rather than a dependency.

Also worth noting as a contrast: BambooGrid's architecture (authoritative server-side model,
browser holds only a projection) is the inverse of ours (static frontend, thin proxy). Ours is
correct for a single-user design tool with no shared authoritative state.

## The LER electricity term and its reference system

An LER without a stated denominator is not a number. Ours is stated verbatim in
`REFERENCE_DEFINITION` (`src/sim/pv/ler.ts`), travels on every `PvEnergyReport` as
`reference.definition`, and is rendered on the check step. LER formulation after
**Dupraz et al. 2011** (`dupraz2011-agrivoltaics`).

The denominator is a **sole-use, monoculture-equivalent fixed-tilt PV plant on the same land**:

| Term | Value |
|---|---|
| Ground cover ratio | 0.40, the conventional sole-use figure; 0.35-0.45 is carried as band width |
| Orientation | equator-facing, tilt = site latitude clamped to 10-35 deg |
| DC:AC ratio | 1.20 |
| Modules, inverter, loss stack | **identical to the agrivoltaic array** |
| Units on both sides | annual AC kWh per m2 of land, land = module aperture / GCR |

Keeping the hardware identical is deliberate: it makes the ratio isolate the agrivoltaic design
decision (pitch, tilt, clearance, tracking) rather than the module technology, which is what
Dupraz compared. Note that a default garden array at GCR 0.39 is barely thinned against this
reference, so its electricity term sits near 1; the term only falls once rows are spread for
light on the ground.

The band is built from named contributions and never asserted: the reference GCR choice
dominates (+/-12.7%), the row-shading treatment does not cancel between numerator and
denominator (+/-3%), and the cell-temperature model form is **measured** by running the whole
chain both ways rather than guessed. Weather is deliberately not a contribution: both systems
run on the same TMY, so that error cancels in the ratio.

## Missing citekeys

The corpus has `pvlib-python`, `sandia-pvpmc`, `marion2017-bifacial` and
`dupraz2011-agrivoltaics`. It does **not** have the four primary references for this chain:

- **Dobos 2014, PVWatts v5 (NREL/TP-6A20-62641)**: DC model, inverter curve, default loss stack
- **Faiman 2008**: the default cell-temperature model
- **King et al. 2004 (SAPM)**: the alternative cell-temperature model
- **King, Gonzalez, Galbraith & Boyson 2007 (Sandia inverter model)**: not implemented, named
  in this doc as the eventual upgrade

No citekey was invented for any of them. Every affected stage in `src/sim/pv/provenance.ts`
names pvlib and the Sandia PVPMC modelling guide as surrogates, both of which state the
formulae and coefficients in full, and says in its caveat that the primary is absent. Two false
citations have already been treated as release blockers here; a surrogate that admits it is
a surrogate is the correct handling, not a plausible-looking key.

## Interaction with compliance

The DC:AC ratio and DC nameplate ceiling constraints in the Massachusetts SMART regime
(2:1 and 7,500 kW DC) require a DC nameplate figure, which the chain above supplies.

`DerivedArrayMetrics.nameplateAcKw` (branded `KilowattsAc`, `src/types/pv.ts`) now carries the
inverter AC rating for every array, computed by `nameplateAcKw()` in `src/sim/pv/inverter.ts` at
`DEFAULT_DC_AC_RATIO`. That is the figure the 5 MW **AC** cap must be measured against, and
`nameplateDcKw / nameplateAcKw` is the 2:1 ratio check. Both criteria in
`checkMassachusettsSmart` are still `not-applicable` pending that wiring.
