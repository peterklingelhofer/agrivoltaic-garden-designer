# Solar / PV Engineering Specification

**Component:** solar-radiation subsystem of a browser-based 3D agrivoltaic garden designer
**Target runtime:** TypeScript + WebGL2 (baseline) / WebGPU (fast path), no mandatory backend
**Deliverable of this subsystem:** an annual ground-level irradiance and DLI raster under a parametric PV array, plus PV plane-of-array (POA) irradiance for the energy yield model
**Date:** 2026-07-29

---

## 0. Conventions, symbols, units

| Symbol | Meaning | Unit |
|---|---|---|
| `φ` | observer latitude, north positive | rad |
| `L` | observer longitude, east positive | rad |
| `δ` | solar declination | rad |
| `ω` | hour angle, solar noon = 0, afternoon positive | rad |
| `θ_z` | solar zenith angle | rad |
| `α_s = π/2 − θ_z` | solar altitude (elevation) | rad |
| `γ_s` | solar azimuth, **from true north, clockwise** (N=0, E=90°, S=180°, W=270°) | rad |
| `β` | surface (module) tilt from horizontal | rad |
| `γ_c` | surface azimuth, same convention as `γ_s` | rad |
| `AOI` | angle of incidence on the module plane | rad |
| `E_sc` | solar constant, 1361.1 W m⁻² (Gueymard 2018, TSI reassessment) | W m⁻² |
| `E_0` | extraterrestrial normal irradiance | W m⁻² |
| `GHI, DNI, DHI` | global horizontal, direct normal, diffuse horizontal irradiance | W m⁻² |
| `POA` | plane-of-array total irradiance | W m⁻² |
| `k_t` | clearness index `GHI / (E_0 cos θ_z)` | – |
| `k_d` | diffuse fraction `DHI / GHI` | – |
| `AM_a` | absolute (pressure-corrected) air mass | – |
| `W` | module/row **slant width** (along-slope dimension of the collector) | m |
| `P` | row pitch, centre-to-centre perpendicular to row axis | m |
| `GCR = W / P` | ground coverage ratio | – |
| `h_c` | clearance height, ground to the **lowest** module edge | m |
| `ρ_g` | ground albedo | – |
| `τ` | module optical transmittance (semi-transparent / checkerboard fill factor) | – |
| `SVF` | sky view factor of a ground point | – |
| `DLI` | daily light integral | mol m⁻² d⁻¹ |
| `PPFD` | photosynthetic photon flux density | µmol m⁻² s⁻¹ |

Angles are stored in **radians** internally; only the UI and the Perez/Kasten empirical formulas that are defined in degrees convert.

**Coordinate frame.** Scene is right-handed ENU: `+x = East`, `+y = North`, `+z = Up`. The unit sun vector is

```
s = ( cos α_s · sin γ_s ,  cos α_s · cos γ_s ,  sin α_s )
```

Three.js users note: three.js is Y-up. Keep the physics in ENU and apply a single fixed basis swap at the render boundary; do **not** carry two angle conventions through the model code. This is the single most common source of azimuth sign bugs.

---

## 1. Solar position

### 1.1 Candidate algorithms

| Algorithm | Reference | Stated uncertainty | Valid range | Cost |
|---|---|---|---|---|
| **NREL SPA** | Reda & Andreas 2004, *Solar Energy* 76(5) 577–589; NREL/TP-560-34302 rev. Jan 2008 | **±0.0003°** (≈1.1 arcsec) in zenith and azimuth | −2000 to +6000 | ~300 trig ops (heliocentric L/B/R series: 64+34+40+... terms, nutation 63 terms) |
| **Michalsky** | Michalsky 1988, *Solar Energy* 40(5) 227–235 (Astronomical Almanac low-precision) | ≈0.01° (36 arcsec) | 1950–2050 | ~20 trig ops |
| **PSA** | Blanco-Muriel et al. 2001, *Solar Energy* 70(5) 431–441; updated Blanco et al. 2020 | **≤0.008°** (0.5 arcmin) | 1999–2015 original, 2020–2050 update | ~15 trig ops |
| **Grena #3 / #5** | Grena 2012, *Solar Energy* 86, 1323–1337 | 0.01° (#3) / 0.0027° (#5) | 2010–2110 | ~10–25 trig ops |
| **NOAA / Spencer** | Spencer 1971; NOAA GML solar calculator | ≈0.05–0.2° in declination | any | ~10 trig ops |

Statistical benchmarking of SPA against Grena 1–5 confirms SPA as the reference standard while showing Grena #5 within a few 10⁻³ degrees at roughly one tenth the cost (IEEE Latin America Transactions, "Statistical Analysis of Solar Position Calculation Algorithms: SPA and Grena 1-5").

### 1.2 Recommendation

**Use a TypeScript port of NREL SPA (Reda & Andreas) as the single authoritative solar-position function.** Rationale:

1. The cost argument does not apply here. Solar position is evaluated **8760 times per site per session** (once per TMY hour), not per pixel and not per frame. 8760 SPA evaluations cost roughly 3–8 ms in JS. Sun positions are then *baked into a Float32Array* and consumed by the GPU. There is no hot loop.
2. Accuracy matters at low sun. An 0.05° declination error at α_s = 5° displaces the tip of a shadow cast by a 4 m structure by ≈ 4 m/tan(5°)² · 0.05°·π/180 ≈ 0.4 m. On a 12 cm ground raster that is 3 cells. SPA removes this entirely as an error source, which means any mismatch against pvlib in validation is unambiguously *your* bug.
3. Free validation: `pvlib.solarposition.spa_python` is a direct transcription of the same reference and gives bit-comparable results, so you get a golden-file test suite for free.

**Fallback (optional, for a "fast preview" mode or a size-constrained build):** Grena #3, or PSA. Do not use SunCalc for the physics path (see 1.6).

Always compute **both** the true geometric elevation `e_0` and the refraction-corrected apparent elevation `e`. Use the **geometric** vector for shadow casting (light travels in straight lines through the scene at these scales) and the **apparent** one only for sunrise/sunset UI and horizon checks. Confusing the two is a second classic bug.

### 1.3 Time base

```
Julian Day (Gregorian, UT):
  if M <= 2:  Y ← Y − 1;  M ← M + 12
  A = floor(Y/100)
  B = 2 − A + floor(A/4)                       (Gregorian only; B = 0 for Julian calendar)
  JD = floor(365.25 (Y + 4716)) + floor(30.6001 (M + 1)) + D + B − 1524.5
        with D = day + (hour + min/60 + sec/3600 − ΔUTC_hours)/24

Julian Ephemeris Day:   JDE = JD + ΔT/86400
Julian Century:         JC  = (JD  − 2451545) / 36525
Julian Ephemeris Cent.: JCE = (JDE − 2451545) / 36525
Julian Ephemeris Mill.: JME = JCE / 10
```

`ΔT = TT − UT1` (≈ 69–74 s for 2020–2030). Ship a small polynomial/table (IERS Bulletin A, or Espenak & Meeus polynomial expressions for ΔT); an error of 1 s in ΔT moves the sun by ≈0.004°, so a constant 70 s is acceptable for a design tool but the table is 20 lines.

### 1.4 NREL SPA computation chain (implement in this order)

1. **Heliocentric longitude, latitude, radius vector.** Earth periodic terms `L0…L5`, `B0…B1`, `R0…R4` (Appendix A.4.2 of NREL/TP-560-34302). Each term `L_i = Σ_j A_j cos(B_j + C_j · JME)`, then `L = (L0 + L1·JME + … + L5·JME⁵)/10⁸`, reduced to [0, 360).
2. **Geocentric longitude/latitude:** `Θ = L + 180°`, `β_geo = −B`.
3. **Nutation in longitude and obliquity:** 63-term series in the mean elongation `X0`, mean anomalies `X1, X2`, argument of latitude `X3`, ascending node `X4`; yields `Δψ`, `Δε`.
4. **True obliquity:** `ε = ε_0/3600 + Δε`, with `ε_0` the 10th-order polynomial in `U = JME/10`.
5. **Aberration correction:** `Δτ = −20.4898 / (3600 · R)` degrees.
6. **Apparent sun longitude:** `λ = Θ + Δψ + Δτ`.
7. **Apparent sidereal time at Greenwich:**
   `ν_0 = 280.46061837 + 360.98564736629·(JD − 2451545) + 0.000387933·JC² − JC³/38710000`, then `ν = ν_0 + Δψ cos ε`.
8. **Geocentric right ascension and declination:**
   ```
   α = atan2( sin λ cos ε − tan β_geo sin ε ,  cos λ )        (reduce to [0,360))
   δ = asin ( sin β_geo cos ε + cos β_geo sin ε sin λ )
   ```
9. **Observer local hour angle:** `H = ν + L_east − α`, reduced to [0, 360).
10. **Topocentric (parallax) correction:** with equatorial horizontal parallax `ξ = 8.794/(3600 R)` degrees and observer geocentric terms
    ```
    u = atan(0.99664719 tan φ)
    x = cos u + (E/6378140) cos φ          y = 0.99664719 sin u + (E/6378140) sin φ
    Δα = atan2( −x sin ξ sin H ,  cos δ − x sin ξ cos H )
    δ' = atan2( (sin δ − y sin ξ) cos Δα ,  cos δ − x sin ξ cos H )
    H' = H − Δα
    ```
    (`E` = site elevation in m.) Parallax is ≤ 0.0024°, so it is skippable only if you accept SPA degrading to Grena-#5 accuracy.
11. **Topocentric zenith and azimuth:** see 1.5.
12. **Refraction:** see 1.5.

