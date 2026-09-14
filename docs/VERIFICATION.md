# Verification Record

Resolution pass on the highest-risk unsourced claims in `00-DECISIONS.md`, against the gaps
ledger in `CITATIONS.md` §A/§B. Date: 2026-07-30.

Verdict vocabulary: **RESOLVED** = primary text obtained and quoted. **PARTIALLY RESOLVED** =
some sub-claims proven, others not. **UNRESOLVABLE** = searched properly, not found; say so in
the product rather than implying a source exists.

| # | Item | Verdict |
|---|---|---|
| 1 | Massachusetts SMART dual-use | RESOLVED, and the decision record is materially wrong/stale |
| 2 | DIN SPEC 91434 (3 negatives + 4 positives) | RESOLVED, all seven correct |
| 3 | Dehesa / montado distance template | PARTIALLY RESOLVED, "Marcos et al." is unverifiable; `tek.ts` fixed 2026-08-09 |
| 4 | Desmodium mechanism revision | RESOLVED |
| 5a | Penumbra ~7.5 cm at 4 m | RESOLVED as WRONG, off by 2x; correct derivation below |
| 5b | Inter-reflection 3-8% | UNRESOLVABLE (formula PARTIAL, magnitude unverifiable) |
| 6 | Faust & Logan 2018; Zhang et al. 2025 | RESOLVED, both full texts retrieved |
| 7 | trackgdd / hydroponics / ReduSystems values | RESOLVED 2026-09-11 by decision record 23; the base temperatures stay open |

---

## 1. Massachusetts SMART dual-use

**Verdict: RESOLVED from primary regulatory text. The decision record is wrong in one respect,
stale in another, and incomplete in three. The compliance check must be downgraded.**

### 1.1 Evidence trail

Failed:

- `https://www.mass.gov/doc/*/download` through any automated client: HTTP 403. The documents are
  public and need no account; mass.gov simply does not serve them to scripted requests, so they
  have to be opened and read in an ordinary browser. Anyone re-checking these citations should
  plan for that rather than assume the URLs are dead
- `web.archive.org` CDX API and `/web/<ts>id_/` replay: HTTP 429 on every attempt across ~15 min
- `https://www.agrisolarclearinghouse.org/massachusetts-policy-guide/`: 301 off-host

Succeeded:

- `https://www.law.cornell.edu/regulations/massachusetts/225-CMR-20-02` and `-20-06`: LII serves
  225 CMR 20.00, but 20.02/20.06 contain **no** numeric sunlight, height or capacity thresholds.
  20.06(1)(d) delegates to the DOER Guideline. Cornell LII alone cannot back the check.
- `https://www.umass.edu/agriculture-food-environment/sites/ag.umass.edu/files/fact-sheets/pdf/fs_-_dual-use_-_agriculture_and_solar_pv_012524_0.pdf`
  (UMass CEE fact sheet, version January 2024), extracted with `pdftotext`
- **The mass.gov PDFs below, read in a browser and transcribed.** Every one is public and the
  page numbers are given so a reader can open the same document and check the quotation against
  it.
  - `https://www.mass.gov/doc/guideline-regarding-the-definition-of-agricultural-solar-tariff-generation/download` (7 pp)
  - `https://www.mass.gov/doc/guideline-regarding-the-definition-of-dual-use-agricultural-stgus/download` (5 pp)
  - `https://www.mass.gov/doc/225-cmr-2800-clean-version/download` (39 pp)
  - `https://www.mass.gov/info-details/smart-guideline-regarding-the-definition-of-astgu`
  - `https://www.mass.gov/info-details/smart-30-program-details`
- `http://s3.us-east-2.amazonaws.com/bluewave-shade/jan23-1002/index.html` and its `js/app.js`
  (the DOER Shading Analysis Tool itself)

### 1.2 The regime is now SMART 3.0 / 225 CMR 28.00, not 225 CMR 20.00

`00-DECISIONS.md` §8 and `CITATIONS.md` B3 both cite 225 CMR 20.00. That is the legacy program.
DOER filed SMART 3.0 as a **new** regulation, **225 CMR 28.00**, in August 2025; mass.gov now
labels the old page "SMART 1.0 & 2.0 Program Details". The clean version currently served is
dated June 2026. The defined term also changed: **ASTGU is now "Dual-use Agricultural Solar
Tariff Generation Unit"**, and the numeric parameters moved out of the guideline and **into the
regulation** at 225 CMR 28.07(5)(b)3.

Both regimes were read. The numbers agree; the citation in our docs does not.

### 1.3 (a) The >=50% sunlight requirement, verbatim

225 CMR 28.07(5)(b)3.b.ii, *Sunlight Requirements* (SMART 3.0, current):

> A Dual-use Agricultural STGU shall propose a sunlight reduction plan for the STGU based upon
> the compatibility of the STGU with the proposed agricultural crops and productivity. The plan
> shall utilize the best available information as indicators, including, but not limited to,
> photosynthetic active radiation and light saturation data and qualitative information. The
> maximum sunlight reduction from a Dual-use Agricultural STGU's panels on every square foot of
> land directly beneath, behind, and in areas adjacent to and within the STGU's design shall not
> be more than 50 percent of baseline field conditions during the Growing Season Hours, unless
> the Applicant can demonstrate that an exception should be granted pursuant to 225 CMR
> 28.07(5)(b)3.b.iv.

Predecessor, DOER *Guideline Regarding the Definition of Agricultural Solar Tariff Generation
Units*, effective 2018-04-26, revised 2022-04-12, §3(b)(ii):

> Maximum Direct Sunlight Reduction Requirements: All ASTGUs must demonstrate that the maximum
> sunlight reduction from the panel shading on every square foot of land directly beneath, behind
> and in the areas adjacent to and within the ASTGU's design shall not be more than 50% of
> baseline field conditions as calculated by the SMART Tool.

Three things our record gets wrong or omits:

1. The rule is phrased as a cap on **sunlight reduction relative to baseline field conditions**,
   not as a floor on absolute sunlight. Equivalent in arithmetic, but the reference is a modelled
   unshaded baseline, so the answer depends on how baseline is computed.
