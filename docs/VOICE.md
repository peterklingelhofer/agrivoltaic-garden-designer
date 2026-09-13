# Voice: how the app's text is written

Decided 2026-09-04 after reading the app: "all of the text seems like it was written
in riddles". Every user-facing sentence follows this sheet: panels, guided setup, step titles,
tooltips, coach lines, refusal reasons and the Why? disclosures. Citations and source names stay
verbatim. Where an older document describes a different voice (the grade 4-5 rewrite of the
seasons step in `CONVERGENCE.md` 7), this sheet wins.

## Rules

1. **Say what the thing is.** A heading names its content. A label names the quantity. A button
   names the action. "Results so far" for the results, "Build cost" for the cost, "Run a season"
   for the button.
2. **Literal words.** No metaphors, images or personification. A rotation rule refuses a planting;
   the ground says nothing. A harvest is a random draw within a published range.
3. **Nobody speaks in the first person.** There's no "we", no "this game", no "the line we drew".
   Say what set a number and where: "a 50% floor this app sets", "a threshold from Decision
   Record 6".
4. **Real terms, glossed once per panel.** "Land equivalent ratio (LER): the land a separate solar
   farm plus a separate garden would need to match this plot." After the gloss, the term alone.
   A reader can search a term.
5. **Number first, source after.** "LER 1.64 (Dupraz et al. 2011)". Citations are verbatim.
6. **One idea per sentence, under twenty words.** Questions belong in headings that ask the reader
   something ("What do you want in this bed?") and nowhere else.
7. **State uncertainty once.** "An estimate from a benchmark for 500 kW systems; a small array
   costs more per watt." One sentence, then move on.
8. **Consistent nouns.** Array, panel, plot, bed, planting, season (one growing year), yield.
   "Full yield" is the unshaded reference. Pests.
9. **Outcomes and refusals share one shape.** "Tomato, Bed 2: harvested, 81% of full yield. Pests
   took 5%." "Tomato, Bed 2: not planted. Rotation: Solanaceae grew here 1 season ago; 3 needed."
10. **"About" marks a rounded figure**, and money is always rounded to two significant figures.
11. **Contractions in prose.** "Doesn't", "isn't", "you'll". Labels and readouts stay as they are.
12. **Keep what tests pin.** Test ids never change for wording. `vocabulary.test.tsx` requires a
    term and its gloss on screen together; `no-paths-in-prose.test.ts` forbids file paths in
    prose; `point-estimate.test.ts` forbids calling a band a point. Read them first.

## Tells to remove (slopdetector.tech, and one more)

The first: **"X, not Y"** and "not X but Y" contrasts ("Estimate, not a quote", "a hint,
not proof", "Simulated result, not evidence"). Say the positive thing: "An estimate from a
benchmark for 500 kW systems." "Treat a difference as a lead to check." "This app draws the
outcome from its own rules."

Then the site's written-evidence list, each of which reads as generated text:

- "It's not X. It's Y." reframes
- Punch sentences ("Done." "Gone.") and three clipped sentences in a row
- A demonstrative payoff glued to a paragraph ("That's the flywheel.")
- Transition adverbs: moreover, furthermore, additionally
- AI vocabulary: seamless, leverage, unlock, empower, delve, elevate, streamline, robust
- Hedging filler: "it's worth noting", "X is crucial", "it's important to"
- Catch-all sweeps: "whether you're X or Y", "from A to B"
- Triads for their own sake ("fast, reliable, and secure")
- Throat-clearing openers and summary wrap-ups ("In today's...", "In conclusion", "Ultimately")
- Announced sincerity ("honestly", "to be clear") and empty intensifiers (truly, genuinely, very)
- Uncontracted stiffness ("it is", "do not", "you will") in running prose
- Hollow superlatives (revolutionary, world-class, AI-powered)
- Sparkle emoji, and emoji as icons or bullets

And the UI tells from its guide, for anyone touching layout: feature-tile grids, pill tags,
announcement pills, eyebrow labels, gradient washes, indigo and violet accents, neon glow,
glassmorphism, default Inter/Geist/shadcn looks, coloured card borders, decorative 01/02/03
numbering on content that isn't a sequence, stock CTA pairs, "Built with ❤️" footers.

## Before and after, from the seasons step

| Before | After |
|---|---|
| Where the garden stands | Results so far |
| 1 of 5 seasons run. Run 5 before judging a garden: one year is never the verdict. | 1 of 5 seasons run. Results are read after 5 seasons. |
| One field doing the work of (land equivalent ratio, Dupraz et al. 2011): 1.64 fields | Land equivalent ratio (LER): 1.64. The land a separate solar farm plus a separate garden would need to match this plot (Dupraz et al. 2011). |
| The beds stayed above 50%, the line we drew for this game, so the panels shared the ground. | Yield stayed above the 50% floor this app sets, so the panels share the ground. |
| Old sayings this garden is testing | Companion-planting claims under trial |
| harvested, 67% of a full crop; bugs ate about 5% | harvested, 67% of full yield. Pests took about 5%. |
| Landed at 62% of a full crop, a roll of the dice inside what scientists measured for 12% shade | 62% of full yield: a random draw within the published range for 12% shade |
| The ground said no | Not planted |
| Died or never ripened | Lost to frost, shade or a short season |
| What a year of that electricity is worth | Electricity value, one year |
| Years of that electricity to pay the panels back | Simple payback |
| Jobs the plants you chose ask of you | Management tasks |
| This is a best guess and not a price for your garden. It comes from a US government report about solar farms far bigger than anything in a back yard, so what a few panels really cost you could be quite different. | An estimate from NREL's 2020 benchmark for 500 kW crop-mounted systems. A small array costs more per watt. |
| A simulated hypothesis: this garden's answer is made up by the game, and it can be true here and false in a real garden. | This app draws the outcome from its own rules, and a real garden can differ. |
| So a difference here is a hint, not proof. | Treat a difference as a lead to check. |
| What scientists know unlocks after 3 seasons. | The published evidence is shown after 3 seasons. |
