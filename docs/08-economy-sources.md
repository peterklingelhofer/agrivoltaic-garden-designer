# Economy Sources: What Would Price the Simulation's Economy

Date of research: 2026-09-04. A research report, read-only: `00-DECISIONS.md` 14.2 still says "no
economy" and wins where this conflicts with it. Two of the four sources below were read in full,
one was reached only in part, and one could not be read at all; each says which. Written so the
four questions at the end can be ruled on without re-deriving any of it.

**Ruled on 2026-09-04, the same day**: build it, bounded; the price by US state through EIA and
null everywhere else for now; below the standing in its own block, never in the verdict; the
build cost as a band across all three crop-mount scenarios rather than a mapping to the array's
mount. Decision Record 14.2 carries the ruling; this file stays as the record of the sources.

## 1. What the app already computes an economy could hang on

Nothing about money exists anywhere in the codebase today. `src/types/units.ts` defines
`KilowattsDc`, `KilowattsAc`, `KilowattHours`, `KwhPerKwp` and nothing resembling a currency brand;
grepping `src/` and `docs/` for EIA, IEA, Eurostat, "retail price", "per kWh" or `$/kWh` returns
nothing outside this research. But three of the four inputs an economy needs are already computed
and carried on types that exist for other reasons:

- **Capacity (the "watt" a $/W figure needs).** `pvEnergyReport` (`src/sim/pv/report.ts:33-78`)
  returns a `PvEnergyReport` (`src/types/energy.ts:111-130`) carrying `nameplateDcKw`,
  `nameplateAcKw`, `annualAcKwh`, `landAreaM2`, `specificYieldKwhPerKwp`, and a `reference:
  ReferenceSystem` (the sole-use solar-farm floor `landEquivalentRatio` scores against). Each
  per-array `ArrayEnergy` (`src/types/energy.ts:77-96`) also carries `moduleCount` and
  `apertureAreaM2`. Everything Horowitz et al. 2020 prices per watt, this repository already
  measures per array.
- **Energy (the "watt-hour" a retail price needs).** `src/simulation/season.ts:367-380` calls
  `pvEnergyReport` once per season (only when `plot.arrays.length > 0`) and puts
  `energyKwh = energy.annualAcKwh` and `energyShare = annualAcKwhPerM2Land / reference.annualAcKwhPerM2Land`
  on `SeasonReport` (`src/types/simulation.ts:82-97`). `src/simulation/score.ts:47-79`
  (`standingOf`) already means these across seasons into a land-equivalent-ratio-style `Standing`.
  A year's electricity VALUE is one multiplication away from a number the season already produces.
- **Structure shape (what a crop-mount premium would key on).** `PvArray.geometry.clearanceHeightM`
  and `PvArray.tracker.mode` (`'fixed' | 'single-axis-horizontal-ns' | 'single-axis-tilted' |
  'dual-axis' | 'agro-optimised'`, `src/types/pv.ts:30-89`) are exactly the two parameters
  Horowitz et al. 2020 Table 1/Table 2 use to distinguish its three crop-mount scenarios (4.6 ft
  conventional clearance, 6.4 ft vertical, 8.2 ft reinforced-regular and tracker-stilt). No new
  field is needed to key a $/W figure off mount type; a mapping from clearance/tracker mode to
  "which Horowitz scenario" would still be a modelling choice, not a measurement (question 4 below).
- **Labour (a count, not a cost).** `RuleScope.requiresManagement: readonly string[]`
  (`src/types/companion.ts:41`, `src/types/recommend.ts:101`) is free text describing a task
  ("Undersow with a low non-host cover", `src/data/companions.ts:240`), authored per rule. The
  designer pipeline already collects the union of these strings across applied rules
  (`src/recommend/stages/interactions.ts:183`, exposed on the recommendation at
  `src/recommend/pipeline.ts:184-185`). `src/simulation/season.ts` does not currently read
  `rule.scope.requiresManagement` anywhere; the applied rules are already tracked per outcome
  (`PlantingOutcome.companions`/`.tried`), so counting their management strings is a small addition
  reusing data that already exists and is already cited, not a new invented scale.
