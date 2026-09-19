# Agrivoltaic Science: Technical Requirements Brief for a Design Tool

Prepared 2026-07-29. Scope: the physics, agronomy, and regulatory constraints that a browser-based
agrivoltaic (APV) garden design tool must encode, with primary-literature citations for every
quantitative claim.

**Evidence-quality convention used throughout:**

- **[P]** peer-reviewed journal article, number read from the paper or its abstract
- **[C]** conference proceedings / preprint (peer-review status noted inline)
- **[S]** standard, statute, or regulatory guidance document
- **[E]** extension-service or industry guidance, *not* peer-reviewed field data
- **[?]** number could not be verified against a primary source, treat as provisional
- **THIN** marks places where the evidence base is genuinely weak and the tool should express uncertainty

---

## 1. Core metrics

### 1.1 Land Equivalent Ratio (LER)

LER is imported from intercropping agronomy into APV by Dupraz et al. (2011) **[P]**. The general form
for a two-output system is the sum of partial LERs, each being the co-located yield of one output
divided by the yield of that output in its own sole-use reference system:

```
LER = LER_crop + LER_energy
    = (Y_crop,APV  / Y_crop,mono)  +  (E_elec,APV / E_elec,PVonly)
```

- `Y_crop,mono` = yield of the same crop, same cultivar, same season, on an unshaded control plot of
  equal area at the same site.
- `E_elec,PVonly` = electricity from a conventional ground-mounted PV plant occupying the same total
  land area (**not** the same module count). This denominator choice is the single most consequential
  modelling decision in the metric and is often left implicit in the literature.

`LER > 1` means the co-located system delivers more total output per hectare than segregating the two
land uses. `LER = 1` is the break-even line.

**Reported values:**

| Source | System | LER |
|---|---|---|
| Dupraz et al. 2011 **[P]** | Half-density fixed APV, Montpellier FR | **1.35** |
| Dupraz et al. 2011 **[P]** | Full-density fixed APV, Montpellier FR | **1.73** |
| Amaducci et al. 2018 **[P]** | Agrovoltaico tracking, maize, N. Italy | **>1 in all scenarios**, best scenario produced ~2× the energy per unit area of segregated PV + monoculture biogas maize |
| Weselek et al. 2019 (review) **[P]** | APV generally | land productivity increase **up to 70%** (LER ≈ 1.7) |
| Trommsdorff et al. 2021 **[P]** | Heggelbach DE, drought year 2018 | land-use efficiency **~180–186%** |