2. The measurement basis is **not "as calculated by whatever model you like"**. See §1.7.
3. Compliance is **not absolute**: an exception (waiver) pathway exists for every one of these
   parameters.

### 1.4 (b) Clearance, verbatim

225 CMR 28.07(5)(b)3.b.i:

> (i) Fixed Tilt STGUs. For fixed tilt STGUs, the minimum height of the lowest panel point shall
> be eight feet above ground.
> (ii) Tracking STGUs. For tracking STGUs, the minimum height of the panel at its horizontal
> position shall be ten feet above ground. This minimum height may be reduced to eight feet if
> the maximum sunlight reduction requirement under 225 CMR 28.07(5)(b)3.b.ii. is still met in all
> tilt positions and the farm operator has functional control of the tracker control system to
> accommodate agricultural activities.

Our 8 ft / 10 ft is **correct**, and the 2022 guideline text is word-for-word the same on both
numbers. SMART 3.0 adds a conditional 10 ft -> 8 ft reduction for trackers that our record lacks.

Note the exact referents: fixed tilt is the **lowest panel point**; tracking is the panel **at
its horizontal position**. A geometric checker must use those two definitions, not a generic
"clearance".

### 1.5 (c) Capacity cap, verbatim

- 225 CMR 28.07(4)(a)2, general STGU eligibility: > "have a capacity of 5,000 kW or less"
  Only Brownfield/Landfill STGUs get an exception to this (to 10,000 kW). Dual-use does not.
- 225 CMR 28.07(5)(b)3.b.iii: > "Maximum Direct Current (DC) Rating. The maximum DC capacity
  rating of a Dual-use Agricultural STGU shall be no more than twice the AC capacity rating of
  the STGU and shall not exceed 7,500 kW DC."
- 2022 guideline §3(b)(v), verbatim: > "Maximum ASTGU Rated Capacity: The maximum AC rated
  capacity of an ASTGU shall be five (5) MW. The maximum DC rating shall be 2:1 DC to AC ratio
  and shall not exceed 7.5 MW DC."
- 2022 guideline §1, program-level goal: > "The goal of the SMART Program is to reach 80 MW AC
  capacity of ASTGU systems."

Our record's "Cap is 5 MW AC" is **correct but incomplete**: it omits the 2:1 DC:AC ratio limit
and the 7,500 kW DC ceiling, both of which are binding project-level constraints.

Irrelevant at garden scale, but if the overlay states the cap it should state all three.

### 1.6 (d) Annual, growing-season, or instantaneous: **growing-season and time-of-day windowed**

This is the question our decision record does not answer at all, and it is the one that decides
whether an annual-DLI engine can evaluate the rule.

225 CMR 28.02, definition:

> Growing Season Hours. For April through September, 9 AM to 6 PM. For March and October, 10 AM
> to 5 PM.

2022 guideline §3(b)(iv), same content in prose:

> Growing Season/Time of Day Considerations: The typical growing season shall be March through
> October, with sunlight hour conditions with maximum 50% sunlight reduction to be between 10AM
> and 5PM for March and October, and from 9AM to 6PM from April through September.

So the criterion is evaluated over an eight-month season restricted to a fixed local-clock
daypart window, **not** over the year and **not** at a single instant. November through February
are outside the test entirely. Our annual DLI map is the wrong aggregation window for this rule.

Neither text states whether the 50% is the reduction in **cumulative** insolation summed over
Growing Season Hours or the **worst instantaneous** reduction anywhere in that window. The word
"maximum" attaches to "sunlight reduction", which reads as a worst case, but the tool's own
output is binned shade percentages per ground cell. This residual ambiguity is itself a reason
not to render a binary verdict.

### 1.7 (e) Footprint or cropped area: **broader than the footprint**, and the method is prescribed

The rule applies to > "every square foot of land directly beneath, behind, and in areas adjacent
to and within the STGU's design". That is wider than the array footprint and wider than the
cropped area: it explicitly reaches **behind** and **adjacent to** the array.

The prescribed method, 2022 guideline §3(a):

> Applicants must use the shading analysis tool (SMART Tool) developed by the Department to apply
> as an ASTGU in the SMART Program.

SMART 3.0 guideline §2(a):

> To demonstrate compliance with the Sunlight Requirements under 225 CMR 28.07(5)(b)3.b.ii.,
> Applicants shall use the Shading Analysis Tool provided on the Department's website. The
> Department, in consultation with MDAR, may offer an alternative shading analysis tool in the
> future.

The tool is a public web app at `s3.us-east-2.amazonaws.com/bluewave-shade/jan23-1002/`. Its
`js/app.js` exposes a per-month checkbox set (JAN..DEC) and bins results in 10% shade increments.
Its own page footer reads "UNDER CONSTRUCTION".

**This is decisive.** Compliance is defined as the output of a specific DOER-published program,
"as calculated by the SMART Tool". An independent shading engine, however accurate, does not
demonstrate compliance. Our tool can predict what the SMART Tool will say; it cannot substitute
for it.

### 1.8 Exception pathway

Every project specification requirement is waivable. 225 CMR 28.07(5)(b)3.b.iv provides for an
exception from "one or more of the Project Specification Requirements in 225 CMR
28.07(5)(b)3.b.i. through iii." The guideline requires the applicant to > "demonstrate how each
square foot of land will be used for agriculture production, including at least 51% of the area
directly beneath the solar modules" and to show the design yields "equal or greater total
agricultural yields than if both the agricultural crop and solar array were grown and installed
separately". A design failing the 50%/8 ft/10 ft parameters is therefore **not** non-compliant;
it is a design that needs an exception request.

### 1.9 RECOMMENDATION

**Downgrade the Massachusetts overlay from CHECK to ESTIMATE.** Not because the thresholds are
uncertain (they are now fully verified verbatim) but because three independent facts each
disqualify a self-certifying check:

1. DOER mandates its own Shading Analysis Tool as the compliance method. Ours is not it.
2. The evaluation window is Growing Season Hours (Mar-Oct, 09:00-18:00 / 10:00-17:00), which our
   annual-DLI pipeline does not currently produce, and the cumulative-vs-worst-case reading of
   "maximum sunlight reduction" is ambiguous in the regulation itself.
3. Every parameter is waivable via the exception process, so pass/fail is not a property of
   geometry.