- **The provenance mechanism itself.** `unsourcedClaim(value, justification, caveat)`
  (`src/types/cited.ts:96-101`) is the only sanctioned way to ship an uncited number; it returns
  `provenance: 'unsourced', tier: null, citations: []`. `src/data/gaps.test.ts` statically scans
  every file under `src/` for calls to `unsourcedClaim(` and fails unless the calling file is in
  `ALLOWED_UNSOURCED_SITES` (today: `src/data/catalog/schema.ts`, `src/data/water.ts`,
  `src/simulation/pests.ts`). Precedent: `PEST_YIELD_LOSS_AT_FULL_PRESSURE`
  (`src/simulation/pests.ts:94-98`), a bare `0.4 as Fraction` with a justification and a caveat.
  Any economy figure with no real source (or a sourced figure stretched past what it was measured
  for) either goes through this gate and joins the provenance ledger, or is built from
  `citedVerbatim`/`citedDerived` if a real citation actually backs it (`src/types/cited.ts:9-53`).
  Both mechanisms already exist; nothing new needs building to be honest about a gap.

## 2. The candidate figures, source by source

### 2a. Installed cost per watt, with the dual-use adder

**Source:** Horowitz, Kelsey; Ramasamy, Vignesh; Macknick, Jordan; Margolis, Robert. 2020.
*Capital Costs for Dual-Use Photovoltaic Installations: 2020 Benchmark for Ground-Mounted PV
Systems with Pollinator-Friendly Vegetation, Grazing, and Crops.* Golden, CO: National Renewable
Energy Laboratory. NREL/TP-6A20-77811. DOI 10.2172/1756713 (confirmed via the OSTI biblio record).
Read in full (20 pages plus appendix) via a solargrazing.org mirror of the PDF, since
`docs.nrel.gov` did not resolve from this environment (see `docs/00-DECISIONS.md` section 9 on the
`developer.nrel.gov` -> `developer.nlr.gov` migration; the same report is also mirrored at
`docs.nlr.gov/docs/fy21osti/77811.pdf` and `docs.nrel.gov/docs/fy21osti/77811.pdf`).

- **Headline range, verbatim (Executive Summary, p. vi):** "We estimate an installed cost premium
  of $0.07/Wdc to $0.80/Wdc for dual-use PV systems over conventional
  ground-mounted PV systems installed over bare ground. The highest premiums are for PV + crop use
  cases because of the use of modified PV support structures."
- **Benchmark basis:** a 500 kWdc system, simple average across eight US states (Oregon,
  Arizona, Michigan, Massachusetts, New York, Connecticut, California, Illinois), 2020 USD,
  installed cost only (no financing). Figure 3 (p. 11) gives every scenario:

  | Scenario | Mount | $/Wdc | Premium over Typical Fixed PV ($1.53) |
  |---|---|---|---|
  | Typical Fixed PV (baseline) | fixed, bare ground | $1.53 | - |
  | Typical 1-axis tracker PV | tracker, bare ground | $1.66 | $0.13 |
  | PV + Crops, Vertical Mount | fixed, 90 deg, bifacial | $1.83 | $0.30 |
  | PV + Crops, Tracker Stilt Mount | 2-axis tracker | $2.09 | $0.56 |
  | PV + Crops, Reinforced Regular Mount | fixed, 8.2 ft clearance | $2.33 | **$0.80** |

  The $0.80 top of the executive summary's range is exactly the reinforced-regular-mount figure
  above minus the fixed baseline; that arithmetic is independently verifiable from the chart, not
  taken on faith from the executive summary sentence alone.
- **Which cost categories move, and how (Figure 4 p. 12, Table 3 p. 13):** the crop premium is
  overwhelmingly **structural BOS ("Racking Structure") and installation labor**, plus a
  "Tracker" line item unique to the stilt-mount design; module, inverter, EPC/developer overhead,
  profit, permitting and sales tax barely move between scenarios. Table 3 gives site-preparation
  deltas as a percent of the bare-ground baseline for the crop scenario specifically: fencing +20%,
  site investigation +100%, but clearing & grubbing -50%, soil stripping -70%, grading -50%, soil
  compaction -80%, column foundation -80% (crop sites are assumed already-farmland, so several
  prep costs fall even as the structure itself costs more). Verbatim (p. 10): "the reinforced
  regular mount structure has the highest installed costs per watt owing to the use of more
  expensive heavy-duty materials... The vertical mount system has the lowest installed cost among
  the PV + crop scenarios, but it could produce less energy per rated watt because of the panel
  orientation."