Dupraz, C., Marrou, H., Talbot, G., Dufour, L., Nogier, A., Ferard, Y. (2011). Combining solar
photovoltaic panels and food crops for optimising land use: towards new agrivoltaic schemes.
*Renewable Energy* 36(10):2725–2732. DOI [10.1016/j.renene.2011.03.005](https://doi.org/10.1016/j.renene.2011.03.005)

> **Caveat the tool must surface:** in Dupraz et al. (2011) the *crop* term was **simulated**, not
> measured — the paper is a modelling study whose crop model was parameterised on lettuce. The
> "35–73% increase in global land productivity" headline is therefore a model output, not an
> observation. The specific assignment of 1.35→half-density and 1.73→full-density is the standard
> reading of "35–73% increase for the two densities" and is monotonically consistent, but was
> inferred rather than read verbatim from the paper text **[?]**.

Amaducci, S., Yin, X., Colauzzi, M. (2018). Agrivoltaic systems to optimise land use for electric
energy production. *Applied Energy* 220:545–561. DOI [10.1016/j.apenergy.2018.03.081](https://doi.org/10.1016/j.apenergy.2018.03.081)

Trommsdorff, M. et al. (2021). Combining food and energy production: design of an agrivoltaic system
applied in arable and vegetable farming in Germany. *Renewable and Sustainable Energy Reviews*
140:110694. DOI [10.1016/j.rser.2020.110694](https://doi.org/10.1016/j.rser.2020.110694)

**Implementation note.** A garden-scale tool should compute and display *both partial LERs separately*
plus their sum. Displaying only the sum hides the fact that most APV LER gains come from the energy
term, which is nearly insensitive to crop choice. Also note that LER is **not** the metric any
regulator uses (see §6): DIN SPEC 91434 uses a 66%-of-reference-yield floor, France uses 90% of a
control zone, Japan uses 80% of regional average. The tool should report against those thresholds
directly rather than expecting LER to satisfy them.

### 1.2 PAR versus global horizontal irradiance

Photosynthetically active radiation is the 400–700 nm band, defined by the action spectrum of crop
photosynthesis in McCree, K.J. (1972). The action spectrum, absorptance and quantum yield of
photosynthesis in crop plants. *Agricultural Meteorology* 9:191–216.
DOI [10.1016/0002-1571(71)90022-7](https://doi.org/10.1016/0002-1571(71)90022-7)

**PAR as an energy fraction of broadband global horizontal irradiance (GHI):**

| Source | PAR/GHI (energy basis) | Notes |
|---|---|---|
| Britton & Dodd (1976) **[P]** | **0.41–0.45** | *Agricultural Meteorology* 17:1–7. DOI [10.1016/0002-1571(76)90080-7](https://doi.org/10.1016/0002-1571(76)90080-7) |
| Meek et al. (1984) **[P]** | **≈0.45** | *Agronomy Journal* 76:939–945. DOI [10.2134/agronj1984.00021962007600060018x](https://doi.org/10.2134/agronj1984.00021962007600060018x). Derived from paired year-long PAR/shortwave records, Fresno CA, band 0.285–2.8 µm |
| Jacovides et al. (2004) **[P]** | **0.451 (winter) – 0.456 (summer)**, annual mean ≈0.454, up to **0.501** hourly under overcast sky | *Agricultural and Forest Meteorology* 121:135–140. DOI [10.1016/j.agrformet.2003.10.001](https://doi.org/10.1016/j.agrformet.2003.10.001) |

**Recommended tool default: PAR/GHI = 0.45 by energy, with a user-adjustable 0.42–0.50 range.**
The ratio rises under overcast/diffuse conditions (water vapour and aerosol absorb preferentially in
the near-infrared), so a fixed 0.45 slightly *under*-estimates PAR on cloudy days and in humid
climates. For a garden-scale tool this bias is second-order relative to the shading-geometry
uncertainty (§5) and a constant fraction is defensible.

**Energy-to-photon conversion:**

- Within the PAR band itself, solar radiation carries **≈4.57 µmol photons per joule** (commonly
  rounded to 4.6). This derives from McCree's 1972 action-spectrum work and the spectral weighting
  in Sager, J.C., Smith, W.O., Edwards, J.L., Cyr, K.L. (1988), *Transactions of the ASAE* 31:1882–1889 **[P]**.
- Applied to **broadband** GHI, the composite factor is `0.45 × 4.57 ≈ 2.06 µmol J⁻¹`, which is why the
  literature shorthand "**~2.0–2.3 µmol per joule of total solar**" appears. The spread reflects the
  0.42–0.50 PAR-fraction range, not disagreement about the photon conversion.

### 1.3 Daily Light Integral (DLI)

```
DLI (mol m⁻² d⁻¹) = ∫ PPFD(t) dt  ≈  Σ_t  PPFD_t (µmol m⁻² s⁻¹) × Δt (s) / 1e6
```

Worked example (Torres & Lopez, Purdue Extension HO-238-W **[E]**,
<https://www.extension.purdue.edu/extmedia/ho/ho-238-w.pdf>):
500 µmol m⁻² s⁻¹ sustained over a 12 h photoperiod = 500 × 43,200 / 1e6 = **21.6 mol m⁻² d⁻¹**.

**From broadband irradiance directly** (the path a design tool will actually take, since TMY files
supply GHI in W m⁻² or Wh m⁻²):

```
DLI = GHI_daily (MJ m⁻² d⁻¹) × 1e6 (J/MJ) × f_PAR (0.45) × 4.57 (µmol/J) / 1e6 (µmol/mol)
    ≈ GHI_daily (MJ m⁻² d⁻¹) × 2.06
```

Example: a 20 MJ m⁻² d⁻¹ summer day → PAR energy 9 MJ m⁻² d⁻¹ → **DLI ≈ 18.5–18.9 mol m⁻² d⁻¹**
at 100% transmission. Equivalent form for kWh: `DLI ≈ GHI (kWh m⁻² d⁻¹) × 7.4`.

US ambient DLI reference maps: Faust, J.E. & Logan, J. (2018). Daily Light Integral: a research
review and high-resolution maps of the United States. *HortScience* 53(9):1250–1257. DOI
[10.21273/HORTSCI13144-18](https://doi.org/10.21273/HORTSCI13144-18) **[P]**. Earlier monthly maps:
Korczynski, P.C., Logan, J., Faust, J.E. (2002), *HortTechnology* 12:12–16 **[P]**. Use these for
the tool's "ambient DLI at your location" baseline. Note: the internal crop-specific DLI tables in
Faust & Logan could not be extracted, cite these two for **ambient DLI maps only**, not for per-crop
thresholds **[?]**.

### 1.4 Light saturation and light compensation points

| Quantity | C3 | C4 | Source class |
|---|---|---|---|
| Light compensation point (LCP) | **~8–16 µmol m⁻² s⁻¹** | **~6–14 µmol m⁻² s⁻¹** | plant-physiology consensus (Taiz & Zeiger framing), shade leaves at low end, sun leaves at high end **[E/P]** |
| Light saturation point (LSP), leaf level | **~500 µmol m⁻² s⁻¹** (~25% of the ~2000 µmol m⁻² s⁻¹ midday clear-sky maximum) | **rarely saturates even at full sunlight** | see below |
| LSP as fraction of full sun, canopy level, C3 crops | **25–60% of maximum sunlight** | n/a | Pang et al. (2019) and Carrier et al. (2019), as cited in Laub et al. 2022 §4.3 **[P, secondary citation]** |

The C3/C4 asymmetry is the single most important physiological fact for crop selection. Because C4
species (maize, sorghum, amaranth, warm-season grasses such as bermudagrass) do not light-saturate,
every photon removed by a panel is a direct photosynthesis penalty. This is corroborated empirically:
Laub et al. (2022) found maize the **most** shade-susceptible of nine crop groups, with
**45% of control yield at 40% radiation reduction (95% CI 37–56%)** **[P]**.

Crop-specific LSP found: highbush blueberry (*Vaccinium corymbosum*) saturates near
**500 µmol m⁻² s⁻¹** under field conditions, with Pmax, apparent quantum yield, LCP and LSP all
declining under sustained low light (PLOS ONE 2024, "Response of blueberry photosynthetic physiology
to light intensity during different stages of fruit development") **[P]**.

> **Important distinction the tool must preserve.** Leaf-level saturation ≠ canopy-level saturation.
> A closed canopy has shaded lower leaves operating far below saturation even when the top leaves
> are saturated, so whole-canopy carbon gain keeps increasing with irradiance well past the leaf LSP.
> This is why the naive "C3 crops saturate at 25% of full sun, therefore 75% shade is free" inference
> is wrong, and why the empirical shade-response curves in §2 are the correct basis for a yield model
> — not the leaf LSP.

---

## 2. Shade response by crop

### 2.1 The anchor: Laub et al. (2022) meta-analysis

Laub, M., Pataczek, L., Feuerbacher, A., Zikeli, S., Högy, P. (2022). Contrasting yield responses at
varying levels of shade suggest different suitability of crops for dual land-use systems: a
meta-analysis. *Agronomy for Sustainable Development* 42:51.
DOI [10.1007/s13593-022-00783-7](https://doi.org/10.1007/s13593-022-00783-7) **[P]** — open access.
Underlying dataset: Zenodo DOI [10.5281/zenodo.5716091](https://doi.org/10.5281/zenodo.5716091).

**Method.** 613 records screened → **58 studies**, **38 crop species**, **428 data points** (340
excluding controls), aggregated to **nine crop groups**. Temperate and subtropical sites only
(tropics excluded), greenhouse experiments excluded, studies with confounded treatments (e.g.
simultaneous irrigation reduction) excluded. Response variable = relative crop yield vs unshaded
control, log10-transformed, regressed on **RSR** (relative reduction in solar radiation, %) with a
quadratic term, forced through the origin (0% RSR ≡ 100% yield), with random slopes for site.

**Key statistical findings:**

- The RSR² term is a significant predictor (p = 0.0015) → **the yield–shade relationship is
  non-linear for every crop group**. A linear "% shade = % yield loss" model is empirically wrong.
- RSR × crop type is highly significant (p < 0.0001) → **crop group must be a first-class input**.
- **No significant effect** of shade *type* (PV panels vs shade cloth vs nets vs intercropping),
  experiment type, or absolute annual radiation at the site. This is the finding that licenses a
  design tool to use shade-cloth and intercropping data as proxies for panel shade.

**Quantitative results (Table below is the core lookup table a tool should encode):**

| Crop group | n studies | Yield rises up to RSR ≈ | Yield @ 20% RSR | Yield @ 40% RSR (95% CI) | Classification |
|---|---|---|---|---|---|
| Berries | 5 | **30%** | **114%** | **114% (84–154)** | shade-benefiting |
| Fruits | 7 | **25%** | **114%** | **113% (84–152)** | shade-benefiting |
| Fruity vegetables | 3 | **20%** | **108%** | **102% (67–156)** | shade-benefiting |
| Forages | 11 | — (benefit to ~25% RSR) | **103%** | **93% (75–117)** | shade-benefiting → tolerant |
| Leafy vegetables | 4 | — | ~100% | **86% (61–120)** | shade-tolerant |
| Tubers / root crops | 2 | — | — | disproportionate losses begin shortly after C3 cereals | tolerant → susceptible |
| C3 cereals | 10 | — | less-than-proportional decline **only to 15% RSR**, disproportionate losses begin at **10% RSR**, shade-tolerant to 50% RSR, susceptible above | — | tolerant to 50%, then susceptible |
| Grain legumes | 14 | — | — | **50% (41–61)** | **shade-susceptible from ~1% RSR** |
| Maize (C4) | 10 | — | — | **45% (37–56)** | **most susceptible, disproportionate loss from ~1% RSR** |

Additional statements from the paper:

- "Most crops tolerate reduced solar radiation up to **15%**, showing a less than proportional yield
  decline."
- "At around **50% of shading, all crops show susceptibility.**"
- Berries reach their **highest** predicted yield at **~30% RSR**.
- Forages are shade-benefiting to **25% RSR** and shade-tolerant above that.
- Typical RSR ranges in real APV: **half-density fixed panels 28–50% RSR**, **tracking systems
  15–36% RSR**, **full-density fixed 50%+ RSR** (Laub §4.3, citing Dupraz 2011, Elamri 2018,
  Amaducci 2018, Marrou 2013a, Valle 2017, Majumdar & Pasqualetti 2018).

**Limitations the tool must not paper over:**

1. **Prediction intervals are enormous.** Fruity vegetables at 40% RSR: 67–156%. Berries: 84–154%.
   The tool should render a band, not a point estimate.
2. **n = 2 for tubers/root crops, n = 3 for fruity vegetables, n = 4 for leafy vegetables.** These
   three groups — precisely the ones a home-garden tool cares most about — rest on the thinnest data
   in the entire meta-analysis. **THIN.**
3. **Reporting-basis bias.** Cereals and grain legumes are reported on a *dry matter* basis, fruits,
   berries and fruity vegetables on a *fresh biomass* basis. Shade reduces evapotranspiration, which
   raises tissue water content. Part of the apparent "shade benefit" for fresh-weight crops may be
   water, not carbon. Laub et al. explicitly flag this. Artru et al. (2018) found sugar beet under
   continuous shade had significantly *increased* water content while root *dry matter* decreased,
   giving a net reduction in per-area sugar yield.
4. **Single-season bias.** Most included studies collected one or two years of data. Atlan et al.
   (2015) showed deleterious shade effects in perennials **accumulate over years**, so the
   berry/fruit optimism may be overstated for a permanent installation. **THIN.**
5. Estimating shade effects at **RSR > 75%** is associated with high uncertainty — few observations.

### 2.2 Field trials, by system

**Marrou et al., Montpellier FR (43.6°N, Mediterranean) — the foundational APV crop trials**

- Marrou, H., Wery, J., Dufour, L., Dupraz, C. (2013a). Productivity and radiation use efficiency of
  lettuces grown in the partial shade of photovoltaic panels. *European Journal of Agronomy* 44:54–66.
  DOI [10.1016/j.eja.2012.08.003](https://doi.org/10.1016/j.eja.2012.08.003) **[P]**
  Two panel densities transmitting **50%** (full density) and **70%** (half density) of incoming
  radiation, i.e. **50% and 30% RSR**. Four cultivars (two crisphead, two cutting), two seasons.
  **Relative lettuce yield at harvest was equal to or higher than the relative available radiation in
  all cases.** Mechanism: radiation *interception* efficiency (RIE) rose in the shade — leaves
  expanded, total and specific leaf area increased — while radiation *conversion* efficiency (RCE)
  fell. Net: partial compensation.
- Marrou, H., Guilioni, L., Dufour, L., Dupraz, C., Wery, J. (2013b). Microclimate under agrivoltaic
  systems: is crop growth rate affected in the partial shade of solar panels? *Agricultural and
  Forest Meteorology* 177:117–132. DOI
  [10.1016/j.agrformet.2013.04.012](https://doi.org/10.1016/j.agrformet.2013.04.012) **[P]**
  Lettuce, cucumber, durum wheat, bean. Leaf-emission-rate differences appeared only in the
  **juvenile phase (first ~3 weeks)**, crops largely acclimated thereafter. Water and nitrogen
  non-limiting in this experiment, so it isolates the pure light effect.
- Marrou, H., Dufour, L., Wery, J. (2013c). How does a shelter of solar panels influence water flows
  in a soil–crop system? *European Journal of Agronomy* 50:38–51.
  DOI [10.1016/j.eja.2013.05.004](https://doi.org/10.1016/j.eja.2013.05.004) **[P]**
  Actual evapotranspiration reduced **10–30%** at 50–70% transmitted light.

**Barron-Gafford et al., Biosphere 2, Tucson AZ (32.6°N, semi-arid) — the dryland benefit case**

Barron-Gafford, G.A., Pavao-Zuckerman, M.A., Minor, R.L., Sutter, L.F., Barnett-Moreno, I.,
Blackett, D.T., Thompson, M., Dimond, K., Gerlak, A.K., Nabhan, G.P., Macknick, J.E. (2019).
Agrivoltaics provide mutual benefits across the food–energy–water nexus in drylands.
*Nature Sustainability* 2:848–855. DOI [10.1038/s41893-019-0364-5](https://doi.org/10.1038/s41893-019-0364-5) **[P]**

| Crop | Effect under panels |
|---|---|
| Chiltepín pepper (*Capsicum annuum* var. *glabriusculum*) | total fruit production **3× greater** |
| Cherry tomato | production **2× greater**, CO₂ uptake and WUE each **+65%** |
| Jalapeño | fruit production **similar** to control, achieved with **65% less transpirational water loss**, WUE **+157%** |

Microclimate: soil moisture **~15% higher** under panels on an alternate-day irrigation regime, air
temperature **~1 °C cooler by day, ~0.5 °C warmer at night** (i.e. compressed diurnal range), lower
VPD and higher RH under panels. The daytime/nighttime temperature figures and the VPD/RH direction
are from University of Arizona press materials rather than extracted from the paywalled tables
**[?]**.

> **Critical caveat for a design tool.** This is the most-cited APV crop result and it is the *least*
> generalisable. It is a semi-arid, irrigated, high-VPD site where the limiting factor is water and
> heat, not light. Do **not** let a tool extrapolate 2–3× yield gains to temperate gardens.

**Weselek et al., Heggelbach DE (47.9°N, temperate) — the temperate reality check**

Weselek, A., Bauerle, A., Hartung, J., Zikeli, S., Lewandowski, I., Högy, P. (2021). Agrivoltaic
system impacts on microclimate and yield of different crops within an organic crop rotation in a
temperate climate. *Agronomy for Sustainable Development* 41:59.
DOI [10.1007/s13593-021-00714-y](https://doi.org/10.1007/s13593-021-00714-y) **[P]**

PAR reduced on average **~30%** under the array (i.e. ~70% transmission). Two seasons, 2017 (normal)
and 2018 (hot, dry).

| Crop | 2017–2018 yield range vs reference | 2018 (drought year) specifically |
|---|---|---|
| Winter wheat | **−19% to +3%** | **+2.7%** |
| Potato | **−20% to +11%** | **+11%** |
| Grass-clover | **−8% to −5%** | — |
| Celeriac | not significantly reduced, **aerial biomass increased** | — |

Plant height increased for all crops under APV (classic shade-avoidance). Soil temperature decreased
in summer in both years, soil moisture reduced, **air temperature tended to be *higher* under the
array** — the opposite sign to the Arizona result, and an important contradiction (see §3).

Companion design paper: Trommsdorff et al. (2021), *Renew. Sustain. Energy Rev.* 140:110694, DOI
[10.1016/j.rser.2020.110694](https://doi.org/10.1016/j.rser.2020.110694) **[P]** — reports the
as-built system delivered **~70% available PAR**, better than pre-construction simulation predicted,
literature-wide light reductions of **12–40%** depending on module density and orientation, land-use
efficiency **~180–186%** in the 2018 drought year.

Drought-mitigation mechanism confirmed in: Pataczek, L. et al. (2023). Agrivoltaics mitigate drought
effects in winter wheat. *Physiologia Plantarum*. DOI [10.1111/ppl.14081](https://doi.org/10.1111/ppl.14081) **[P]**

**Amaducci / Ferrara, Piacenza IT (45°N) — the tracking-system modelling case**

Amaducci, S., Yin, X., Colauzzi, M. (2018). *Applied Energy* 220:545–561. DOI
[10.1016/j.apenergy.2018.03.081](https://doi.org/10.1016/j.apenergy.2018.03.081) **[P]** 40-year
climate record, rainfed maize, coupled radiation/shading model + GECROS crop model. Global radiation
reduction: **29.5%** (double density) vs **13.4%** (single density), **23.2%** (sun-tracking) vs
**20.0%** (static). Under **rainfed** conditions mean grain yield was **higher and more stable**
under Agrovoltaico than in full light, and the advantage **increased proportionally with drought
stress**. LER > 1 in all configurations, rising with panel density and with tracking.

> Note the apparent tension with Laub et al., who rank maize the most shade-susceptible crop. It is
> resolvable: Laub's maize data are predominantly from experiments where water was **not** the limiting
> factor, whereas Amaducci's advantage appears only in the **rainfed, drought-stressed** simulations.
> A design tool must therefore gate the "shade helps" pathway on a water-limitation flag, not apply
> it universally.

**Hassanpour Adeh et al., Oregon (44.5°N, temperate, unirrigated pasture)**

Hassanpour Adeh, E., Selker, J.S., Higgins, C.W. (2018). Remarkable agrivoltaic influence on soil
moisture, micrometeorology and water-use efficiency. *PLOS ONE* 13(11):e0203256. DOI
[10.1371/journal.pone.0203256](https://doi.org/10.1371/journal.pone.0203256) **[P]** Late-season
biomass **+90%** under panels, **+126% dry biomass** in shaded zones specifically, WUE **+328%**,
soil moisture nearly **2×** the open control by season end (~0.3 vs ~0.2 vol/vol at 0.6 m). Only 40
mm precipitation fell during the May–Aug 2015 study window, so this is effectively a drought-stress
result in a nominally temperate climate.

**Japanese "solar sharing"** — despite the scheme dating to 2013 and covering **6,137 approved sites
on 1,361.6 ha by end of FY2023**, the peer-reviewed crop-response literature in English is very
sparse. Doedt, C., Tajima, M., Iida, T. (2022/2024). Agrivoltaics in Japan: a legal framework
analysis. *AgriVoltaics Conference Proceedings* 1. DOI [10.52825/agripv.v1i.533](https://doi.org/10.52825/agripv.v1i.533) **[C]**
explicitly identifies as a top-tier policy barrier that Japan's **yield requirement is not based on
scientific evidence**, and that "there is a lack of academic research regarding the growth of crops
under shading in the Japanese environment." A frequently repeated "**~32% shading rate recommended**"
figure traced to Chiba Prefecture trials is **industry commentary, not peer-reviewed** **[?] THIN.**

### 2.3 Per-crop notes from other primary sources

- **Bell pepper**: at ≥26% RSR, fruit *number* per plant declined but individual fruits were heavier
  and larger, compensating in total yield — Rylski, I. & Spigelman, M. (1986), cited in Laub §4.2 **[P]**.
- **Alfalfa** (*Medicago sativa*): maintains adequate photosynthetic activity at **50% RSR and above** —
  Varella et al. (2011), cited in Laub §4.2 **[P]**.
- **Forages**: no effect on dry matter yield at **30% RSR** (Mercier et al. 2020) and **45% RSR**
  (Pang et al. 2019), Pang et al. reported a slight *increase* at 45% RSR for some species **[P, via
  Laub]**.
- **Blueberry**: yield *increase* under shade in subtropical Chile, attributed by Retamales et al.
  (2008) to relief from heat stress improving fruit set **[P, via Laub]**.
- **Blackberry** (*Rubus ulmifolius*): cumulative berry yield increased under shade in Italy via
  physiological adaptation and prolonged harvest period — Rotundo et al. (1998) **[P, via Laub]**.
- **Soybean**: seed yield **−30% under 33% shading** (intercropping literature, not APV) **[P, indirect]**.
- **Strawberry / raspberry**: see §4 — the Swiss multi-site DLI thresholds are the most directly
  actionable numbers in the whole berry literature.
- **Potato, Northern Italy, 4-year APV trial**: **~13% seasonal shading → ~12% yield penalty**,
  higher-shade configurations **>30% reduction**, tuber initiation identified as the critical
  light-sensitive stage **[P]**. This contradicts Weselek's **+11%** for potato — the difference is
  almost certainly water status (drought year at Heggelbach vs adequate water in Italy), reinforcing
  the water-gating rule above.
- **Pears under semi-transparent panels, Belgium**: yield reduced **consistently**, fruit quality
  maintained — *Agronomy for Sustainable Development* (2025), DOI [10.1007/s13593-025-01019-0](https://doi.org/10.1007/s13593-025-01019-0) **[P]**.
  A useful counterweight to the meta-analytic optimism about "fruits".

### 2.4 A caution about published linear regressions

Tekie, S., Zainali, S., Zidane, T.E.K., Lu, S.M., Guezgouz, M., Zhang, J., Amaducci, S., Campana, P.E.
(2024). Unravelling the crop yield response under shading conditions through the deployment of a
drought index. EarthArXiv preprint, submitted to *Environmental Research Letters*, **not yet peer
reviewed** **[C]**. <https://eartharxiv.org/repository/object/7354/>

This work extends Laub's dataset to 84 studies (59 usable, 41 non-irrigated) and adds SPEI (drought
index) as a covariate. Adding SPEI raised R² substantially across every crop category (C3 cereals
0.64→0.88, leafy vegetables 0.44→0.99, maize 0.19→0.79, grain legumes 0.52→0.91), which **strongly
supports the design principle that water status must modulate the shade-response curve**.

However, its published *linear* shade-only equations are not usable as a yield model. For example
`Berries: Y = −13.36 + 2.22·X₁` predicts 0% yield at 0% shade and 209% at 100% shade, `Leafy
vegetables: Y = 58.49 + 1.31·X₁` (n = 5, p = 0.216, not significant). These are artefacts of fitting
a line to a narrow, small-n, non-irrigated subset. **Cite this paper for the SPEI insight, do not
encode its coefficients.**

---

## 3. Microclimate effects

### 3.1 Water: evaporation, ET, and water-use efficiency

| Effect | Magnitude | Source |
|---|---|---|
| Actual evapotranspiration reduction | **10–30%** at 50–70% transmitted light | Marrou et al. 2013c, *Eur. J. Agron.* 50:38–51 **[P]** |
| Lettuce water consumption reduction | **~20%** | Elamri, Y., Cheviron, B., Lopez, J.-M., Dejean, C., Belaud, G. (2018). Water budget and crop modelling for agrivoltaic systems: application to irrigated lettuces. *Agricultural Water Management* 208:440–453. DOI [10.1016/j.agwat.2018.07.001](https://doi.org/10.1016/j.agwat.2018.07.001) **[P]** |
| Irrigation reduction achievable | **20%** while accepting a **10% yield reduction** (or a slightly longer cycle instead) | Elamri et al. 2018 **[P]** |
| WUE increase, cherry tomato | **+65%** | Barron-Gafford et al. 2019 **[P]** |
| WUE increase, jalapeño | **+157%** | Barron-Gafford et al. 2019 **[P]** |
| WUE increase, unirrigated pasture | **+328%** | Hassanpour Adeh et al. 2018 **[P]** |
| Soil moisture, arid irrigated | **+15%** | Barron-Gafford et al. 2019 **[P]** |
| Soil moisture, temperate rainfed pasture | **~2×** by season end | Hassanpour Adeh et al. 2018 **[P]** |
| Soil moisture, temperate arable | **reduced** under APV | Weselek et al. 2021 **[P]** |

> **The soil-moisture sign flips between studies.** Oregon pasture: nearly doubled. Arizona irrigated
> row crops: +15%. Heggelbach arable: *reduced*. The mechanism for the Heggelbach result is rain
> interception and redistribution (§3.4) outweighing evaporation savings on a site that was not
> water-limited. A tool must not assert "panels save water" unconditionally.

### 3.2 Temperature

| Variable | Effect | Source |
|---|---|---|
| Air temperature, day (semi-arid AZ) | **~1 °C cooler** | Barron-Gafford et al. 2019 **[?]** (press-derived) |
| Air temperature, night (semi-arid AZ) | **~0.5 °C warmer** | Barron-Gafford et al. 2019 **[?]** |
| Air temperature (temperate DE) | **tended to be higher** under array | Weselek et al. 2021 **[P]** |
| Air temperature (temperate OR) | significant differences at 1.2 m and 2.0 m, but "magnitudes smaller" than the 3–5 °C some simulations predicted | Hassanpour Adeh et al. 2018 **[P]** |
| Soil temperature, summer | **decreased** | Weselek et al. 2021 **[P]**, Amaducci et al. 2018 (modelled) **[P]** |
| Aggregate "air and soil 1–4 °C lower" | widely repeated | attributed to Weselek et al. 2019 review, **could not be verified against the primary text and recurs verbatim across secondary sources — treat as a literature-wide range, not a measurement [?]** |

**Design implication:** soil-temperature cooling under panels is consistent across studies, air- and
canopy-temperature effects are **not** and depend on climate. Encode soil cooling, make
air-temperature moderation climate-conditional and label it low-confidence. **THIN.**

### 3.3 Humidity and VPD

Direction is consistent — **lower VPD, higher RH under panels** — in every study located
(Barron-Gafford et al. 2019, Hassanpour Adeh et al. 2018, which found RH significantly different
from control at all measurement heights). **Exact numeric deltas were not extractable from the
accessible texts. THIN.** A secondary but practically important consequence: reduced wind plus
elevated humidity under panels raises **fungal/mildew disease pressure** relative to open-field, a
tradeoff reported in vineyard-APV commentary but not, to our knowledge, quantified in a controlled
trial. **THIN.**

### 3.4 Rain shadow and drip-line redistribution

Elamri, Y., Cheviron, B., Mange, A., Dejean, C., Liron, F., Belaud, G. (2018). Rain concentration and
sheltering effect of solar panels on cultivated plots. *Hydrology and Earth System Sciences*
22:1285–1298. DOI [10.5194/hess-22-1285-2018](https://doi.org/10.5194/hess-22-1285-2018) **[P]** — open access.

- Panels create an **umbrella effect**: large fractions of the plot are sheltered from rain while
  water is concentrated into narrow drip lines at panel edges.
- With panels held flat during a monitored rain event, the **coefficient of variation (CV) of ground
  water distribution was 2.13**.
- Applying a real-time panel-rotation "avoidance strategy" (AVrain model, driven by rainfall and wind
  forcing) reduced CV to **0.22** — roughly a **10× reduction in spatial heterogeneity**, which the
  authors describe as approaching good uniformity by irrigation-engineering standards.
- Companion AWM paper: eastern (drip-line) edge zones showed higher soil moisture and lower soil
  temperature than the plot interior — direct evidence of geometry-driven soil-moisture heterogeneity.
- Weselek et al. 2021 independently report "an altered rain distribution" under the Heggelbach array **[P]**.

> **This is the most under-modelled effect in APV tools and the most important one at garden scale,**
> where a single 2 m panel row can dry out one bed and waterlog the one 40 cm away. A design tool
> should at minimum render the projected rain-shadow footprint and drip-line position, even if it does
> not attempt a full water balance.

**What this app does with it (2026-09-18, Decision Record 28).** The rain field
(`src/recommend/rain.ts`) follows the array's plan geometry at its rain pose: a fixed row at its
tilt, every tracker lying flat, which is its night stow. Ground under a panel's plan footprint is
sheltered, each row's low edge drips its whole catchment into a strip 20 cm wide in still air
(Elamri et al. 2018: about 90 percent of a panel's water leaves through a 20 cm outlet), and a
flat panel sheds to both long edges, half each. The weather record carries wind speed and no
direction, so the site's mean wind in rain hours is applied from every direction: the shadow moves
by the panel's height times the wind over a 2 mm raindrop's 6.5 m/s fall (Gunn and Kinzer 1949),
and the strip widens by what a 4 mm drip drifts in its fall from the edge. At the default 2.5 m
clearance a 3 m/s wind at 10 m moves the shadow 1.2 m and widens the strip to 0.56 m. At Elamri's
5 m the same wind moves the shadow 2.8 m, which is why the wind ruled their plot. Each bed reads
its sheltered share and the panel water landing on it as a multiple of its own rain. A plain bed
keeps half of that and a bed with a basin or swale along the strip four fifths, both modelling
assumptions declared in the gaps register, and the ground overlay draws the field as a channel.
On the starting plot the middle row shelters the bed beneath it whole in still air and 92 percent
in a 3 m/s wind, and every drip strip lands on a path.

Further sources read for the drip line:

- Cook, L. M., McCuen, R. H. (2013). Hydrologic Response of Solar Farms. *Journal of Hydrologic
  Engineering* 18(5):536–541 **[P]**: water leaving a panel edge carries up to ten times the
  kinetic energy of rainfall and erodes the base of a row, while the panels themselves leave
  runoff volumes unchanged. The reason the bed note says to mulch the strip and set seedlings back.
- Yavari et al. (2022). *Environmental Research: Infrastructure and Sustainability* 2:032002
  **[P]**, open access: the review of solar-farm hydrology, with concentrated drip-edge runoff and
  bare ground under the rows as the risks and vegetated ground as the remedy.
- Mulla et al. (2024). *Vadose Zone Journal* 23:e20335 **[P]**: a row measured and modelled as a
  disconnected impervious surface shedding at its drip edge, the treatment the rain field gives it.
- Wang et al. (2024). *Frontiers in Environmental Science* 12:1406546 **[P]**: China's desert
  plants count on the drip lines under their panel edges, fed by rain and by seven to eight
  cleanings a year, to carry the vegetation beneath. The one setting found where a drip line is
  used on purpose.
- Meng et al. (2025). *Frontiers in Plant Science* 15:1515896 **[P]**: *Astragalus adsurgens*
  under desert panels about 50 percent taller, with 51 to 87 percent more nitrogen than in the open.
- Ravi et al. (2016). *Applied Energy* 165:383–392 **[P]**: panel-cleaning water about equals an
  aloe crop's annual need, so the two can share it.
- García-Chica et al. (2025). *Irrigation Science* 43:1385–1395 **[P]**, and EDF's US patent
  11736061 (2023): the gutter form, a channel on the modules' low edge (the patent's swings level
  at any tilt) to a reservoir or a spreader, which puts the row where the light says and the water
  where the crop is.
- Allen and Hickman (2023), Planet Forward: at Jack's Solar Garden rainwater lands along each
  tracking panel's downward edge and growers plant to it. Reported practice, nothing measured.
- pv magazine (2026-07-28): SolarRoot, a proposal pairing module rainwater harvesting with
  sensor-driven subsurface drip, nothing measured yet.

No source found places rows so the drip edge waters the beds and the footprint shades the paths
as a design rule. The geometry says a fixed row tilted to the equator drips on its equator side
and throws its midday shade poleward, so a row over an east-west path hands the equator-side bed
the water and the pole-side bed the shade and the evapotranspiration saving of section 3.3. The
wind blurs the shadow by more than it moves the drip, so the strip is the feature to place and the
shadow the one to expect a smear of.

### 3.5 Phenology delay

- **Lettuce: 3–7 day maturity delay** under panel shade (Elamri et al. 2018, AWM) **[P]**.
- Delayed flowering/podding in mungbean, delayed apple ripening under overhead APV, delayed bloom
  with increased late-season floral abundance in a dryland APV system (the last a documented
  pollinator co-benefit) — each is a **single study per crop**, no cross-crop "days delayed per %
  shade" synthesis exists. **THIN.**

**Practical consequence for a garden tool:** shade shifts harvest windows. For succession planting and
frost-date planning this matters as much as yield. A flat "+3 to +7 days per 30% RSR" heuristic for
fast-cycling leafy crops is the only defensible starting point, and should be labelled as such.

### 3.6 Wind, dew, frost

- Hassanpour Adeh et al. 2018 **[P]**: wind speed significantly altered at all heights, wind
  **direction** distribution substantially reoriented under the array.
- Reported vertical-bifacial wind-speed reductions of **up to 40%** in the shelter zone (vs ~20% for
  tree windbreaks), and **up to 86%** under extreme gusts for a lowered-first-row elevated design —
  these come from 2026 secondary trade coverage, **not verified against primary papers [?] THIN.**
- Frost: elevated APV configurations are argued to mitigate radiative frost by reducing nocturnal
  longwave loss to the sky (the same physics as a frost cloth), while vertical configurations favour
  wind protection — implying an **elevated-vs-vertical design tradeoff**. **No quantified frost-risk
  reduction (°C of margin, or damage-incidence rate) was found in any accessible source. THIN.**
- Dew: no quantitative source located. **THIN.**

The frost mechanism is physically sound and follows directly from the sky-view-factor reduction the
tool already computes for diffuse light — the same `SVF` term governs nocturnal radiative cooling. A
defensible qualitative output is: "this location has a sky view factor of X%, implying reduced
radiative frost risk relative to open ground," without claiming a temperature number.

**Shipped.** `src/recommend/frost.ts`, off a per-bed sky view factor now aggregated onto `BedLight`
in `src/sim/aggregate.ts`. The output is the sentence above and nothing more: it states the measured
geometry, names radiative frost, says explicitly that it is no help against advective frost (Snyder
and de Melo-Abreu's distinction), and refuses a temperature. The site's frost exceedance curve and
its degree-days are untouched, and the caveat that rides with the sentence states the consequence
that runs the *other* way and is the one a reader will not think of: milder nights under an array
mean **less** chill accumulation, and this app gates perennials on chill. Tests assert the absence
of a degree figure, of a shifted date and of any "longer season" wording, because the misreading to
guard against is "fewer frosts, therefore heat-loving crops now work here" — which §3.2 contradicts.

---

## 4. Shade-tolerance classes and DLI thresholds

### 4.1 Master table

DLI values are minimum / target **at the plant**, in mol m⁻² d⁻¹, averaged over the growing season.
"Max RSR" is the recommended design ceiling on relative reduction in solar radiation.

| Class | Min DLI | Target DLI | Max RSR (design) | Tolerance | Evidence |
|---|---|---|---|---|---|
| **Understory perennials / shade herbs** (mint, parsley, cilantro, chives, ramps, wild ginger, hosta, ostrich fern) | ~2–4 **[?]** | **4–10** **[?]** | **60–75%** | very high | ginseng only quantified species, herbs qualitative. **THIN** |
| **American ginseng** (*Panax quinquefolius*) | — | — | **64–70%** (greenhouse optimum ~35.6% light) to **90%** (forest-farming practice) | very high | USDA Forest Service (2011) field guidance **[E]** vs greenhouse optimum **[P]** — two evidence types disagree |
| **Leafy greens** (lettuce, spinach, chard, arugula, kale, mustard) | **6** (poor quality below) | **12–17** | **40–50%** | high | Marrou 2013a: relative yield ≥ relative radiation at 30% and 50% RSR **[P]**, Laub: 86% at 40% RSR (CI 61–120) **[P]**, DLI 12 target from MSU Extension **[E]**, >17 for >3 consecutive days causes tipburn (Cornell) **[P]** |
| **Forages / C3 pasture & clover** | — | — | **45–50%** | high (benefiting to 25%) | Laub: 103% @20%, 93% @40% RSR **[P]**, no DM effect at 30% (Mercier 2020) or 45% RSR (Pang 2019) **[P]**, alfalfa photosynthesis adequate ≥50% RSR (Varella 2011) **[P]** |
| **Berries / soft fruit — raspberry, currant, blackberry, blueberry** | **15** (raspberry) | **≥15** | **30–35%** | moderate–high | Widmer et al., 4-year 21-site 13-configuration Swiss APV study **[C, peer-reviewed proceedings]**, black currant maintains quality to **65% PAR reduction** **[P]**, berry meta-analysis: currant/blackberry/blueberry tolerate **~35% shade** without loss **[P, abstract only]** |
| **Berries — strawberry** | **25** | **>25** | **~15–20%** | **low** | Widmer et al. **[C]** — positive linear DLI↔yield and DLI↔sugar, reduced firmness at low light (attributed to reduced UV) |
| **Brassicas, heading** (broccoli, cabbage, cauliflower, kohlrabi) | not established | ~12–17 (inferred from leafy overlap) **[?]** | **30–40%** | moderate–high | head/curd quality maintained at 55–65% shade in shade-net trials **[P]**, **no DLI threshold exists in the literature. THIN** |
| **Root & tuber crops** (potato, beet, celeriac, carrot, radish, turnip, sweet potato) | not established | — | **15–25%** | moderate (potato/celeriac) to low (carrot/turnip) | Laub group n=2, disproportionate losses begin early **[P]**, Weselek: potato **+11%**, celeriac n.s. at 30% RSR **[P]**, N. Italy: 13% shade → 12% loss, >30% shade → >30% loss **[P]**, turnip reported most sensitive (up to −40%) **[?]**. **THIN** |
| **Fruiting solanaceae** (tomato, pepper, eggplant) | **10–12** (minimum for fruiting) | **20–30** | **20–25%** temperate, **up to 40%** in hot/arid or water-limited settings | low (temperate) / can be positive (arid) | Cockshull et al. 1992 *J. Hortic. Sci.* 67:11–24, DOI [10.1080/00221589.1992.11516215](https://doi.org/10.1080/00221589.1992.11516215) **[P]**, Marcelis et al. 2006 *Acta Hortic.* 711:97–103 **[P]**, Laub fruity vegetables 108% @20% RSR **[P]**, Barron-Gafford 2019 (arid, 2–3× gains) **[P]**, 20–30 target from extension **[E]** |
| **Cucurbits** (cucumber, squash, melon, zucchini) | not firmly established | **20–30** **[E]** | **20–30%** | low–moderate | Marrou 2013b: cucumber effects confined to juvenile phase **[P]**, DLI target is extension guidance only. **THIN** |
| **Alliums** (onion, garlic, leek, shallot) | not established | high | **≤15%** | **low** | bulb *initiation* is photoperiod-driven (≥12–13.75 h), but bulb *thickening* is inhibited by low light: in a 0/25/50/75% shade trial only the 0% and 25% treatments bulbed at all **[P]** |
| **Grain legumes** (bean, pea, soybean) | not established | full sun | **≤10%** | **low** | Laub: 50% yield @40% RSR, disproportionate loss from ~1% RSR **[P]**, soybean −30% @33% shade **[P, intercropping]** |
| **C3 cereals** (wheat, barley, oats) | not established | full sun | **≤15%** | moderate to 50%, then susceptible | Laub: less-than-proportional decline only to 15% RSR, disproportionate loss from 10% **[P]**, Weselek wheat −19% to +3% at 30% RSR **[P]** |
| **Maize and C4 grasses** (sweetcorn, sorghum, bermudagrass) | not established | full sun | **≤10%** | **lowest** | Laub: 45% yield @40% RSR, worst of nine groups **[P]**, C4 does not light-saturate |
| **Hops** | — | — | near 0 | none | require near-full sun for cone yield, no DLI figure found **[?] THIN** |

### 4.2 The berry DLI thresholds — the most directly actionable numbers

Widmer, J., Ançay, A., Duchemin, C., Nardin, R., Ackermann, T., Sutter, G. — Swiss AgriVoltaics
Conference Proceedings (2024/2025) **[C, peer-reviewed conference proceedings]**. Four years, 21 sites,
13 APV configurations:

- **Strawberry requires a minimum DLI of ~25 mol m⁻² d⁻¹** to avoid excessive yield loss.
- **Raspberry tolerates a minimum of ~15 mol m⁻² d⁻¹.**
- Positive **linear** DLI↔yield and DLI↔sugar-content relationships in both, strawberry more sensitive.
- Strawberry firmness reduced at low light, attributed to reduced UV exposure.

This is the only source located that expresses an APV shade constraint directly as a DLI threshold
rather than a % shade figure, which is exactly the form a design tool needs. It also usefully splits a
class that the Laub meta-analysis lumps: "berries" as a group looks shade-benefiting to 30% RSR, but
strawberry specifically does not behave that way.

### 4.3 Evidence-quality summary for §4

- **Peer-reviewed, directly APV-relevant, high confidence:** Marrou 2013a/b/c, Weselek 2021,
  Barron-Gafford 2019, Laub 2022, Cockshull 1992, Marcelis 2006, Widmer et al.
- **Extension guidance, not peer-reviewed:** all "target DLI 12 / 20–30" figures (MSU Extension via
  Runkle, Purdue HO-238-W, GPN/ReduSystems), Dorais (2003) is Canadian Greenhouse Conference
  proceedings, frequently miscited as a journal article.
- **No DLI threshold exists in the literature** for: heading brassicas, all root crops individually,
  alliums, grain legumes, most culinary herbs, hops, elderberry, pawpaw, hostas, forage species. Where
  the table above gives a number for these, it is inference, and the tool should present it as such.
- The **"1% light = 1% yield" rule** for greenhouse fruiting vegetables originates with Cockshull et
  al. (1992) and was refined by Marcelis et al. (2006) to **0.7–1.0% yield decline per 1% radiation
  reduction**, with the *relative* effect larger at low light, higher CO₂, and in winter. Note this
  is a **greenhouse** relationship, Laub et al. explicitly excluded greenhouse experiments as too
  dissimilar to APV. Use it as an upper-bound sensitivity for protected-culture solanaceae only.

---

## 5. Modeling approach

### 5.1 What the published APV studies actually do

Four model classes appear in the literature, in increasing order of cost:

| Class | What it does | Representative tools | Typical use in APV |
|---|---|---|---|
| **Analytic shading factors** | Projects panel geometry onto the ground for the beam component, integrates an analytic sky-view factor for the diffuse component | Zainali et al. 2023 model, NREL InSPIRE Agrivoltaics Shading Tool | ground PAR maps, DLI, homogeneity |
| **2-D view factor (infinite sheds)** | Assumes infinitely long, identical, regularly spaced rows, computes VFs between ground segments, sky, and module faces | `pvlib.bifacial.infinite_sheds`, `pvfactors` | bifacial POA irradiance, ground irradiance as a by-product |
| **Backward ray tracing / radiosity** | Monte Carlo path tracing through an explicit 3-D scene, with multi-bounce interreflection | RADIANCE (`rtrace`), Daysim (annual climate-based), NREL **bifacial_radiance** (a Python wrapper around RADIANCE) | ground irradiance maps, edge effects, non-uniform arrays |
| **Coupled radiation + crop growth** | Feeds the light field into a mechanistic crop model | Amaducci et al. 2018 (shading model + GECROS), Elamri et al. 2018 (AVrain + water balance) | yield and water-budget prediction |

Solar position in nearly all of these comes from **pvlib** (which implements the NREL SPA
algorithm), `bifacial_radiance` itself calls pvlib for sun position.

### 5.2 Documented accuracy and cost

**Analytic shading factors — Zainali, S., Lu, S.M., Stridh, B., Avelin, A., Amaducci, S., Colauzzi, M.,
Campana, P.E. (2023). Direct and diffuse shading factors modelling for the most representative
agrivoltaic system layouts. *Applied Energy* 339:120981.
DOI [10.1016/j.apenergy.2023.120981](https://doi.org/10.1016/j.apenergy.2023.120981) **[P]**
(preprint: arXiv:2208.04886):**

- Beam and diffuse shading factors computed analytically for fixed, fixed-vertical, single-axis and
  dual-axis tracking layouts.
- **R² = 0.99–1.00** against **PVsyst** and **SketchUp** for both shading factors.
- Polygon-projection model validated against a **reference cell**: **0.3% difference** between measured
  and simulated daily values on a clear-sky day.
- Reported outputs across layouts: **light homogeneity index 91–95%**, **annual PAR reduction 11–34%**.

**View factor vs ray tracing — Grommes, E.-M., Schemann, F., Klag, F., Nows, S., Blieske, U. (2023).
Simulation of the irradiance and yield calculation of bifacial PV systems in the USA and Germany by
combining ray tracing and view factor model. *EPJ Photovoltaics* 14:11.
DOI [10.1051/epjpv/2023003](https://doi.org/10.1051/epjpv/2023003) **[P]**:**

| Mode | Runtime | Annual yield deviation |
|---|---|---|
| View factor only (`pvfactors`) | **2–4 minutes** | overestimates midday, underestimates morning/evening |
| VF + RT combined | 8.5–15 h (7-month sim) | **4.4%** |
| Ray tracing only (`bifacial_radiance`) | **12.7–88 h** | **10.4%** (consistently positive, +5.2% to +16%) |

> Read this table carefully: it is for **plane-of-array energy yield of bifacial modules**, not for
> ground-level PAR. It establishes the **~10³–10⁴× runtime ratio** between VF and RT, and it shows RT
> is not automatically more accurate at annual-aggregate scale. It does **not** establish that VF is
> accurate for ground irradiance. Do not cite it for the latter.

Marion, B., MacAlpine, S., Deline, C., Asgharzadeh, A., Toor, F., Riley, D., Stein, J., Hansen, C.
(2017). A practical irradiance model for bifacial PV modules. *2017 IEEE 44th PVSC*, pp. 1537–1542.
DOI [10.1109/PVSC.2017.8366263](https://doi.org/10.1109/PVSC.2017.8366263) **[C]** — the reference
implementation behind pvlib's `infinite_sheds`.

### 5.3 Recommendation for a browser tool

**Use an analytic beam-shading + isotropic-sky-view-factor model on a 2-D ground grid, following
Zainali et al. (2023).** Ray tracing is not defensible in a browser at interactive latency, and the
Zainali validation shows it is not needed for ground-level shading factors.

**Algorithm:**

1. **Solar position** per timestep from a standard algorithm (SPA, or Michalsky/PSA for
   compactness). A JS port of pvlib's `solarposition` or NOAA's algorithm is adequate, sub-0.01°
   accuracy is far beyond what the rest of the model justifies.
2. **Split GHI into DNI + DHI** using an established decomposition model (Erbs, DISC, or DIRINT) if the
   weather source supplies only GHI. TMY3/PVGIS supply all three, which is preferable.
3. **Beam component.** For each ground cell, project each panel rectangle along the solar vector
   onto the ground plane and test point-in-polygon. This yields a binary (or, with sub-cell
   sampling, fractional) beam shading factor `f_beam(x, y, t) ∈ [0,1]`. Cost is O(cells × panels)
   per timestep and is trivially vectorisable, for a small garden this is milliseconds.
4. **Diffuse component.** Compute a **sky view factor** `SVF(x, y)` once per geometry (it is
   time-invariant for fixed panels) by hemispherical sampling or by analytic solid-angle subtraction of
   each panel. Under an isotropic sky, `DHI_ground = SVF × DHI`.
5. **Ground-reflected / interreflected component.** Set to zero at first order, or apply a
   single-bounce albedo term. Panel rear faces are typically dark and low-reflectance, this term is
   small.
6. **PAR conversion.** `PPFD(x,y,t) = [f_beam·DNI·cos θ_z + SVF·DHI] × 0.45 × 4.57`.
7. **Integrate to DLI** per ground cell per day, then to a **growing-season mean DLI** and a
   **season-cumulative RSR** relative to an unshaded reference cell.
8. **Feed RSR into the Laub et al. (2022) crop-group response curves** (§2.1) to produce a relative
   yield band, and compare mean DLI against the §4 class thresholds.
9. **Compute a homogeneity metric** (CV or min/mean of seasonal DLI across cells) and report it — this
   is what DIN SPEC 91434 asks for qualitatively and what Zainali et al. quantify as 91–95%.

**Explicit assumptions to state in the UI:**

- Isotropic diffuse sky. Real skies are anisotropic (circumsolar brightening near the sun, horizon
  brightening). Under a partially masked sky this cuts both ways: the model under-counts diffuse when
  the circumsolar region is unmasked and over-counts when it is masked. Applying a Perez model to the
  unmasked sky fraction would be the next refinement.
- Opaque, non-transmitting panels. Semi-transparent modules require a transmittance term.
- No multi-bounce interreflection between panels, ground, and canopy.
- No canopy self-shading — the model reports irradiance at a horizontal plane at the crop's reference
  height, not absorbed radiation.
- Flat, horizontal terrain, uniform albedo.
- Finite array: unlike `infinite_sheds`, an explicit polygon-projection model **does** capture edge
  rows and array boundaries correctly. At garden scale (a handful of rows) this matters a lot and is a
  strong argument against the infinite-sheds simplification despite its availability in pvlib.

**Error bounds to quote:**

- Geometric shading factors: **R² 0.99–1.00** vs PVsyst/SketchUp, **0.3%** daily error vs a
  reference cell on a clear-sky day (Zainali et al. 2023 **[P]**).
- Ground PAR under real (mixed) skies: **no published validation of an analytic model against
  distributed ground PAR sensors across a full season was located.** The 0.3% figure
  is a single clear-sky day. Honest guidance: **treat seasonal cumulative PAR estimates as ±10%, and
  individual-cell instantaneous values as much looser.** **THIN — flag prominently.**
- The dominant end-to-end uncertainty is **not** the optics. It is the crop response: Laub et al.'s
  95% prediction intervals span 67–156% relative yield for fruity vegetables at 40% RSR. An optical
  model accurate to 1% feeding a yield model uncertain to ±45% is a false-precision trap. **The tool's
  output uncertainty should be dominated by, and visibly attributed to, the agronomic term.**

**Temporal and spatial resolution:**

- **Timestep ≤ 15 min**, preferably 5–10 min. Beam shadow bands sweep across the ground at roughly
  0.25°/min of solar motion, hourly steps smear them and systematically misestimate cell-level
  extremes while roughly preserving the plot mean.
- **Grid ≤ 0.25 m** in the cross-row direction (the direction of steep gradients), 0.5–1 m along-row
  is adequate for straight rows. At garden scale 0.1 m is affordable and better matches bed widths.
- A **typical meteorological year** (TMY3, PVGIS-TMY, or ERA5-derived) is the right weather input. A
  single year is not, because the Weselek and Amaducci results show the sign of the shade effect can
  flip between a normal and a drought year.

**What to deliberately omit at v1:** full energy-balance microclimate (soil/air temperature, VPD),
water balance and rain redistribution, and canopy radiative transfer. Each is a research problem in
itself, the §3 evidence is not consistent enough to support a quantitative model, and the §5 optical
model plus the §2 response curves already capture the first-order effect. Rain-shadow **geometry**
(§3.4) is the exception — it is purely geometric, cheap to compute from the same panel polygons, and
practically important at garden scale, so it belongs in v1 as a rendered footprint even without a
water balance behind it.

---

## 6. Standards and regulatory thresholds

### 6.1 Germany — DIN SPEC 91434:2021-05

DIN SPEC 91434:2021-05, *Agri-Photovoltaik-Anlagen – Anforderungen an die landwirtschaftliche
Hauptnutzung* (Agri-photovoltaic systems – requirements for primary agricultural use), DIN e.V. /
Beuth, May 2021 **[S]**. A PAS-process document (26 pp.), not a full DIN norm — no legal force unless
incorporated by reference (which the EEG does).

| Requirement | Category I (elevated, farming *under* array) | Category II (interspace, farming *between* rows) |
|---|---|---|
| Minimum clear height (*lichte Höhe*) | **≥ 2.10 m** | none specified |
| Maximum area loss (*Flächenverlust*) | **< 10%** of project area | **< 15%** of project area |
| Reference-yield floor | **≥ 66% of the *Referenzertrag*** on the whole project area | same |

- The *Referenzertrag* is computed from the farm's own 3-year / crop-rotation average, falling back to
  regional statistics where no history exists (§5.2.11). §5.2.12 frames the same rule as "maximum yield
  reduction of one third," combining area loss, shading, and water/microclimate effects.
- **Light homogeneity (§3.8, §5.2.5, §6.1)** is defined **qualitatively** — "uniform distribution of
  light reaching the usable area," required to be "as high as possible" (*möglichst hoch*) and adapted
  to crop needs, verified through a mandatory *Nutzungskonzept* (use concept). **There is no numeric
  PAR-uniformity threshold in the standard.** The widely repeated claim that DIN SPEC 91434 imposes a
  quantitative homogeneity limit is **not supported by the primary text.**
- **No ground-coverage-ratio (GCR) cap exists in this standard.** It uses *Flächenverlust*, which is a
  different quantity. This is a common misattribution.
- **No minimum row spacing is prescribed** (§6.4.4): orientation and inter-row distances are
  explicitly "not fixed", spacing must simply be planned for light availability, homogeneity, and
  machinery headland turning space.
- Follow-on: **DIN SPEC 91492:2024-06**, *Anforderungen an die Nutztierhaltung* — livestock-specific
  requirements (stocking density, structure protection), June 2024.

**EEG 2023 linkage.** Agri-PV is a "besondere Solaranlage" tender sub-segment under **EEG § 37d**.
Recognition as EEG-eligible Agri-PV requires DIN SPEC 91434 conformity. The EEG's own statutory
clearance definition differs slightly from the DIN SPEC: **≥ 0.80 m for exclusively vertical module
orientation, ≥ 2.10 m otherwise**. Reported tender parameters — max bid 9.5 ct/kWh (2024), volumes
ramping 300 MW (2024) → 2,075 MW (2029), a 1.2 ct/kWh surcharge for Category I — are
**search-derived and not verified against the Bundesnetzagentur primary text [?]**.

Primary text used: <https://arendsee.info/stadt-arendsee/wp-content/uploads/sites/3/2024/06/DIN_SPEC-91434.pdf>

### 6.2 Japan — MAFF solar sharing (営農型太陽光発電)

MAFF Notice **5-Nōshin-2825, 25 March 2024** (令和6年3月25日 5農振第2825号), amended by **6-Nōshin-2983
(2025)**, Agricultural Land Bureau Director-General, effective 1 April 2024, superseding the
original 2013 notice (revised 2018 and 2021) **[S]**.
<https://www.maff.go.jp/j/nousin/noukei/totiriyo/attach/pdf/einogata-57.pdf>

- **Yield rule (the "80% rule"):** approval is denied or renewal jeopardised if yield under the array
  declines by "**おおむね2割以上**" — **roughly 20% or more** versus the municipal average yield for
  the same crop and year. Equivalently, **≥ 80% of the regional average must be maintained.** Applies
  at initial permitting and at annual review.
- **Minimum clear height: ≥ 2 m**, to permit efficient machinery use and standing farm work. Waived for
  vertically mounted modules where agricultural conditions are otherwise unaffected (2021 3rd directive).
- **Permit duration:** base **3-year** temporary farmland-conversion permit (一時転用許可), extendable
  to **10 years** for certified farmers (認定農業者) on their own land, for reclamation of abandoned
  farmland, or on Class 2/3 farmland. The structure must be **temporary and readily removable**.
- **Reporting:** annual cultivation record (栽培実績書) and income/expense report (収支報告書) due by
  **end of February**.
- **Inspection triggers:** mandatory annual on-site inspection where combined support-pole +
  farmland area exceeds **4 ha**, prefectural agricultural-committee consultation above **30 are
  (0.3 ha)**.
- 2021 3rd directive **abolished the yield requirement entirely for installations on devastated
  (degraded/abandoned) farmland**.
- **Scale:** 6,137 approved sites on 1,361.6 ha of farmland by end of FY2023.
- **A "~30% shading ratio" guidance figure could not be found in the primary MAFF text.** It appears
  only in industry commentary. Recent (2026) trade reporting describes *draft* national benchmarks with
  shading below 30%, ~3 m panel height, and 4–5 m pillar spacing — **draft, not in force [?] THIN.**
- One secondary source (Renewable Energy Institute) claims the 80% rule was retracted in favour of a
  looser cultivation-efficiency check. The 2024/2025 primary text still uses the ~20%-decline
  standard, **treat the retraction claim as unsubstantiated.**

### 6.3 Massachusetts — SMART Agricultural Solar Tariff Generation Unit (ASTGU)

225 CMR 20.00 (MA DOER SMART regulation) and the DOER ASTGU Guideline (last updated 12 April 2022) **[S]**.
Figures below from the UMass Amherst Clean Energy Extension "Dual-Use: Agriculture and Solar
Photovoltaics" fact sheet, version January 2024.

- **Sunlight/PAR:** maximum sunlight reduction on **any square foot** of land under the array during
  the growing season is **≤ 50%** — i.e. **≥ 50% of PAR must reach the ground everywhere**. Verified
  via DOER's Shading Analysis Tool. Note this is a **per-point minimum**, not an average, which makes
  it simultaneously a shading limit **and** a homogeneity constraint — the strictest such requirement
  in any of the regimes reviewed, and the one most directly implementable in a design tool.
- **Height:** lowest panel edge **≥ 8 ft** (fixed tilt), **≥ 10 ft** at horizontal position
  (tracking).
- **System size:** **≤ 5 MW AC** for the expedited design track. (The commonly cited **2 MW AC**
  figure appears to be from an older 2018 guideline iteration, the January 2024 fact sheet says 5 MW
  **[?]**.)
- **Compensation:** base **$0.14–$0.26/kWh** by size and utility, declining ~4% per capacity block,
  ASTGU dual-use receives an **additional $0.06/kWh adder**.
- **Continuity:** agricultural production must continue for the **20-year** SMART term, Important
  Agricultural Farmland sites require **≥ 3 years** of prior crop production before application.
- **Reporting:** annual crop/herd productivity, management deviations, and forward plans.
- All design parameters (height, shading, size) are **waivable** with DOER-approved documentation.

<https://www.umass.edu/agriculture-food-environment/sites/ag.umass.edu/files/fact-sheets/pdf/fs_-_dual-use_-_agriculture_and_solar_pv_012524_0.pdf>

### 6.4 Italy — MASE Linee Guida (June 2022) and DM 436/2023

**Decreto MASE 22 dicembre 2023, n. 436** ("DM Agrivoltaico," in force 14 Feb 2024), operationalised by
GSE "DM Agrivoltaico – Regole operative," Allegato 1 (146 pp.) **[S]**. Read directly.

- **Minimum agricultural area (§2.B.1): `S_agricola ≥ 0.7 × S_tot`** — at least **70%** of total system
  area must remain in agricultural/pastoral use after subtracting non-cultivable footprint (supports,
  inverter cabins). Note this is an **area** constraint, not a PV ground-coverage-ratio cap.
- **Minimum module height (§2.B.2):** **1.3 m** for livestock or fixed vertical modules, **2.1 m**
  for crop cultivation, **2.1 m** for mixed crop + livestock. Measured from the lowest module edge,
  or at maximum achievable tilt for tracking structures. Sections not meeting the height requirement
  must be metered separately and are excluded from incentive tariffs.
- **Minimum electrical producibility (§2.B.3): `FV_agri ≥ 0.6 × FV_standard`** — output must be **≥ 60%**
  of a reference ground-mount plant on the same site, computed with EU JRC **PVGIS**, with correction
  factors **+15%** for bifacial, **+15%** for biaxial tracking, **up to +30%** combined.
- **PNRR funding:** capital contribution up to **40%** of eligible costs, against
  **€1,098,992,050.96** allocated under Missione 2 Componente 2, Investimento 1.1 "Sistema agro-voltaico."
- **Monitoring (§2.D):** mandatory systems for agricultural continuity, water saving, soil fertility,
  microclimate, and climate resilience per CREA-GSE guidelines. Farms must be enrolled in RICA or file
  a sworn agronomic report by **31 March** annually.
- **The commonly asserted "LER > 1" requirement was NOT found in the DM 436/2023 primary text**, which
  instead uses the 60% producibility ratio. It may exist in the separate June 2022 *Linee Guida*, which
  could not be fully extracted **[?]**. Likewise the "criteria A–F" for *agrivoltaico avanzato* are
  secondary-sourced only and were **not independently verified [?]**.
- The separate Italian standards-body specification **UNI/PdR 148:2023** ("Agri-voltaic systems –
  Integration of agricultural activities and photovoltaic implants") states crop yield under APV should
  not be reduced by more than 70% relative to full light **[S, via Tekie et al. 2024 preprint]** — note
  this is a far weaker floor than Germany's 66%-retained rule and the phrasing in the secondary source
  is ambiguous about direction **[?]**.

<https://www.mase.gov.it/portale/documents/d/guest/roagr-allegato-1-pdf>

### 6.5 France — loi APER and décret n° 2024-318

Loi n° 2023-175 du 10 mars 2023 (*loi APER*), art. 54, **Décret n° 2024-318 du 8 avril 2024**
relatif au développement de l'agrivoltaïsme, arrêté du 5 juillet 2024 **[S]**. Read from Légifrance.

- **Yield-maintenance rule:** outside livestock activity, production is deemed "significative" if the
  **average yield per hectare on the agrivoltaic parcel exceeds 90% of the average yield per hectare on
  a *zone témoin* (control zone)** or equivalent reference. The prefect may lower the 90% threshold for
  projects demonstrating improved crop quality or facing unpredictable events.
- **Ground coverage ratio (*taux de couverture*): 40% maximum** for installations > 10 MWp not covered
  by a "proven technology" exemption. Exempted proven technologies get technology-, crop-, and
  location-specific ratios set by the 5 July 2024 arrêté.
- **Control zone:** must be **≥ 5% of the installation surface, capped at 1 hectare**, located
  nearby with equivalent soil and climate, cultivated identically, free of any modules or shading
  structures.
- **Unusable-area cap:** permanently unexploitable land (foundations, access) **≤ 10%** of total surface.
- **Monitoring cadence:** proven technologies re-checked every **5 years** after an initial 6-year
  assessment, installations with coverage ratio **< 40%** every **3 years**, all others
  **annually**.
- **Authorisation term:** **40 years** maximum initial, renewable in **10-year** increments contingent
  on continued significant production.
- **"Atteinte substantielle"** (substantial harm to agricultural production) is deliberately **not
  numerically defined**, assessed case-by-case by the DDT. Do not encode a number for it.

<https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049386027>

### 6.6 Other jurisdictions (lower confidence)

- **Catalonia (Spain):** Departament d'Acció Climàtica provision — APV may cover **15–20%** of farmland
  depending on structure height, and crop yield must stay **above 60%** **[?, via Tekie et al. 2024
  preprint citing Sanchez Molina 2024]**.
- **USA — NREL InSPIRE:** not regulatory. A research programme (22+ field sites) publishing an
  open-access **Agrivoltaics Shading Tool** (OpenEI) that models ground-level irradiance under
  various array geometries — directly relevant as prior art for §5. Widely cited (unverified)
  claims: combined land-use efficiency **+60–200%**, crop water demand **−20–50%** in arid climates
  **[?]**.
- **India (MNRE):** no binding national threshold located. **≥ 2.1 m** module clearance appears in
  industry best-practice guidance (SPE/NSEFI), **not** as an MNRE regulation **[?]**.
- **China:** no unified national agrivoltaic standard identified, ~**513 projects, ~31 GW** (WRI
  China dataset) developed via general renewable-energy and land-policy channels **[?]**.
- **South Korea:** Farmland Act currently caps agrivoltaic land-use permits at **8 years**, a
  pending amendment would extend to **up to 23 years** **[?, trade press only]**.

### 6.7 Cross-regime comparison — what a tool should actually check

| Regime | Yield floor | Shading/coverage limit | Min height | Homogeneity |
|---|---|---|---|---|
| DIN SPEC 91434 (DE) | **66% of reference yield** | area loss < 10% (Cat I) / < 15% (Cat II) | **2.10 m** (Cat I) | qualitative only |
| MAFF (JP) | **80% of regional average** | none numeric in force | **2 m** | none |
| MA SMART ASTGU (US) | none (production must continue) | **≥ 50% of sunlight at every point** | **8 ft / 10 ft** | implied by the per-point rule |
| DM 436/2023 (IT) | none (uses 60% producibility ratio) | **≥ 70% area agricultural** | **2.1 m** crops / **1.3 m** livestock | none |
| Décret 2024-318 (FR) | **90% of control zone** | **40% max coverage** (>10 MWp) | none numeric | none |

Only **Massachusetts** imposes a directly optical, spatially resolved constraint, and it is the one a
light-model can verify on its own. The German, Japanese, Italian, and French tests all require an
*agronomic* measurement the tool can only estimate. A design tool should therefore present the MA
50%-everywhere test as a hard pass/fail computed from geometry, and the yield-floor tests as
model-estimated with the §2 uncertainty bands attached and an explicit disclaimer that they are not
compliance determinations.

---

## 7. Consolidated list of thin-evidence areas

1. **Tubers/root crops (n=2), fruity vegetables (n=3), leafy vegetables (n=4)** in Laub et al. 2022 —
   the crop groups most relevant to a garden tool have the weakest support.
2. **No DLI threshold exists** for brassicas, root crops, alliums, legumes, most herbs, hops,
   elderberry, pawpaw, or forage species. Numbers offered for these are inference.
3. **Air-temperature effects contradict across climates** (cooling in AZ/OR, warming at Heggelbach).
4. **Soil-moisture sign also flips** (doubled in OR, +15% in AZ, reduced at Heggelbach).
5. **VPD/RH deltas** are directionally consistent but were not extractable as numbers from any
   accessible source.
6. **Frost protection and dew formation** are mechanistically plausible but entirely unquantified.
7. **Wind-reduction percentages** rest on trade-press coverage, not primary papers.
8. **Phenology delay** has one solid number (lettuce, 3–7 d) and no cross-crop synthesis.
9. **No published seasonal validation of any analytic ground-PAR model against distributed field PAR
   sensors** was located. The Zainali 0.3% figure is a single clear-sky day.
10. **Japanese solar-sharing crop science in English is nearly absent**, despite a decade of deployment
    and a legally binding 80% yield rule that Japanese researchers themselves describe as lacking a
    scientific basis.
11. **Fresh-weight vs dry-weight reporting bias** may inflate the apparent shade benefit for berries,
    fruits, and fruiting vegetables.
12. **Multi-year accumulation of shade stress in perennials** is under-studied, single-season trials
    may understate long-run losses in berries and tree fruit.

---

## 8. Full reference list

Amaducci, S., Yin, X., Colauzzi, M. (2018). Agrivoltaic systems to optimise land use for electric energy production. *Applied Energy* 220:545–561. DOI 10.1016/j.apenergy.2018.03.081

Barron-Gafford, G.A. et al. (2019). Agrivoltaics provide mutual benefits across the food–energy–water nexus in drylands. *Nature Sustainability* 2:848–855. DOI 10.1038/s41893-019-0364-5

Britton, C.M., Dodd, J.D. (1976). Relationships of photosynthetically active radiation and shortwave irradiance. *Agricultural Meteorology* 17:1–7. DOI 10.1016/0002-1571(76)90080-7

Cockshull, K.E., Graves, C.J., Cave, C.R.J. (1992). The influence of shading on yield of glasshouse tomatoes. *Journal of Horticultural Science* 67(1):11–24. DOI 10.1080/00221589.1992.11516215

DIN SPEC 91434:2021-05. *Agri-Photovoltaik-Anlagen – Anforderungen an die landwirtschaftliche Hauptnutzung*. DIN e.V., Berlin.

DIN SPEC 91492:2024-06. *Agri-Photovoltaik-Anlagen – Anforderungen an die Nutztierhaltung*. DIN e.V., Berlin.

Décret n° 2024-318 du 8 avril 2024 relatif au développement de l'agrivoltaïsme. JORF, France.

Decreto MASE 22 dicembre 2023, n. 436 ("DM Agrivoltaico") + GSE Regole Operative, Allegato 1. Italy.

Doedt, C., Tajima, M., Iida, T. (2022). Agrivoltaics in Japan: a legal framework analysis. *AgriVoltaics Conference Proceedings* 1. DOI 10.52825/agripv.v1i.533

Dupraz, C., Marrou, H., Talbot, G., Dufour, L., Nogier, A., Ferard, Y. (2011). Combining solar photovoltaic panels and food crops for optimising land use: towards new agrivoltaic schemes. *Renewable Energy* 36(10):2725–2732. DOI 10.1016/j.renene.2011.03.005

Elamri, Y., Cheviron, B., Lopez, J.-M., Dejean, C., Belaud, G. (2018). Water budget and crop modelling for agrivoltaic systems: application to irrigated lettuces. *Agricultural Water Management* 208:440–453. DOI 10.1016/j.agwat.2018.07.001

Elamri, Y., Cheviron, B., Mange, A., Dejean, C., Liron, F., Belaud, G. (2018). Rain concentration and sheltering effect of solar panels on cultivated plots. *Hydrology and Earth System Sciences* 22:1285–1298. DOI 10.5194/hess-22-1285-2018

Faust, J.E., Logan, J. (2018). Daily light integral: a research review and high-resolution maps of the United States. *HortScience* 53(9):1250–1257. DOI 10.21273/HORTSCI13144-18

Grommes, E.-M., Schemann, F., Klag, F., Nows, S., Blieske, U. (2023). Simulation of the irradiance and yield calculation of bifacial PV systems in the USA and Germany by combining ray tracing and view factor model. *EPJ Photovoltaics* 14:11. DOI 10.1051/epjpv/2023003

Hassanpour Adeh, E., Selker, J.S., Higgins, C.W. (2018). Remarkable agrivoltaic influence on soil moisture, micrometeorology and water-use efficiency. *PLOS ONE* 13(11):e0203256. DOI 10.1371/journal.pone.0203256

Jacovides, C.P., Timvios, F.S., Papaioannou, G., Asimakopoulos, D.N., Theofilou, C.M. (2004). Ratio of PAR to broadband solar radiation measured in Cyprus. *Agricultural and Forest Meteorology* 121:135–140. DOI 10.1016/j.agrformet.2003.10.001

Jacovides, C.P. et al. (2003). Global photosynthetically active radiation and its relationship with global solar radiation in the Eastern Mediterranean basin. *Theoretical and Applied Climatology* 74:227–233.

Korczynski, P.C., Logan, J., Faust, J.E. (2002). Mapping monthly distribution of daily light integrals across the contiguous United States. *HortTechnology* 12:12–16.

Laub, M., Pataczek, L., Feuerbacher, A., Zikeli, S., Högy, P. (2022). Contrasting yield responses at varying levels of shade suggest different suitability of crops for dual land-use systems: a meta-analysis. *Agronomy for Sustainable Development* 42:51. DOI 10.1007/s13593-022-00783-7. Data: Zenodo DOI 10.5281/zenodo.5716091

Marcelis, L.F.M., Broekhuijsen, A.G.M., Meinen, E., Nijs, E.M.F.M., Raaphorst, M.G.M. (2006). Quantification of the growth response to light quantity of greenhouse grown crops. *Acta Horticulturae* 711:97–103.

Marion, B. et al. (2017). A practical irradiance model for bifacial PV modules. *2017 IEEE 44th Photovoltaic Specialist Conference (PVSC)*, 1537–1542. DOI 10.1109/PVSC.2017.8366263

Marrou, H., Wery, J., Dufour, L., Dupraz, C. (2013a). Productivity and radiation use efficiency of lettuces grown in the partial shade of photovoltaic panels. *European Journal of Agronomy* 44:54–66. DOI 10.1016/j.eja.2012.08.003

Marrou, H., Guilioni, L., Dufour, L., Dupraz, C., Wery, J. (2013b). Microclimate under agrivoltaic systems: is crop growth rate affected in the partial shade of solar panels? *Agricultural and Forest Meteorology* 177:117–132. DOI 10.1016/j.agrformet.2013.04.012

Marrou, H., Dufour, L., Wery, J. (2013c). How does a shelter of solar panels influence water flows in a soil–crop system? *European Journal of Agronomy* 50:38–51. DOI 10.1016/j.eja.2013.05.004

McCree, K.J. (1972). The action spectrum, absorptance and quantum yield of photosynthesis in crop plants. *Agricultural Meteorology* 9:191–216. DOI 10.1016/0002-1571(71)90022-7

Meek, D.W., Hatfield, J.L., Howell, T.A., Idso, S.B., Reginato, R.J. (1984). A generalized relationship between photosynthetically active radiation and solar radiation. *Agronomy Journal* 76:939–945. DOI 10.2134/agronj1984.00021962007600060018x

MAFF (2024). 営農型太陽光発電に係る農地転用許可制度上の取扱いに関するガイドライン. Notice 5-Nōshin-2825, 25 March 2024 (amended 6-Nōshin-2983, 2025). Japan.

Massachusetts DOER. 225 CMR 20.00 (SMART) and Agricultural Solar Tariff Generation Units Guideline (rev. 12 April 2022).

Pataczek, L. et al. (2023). Agrivoltaics mitigate drought effects in winter wheat. *Physiologia Plantarum*. DOI 10.1111/ppl.14081

Sager, J.C., Smith, W.O., Edwards, J.L., Cyr, K.L. (1988). Photosynthetic efficiency and phytochrome photoequilibria determination using spectral data. *Transactions of the ASAE* 31:1882–1889.

Tekie, S. et al. (2024). Unravelling the crop yield response under shading conditions through the deployment of a drought index. EarthArXiv preprint (not peer reviewed). https://eartharxiv.org/repository/object/7354/

Torres, A.P., Lopez, R.G. Measuring daily light integral in a greenhouse. Purdue Extension HO-238-W.

Trommsdorff, M. et al. (2021). Combining food and energy production: design of an agrivoltaic system applied in arable and vegetable farming in Germany. *Renewable and Sustainable Energy Reviews* 140:110694. DOI 10.1016/j.rser.2020.110694

UNI/PdR 148:2023. Agri-voltaic systems – Integration of agricultural activities and photovoltaic implants. UNI, Italy.

Weselek, A., Ehmann, A., Zikeli, S., Lewandowski, I., Schindele, S., Högy, P. (2019). Agrophotovoltaic systems: applications, challenges, and opportunities. A review. *Agronomy for Sustainable Development* 39:35. DOI 10.1007/s13593-019-0581-3

Weselek, A., Bauerle, A., Hartung, J., Zikeli, S., Lewandowski, I., Högy, P. (2021). Agrivoltaic system impacts on microclimate and yield of different crops within an organic crop rotation in a temperate climate. *Agronomy for Sustainable Development* 41:59. DOI 10.1007/s13593-021-00714-y

Widmer, J., Ançay, A., Duchemin, C., Nardin, R., Ackermann, T., Sutter, G. (2024/2025). Strawberry and raspberry under agrivoltaics: minimum DLI requirements. *AgriVoltaics Conference Proceedings*.

Zainali, S., Lu, S.M., Stridh, B., Avelin, A., Amaducci, S., Colauzzi, M., Campana, P.E. (2023). Direct and diffuse shading factors modelling for the most representative agrivoltaic system layouts. *Applied Energy* 339:120981. DOI 10.1016/j.apenergy.2023.120981