Ship it as: *"Estimated against the Massachusetts SMART 3.0 dual-use design parameters. DOER
requires its own Shading Analysis Tool for the actual determination; results below are indicative
only."* Two-state output ("meets the expedited design parameters" / "would require an exception
request"), never "compliant" / "non-compliant".

Also fix in `00-DECISIONS.md` §8 and `CITATIONS.md` B3:

- Citation is **225 CMR 28.00** (SMART 3.0), §28.02 and §28.07(5)(b)3, plus the *Guideline
  Regarding the Definition of Dual-use Agricultural Solar Tariff Generation Units*. 225 CMR 20.00
  is legacy.
- Term is **Dual-use Agricultural STGU**.
- Add: 2:1 DC:AC, 7,500 kW DC ceiling.
- Add: tracker 10 ft may drop to 8 ft under the conditional in 28.07(5)(b)3.b.i(ii).
- Add: Growing Season Hours definition.
- Add: scope is beneath, behind **and adjacent to** the array.
- Delete "This is the only regime the tool can check itself."

---

## 2. DIN SPEC 91434:2021-05

**Verdict: RESOLVED. All seven claims, including all three negatives, are correct as written.**

Full 26-page text obtained and read. Two independent copies located:

- `https://arendsee.info/stadt-arendsee/wp-content/uploads/sites/3/2024/06/DIN_SPEC-91434.pdf`
- `https://www.laves.niedersachsen.de/download/210771/Din_Spec_Agri_PV.pdf` (Lower Saxony state
  government, corroborating copy, also 26 pp)

Also tried: `dinmedia.de/de/normen-produkte/din-spec-pas/din-spec-pas-kostenlos-1068050` (confirms
the free-DIN-SPEC portal exists), `dinmedia.de/en/technical-rule/din-spec-91434/337886742`
(product page only). Note the fetch could not parse the PDF binary; the file itself was fine once
read directly. Free-download status confirmed from the standard's own Vorwort: *"Die kostenfreie
Bereitstellung dieses Dokuments als PDF-Version über den Beuth WebShop wurde im Vorfeld
finanziert."*

### Positives

| Claim | Clause | Verbatim | Verdict |
|---|---|---|---|
| 66% reference yield | 5.2.10 | "Es muss sichergestellt sein, dass der Ertrag der Kulturpflanze(n) auf der Gesamtprojektfläche nach dem Bau der Agri-PV-Anlage mindestens 66 % des Referenzertrages beträgt." | Correct |
| 2.10 m clearance | 6.4.2 | "Über der landwirtschaftlich genutzten Fläche muss eine lichte Höhe von mindestens 2,10 m sichergestellt sein" | Correct, **Category I only** |
| <10% / <15% area loss | 5.2.3 | "Der Verlust an landwirtschaftlich nutzbarer Fläche durch Aufbauten und Unterkonstruktionen darf höchstens 10 % der Gesamtprojektfläche bei Kategorie I und höchstens 15 % bei Kategorie II betragen." | Correct |
| Category I / II | 4 | "Im Rahmen dieses Dokuments werden Agri-PV-Anlagen für zwei Kategorien definiert: Agri-PV-Anlagen mit einer Aufständerung mit lichter Höhe (Kategorie I) und Agri-PV-Anlagen mit einer bodennahen Aufständerung (Kategorie II)." | Correct |