- **What it does NOT cover, stated by the report itself or found by reading it:**
  - Every scenario is benchmarked at 500 kW; Figure 5 (p. 14) sweeps 200 kW to 20 MW and shows
    costs falling with scale at every point. **200 kW is the smallest system modelled**, and a
    home garden's few kW sits an order of magnitude or more below that, on the steep part of the
    curve the figure doesn't extend into. The direction is knowable (smaller costs more per watt);
    the size of that gap for a 2-5 kW array is not given anywhere in this report.
  - US only, 2020 USD, not inflation-adjusted in this report (contrast with source 2b below, which
    restates its own history in a common year). A 2026 Bergen garden gets neither this report's
    currency, its year, nor its country.
  - Verbatim (p. 9): "We have a limited number of input data points for nonconventional system
    designs in the PV + crop space, and so the costs associated with those applications are more
    uncertain."
  - No financing cost, no O&M, no revenue or yield-value figure of any kind. Verbatim (p. vi):
    "Understanding these capital costs is only a first step toward better understanding the
    economic feasibility of dual-use PV."

### 2b. The general (non-dual-use) residential/commercial cost benchmark

**Source:** Ramasamy, Vignesh; Zuboy, Jarett; Feldman, David; Narayanaswami, Meenakshi; Woodhouse,
Michael; Margolis, Robert. 2025. *Documenting 15 Years of Reductions in U.S. Solar Photovoltaic
System Costs.* Golden, CO: National Renewable Energy Laboratory. NREL/TP-7A40-92536, January 2025.
Read in full (20 pages plus appendix) via `osti.gov/servlets/purl/2522804`; also at
`docs.nrel.gov/docs/fy25osti/92536.pdf` and `docs.nlr.gov/docs/fy25osti/92536.pdf`. This is the
current edition of the annual series the task named ("Q1 2023 or later"); it restates that whole
series in constant 2024 USD, which the standalone Q1 2023 report (NREL/TP-6A20-87303) does not do,
so it was read instead of, rather than in addition to, the older single-year report.

- **Table A-1 / A-5, Q1 2024 column, 2024 USD, residential (RPV):** **$3.25/Wdc** total
  installed cost, at a benchmarked system size of **7.9 kWdc** (Table A-6), the size
  category closest to "a garden's few kW." Breakdown (Table A-5): module $0.40, inverter $0.37,
  BOS $0.62, labor $0.21, soft costs $1.64.
- **Commercial (CPV), same column:** $1.55/Wdc, but at a benchmarked size of **3,000
  kWdc (3 MW)**, ground-mounted, and per the report's own text (p. 8): "a system
  integrating sheep grazing in 2024." Utility (UPV): $1.15/Wdc at 100 MW, irrelevant
  at garden scale, included for completeness.
- **Directly answers the task's question about small systems:** yes, only the residential
  benchmark is close to garden scale, but section 2.4 (p. 5) states residential systems are
  consistently modelled as "flush-mounted systems on pitched roofs." **The residential benchmark
  is a rooftop system, not a ground-mounted or elevated structure over crops.** Neither NREL
  report alone prices what this app models: 2a prices small-scale-adjacent dual-use structures at
  500 kW+ and non-residential mounting; 2b prices residential-scale rooftop with no crops
  underneath. A garden array (small AND elevated over beds) sits in the gap between the two
  reports and has to be assembled from both, with that assembly disclosed.
- **Also present, not asked for but relevant:** Table A-2 gives levelized cost of energy, 14.6
  cents/kWh for residential in 2024 (2024 USD) - a distinct quantity from what a kWh is *worth*
  against a retail bill (source 2c), and from the year-of-actual-weather electricity a season
  report already computes.
- **What it does NOT cover:** verbatim (p. v), "These benchmarks are not intended to replace local
  or customer-specific market prices... cost benchmarks often differ from reported price data
  found in sources such as Lawrence Berkeley National Laboratory's *Tracking the Sun* series,"
  because reported prices include financing, roof upgrades and service contracts this bottom-up
  model excludes. US only.

### 2c. The value of a kWh not bought

**EIA (US):** *Electric Power Monthly*, Table 5.6.A, "Average Price of Electricity to Ultimate
Customers by End-Use Sector, by State," cents/kWh. Live table fetched at
`eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a`: data through June 2026 (released
Aug 26, 2026), e.g. residential US average 18.34 c/kWh, Massachusetts 29.61, Pennsylvania 21.73,
Hawaii 52.72 (read off the interactive web table; not independently cross-checked against a second
source). Source line on the page itself: Form EIA-861M. **Programmatic access exists**: the same
series is available through the EIA REST API (`eia.gov/opendata`, route
`electricity/retail-sales`, free API key required) or as a bulk CSV (`ELEC.zip`, updated twice
daily), so this is fetchable the way this app's other data sources are, not screen-scraping. Scope:
**US, by state, not by country** - finer-grained than this app's other geodata but narrower than
its stated scope.