Reference implementation to port from: NREL's C source at <https://midcdmz.nrel.gov/spa/> (registration required; permissive research licence), or the already-permissive transcriptions in `pvlib-python` (`pvlib/spa.py`, BSD-3) and `sg2` / `SolarPosition.jl`.

### 1.5 Explicit angle equations (these are the ones the shading model consumes)

**Solar declination (Spencer 1971, for the simplified path only; SPA supersedes it):**

```
Γ = 2π (n − 1 + (h_UTC − 12)/24) / 365            [fractional year, rad]
δ = 0.006918 − 0.399912 cos Γ + 0.070257 sin Γ
            − 0.006758 cos 2Γ + 0.000907 sin 2Γ
            − 0.002697 cos 3Γ + 0.001480 sin 3Γ    [rad, max error ≈ 0.0006 rad ≈ 0.03°]
```

**Equation of time (Spencer 1971 / NOAA form), minutes:**

```
EoT = 229.18 ( 0.000075 + 0.001868 cos Γ − 0.032077 sin Γ
                        − 0.014615 cos 2Γ − 0.040849 sin 2Γ )
```

**Hour angle from civil clock time** (`t_min` = local clock minutes past midnight, `L_deg` = longitude east-positive in degrees, `TZ` = UTC offset in hours):

```
TimeOffset [min] = EoT + 4·L_deg − 60·TZ
TST        [min] = t_min + TimeOffset
ω [deg]          = TST/4 − 180          →   ω [rad] = π (TST/720 − 1)
```

Equivalently, from SPA, `ω ≡ H'` (topocentric local hour angle) with the sign convention mapped so afternoon is positive.

**Solar altitude / zenith:**

```
sin α_s = cos θ_z = sin φ sin δ + cos φ cos δ cos ω
α_s = asin( clamp(sin α_s, −1, 1) )
```

**Solar azimuth (north-clockwise, numerically robust two-argument form):**

```
γ_s = π + atan2( sin ω ,  cos ω sin φ − tan δ cos φ )        [rad, in (0, 2π)]
```

The `atan2` form is mandatory. The single-argument `cos γ_s = (sin δ cos φ − cos δ sin φ cos ω)/sin θ_z` form loses the east/west branch and produces mirrored shadows in the afternoon; it also blows up at `θ_z → 0` (tropics, solar noon). Guard `α_s > 89.9°` by holding the previous azimuth.

**Atmospheric refraction (SPA / Bennett 1982), degrees, applied to the geometric elevation `e_0`:**

```
Δe = (P_mb/1010) · (283/(273 + T_C)) · 1.02 / ( 60 · tan( (e_0 + 10.3/(e_0 + 5.11)) · π/180 ) )
applied only when e_0 ≥ −(0.26667 + 0.5667)     [sun-disc + refraction threshold]
e = e_0 + Δe
```

**Air mass (Kasten & Young 1989), `θ_z` in degrees. `AM_r` is what Perez 1990 is fitted against
and `AM_a` is what DISC and DIRINT want; the two are not interchangeable, and handing Perez the
pressure-corrected one overstated sky diffuse by about 1% at 1,800 m until 2026-09-07
(`docs/VALIDATION.md` section 1):**

```
AM_r = 1 / ( cos θ_z + 0.50572 (96.07995 − θ_z)^(−1.6364) )     for θ_z < 90°
AM_a = AM_r · (P_mb / 1013.25)
P_mb ≈ 1013.25 · exp(−E_m / 8434.5)                             [barometric, if no measured pressure]
```

**Extraterrestrial normal irradiance (Spencer 1971 eccentricity correction):**

```
E_0 = E_sc ( 1.00011 + 0.034221 cos Γ + 0.001280 sin Γ
                     + 0.000719 cos 2Γ + 0.000077 sin 2Γ )
```
SPA gives `R` directly, so prefer `E_0 = E_sc / R²`.

**Angle of incidence on a plane of tilt `β`, azimuth `γ_c`:**

```
cos AOI = cos θ_z cos β + sin θ_z sin β cos(γ_s − γ_c)
```

**Profile angle** (apparent solar elevation projected into the plane perpendicular to the row axis; this is the *only* sun angle the infinite-row shading math needs):

```
tan ψ = tan α_s / | cos(γ_s − γ_c) |
```
with `σ = sign( cos(γ_s − γ_c) )` recording which side of the row the sun is on. Undefined when `cos(γ_s − γ_c) = 0` (sun exactly along the row axis): then `ψ = π/2` and the row casts no cross-row shadow.

### 1.6 JavaScript / TypeScript libraries

| Library | What it is | Verdict |
|---|---|---|
| **suncalc** (mourner, BSD-2, ~2 kB) | Meeus low-precision; accuracy comparable to timeanddate.com. Good sunrise/sunset phases and moon. Does **not** expose refraction control, air mass, `R`, or pressure/temperature. | Use for **UI only** (sunrise/sunset markers, twilight bands, moon). Not for the irradiance model. |
| **suncalc3 / suncalc-ts** | Maintained TS forks of the above with typings and more phases | Same verdict, better DX. |
| **solar-calculator** (d3/Observable, Mike Bostock, ISC) | NOAA GML solar calculator port; declination, EoT, azimuth/elevation, century-based. ≈0.02° class. | Reasonable **fallback** path; small and dependency-free. |
| **`spa.js` / `nrel-spa` / `solarpos` ports** | Several direct transcriptions of NREL/TP-560-34302 exist on npm and GitHub with varying completeness. Verify the port includes nutation, aberration, and topocentric parallax before trusting the ±0.0003° claim. | **Recommended primary**, after golden-file validation. If none is complete, porting `pvlib/spa.py` is a ~700-line mechanical job (the periodic-term tables dominate). |
| **`sg2` (Solar Geometry 2)** | Blanc & Wald 2012 fast algorithm, C/Python; ~0.0015° for 1980–2030 at ~1/50 SPA cost | Good WASM candidate if SPA JS proves too slow (it will not). |
| **`pvlib-python`** | Not shippable to the browser, but the **reference oracle**. | Use offline to generate golden CSVs: `solarposition.spa_python`, `irradiance.erbs/dirint/disc`, `irradiance.perez`, `bifacial.infinite_sheds`. |

**Validation gate:** generate `pvlib` output for 6 sites × 8760 h (Reykjavík 64°N, Berlin 52.5°N, Davis CA 38.5°N, Delhi 28.6°N, Nairobi −1.3°, Christchurch −43.5°) and assert max abs error < 0.001° in zenith and azimuth, < 0.5 W m⁻² in POA. Commit as fixtures.

---

## 2. Irradiance decomposition and transposition

### 2.1 When decomposition is needed at all

State this plainly in the architecture: **PVGIS TMY, PVGIS hourly (`seriescalc`), NSRDB PSM3, CAMS, and Open-Meteo all ship GHI, DNI (or BNI/DirectNormal) and DHI directly.** Decomposition is only invoked when the user supplies GHI-only data (many agricultural weather stations, some NASA POWER daily products, user CSV upload). Design the pipeline so decomposition is an *optional adapter stage*, not a mandatory step, and never re-derive DNI when the source already provides it.

### 2.2 Separation (GHI → DNI + DHI) candidates

**Erbs (Erbs, Klein & Duffie 1982, *Solar Energy* 28(4) 293–302)** – piecewise polynomial in `k_t`, no other inputs:

```
k_t = GHI / (E_0 cos θ_z)                                   clamp to [0, 1]

k_d = 1 − 0.09 k_t                                                        k_t ≤ 0.22
k_d = 0.9511 − 0.1604 k_t + 4.388 k_t² − 16.638 k_t³ + 12.336 k_t⁴        0.22 < k_t ≤ 0.80
k_d = 0.165                                                               k_t > 0.80

DHI = k_d · GHI
DNI = (GHI − DHI) / cos θ_z        (guard cos θ_z; set DNI = 0 for θ_z > 85°)
```

**DISC (Maxwell 1987, SERI/TR-215-3087)** – predicts the *direct* clearness `K_n` via a clear-sky reference and an air-mass-dependent correction:

```
K_t = GHI / (E_0 cos θ_z)
K_nc = 0.866 − 0.122 AM + 0.0121 AM² − 0.000653 AM³ + 0.000014 AM⁴
ΔK_n = a + b · exp(c · AM)
   K_t > 0.6:  a =  −5.743 + 21.77 K_t − 27.49 K_t² + 11.56 K_t³
               b =  41.40 − 118.5 K_t + 66.05 K_t² + 31.90 K_t³
               c = −47.01 + 184.2 K_t − 222.0 K_t² + 73.81 K_t³
   K_t ≤ 0.6:  a =  0.512 − 1.560 K_t + 2.286 K_t² − 2.222 K_t³
               b =  0.370 + 0.962 K_t
               c = −0.280 + 0.932 K_t − 2.048 K_t²
DNI = E_0 (K_nc − ΔK_n)
```
(Transcribe the coefficients from `pvlib.irradiance.disc`, do not retype from a paper scan.)

**DIRINT (Perez et al. 1992, *Solar Energy* 49(3) 187–200)** – DISC plus a 4-D lookup table indexed by `(K_t', z-bin, W-bin, ΔK_t'-bin)`, where `K_t'` is the air-mass-independent clearness index, `W` is precipitable water (from dew point) and `ΔK_t'` is the stability index built from the neighbouring time steps. 6×6×7×5 = 1260 coefficients.

**Engerer2 (Engerer 2015, *Solar Energy* 116, 215–237; re-parameterised globally by Bright & Engerer 2019, *J. Renew. Sustain. Energy* 11, 033701)** – logistic in a clear-sky-aware feature set:

```
K_d = C + (1 − C) / ( 1 + exp( β0 + β1 K_t + β2 AST + β3 θ_z + β4 ΔK_tc ) ) + β5 K_de

K_tc  = GHI_cs / (E_0 cos θ_z)          clear-sky clearness index (needs a clear-sky model, e.g. Ineichen-Perez or REST2)
ΔK_tc = K_tc − K_t
K_de  = max( 0 , 1 − GHI_cs / GHI )     cloud-enhancement term
AST   = apparent solar time, hours
```

1-minute coefficients (from the `splitting_models` reference implementation, which cites Engerer 2015 Eq. 33 with Bright & Engerer 2019 parameters):

| Parameterisation | C | β0 | β1 | β2 | β3 | β4 | β5 |
|---|---|---|---|---|---|---|---|
| Engerer 2015 (Australia, 1-min) | 4.2336e-2 | −3.7912 | 7.5479 | −1.0036e-2 | 3.1480e-3 | −5.3146 | 1.7073 |
| Bright & Engerer 2019 (global, 1-min) | 1.0562e-1 | −4.1332 | 8.2578 | 1.0087e-2 | 8.8801e-4 | −4.9302 | 4.4378e-1 |

Bright & Engerer 2019 additionally publish coefficient sets for 5, 10, 15, 30-min, 1-h and daily resolutions (their Table 3). **Use the hourly set for hourly TMY data; the 1-min set is not valid at 1 h.** Global re-parameterisation improved 1-min RMSE from 0.168 to 0.138 and R² from 0.80 to 0.86.

**Benchmark evidence.** Gueymard & Ruiz-Arias 2016 (*Solar Energy* 128, 1–30, "Extensive worldwide validation and climate sensitivity analysis of direct irradiance predictions from 1-min global irradiance") evaluated 140 separation models across 54 stations and found **Engerer2 and DIRINT jointly best**, with DIRINT ranking first or near-first at hourly resolution and Engerer2 strongest sub-hourly. Erbs is materially worse (typically +15–30 % relative MBE/RMSE on DNI) but requires no auxiliary data.

### 2.3 Separation recommendation

```
if source provides DNI and DHI            → use them (no separation)
else if temporal resolution ≥ 1 h         → DIRINT  (Perez 1992), pressure from site elevation,
                                             dew point if available else W = 1 cm default
else (sub-hourly, 1–30 min)               → Engerer2 with the matching Bright & Engerer 2019 coefficient set
fallback when nothing but GHI + geometry  → Erbs (ship as the always-available path; ~150 LOC total)
```

Ship **Erbs and DIRINT** in v1 (Erbs is 15 lines, DIRINT is a 1260-entry table plus DISC). Engerer2 requires a clear-sky model, so defer it to v2 alongside Ineichen-Perez with Linke turbidity.

Consistency guard after any separation: enforce `|GHI − (DNI cos θ_z + DHI)| < 5 W m⁻²`, clip `DNI ≤ E_0`, `DHI ≥ 0`, and zero everything for `α_s < 0`.

### 2.4 Transposition (horizontal → tilted plane)

Total POA is always

```
POA = POA_beam + POA_skydiffuse + POA_ground

POA_beam    = DNI · max(0, cos AOI)
POA_ground  = GHI · ρ_g · (1 − cos β)/2                     (isotropic ground reflection)
```

The models differ only in `POA_skydiffuse`.

**Isotropic (Liu & Jordan 1963):**
```
POA_d = DHI · (1 + cos β)/2
```
Systematically under-predicts on clear days by 5–10 % because it ignores circumsolar brightening; over-predicts under overcast. Adequate only as a debug baseline.

**Hay & Davies 1980:** adds a circumsolar term weighted by the anisotropy index `A_i`:
```
A_i   = DNI / E_0                     (equivalently DNI/E_a, the beam transmittance)
R_b   = max(0, cos AOI) / max(cos 85°, cos θ_z)
POA_d = DHI [ A_i R_b + (1 − A_i)(1 + cos β)/2 ]
```

**Reindl et al. 1990:** Hay-Davies plus a horizon-brightening term:
```
f     = sqrt( DNI cos θ_z / GHI )      ( = sqrt(1 − k_d) )
POA_d = DHI [ A_i R_b + (1 − A_i)(1 + cos β)/2 · (1 + f sin³(β/2)) ]
```

**Perez et al. 1990 (*Solar Energy* 44(5) 271–289, "Modeling daylight availability and irradiance components from direct and global irradiance"):** splits the sky dome into an isotropic background, a circumsolar disc, and a horizon band, with empirically fitted, sky-condition-dependent coefficients:

```
a = max(0, cos AOI)
b = max( cos 85° , cos θ_z )

sky clearness (κ = 1.041 with θ_z in radians; 5.535e-6 with θ_z in degrees):
  ε = [ (DHI + DNI)/DHI + κ θ_z³ ] / [ 1 + κ θ_z³ ]

sky brightness:
  Δ = DHI · AM_a / E_0

F₁ = max[ 0 ,  f₁₁(ε) + f₁₂(ε) Δ + (π θ_z /180°) f₁₃(ε) ]       circumsolar
F₂ =           f₂₁(ε) + f₂₂(ε) Δ + (π θ_z /180°) f₂₃(ε)         horizon-brightening

POA_d = DHI [ (1 − F₁)(1 + cos β)/2  +  F₁ (a/b)  +  F₂ sin β ]
```

**Perez 1990 coefficient table** (the "all-country / allsitescomposite1990" set, fitted on Albany NY, Geneva, Los Angeles, Albuquerque, Phoenix, Cape Canaveral, Osage, Trappes and Carpentras; 6 coefficients × 8 clearness bins = 48 parameters):

| Bin | ε range | f₁₁ | f₁₂ | f₁₃ | f₂₁ | f₂₂ | f₂₃ |
|---|---|---|---|---|---|---|---|
| 1 | 1.000 – 1.065 | −0.008 |  0.588 | −0.062 | −0.060 |  0.072 | −0.022 |
| 2 | 1.065 – 1.230 |  0.130 |  0.683 | −0.151 | −0.019 |  0.066 | −0.029 |
| 3 | 1.230 – 1.500 |  0.330 |  0.487 | −0.221 |  0.055 | −0.064 | −0.026 |
| 4 | 1.500 – 1.950 |  0.568 |  0.187 | −0.295 |  0.109 | −0.152 | −0.014 |
| 5 | 1.950 – 2.800 |  0.873 | −0.392 | −0.362 |  0.226 | −0.462 |  0.001 |
| 6 | 2.800 – 4.500 |  1.132 | −1.237 | −0.412 |  0.288 | −0.823 |  0.056 |
| 7 | 4.500 – 6.200 |  1.060 | −1.600 | −0.359 |  0.264 | −1.127 |  0.131 |
| 8 | 6.200 – ∞     |  0.678 | −0.327 | −0.250 |  0.156 | −1.377 |  0.251 |

Bin `ε = 1` exactly (`DHI = GHI`, fully overcast) falls in bin 1 and yields `F₁ ≈ 0`, degenerating gracefully to isotropic.

**Source of record for the coefficients:** Perez, Ineichen, Seals, Michalsky & Stewart (1990), Table 6; mirrored verbatim in Sandia PVPMC's modelling guide (<https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/plane-of-array-poa-irradiance/calculating-poa-irradiance/poa-sky-diffuse/perez-sky-diffuse-model/>) and in `pvlib.irradiance._get_perez_coefficients('allsitescomposite1990')`. **Copy from pvlib's source, then diff against the Sandia table.** pvlib also carries the France-1988, Phoenix-1988, Elmadina-1988, Osage-1988, Albany-1988, Albuquerque-1988, Capecanaveral-1988 and Albany-1988 regional sets if you later want site-tuned coefficients.

### 2.5 Transposition recommendation

**Use Perez 1990 (`allsitescomposite1990`) as the default; expose isotropic as a "fast/debug" toggle only.**

Justification:
1. Repeated empirical validation (Loutzenhiser et al. 2007, *Solar Energy* 81(2) 254–267, "Empirical validation of models to compute solar irradiance on inclined surfaces for building energy simulation"; Gueymard 2009; Yang 2016) puts Perez 1990 first or tied-first among the classical transposition models across tilts and climates, typically 3–5 % MBE better than isotropic and 1–2 % better than Hay-Davies at high tilt.
2. It is the model behind `gendaymtx`, hence behind the Radiance/Ladybug cumulative-sky workflow this spec adopts in §5. Using the same sky model for the PV plane and for the ground map keeps a **single source of truth** for the sky radiance distribution and makes the energy balance auditable.
3. It is the pvlib and SAM default, so validation fixtures are free.

Cost: ~40 flops per timestep. Irrelevant.

**Where Perez is applied in this tool:** not per-ground-pixel. It is applied once per TMY hour to produce (a) POA on the module plane and (b) the 577 sky-patch radiances that feed the GPU accumulation (§5). Per-pixel work is purely visibility.

### 2.6 PAR and DLI conversion

```
PPFD [µmol m⁻² s⁻¹] ≈ η_PAR · E_shortwave [W m⁻²]
```
with `η_PAR ≈ 2.02 µmol J⁻¹` for global solar radiation at the surface (Meek, Hatfield, Howell, Idso & Reginato 1984, *Agronomy Journal* 76, 939–945; McCree 1972). Use a slightly higher `η ≈ 2.1–2.2 µmol J⁻¹` for the pure-diffuse component and `≈ 2.0` for beam, since diffuse skylight is blue-shifted:

```
PPFD = 2.00 · E_beam,horiz + 2.15 · E_diffuse,horiz        (recommended two-band split)
```

