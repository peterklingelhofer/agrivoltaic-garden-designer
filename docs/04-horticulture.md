# Plant-Recommendation Engine: Horticultural & Agronomic Specification

**Document:** 04-horticulture.md
**Scope:** Evidence base and data specification for the plant-recommendation subsystem of a location-aware agrivoltaic garden designer.
**Date:** 2026-07-29

---

## 0. Framing: what makes this engine different from a generic "zone lookup"

Almost every consumer garden app filters plants by one number: the USDA hardiness zone. That is the wrong primary filter for this product, for two reasons.

1. **USDA zones encode winter survival only.** They say nothing about whether a crop can *finish* in the available season, tolerate the summer, or get enough light. For annual vegetables (the majority of a home garden) the hardiness zone is nearly irrelevant except as a proxy for season length.
2. **This is an agrivoltaic designer.** The defining constraint is *light*, and light is not a site-level constant: it is a per-cell, per-hour function of panel geometry, row pitch, tracker behaviour, and latitude. The app already has to ray-trace the array to render it. That same computation yields a spatially explicit **Daily Light Integral (DLI, mol·m⁻²·d⁻¹)** field, which is the single most decision-relevant plant filter in the system.

So the architecture below treats climate zoning as a **coarse feasibility gate** and DLI as the **primary discriminator**, with soil, season-length, and interaction constraints layered on top.

A second framing decision: **the evidence quality across these domains is wildly uneven.** Hardiness zoning is well-specified geospatial data. Per-crop DLI thresholds exist for maybe 15 species and are extrapolated for the rest. Companion planting is 90% folklore with a 10% core of real agroecology. The data model must therefore carry **provenance and evidence grade as first-class fields**, and the UI must be able to distinguish "this is measured" from "this is a plausible default."

---

## 1. Climate zoning systems

### 1.1 Summary matrix

| System | What it measures | Resolution / coverage | Machine-readable? | License | Role in this engine |
|---|---|---|---|---|---|
| **USDA PHZM 2023** | Mean annual extreme minimum temperature, 1991–2020 | 800 m raster; US + PR | Yes (GeoTIFF rasters) | US Gov / public domain | **Hard gate, perennials only** |
| **AHS Heat Zones** | Mean annual days ≥ 86 °F (30 °C) | Static map image, US | No open GIS | AHS, unclear | Recompute equivalent ourselves |
| **Sunset Climate Zones** | Composite (winter lows, summer highs, season length, humidity, marine influence) | ~45 zones, US | No | Proprietary (Sunset/Regents) | **Do not use** — no license |
| **Köppen–Geiger (Beck 2018)** | Composite temp/precip climate class | 1 km global GeoTIFF | Yes | CC (Figshare, open) | Global fallback + analogue matching |
| **RHS Hardiness Ratings** | H1a–H7, plant-side rating (absolute min temp) | Plant attribute, not a map | Partially (RHS Plant Finder) | RHS, restrictive | UK/EU display mapping |
| **Canadian PHZ (NRCan)** | Multivariate (Ouellet & Sherk model) | Raster/vector, Canada | Yes | Open Government Licence – Canada | Hard gate, Canada |
| **Australian ANHZ** | 7 zones, winter minima | Coarse map, AU | No | ANBG | Advisory only, AU |
| **GDD (base-T accumulation)** | Thermal time available | Derived from any daily T source | Yes (compute) | Depends on source | **Hard gate, annuals** |
| **Frost-free period / frost dates** | Season length + planting windows | NCEI station normals; interpolable | Yes | Public domain | **Hard gate + scheduling** |
| **Chill hours / Chill Portions** | Winter dormancy satisfaction | Derived from hourly T | Yes (compute) | Depends on source | **Hard gate, deciduous fruit** |

### 1.2 USDA Plant Hardiness Zone Map (2023)

The 2023 PHZM, released November 2023, is the first revision since 2012. It was produced jointly by USDA-ARS and the Oregon State University PRISM Climate Group. It maps the **mean annual extreme minimum temperature** over the 30-year normal period **1991–2020**, on an **800 m × 800 m grid**, interpolated from **13,412 weather stations** (up from 7,983 in the 2012 edition), covering the US and Puerto Rico. Zones are 10 °F wide and split into 5 °F **half-zones (a/b)**.

- Interactive map: <https://planthardiness.ars.usda.gov/>
- Raster downloads: <https://planthardiness.ars.usda.gov/pages/map-downloads> — national PNG maps (half zones, full zones, 2023-vs-2012 difference) at 150/300 dpi.
- **The authoritative machine-readable product** is the mean-annual-extreme-low-temperature raster set published at Ag Data Commons: <https://agdatacommons.nal.usda.gov/articles/dataset/2023_USDA_Plant_Hardiness_Zone_Map_Mean_Annual_Extreme_Low_Temperature_Rasters/25343293> and mirrored at <https://catalog.data.gov/dataset/2023-usda-plant-hardiness-zone-map-mean-annual-extreme-low-temperature-rasters>. As a US Government work it is effectively public domain.

**Implementation:** do *not* scrape the interactive site or depend on a third-party ZIP-code lookup (e.g. garden.org). Download the 800 m temperature raster once, store as Cloud-Optimized GeoTIFF, and resolve lat/lon → °F → zone/half-zone with a local point sample. This is a ~single-digit-millisecond lookup with no network dependency and no rate limit. Derive the zone label from the temperature rather than storing a zone raster, so you can also expose the raw °C/°F value (much more useful for a "how marginal is this?" indicator).

**Documented limitations that the engine must compensate for:**