**Global/per-country equivalent:** two candidates, neither clean.

- **Eurostat**, dataset `nrg_pc_204`, "Electricity prices for household consumers": EU/EEA
  countries, EUR per kWh (consumption band 2,500-4,999 kWh/year, all taxes included), updated
  twice yearly. EU average EUR 0.2896/kWh second half of 2025 (from search results; my own
  an HTTP fetch of the databrowser page at
  `ec.europa.eu/eurostat/databrowser/view/nrg_pc_204/default/table?lang=en` returned only page
  navigation chrome, no dataset content, so **the API/bulk-download mechanics were not
  independently confirmed on the dataset's own documentation**, only inferred from Eurostat's
  general platform conventions). Covers Europe; whether Norway (Bergen, this repository's own
  worked example per `docs/CONVERGENCE.md`) is carried under this specific series was not verified.
- **IEA**, "Energy Prices" / "End-Use Energy Prices" data products: claims genuinely global
  coverage, "end-user prices by sector... for 150 countries." Both HTTP fetch attempts against
  `iea.gov` product pages returned HTTP 403. From search-result summaries only: a free "Data
  Explorer" exposes a limited visual subset; full bulk data is behind a paid subscription or
  requires institutional log-in. **Not confirmed as freely and fully accessible.**
- **Net finding:** unlike Open-Meteo (global, keyless, CC BY 4.0, already the app's primary
  weather source per `docs/00-DECISIONS.md` section 9), no single free source gives a global
  per-kWh retail price. EIA is free and API-accessible but US-only; Eurostat is free but
  Europe-only and not independently confirmed here; IEA claims global coverage but is effectively
  gated. This is a real scope gap, not a research gap left open here.
- **A further, separate honesty problem this app doesn't yet model at all:** even where a retail
  price exists, "a kWh generated equals a kWh not bought" assumes full self-consumption or
  1:1 net metering. Time-of-use rates, net-metering caps and export tariffs below retail price all
  break that assumption and nothing in this corpus prices the difference.

### 2d. Dinesh & Pearce 2016

**Source:** Dinesh, Harshavardhan; Pearce, Joshua M. 2016. "The potential of agrivoltaic systems."
*Renewable and Sustainable Energy Reviews* 54: 299-308. DOI 10.1016/j.rser.2015.10.024 (this DOI
comes from search-engine synthesis and the matching EconPapers/RePEc record, not from a resolver
page or Crossref record fetched directly; **not independently confirmed**).

**Could not be read.** Three attempts: ScienceDirect abstract page returned HTTP 403; ResearchGate's
purported full-text mirror returned HTTP 403 twice; Semantic Scholar's paper page returned no
extractable content. **Full text was not reached, and no figure from it should be
used until it is.** What is known comes only from other papers' secondary summaries of it, found
via search: it is described as a modeling/review paper (using crop-growth software such as STICS,
per citing papers) whose headline economic claim is that combining PV with shade-tolerant crops can
raise a farm's economic value by "over 30%... if yield losses through shading effects are minimized
by the selection of suitable crops" - a **modeled income-increase percentage**, in the same family
as this app's own `landEquivalentRatio` framing (cited to Dupraz et al. 2011, already in
`docs/CITATIONS.md`), not a bottom-up $/W or a stated payback-in-years figure. No secondary source
surfaced either of those. It should not be treated as a payback or LCOE source without being read.

## 3. The smallest honest design

