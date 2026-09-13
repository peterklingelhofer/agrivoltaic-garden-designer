import { act } from 'react'
import { beforeEach, describe, expect, it } from 'bun:test'
import { getAppState, resetAppStore } from '../state/store'
import { GroundPanel } from './BedPanel'
import { mount } from './testkit'

/**
 * A failed or empty soil lookup used to hand back the assumed loam under a 'user' source, and
 * the bed panel hid the source line for 'user', so an assumption read as the gardener's own
 * soil test. The line now says what an assumed value is and hides only for a typed one
 */
beforeEach(() => {
  localStorage.clear()
  resetAppStore()
})

describe("where a bed's soil pH came from", () => {
  it('says an assumed default is assumed, names the map, and says nothing for a typed value', async () => {
    const harness = await mount(<GroundPanel />)
    const bed = getAppState().plot?.beds[0]
    if (bed === undefined) throw new Error('no bed to test against')
    await act(async () => {
      getAppState().selectBed(bed.id)
    })
    expect(harness.get('readout-bed-ph-source').textContent).toBe(
      'Assumed pH 6.5 loam: the soil map has no answer for this place yet. Change it if you know your soil.',
    )
    await act(async () => {
      getAppState().upsertBed({
        ...bed,
        soil: { ...bed.soil, phUnits: 7.2, sourceId: 'soilgrids' },
      })
    })
    expect(harness.get('readout-bed-ph-source').textContent).toMatch(/From the soil map/)
    await act(async () => {
      getAppState().upsertBed({ ...bed, soil: { ...bed.soil, phUnits: 5.8, sourceId: 'user' } })
    })
    expect(harness.find('readout-bed-ph-source')).toBeNull()
    await harness.unmount()
  })
})