- It is a **single-variable** map: mean annual extreme *minimum* temperature. It carries no information about summer heat, humidity, precipitation, season length, soil, or wind.
- It is a **mean of annual extremes**, not an absolute worst case. Roughly half of years will be colder than the zone value at some point. A plant rated exactly at your zone is a coin-flip in a bad winter.
- It is **not a climate-change product.** ARS is explicit that the 2023-vs-2012 shift reflects a change in the 30-year window and much-improved station density and interpolation, not a clean warming signal (see <https://www.ars.usda.gov/news-events/news/research-news/2023/usda-unveils-updated-plant-hardiness-zone-map/> and the methods at <https://planthardiness.ars.usda.gov/pages/map-creation>).
- 800 m grid **cannot resolve urban heat islands, cold-air drainage, or south-wall microclimates** — all of which routinely shift effective hardiness by a half to a full zone in a home garden. And in an agrivoltaic context, the panel array itself modifies the microclimate.
- **It does not apply to annual vegetables at all.** Filtering tomatoes by hardiness zone is a category error.

### 1.3 AHS Plant Heat Zone Map

The American Horticultural Society Heat Zone map, published 1997, classifies locations by the **mean annual number of days with maximum temperature ≥ 86 °F (30 °C)** — 86 °F being cited as the threshold above which cellular protein damage begins in many plants. Twelve zones: Zone 1 (<1 heat day/yr) to Zone 12 (>210 heat days/yr). The original was built from National Weather Service daily maxima for 1974–1995 (<https://www.usbg.gov/blog/heat-zones-plant-health-and-ahs-heat-zone-map>; PDF of the map at <https://www.usbg.gov/sites/default/files/2024-06/AHS-heat-zone-map.pdf>). The USBG version has been re-derived against the 1991–2020 normals.

**There is no openly licensed GIS product.** Recommendation: **compute the heat-day count yourself.** `days_tmax_ge_30C` is a trivial reduction over any daily-maximum-temperature series, and computing it from the same reanalysis you use for GDD gives you (a) global coverage, (b) a defensible provenance, (c) freedom from AHS licensing, and (d) the ability to expose the raw count rather than a bucketed zone. Label it "heat days (≥30 °C/yr), AHS-equivalent" rather than claiming to *be* the AHS zone.

Heat matters enormously for this product specifically, because **panel shade is a heat-stress mitigation.** A crop that is heat-limited in the open may be viable under partial shade. The engine should model heat as a *modifiable* constraint, not a fixed one — see §3.5.

### 1.4 Sunset climate zones

Conceptually the best of the consumer systems: 20-odd (western) to ~45 (national) zones defined by a composite of winter minima, summer maxima, season length, humidity, rainfall timing, and marine/continental influence. It is the only mainstream system that recognises that a Seattle winter low and an Albuquerque winter low imply completely different plant palettes despite similar USDA zones.

**It is proprietary.** There is no licensed digital boundary dataset available for third-party commercial use, and its coverage originated in the western US. **Recommendation: do not use Sunset zones.** Instead, take the *idea* — multi-factor climate description — and implement it with open inputs (§1.9).

### 1.5 Köppen–Geiger, Beck et al. 2018

Beck, H.E., Zimmermann, N.E., McVicar, T.R., Vergopolan, N., Berg, A., Wood, E.F. (2018). *Present and future Köppen-Geiger climate classification maps at 1-km resolution.* **Scientific Data 5:180214.** doi:10.1038/sdata.2018.214. <https://www.nature.com/articles/sdata2018214>

- **Present-day map:** 1980–2016, derived from an ensemble of four high-resolution topographically corrected climatologies.
- **Future map:** 2071–2100, ensemble of 32 CMIP5 projections under RCP8.5.
- **Format:** GeoTIFF, unsigned 8-bit, 1 km global, with a `legend.txt` mapping integer codes to Köppen symbols.
- **Download:** <https://figshare.com/articles/dataset/Present_and_future_Köppen-Geiger_climate_classification_maps_at_1-km_resolution/6396959> (openly licensed on Figshare; cite the paper).
- A corrected/extended version exists (Publisher Correction, Sci Data 2020, <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7431407/>).

**Role in the engine:** two jobs.
1. **Global fallback classification** where USDA/NRCan rasters do not reach. Köppen is genuinely global at 1 km.
2. **Climate-analogue matching.** ECOCROP (§2.9) records a Köppen zone list per species, so a Köppen code is a direct join key into a crop-suitability envelope. This is the cheapest path to non-US coverage.
3. Optionally, the **future map** enables a "will this perennial still suit this site in 2071?" advisory for orchard/perennial plantings — genuinely relevant for a 25-year solar asset.

### 1.6 RHS hardiness ratings (UK/Europe)

The RHS introduced its rating scheme in 2012. Crucially, **RHS ratings are properties of plants, not places** — there is no RHS hardiness map. Nine categories, H1a through H7, keyed to absolute minimum temperature the plant will survive:

- H1a: >15 °C (heated glasshouse / tropical)
- H1b: 10–15 °C (subtropical)
- H1c: 5–10 °C (can go outside in UK summer)
- H2: 1–5 °C (tender, tolerates low temp but not frost)
- H3: −5 to 1 °C (half-hardy)
- H4: −10 to −5 °C (hardy, average winter)
- H5: −15 to −10 °C (hardy, cold winter)
- H6: −20 to −15 °C (hardy, very cold winter)
- H7: below −20 °C (very hardy)

Reference: <https://www.rhs.org.uk/advice/rhs-hardiness-rating> and the RHS Plant Finder methodology PDF <https://www.rhs.org.uk/plants/pdfs/plant-finder/2013/008-009_plant_finder_2013.pdf>.

**The critical semantic difference:** RHS ratings are keyed to *absolute* minimum temperature; USDA zones are keyed to the *long-term average of annual extreme* minima. These are not the same statistic, and a naive H↔zone crosswalk is systematically optimistic on the USDA side. Store both as separate attributes; if you must crosswalk, do it through °C and label the result approximate. (This distinction is well-documented; see e.g. <https://en.wikipedia.org/wiki/Hardiness_zone>.)

RHS Plant Finder data is not openly licensed for bulk reuse. For a UK/EU deployment, compute an internal hardiness rating from the same absolute-minimum statistic and present it *alongside* an H-rating crosswalk with a disclaimer.

### 1.7 Canada

Canada does not use the USDA system. NRCan maintains **Canada's Plant Hardiness Site** (<https://planthardiness.gc.ca/>), based on the **Ouellet & Sherk (1967)** multivariate model — a regression combining monthly mean minimum of the coldest month, frost-free period, summer rainfall, maximum snow depth, maximum wind gust, and January rainfall. Ouellet & Sherk solved it at 640 stations and hand-interpolated separate eastern/western maps. It was recomputed with modern climate data by McKenney et al. (2001, *Can. J. Plant Sci.*, <https://cdnsciencepub.com/doi/pdf/10.4141/P00-030>), and updated again in 2025: **"Updated plant hardiness zones for Canada and assessment of change over time," Scientific Reports (2025)**, <https://www.nature.com/articles/s41598-025-00931-5>.

Downloadable datasets on the **Open Government Portal** under the Open Government Licence – Canada:
- 1967 zones: <https://open.canada.ca/data/en/dataset/b68620c1-f757-40d6-a4be-1c1a9115306f>
- Current zones: <https://open.canada.ca/data/en/dataset/adda404d-93e4-48e9-b6bf-5d1d3952ff22>

Because the Canadian model is *multivariate*, Canadian zone N and USDA zone N are not equivalent. Do not crosswalk. Serve the Canadian zone to Canadian users and gate the plant list on it directly.

### 1.8 Australia

The Australian National Botanic Gardens defines **7 zones** for Australia, on metric winter-minimum bands: Zone 1 = alpine SE Australia; Zone 2 = tablelands; Zone 3 = much of the southern half of the continent away from the coast; up to Zone 7 = northern offshore islands. The whole continent (excluding Macquarie Island) spans only about four USDA zones, roughly **USDA 7b–11**. Reference: <https://www.anbg.gov.au/gardens/research/hort.research/zones.html>.

Australia's binding constraints are heat, drought, and rainfall seasonality, not winter cold. **For AU, deprioritise the hardiness gate entirely** and lead with heat-day count, aridity, and Köppen class.

### 1.9 Growing degree days (GDD)

GDD is the correct filter for annual crops, because it answers the question hardiness zones cannot: *will this crop actually finish?*

**Standard form:**

```
GDD_day = clamp( (Tmax' + Tmin')/2 − T_base , 0, ∞ )
where Tmax' = min(Tmax, T_upper)   # upper cutoff, if the model uses one
      Tmin' = max(Tmin, T_base)    # lower clip ("horizontal cutoff")
```

Three families are in common use — **simple average with clipping**, **single-sine**, and **double-sine/double-triangle**. The sine methods interpolate a diurnal curve between Tmin and Tmax and integrate the area above T_base; they are materially more accurate when the daily range straddles the base temperature. UC IPM's single-sine is the de facto standard for pest models. See Penn State Extension, <https://extension.psu.edu/understanding-growing-degree-days>, and MRCC, <https://mrcc.geddes.rcac.purdue.edu/resources/growing-degree-day-description>.

**Base temperatures are crop-specific and must be stored per species.** Documented values:

| Crop group | T_base | Upper cutoff | Source |
|---|---|---|---|
| Sweet corn / maize | 10 °C (50 °F) | 30 °C (86 °F) | NDSU NDAWN, <https://ndawn.ndsu.nodak.edu/help-corn-growing-degree-days.html> |
| Peas (canning/fresh) | 4.5–5 °C (~40 °F) | — | Review of base/upper thresholds, *Agric. Water Manage.*, <https://www.sciencedirect.com/science/article/pii/S037837742500469X> |
| Tomato | 7–10 °C | ~30 °C | same review |
| Cool-season brassicas, lettuce, spinach | commonly 0–4.4 °C | — | OSU Croptime |
| Warm-season cucurbits, beans | commonly 10 °C | — | OSU Croptime |

The authoritative applied resource for *vegetable* GDD models is **OSU Extension EM 9305, "Vegetable degree-day models: An introduction for farmers and gardeners"** (<https://extension.oregonstate.edu/catalog/em-9305-vegetable-degree-day-models-introduction-farmers-gardeners>) and the associated **Croptime** project, which publishes cultivar-level degree-day phenology models for a set of Pacific-Northwest vegetables. A general base-temperature reference table is at <https://www.trackgdd.com/guides/gdd-base-temperatures> (secondary source — verify individual values against primary literature before shipping).

**Engine use:** store `gdd_base_c`, `gdd_to_maturity` and `days_to_maturity` per cultivar. GDD-to-maturity is strictly better than days-to-maturity because it transfers across latitudes and years; days-to-maturity is a cultivar catalogue value valid only near where it was measured. Where you only have DTM, convert it to an approximate GDD requirement using the climate of the seed company's trial region and flag the derivation.

> **Caveat:** most seed-catalogue "days to maturity" figures are *days from transplant* for transplanted crops and *days from direct sowing* for direct-sown crops, and vendors are inconsistent. The schema needs `dtm_reference: {sow|transplant}`.

### 1.10 Frost dates and frost-free period

Source of record for the US: **NOAA NCEI 1991–2020 U.S. Climate Normals**, which include freeze/frost date normals for >15,000 stations, with station lat/lon.

- Product landing: <https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals>
- Daily normals documentation (includes the freeze-date methodology): <https://www.ncei.noaa.gov/pub/data/cdo/documentation/normals-daily-1991-2020_documentation.pdf>
- Data search UI: <https://www.ncei.noaa.gov/access/search/data-search/normals-daily-1991-2020>

**Critically, the Normals do not just give "the" frost date.** They give the dates at which the probability of a freeze drops below **50, 40, 30, 20, and 10 percent** (see <https://www.ncei.noaa.gov/news/last-spring-freeze> and the Climate.gov interactive map <https://www.climate.gov/news-features/understanding-climate/interactive-map-average-date-last-spring-freeze-across-united>).

**This is a product feature, not a footnote.** The engine should expose a **risk-tolerance slider**: a conservative gardener plants tender crops after the 10%-exceedance date; an aggressive one plants at 50% and accepts a one-in-two chance of needing row cover. Every planting-calendar recommendation should be generated from a chosen exceedance percentile, and the UI should say which.

Derived quantities to store per site:
- `last_spring_freeze_p50`, `_p10`, `_p20` (0 °C and −2.2 °C thresholds)
- `first_fall_freeze_p50`, `_p10`, `_p20`
- `frost_free_days = first_fall − last_spring`
- `season_gdd_base10`, `season_gdd_base4` (accumulated between those dates)

Outside the US, derive the same statistics directly from a daily reanalysis series (§1.12) — compute the empirical exceedance curve over 30 years of ERA5-Land daily Tmin. This yields a globally consistent product and removes the station-interpolation problem entirely.

### 1.11 Chill requirement (deciduous fruit)

If the app recommends apples, pears, peaches, plums, cherries, apricots, currants, or gooseberries, **chill accumulation is a hard filter** — an insufficiently chilled tree breaks dormancy erratically, flowers poorly, and sets little fruit. Three metrics, in ascending order of physiological realism:

1. **Chilling Hours (CH), Weinberger.** Count of hours with 0 °C ≤ T ≤ 7.2 °C. Trivial to compute, universally quoted in nursery catalogues, and physiologically the weakest.
2. **Chill Units (CU), Utah model (Richardson et al. 1974).** A weighted function assigning different chilling efficiencies to different temperature bands, **including negative contributions from warm temperatures**. Better than CH but can go negative and behaves badly in mild-winter climates.
3. **Chill Portions (CP), Dynamic model (Fishman et al. 1987a,b; Erez).** Two-step: cold temperatures form a thermally labile intermediate that warm spells can destroy; once enough accumulates it converts irreversibly to a stable dormancy-breaking factor. Because the second step is irreversible, CP is robust in warm-winter climates where the Utah model collapses.

Reference: UC Davis Fruit & Nut Research and Information Center, "About Chilling Hours, Units & Portions," <https://ucanr.edu/site/fruit-nut-research-information-center/about-chilling-hoursunits-portions>.

**Model choice — the evidence is clear.** Luedeling & Brown, *"A global analysis of the comparability of winter chill models for fruit and nut trees,"* Int. J. Biometeorology (2011), <https://pmc.ncbi.nlm.nih.gov/articles/PMC3077742/>: *all* studies that have compared chill model accuracy and included the Dynamic model found it superior or equivalent to every alternative. The same paper shows the metrics are **not interconvertible**: across global sites the CH/CP ratio ranges 0–34, UCU/CP ranges −155 to +20, and UCU/CH ranges −10 to +5. See also Luedeling et al., *HortScience* 46(3):420–425 (2011), "The Dynamic Model Provides the Best Description of the Chill Process."

**Practical consequence for the engine:** you cannot store one chill number and convert. Nursery catalogues quote **chilling hours**; the science says use **chill portions**. Therefore:

- Compute **all three** metrics for the site from hourly (or hourly-interpolated) temperature.
- Store cultivar chill requirements in whatever unit the source used, with an explicit `chill_metric` field.
- Compare like-with-like. Only fall back to a regional CH↔CP ratio when the metrics mismatch, and surface a low-confidence flag when you do.
- Implementation: the Dynamic model is written from the equations of Fishman et al. 1987a,b with the constants of Erez et al. 1990, and the Utah model from the bands of Richardson et al. 1974. The **`chillR`** R package (Luedeling), <https://rdrr.io/cran/chillR/man/chilling.html>, implements all three plus hourly interpolation from daily Tmin/Tmax and is the independent implementation to compare a result against; it is GPL-3, so nothing here is copied from it.

### 1.12 Obtaining all of this from a lat/lon

| Need | Recommended source | Access | License |
|---|---|---|---|
| USDA zone | ARS 800 m extreme-min raster, local COG | Point sample | Public domain |
| Canadian zone | NRCan open dataset | Point sample | OGL-Canada |
| Köppen class | Beck 2018 1 km GeoTIFF | Point sample | Open (Figshare) |
| Daily Tmin/Tmax history (global) | **Open-Meteo Historical Weather API** (ERA5 0.25°, ERA5-Land 0.1°, from 1940/1950) | JSON over HTTP GET, **no API key** | **CC BY 4.0**, commercial use permitted with attribution |
| Long-run climate projections | Open-Meteo Climate API (1950–2050 daily) | Same | CC BY 4.0 |
| US high-res gridded climate | PRISM (OSU), Daymet (ORNL) | Bulk / THREDDS | PRISM has use restrictions; Daymet is open |
| US station freeze normals | NCEI 1991–2020 Normals | Bulk files / CDO | Public domain |
| Solar radiation for DLI baseline | NSRDB (NREL), or Open-Meteo `shortwave_radiation` | API | NSRDB open; Open-Meteo CC BY 4.0 |

**Open-Meteo is the strategic pick for the derived climate layer.** It is a plain JSON HTTP GET with **no authentication**, global 1 km-to-11 km resolution, 80+ years of reanalysis, and — decisively — **CC BY 4.0 including commercial redistribution**. See <https://open-meteo.com/en/docs/historical-weather-api>, <https://open-meteo.com/en/docs/climate-api>, and <https://open-meteo.com/en/features>. Bulk raw data is also on AWS Open Data (<https://github.com/open-meteo/open-data>) if you outgrow the API.

**Recommended derived-climate pipeline:**

```
lat/lon
  ├─ raster point-samples (cached, offline): USDA zone °C, Köppen code, [NRCan zone]
  └─ Open-Meteo Historical API: 30 yr daily Tmax/Tmin/precip/shortwave_radiation
        └─ derive, cache per H3 cell (res ~7, ≈5 km):
             • frost-date exceedance curves (p10/p20/p30/p40/p50, spring + fall)
             • frost_free_days
             • GDD accumulation curves at base 0/4.4/10 °C
             • heat_days_ge_30C            (AHS-equivalent)
             • cold_days, chill_hours, chill_units, chill_portions
             • monthly open-sky DLI (from shortwave_radiation, §3.2)
             • annual precip + seasonality index (for ECOCROP join)
```

Cache the derived bundle by H3 cell, not by exact coordinate — climate normals do not vary meaningfully at sub-kilometre scale and this collapses the cache cardinality by orders of magnitude. Microclimate adjustment (aspect, slope, urban heat, wall proximity) is then applied as a *delta* on top of the cell value.

### 1.13 Which systems actually drive filtering — the verdict

**Hard filters (a plant that fails these is excluded, not down-ranked):**

1. **Perennials and woody plants:** USDA/NRCan zone (or absolute-min °C) vs. the species' cold-hardiness limit.
2. **Deciduous fruit:** chill accumulation vs. cultivar requirement (Chill Portions preferred).
3. **Annuals:** frost-free period and season GDD vs. crop's GDD-to-maturity. This is the filter that actually matters and the one most apps omit.
4. **All plants:** modelled DLI at the planting location vs. the crop's minimum viable DLI (§3). In an agrivoltaic system this will exclude more candidates than everything above combined.

**Soft filters (down-rank, warn, or suggest mitigation):**

5. Heat days ≥30 °C vs. crop heat tolerance — *mitigable by panel shade*, so this should adjust ranking rather than exclude.
6. Köppen class vs. ECOCROP envelope — coarse plausibility, mainly useful outside the US.
7. Soil pH / drainage / texture vs. crop optima.
8. Aridity / irrigation requirement.

**Never use as a filter:** Sunset zones (unlicensed), AHS zone as such (use your own recomputed heat-day count), USDA zone for annual vegetables (category error).

---

## 2. Plant data sources

### 2.1 Evaluation matrix

Attributes scored: **HZ** hardiness zone range · **SUN** sun requirement · **DLI** quantitative light · **DTM** days to maturity · **SPC** spacing · **HW** mature height/width · **RD** root depth · **H₂O** water needs · **pH** soil pH · **NFX** N-fixing · **LIFE** annual/perennial · **EAT** edible parts

| Source | Coverage | Machine-readable | License | Attributes present | Verdict |
|---|---|---|---|---|---|
| **USDA PLANTS** | ~50k N. American taxa | Bulk CSV downloads; no official API (community APIs exist) | **Public domain** (US Gov work) | LIFE, growth habit, HZ (coarse), some SPC/H₂O/pH/NFX via Characteristics extract | **Adopt.** Taxonomic + native-status spine for NA |
| **GBIF** | ~2–3 bn occurrences | Excellent REST API + Darwin Core downloads | CC0/CC-BY/CC-BY-NC per dataset; API terms require citation | Occurrences and taxonomy only — **no cultivation traits** | **Adopt** for name resolution and realised-range checks; useless for traits |
| **Trefle** | ~400k+ species claimed | REST/JSON | Open-ish, unclear | HZ, SUN, SPC, LIFE, some soil | **Do not depend on.** Announced a shutdown May 2021, has intermittently returned in beta; the repo issue tracker documents repeated outages (<https://github.com/treflehq/trefle-api/issues/71>). Unacceptable as a runtime dependency |
| **Perenual** | ~10k species | REST/JSON, keyed, tiered | Commercial ToS, freemium | HZ, SUN, H₂O, LIFE, care text, images | Usable for **images and consumer copy**; provenance of trait values is undocumented — do not treat as evidence |
| **Permapeople** | Community, thousands | REST API + CSV | **CC BY-SA 4.0** | HZ, SUN, EAT, LIFE, some companion relations | **Adopt with care.** Genuinely open, but **share-alike is viral** — if you ingest it into a derivative database you may be obliged to redistribute under CC BY-SA. Isolate in its own table with clear licence tagging, or skip |
| **OpenFarm** | ~thousands of crop guides | Alpha REST API | CC BY-SA / open | SPC, DTM, SUN, H₂O, sowing depth | Data is thin and the project explicitly acknowledges it never reached self-sustaining traction. **Seed data only** |
| **PFAF** | ~7,000–7,400 temperate species | Web DB; **paid** downloadable editions ($30 student / $50 home / $150 commercial) | Content **CC BY-SA** (attribution + share-alike); images CC BY-NC-ND | **Best-in-class for edible/useful species:** shade tolerance codes (F/SS/FS), edibility & medicinal ratings 1–5, soil type, pH, moisture, hardiness, habit | **Adopt for forest-garden/perennial coverage** — but budget for the licence review. Share-alike + non-commercial image terms are a real constraint |
| **Wikidata** | Broad but shallow | SPARQL + REST, excellent | **CC0** | Taxonomy, common names, some HZ/EAT | **Adopt** as the multilingual common-name and identifier hub. CC0 makes it frictionless |
| **World Flora Online** | ~1.4M names | Bulk Darwin Core Archive | Open (CC BY) | Nomenclature only | **Adopt** as the taxonomic backbone alongside POWO |
| **Kew POWO** | Global vascular plants | **No public API**; extractable via the `expowo` R package to CSV; metadata CC BY (<https://www.kew.org/science/collections-and-resources/data-and-digital/terms-of-use>) | CC BY for metadata | Accepted names, distribution, some traits | **Adopt** for accepted-name arbitration and native/introduced status |
| **EOL TraitBank** | Aggregated traits | Bulk downloads + API | Mostly CC BY / CC BY-NC per record | Heterogeneous ecological traits | Marginal. Coverage of *cultivation* attributes is poor |
| **TRY** | 12M+ trait records, 280k taxa | Request-based download | **Open access data policy** since Kattge et al. 2020, *Glob. Change Biol.* 26(1):119–188 (CC BY) — but **per-request approval** and per-dataset restrictions | SLA, leaf N, height, seed mass, rooting depth, shade tolerance indices | **Adopt for ecophysiology only** (rooting depth, shade tolerance indices, canopy height). Not a horticultural database — it has almost nothing on cultivars, DTM, or spacing |
| **FAO ECOCROP** | ~2,568 crop species | CSV (`EcoCrop_DB.csv`) | FAO open data | **Climate envelope per crop:** TMIN/TMAX/TOPMN/TOPMX, RMIN/RMAX/ROPMN/ROPMX, pH min/opt/max, GMIN/GMAX (growing period days), light intensity, Köppen zones, photoperiod, latitude, altitude | **Adopt — highest value-per-byte source in this list** |
| **Gardenate** | ~100 crops × 11 climate zones | HTML only | Proprietary | Sowing calendars by month/zone | Useful as a *validation set* for your generated calendars. Do not scrape |
| **USDA / Land-Grant Extension planting calendars** | Per-state, ~50–100 crops | PDF/HTML | Public domain (US Gov) or university terms | Sow/transplant windows relative to frost dates, spacing, DTM | **Adopt.** The single best ground truth for planting windows. Manual extraction, high value |

### 2.2 FAO ECOCROP in detail

ECOCROP was built by FAO in 1999 and contains environmental requirement records for **~2,568 plant species**. Per species it stores minimum and maximum values plus optima for temperature, annual precipitation, and soil pH, along with light intensity class, Köppen zone list, photoperiod sensitivity, latitude range, altitude range, soil depth, texture, fertility, salinity, and drainage.

The parameters that matter for a suitability score:

- `TMIN`, `TMAX` — absolute temperature limits (killing / cessation)
- `TOPMN`, `TOPMX` — optimal temperature range
- `RMIN`, `RMAX`, `ROPMN`, `ROPMX` — annual rainfall absolute and optimal
- `PHMIN`, `PHMAX`, `PHOPMN`, `PHOPMX` — soil pH
- `GMIN`, `GMAX` — minimum and maximum growing-cycle length in days

The classic ECOCROP suitability algorithm is a **piecewise-linear trapezoidal membership function** per parameter — 0 outside [MIN, MAX], ramping 0→1 between MIN and OPMN, 1 across the optimum, ramping 1→0 between OPMX and MAX — with the overall suitability taken as the **minimum** across parameters (Liebig's law of the minimum). This is exactly the semantics a recommendation engine wants: it produces a graded 0–100 score *and* names the limiting factor, which is far better UX than a boolean.

**Status and access:** the original standalone database was discontinued around 2015 but remains available. Live tool: <https://ecocrop.apps.fao.org/ecocrop/srv/en/home>. FAO catalogue entry: <https://data.apps.fao.org/catalog/dataset/ecocrop>. It is also served through the **GAEZ v4** portal: <https://gaez.fao.org/pages/ecocrop>. A clean CSV extraction plus a working suitability model is maintained in the OpenCLIM repository (<https://github.com/OpenCLIM/ecocrop>, `EcoCrop_DB.csv` and `EcoCrop_DB_secondtrim.csv`) with a Zenodo release (<https://zenodo.org/records/10845193>).

**Caveats:** the data is 25+ years old, coverage of home-garden herbs and minor vegetables is patchy, values are expert-elicited rather than measured, and it is calibrated for field-scale rain-fed agriculture — so `RMIN`/`RMAX` are meaningless for an irrigated home garden and should be disabled as a filter when irrigation is specified. Its light-intensity field is a coarse ordinal class, not a DLI, and is not a substitute for §3.

### 2.3 Recommended data pipeline

```
LAYER 0 — TAXONOMIC SPINE (resolve everything to one accepted name)
  WFO (Darwin Core Archive) ∪ POWO (via expowo) → accepted_name, family, synonyms
  Wikidata (CC0) → QID, multilingual common names, external ID crosswalk
  GBIF Backbone → gbif_taxon_key for occurrence queries
  → canonical `taxon` table; every downstream row joins on taxon_id

LAYER 1 — CLIMATE ENVELOPE (per species)
  FAO ECOCROP CSV → temp/rain/pH trapezoids, GMIN/GMAX, Köppen list
  USDA PLANTS Characteristics → NA hardiness, growth habit, N-fixing, pH range
  Curated cold-hardiness overrides for the ~150 crops that actually matter
  → `climate_envelope` table

LAYER 2 — HORTICULTURAL ATTRIBUTES (per crop/cultivar) — CURATED, NOT SCRAPED
  Land-grant Extension publications  → spacing, DTM, sow/transplant windows, depth
  OSU Croptime / EM 9305             → GDD base temps and GDD-to-maturity
  FAO-56 Table 22                    → max effective rooting depth Zr, depletion p
  Seed-vendor catalogues             → cultivar DTM, mature H×W, habit
  PFAF (CC BY-SA, isolated)          → perennial/forest-garden species, shade codes,
                                        edibility ratings
  → `crop` and `cultivar` tables. This layer is HAND-CURATED for a core set of
    ~150–250 crops. There is no shortcut. Every open source above is either too
    shallow, too unreliable, or wrongly scoped for this layer.

LAYER 3 — LIGHT (per crop)
  Published DLI experiments (Tier A, ~15 species)
  Agrivoltaic / shade-cloth % trials (Tier B, ~30 species)
  Sun-hour class → DLI conversion model (Tier C, remainder)
  → `light_requirement` table with dli_min, dli_target, dli_max, evidence_tier

LAYER 4 — INTERACTIONS (pairwise)
  Curated from primary literature only, with evidence grading (§4)
  → `plant_interaction` table

LAYER 5 — SITE (per lat/lon, cached by H3 cell)
  Rasters: USDA/NRCan zone, Köppen
  Open-Meteo: derived frost/GDD/chill/heat/DLI bundle
  SoilGrids (global, CC BY 4.0) or USDA SSURGO (US, public domain) for pH,
    texture, drainage  [VERIFY licence terms before shipping]
  → `site_climate` table
```

**The honest conclusion on data sourcing:** there is **no single open, machine-readable, well-licensed database of horticultural crop attributes.** Every project that has tried to build one — Trefle, OpenFarm, Practical Plants — has either stalled or gone dark. The realistic plan is:

- **Open sources for the spine** (taxonomy, geography, climate envelopes) — WFO/POWO/Wikidata/GBIF/ECOCROP/USDA PLANTS. All well-licensed, all genuinely reusable.
- **Hand-curated, citation-bearing rows for the horticultural layer**, seeded from public-domain Extension publications. ~200 crops is a few person-weeks of careful work and gives you a defensible, ownable asset that none of your competitors have.
- **Never** put a community-wiki value into a hard filter without a citation field.

**Licence hygiene:** tag every attribute row with `source_id` and `license`. CC BY-SA sources (PFAF, Permapeople, OpenFarm) are **viral** and can contaminate a proprietary database — keep them in physically separate tables, and gate whether they are consulted at all behind a build flag so you can ship a CC-BY-SA-free build if commercial terms require it.

---

## 3. Light requirements: from "part shade" to DLI

### 3.1 Why the garden labels are not usable as-is

Extension and nursery labels are defined in **hours of direct sun**, and the definitions are roughly consistent across sources:

| Label | Hours of direct sun/day | Notes |
|---|---|---|
| Full sun | ≥ 6 h (many crops do better at 8–10 h) | |
| Part sun | 4–6 h | Emphasis on tolerating some direct sun |
| Part shade | 4–6 h, but preferentially **morning** sun | Same hours as part sun; the distinction is heat, not light |
| Full shade | ≤ 2 h direct sun | Usually bright indirect / dappled |
| Dappled shade | Filtered through a canopy all day | |

(See e.g. Old Farmer's Almanac <https://www.almanac.com/shade-garden-and-plant-shade-definitions> and Proven Winners <https://www.provenwinners.com/learn/finding-right-plant/what-does-full-sun-or-part-shade-mean>.)

These labels fail badly for an agrivoltaic designer for three reasons:

1. **They ignore diffuse light.** A plant under a fixed-tilt PV row in overcast Ohio may receive zero hours of *direct* beam and still get 12 mol·m⁻²·d⁻¹ of diffuse and reflected PAR — enough for lettuce. "Full shade" is a wildly misleading label for that cell.
2. **They ignore latitude and season.** Six hours of June sun in Minneapolis and six hours of December sun in Minneapolis differ by roughly a factor of four in delivered photons.
3. **Panel shade is intermittent, not constant.** A single-axis tracker sweeps a moving shadow. A row-gap cell may get full sun for 90 minutes, deep shade for 30, repeatedly. Hour-counting is meaningless here; only an integral is meaningful.

**Daily Light Integral solves all three.** DLI = total photosynthetically active photons (400–700 nm) delivered per m² per day, in mol·m⁻²·d⁻¹. It is an integral, so it handles intermittency, diffuse light, and seasonality natively. And it is exactly what the app's ray-tracer already computes.

### 3.2 Computing DLI

**From measured/modelled PPFD:**

```
DLI (mol·m⁻²·d⁻¹) = Σ over day of PPFD(t) [µmol·m⁻²·s⁻¹] × Δt [s] × 1e-6
```

**From broadband shortwave irradiance** (what Open-Meteo / NSRDB / PRISM give you):

```
PAR_energy   ≈ 0.45–0.50 × shortwave_irradiance      (fraction of SW that is 400–700 nm)
PPFD         ≈ PAR_energy [W·m⁻²] × 4.57             (µmol·J⁻¹ for daylight spectrum)
DLI_open_sky = Σ PPFD × Δt × 1e-6
```

The 4.57 µmol·J⁻¹ conversion and the ~0.45–0.5 PAR fraction are the standard horticultural approximations; see Virginia Cooperative Extension SPES-720, *"Calculating and Using Daily Light Integral (DLI): An Introductory Guide"*, <https://www.pubs.ext.vt.edu/SPES/spes-720/spes-720.html>, and Purdue HO-238-B-W, *"Measuring Daily Light Integral (DLI)"*, <https://mdc.itap.purdue.edu/item.asp?Item_Number=HO-238-B-W> (Torres & Lopez).

**Reference DLI surface for the US:** Faust, J.E. & Logan, J. (2018). *"Daily Light Integral: A Research Review and High-resolution Maps of the United States."* **HortScience 53(9):1250–1257.** <https://journals.ashs.org/view/journals/hortsci/53/9/article-p1250.xml>. Twelve monthly high-resolution national DLI maps derived from 1998–2012 solar radiation data. Overview and map access: <https://endowment.org/news/daily-light-integral-maps-for-the-u-s> and <https://ag.tennessee.edu/news/Pages/NR-2018-08JoanneLoganMapWin.aspx>. Equivalent products now exist for other regions (e.g. Spain, <https://www.sciencedirect.com/science/article/pii/S2772375524002867>).

> **Verification note:** the ASHS full text returns HTTP 403 to automated fetch. The bibliographic details, method (1998–2012 solar radiation data, twelve monthly maps), and authorship are confirmed from multiple secondary sources listed above; the specific numeric contour values in the published maps were **not** directly verified for this document. Obtain the PDF before hard-coding any map-derived constants.

**Use Faust & Logan as the validation reference, not the runtime source.** At runtime, compute `DLI_open_sky` per month from Open-Meteo's `shortwave_radiation` (CC BY 4.0, global, no key) so that you get worldwide coverage with one code path, and check the US output against Faust & Logan's maps as a regression test.

### 3.3 From open-sky DLI to in-garden DLI

```
DLI_cell = DLI_open_sky × T_cell

T_cell = transmittance of the cell, from the ray-tracer, integrating:
           • beam blocking by PV modules over the day (and by tracker angle)
           • diffuse sky view factor (the fraction of hemisphere not occluded)
           • ground/module albedo re-reflection (small but non-zero, ~2–8%)
           • shading by neighbouring plants (canopy footprints, §5.2)
```

This is the central computation of the whole product. It must be run per garden cell, per month.

**Approximate conversion of the legacy labels**, for populating Tier-C defaults and for translating third-party plant data. Assume a mid-latitude temperate summer with `DLI_open_sky ≈ 40 mol·m⁻²·d⁻¹` and a diffuse fraction of ~0.35:

| Label | ≈ T_cell | ≈ Summer DLI (mol·m⁻²·d⁻¹) | ≈ Winter/shoulder DLI |
|---|---|---|---|
| Full sun | 0.85–1.00 | 34–40 | 8–15 |
| Part sun | 0.55–0.75 | 22–30 | 5–10 |
| Part shade | 0.40–0.60 | 16–24 | 4–8 |
| Dappled shade | 0.25–0.40 | 10–16 | 2–5 |
| Full shade | 0.10–0.25 | 4–10 | 1–3 |

**This table is a derivation, not a citation.** It is arithmetic on the standard label definitions plus a typical diffuse fraction. Label it as such in the code. The point of the product is that you never have to use it for the user's actual site — you ray-trace instead.

### 3.4 DLI classification bands

Torres & Lopez's widely used greenhouse classification (Purdue/MSU Extension; see <https://www.greenhousemag.com/article/2025-lighting-market-report-measuring-daily-light-integral-greenhouse-production-/> and the DLI requirements list at <https://www.canr.msu.edu/resources/dli-requirements>):

| Class | DLI (mol·m⁻²·d⁻¹) |
|---|---|
| Low light | 3–6 |
| Medium light | 6–12 |
| High light | 12–18 |
| Very high light | > 18 |

Runkle (MSU) gives the commercial rule of thumb that most **ornamental** crops target **≥ 10–12 mol·m⁻²·d⁻¹**, and that **vegetable crops are typically higher** (<https://gpnmag.com/article/daily-light-integral-defined/>, <https://www.canr.msu.edu/uploads/resources/pdfs/doyouknowwhatyourdliis.pdf>). For **transplant/propagation** phases the consensus target is **8–10 mol·m⁻²·d⁻¹** during root development (Torres & Lopez, Purdue Vegetable Crops Hotline, <https://vegcropshotline.org/article/managing-daily-light-integral-to-improve-vegetable-transplant-quality/>).

An important **upper** bound also exists: Cornell work found that a sustained DLI above **17 mol·m⁻²·d⁻¹** for more than three consecutive days induces **tipburn in lettuce**. DLI is not monotonically good; the schema needs `dli_max_before_disorder` for the crops where this is documented.

### 3.5 Shade tolerance and the agrivoltaic-specific evidence

This is where the product's core claim lives, so it deserves care.

Documented findings from the agrivoltaic literature:

- **Lettuce is the most shade-tolerant common crop; maize is the most shade-susceptible.** Some lettuce cultivars yield *more* under partial PV shade than in the open; others are unchanged.
- **~50% shading is the approximate tipping point** at which even shade-tolerant crops such as lettuce and potato begin to lose yield (attributed in the agrivoltaic reviews to Beck et al. 2012).
- **C3 cereals are shade-tolerant up to about 50% reduction in solar radiation and shade-sensitive beyond that.** Forages are shade-*benefiting* up to ~25% and shade-tolerant above that.
- The mechanism for the frequent *positive* response is **reduced heat stress and reduced evaporative demand**, not more light — which is why the benefit is concentrated in hot, high-irradiance, water-limited settings and in summer, and reverses in cool, cloudy, or shoulder-season conditions.

Primary/review sources: *"Climatic and design tipping points in agrivoltaic crop production systems. A meta-analysis,"* Agronomy for Sustainable Development (2025), <https://link.springer.com/article/10.1007/s13593-025-01060-z>; *"Optimizing agrivoltaic systems: A comprehensive analysis of design, crop productivity and energy performance in open-field configurations,"* Applied Energy (2025), <https://www.sciencedirect.com/science/article/pii/S0306261925004805>; and pv magazine's summary of the leafy-green/root-crop findings, <https://www.pv-magazine.com/2020/06/08/agrivoltaics-works-better-with-leafy-greens-root-crops/>.

> **Verification note:** the Springer article is paywalled to automated fetch (303 to an IdP). The tipping-point figures above are reported consistently across the review literature but the exact meta-analysis sample sizes and confidence intervals were **not** directly verified here. Obtain the full text before quoting effect sizes in the product UI.

**Three design consequences:**

1. **Shade tolerance is conditional on climate, not intrinsic.** The same crop at the same shade fraction can gain yield in Arizona and lose it in Maine. `shade_response` must be a *function* of (shade fraction, heat days, water status), not a scalar. At minimum, store separate optima for hot/arid vs. cool/humid contexts.
2. **The relevant threshold is shade fraction relative to the local open-sky DLI**, which is why DLI is the right unit: a 40% shade fraction in Phoenix still leaves 30+ mol·m⁻²·d⁻¹ (plenty for tomato), while 40% in Seattle in April leaves ~7 (lettuce only).
3. **Season matters more than annual average.** Compute monthly, and evaluate each crop against the DLI available *during its own growing window*, not the annual mean. A spring lettuce crop and a summer tomato crop in the same cell face completely different light budgets.

### 3.6 Per-crop DLI table

**How to read this table.** Columns:

- **Label** — conventional garden sun requirement.
- **DLI min** — below this, expect failure or commercially unacceptable quality/yield.
- **DLI target** — range for good performance.
- **Shade OK** — documented to tolerate or benefit from **30–50% shade** (✔ = yes; ✔✔ = frequently *improved* by partial shade in hot climates; blank = no).
- **Tier** — evidence tier for the DLI numbers:
  - **A** — published DLI-controlled experiment or greenhouse DLI recommendation for this species.
  - **B** — published shade-cloth or agrivoltaic trial reporting yield vs. % shading, converted to DLI.
  - **C** — **inferred** from the crop's sun-hour class using the §3.3 conversion. Directionally reliable, numerically approximate. *The majority of rows are Tier C. This is an honest statement about the state of the literature: quantitative DLI thresholds simply have not been established for most garden crops.*

> **Do not present Tier C numbers to users as measurements.** Present them as bands ("needs bright light, roughly 15–20 mol"), and drive the actual recommendation off the ordinal ranking, which is robust, rather than off the absolute value, which is not.

> **Record 23 (2026-09-11):** the shipped rows in `src/data/catalog/rows.ts` are the source of truth for numbers and tiers. Where this table and the rows differed (tomato, both peppers, cucumber, lettuce, spinach, basil, strawberry, raspberry) the table now follows the rows. Every Tier C figure cites the class methodology (Purdue HO-238-B-W, VCE SPES-720NP) and no ECOCROP entry: ECOCROP holds no light integral, and the Tier C classes came from the sun label through the §3.3 conversion. The eleven tropical staples added in that record (cassava to moringa) sit in the rows with their sources in the row comments and are not repeated in this table.

| # | Crop | Botanical name | Label | DLI min | DLI target | Shade OK (30–50%) | Tier | Source / note |
|---|---|---|---|---|---|---|---|---|
| **Fruiting vegetables** |
| 1 | Tomato | *Solanum lycopersicum* | Full sun | 15 | 20–30 | | C | 15, preferably >20, for vine crops as a group (Runkle 2011, `runkle2011-vegetable-dli`); the former ≥22 was ReduSystems vendor copy and is deleted (records 7 and 23) |
| 2 | Pepper, sweet | *Capsicum annuum* | Full sun | 15 | 20–30 | ✔✔ hot climates | C | Runkle's vine-crop figure, as tomato. Fruit sunscald reduced by afternoon shade |
| 3 | Pepper, hot | *Capsicum* spp. | Full sun | 15 | 20–30 | ✔ | C | Runkle's vine-crop figure, as tomato |
| 4 | Eggplant | *Solanum melongena* | Full sun | 14 | 20–28 | | C | |
| 5 | Cucumber | *Cucumis sativus* | Full sun | 15 | 20–30 | ✔ | C | Runkle's vine-crop figure, as tomato; the former 12 / 18–26 had no per-crop source (record 23) |
| 6 | Summer squash / zucchini | *Cucurbita pepo* | Full sun | 12 | 18–25 | ✔ | C | |
| 7 | Winter squash | *Cucurbita* spp. | Full sun | 14 | 20–28 | | C | Long season, high assimilate demand |
| 8 | Pumpkin | *Cucurbita pepo/maxima* | Full sun | 14 | 20–28 | | C | |
| 9 | Melon (muskmelon) | *Cucumis melo* | Full sun | 16 | 22–30 | | C | Sugar accumulation is light-limited |
| 10 | Watermelon | *Citrullus lanatus* | Full sun | 16 | 22–30 | | C | |
| 11 | Okra | *Abelmoschus esculentus* | Full sun | 16 | 22–30 | | C | Also strongly heat-requiring |
| 12 | Tomatillo | *Physalis philadelphica* | Full sun | 14 | 20–28 | | C | |
| 13 | Sweet corn | *Zea mays* | Full sun | 18 | 25–35 | ✘ **avoid** | B | Most shade-**susceptible** common crop |
| 14 | Bean, bush | *Phaseolus vulgaris* | Full sun | 12 | 18–25 | ✔ marginal | C | |
| 15 | Bean, pole | *Phaseolus vulgaris* | Full sun | 12 | 18–25 | ✔ marginal | C | |
| 16 | Pea, garden/snap | *Pisum sativum* | Full/part sun | 8 | 14–20 | ✔ | C | Cool-season; tolerates spring shade |
| 17 | Cowpea / southern pea | *Vigna unguiculata* | Full sun | 14 | 20–28 | | C | |
| 18 | Fava bean | *Vicia faba* | Full/part sun | 8 | 14–20 | ✔ | C | |
| 19 | Runner bean | *Phaseolus coccineus* | Full sun | 12 | 18–25 | ✔ | C | |
| **Root, tuber & bulb** |
| 20 | Potato | *Solanum tuberosum* | Full sun | 12 | 18–25 | ✔ to ~50% | B | ~50% shading = yield-loss threshold |
| 21 | Sweet potato | *Ipomoea batatas* | Full sun | 14 | 20–28 | | C | |
| 22 | Carrot | *Daucus carota* | Full/part sun | 8 | 14–20 | ✔ | B | Root crops perform well under PV |
| 23 | Beet | *Beta vulgaris* | Full/part sun | 8 | 14–20 | ✔ | B | |
| 24 | Radish | *Raphanus sativus* | Full/part sun | 6 | 12–18 | ✔ | C | Fast; bolts in heat, benefits from shade |
| 25 | Turnip | *Brassica rapa* | Full/part sun | 8 | 12–18 | ✔ | C | |
| 26 | Rutabaga | *Brassica napus* | Full sun | 10 | 14–20 | ✔ | C | |
| 27 | Parsnip | *Pastinaca sativa* | Full/part sun | 8 | 14–20 | ✔ | C | |
| 28 | Onion, bulb | *Allium cepa* | Full sun | 14 | 20–28 | ✘ | C | Bulbing is photoperiod- **and** light-driven |
| 29 | Shallot | *Allium cepa* Aggregatum | Full sun | 12 | 18–25 | | C | |
| 30 | Garlic | *Allium sativum* | Full sun | 12 | 18–25 | | C | |
| 31 | Leek | *Allium ampeloprasum* | Full/part sun | 8 | 14–20 | ✔ | C | Non-bulbing, more shade-forgiving |
| 32 | Scallion / bunching onion | *Allium fistulosum* | Full/part sun | 6 | 12–18 | ✔ | C | |
| 33 | Celeriac | *Apium graveolens* rapaceum | Full/part sun | 8 | 14–20 | ✔ | C | |
| 34 | Kohlrabi | *Brassica oleracea* Gongylodes | Full/part sun | 8 | 14–20 | ✔ | C | |
| 35 | Jerusalem artichoke | *Helianthus tuberosus* | Full sun | 12 | 18–26 | | C | |
| 36 | Horseradish | *Armoracia rusticana* | Full/part sun | 8 | 14–20 | ✔ | C | |
| **Leafy greens & brassicas** |
| 37 | Lettuce, leaf | *Lactuca sativa* | Part sun | 5.8 | 14.4–17 | ✔✔ | A | 5.8 is the lowest level Pennisi et al. 2020 grew lettuce at, 14.4 their optimum, 17 the Cornell CEA target (Both et al. 1997; Brechner & Both 2013); Kelly et al. 2020 grew two cultivars from 6.9. No trial places a failure point (record 23). **>17 sustained → tipburn** |
| 38 | Lettuce, head/romaine | *Lactuca sativa* | Part sun | 5.8 | 14.4–17 | ✔✔ | A | As leaf lettuce: Kelly's 'Rex' is a butterhead and Cornell's 17 was set on boston bibb. Most shade-tolerant common crop |
| 39 | Spinach | *Spinacia oleracea* | Part sun | 6 | 14–20 | ✔✔ | C | Gao et al. 2020 (`gao2020-spinach-dli`) grew spinach at 11.5–20.2 with the optimum at 17.3 and less at 20.2; the trial starts too high to place a minimum, so the row stays a class inference (record 23). Shade delays bolting |
| 40 | Swiss chard | *Beta vulgaris* Cicla | Part sun | 6 | 12–18 | ✔✔ | C | |
| 41 | Kale | *Brassica oleracea* Acephala | Part sun | 6 | 12–18 | ✔✔ | B | |
| 42 | Collards | *Brassica oleracea* Acephala | Part sun | 6 | 12–18 | ✔ | C | |
| 43 | Mustard greens | *Brassica juncea* | Part sun | 6 | 12–18 | ✔ | C | |
| 44 | Arugula | *Eruca vesicaria* | Part sun/part shade | 5 | 10–16 | ✔✔ | C | Shade markedly reduces bolting |
| 45 | Mizuna | *Brassica rapa* var. *nipposinica* | Part shade | 5 | 10–16 | ✔✔ | C | |
| 46 | Tatsoi | *Brassica rapa* var. *rosularis* | Part shade | 5 | 10–16 | ✔✔ | C | |
| 47 | Bok choy / pak choi | *Brassica rapa* Chinensis | Part sun | 6 | 12–18 | ✔✔ | C | |
| 48 | Cabbage | *Brassica oleracea* Capitata | Full/part sun | 8 | 14–20 | ✔ | C | |
| 49 | Broccoli | *Brassica oleracea* Italica | Full/part sun | 10 | 14–20 | ✔ afternoon | C | Head quality improves with afternoon shade in heat |
| 50 | Cauliflower | *Brassica oleracea* Botrytis | Full/part sun | 10 | 14–20 | ✔ | C | Shade helps curd whiteness |
| 51 | Brussels sprouts | *Brassica oleracea* Gemmifera | Full sun | 10 | 16–22 | ✔ marginal | C | Long season |
| 52 | Endive / escarole | *Cichorium endivia* | Part sun | 6 | 12–17 | ✔✔ | C | |
| 53 | Radicchio | *Cichorium intybus* | Part sun | 6 | 12–17 | ✔ | C | |
| 54 | Celery | *Apium graveolens* | Part sun | 8 | 14–20 | ✔ | C | High water demand; shade reduces stress |
| 55 | New Zealand spinach | *Tetragonia tetragonioides* | Full/part sun | 8 | 14–20 | ✔ | C | Heat-tolerant spinach substitute |
| 56 | Sorrel | *Rumex acetosa* | Part shade | 4 | 8–14 | ✔✔ | C | |
| 57 | Mâche / corn salad | *Valerianella locusta* | Part shade | 4 | 8–14 | ✔✔ | C | Cool-season, low-light |
| 58 | Claytonia / miner's lettuce | *Claytonia perfoliata* | Part/full shade | 3 | 6–12 | ✔✔ | C | Genuinely shade-adapted |
| 59 | Watercress | *Nasturtium officinale* | Part shade | 4 | 8–14 | ✔✔ | C | Streamside species |
| **Herbs** |
| 60 | Basil | *Ocimum basilicum* | Full sun | 12.9 | 14.4–17.8 | ✔ marginal | A | 12.9 is Dou et al. 2018's suggested production DLI (tested 9.3–17.8, shoot mass highest at 17.8); 14.4 is Pennisi et al. 2020's optimum; Walters & Currey 2018 found 59% less mass at ≤7 than at ~15 (record 23) |
| 61 | Parsley | *Petroselinum crispum* | Part sun/part shade | 5 | 10–16 | ✔✔ | C | |
| 62 | Cilantro / coriander | *Coriandrum sativum* | Part sun/part shade | 5 | 10–16 | ✔✔ | C | Shade strongly delays bolting |
| 63 | Dill | *Anethum graveolens* | Full sun | 10 | 16–22 | | C | |
| 64 | Chives | *Allium schoenoprasum* | Full/part sun | 6 | 12–18 | ✔ | C | |
| 65 | Mint | *Mentha* spp. | Part shade | 4 | 8–14 | ✔✔ | C | Classic shade herb; **rhizomatous — contain** |
| 66 | Oregano | *Origanum vulgare* | Full sun | 12 | 18–25 | | C | Essential-oil content is light-driven |
| 67 | Thyme | *Thymus vulgaris* | Full sun | 12 | 18–25 | | C | |
| 68 | Rosemary | *Salvia rosmarinus* | Full sun | 14 | 20–28 | | C | |
| 69 | Sage | *Salvia officinalis* | Full sun | 12 | 18–25 | | C | |
| 70 | Tarragon | *Artemisia dracunculus* | Full/part sun | 8 | 14–20 | ✔ | C | |
| 71 | Lemon balm | *Melissa officinalis* | Part shade | 4 | 8–14 | ✔✔ | C | |
| 72 | Lovage | *Levisticum officinale* | Part sun | 6 | 12–18 | ✔ | C | |
| 73 | Marjoram | *Origanum majorana* | Full sun | 12 | 18–25 | | C | |
| 74 | Fennel (bulbing) | *Foeniculum vulgare* | Full sun | 12 | 18–25 | | C | **Allelopathic — see §4.9** |
| 75 | Shiso / perilla | *Perilla frutescens* | Part sun | 6 | 12–18 | ✔ | C | |
| 76 | Chervil | *Anthriscus cerefolium* | Part/full shade | 3 | 6–12 | ✔✔ | C | Requires shade in summer |
| 77 | Summer savory | *Satureja hortensis* | Full sun | 12 | 18–25 | | C | |
| 78 | Bay laurel | *Laurus nobilis* | Full/part sun | 8 | 14–22 | ✔ | C | |
| **Fruits & perennials** |
| 79 | Strawberry (June/day-neutral) | *Fragaria* × *ananassa* | Full sun | 25 | 25–30 | ✔✔ | C | 25 is Widmer et al. 2026's agrivoltaic average-yield convention, the only APV DLI source; 30 is where the OSU Kubota Lab's greenhouse guidance (`kubota-osu-strawberry-dli`) says plants are stressed, and that page's greenhouse minimum 12 and optimum 20–25 are a different quantity. The former 10 was a sun-hour guess (record 23) |
| 80 | Raspberry | *Rubus idaeus* | Full/part sun | 15 | 18–25 | ✔ | C | 15 is Widmer et al. 2026's average-yield convention for raspberry; the band is inference. Afternoon shade helps in hot climates |
| 81 | Blackberry | *Rubus* spp. | Full sun | 12 | 18–26 | ✔ marginal | C | |
| 82 | Blueberry | *Vaccinium corymbosum* | Full sun | 12 | 20–26 | ✔ marginal | C | Also needs pH 4.5–5.5 — hard constraint |
| 83 | Red/white currant | *Ribes rubrum* | Part shade | 5 | 10–16 | ✔✔ | C | Genuinely shade-tolerant fruit |
| 84 | Blackcurrant | *Ribes nigrum* | Part sun | 6 | 12–18 | ✔✔ | C | |
| 85 | Gooseberry | *Ribes uva-crispa* | Part shade | 5 | 10–16 | ✔✔ | C | |
| 86 | Elderberry | *Sambucus* spp. | Full/part sun | 8 | 14–22 | ✔ | C | |
| 87 | Rhubarb | *Rheum rhabarbarum* | Part sun | 6 | 12–18 | ✔✔ | C | |
| 88 | Asparagus | *Asparagus officinalis* | Full sun | 14 | 20–28 | ✘ | C | Fern must build crown reserves |
| 89 | Globe artichoke | *Cynara cardunculus* | Full sun | 14 | 20–28 | | C | |
| 90 | Grape | *Vitis* spp. | Full sun | 18 | 25–35 | ✘ | C | Fruit-zone light drives sugar & phenolics |
| 91 | Apple | *Malus domestica* | Full sun | 16 | 22–32 | ✘ | C | Also needs chill; see §1.11 |
| 92 | Pear | *Pyrus communis* | Full sun | 16 | 22–32 | ✘ | C | Chill-limited |
| 93 | Peach / nectarine | *Prunus persica* | Full sun | 18 | 25–35 | ✘ | C | Chill-limited; high light for fruit quality |
| 94 | Plum | *Prunus domestica* | Full sun | 16 | 22–32 | ✘ | C | Chill-limited |
| 95 | Sweet/sour cherry | *Prunus avium* / *cerasus* | Full sun | 16 | 22–32 | ✘ | C | Chill-limited |
| 96 | Fig | *Ficus carica* | Full sun | 16 | 22–32 | | C | |
| 97 | Hazelnut | *Corylus avellana* | Full/part sun | 10 | 18–25 | ✔ | C | Understorey-capable |
| 98 | Pawpaw | *Asimina triloba* | Part shade (juvenile) → sun | 6 | 14–22 | ✔✔ juvenile | C | Requires shade for first 1–2 yrs |
| 99 | Serviceberry / saskatoon | *Amelanchier* spp. | Full/part sun | 8 | 14–22 | ✔ | C | |
| 100 | Aronia | *Aronia melanocarpa* | Full/part sun | 8 | 14–22 | ✔ | C | |
| 101 | Hardy kiwi | *Actinidia arguta* | Full/part sun | 10 | 18–25 | ✔ | C | |
| 102 | Hops | *Humulus lupulus* | Full sun | 14 | 20–30 | | C | |
| **Companion / insectary / cover** |
| 103 | Marigold | *Tagetes* spp. | Full sun | 10 | 16–24 | ✔ marginal | C | Nematode use requires full-season stand (§4.6) |
| 104 | Nasturtium | *Tropaeolum majus* | Full/part sun | 6 | 12–20 | ✔✔ | C | Edible; flowers less in deep shade |
| 105 | Borage | *Borago officinalis* | Full sun | 10 | 16–24 | ✔ | C | Strong bee forage |
| 106 | Calendula | *Calendula officinalis* | Full/part sun | 8 | 14–20 | ✔ | C | |
| 107 | Sunflower | *Helianthus annuus* | Full sun | 18 | 25–35 | ✘ | C | Also a competitor — see §5.1 |
| 108 | Buckwheat | *Fagopyrum esculentum* | Full sun | 10 | 16–24 | ✔ | C | Fast insectary cover |
| 109 | Crimson clover | *Trifolium incarnatum* | Full/part sun | 8 | 14–20 | ✔ | C | N-fixing living mulch |
| 110 | White clover | *Trifolium repens* | Full/part sun | 6 | 12–18 | ✔✔ | C | Undersowing — see §4.5 |
| 111 | Phacelia | *Phacelia tanacetifolia* | Full sun | 10 | 16–24 | ✔ | C | Top-tier insectary |
| 112 | Sweet alyssum | *Lobularia maritima* | Full/part sun | 6 | 12–18 | ✔✔ | C | Hoverfly attractant |
| 113 | Yarrow | *Achillea millefolium* | Full sun | 10 | 16–24 | ✔ | C | Insectary |
| 114 | Dutch/perennial ryegrass (living mulch) | *Lolium perenne* | Full/part sun | 6 | 12–20 | ✔✔ | C | Competes strongly for water |

**Crops documented (Tier A/B) to tolerate or benefit from 30–50% shade:** lettuce (all types), spinach, kale, potato, carrot, beet, strawberry, raspberry, and by extension the other cool-season leafy brassicas and salad greens. **Crops to exclude from heavily shaded agrivoltaic cells:** sweet corn (most shade-susceptible), grapes, tree fruit, bulb onion, asparagus, sunflower.

---

## 4. Companion planting: separating agroecology from folklore

### 4.1 The baseline problem

The canonical popular source, Louise Riotte's *Carrots Love Tomatoes*, presents pairings with **no supporting evidence and frequently no proposed mechanism**. Most of the pairings that circulate in blog posts, printable charts, and app "companion" features trace back to that book, to Rudolf Steiner's biodynamics, or to unattributed repetition. Critical reviews: *The Myth of Companion Planting* (<https://www.gardenmyths.com/companion-planting-truth-myth/>); Laidback Gardener's literature survey (<https://laidbackgardener.blog/2026/06/04/not-another-article-on-companion-planting-or-what-science-has-to-say-about-it/>).

At the same time, **there is a real and substantial agroecological literature** on plant–plant and plant–insect interactions with well-characterised mechanisms and measured effect sizes. The engine's job is to encode the second and refuse to encode the first — and to be honest with users about which is which.

**The four mechanism families with genuine support:** (i) resource complementarity / niche partitioning, (ii) host-finding disruption, (iii) natural-enemy provisioning, and (iv) allelopathy and biofumigation under specific management. Everything else is either unmeasured or debunked.

### 4.2 Push–pull systems — Grade A (mechanism revised), but not transferable

The Khan et al. push–pull system for East African maize is the best-documented companion-planting technology in existence. Maize is intercropped with *Desmodium* spp. (the "push") and bordered with Napier grass, *Pennisetum purpureum* (the "pull"). Stemborer moths are drawn to the Napier border, which does not support full larval development, so most larvae die. *Desmodium* additionally suppresses *Striga hermonthica* through root exudates that trigger suicidal germination and inhibit *Striga* radicle attachment, plus shading and N-fixation.

Measured on-farm outcomes: **8–20 stemborers per 40 maize plants in push–pull plots vs. 39–57 in controls**, and maize yields of **4–7 t/ha vs. 2–5 t/ha in controls**. Key references: Khan et al., on-farm evaluation, <https://ir-library.ku.ac.ke/items/44c40115-e6ed-42cd-88ad-e2eaa16047e9>; Khan et al., *"Exploiting phytochemicals for developing a 'push–pull' crop protection strategy for cereal farmers in Africa,"* J. Exp. Bot. 61(15):4185 (2010), <https://academic.oup.com/jxb/article/61/15/4185/428504>; economic evaluation, <https://www.sciencedirect.com/science/article/abs/pii/S0261219408000069>.

**Important recent revision.** The mechanism is contested. *"The push–pull intercrop Desmodium does not repel, but intercepts and kills pests,"* eLife (2023/2024), <https://elifesciences.org/articles/88695>, reports that the effect is physical interception and mortality on *Desmodium*'s sticky trichomes rather than volatile repellence. A companion paper re-examines *Desmodium* volatiles against fall armyworm, <https://elifesciences.org/articles/100981>. Grade the *outcome* A and the *mechanism* B, and record both.

**Do not generalise this to a home garden.** The system is specific to particular crops, pests, latitudes, and field scales, and it depends on border strips of a 3 m forage grass. Encoding "push–pull" as a generic recommendation is exactly the kind of unwarranted extrapolation this spec exists to prevent.

### 4.3 Trap cropping — Grade B, with a strong caveat

Shelton & Badenes-Pérez, *"Concepts and applications of trap cropping in pest management,"* Annu. Rev. Entomol. 51 (2006), <https://www.annualreviews.org/doi/abs/10.1146/annurev.ento.51.110104.150959>: of nearly **100 trap-cropping systems reviewed, only about 10 were considered successful at commercial scale**. Four of those ten depended on **applying pesticide directly to the trap crop**.

The diagnosis of *why* it fails is well-established: **retention, not attraction, is the limiting factor.** Holden et al., *"Designing an effective trap cropping strategy: the effects of attraction, retention and plant spatial distribution,"* J. Appl. Ecol. 49 (2012), <https://besjournals.onlinelibrary.wiley.com/doi/full/10.1111/j.1365-2664.2012.02137.x>: most of the literature optimises for the most attractive trap plant, but without preventing dispersal back into the main crop, a trap crop can act as a **pest nursery that concentrates and then releases pests** — a net negative.

**Engine implication:** trap crops must carry a mandatory management requirement (`requires_intervention: true`) — destruction, vacuuming, or treatment of the trap crop at a specified pest density. Recommending "plant blue hubbard squash at the field edge" without the destruction step is worse than recommending nothing.

### 4.4 Intercropping and land equivalent ratio — Grade A

LER = Σ(intercrop yield of species i / monoculture yield of species i). LER > 1 means the mixture uses land more efficiently than the sole crops.

- Global mean LER for **cereal–legume** intercrops: **~1.22** (Yu et al. 2015) to **~1.30** (Martin-Guay et al. 2018).
- **Maize/soybean** specifically: **LER = 1.32 ± 0.02** across 47 English-language and 43 Chinese-language studies (Xu et al., *Field Crops Research*, <https://www.sciencedirect.com/science/article/abs/pii/S0378429019305945>).
- Phosphorus: **LER_P = 1.24** in cereal–legume intercrops, with a mean net P gain of 3.67 kg P/ha (Tang et al., *Plant & Soil* 2020, <https://link.springer.com/article/10.1007/s11104-020-04768-x>).
- Ecological drivers synthesis: *npj Sustainable Agriculture* (2025), <https://www.nature.com/articles/s44264-025-00110-z>.

This is the **strongest quantitative evidence in the whole companion-planting domain** — a consistent 20–30% land-efficiency gain across hundreds of trials. It is the intellectual justification for polyculture in the garden designer.

**But note what LER does and does not say.** LER > 1 is a *land efficiency* statement, not a per-species yield statement. Each component species almost always yields **less** in the intercrop than in monoculture; the mixture wins on total output per unit area. Users optimising for "as many tomatoes as possible" will not benefit. Users optimising for "most food from this bed" will. The UI must make this distinction, or the recommendation will feel like a lie.

### 4.5 Host-finding disruption: Finch & Collier's appropriate/inappropriate landings — Grade A for the theory, D/E for the folk version

Finch, S. & Collier, R.H. (2000). *"Host-plant selection by insects – a theory based on 'appropriate/inappropriate landings' by pest insects of cruciferous plants."* **Entomologia Experimentalis et Applicata 96:91–102.** <https://onlinelibrary.wiley.com/doi/pdf/10.1046/j.1570-7458.2000.00684.x>

The model: host-finding is a three-stage sequence. (1) The insect is drawn into the vicinity by host volatiles. (2) It responds to a **visual** cue and lands on a green surface. (3) It makes short exploratory flights among neighbouring leaves, accumulating "appropriate" (host) or "inappropriate" (non-host) landings; egg-laying requires enough appropriate landings in sequence. In a monoculture nearly every landing is appropriate. In a polyculture, non-host green surfaces dilute the sequence and many insects leave before ovipositing.

**The finding that kills most companion-planting folklore:** Finch & Collier (2003), *"Companion planting – do aromatic plants disrupt host-plant finding by the cabbage root fly and the onion fly more effectively than non-aromatic plants?"*, Ent. Exp. Appl., <https://onlinelibrary.wiley.com/doi/abs/10.1046/j.0013-8703.2003.00102.x> — **aromatic plants were no more effective than non-aromatic plants.** The mechanism is *green surface area*, not smell. Earlier, Uvah & Coaker (1984), *"Effect of mixed cropping on some insect pests of carrots and onions,"* Ent. Exp. Appl. 36:159–167, found that onions selected specifically for pungency **failed to deter insects from landing on their host plants**.

Finch's own summary of the practical corollary — that **undersowing with clover** is the effective intervention because it supplies uniform non-host green cover — is at <http://www.regional.org.au/au/esa/2001/03/0305finch.htm>. See also Theunissen (1994), *"Intercropping in field vegetable crops: pest management by agrosystem diversification,"* Pesticide Science 42:65–72, <https://onlinelibrary.wiley.com/doi/abs/10.1002/ps.2780420111>, and the intercropping/aphid host-location work of Mansion-Vaquié et al. (2020), <https://onlinelibrary.wiley.com/doi/abs/10.1111/eea.12848>.

**So:**
- "Interplanting a non-host green cover reduces colonisation by specialist crucifer/allium/carrot flies" → **Grade A/B.**
- "Onions repel carrot fly because of their smell" → **Grade E, actively contradicted.**
- "Aromatic herbs repel pests from neighbours" → **Grade E** as a general claim.

**Critical trade-off the engine must model:** the same ground cover that disrupts host-finding also **competes with the crop for water and nutrients**. This is documented — see *"Plant competition in pest-suppressive intercropping systems complicates evaluation of herbivore responses,"* Agriculture, Ecosystems & Environment, <https://www.sciencedirect.com/science/article/abs/pii/S0167880903002913>. Recommending undersowing without a competition warning, and without an irrigation/fertility adjustment, will produce clean but stunted brassicas.

### 4.6 Marigold and root-knot nematodes — Grade A for the practice, E for the garden version

**The effect is real and the mechanism is characterised.** The principal nematicidal compound in *Tagetes* root exudate is **α-terthienyl**, a thiophene. Mechanism: under dark conditions (i.e. in soil, without photoactivation) α-terthienyl acts as an oxidative-stress inducer that penetrates the nematode hypodermis; induction of glutathione S-transferase and superoxide dismutase in the hypodermis is suppressed, and nematode susceptibility tracks GST/SOD expression. Primary paper: *"Nematicidal actions of the marigold exudate α-terthienyl: oxidative stress-inducing compound penetrates nematode hypodermis,"* <https://pmc.ncbi.nlm.nih.gov/articles/PMC6504006/>.

Marigold suppresses *Meloidogyne* by **at least four routes**: α-terthienyl allelochemistry, being a **poor host** (so populations decline for lack of reproduction), acting as a **dead-end trap crop** (juveniles enter but cannot develop), and enhancing nematode-antagonistic soil microbiota. Reviews: Hooks et al., *"Using marigold (Tagetes spp.) as a cover crop to protect crops from plant-parasitic nematodes,"* Applied Soil Ecology, <https://www.sciencedirect.com/science/article/abs/pii/S092913931000168X>; UH-CTAHR PD-35, *"Using Marigold as an Alternative to Chemical Nematicides,"* <https://www.ctahr.hawaii.edu/oc/freepubs/pdf/pd-35.pdf>.

**The decisive management constraint:** α-terthienyl has **limited nematicidal activity when marigold tissue is incorporated into soil — only living marigold root systems exhibit significant nematicidal properties.** The effect therefore requires a **dense, full-season, near-monoculture stand of marigold occupying the bed as a cover crop**, typically for 2–3 months, *before* the susceptible crop.

**Therefore:**
- "Grow a solid stand of *Tagetes patula* (e.g. 'Single Gold'/'Nemagold') in the bed for a full season, then plant tomatoes" → **Grade A.**
- "Tuck three marigolds among your tomatoes to stop nematodes" → **Grade E.** Insufficient root density, wrong timing, wrong spatial arrangement. This is the single most-repeated false companion claim.
- Cultivar matters: efficacy is strongly species- and cultivar-dependent, and some *Tagetes* cultivars are hosts. Store `cultivar_specific: true`.

### 4.7 The Three Sisters — Grade B, with an honest caveat

Zhang, C., Postma, J.A., York, L.M., Lynch, J.P. (2014). *"Root foraging elicits niche complementarity-dependent yield advantage in the ancient 'three sisters' (maize/bean/squash) polyculture."* **Annals of Botany 114(8):1719–1733.** <https://academic.oup.com/aob/article/114/8/1719/209154> / <https://pmc.ncbi.nlm.nih.gov/articles/PMC4416130/>

Monocultures and polycultures of maize, bean, and squash were grown across N and P availability gradients, with a DNA-based method used to discriminate the roots of each species in situ. The polyculture and its maize/bean variant **out-yield the component monocultures on a land-equivalent basis**, and the paper attributes this to **below-ground niche complementarity**: the three species forage different soil volumes (maize steep and deep, bean shallow and lateral, squash intermediate and broad), so total soil exploration increases.

This is genuine, mechanistically grounded evidence for **spatial niche partitioning** — the same principle that justifies root-depth stratification in §5.4.

Additional support: above-ground, the polyculture **promotes both direct and indirect defences of maize against herbivores** (<https://www.sciencedirect.com/science/article/abs/pii/S116103012400039X>). Light capture in maize/bean polycultures has been modelled with a functional–structural plant model (<https://academic.oup.com/insilicoplants/article/7/2/diaf011/8203508>) — directly relevant if you want to simulate intra-garden shading.

**The caveat, and it is a real one:** Cryan et al. (2025), *"Yield, growth, and labor demands of growing maize, beans, and squash in monoculture versus the Three Sisters,"* Plants, People, Planet, <https://nph.onlinelibrary.wiley.com/doi/full/10.1002/ppp3.10576>, measures the **labour** cost alongside the yield. Land efficiency is not the only objective function for a home gardener. Recommendations should surface labour and harvest-difficulty alongside LER.

**Agrivoltaic-specific warning:** maize is the most shade-susceptible common crop (§3.5). **The Three Sisters is a poor fit for shaded agrivoltaic cells** despite being the poster child of companion planting. The engine must apply the light filter *before* the companion filter, or it will confidently recommend corn under a solar array.

### 4.8 Nitrogen fixation and transfer in legume intercrops — Grade B, and much smaller than folklore claims

Symbiotic N₂ fixation by legumes is Grade A settled science. **Transfer of that N to a neighbouring non-legume within the same season is a different and much weaker claim.**

Thilakarathna et al. (2016), *"Belowground nitrogen transfer from legumes to non-legumes under managed herbaceous cropping systems"* — synthesis: N transferred from legume to non-legume in **annual intercrops is typically below 15% of the legume's N**. Individual studies report more under favourable conditions: 14–20% of associated wheat's N uptake from gram and 16–32% for maize from cowpea under greenhouse conditions; 28% of maize N of atmospheric origin via cowpea transfer in one field study. Review: *"Nitrogen fixation and transfer between legumes and cereals under various cropping regimes,"* <https://www.sciencedirect.com/science/article/abs/pii/S2452219822000763>; also *"Interspecific Nitrogen Transfer and Nutrient Exchange in Legume–Cereal Intercropping Systems: A Review,"* <https://www.sciltp.com/journals/rem/articles/2602003125>, and *Agronomy* 12:1900, <https://doi.org/10.3390/agronomy12081900>.

Mechanism: Nicolardot/Chapagain-type work finds **considerable C and N transfer from peas to cereals via direct root contact but not via mycorrhizal networks** (*Scientific Reports* 2021, <https://www.nature.com/articles/s41598-021-90436-8>) — so proximity and root intermingling matter, and the common-mycorrhizal-network story is not supported.

Methodological warning: transfer estimates depend heavily on the ¹⁵N technique used, and different methods give materially different numbers (*"Methodologies for estimating nitrogen transfer between legumes and companion species,"* Soil Biol. Biochem., <https://www.sciencedirect.com/science/article/abs/pii/S0038071714000583>).

**What the engine should say:** "Beans do not meaningfully feed your corn this season." The real N benefit of a legume is realised (a) by the **following** crop, from decomposing residues and nodules, and (b) by the intercrop *system*, through reduced competition for soil N (the legume takes its N from the air, leaving more soil N for the cereal) — which is a large part of why cereal–legume LER exceeds 1. Model N-fixation benefit as a **rotational/temporal** effect with a lag, not as a same-season neighbour effect.

### 4.9 Allelopathy

**Black walnut / juglone — Grade C, and the textbook example is shakier than the textbooks admit.**

Juglone (5-hydroxy-1,4-naphthoquinone) from *Juglans nigra* is the paradigmatic allelopathy case, yet **the field evidence is weak**. Key points from the critical literature: juglone in its toxic form **is not present in intact black walnut tissues** (it is produced from hydrojuglone on oxidation after tissue damage); many early studies **lacked manipulation controls** and did not test the other, non-toxic compounds present in walnut extracts; numerous studies find **no significant adverse effect** on various species. Carefully controlled laboratory experiments do show toxicity to many species, especially at the seedling stage, **but there is little landscape-scale evidence that allelopathy is why plants near walnuts do poorly** — competition for light, water, and nutrients from a large tree is a sufficient and simpler explanation. Sources: *"Black walnut and juglone toxicity: How strong is the evidence for the paradigmatic example of allelopathy?"* <https://www.researchgate.net/publication/267283799_Black_walnut_and_juglone_toxicity_How_strong_is_the_evidence_for_the_paradigmatic_example_of_allelopathy>; Chalker-Scott, WSU Extension home-garden fact sheet, <https://pubs.extension.wsu.edu/product/do-black-walnut-trees-have-allelopathic-effects-on-other-plants-home-garden-series/>; Jose, *"Black Walnut Allelopathy: Implications for Intercropping,"* <https://link.springer.com/chapter/10.1007/978-0-387-77337-7_16>.

**Engine handling:** keep the walnut exclusion zone as a *warning* with a stated confidence, and attribute the likely cause to combined competition + possible allelopathy. Do not present a hard "juglone kill radius." This is a case where the honest answer improves the product: users near a walnut are better advised to address shade and root competition than to hunt for juglone-resistant cultivars.

**Brassica glucosinolates / biofumigation — Grade B, conditional on management.**

Glucosinolates in Brassicaceae tissue are hydrolysed by myrosinase on cell rupture to **isothiocyanates (ITCs)**, which are broad-spectrum biocides. Quantitatively:

- Soil glucosinolate and ITC concentrations peak **immediately (~30 min) after incorporation**, and are detectable for up to **8 days (GSL) and 12 days (ITC)** respectively (*Soil Biology & Biochemistry*, <https://www.sciencedirect.com/science/article/abs/pii/S0038071706001246>).
- **Conversion efficiency is the crux.** With simple incorporation, **≤1% of the ITC predicted from tissue glucosinolate content is actually measured in soil.** With cell-level tissue disruption (freeze–thaw), maximum ITC reached 40–75 nmol ITC g⁻¹ soil, raising release efficiency to **14–26%** (<https://www.sciencedirect.com/science/article/abs/pii/S0038071702001530>).
- *Brassica juncea* is generally preferred for its higher convertible glucosinolate content vs. *B. nigra*, *B. napus*, or *Sinapis alba*.
- Efficacy across studies is highly variable; a 2020 meta-analysis of 46 studies found high study-to-study variability confounding the relationship between plant part and efficacy. See also <https://pmc.ncbi.nlm.nih.gov/articles/PMC12029985/> on ITC-mediated alleviation of soil-borne disease and <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4505889/> on degradation dynamics.

**So biofumigation requires: high-glucosinolate species, maximum biomass, finely macerated tissue, immediate incorporation, moist soil, and ideally tarping.** It is **not** a passive neighbour effect. "Plant mustard near your tomatoes for disease control" is Grade E; "grow a *B. juncea* cover crop, flail-mow and incorporate at flowering, irrigate and tarp" is Grade B.

**Sorghum / sorgoleone — Grade B for residue-based weed suppression.**

Sorghum produces phenolics, the cyanogenic glycoside dhurrin, and the hydrophobic p-benzoquinone **sorgoleone** in root exudates. Sorgoleone is hydrophobic, adsorbs to soil, and therefore persists — herbicidal activity lasting up to **seven weeks after incorporation**. Sorghum residue incorporation has been measured to reduce weed density by **62%** and weed dry weight by **65%**. Reviews: *"Sorghum allelopathy — from ecosystem to molecule,"* J. Chem. Ecol., <https://pubmed.ncbi.nlm.nih.gov/23393005/>; *"Unraveling Sorghum Allelopathy in Agriculture: Concepts and Implications,"* <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8470078/>; *"Sorghum Allelopathy: Alternative Weed Management Strategy…"*, <https://pmc.ncbi.nlm.nih.gov/articles/PMC9501246/>.

**Warning to encode:** the same allelochemistry causes **autotoxicity and injury to small-seeded vegetables**. A sorghum-sudangrass cover crop needs a 3–6 week interval before direct-seeding small-seeded crops. This is a *negative* interaction edge with a temporal offset.

**Fennel** is widely reported as allelopathic to neighbouring vegetables. This is a common garden claim with limited controlled support — Grade C/D. Encode as a low-confidence caution.

### 4.10 Insectary strips and beneficial-insect provisioning — Grade A for enemy abundance, B for pest suppression

Fiedler, A.K. & Landis, D.A. (2007). *"Attractiveness of Michigan Native Plants to Arthropod Natural Enemies and Herbivores."* **Environmental Entomology 36(4):751–765.** <https://academic.oup.com/ee/article/36/4/751/465441>

Forty-three native perennial flowering species were screened over 2003–2004 for attractiveness to natural enemies and pollinators; **26 species** were identified as most attractive to beneficials with bloom spread across the growing season. A group of **24 native perennials attracted high numbers of natural enemies**, including *Eupatorium perfoliatum*, *Monarda punctata*, *Silphium perfoliatum*, *Potentilla fruticosa*, *Coreopsis lanceolata*, *Spiraea alba*, *Agastache nepetoides*, *Anemone canadensis*, and *Angelica atropurpurea*. Practitioner version: MSU Extension Bulletin **E-2973**, *"Attracting Beneficial Insects with Native Flowering Plants,"* <https://www.canr.msu.edu/resources/attracting_beneficial_insects_with_native_flowering_plants_e2973> (PDF: <https://sanweb.lib.msu.edu/DMC/extension_publications/e2973/E2973-2007.PDF>).

Extension into adjacent crops: wildflower plantings enhance natural-enemy abundance **and their services** in adjacent blueberry fields (<https://www.sciencedirect.com/science/article/abs/pii/S1049964415300207>).

**The honest gap:** attracting natural enemies is reliably demonstrated; translating that into measurable pest suppression and yield in a small garden is much less certain and context-dependent. A 2024 meta-analysis of intercropping and agri-environment schemes on biological pest control (*Agronomy for Sustainable Development*, <https://link.springer.com/article/10.1007/s13593-024-00947-7>) is the right reference for effect sizes.

**Design rules the engine should encode:** (i) **bloom-succession coverage** — the value of an insectary is continuity, so score a garden plan on whether something attractive is in flower in every 2-week window of the season; (ii) prefer **regionally native** species where evidence exists; (iii) **umbellifers and asters** (small, accessible florets) serve parasitoids and hoverflies specifically; (iv) recommend strips/blocks, not scattered individuals.

### 4.11 Crop rotation and soil-borne disease — Grade A, and these are *hard* constraints

Rotation is the one part of "companion planting" folklore that is fully supported, and it is a **temporal** constraint that most garden apps get wrong or omit.

**Brassicas — clubroot (*Plasmodiophora brassicae*).** Resting spores survive in soil **up to 20 years**, but viability declines sharply in the first two years without a host and then slowly over the next 10–20. A **>2-year break** from host crops significantly reduces soil resting-spore concentration — reported at roughly **90% reduction with a two-year break**. Sources: Peng et al., *"A >2-year crop rotation reduces resting spores of Plasmodiophora brassicae in soil and the impact of clubroot on canola,"* Eur. J. Agronomy, <https://www.sciencedirect.com/science/article/abs/pii/S1161030115300125>; Ernst et al., *Plant Pathology* (2019), <https://bsppjournals.onlinelibrary.wiley.com/doi/10.1111/ppa.12949>; *"Clubroot Disease: 145 Years Post-Discovery,"* Annu. Rev. Phytopathol., <https://www.annualreviews.org/content/journals/10.1146/annurev-phyto-121323-020949>. **Encode: minimum 3-year interval between Brassicaceae in the same bed (2-year break).**

**Alliums — white rot (*Sclerotium cepivorum* / *Stromatinia cepivora*).** Sclerotia survive **20–40 years**. **Rotation alone does not work**; UC IPM and multiple extension services state that the long survival period makes rotation impractical and that the pathogen is effectively impossible to eliminate once introduced. Sources: UC IPM, <https://ipm.ucanr.edu/agriculture/onion-and-garlic/white-rot/>; UMass, <https://www.umass.edu/agriculture-food-environment/vegetable/fact-sheets/alliums-white-rot>; RHS, <https://www.rhs.org.uk/disease/onion-white-rot>. Management is exclusion (clean sets, clean tools, clean soil movement) and, experimentally, repeated application of **sclerotial germination stimulants** (diallyl disulfide) or bait crops to deplete inoculum in the absence of a host — see <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6356189/> and <https://apsjournals.apsnet.org/doi/10.1094/PDIS-04-23-0688-RE>. **Encode: if white rot is reported at a site, exclude Alliums indefinitely and surface a sanitation protocol — do not offer a rotation interval, because there isn't one that works.**

**Solanaceae.** Verticillium and Fusarium wilts, early blight (*Alternaria*), and bacterial canker persist in soil and residue. Standard extension guidance is a **3–4 year rotation** away from tomato/potato/pepper/eggplant. (Guidance level; effectiveness is pathogen-specific and Verticillium's wide host range limits it.)

**Rotation is a hard constraint on the *temporal* dimension of the design.** It also interacts with agrivoltaics: fixed panel geometry means shade patterns are stable year to year, so a bed suited to lettuce this year is suited to lettuce next year — which creates *pressure toward monoculture in place* and makes rotation harder. This is a genuine design tension the engine should surface: rotation groups need to be assigned to bed *sets* of similar DLI so they can be rotated among themselves.

### 4.12 Widely repeated claims that lack evidence

The following are commonly published in companion charts and should be **excluded from recommendations**, or shown only in an explicitly labelled "traditional, unverified" section:

| Claim | Status | Why |
|---|---|---|
| Basil improves the **flavour** of tomatoes | **E** | No controlled evidence. The pairing is a culinary and cultural association |
| "Carrots love tomatoes" (and most pairings in that book) | **D/E** | Anecdotal, untested, or debunked; no proposed mechanism |
| Aromatic herbs repel pests from neighbouring crops via scent | **E** | Directly contradicted — Finch & Collier 2003 found aromatic plants no better than non-aromatic; Uvah & Coaker 1984 found pungent onions did not deter landing |
| A few marigolds interplanted among tomatoes control nematodes | **E** | Requires a dense full-season stand of living roots; scattered plants have no measurable effect |
| Borage "improves the flavour/growth" of strawberries | **D** | No controlled evidence (borage *is* a genuine bee forage — that part is Grade B) |
| Chamomile as a "physician plant" improving neighbours' health | **E** | Biodynamic origin, no mechanism, no evidence |
| Garlic/chives planted near roses prevent black spot / aphids | **D/E** | Not supported by controlled trials |
| Nasturtium as an aphid "sacrifice" that protects neighbours | **C** | It is genuinely attractive to aphids, but without destruction it is a **nursery**, not a trap — see §4.3 |
| Legumes "feed" adjacent heavy feeders in the same season | **D** | Overstated: same-season transfer typically <15% of legume N (§4.8) |
| Do not plant X near Y because of "root incompatibility" | **E** | No mechanism; usually a restatement of ordinary competition |
| Planting by moon phase / biodynamic preparations | **E** | No supported mechanism |
| Dill/fennel "harms" tomatoes | **D** | Fennel allelopathy is weakly supported; dill is a good insectary plant |
| Onions "stunt" beans and peas | **D** | Widely repeated; no controlled support located |

**Product principle:** the folklore has real user demand. The right response is not to hide it but to **label it**. Show a "traditional pairing" badge distinct from an "evidence-based" badge, with the evidence grade and citations one tap away. This is both honest and a differentiator — every competitor presents folklore as fact.

### 4.13 Data model for pairwise interactions

```sql
CREATE TYPE interaction_kind AS ENUM (
  'host_finding_disruption',   -- Finch & Collier mechanism
  'trap_crop',                 -- pest concentration; REQUIRES intervention
  'repellent_volatile',        -- rarely supported; usually grade D/E
  'natural_enemy_provision',   -- insectary
  'pollinator_provision',
  'nitrogen_fixation_transfer',-- same-season; small
  'nitrogen_residual',         -- next-season; larger
  'allelopathy_inhibitory',
  'allelopathy_stimulatory',
  'biofumigation',             -- requires management
  'nematode_suppression',
  'physical_support',          -- e.g. maize for pole bean
  'living_mulch_shade',        -- weed/moisture; also competition
  'wind_shelter',
  'nurse_shade',               -- e.g. shade for pawpaw seedlings
  'resource_competition',      -- negative
  'shared_pathogen',           -- negative; drives rotation
  'shared_pest',               -- negative
  'root_niche_complementarity',
  'canopy_niche_complementarity',
  'phenological_complementarity'
);

CREATE TYPE evidence_grade AS ENUM (
  'A',  -- multi-site replicated field trials or meta-analysis; mechanism
        -- characterised; effect reproducible across contexts
  'B',  -- replicated field trials, plausible/known mechanism, but
        -- context-dependent or with important management preconditions
  'C',  -- single study, or lab/greenhouse only, or mechanism shown but
        -- field relevance unestablished
  'D',  -- traditional practice with a plausible mechanism, untested
  'E'   -- no evidence, or actively contradicted by controlled studies
);

CREATE TABLE plant_interaction (
  id                  bigserial PRIMARY KEY,

  -- Endpoints. Either may be a specific taxon or a functional group
  -- ('Brassicaceae', 'legume', 'umbellifer'), so charts can be expressed
  -- at the level the evidence actually supports.
  subject_ref         text NOT NULL,   -- taxon_id | group_id
  subject_ref_type    text NOT NULL,   -- 'taxon' | 'group' | 'family'
  object_ref          text NOT NULL,
  object_ref_type     text NOT NULL,

  kind                interaction_kind NOT NULL,
  -- Interactions are DIRECTED and usually ASYMMETRIC. Maize supports bean;
  -- bean does not support maize. Store one row per direction.
  direction           text NOT NULL CHECK (direction IN ('subject_affects_object','mutual')),
  valence             smallint NOT NULL CHECK (valence IN (-1,0,1)),

  -- Quantified effect where the literature provides one
  effect_metric       text,      -- 'LER','yield_pct','pest_density_pct','N_transfer_pct'
  effect_value        numeric,
  effect_ci_low       numeric,
  effect_ci_high      numeric,
  effect_n_studies    int,

  evidence            evidence_grade NOT NULL,
  mechanism           text NOT NULL,   -- prose; REQUIRED. No mechanism => grade D or E.

  -- Scope of validity. The single biggest failure mode in companion charts
  -- is applying a field-scale, single-region, single-pest result universally.
  valid_scale         text[],   -- {'bed','plot','field'}
  valid_climate       text[],   -- Köppen codes, or NULL for unrestricted
  valid_region        text[],
  valid_pest_target   text[],   -- specific pest taxa, where applicable
  season_offset_days  int,      -- 0 = same season; 365 = next season (rotation, residual N)

  -- Management preconditions. If non-empty, the recommendation MUST render
  -- them; otherwise the advice is misleading (trap crops, biofumigation,
  -- marigold nematode suppression all fail without these).
  requires_management text[],
  min_area_fraction   numeric,  -- e.g. marigold nematode control needs a full stand
  min_duration_days   int,      -- e.g. 60-90 d marigold cover crop

  -- Cost side of the ledger
  competition_penalty numeric,  -- 0..1, expected yield cost to the object plant

  citations           jsonb NOT NULL,  -- [{doi, url, title, year, authors, type}]
  confidence          numeric CHECK (confidence BETWEEN 0 AND 1),
  reviewed_by         text,
  reviewed_at         timestamptz,
  notes               text
);

-- Rotation is a distinct constraint type: temporal, family-level, and hard.
CREATE TABLE rotation_constraint (
  id                  bigserial PRIMARY KEY,
  group_ref           text NOT NULL,        -- 'Brassicaceae', 'Solanaceae', 'Allium'
  pathogen            text NOT NULL,
  min_interval_years  int,                  -- NULL => rotation is ineffective
  inoculum_persistence_years_low  int,
  inoculum_persistence_years_high int,
  rotation_effective  boolean NOT NULL,
  alternative_control text,
  evidence            evidence_grade NOT NULL,
  citations           jsonb NOT NULL
);
```

**Rules the engine applies over this table:**

1. Only **grade A and B** interactions generate positive recommendations.
2. **Grade C** appears as "experimental / worth trying," never as a scoring input.
3. **Grades D and E** are excluded from scoring entirely; render only in a labelled "traditional practice" panel with the grade visible.
4. Any interaction with non-empty `requires_management` renders those steps **inline with the recommendation**, not in a tooltip.
5. Every recommendation surfaces `competition_penalty` alongside the benefit. A companion that reduces pest damage 30% but costs 25% yield to competition is not obviously a win.
6. `valid_climate` / `valid_region` / `valid_scale` are filters, not metadata. A result from 1-ha maize plots in Kenya does not fire for a 2 m² raised bed in Ohio.
7. Negative edges (`shared_pathogen`, `shared_pest`, `resource_competition`, `allelopathy_inhibitory`) are evaluated **before** positive ones. Avoiding a real harm beats capturing a marginal benefit.

---

## 5. Spatial, structural and temporal modelling

### 5.1 Plant spacing and competition

The classical agronomic result is the **law of constant final yield**: above a threshold density, total biomass per unit area is approximately independent of planting density; only yield *per plant* changes (Kira, Ogawa & Shinozaki 1953). What varies with density is the **partitioning** — and for vegetables the harvested organ is usually size-graded, so density controls product size, not total mass.

The workhorse model is the **reciprocal yield law**:

```
1/w = a + b·d
  w = mean yield per plant
  d = plant density (plants per unit area)
  a, b = fitted constants
Total yield per area:  Y = d·w = d / (a + b·d)
```

Independently derived by Shinozaki & Kira (1956), de Wit & Ennik (1958), Bleasdale & Nelder (1960), and Holliday (1960). Bleasdale & Nelder generalised it to `w^(-θ) = a + b·d` to accommodate the yield *decline* at very high density that the simple form cannot represent (the law of constant final yield is not always satisfied). Reviews: *"Yield-density equations and their application for agronomic research: a review,"* <https://www.researchgate.net/publication/284034177_Yield-density_equations_and_their_application_for_agronomic_research_a_review>; Bleasdale & Nelder, *Nature* 188:342 (1960), <https://www.nature.com/articles/188342a0>; Holliday, *Nature* 217:289 (1968), <https://www.nature.com/articles/217289a0>; and the competition review at <https://raco.cat/index.php/TreballsSCBiologia/article/download/14924/320425/0>.

**Recommended implementation.** Do not try to fit reciprocal-yield parameters for 200 crops — the data does not exist at garden scale. Instead:

- Store extension-published `spacing_in_row_cm`, `spacing_between_rows_cm`, and `spacing_equidistant_cm` (for bed/intensive layouts) per crop.
- Model each plant as an **exclusion disc** of radius `spacing_equidistant_cm / 2`.
- Compute a **crowding index** per plant: `C = Σ over neighbours of overlap_area / own_area`.
- Apply a monotone yield penalty in `C`, calibrated so that `C = 0` → 100% of catalogue yield and `C = 1` → roughly the reciprocal-yield prediction at double density. Present it as an estimate, not a number with decimals.
- **Do not use the reciprocal-yield law across species.** It is a monoculture model. Interspecific competition needs either a replacement-series/LER framing (§4.4) or an explicit resource-capture model.
- Note that "square foot gardening" densities are typically **tighter than extension recommendations** and depend on high fertility and irrigation. If the user selects an intensive layout, raise the water and fertility requirements accordingly rather than silently accepting the density.

### 5.2 Mature canopy footprints for 3D rendering

The renderer and the light model share this data, so define it once.

```
plant_geometry {
  taxon_id
  habit: enum { rosette, upright_herb, bush, vining_ground, vining_trellised,
                caned, columnar_tree, vase_tree, spreading_tree, groundcover,
                clumping_grass, rhizomatous }
  mature_height_m:      {min, typical, max}
  mature_width_m:       {min, typical, max}
  canopy_shape:         enum { sphere, hemisphere, ellipsoid, cone, cylinder,
                               vase, flat_disc, irregular }
  canopy_base_height_m         -- crown clearance; matters for underplanting
  leaf_area_index               -- for Beer-Lambert light attenuation
  light_extinction_k            -- Beer-Lambert coefficient (0.3-0.9 typical;
                                --  low for erectophile grasses/onion,
                                --  high for planophile squash/bean)
  transmittance_pct             -- derived: exp(-k * LAI)
  growth_curve: {               -- logistic; annuals keyed to GDD, perennials to years
    model: 'logistic',
    t_to_half_max, k_rate, asymptote_h, asymptote_w
  }
  deciduous: bool               -- deciduous canopies transmit ~60-80% in winter
  years_to_mature               -- perennials
  support_required: enum { none, stake, cage, trellis, arbor, espalier }
  footprint_polygon             -- optional non-radial footprint (espalier, row)
}
```

**Key modelling points:**

- **Shading is bidirectional and must be solved jointly.** In an agrivoltaic garden the panels shade the plants, the plants shade each other, and a mature fruit tree may shade the panels (an economic cost the designer should flag). Solve the whole scene, not the panels alone.
- Use **Beer–Lambert** for canopy transmittance: `T = exp(−k · LAI)`. This gives physically reasonable dappled-shade values for underplanting calculations and is cheap.
- Include **deciduous winter transmittance** — it is what makes spring ephemerals and understorey planting work.
- **Growth over time is a first-class requirement** for a 25-year solar asset. Render a timeline: year 1, year 5, year 15. A dwarf apple that fits between panel rows at planting will not at year 12.
- For the functional–structural approach to intercrop light capture, the maize/bean FSPM (<https://academic.oup.com/insilicoplants/article/7/2/diaf011/8203508>) is the reference implementation if higher fidelity is ever needed.

### 5.3 Succession and relay planting

Three distinct scheduling patterns to support:

1. **Succession sowing** — same crop, staggered sowings (e.g. lettuce every 14 days) for continuous harvest.
2. **Relay planting** — the next crop is established *into* the standing previous crop before it is removed, buying season length. Requires shade tolerance in the establishing crop, so it interacts directly with the DLI model.
3. **Sequential cropping** — full turnover of the bed (spring peas → summer beans → fall brassicas).

Scheduling algorithm:

```
FOR each candidate crop and each bed:
  window_start = max(
      last_spring_freeze_at(user_risk_percentile) + crop.frost_offset_days,
      date when soil_temp >= crop.min_soil_temp_c,
      date when monthly DLI_cell >= crop.dli_min )
  window_end   = first_fall_freeze_at(user_risk_percentile)
                   - crop.gdd_to_maturity_converted_to_days
                   - fall_slowdown_factor          -- shortening days slow maturation
  IF window_end < window_start: crop is infeasible in this bed -> exclude, with reason
  ELSE emit planting windows across [window_start, window_end] at crop.succession_interval
```

Prefer **GDD-based maturity** over calendar days: run the site's accumulated-GDD curve forward from each candidate sowing date and find where it crosses `gdd_to_maturity`. This automatically handles the fall slowdown that fixed-DTM scheduling gets badly wrong, and it transfers across latitudes. OSU Croptime / EM 9305 (§1.9) is the reference for vegetable GDD phenology models.

**The agrivoltaic twist:** DLI varies by month *and* by cell, so the feasible window differs per bed. A north-side bed may have a viable lettuce window in May–June but not in September when the sun is lower and panel shadows are longer. Compute windows **per (crop × bed)**, never per crop alone.

Also required: `days_to_first_harvest` vs. `harvest_duration_days` (a determinate bush bean and an indeterminate tomato occupy a bed very differently), and a bed-occupancy interval-scheduling solver so successions do not collide.

### 5.4 Root-depth stratification

Root-depth complementarity is one of the few companion mechanisms with direct experimental support (§4.7, Zhang et al. 2014: species differences in root foraging increase total soil exploration, with positive effects on growth and yield).

**Authoritative rooting-depth values: FAO Irrigation and Drainage Paper 56, Table 22** — maximum effective rooting depth `Zr` (m) and soil-water depletion fraction `p`. Full document: <https://www.fao.org/4/x0490e/x0490e00.htm>. Verified values:

| Crop | Zr (m) | p |
|---|---|---|
| Spinach | 0.3–0.5 | 0.20 |
| Radish | 0.3–0.5 | 0.30 |
| Lettuce | 0.3–0.5 | 0.30 |
| Garlic | 0.3–0.5 | 0.30 |
| Onion (dry) | 0.3–0.6 | 0.30 |
| Broccoli | 0.4–0.6 | 0.45 |
| Potato | 0.4–0.6 | 0.35 |
| Cabbage | 0.5–0.8 | 0.45 |
| Carrot | 0.5–1.0 | 0.35 |
| Sweet pepper | 0.5–1.0 | 0.30 |
| Bean (green) | 0.5–0.7 | 0.45 |
| Squash / zucchini | 0.6–1.0 | 0.50 |
| Pea (fresh) | 0.6–1.0 | 0.35 |
| Tomato | 0.7–1.5 | 0.40 |
| Cucumber | 0.7–1.2 | 0.50 |
| Sweet maize | 0.8–1.2 | 0.50 |
| Sweet melon | 0.8–1.5 | 0.40 |
| Sweet potato | 1.0–1.5 | 0.65 |

**Stratification classes** for guild construction:

- **Shallow** (< 0.5 m): lettuce, spinach, radish, garlic, onion, most greens
- **Medium** (0.5–1.0 m): brassicas, carrot, pepper, bean, pea, squash, potato
- **Deep** (> 1.0 m): tomato, sweet maize, melon, sweet potato, most perennials and trees

**Guild rule:** favour combinations spanning at least two strata; penalise combinations concentrated in one, especially the shallow stratum (they compete head-on for the same water and nutrient pool and dry the surface fastest).

`p` (depletion fraction) is a second, underused signal: it is the fraction of available soil water the crop can deplete before stress. Crops with **low p** (spinach 0.20, pepper 0.30, lettuce 0.30) are **drought-sensitive** and should be flagged as needing consistent irrigation — and are precisely the crops that benefit most from PV shade reducing evaporative demand. That is a genuinely useful, evidence-backed recommendation the engine can make that no conventional garden app can.

**Caution:** FAO-56 Zr values are for well-managed field crops in deep soils. Raised beds, containers, compaction pans, and shallow soils over bedrock all truncate them. Store `Zr_potential` from FAO-56 and compute `Zr_effective = min(Zr_potential, soil_depth_available)`.

---

## 6. The filtering pipeline

```
INPUT: lat/lon, panel array geometry, bed geometry, user preferences,
       risk tolerance percentile, irrigation availability

STAGE 0  SITE RESOLUTION
  raster point-samples  -> usda_zone_c | nrcan_zone, koppen_code
  Open-Meteo 30 yr      -> frost exceedance curves, GDD curves, chill (CH/CU/CP),
                           heat_days_ge_30C, monthly open-sky DLI
  soil source           -> pH, texture, drainage, effective depth
  ray-trace panel array -> per-cell monthly DLI, per-cell T_cell

STAGE 1  HARD CLIMATE GATE                         (boolean; excluded with a reason)
  perennials  : species cold limit <= site extreme min
  fruit trees : cultivar chill requirement <= site chill (matched metric)
  annuals     : crop gdd_to_maturity <= season GDD at chosen frost percentile
  all         : ECOCROP TMIN/TMAX absolute bounds not violated

STAGE 2  LIGHT GATE                                (the discriminating filter here)
  per (crop x bed): monthly DLI_cell during the crop's growing window >= dli_min
  soft penalty where DLI_cell < dli_target
  soft penalty where DLI_cell > dli_max_before_disorder (lettuce tipburn)
  BONUS where crop is shade-benefiting AND heat_days_ge_30C is high

STAGE 3  SOIL / WATER                              (soft, mostly mitigable)
  ECOCROP pH trapezoid; blueberry-type hard pH constraints stay hard
  irrigation: if unavailable, apply ECOCROP rainfall trapezoid and the
              FAO-56 depletion fraction p as a drought-sensitivity penalty

STAGE 4  SPACE AND STRUCTURE
  mature canopy footprint fits the bed at the target year
  height does not shade panels (flag the energy cost if it does)
  support requirement satisfiable
  root depth <= effective soil depth

STAGE 5  INTERACTIONS
  HARD  : rotation_constraint violations (clubroot, Solanaceae, white rot)
  HARD  : shared_pathogen / shared_pest negative edges
  SOFT  : allelopathy_inhibitory, resource_competition penalties
  BONUS : grade A/B positive interactions with already-selected plants,
          root-stratum complementarity, canopy complementarity,
          insectary bloom-succession coverage

STAGE 6  RANK AND EXPLAIN
  score = w1*light_fit + w2*climate_fit + w3*soil_fit
        + w4*interaction_bonus - w5*competition_penalty
        + w6*user_preference_match
  EVERY result carries: the limiting factor, the evidence grade of each
  contributing interaction, and the citations.
```

**Design rule: never return an unexplained exclusion.** ECOCROP's minimum-across-parameters structure gives you the limiting factor for free; use it. "Not recommended: only 8 mol·m⁻²·d⁻¹ available in this bed in July, tomatoes need 14+" is a good answer. A silently missing tomato is not.

---

## 7. Known gaps and things to verify before shipping

1. **Faust & Logan (2018) full text was not retrievable** (ASHS returns 403 to automated fetch). Bibliographic details and method are confirmed from multiple secondary sources; the map's numeric contours are not. Obtain the PDF before using it as a calibration reference.
2. **The agrivoltaics meta-analysis (Agron. Sustain. Dev. 2025) is paywalled to automated fetch.** The 50% shade tipping point and the shade-tolerant/sensitive crop groupings are consistently reported across reviews, but sample sizes and confidence intervals were not verified here. Get the full text before quoting effect sizes.
3. **The "Beck et al. 2012" 50%-shade threshold** is cited *within* the agrivoltaic reviews; the primary reference was not located and should be traced.
4. **Most DLI values in §3.6 are Tier C inferences.** This is a genuine gap in the horticultural literature, not a research failure here. Treat the ordinal ranking as reliable and the absolute values as provisional. Highest-value follow-up: a systematic review of shade-cloth trials (which report % shading and can be converted to DLI given site radiation) would upgrade 20–30 rows from C to B.
5. **Soil data sources (SoilGrids, SSURGO) have not been researched.** Verify licence terms and resolution before committing.
6. **OSU Croptime's actual crop and cultivar coverage** was not enumerated (search budget exhausted). Confirm which vegetables have published GDD models before designing around GDD-based scheduling.
7. **PFAF licensing needs legal review.** CC BY-SA on the content is viral for a derivative database, and the image terms add non-commercial and no-derivatives restrictions. Same for Permapeople (CC BY-SA 4.0).
8. **Per-crop shade-response functions conditional on climate** (§3.5, point 1) do not exist in the literature in usable form. Ship a two-context approximation (hot/arid vs. cool/humid) and improve it with user-reported outcomes.
9. Several secondary sources were used for base-temperature and DLI values (trackgdd.com, hydroponics blogs, ReduSystems). **Every value that reaches a hard filter must be traced to a primary or extension source before release.**

---

## 8. Reference list

Full URLs are inline throughout. Principal primary sources:

- Beck, H.E. et al. (2018). Present and future Köppen-Geiger climate classification maps at 1-km resolution. *Scientific Data* 5:180214.
- Bleasdale, J.K.A. & Nelder, J.A. (1960). Plant population and crop yield. *Nature* 188:342.
- Faust, J.E. & Logan, J. (2018). Daily light integral: a research review and high-resolution maps of the United States. *HortScience* 53(9):1250–1257.
- Fiedler, A.K. & Landis, D.A. (2007). Attractiveness of Michigan native plants to arthropod natural enemies and herbivores. *Environmental Entomology* 36(4):751–765.
- Finch, S. & Collier, R.H. (2000). Host-plant selection by insects – a theory based on 'appropriate/inappropriate landings'. *Ent. Exp. Appl.* 96:91–102.
- Finch, S. & Collier, R.H. (2003). Companion planting – do aromatic plants disrupt host-plant finding …? *Ent. Exp. Appl.*
- Fishman, S., Erez, A., Couvillon, G.A. (1987a,b). The temperature dependence of dormancy breaking in plants (Dynamic model).
- Holden, M.H. et al. (2012). Designing an effective trap cropping strategy. *J. Applied Ecology* 49.
- Holliday, R. (1968). Plant competition and crop yield. *Nature* 217:289.
- Kattge, J. et al. (2020). TRY plant trait database – enhanced coverage and open access. *Global Change Biology* 26(1):119–188.
- Khan, Z.R. et al. (2010). Exploiting phytochemicals for developing a 'push–pull' crop protection strategy. *J. Exp. Bot.* 61(15):4185.
- Luedeling, E. & Brown, P.H. (2011). A global analysis of the comparability of winter chill models. *Int. J. Biometeorol.*
- Luedeling, E. et al. (2011). The Dynamic Model provides the best description of the chill process. *HortScience* 46(3):420–425.
- Martin-Guay, M.-O. et al. (2018); Yu, Y. et al. (2015) — LER meta-analyses.
- McKenney, D.W. et al. (2001). Canada's plant hardiness zones revisited. *Can. J. Plant Sci.*
- Ouellet, C.E. & Sherk, L.C. (1967). Woody ornamental plant zonation indices of winter hardiness.
- Shelton, A.M. & Badenes-Pérez, F.R. (2006). Concepts and applications of trap cropping. *Annu. Rev. Entomol.* 51.
- Shinozaki, K. & Kira, T. (1956). Intraspecific competition among higher plants VII: logistic theory of the C-D effect.
- Thilakarathna, M.S. et al. (2016). Belowground nitrogen transfer from legumes to non-legumes.
- Zhang, C., Postma, J.A., York, L.M., Lynch, J.P. (2014). Root foraging elicits niche complementarity-dependent yield advantage in the ancient 'three sisters' polyculture. *Annals of Botany* 114(8):1719–1733.
- Allen, R.G. et al. (1998). *Crop evapotranspiration.* FAO Irrigation and Drainage Paper 56 (Table 22).
- FAO ECOCROP database (1999–). USDA-ARS/OSU PRISM (2023). USDA Plant Hardiness Zone Map.
- OSU Extension EM 9305. Vegetable degree-day models. Purdue HO-238-B-W / Virginia Coop. Ext. SPES-720 (DLI).