A season report could add three numbers, each hung on something the season already computes, plus
one derived from those three. **Build cost**: `nameplateDcKw * 1000 * $2.33` (the Horowitz
reinforced-regular-mount 2020 US crop premium, the fixed-tilt case closest to what this app's
arrays model by default), carried as `citedDerived` rather than `unsourcedClaim`, because the $/W
figure genuinely has a source; what's invented is only the leap from an 8-state 2020 500&nbsp;kW
benchmark to one array anywhere in the world in any year, and that leap belongs in the `derivation`
and `caveat` strings, not hidden. **A year's electricity value**: `energyKwh` times a retail
price, `citedVerbatim` from EIA where the site resolves to a US state and from Eurostat where it
resolves to an EU country, and **absent (`null`), not defaulted**, everywhere else, the same way
`rainMeasured` and `waterIndex` are already nullable rather than invented (`src/types/simulation.ts`).
**A labour count**: the number of distinct `requiresManagement` strings carried by the season's own
applied companion rules, shown as a plain integer count of named tasks, never converted to hours or
dollars, because no source in this corpus prices a wage or a task-duration (GAME-PORT 8g/8h: "there
is no labour model... in this repository at all"); this one needs no `unsourcedClaim` at all, since
it only counts text that is already authored and cited. **Payback in years**: build cost divided
by the year's electricity value, undiscounted, labelled as simple payback and nothing more; Part 2
turned up no cited discount rate or O&M figure to add rigor to, so none should be invented to make
it look more sophisticated than it is. On a panel: "Building an array like this would cost about
$4,700, our best guess from a US government report on similar setups, not a quote for your yard.
It made $340 of electricity this year, so at that rate it would take about 14 years to pay for
itself, not counting the ground it needed or anyone's time to run it. Growing this well also asked
for 3 extra jobs this season, like undersowing a cover crop; we don't know how many hours that
takes or what your time is worth, so we're not turning it into a dollar amount." Where the site has
no priced electricity region, the payback sentence simply does not render, the way an unlit bed's
energy line does not render today.

## 4. Open decisions

1. **Scope.** The only priced crop-mount source is an 8-state, 2020, 500 kW US benchmark; this
   app's stated scope is global (`docs/00-DECISIONS.md` section 1) and its worked examples include
   Bergen and Tromso. Should a build-cost figure ship everywhere with a loud caveat (the way PVWatts
   loss defaults already do), ship only where a region-appropriate figure exists at all, or not ship
   until a non-US benchmark is found?
2. **Region handling for the electricity-value and payback terms specifically.** EIA (US) and
   Eurostat (EU, not independently confirmed here) between them cover two blocks of a global app;
   IEA claims 150 countries but is gated. Is "null outside US and EU, like `rainMeasured`" the right
   answer, is a paid IEA dataset worth acquiring, or does this feature ship US/EU-only for now the
   way MA SMART compliance already ships Massachusetts-only?
3. **Placement.** Should build cost, electricity value and payback sit beside the standing
   (`src/simulation/score.ts`, next to the "fields' worth" sentence), so food, energy and money read
   together, or strictly below it as a separate, clearly optional panel? Decision Record 14.2 kept
   an invented economy away from the standing specifically; a sourced one still risks reading as
   endorsement by proximity, the same worry `docs/GAME-PORT.md` section 10 raised about folklore
   rules sitting too close to measured ones.
4. **Which mount scenario to price.** Horowitz et al. 2020 prices three different crop-mount
   structures spanning $1.83 to $2.33/Wdc, and `PvArray` already carries the two fields
   (`clearanceHeightM`, `tracker.mode`) that distinguish them, but no code maps one to the other yet.
   Should the build cost use the cheapest scenario, the one nearest the array's own clearance and
   tracker mode, or render as a band across all three the way yield already renders as a band rather
   than a point estimate?

## Sources fetched

Read in full (two large PDFs were read directly after the HTTP fetch could not extract their text):

- `https://solargrazing.org/wp-content/uploads/2021/02/Capital-Costs-for-Dual-Use-Photovoltaic-Installations.pdf` (NREL/TP-6A20-77811, full text)
- `https://www.osti.gov/servlets/purl/2522804` (NREL/TP-7A40-92536, full text)
- `https://www.osti.gov/biblio/1756713` (bibliographic confirmation, NREL/TP-6A20-77811)
- `https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a`
- `https://www.eia.gov/opendata/`

Fetched but failed or returned nothing usable:

- `https://docs.nlr.gov/docs/fy21osti/77811.pdf` (PDF text did not extract through an HTTP fetch; the solargrazing.org mirror above was used instead via direct PDF read)
- `https://docs.nrel.gov/docs/fy23osti/87303.pdf` (DNS did not resolve from this environment)
- `https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_204/default/table?lang=en` (returned only page navigation, no dataset content)
- `https://www.sciencedirect.com/science/article/abs/pii/S136403211501103X` (HTTP 403)
- `https://www.iea.org/data-and-statistics/data-product/energy-prices` (HTTP 403)
- `https://www.researchgate.net/publication/284130981_The_Potential_of_Agrivoltaic_Systems` (HTTP 403, attempted twice)
- `https://www.semanticscholar.org/paper/The-potential-of-agrivoltaic-systems-Dinesh-Pearce/c8bd5f69e186225f52289b8b9a9f347c79cafe18` (no extractable content)

A web search (not a direct fetch) supplied the Eurostat EU-average figure, the Dinesh & Pearce DOI,
and the IEA access-model description in section 2c/2d above; both are flagged in-line as
search-derived rather than independently confirmed.