```
DLI [mol m⁻² d⁻¹] = 1e−6 · Σ_over_day PPFD_i · Δt_i [s]
                  = 0.0036 · Σ_hours PPFD_h              (for Δt = 1 h, PPFD in µmol m⁻² s⁻¹)
```

Report both **annual mean DLI** and a **monthly DLI stack** per ground cell; crop suitability thresholds are seasonal (lettuce ≈ 12–17, tomato ≈ 22–30, most leafy greens tolerate ≥ 10 mol m⁻² d⁻¹). Also report **shade fraction** `1 − DLI_array / DLI_open` because agronomy literature is parameterised on relative shading.

---

## 3. Array geometry

### 3.1 Parameterisation

The canonical parametric row array. Rows are infinite in the along-axis direction for the analytic models and finite quads for the GPU model.

| Parameter | Symbol | Definition | UI range |
|---|---|---|---|
| Slant width | `W` | along-slope collector dimension (n_modules_portrait × module length, or × width for landscape) | 0.5 – 12 m |
| Pitch | `P` | centre-to-centre spacing perpendicular to row axis | 1 – 30 m |
| Ground coverage ratio | `GCR = W/P` | dimensionless | 0.05 – 0.95 |
| Tilt | `β` | 0° horizontal, 90° vertical | 0 – 90° |
| Row azimuth | `γ_c` | normal direction, N-clockwise. 180° = south-facing (N. hemi), 0° = north-facing (S. hemi), 90/270° = vertical E-W array | 0 – 360° |
| Clearance height | `h_c` | ground to **lowest** module edge (this is the agronomically meaningful one) | 0.5 – 8 m |
| Max height | `h_max = h_c + W sin β` | derived | – |
| Row length | `L_row` | finite length, drives edge effects | 5 – 200 m |
| Transmittance | `τ` | 0 = opaque; checkerboard/spaced modules 0.2–0.5; semi-transparent glass-glass 0.1–0.3 | 0 – 0.8 |
| Bifaciality | `φ_bi` | rear/front efficiency ratio | 0 – 0.95 |
| Tracking | – | fixed / single-axis N-S horizontal / single-axis tilted / 2-axis / agro-optimised | – |
| Ground albedo | `ρ_g` | see §7 | 0.05 – 0.9 |

Note the two competing GCR definitions in the literature. Use `GCR = W/P` (**collector width over pitch**, the Sandia/pvlib/NREL convention). Some agronomy papers use *projected* coverage `GCR_proj = W cos β / P`, which is what actually determines mid-day shading and is what agronomists mean by "the field is 30 % covered". **Display both** in the UI and label them; conflating them is a standing source of confusion in APV papers.

### 3.2 Shade-free spacing / backtracking criterion

For a fixed-tilt row array, the ground shadow extent measured perpendicular to the row axis is

```
d_shadow(t) = W [ cos β + sin β · σ / tan ψ ]      with tan ψ = tan α_s / |cos(γ_s − γ_c)| ,  σ = sign(cos(γ_s − γ_c))
```

Rows self-shade when `d_shadow > P`, giving the shaded fraction of the collector

```
f_row_shade = max( 0 , 1 − P / d_shadow )
```

The classic sizing rule "no self-shading between 9:00 and 15:00 on the winter solstice" fixes the minimum pitch:

```
P_min = W [ cos β + sin β / tan ψ_min ]
```
evaluated at `ψ_min` for the solstice 9:00 sun. For a single-axis tracker, backtracking rotates to `β_bt = β_true − acos( min(1, P/(W)·cos(ψ)) )` (see NREL's tracker backtracking derivation, Lorenzo, Narvarte & Muñoz 2011).

### 3.3 Agrivoltaic parameter ranges from the literature

**Elevated (overhead) APV**

- Clearance height `h_c`: **2–5 m** is the dominant band. 2.1–2.5 m is the ADEME/German DIN SPEC 91434 minimum for hand and light-machinery work; 4–5 m for combine harvesters, sprayers and orchard equipment. Commercial mounting-system ranges quoted at 1.5–5.5 m. Research plots have tested 0.6 m and 1.2 m for low crops.
- GCR: **0.25–0.50** for APV vs **0.35–0.55** slant-GCR / 0.8+ projected for conventional utility-scale ground-mount. DIN SPEC 91434 requires ≤ 15 % agricultural yield loss for "Category I" APV, which in practice caps projected coverage near 0.3.
- For combine-harvested cereals, INRAE work (Assessment of the ground coverage ratio of agrivoltaic systems as a proxy for potential crop productivity, hal-04240227) finds panel density must stay **below GCR 0.20** to avoid unacceptable yield loss; shade-tolerant crops, forage and pasture tolerate 0.30–0.45.
- Tilt: reduce below the energy-optimal `β ≈ φ · 0.85` when uniformity matters; APV designs commonly run 10–25° in mid-latitudes to lower `h_max` and shorten shadows.
- Density modulation: **checkerboard** (alternate module positions omitted, `τ_eff` 0.3–0.5 by area) and **spaced-strip** layouts trade a linear energy loss for a much more *uniform* ground DLI, which is agronomically worth more than the mean. Semi-transparent glass-glass modules with cell-gap `τ = 0.1–0.3` give the same effect with a smoother penumbra.

**Vertical bifacial east-west (Next2Sun archetype)**

- `β = 90°`, `γ_c = 90°/270°` (module plane running N-S, faces E and W).
- Row spacing **8–15 m**; Next2Sun quotes ≥ 8 m and states the vertical design occupies ≈ **5 % of the land area**, with 8–15 m crop-rotation strips preserving full machinery access.
- Ground irradiance under 8 m spacing: crops receive **≥ 75 %** of open-field irradiation; at 10 m spacing, **79.9–82.5 %** (high-latitude study, *Applied Energy* 402 (2026) 126879, "Performance evaluation of high latitude agrivoltaic systems with vertically mounted bifacial panels").
- Module bottom edge should be elevated **≥ 0.8–1.0 m**: Ground Global Reflection homogeneity is only achieved for elevation ≥ 1 m in E-W vertical farms (arXiv:1806.06666, ground sculpting for vertical bifacial).
- Distinctive DLI signature: two moving shadow bands (morning westward, afternoon eastward) and **near-zero shading at solar noon**, giving the most uniform and least midday-stressed light of any APV topology. Also a favourable generation profile (dual morning/evening peaks) for grid value.

**Rules of thumb worth encoding as UI warnings**

- `h_c / P` controls shadow *blur*: penumbra and inter-row leakage grow with clearance, so raising the array at fixed GCR improves uniformity more than it reduces mean shading.
- Shadow *dwell time* at a point scales with `W cos β / (P · rate of shadow travel)`; keeping any cell's continuous shade below ~3–4 h avoids the worst photosynthesis-induction penalties.
- N-S row orientation gives a fast-moving E-to-W shadow (good uniformity, worse winter mid-day yield); E-W rows give a stationary shadow band (bad uniformity, better winter energy). Warn on E-W tilted rows for crops.

### 3.4 Recommended defaults per latitude band

Fixed-tilt, monofacial or bifacial elevated APV, temperate row crops, |latitude| bands:

| Band | Tilt `β` | Azimuth `γ_c` | GCR `W/P` | Clearance `h_c` | Notes |
|---|---|---|---|---|---|
| 0–15° (equatorial) | 10–12° (min for self-cleaning) | equator-facing; orientation is nearly irrelevant | 0.30–0.40 | 3.0 m | Shadow is short and near-vertical at noon; heat/water stress relief often outweighs light loss. Prioritise ventilation. |
| 15–30° (subtropical) | 15–20° | equator-facing (180°/0°) | 0.30–0.40 | 3.0–3.5 m | Strong case for APV: shade reduces evapotranspiration. Consider checkerboard `τ_eff ≈ 0.4`. |
| 30–45° (mid) | 25–30° | equator-facing | 0.28–0.38 | 3.5–4.0 m | The classic APV band. N-S rows preferred for uniformity. Default `P` from `P_min` at winter-solstice 9:00. |
| 45–55° (high-mid) | 25–35° (below energy-optimum to shorten shadows) | equator-facing, or **vertical bifacial E-W** | 0.20–0.30 slant | 4.0–4.5 m | Low winter sun makes shadows very long; vertical bifacial at 8–12 m pitch is often the better answer. |
| > 55° (high) | **90° vertical bifacial E-W strongly recommended** | 90°/270° | equivalent projected coverage 0.05–0.10 | bottom edge 0.8–1.0 m, top 3.0–3.5 m | Tilted arrays need impractical pitch. Vertical E-W at ≥ 8 m spacing keeps ≥ 75 % of open-field light. |

Default row length 100 m; default `ρ_g = 0.20` (grass); default `τ = 0`.

---

## 4. Shading model

### 4.1 Direct-beam blocking at a ground point

Two implementations, both required: an **analytic 2D closed form** for parametric infinite rows (used for validation, for the fast "1D profile" chart, and for the PV-side self-shading), and a **3D visibility query** on the GPU for the actual ground raster with finite rows, posts, trees and buildings.

**Analytic, infinite parallel rows.** Work in the 2D cross-section `(u, z)`, where `u` is the horizontal coordinate perpendicular to the row axis and `z` is height. The sun in this plane has profile angle `ψ` and side `σ` (§1.5). Row `k` occupies the segment from its **leading (lower) edge** `E_L^k = (kP, h_c)` to its **trailing (upper) edge** `E_T^k = (kP + W cos β, h_c + W sin β)`.

An edge at `(u_e, z_e)` projects its shadow to the ground point

```
u_shadow(u_e, z_e) = u_e − σ · z_e / tan ψ
```

so row `k` casts the ground shadow interval

```
S_k = [ min(A_k, B_k) , max(A_k, B_k) ]
A_k = kP              − σ h_c / tan ψ
B_k = kP + W cos β    − σ (h_c + W sin β) / tan ψ
```

and the beam-visibility of ground point `u` is

```
V_beam(u) = 0   if  ∃k : u ∈ S_k
V_beam(u) = 1   otherwise
```

Because `S_k = S_0 + kP`, evaluate only `u mod P` against `S_0` shifted by `k ∈ {−1, 0, 1}` (a single row can never shade more than one full pitch of ground unless `|B−A| > P`, in which case the ground is fully shaded). The **pitch-averaged** shaded ground fraction is the closed form that must match `pvlib.bifacial.infinite_sheds`:

```
f_gnd_shaded = min( 1 , |B_0 − A_0| / P ) = min( 1 , (W/P) | cos β + σ sin β / tan ψ | )
f_gnd_beam   = 1 − f_gnd_shaded
```

Beam irradiance on the ground:

```
E_beam,gnd(u) = DNI · sin α_s · [ V_beam(u) + (1 − V_beam(u)) · τ ]
```

**3D general case (GPU).** For each ground texel centre `p` and each sun direction `s`, the beam is visible iff the ray `p + t·s, t > 0` hits nothing. Two equivalent formulations (§5): a shadow-map depth test, or an explicit ray/quad intersection. For arbitrary occluder quads with vertices `q₀,q₁,q₂,q₃`, plane normal `n`:

```
t = ( n · (q₀ − p) ) / ( n · s )         reject if n·s ≈ 0 or t ≤ 0
x = p + t s ;  reject unless x is inside the quad (2 triangle barycentric tests)
```

**Penumbra.** The sun subtends `≈ 0.53°` (9.3 mrad). A shadow edge cast from an occluder at slant distance `d` from the ground point has penumbra width `≈ 0.0093 · d` measured perpendicular to the edge. At `h_c = 4 m` and `α_s = 30°` (`d ≈ 8 m`) that is **7.5 cm**, comparable to one 12 cm raster cell. Conclusion: **penumbra is negligible for annual DLI rasters** and can be ignored, but for the interactive "instantaneous shadow" visualisation a 2–3 pixel soft-shadow filter (PCSS or a fixed 9-tap PCF sized by `0.0093 d / cell_size`) is both physically defensible and visually correct. Do not use an arbitrary blur radius.

### 4.2 Diffuse sky view factor under a row array

**Analytic 2D view factor (isotropic sky).** For a differential horizontal element in a geometry that is infinite in one direction, the view factor to a "sky band" spanning the signed angular interval `[θ₁, θ₂]` measured from the zenith in the cross-section plane is the Hottel crossed-strings differential result

```
F = ( sin θ₂ − sin θ₁ ) / 2
```

The ground point at `u` sees the sky through the gaps between consecutive row silhouettes. Its silhouette-edge angles are

```
θ(u_e, z_e) = atan2( u_e − u , z_e )
```

so, letting the visible sky gaps be the intervals `[θ_T^k, θ_L^{k+1}]` between the trailing edge of row `k` and the leading edge of row `k+1` (with the ordering depending on tilt sign, and with self-occlusion of a row's own two edges resolved by taking the outer silhouette),

```
SVF(u) = Σ_gaps  ½ [ sin θ_L^{k+1}(u) − sin θ_T^{k}(u) ]        clamped so SVF ∈ [0, 1]
```

This is exactly `pvlib.bifacial.infinite_sheds.vf_ground_sky_2d`, derived from Marion, MacAlpine, Deline et al. 2017, "A Practical Irradiance Model for Bifacial PV Modules" (*IEEE PVSC 44*, NREL/CP-5J00-67847). Validate against it.

Diffuse ground irradiance, isotropic sky:
```
E_diff,gnd(u) = DHI · SVF(u)  +  τ · DHI · (1 − SVF(u))          (τ term only for semi-transparent modules)
```

**Anisotropic sky.** The analytic SVF above is *only* correct for a uniform sky radiance. Under a Perez sky the radiance varies by more than an order of magnitude across the dome, and the circumsolar region carries a large share. Two options:

1. **Patch integration (recommended, and what §5 already builds).** Discretise the dome into `N_p` patches of solid angle `Ω_i`, centre direction `d_i` (zenith angle `θ_i`), radiance `L_i` [W m⁻² sr⁻¹]. Then
   ```
   E_diff,gnd(p) = Σ_{i=1..N_p} L_i · V_i(p) · cos θ_i · Ω_i
   ```
   where `V_i(p) ∈ [0,1]` is the fraction of patch `i` visible from `p`. Setting `L_i = DHI/π` (uniform) recovers `SVF·DHI` exactly, giving you a built-in unit test.
2. **Hemispherical Monte-Carlo sampling.** Draw `N` cosine-weighted directions `ω_j` over the upper hemisphere (`ω = (cos φ sin θ, sin φ sin θ, cos θ)` with `θ = asin(sqrt(ξ₁))`, `φ = 2π ξ₂`, giving pdf `cos θ/π`). Then
   ```
   SVF ≈ (1/N) Σ_j V(ω_j)
   E_diff,gnd ≈ (π/N) Σ_j L(ω_j) V(ω_j)
   ```
   Standard error of the SVF estimate is `sqrt( SVF(1−SVF)/N )`: `N = 256` gives ≤ 3.1 % absolute (worst case at SVF = 0.5), `N = 1024` gives ≤ 1.6 %, `N = 4096` gives ≤ 0.8 %. Use a scrambled Sobol or Hammersley sequence with a per-texel Cranley-Patterson rotation to convert the residual noise into blue-noise dither rather than blotches.

**Recommendation:** patch integration with the same 577-patch Reinhart sky used in §5. Monte-Carlo sampling is kept only as an offline cross-check for the patch discretisation error.

**Multi-bounce and albedo.** See §7; the single-bounce enclosure correction is a two-line change to the above.

### 4.3 Temporal integration

The base integration is over the 8760 hourly steps of a TMY:

```
E_annual(p) = Σ_{h=1}^{8760} [ DNI_h · sin α_{s,h} · V_beam(p, s_h) + Σ_i L_{i,h} V_i(p) cos θ_i Ω_i ] · Δt
```

Factorise, which is the whole point of the daylight-coefficient method: `V_beam` and `V_i` are **time-independent** geometry, `DNI_h` and `L_{i,h}` are **space-independent** weather. Therefore

```
E_annual(p) = Σ_{j=1}^{N_sun} Ŵ_j · V_beam(p, ŝ_j)   +   Σ_{i=1}^{N_p} Ŝ_i · V_i(p)
```
where `Ŵ_j = Σ_{h ∈ bin j} DNI_h sin α_{s,h} Δt` and `Ŝ_i = Σ_h L_{i,h} cos θ_i Ω_i Δt` are precomputed **cumulative** weights. This turns 8760 renders into `N_sun + N_p ≈ 1300` renders, independent of the number of years or the timestep of the weather file.

**Hourly vs sub-hourly.**

- *Radiometric* argument: for fixed-tilt POA energy, integrating 1-min data vs 1-h means differs by well under 2 % annually because the errors are largely symmetric; TMY files are hourly anyway, so sub-hourly weather is unavailable without synthetic downscaling.
- *Geometric* argument: this is the real issue. The hour angle advances 15° per hour. At `α_s = 30°`, a 4 m tall structure's shadow tip translates ≈ 1.5–2 m per hour. Sampling the sun once per hour therefore produces **banded, aliased annual DLI maps** with stripe artefacts at the pitch scale, and it can bias individual cells by 5–10 % even when the field mean is correct.
- *The fix costs nothing in data*: **sub-step the sun position within each hour while holding the hour's irradiance constant.** With `n_sub = 4` (15-minute geometric sampling), each hour contributes 4 sun directions each weighted `DNI_h · sin α_s · 900 s`. This is the standard treatment in Radiance's `gendaymtx -5` solar decomposition and in Ladybug's sun-path workflow, and it removes essentially all banding. `n_sub = 4` is the recommendation; `n_sub = 2` is visibly worse, `n_sub = 12` is indistinguishable from `n_sub = 4` after the 2° direction binning of §5.
- Because §5 dedupes sun directions onto a fixed grid, `n_sub = 4` costs **almost no extra render passes** (the 35 040 sub-hourly samples collapse to the same ~600–900 unique binned directions); it only changes the accumulated weights. Take it.

Practical accuracy/perf table for the annual ground map:

| Sun sampling | Unique directions after 2° binning | Extra GPU passes | Annual DLI cell error vs 1-min reference |
|---|---|---|---|
| 1 h, no sub-stepping | ~500 | – | 5–12 % local, < 1 % field mean, visible banding |
| 1 h with 15-min sun sub-steps | ~700 | +40 % | 1–3 % local, no banding |
| 1 h with 5-min sun sub-steps | ~850 | +70 % | < 1.5 % local |
| true 1-min weather (if available) | ~900 | +80 % | reference |

---

## 5. GPU implementation

### 5.1 Options considered

| Approach | Description | Verdict |
|---|---|---|
| **Per-timestep shadow mapping (naive)** | 8760 orthographic depth renders + 8760 accumulate passes | 17 520 passes. Correct but 5–15 s and wasteful; the sky is re-integrated every hour despite being the same geometry. |
| **GPU ray casting per texel per timestep** | compute shader, ray/scene intersection | Same asymptotic waste as above unless combined with direction dedup. |
| **Precomputed sun-path sampling + cumulative sky (daylight coefficients)** | Factorise geometry from weather (§4.3). Render once per *unique direction*, weight by cumulative TMY energy. | **Recommended.** This is the Radiance `gendaymtx`/`rcontrib` daylight-coefficient method and the basis of Ladybug/Honeybee annual radiation and of Pollination's `sky-irradiance` recipe. |
| **Spherical-harmonic / ambient-occlusion approximations** | project sky into SH9/SH16 | Too smooth. SH9 cannot represent the sharp inter-row sky gaps that dominate APV ground light. Reject. |

### 5.2 Sky discretisation

Use the **Tregenza/Reinhart** subdivision, the same one Radiance and Ladybug use, so results are directly comparable to the daylighting literature:

- **Tregenza (MF:1): 145 sky patches** + 1 ground patch. Bands at 12° altitude increments with 30, 30, 24, 24, 18, 12, 6, 1 patches. Angular resolution ≈ 12°.
- **Reinhart MF:2: 577 patches** (each Tregenza patch split 2×2 except the zenith cap, which is split into 4). Angular resolution ≈ 6°.
- MF:4 = 2305 patches, overkill here.

**Recommendation: MF:2 (577 patches) for the final bake, MF:1 (145) for the live preview.** The 6° resolution is comfortably below the angular scale of the inter-row sky gaps for GCR ≤ 0.6 at any realistic clearance.

Patch radiances come from the Perez 1990 all-weather sky luminance/radiance distribution (Perez, Seals & Michalsky 1993, *Solar Energy* 50(3) 235–245), evaluated per TMY hour and accumulated:

```
Ŝ_i = Σ_h  L_i(h) · cos θ_i · Ω_i · Δt        [Wh m⁻² per unit visibility]
```
This is exactly what `gendaymtx -m 2 -O1 -A` produces (`-A` = cumulative). Cross-validate the JS implementation against `gendaymtx` output for a known EPW.

**Critical: do not bin the direct sun into sky patches.** The beam carries 55–80 % of annual energy and the solar disc is 0.53° wide; smearing it into a 6° patch destroys shadow definition. Radiance's 5-phase method separates the solar contribution for exactly this reason. Handle the sun as its own direction set.

### 5.3 Sun direction set

```
for each TMY hour h with α_s > 0:
    for k in 0..n_sub-1:                                # n_sub = 4 (15-min geometric sub-steps)
        s = SPA( t_h + k·Δt/n_sub )
        key = quantise(s) on a 2°×2° (azimuth, altitude) grid
        sunWeight[key] += DNI_h · Δt/n_sub
        sunDir[key]    ← incremental mean of s (keeps the direction unbiased within the bin)
```

For a mid-latitude site this yields **600–900 unique daylight directions**. 2° binning displaces a shadow tip by at most `d · 0.035 m/m`, i.e. ≈ 28 cm at `d = 8 m`, but the *error is averaged over the bin* and the residual bias is < 1 % of annual beam. 1° binning (~1800 directions) is available as a "high quality" toggle.

### 5.4 Recommended algorithm

**Hybrid, chosen by scene type and API availability.**

**Path A: analytic ray casting (WebGPU compute) when the scene is parametric rows.**
The occluder set is a small number of oriented rectangles on a regular lattice. A compute shader with one invocation per ground texel loops over `N_dir` directions; for each, it transforms the ray into row-local coordinates and does the closed-form modulo test of §4.1, plus explicit tests against the finite row ends, posts and any user-placed obstacles. Roughly 30–60 flops per (texel, direction).

```
512×512 texels × 1300 directions × 45 flops ≈ 1.5×10^10 flops
```
At an effective 500 GFLOP/s on integrated graphics (M-series, Iris Xe) that is **~30 ms**; on a discrete GPU, ~5 ms. Memory traffic is trivial (one RG32F accumulation texture, 2 MB).

**Path B: shadow-map accumulation (WebGL2 fallback, and for arbitrary imported geometry).**
For each direction: render scene depth from that direction into a 1024² orthographic depth texture covering the site AABB, then run a full-screen pass over the 512² ground raster that projects each texel into the light's clip space, does a 4-tap PCF depth comparison, and adds `weight · comparison` into a float accumulation FBO (`EXT_color_buffer_float` / `EXT_float_blend`, or manual ping-pong if additive float blending is unavailable).

Per-pass cost on a mid-range 2023 laptop iGPU: depth render of ~5 000 triangles at 1024² ≈ 0.12 ms; accumulate pass at 512² ≈ 0.06 ms. **≈ 0.2 ms per direction.**

```
1300 directions × 0.2 ms ≈ 260 ms total GPU time
```

**Frame budgeting.** Never submit 1300 passes in one frame. Chunk the work:

```
budget      = 8 ms of GPU work per frame          (leaves 8 ms for the 60 fps scene render)
passes/frame= floor(8 ms / 0.2 ms) = 40
frames      = ceil(1300 / 40) = 33  ≈ 0.55 s wall clock
```

Drive this from a `requestAnimationFrame` scheduler with an adaptive `passes/frame` tuned by a rolling EMA of measured frame time (use `EXT_disjoint_timer_query_webgl2` where available, else `performance.now()` deltas). Show a progressive result: the accumulation texture is *already* a valid unbiased estimate after any prefix of the directions, provided you draw directions in a **stratified shuffled order** (e.g. sort by weight descending, then interleave) and normalise by the accumulated weight so far. The user sees a correct-looking map in ~80 ms that refines to final in ~600 ms.

**Recommended concrete configuration**

| Item | Value |
|---|---|
| Ground raster | 512 × 512 over the site bounding box, clamped so cell size ∈ [5 cm, 50 cm]; 1024² for sites > 100 m |
| Accumulation format | `RGBA32F` (R = beam Wh, G = diffuse Wh, B = beam PAR, A = diffuse PAR), or two `RG32F` targets |
| Sky patches | 577 (Reinhart MF:2) final, 145 (Tregenza) preview |
| Sun directions | 600–900 (2° binning, 15-min sub-steps), 1800 at high quality |
| Total passes | ≈ 1 200–1 500 final, ≈ 250 preview |
| Shadow map | 1024², orthographic, fitted per-direction to the scene AABB, 32-bit depth, 4-tap rotated PCF |
| Depth bias | slope-scaled, `constant = 2`, `slope = 2.5`; plus render **front faces only** for the depth pass with a small normal offset on the receiver |
| Target wall clock | < 700 ms final bake, < 120 ms preview, UI never below 50 fps |
| Interactive mode | single sun direction, 1 shadow map/frame, trivially 60 fps; use for the time-of-day scrubber |

**Numerical precision.** 1300 additions of values around 1e2–1e3 Wh into float32 (24-bit mantissa) accumulate a relative error ~1e-5. Fine. Do *not* accumulate in float16.

**Readback.** For the DLI statistics, crop-suitability zoning and CSV export, read back the accumulation texture once with `readPixels` into a `Float32Array` (1 MB for 512²) or, in WebGPU, `copyTextureToBuffer` + `mapAsync`. Do the histogram, per-zone means and monthly stacks on the CPU or in a second compute pass; do not read back per frame.

**Monthly / seasonal outputs.** Run 12 accumulation targets (one per month) rather than 12 separate bakes: the direction set is shared, only the weights differ. Cost is 12 extra `add` operations per pass, i.e. one wider accumulate shader writing to a texture array. This is the single highest-value extra feature for agronomy and it is nearly free.

---

## 6. Weather data

### 6.1 Source comparison

| Source | Spatial coverage | Spatial res. | Temporal | Key variables | Auth / rate limit | CORS (browser-direct?) | Licence |
|---|---|---|---|---|---|---|---|
| **PVGIS 5.3** (EC JRC) <br> `https://re.jrc.ec.europa.eu/api/v5_3/{tmy,seriescalc,PVcalc,MRcalc,DRcalc,printhorizon}` | SARAH-3: Europe, Africa, W+S Asia, parts of S. America (Meteosat disk). PVGIS-ERA5: **global**. NSRDB: Americas. | SARAH-3 0.05° (~5 km); ERA5 0.28° | Hourly 2005–2023; **TMY** generator; monthly; also returns a horizon profile | GHI, DNI (Gb(n)), DHI, GTI, T2m, WS10m, RH, pressure, plus full PV yield | No key. **30 calls/s per IP**, HTTP 429 above | **No.** "Access to PVGIS APIs via AJAX is not allowed, and requests to change the CORS policy will be rejected." Must proxy. | EC reuse / CC-BY 4.0 with attribution |
| **NASA POWER** <br> `https://power.larc.nasa.gov/api/temporal/{hourly,daily,monthly}/point` | **Global**, poles included | 0.5° × 0.625° (MERRA-2 meteo); solar from CERES/SYN1deg regridded, effectively ~0.5–1° | Hourly 2001–NRT; daily 1981–NRT | `ALLSKY_SFC_SW_DWN` (GHI), `ALLSKY_SFC_SW_DNI`, `ALLSKY_SFC_SW_DIFF`, `CLRSKY_*`, `T2M`, `RH2M`, `WS2M`, `PS`, `ALLSKY_SRF_ALB`, `PRECTOTCORR` | No key. **No published hard rate limit**; NASA monitors and throttles abusive use. Max **20 parameters per point request**, 1 parameter per regional request | **Yes** in practice (`Access-Control-Allow-Origin: *`) | US Government public domain, free, attribution requested |
| **NSRDB / GOES PSM v4** <br> `https://developer.nlr.gov/api/nsrdb/v2/solar/nsrdb-GOES-tmy-v4-0-0-download.csv` (`developer.nrel.gov` was retired 29 May 2026; PSM v3.2.2 was replaced by GOES v4.0.0) | Americas: **175° W – 25° W, 20° S – 60° N**, plus separate international products (Himawari, MSG) | 0.038° ≈ **4 km** | **30-min** and 60-min, 1998–2023 | GHI, DNI, DHI, clearsky variants, `Temperature`, `Dew Point`, `Surface Albedo`, `Precipitable Water`, `Wind Speed`, `Pressure`, `Cloud Type`, `Solar Zenith Angle` | **Free API key required.** Rate-limited per key (default order ~1 000 requests/hour; download endpoints have low concurrency limits and can return 429) | Technically reachable, but the key would be exposed client-side. **Proxy.** | Public / freely available; cite Sengupta et al. 2018, *Renew. Sustain. Energy Rev.* 89, 51–60 |
| **Open-Meteo** <br> `https://archive-api.open-meteo.com/v1/archive`, `https://api.open-meteo.com/v1/forecast` | **Global** | ERA5 0.25° (from 1940), **ERA5-Land 0.1°** (from 1950); forecast models 1–11 km; separate **Satellite Radiation API** (Meteosat/GOES/Himawari, ~5 km, 15-min) | Hourly archive 1940–present (5-day lag); 15-min for forecast and satellite products | `shortwave_radiation` (GHI), `direct_radiation`, `diffuse_radiation`, `direct_normal_irradiance`, `global_tilted_irradiance`, `terrestrial_radiation`, `temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`, `precipitation`, `soil_temperature/moisture` | **No key.** Free for non-commercial use, soft limits ~10 000 calls/day, 5 000/hour, 600/min. Paid tier and self-hosting (AGPLv3 server, AWS Open Data mirror) remove limits | **Yes**, explicitly CORS-enabled, designed for browser use | **CC-BY 4.0** on the data, attribution required |
| **Copernicus CAMS Radiation Service** (via SoDa / ADS) <br> `https://api.soda-solardata.com/service/wps` | Meteosat field of view: **−66° to +66° lat/lon** (Europe, Africa, Middle East, Atlantic) | ~3–5 km effective | **1-min to monthly**, 2004–present | GHI, BHI, DHI, BNI + matching clear-sky (McClear) | Free registration; SOAP/WPS or CSV endpoints, modest quota (~40–100 calls/day free tier) | No | Copernicus licence, free with attribution |
| **Meteonorm** | Global (interpolated from ~8 300 stations + 5 satellites) | station-interpolated | TMY, hourly, 1-min synthetic | full meteorological set, bankable | Commercial licence, desktop/API | No | Proprietary |
| **SolarGIS** | Global 60°N–50°S high-res, extended coverage beyond | 250 m – 1 km | 10–15 min, 1994/1999–present | GHI, DNI, DIF, GTI, PVOUT, soiling, T, WS | Commercial, paid API | Yes (paid) | Proprietary, bankable (P50/P90) |

### 6.2 Recommended chain

Quality ranking on irradiance accuracy, best first, within their domains: **NSRDB PSM3 (Americas) ≳ SolarGIS/Meteonorm (commercial) ≳ PVGIS-SARAH-3 (Meteosat domain) ≈ CAMS ≳ Open-Meteo satellite radiation ≳ Open-Meteo/PVGIS ERA5 (reanalysis) ≳ NASA POWER.** Satellite-derived products beat reanalysis by roughly a factor of two in hourly GHI RMSE; ERA5 in particular has a known positive GHI bias in cloudy maritime climates and misses aerosol events.

**Deployment-pragmatic chain for a no-backend-required browser tool:**

```
1. PRIMARY   Open-Meteo Archive (ERA5-Land 0.1° where available, else ERA5 0.25°)
             + Open-Meteo Satellite Radiation API where the geostationary coverage exists.
             Reason: only source that is global, keyless, CORS-enabled, CC-BY, and returns
             GHI + DNI + DHI + temperature + wind in one request. Zero infrastructure.

2. UPGRADE   If a lightweight serverless proxy is deployed (a ~40-line Cloudflare Worker /
             Vercel edge function with a 24 h cache keyed on rounded lat/lon):
               a. NSRDB PSM3     for 20°S–60°N, 175°W–25°W  (best available, 4 km, 30-min)
               b. PVGIS TMY      elsewhere inside the SARAH-3 domain (Europe/Africa/W-Asia)
               c. PVGIS ERA5 TMY for the remaining global land
             The proxy also holds the NREL API key server-side, which is required anyway.

3. FALLBACK  NASA POWER (global, keyless, CORS-enabled) when Open-Meteo is unreachable or
             the location is outside every other domain (high latitudes, remote ocean-adjacent).

4. OFFLINE   Bundle 8–12 representative TMY files (one per Köppen-ish climate zone, ~180 kB
             each gzipped as Float32 GHI/DNI/DHI/T/WS) so the tool works with no network at
             all and demo/first-paint is instant.

5. OVERRIDE  Accept user-uploaded EPW / TMY3 / PVGIS CSV / plain CSV. Parse client-side.
             Route through the §2.3 separation adapter if DNI/DHI are absent.
```

**Caching and consent.** Cache by `round(lat,2), round(lon,2)` in IndexedDB with a 90-day TTL; a TMY does not change. Show the data provenance (source, dataset, grid cell, years) in the UI next to every result. Reproduce the required attribution strings for Open-Meteo (CC-BY 4.0), PVGIS (EC JRC) and NSRDB.

**Elevation and horizon.** Get terrain elevation from Open-Meteo's `/v1/elevation` (Copernicus DEM 90 m, keyless, CORS) for the barometric pressure used by air mass and by DIRINT. For a far-horizon profile, PVGIS `printhorizon` returns one but is CORS-blocked; behind the proxy it is worth having, since a 10° south horizon can cost 15 % of winter DLI.

---

## 7. Bifacial gain and albedo effects on ground light

### 7.1 Albedo values to ship as presets

| Surface | `ρ_g` |
|---|---|
| Fresh snow | 0.75–0.90 |
| Old / melting snow | 0.45–0.70 |
| White gravel or white geotextile | 0.55–0.75 |
| Dry sand | 0.30–0.40 |
| Dry bare soil | 0.20–0.30 |
| Wet bare soil | 0.08–0.14 |
| Green grass / pasture (default) | 0.18–0.25 |
| Dense green crop canopy | 0.15–0.22 |
| Concrete (aged) | 0.20–0.30 |
| Asphalt | 0.08–0.12 |
| Water (high sun) | 0.05–0.10 |

NSRDB PSM3 provides a time-varying `Surface Albedo` channel and NASA POWER provides `ALLSKY_SRF_ALB`; prefer the measured series over a constant when available, especially for snow-affected sites where winter bifacial gain roughly doubles.

**What shipped, and why it is not the measured series.** The presets are in `src/types/ground.ts`,
offered to the grower as a ground cover rather than as a number, and the values sit inside the
bands above. The time-varying part is *derived*, not read: only one of the four weather upstreams
carries an albedo channel at all, so reading it would have given a seasonal ground to some sites
and an annual one to others, from the same screen, with nothing on it to say which. Instead the
seasonal term comes from `src/sim/snow.ts`, a weighting between the chosen cover and settled snow
off the site's own monthly temperature and precipitation normals, which every site has. It is the
same function the renderer uses to draw the winter ground, deliberately: a second snow model would
let the picture and the number disagree about whether there is snow on the ground. Measured at
Amherst on the shipped default array it is worth **+2.5%** of the modelled year over grass, rising
to **+3.0%** over bare soil and falling to **+1.1%** over pale gravel, since snow whitens a dark
cover further than a bright one.

### 7.2 Bifacial gain

```
BG = ( Y_bifacial − Y_monofacial ) / Y_monofacial
```

Typical annual values: **5–10 %** over grass (`ρ_g ≈ 0.2`) at conventional GCR; **10–20 %** at APV-typical low GCR (0.25–0.35) with high clearance, because both the rear view factor to the ground and the unshaded ground fraction are large; **20–35 %** over high-albedo surfaces or snow; **25–40 %** for vertical E-W bifacial, where both faces are near-optimally illuminated at different times of day.

Rear-side POA in the infinite-shed formulation (Marion et al. 2017; `pvlib.bifacial.infinite_sheds`):

```
POA_rear = Σ_over_ground_strips  ρ_g · E_gnd(u) · F_{module←strip}(u)
         + DHI · SVF_rear
         + DNI · max(0, cos AOI_rear)                          (rare; low sun behind the array)
P_rear_effective = φ_bi · POA_rear                             φ_bi ≈ 0.65–0.90 for modern n-type
```

The ground-to-module view-factor kernel `F_{module←strip}` uses the same crossed-strings 2D formulation as §4.2; this is the reciprocal of the ground SVF calculation, so **implement one routine and reuse it**, which is the single-source-of-truth win here.

### 7.3 Effect on the ground light distribution

Three distinct effects, in decreasing order of importance for the crop:

1. **Indirect: bifaciality buys pitch.** A bifacial array at GCR 0.30 delivers roughly the same annual yield per unit *module area* as a monofacial array at GCR 0.38–0.42. Designers can therefore widen the pitch (or raise `τ`) at constant energy, which directly raises and homogenises ground DLI. This is quantitatively the largest crop-relevant effect of bifaciality and should be surfaced in the UI as an explicit "bifacial lets you widen pitch by X %" affordance.
2. **Inter-reflection between ground and module undersides.** Light reflected off the ground that hits the module rear is partly reflected back down. Treat the ground/array as a two-surface enclosure and apply the closed-form multiple-reflection correction per ground point:
   ```
   E_gnd_total(p) = [ E_beam(p) + SVF(p)·E_sky_diffuse ] / ( 1 − ρ_g · (1 − SVF(p)) · ρ_m )
   ```
   with `ρ_m` the module underside reflectance: **0.04–0.08** for glass-glass bifacial (mostly Fresnel), **0.6–0.8** for a white backsheet, **0.75–0.9** for a deliberately white-painted torque tube / underside. Over grass (`ρ_g = 0.2`) with glass-glass rear, the correction is under 1 % and is safely ignorable. With a white backsheet and `ρ_g = 0.25`, it adds **3–8 %** to the shaded-zone diffuse light, which is exactly where the crop is light-limited, so it is worth implementing (it is one divide). Higher-order terms are already summed by the geometric series; no iteration needed.
3. **Spatial redistribution / uniformity.** Higher albedo raises the diffuse floor everywhere but raises it *most* in the deep-shade strip, because that is where `1 − SVF` is largest. Net effect: albedo increases the **minimum** ground DLI more than the mean, i.e. it improves the uniformity index `DLI_min/DLI_mean`. Under a vertical E-W bifacial array with elevation ≥ 1 m, ground global reflection becomes spatially homogeneous (arXiv:1806.06666), which is the most crop-favourable configuration in the design space.

**What bifaciality does NOT do:** a bifacial module is still opaque, so bifaciality alone transmits no extra light to the crop. Any claim of "bifacial panels let more light through" in the UI copy would be wrong; the mechanism is entirely (1) above. Semi-transparent or spaced/checkerboard modules are the mechanism that actually transmits light, via the `τ` term in §4.

### 7.4 Ground-surface modelling in the renderer

Model the ground as Lambertian with albedo `ρ_g`; specular soil/water is not worth the complexity. For the **visual** render, drive the ground BRDF albedo from the same `ρ_g` used in the physics so the picture and the numbers cannot diverge. For crop canopies, note that `ρ_g` should be the *canopy* albedo once the crop is established, and expose a growth-stage slider if seasonal fidelity is wanted (bare soil in spring at 0.25, closed canopy in summer at 0.18).

---

## 8. Validation plan

| Check | Oracle | Tolerance |
|---|---|---|
| Solar position, 6 sites × 8760 h | `pvlib.solarposition.spa_python` | max |Δzenith|, |Δazimuth| < 0.001° |
| Erbs / DISC / DIRINT | `pvlib.irradiance.erbs / disc / dirint` | max ΔDNI < 0.5 W m⁻² |
| Perez transposition | `pvlib.irradiance.perez` (`allsitescomposite1990`) | max ΔPOA < 0.5 W m⁻² |
| Ground SVF, infinite rows | `pvlib.bifacial.infinite_sheds.vf_ground_sky_2d` | max ΔSVF < 0.002 |
| Pitch-averaged shaded ground fraction | closed form of §4.1 vs GPU raster mean | < 0.5 % |
| Uniform-sky patch integration | `Σ L_i V_i cos θ_i Ω_i` with `L_i = DHI/π` vs analytic `SVF·DHI` | < 0.5 % |
| Cumulative sky patch radiances | Radiance `gendaymtx -m 2 -A` on the same EPW | < 2 % per patch |
| Annual ground DLI map | Radiance `rcontrib` / Ladybug annual radiation on the same geometry | < 5 % per cell, < 2 % field mean |
| Energy conservation | `Σ(ground absorbed) + Σ(module intercepted) + Σ(reflected out) = Σ(incident)` | < 1 % |

---

## 9. Reference list

- Reda, I. & Andreas, A. (2004/2008). *Solar Position Algorithm for Solar Radiation Applications.* NREL/TP-560-34302 rev. Jan 2008. Uncertainty ±0.0003°.
- Michalsky, J. J. (1988). The Astronomical Almanac's algorithm for approximate solar position (1950–2050). *Solar Energy* 40(5), 227–235.
- Blanco-Muriel, M. et al. (2001). Computing the solar vector. *Solar Energy* 70(5), 431–441. (PSA, ≤0.5 arcmin.)
- Grena, R. (2012). Five new algorithms for the computation of sun position from 2010 to 2110. *Solar Energy* 86, 1323–1337.
- Spencer, J. W. (1971). Fourier series representation of the position of the sun. *Search* 2(5), 172.
- Kasten, F. & Young, A. T. (1989). Revised optical air mass tables and approximation formula. *Applied Optics* 28(22), 4735–4738.
- Bennett, G. G. (1982). The calculation of astronomical refraction in marine navigation. *Journal of Navigation* 35, 255–259.
- Gueymard, C. A. (2018). A reevaluation of the solar constant based on a 42-year total solar irradiance time series. *Solar Energy* 168, 2–9.
- Erbs, D. G., Klein, S. A. & Duffie, J. A. (1982). Estimation of the diffuse radiation fraction for hourly, daily and monthly-average global radiation. *Solar Energy* 28(4), 293–302.
- Maxwell, E. L. (1987). *A Quasi-Physical Model for Converting Hourly Global Horizontal to Direct Normal Insolation.* SERI/TR-215-3087. (DISC.)
- Perez, R. et al. (1992). Dynamic global-to-direct irradiance conversion models. *ASHRAE Transactions* 98(1), 354–369. (DIRINT.)
- Engerer, N. A. (2015). Minute resolution estimates of the diffuse fraction of global irradiance for southeastern Australia. *Solar Energy* 116, 215–237.
- Bright, J. M. & Engerer, N. A. (2019). Engerer2: Global re-parameterisation, update, and validation of an irradiance separation model at different temporal resolutions. *J. Renewable and Sustainable Energy* 11, 033701.
- Gueymard, C. A. & Ruiz-Arias, J. A. (2016). Extensive worldwide validation and climate sensitivity analysis of direct irradiance predictions from 1-min global irradiance. *Solar Energy* 128, 1–30.
- Liu, B. Y. H. & Jordan, R. C. (1963). The long-term average performance of flat-plate solar energy collectors. *Solar Energy* 7, 53–74.
- Hay, J. E. & Davies, J. A. (1980). Calculation of the solar radiation incident on an inclined surface. *Proc. First Canadian Solar Radiation Data Workshop*, 59–72.
- Reindl, D. T., Beckman, W. A. & Duffie, J. A. (1990). Evaluation of hourly tilted surface radiation models. *Solar Energy* 45(1), 9–17.
- **Perez, R., Ineichen, P., Seals, R., Michalsky, J. & Stewart, R. (1990). Modeling daylight availability and irradiance components from direct and global irradiance. *Solar Energy* 44(5), 271–289.** (Transposition coefficients, Table 6.)
- Perez, R., Seals, R. & Michalsky, J. (1993). All-weather model for sky luminance distribution: preliminary configuration and validation. *Solar Energy* 50(3), 235–245.
- Loutzenhiser, P. G. et al. (2007). Empirical validation of models to compute solar irradiance on inclined surfaces for building energy simulation. *Solar Energy* 81(2), 254–267.
- Tregenza, P. R. (1987). Subdivision of the sky hemisphere for luminance measurements. *Lighting Research & Technology* 19(1), 13–14.
- Reinhart, C. F. & Walkenhorst, O. (2001). Validation of dynamic RADIANCE-based daylight simulations for a test office with external blinds. *Energy and Buildings* 33(7), 683–697.
- Ward, G. et al. *Radiance* `gendaymtx`, `genskyvec`, `rcontrib` manual pages. <https://www.radiance-online.org/learning/documentation/manual-pages/pdfs/gendaymtx.pdf>
- Marion, B., MacAlpine, S., Deline, C. et al. (2017). A practical irradiance model for bifacial PV modules. *IEEE PVSC 44*, NREL/CP-5J00-67847.
- Sengupta, M. et al. (2018). The National Solar Radiation Data Base (NSRDB). *Renewable and Sustainable Energy Reviews* 89, 51–60.
- Meek, D. W., Hatfield, J. L., Howell, T. A., Idso, S. B. & Reginato, R. J. (1984). A generalized relationship between photosynthetically active radiation and solar radiation. *Agronomy Journal* 76, 939–945.
- McCree, K. J. (1972). Test of current definitions of photosynthetically active radiation against leaf photosynthesis data. *Agricultural Meteorology* 10, 443–453.
- DIN SPEC 91434:2021-05, *Agri-photovoltaic systems: requirements for primary agricultural use.*
- INRAE (2023). Assessment of the ground coverage ratio of agrivoltaic systems as a proxy for potential crop productivity. hal-04240227.
- Arena, R. et al. (2024). Optimal photovoltaic array layout of agrivoltaic systems based on vertical bifacial photovoltaic modules. *Solar RRL*, 10.1002/solr.202300505.
- *Performance evaluation of high latitude agrivoltaic systems with vertically mounted bifacial panels.* (2026). *Applied Energy* 402.
- Patel, M. T. et al. (2018). Ground sculpting to enhance vertical bifacial solar farm output. arXiv:1806.06666.
- Sandia PVPMC Modeling Guide (Perez sky diffuse, SPA, POA). <https://pvpmc.sandia.gov/modeling-guide/>
- pvlib-python documentation, `irradiance`, `solarposition`, `bifacial.infinite_sheds`. <https://pvlib-python.readthedocs.io/>
- PVGIS 5.3 non-interactive API. <https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/getting-started-pvgis/api-non-interactive-service_en>
- NASA POWER API documentation. <https://power.larc.nasa.gov/docs/services/api/>
- NSRDB Data Downloads API (GOES PSM v4.0.0). <https://developer.nlr.gov/docs/solar/nsrdb/>. Sengupta et al. 2018 describes the NSRDB and PSM through v3, not v4.
- Open-Meteo Historical Weather API and Satellite Radiation API. <https://open-meteo.com/en/docs/historical-weather-api>, <https://open-meteo.com/en/docs/satellite-radiation-api>