Category assignment, confirmed because it is easy to invert: **Category I = elevated, crops
cultivated under the panels, 2.10 m minimum. Category II = near-ground mounting, crops between
the rows, no minimum clearance at all** (5.2.2: *"Für Agri-PV-Anlagen der Kategorie II ist keine
Aufständerung mit lichter Höhe nötig."*). Each category subdivides into use-classes A-D (Table 1).

Reference yield basis, clause 5.2.11: average of the last 3 years for perennials/grassland, or
averaged over 3 crop-rotation cycles for arable rotations; if the crop was not previously grown
on site, three-year published statistics (Destatis or state agricultural statistics).

### Negatives

All three confirmed **absent from the full text**, not merely "not found":

- **No numeric light-homogeneity threshold.** Definition 3.8 defines Lichthomogenität purely
  qualitatively: *"gleichmäßige Verteilung des auf die landwirtschaftlich nutzbare Fläche
  treffenden Lichts unter Berücksichtigung der Beschattung durch die Agri-PV-Anlage"*. Clause
  5.2.5 asks only for *"eine möglichst hohe Lichthomogenität und eine adäquate Lichtverfügbarkeit"*
  ("as high as possible"). No percentage, ratio or index anywhere.
- **No GCR cap.** No Bodendeckungsgrad / Deckungsgrad / GCR term exists in definitions 3.1-3.11
  or anywhere in the body. The only area-based numeric limits are the 10%/15% Flächenverlust
  figures, which measure usable-area loss to foundations, a different quantity.
- **No minimum row spacing.** Clause 6.4.4 disclaims it explicitly: *"Die Ausrichtung und Abstände
  zwischen den Modulreihen sind nicht festgelegt. Diese müssen allerdings entsprechend der
  Lichtverfügbarkeit und -homogenität geplant und ausgerichtet werden."*

**RECOMMENDATION:** no change to `00-DECISIONS.md` §8 Germany line. Promote `CITATIONS.md` B4
from "not read" to verified, record the two working URLs, and add the Category I/II clearance
asymmetry (Cat II has no height floor) since a naive reader of our one-line summary would assume
2.10 m applies to both. Clause 6.4.4 is worth quoting in the UI: the German standard actively
refuses to set a row-spacing number, which is a stronger statement than silence.

---

## 3. Dehesa / montado distance-from-trunk template

**Verdict: PARTIALLY RESOLVED. "Marcos et al." is unverifiable and should be deleted. A real and
better light source exists. The soil-moisture half of the claim does not hold up.**

### "Marcos et al."

No dehesa/montado paper by any Marcos on radiation, PAR or soil moisture was located under
author-name, topic and combined searches. Nearest real surnames in this literature are Marañón
(canopy effects on species richness, not PAR) and Montero (below). Treat as a garbled or
confabulated citation.

### Light: real, quantified, and genuinely a functional form

Montero, M.J., Moreno, G. & Bertomeu, M. (2008). Light distribution in scattered-trees open
woodlands in Western Spain. *Agroforestry Systems* 73:233-244. DOI
[10.1007/s10457-008-9143-4](https://doi.org/10.1007/s10457-008-9143-4).

Verbatim from the publisher abstract:

> Intercepted light decreased with distance following an logistic curve, indicating a rapid
> increase in the light availability with distance from the tree. For mature trees, radiation was
> constant beyond 20 m.
> Applying a multivariable regression light equation, distance, stem diameter and canopy width
> explained more than 88% of the light variability for each orientation studied.

Design: 36 trees, canopy widths 0.1-14 m, two dehesa stands at 19 mature trees/ha, hemispherical
photographs at multiple distances per tree. Modelled net effect: radiation to crops and pasture
reduced by up to 21% in a standard dehesa at 24 mature trees/ha.

This does support "reusable empirical template": it is a fitted logistic curve in distance with
covariates, R^2 > 0.88, not a scatter of point measurements. **The coefficients themselves were
not obtained** (Springer paywall past the abstract), so the template cannot actually be
instantiated from what we hold today.

### Soil moisture: real papers, wrong shape

Cubera, E. & Moreno, G. (2007). Effect of single *Quercus ilex* trees upon spatial and seasonal
changes in soil water content in dehesas of central western Spain. *Annals of Forest Science*
64:355-364. DOI [10.1051/forest:2007012](https://doi.org/10.1051/forest:2007012). Monthly TDR
θ measurements 2002-2005, **2-30 m from trunk**, to 300 cm depth, four dehesas. Results are
reported as beneath-canopy vs beyond-canopy contrasts by depth and season, not as a fitted
distance function. Full text paywalled; no numeric gradient extracted.

Companion: Cubera & Moreno (2007), *Catena* 71:298-308 (ScienceDirect Cloudflare 403).

Also checked and found **not** to be distance-gradient studies: Joffre & Rambal (1993), *Ecology*
74:570-582 (canopy vs open contrast); Moreno (2008), *Agric. Ecosyst. Environ.* 123:239-244
(three discrete zones). A search summariser asserted "PAR reduced ~25% near the trunk" for the
latter; that figure is **not** in the abstract and must not be used. Moreno et al. (2005), *Plant
and Soil* 277:153-162 is real but is root biomass, not light or moisture.

Failed: academia.edu 403, researchgate 403 (multiple), sciencedirect 403 (multiple), Springer
auth walls on all three Moreno/Cubera full texts.

**RECOMMENDATION:** In `00-DECISIONS.md` §12, replace the unattributed "Marcos et al." with
Montero, Moreno & Bertomeu 2008, and **narrow the claim to light only**. Delete "and soil
moisture" from the highest-value-analog sentence: the soil-moisture literature exists but reports
categorical zones, not a reusable curve. Until someone obtains the Montero full text and the
actual regression coefficients, the distance-from-panel-edge model must be **geometry-derived,
with dehesa cited only as qualitative corroboration that a logistic distance decay is the right
shape**. Close `CITATIONS.md` A1 as "citation corrected, template not yet instantiable".

### Code status (2026-08-09)

`src/data/tek.ts` no longer names "Marcos et al." anywhere, in comment or in the user-facing
`DEHESA_GRADIENT_CAVEAT` string. The rewritten caveat keeps the true part of the old one, that the
endpoints follow the published qualitative direction while the intermediate samples are
interpolated rather than measured, and drops the instruction to replace the curve with a paper
that does not exist. `montero2008-dehesa-light` (present in `docs/CITATIONS.csl.json`) has been
added to `dehesaGradient`'s `citedDerived` citations alongside `moreno2009-dehesa` and
`simionesei2018-montado-water`, because it genuinely backs the qualitative shape of the light
half; its own corpus entry is explicit that the regression coefficients were never obtained, so it
is cited as shape corroboration only, not as a source for these magnitudes. The soil-moisture half
remains uncited to any distance-function paper, as this section already established, and the
template stays geometry-derived rather than instantiated from Montero. Release blocker item 5
below is closed for `tek.ts`; `00-DECISIONS.md`, `CITATIONS.md` and
`docs/05-tek-agroecology.md` still name "Marcos et al." and were out of scope for this revision.

---

## 4. Desmodium mechanism revision

**Verdict: RESOLVED.**

Erdei, A.L., David, A.B., Savvidou, E.C., Džemedžionaitė, V., Chakravarthy, A., Molnár, B.P. &
Dekker, T. (2024). The push-pull intercrop *Desmodium* does not repel, but intercepts and kills
pests. *eLife* 13:e88695. DOI [10.7554/eLife.88695](https://doi.org/10.7554/eLife.88695). Version
of Record 2024-04-16; reviewed preprint 2023; bioRxiv 2022.03.08.482778.

What the revision claims, precisely:

- Terpenoids previously reported as repellent were barely detectable in *D. intortum* headspace
  across greenhouse, field, and with/without soil microbes, and rose only marginally after
  herbivory. Field headspace sampling: 50 samples, Tanzania and Uganda.
- Wind-tunnel oviposition assays: gravid female *Spodoptera frugiperda* laid equal numbers of egg
  batches on maize with and without *Desmodium* odour. **No adult repellency.**
- First-instar larvae *preferred* *Desmodium* leaf tissue over maize in choice assays, but
  development stagnated and **no larvae survived to pupation**. Proposed mechanism: dense
  silica-fortified uncinate (hooked) trichomes physically wound larvae.
- Conclusion: *Desmodium* functions as a **trap crop that intercepts and kills larvae**, not as a
  volatile repellent of adults.

eLife assessment rates strength of evidence "solid". No formal rebuttal or eLife response from
the icipe group was found.

Related, do not conflate: Odermatt, J. et al. (2025), *eLife* RP100981, DOI
[10.7554/eLife.100981.3](https://doi.org/10.7554/eLife.100981.3), includes icipe-affiliated
authors, detected 25 field volatiles (more than Erdei et al. found) but still found no
significant reduction in FAW oviposition, concluding volatile repellency alone is insufficient.
This is a parallel study, not a rebuttal.

Separately, the **Striga** mechanism is a different pest guild and a different chemistry, and our
docs risk merging them: Tsanuo, M.K. et al. (2003), *Phytochemistry* 64(1):265-273 (uncinanones
A/B/C in root exudate; suicidal germination and radicle inhibition) and Hooper, A.M. et al.
(2010), *Phytochemistry* 71(8-9):904-908 (isoschaftoside).

**RECOMMENDATION:** In `00-DECISIONS.md` §11 replace the bare "(eLife)" with the full Erdei et
al. 2024 citation and DOI. Keep the grade at "A outcome, non-transferable". State the mechanism
as *interception and larval mortality on the intercrop, not adult repellency*, and scope it to
stemborer/fall armyworm explicitly so no reader transfers it to the Striga claim. Close
`CITATIONS.md` A6.

---

## 5. Two constants with no source

### 5a. Penumbra ~7.5 cm at 4 m clearance

**Verdict: RESOLVED as WRONG. The figure is too large by a factor of 2 at 4 m, and the
"ignore it" conclusion is only safe near solar noon.**

Derivation, stated in full so it can go inline in the code:

The Sun's mean angular diameter is 0.533 deg (31.99 arcmin), varying 0.524-0.542 deg between
aphelion and perihelion. That **is** the full limb-to-limb angle, so there is no second factor of
two to apply. For an occluding edge at height h with the Sun directly overhead, the shadow
transitions from full umbra to full illumination over a ground distance

```
w_perp = h * tan(0.533 deg)
```

| h | w_perp |
|---|---|
| 2 m | 1.86 cm |
| 3 m | 2.79 cm |
| 4 m | **3.72 cm** |
| 6 m | 5.58 cm |
| 8 m | 7.44 cm |

So 7.5 cm is the correct zenith-sun penumbra width at **h ~= 8.1 m**, not 4 m. The most likely
error is doubling 3.7 cm to account for "both limbs", which double-counts, since 0.533 deg is
already the full disc.

The zenith case is also the *narrowest* case, and it never occurs in Massachusetts or anywhere
above 23.5 deg latitude. For solar elevation alpha, the slant path is h/sin(alpha) and the ground
projection stretches by a further 1/sin(alpha):

```
w_ground(alpha) = h * tan(0.533 deg) / sin^2(alpha)
```

At h = 4 m:

| alpha | w_ground |
|---|---|
| 90 deg | 3.7 cm |
| 75 deg | 4.0 cm |
| 65 deg | 4.5 cm |
| 50 deg | 6.3 cm |
| 40 deg | 9.0 cm |
| 30 deg | 14.9 cm |
| 20 deg | 31.8 cm |
| 15 deg | 55.6 cm |

**RECOMMENDATION:** Replace the `00-DECISIONS.md` §3 line. It is derivable, so present it as a
derivation and not as a cited physics constant. Correct wording:

> Penumbra half-transition width = `h * tan(0.533 deg) / sin^2(alpha)`, where 0.533 deg is the
> Sun's mean angular diameter. At h = 4 m this is 3.7 cm at solar noon overhead and ~4.5 cm at
> alpha = 65 deg, below the 12 cm raster cell, so it is ignored for annual DLI. It exceeds one
> cell below alpha ~= 33 deg, but those hours carry little energy, so the annual-integral error
> stays small.

Note that "ignore for annual DLI" survives, but the *reason* changes: it is below raster
resolution near noon, not negligible in absolute terms at all times. Do not reuse this constant
for any instantaneous or edge-detail rendering. Close `CITATIONS.md` A7 as "derived, corrected
from 7.5 cm to 3.7 cm, elevation dependence added".

### 5b. Inter-reflection 3-8% in the shade strip for white backsheets

**Verdict: formula PARTIALLY RESOLVED; the 3-8% magnitude is UNVERIFIABLE.**

Formula `E / (1 - rho_g (1 - SVF) rho_m)`: this is an instance of the standard two-surface
enclosure radiosity result `B = (I - rho F)^-1 E` (Modest; Siegel & Howell), so the mathematics is
legitimate. **No PV, bifacial or agrivoltaic publication was found stating it in this form.**
Specifically checked and found to contain single-bounce terms only, with no iterative or
infinite-series module<->ground term:

- pvlib `bifacial/infinite_sheds.py` (single bounce; cites Mikofski et al. 2019 PVSC
  `10.1109/PVSC40753.2019.8980572`)
- Marion et al., A Practical Irradiance Model for Bifacial PV Modules, 44th IEEE PVSC 2017, full
  text via `https://www.osti.gov/servlets/purl/1460254`. Configuration factors only. **Not our
  source**, contrary to the guess in `CITATIONS.md` A8.
- Sandia PVPMC POA ground-reflected page: `E_g = GHI * albedo * (1 - cos theta)/2`, single bounce
- PVsyst documentation, explicitly: no specular reflections, only the ground scatters back light
- Zainali et al. (2025), *Applied Energy* 386:125558, lists "Estimating reflected irradiance in
  bifacial modules" as an **open** research challenge

The 3-8% figure appears nowhere. Three superficially similar numbers were found and are all
**different quantities**, and must not be substituted:

1. ~8% simulated / ~25% measured increase in **module rear** irradiance from white ground cloth
   in vertical bifacial systems (ground -> module, the opposite direction; driven by ground cover,
   not backsheet)
2. ~1.5-2.5% module power gain from higher-reflectance PP vs PET backsheet (internal
   cell-to-module optical gain)
3. ~2-3% "light recycling" from white backsheets reflecting through the front glass (also
   internal to the module)

Failed: `mdpi.com/2673-9941/4/4/31` (403 on an HTTP fetch, curl and the /pdf variant),
`nature.com/articles/s44172-025-00523-1` (login wall), `docs.nrel.gov/docs/fy17osti/67847.pdf`
(DNS failure).

**RECOMMENDATION:** Keep the formula, cite it as a **standard radiosity result derived in-house**,
not as a PV-literature citation, and drop the Marion 2017 guess from A8. **Delete the "3-8%"
magnitude and the "only material for white backsheets" qualifier** from `00-DECISIONS.md` §3
unless someone runs the numbers with real rho_m and SVF values and publishes that as our own
sensitivity study. As written it is an unattributed number that reads as measured.

---

## 6. Faust & Logan 2018 and Zhang et al. 2025

**Verdict: RESOLVED. Both full texts retrieved.**

### Faust & Logan 2018

Faust, J.E. & Logan, J. (2018). Daily Light Integral: A Research Review and High-Resolution Maps
of the United States. *HortScience* 53(9):1250-1257.

Retrieved by rendering `https://journals.ashs.org/view/journals/hortsci/53/9/article-p1250.xml`
in a JS-executing browser. The previously recorded 403 did not reproduce; plain HTTP clients get
the empty SPA shell, which is not the same as a paywall. No login gate was hit.

- Map contour interval: **5 mol/m2/d bins**, 0-5 through 60-65
- Summer peak, verbatim: > "The maximum DLI range in the original maps was 55-60 mol·m⁻²·d⁻¹
  which appears in the southwestern United States during May through July... The updated maps have
  an additional DLI range (60-65 mol·m⁻²·d⁻¹) that appears in the southwest only during June."
- Low end, verbatim: > "The 0-5 mol·m⁻²·d⁻¹ zone was added because of the addition of Alaska"
- Conversion factor, verbatim: > "0.0072664 mol (400-700 nm)·Wh⁻¹ (400-2700 nm), which assumes
  that 45% of the solar spectrum is in the PAR... and 4.48 μmol·J⁻¹."
- **There is no per-crop DLI table in this paper.** It is a narrative review by crop group.
- Closest thing to a minimum, and it is a worked example not a finding: > "If 5 mol·m⁻²·d⁻¹ is
  considered to be the lowest acceptable DLI for a greenhouse crop, then supplemental lighting
  must supply 1-3 mol·m⁻²·d⁻¹ to hit this target." Also > "it is reasonable to expect that
  shade-tolerant bedding plants flower well at 5-10 mol·m⁻²·d⁻¹, whereas most 'full sun' bedding
  plant species are of high commercial quality when grown at DLIs ranging from 15 to 25
  mol·m⁻²·d⁻¹."

Note the paper's 0.45 PAR fraction and 4.48 umol/J agree with our `00-DECISIONS.md` §3 constants
(0.45, 4.57 in-band). Our 4.57 is the McCree in-band value; Faust uses 4.48. Minor, but the
composite 2.06 umol/J figure should say which it derives from.

**Attribution correction:** any "10-12 mol/m2/d minimum" in our docs traces to Purdue HO-238-W
(Torres & Lopez), **not** to Faust & Logan.

### Zhang et al. 2025

*Agronomy for Sustainable Development* 45:69, DOI
[10.1007/s13593-025-01060-z](https://doi.org/10.1007/s13593-025-01060-z). Confirmed CC BY 4.0
gold OA. Retrieved with `curl` and a browser UA from
`https://link.springer.com/content/pdf/10.1007/s13593-025-01060-z.pdf`; an HTTP fetch on the same URL
hit an `idp.springer.com` login redirect. 21 pp read.

**Our "~50% shade tipping point" attribution is wrong on two counts.**

1. The paper's own headline "tipping point" is **not a shade percentage**. Abstract, verbatim:
   > "we identified a previously undocumented 'tipping point' in system size (~2 ha), beyond
   > which microclimate temperature effects reverse."
   Breakpoint at 19,839 m2 (Fig. 11).
2. The shade result is a separate segmented regression (n=155), verbatim:
   > "at shading rates below 20%, crop yield shows no statistically significant difference from
   > the control group (p = 0.084)... In the shading scale between 20% and 30%... lower yield is
   > observed (p < 0.01). There is a positive trend in yield observed with shading at 30 to 40%
   > (p≈0.05)... Shading at 40 to 50% leads to a slight and non-significant reduction in yield
   > (p > 0.05). Shading between 50% and 60% markedly suppresses crop productivity (p < 0.05).
   > Shading above 60% further inhibits crop productivity (p < 0.01)."
   Authors' conclusion, verbatim: > "Our analysis suggests that shading rates between 30% and 40%
   > may support plant growth while maintaining reasonable solar output. Shading above 50% is not
   > ideal from a crop standpoint, as it often reduces net photosynthesis."
3. The literal 50% number is **attributed by Zhang et al. to prior work**, verbatim: > "Beck et
   al. (2012) identified 50% shading as a threshold for shade tolerant crops such as lettuce and
   potatoes, to start losing yield."

Crop groupings used: corn = shade-sensitive (n=17), beans = partial (n=40), lettuce =
shade-tolerant (n=42). **No per-group effect-size table with confidence intervals exists in the
paper.** Any such numbers cited to Zhang et al. 2025 are unsupportable.

**RECOMMENDATION:** Both papers may now back quantitative claims, with the corrections above.
Rewrite `00-DECISIONS.md` §7's blanket exclusion. Specifically:

- Do not describe "~50% shade" as Zhang's tipping point. Say: Zhang et al. 2025 find the 50-60%
  shading band significantly suppresses yield (p < 0.05), and that shading above 50% is not ideal.
- Record Zhang's actual novel finding (~2 ha system-size threshold for microclimate temperature
  sign reversal), which is out of scope for garden-scale but should stop us citing the paper for
  something it does not say.
- `CITATIONS.md` A5 ("Beck et al. 2012 not traced") is now partially explained: Zhang et al. cite
  it as the origin of the 50% threshold. It is still not traced to primary text and remains a
  secondary attribution. Cite Zhang's own segmented regression instead, as A5's own suggested fix
  proposed.

---

## 7. Base temperatures and DLI from trackgdd.com, hydroponics blogs and ReduSystems

**Verdict: RESOLVED 2026-09-11 (decision record 23 in `00-DECISIONS.md`). The gap was confirmed
rather than overstated and one value was traced to ReduSystems verbatim. The tomato and pepper
rows now carry Runkle 2011 at Tier C, the lettuce rows carry per-crop trials verified against
Crossref at Tier A, and the ReduSystems numbers are gone. The base temperatures below stay open.**

### Confirmed contaminated

| Value | Repo location | Actual origin | Replacement found |
|---|---|---|---|
| Tomato DLI target 22-30, ">=22 for good productivity" | doc 04 line 468, Tier A, cited to `torres-lopez-dli`/`msu-dli`/`vce-spes720` | **ReduSystems**, verbatim: "An adult tomato crop requires at least 22 mol/m2/d for good productivity" | None. Purdue HO-238-B-W has only a qualitative colour band |
| Sweet pepper DLI target 20-30 | doc 04 line 469, Tier A | Same ReduSystems article | None |
| Lettuce "14-16 ideal" | doc 04 line 506, Tier A, cited to `cornell-tipburn` | ReduSystems verbatim | None for 14-16 |
| Lettuce tipburn >17 for >3 d | same row | Cornell CEA | **Confirmed**, agrees |

The failure mode here is worse than "unsourced": these rows carry legitimate extension citation
IDs in `src/data/catalog/citations.ts` while the numbers came from ReduSystems. They currently
read as sourced.

### Base temperatures

| Value | Status |
|---|---|
| Sweet corn Tbase 10 C, Tupper 30 C (`rows.ts` sweet-corn) | **CONFIRMED** against NDSU NDAWN corn GDD model. Standard agronomic value |
| Pea Tbase 4.5 C (`rows.ts` pea-garden) | **Unverified.** Both cited primaries 403 (ScienceDirect S037837742500469X; Bierhuizen & Wagenvoort 1974, `0304423874900296`). Independent literature scatters roughly -1 to 6 C by stage and method, so 4.5 is plausible but unconfirmed |
| Tomato Tbase 10 C | **Plausible, unconfirmed.** Literature splits between 10 C (extension convention) and 5 C (a specific study). Cited review paywalled |
| Cool-group Tbase 4.4 C (`schema.ts` ARCHETYPES.cool) | Literature clusters 3.5-5 C for lettuce, spinach and cole crops, so **4.4 is defensible**. Doc 04's stated range "0-4.4 C" is not: the 0 C lower bound is unsupported and should be dropped |

### Additional contradictions found, independent of the bad-source question

- **Strawberry.** Doc 04 gives DLI min 10. Widmer et al., already cited elsewhere in this repo,
  gives ~25. `00-DECISIONS.md` §6 already uses 25. Doc 04 is internally inconsistent with the
  decision record and materially wrong.
- **Raspberry.** Doc 04 min 10 vs Widmer ~15.
- **Potato "50% threshold, Tier B"** rests on Beck et al. 2012, which this repo's own ledger (A5)
  flags as unlocated. See §6 above for the replacement.
- **Carrot / beet "Tier B"** contradicts doc 02's own root-and-tuber row, which says "not
  established... n=2... no DLI threshold exists in the literature. THIN".
- **Sweet corn** qualitative shade avoidance is genuinely backed by Laub 2022, but Laub reports
  %RSR, not mol/m2/d, so the 18 / 25-35 numbers are not from Laub.

### Still unsourced

175 of the 182 DLI rows are Tier C (3 are A and 4 are B, counted from the shipped catalogue on
2026-09-13), i.e. inferred from a sun-hour class via the doc 04 §3.3 conversion, not measured.
No peer-reviewed or extension DLI threshold exists for most of them (alliums, grain legumes,
most culinary herbs, hops, most named perennials). This is a property of the literature, not a
search failure. Each Tier C row cites the class-range methodology (Purdue HO-238-B-W and VCE
SPES-720NP) and the UI says the figure is this app's inference from the sun label.

**RECOMMENDATION:**

1. Strip the ReduSystems-derived numbers from the tomato, pepper and lettuce rows or relabel them
   Tier C, and **remove the extension citation IDs currently attached to them**. A wrong tier is
   recoverable; a false citation is not.
2. Fix strawberry and raspberry in doc 04 to match Widmer, or delete those rows and let
   `00-DECISIONS.md` §6 be the single source.
3. Keep sweet corn 10/30 C, keep cool archetype 4.4 C, drop doc 04's "0 C" lower bound.
4. Pea and tomato Tbase need a human with journal access. Add them to A14 explicitly.
5. Leave the Tier C rows in place but ensure the UI labels them as inference, per §7 of the
   decision record. Ordinal ranking is the product; absolutes are not.

---

## Still unverifiable

Items that were searched properly and did not resolve. Each should be stated as unknown in the
product rather than implied to have backing.

1. **The 3-8% inter-reflection magnitude in the shade strip, and the white-backsheet-only
   qualifier.** No source. Three similar-looking numbers exist for different quantities.
2. **The `E / (1 - rho_g (1 - SVF) rho_m)` form as a PV-literature citation.** Valid radiosity,
   but no PV/bifacial/agrivoltaic paper states it. Marion 2017 is confirmed *not* to be it.
3. **"Marcos et al.", dehesa radiation transmission.** No such paper found. Delete it. Deleted from
   `src/data/tek.ts` 2026-08-09; still present in `00-DECISIONS.md`, `CITATIONS.md`
   and `docs/05-tek-agroecology.md`.
4. **Montero et al. 2008 regression coefficients.** The paper is real and is the right shape, but
   the equation is behind the Springer paywall. The distance template cannot be instantiated from
   it yet.
5. **Dehesa soil moisture as a distance function.** Real papers (Cubera & Moreno 2007) sample
   2-30 m but report categorical zones. No curve.
6. **Beck et al. 2012 primary text.** Now known to be the origin Zhang et al. cite for the 50%
   threshold, but still never traced to source.
7. **Pea and tomato base temperatures.** Both cited reviews 403 to automated fetch.
8. **167 Tier C per-crop DLI values.** The literature does not contain them.
9. **Whether the MA 50% test is cumulative over Growing Season Hours or worst-instantaneous.**
   The regulation does not say.
10. **RESOLVED, and no longer a constant.** The gap below which two designs are called tied is now
    derived per run by `scoreResolution`, from the bake's own error measured in raw units across
    eight paired real-weather runs (Tromso, Bergen x2, Edinburgh, Amherst x2, Phoenix, Singapore;
    preview against `FINAL_OPTIONS`). Season RSR moves under one percentage point everywhere;
    crop share is a step and moves up to 0.0702. Both constants are the worst measured value, and
    they are carried through the same min-max normalisation the score uses, which is what makes
    the margin widen exactly where the candidates crowd together. It covers all eight, including
    the Bergen courtyard that defeated the previous constant, and is tighter than that constant
    wherever the set is well separated. **What remains open** is that both raw constants rest on
    eight runs at one plot aspect ratio and one objective; the crop-share figure in particular is
    a step whose size depends on how many crops sit near the light gate, so a catalogue change
    moves it. Re-measure after any change to the light gate or to the crop DLI values. Note also
    that Open-Meteo rate-limits (429) after a few dozen `resolveSite` calls, so gather in batches.
11. Unchanged from the existing ledger and not re-examined: A2 wind reduction, A3
    frost/dew, A4 VPD deltas, A9 the 0.25 deg/min timestep justification, A15 soil data licensing,
    A16 Croptime coverage.

## Searched and not found: an upper DLI bound for anything but lettuce

Asked because the recommender cannot rank on over-light, and a woodland ephemeral therefore
scores a PERFECT light fit in full desert sun. `dliFit` in `recommend/stages/light-gate.ts` rises
to 1.0 at the crop's target and stays there for any brighter bed; ramps' target is 9 mol/m2/d, a
Phoenix bed reads 52.9, and it scores exactly as well on light as okra does.

The obvious fix is to read `dliTargetHigh` as a ceiling. **That would reverse the sources.** Those
values are the top of a stated RANGE, and several of the ranges were written from open-ended
guidance: `rows.ts` records tomato as 15/20/30 from Runkle's "15, preferably >20", so 30 is a
rendering of "more is better", not a maximum. Treating it as one would recreate exactly the class
of error section 7 above documents.

What the corpus actually contains, after searching doc 04, doc 05 and the decision record:

| Claim sought | Result |
|---|---|
| A per-crop DLI maximum | **Only lettuce.** Cornell CEA tipburn above 17 mol/m2/d sustained beyond three days, already modelled as `dliMaxBeforeDisorderMolM2Day` and confirmed in section 7 |
| A "requires shade" flag for understory species | **None, and for ramps the primary source says the opposite.** See below |
| A DLI ceiling for the `understory-herbs` class | **None.** The decision record's 2-4 / 4-10 pair is a minimum and a target, and its own text says so |

### The ramps premise was checked against a primary source, and it did not survive

The search was extended beyond the repo's own corpus to look for a shade requirement for ramps
specifically, since ramps is the crop that raised this. The USDA National Agroforestry Center's
*Forest Farming Ramps* (AF Note-47, December 2014; Chamberlain, Beegle and Lajeunesse Connette;
US federal, public domain) was retrieved and its text extracted. Under **TREE COVER** it states,
verbatim:

> Ramps need lots of sun early in the growing season, and they like shade when the growing season
> is over to conserve soil moisture and temperature.

The same note's timeline has the leaves dying back as the overstory leafs out. So the shade in a
ramp habitat is a **post-season** condition, not a growing-season light requirement, and the
catalogue's growing window for ramps (months 3 to 5) is exactly the pre-canopy period the note
describes. **A woodland ephemeral scoring well on a bright bed is therefore not evidence of a
light-gate error.** It is now cited as `chamberlain2014-forest-farming-ramps`, for the direction
of the requirement only: the note contains no DLI figure for ramps or for anything else.

Note also that secondary summaries of ramp cultivation quote a "60-80% shade" canopy target and
attribute it loosely to forest-farming guidance. **That figure is not in this note.** It was
looked for and is not there.

### What that leaves

The catalogue still cannot distinguish a shade-TOLERANT crop from a shade-REQUIRING one, and the
light gate still has no ceiling for anything but lettuce. Both remain true. What changed is the
example that motivated them: what actually rules a temperate hardwood-forest perennial out of a
Phoenix garden is the CLIMATE envelope, a different term with its own evidence, and not the
light term at all.

The provenance ledger cannot carry any of this: `gapOf` reports a claim that is present and
uncited, and these are claims that are absent.

Do not close this by inventing a curve. The limitation is now stated on screen instead, in the
"What the DLI gate rests on" panel, under two headings: *The gate has a floor and almost no
ceiling* and *A shade plant on a bright bed is not automatically an error*.

## Release blockers

Things that must not ship as an assertion in their current form.

1. **The Massachusetts overlay must not ship as a CHECK.** Downgrade to ESTIMATE. DOER mandates
   its own Shading Analysis Tool as the compliance method; the test window is Growing Season
   Hours, not the annual DLI our engine produces; and every parameter is waivable. Also update the
   citation from 225 CMR 20.00 to 225 CMR 28.00 (SMART 3.0) before any of this reaches a user.
2. **The penumbra constant is numerically wrong** (7.5 cm vs 3.7 cm at 4 m). Harmless to the
   annual DLI conclusion, fatal to credibility if a reviewer checks it. Replace with the
   derivation.
3. **The "3-8%" inter-reflection figure must be deleted**, not softened. It is an unattributed
   number presented as a physics constant.
4. **RESOLVED 2026-09-11, decision record 23.** The tomato, pepper and lettuce DLI rows carried
   extension citation IDs over ReduSystems numbers, a false citation rather than a weak one. The
   rows now cite what their numbers came from: Runkle 2011 at Tier C for tomato and pepper, and
   per-crop trials at Tier A for lettuce. `CITATIONS.md` A14 stays open for the base temperatures.
5. **"Marcos et al." must not appear in any shipped artefact.** Replace with Montero, Moreno &
   Bertomeu 2008 and narrow the claim to light. `src/data/tek.ts` fixed 2026-08-09: the comment
   and `DEHESA_GRADIENT_CAVEAT` no longer name Marcos, and `montero2008-dehesa-light` is cited for
   the light shape only, not for the magnitudes and not for soil moisture. Other artefacts named
   above still have it.
6. **Do not attribute a "~50% shade tipping point" to Zhang et al. 2025.** Their tipping point is
   ~2 ha of system size. The shade result is a segmented regression with a 50-60% band, and the
   50% figure itself is their citation to Beck et al. 2012.
7. **Doc 04's strawberry DLI minimum (10) contradicts the decision record (25)** and the source
   the repo already holds. One of them is wrong on a value that gates a crop recommendation.
