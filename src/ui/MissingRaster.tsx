import type { ReactElement } from 'react'
import { useAppStore } from '../state/store'
import { lightRequirement, requirementKey } from './requirement'
import { RequirementNotice } from './RequirementNotice'

/**
 * What a surface says when the light has not been worked out, and the press that works it out.
 *
 * There were three of these, worded three ways, and not one of them could be acted on where it
 * was read: the overlay said "No raster yet, the overlay appears after a simulation run",
 * compliance said "Run the light simulation to evaluate compliance", and the simulation itself
 * said a third thing. All three describe the same missing resource and all three leave the
 * visitor to work out that the fix lives in a panel further down the same column.
 *
 * Now a thin wrapper over `RequirementNotice`, which is that idea generalised: this file is kept
 * because two panels ask for exactly the light and it is worth naming, but the sentence, the
 * button and the busy state are the shared ones. `SimPanel` is deliberately not a caller: it is
 * the panel the bake belongs to and it already carries the run controls, so a second button
 * there would be the same press twice
 */
export const MISSING_RASTER =
  "How much light reaches the ground hasn't been worked out yet, and everything on this panel is read off it"

export const MissingRaster = ({ testId }: { readonly testId: string }): ReactElement | null => {
  // subscribed to the key, built from a read: a builder returns a fresh object every call and
  // so can never be a selector, which is a re-render loop rather than a wrong answer
  useAppStore(requirementKey)
  const requirement = lightRequirement(useAppStore.getState())
  return (
    <RequirementNotice
      requirement={{ ...requirement, met: false, reason: MISSING_RASTER }}
      testId={testId}
    />
  )
}
