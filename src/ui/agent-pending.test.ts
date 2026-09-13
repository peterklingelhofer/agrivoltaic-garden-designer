import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'bun:test'
import { Glob } from 'bun'

/**
 * That the agent still knows which question it is waiting on.
 *
 * A source scan, in the shape of `src/agent/flag-fold.test.ts`, and for the same reason: the bug
 * it guards against reads like an improvement. `AgentPanel` used to take the pending question
 * behind a guard on the guided dock being open, which was exactly wrong because the surface was
 * shown only when the dock was closed. The result was a router that never once learned which
 * question was on screen, in the single surface that ships it, and a dead end on the first
 * exchange. The dock is gone; the cursor stays, and so does the guard against gating it.
 *
 * Nothing about the types catches it and nothing about the rendering looks wrong. What catches it
 * is a measurement -- bare conversational replies routed 62% without the step and 85% with it --
 * and a measurement is not something a future edit re-runs by accident
 */
const sources: Record<string, string> = {}
for (const path of new Glob('AgentPanel.tsx').scanSync(import.meta.dir)) {
  sources[`./${path}`] = readFileSync(`${import.meta.dir}/${path}`, 'utf8')
}
const source = sources['./AgentPanel.tsx']

describe('the agent knows what it just asked', () => {
  it('finds the panel', () => {
    expect(source).toBeTypeOf('string')
  })

  it('reads the pending question without gating it on the wizard being open', () => {
    const code = (source ?? '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
      .join('\n')
    expect(code).toContain('s.onboarding.step')
    expect(code).not.toMatch(/\?[^\n]*onboarding\.step\s*:\s*null/)
  })

  /**
   * A question that started a ranking is answered when the ranking lands. `sets` keeps the last
   * ranking while the next one runs, so a transition read off its status never fires for a
   * re-rank; the `ranking` flag is what says one finished
   */
  it('answers a waiting question on the ranking flag, not on the sets status', () => {
    const code = (source ?? '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
      .join('\n')
    expect(code).toContain('previous.ranking && !state.ranking')
    expect(code).not.toMatch(
      /previous\.sets\.status !== 'ready' && state\.sets\.status === 'ready'/,
    )
  })
})
