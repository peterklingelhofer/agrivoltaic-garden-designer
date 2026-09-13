import { SEASON_FIX, type SeasonFix, seasonBlocker } from '../state/simulation'
import type { AppState } from '../state/slices'

/**
 * The one press that settles what is missing. `null` where the fix is a gesture on the canvas
 * rather than a button: drawing a bed is a drag with a mouse, and a button claiming to do it
 * would be lying about what happens next
 */
export interface Remedy {
  readonly label: string
  /** Shown in place of the label while the work it starts is already running */
  readonly busyLabel?: string
  readonly disabled?: boolean
  run(): void
}

/**
 * Something a surface needs before it can say anything true, in the words of whoever needs it.
 *
 * This shape was hand-built four times before it was named: `HandoffCard`, `rankingBlocker` with
 * its `BLOCKED_BY` table, `MissingRaster`, and the polyculture gate, which got as far as the
 * sentence and never grew the button. Each of them says the same three things, and each of them
 * had to be read to find out whether it said all three: what is missing, why this panel cares,
 * and the press that fixes it.
 *
 * `reason` is deliberately not a restatement of an async status. "idle" is a fact about a slice;
 * "the weather for this place has not been looked up yet" is a fact about the garden, and only
 * the second one tells a visitor what they are waiting for
 */
export interface Requirement {
  readonly met: boolean
  readonly reason: string
  readonly remedy: Remedy | null
}

/**
 * The FIRST unmet requirement, never all of them.
 *
 * A panel that listed every missing prerequisite at once produced "Waiting on a resolved site, a
 * bed and a measure of the light in it", which names three things, offers three different fixes
 * and can therefore carry none of them. The chain is ordered, so the first gap is the only one a
 * visitor can act on: the others are not yet reachable, and saying so is noise
 */
export const firstUnmet = (requirements: readonly Requirement[]): Requirement | null =>
  requirements.find((requirement) => !requirement.met) ?? null

export const allMet = (requirements: readonly Requirement[]): boolean =>
  firstUnmet(requirements) === null

/**
 * Everything any requirement here reads, flattened to one string.
 *
 * Every builder below returns a FRESH object, which makes all of them unusable as a store
 * selector: zustand compares what a selector returned with what it returned last time, two
 * different objects are never equal, and the component re-renders forever. Subscribe to this
 * instead and then build from a plain `getState`, which is a read rather than a subscription.
 * Cheap on purpose: a handful of statuses and lengths, so it changes when a lock can change and
 * at no other time
 */
export const requirementKey = (s: AppState): string =>
  [
    s.site.status,
    s.plot?.beds.length ?? 0,
    s.bedLight.length,
    s.raster.status,
    s.sets.status,
    s.calendars.status,
    s.ranking,
  ].join('|')

/** The place has been looked up: its weather, its soil and its frost dates */
export const siteRequirement = (s: AppState): Requirement => ({
  met: s.site.status === 'ready',
  reason:
    s.site.status === 'error'
      ? `This place couldn't be looked up: ${s.site.message}`
      : "The weather, soil and frost dates for this place haven't been looked up yet",
  remedy: {
    label: s.site.status === 'error' ? 'Try again' : 'Look up this place',
    busyLabel: 'Looking it up...',
    disabled: s.site.status === 'loading',
    run: () => void s.resolveSite(s.location, s.locationLabel),
  },
})

/** Somewhere to plant. Drawn on the canvas, so there is no button that can do it */
export const bedsRequirement = (s: AppState): Requirement => ({
  met: (s.plot?.beds.length ?? 0) > 0,
  reason: 'No bed yet. Everything below is worked out for a bed, so draw one with Draw bed',
  remedy: null,
})

/**
 * How much light reaches each bed. `bedLight` and not a ready raster, because those are two ways
 * to have the same answer: a guided layout carries its own preview field across without ever
 * baking the editor's raster, and testing the raster told a grower looking at a fully planted
 * garden that it was still waiting on a simulation
 */
export const lightRequirement = (s: AppState): Requirement => ({
  met: s.bedLight.length > 0,
  reason: "How much light reaches each bed hasn't been worked out yet",
  remedy: {
    label: 'Work out the light',
    busyLabel: 'Working it out...',
    disabled: s.raster.status === 'loading',
    // the full check, the same one `useAutoLight` runs by itself: the quick one hands back a
    // different crop list, and a press here is what a grower reaches for when the automatic run
    // failed or was switched off
    run: () => void s.runFinal(),
  },
})

/**
 * Everything a ranking reads, in order. One list, so the auto-run's decision to hold off and the
 * panel's sentence about why cannot disagree: they were separate before, and the button that
 * ran the ranking checked neither, which is how "Rank crops" came to report success over an
 * empty result whenever no light had been worked out yet
 */
export const rankingChain = (s: AppState): readonly Requirement[] => [
  siteRequirement(s),
  bedsRequirement(s),
  lightRequirement(s),
]

/**
 * A season of the simulation, and the press that unblocks it.
 *
 * The REASON is the season's own, from `state/simulation.ts`, because the store refuses a run on
 * that sentence and the panel must not offer a second version of it. The REMEDY is borrowed from
 * whichever step above already owns the fix, so "work it out again" here and "work out the light"
 * on the light step are one press with one label.
 *
 * The one a grower actually meets is stale light: the first three lock the step before the panel
 * is ever mounted, and before this the stale case was a sentence with a dead button beside it,
 * which is a dead end in the middle of the loop the mode exists for
 */
export const seasonRequirement = (s: AppState): Requirement => {
  const reason = seasonBlocker(s)
  if (reason === null) return { met: true, reason: '', remedy: null }
  const fix: SeasonFix = SEASON_FIX[reason] ?? 'wait'
  const borrowed =
    fix === 'place' ? siteRequirement(s) : fix === 'light' ? lightRequirement(s) : null
  return { met: false, reason, remedy: borrowed?.remedy ?? null }
}

/** Crops ranked against that light. The gate on planting, and on every suggestion built from it */
export const rankingRequirement = (s: AppState): Requirement => ({
  met: s.sets.status === 'ready' && s.calendars.status === 'ready',
  reason: "The crops haven't been ranked for these beds yet",
  remedy: {
    label: 'Rank the crops',
    busyLabel: 'Ranking...',
    disabled: s.sets.status === 'loading' || s.ranking,
    run: () => void s.recommend(),
  },
})
