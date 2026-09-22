import { lazy, Suspense, useEffect, useMemo, useState, type ReactElement } from 'react'
import { browserCapabilities, preflight } from './ui/preflight'
import { lightIsStale } from './state/light-freshness'
import { overlayField, overlayOffOnSeasons } from './state/overlay'
import { rainFieldOf } from './state/rain'
import { overlaySlice, scenePlot, useAppStore } from './state/store'
import { DliLegend } from './ui/DliLegend'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { SceneCompass } from './ui/SceneCompass'
import { SceneHint } from './ui/SceneHint'
import { SceneTooltip } from './ui/SceneTooltip'
import { ColdOpen } from './ui/ColdOpen'
import { ExampleBanner } from './ui/ExampleBanner'
import { PrintPlan } from './ui/PrintPlan'
import { MobileTabs } from './ui/MobileTabs'
import { GardenPlanStrip, Sidebar } from './ui/Sidebar'
import { Action } from './ui/controls'
import { useAutoLight } from './ui/useAutoLight'
import { useAutoRecommend } from './ui/useAutoRecommend'
import type { EditorMode } from './state/slices'

/**
 * Everything three.js, loaded after the shell has painted.
 *
 * This one import is the whole of the change: `scene/SceneCanvas.tsx` is the only module outside
 * `src/scene/` that reaches the 3D stack, so making it dynamic takes three, react-three-fiber and
 * drei out of the first chunk entirely. The fallback is the canvas host's own sky gradient, which
 * is CSS and already there, so the wait reads as a scene about to arrive
 */
const SceneCanvas = lazy(() => import('./scene/SceneCanvas'))

/**
 * The agent, in the builds that carry it, and genuinely absent from the ones that do not.
 *
 * `__AGENT_ENABLED__` and not the `AGENT_ENABLED` export that wraps it, which is the difference
 * between this working and merely looking like it works. A const re-exported from another module
 * does not propagate across the module boundary during minification, so the first two attempts at
 * this both shipped a 23 kB `AgentPanel` chunk into a build with the agent switched off: correct,
 * unreachable, and downloaded by nobody for no reason. The raw define is substituted HERE, so the
 * ternary is `false ? ... : null` before anything has to reason about it, and the dynamic import
 * is never emitted. `src/agent/flag-fold.test.ts` is what holds it.
 *
 * `lazy` on top of that means even an enabled build does not pay for it until the tab is pressed
 */
const AgentPanel = __AGENT_ENABLED__
  ? lazy(async () => ({ default: (await import('./ui/AgentPanel')).AgentPanel }))
  : null

/**
 * Select looks around and picks; Move drags beds, panel rows and plot corners with the camera
 * held still. Move is its own mode so a drag never grabs the camera
 */
const MODES: readonly (readonly [EditorMode, string])[] = [
  ['select', 'Select'],
  ['move', 'Move'],
  ['draw-plot', 'Draw plot'],
  ['draw-bed', 'Draw bed'],
]

/**
 * The title, the drawing modes, Ask where the build has it, and the name of the place. The
 * simulation pill that used to end the row is gone: "ready" and "loading" beside a title
 * said nothing useful on a phone, and the step that is waiting now says so in its own status row. The
 * state stays on the root element for anything that has to wait on a bake from any step
 */
const Toolbar = (): ReactElement => {
  const mode = useAppStore((s) => s.mode)
  const setMode = useAppStore((s) => s.setMode)
  const locationLabel = useAppStore((s) => s.locationLabel)
  const asking = useAppStore((s) => s.surface === 'chat')
  const setSurface = useAppStore((s) => s.setSurface)
  const wide = useAppStore((s) => s.widePlan)
  const setWidePlan = useAppStore((s) => s.setWidePlan)
  return (
    <header className="toolbar" data-testid="panel-toolbar">
      <h1>Agrivoltaic garden designer</h1>
      <div className="toolbar-modes">
        {MODES.map(([value, label]) => (
          <Action
            key={value}
            testId={`action-toolbar-mode-${value}`}
            tone={mode === value ? 'primary' : 'ghost'}
            pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {label}
          </Action>
        ))}
        {/*
          The way in on a laptop, where there is no tab bar to be a destination in.

          It was reachable below 900px and nowhere else, and the reason on record was that above
          the breakpoint the garden and the editor both fit so there is no turn-taking for it to
          join. That is an argument about navigation and not about capability: it explains why a
          third tab makes no sense in a tab bar that does not exist, and says nothing about
          whether somebody on a laptop should be able to ask a question in their own words.

          Pressing it puts the conversation in the editor's column; pressing it again gives the
          column back, with every answer where the conversation put it
        */}
        {__AGENT_ENABLED__ ? (
          <Action
            testId="action-toolbar-ask"
            tone={asking ? 'primary' : 'ghost'}
            pressed={asking}
            onClick={() => setSurface(asking ? 'edit' : 'chat')}
          >
            Ask
          </Action>
        ) : null}
      </div>
      {/* the plan column across the window, for the calendar and the seasons; the garden comes
          back with the same press. Only above the phone breakpoint, where the two share a screen */}
      <Action
        testId="action-toolbar-wide"
        tone={wide ? 'primary' : 'ghost'}
        pressed={wide}
        onClick={() => setWidePlan(!wide)}
      >
        {wide ? 'Show the garden' : 'Wide plan'}
      </Action>
      <span className="toolbar-site" data-testid="readout-toolbar-site">
        {locationLabel}
      </span>
    </header>
  )
}

/**
 * The ground is coloured from the very first bake, and nothing on the canvas said what the
 * colours meant until this existed: the legend that explains it rendered only inside the
 * overlay panel, the eighth of nine down a scrolling sidebar, so a visitor reading top to
 * bottom never reached it. It is pinned here instead, over the surface it explains, and gated
 * on exactly the condition `DliOverlay` itself uses to decide whether to paint the ground, so
 * it can never be showing for a surface that is not there or missing for one that is
 */
const CanvasLegend = (): ReactElement | null => {
  const overlay = useAppStore((s) => s.overlay)
  const slice = useAppStore(overlaySlice)
  const overlayPlayback = useAppStore((s) => s.overlayPlayback)
  const raster = useAppStore((s) => (s.raster.status === 'ready' ? s.raster.value : null))
  // a previewed scenario's geometry is on screen with no light field baked for it yet, and
  // `DliOverlay` already refuses to paint the ground in that state
  const previewing = useAppStore((s) => s.previewPlot !== null)
  // and the seasons step stops the overlay being drawn at all, which the key was the last to
  // hear about: a persona read this caption over flat green ground for a whole visit
  const offOnSeasons = useAppStore(overlayOffOnSeasons)
  // the colours below are an answer about a garden, so they have to say when they stopped
  // being an answer about THIS one
  const stale = useAppStore(lightIsStale)
  const plot = useAppStore(scenePlot)
  const weather = useAppStore((s) => (s.weather.status === 'ready' ? s.weather.value : null))
  // the rain field is only worth computing when its own channel is on screen: every other
  // channel's legend would otherwise compute it on every edit of the plot, for nobody to see
  const rain = useMemo(
    () => (overlay.channel === 'rain' ? rainFieldOf(plot, weather) : null),
    [overlay.channel, plot, weather],
  )
  const field = useMemo(
    () => overlayField(raster, overlay.channel, slice, overlayPlayback, rain),
    [raster, overlay.channel, slice, overlayPlayback, rain],
  )
  if (!overlay.visible || previewing || offOnSeasons || !field.values) return null
  return (
    <DliLegend
      testId="readout-overlay-legend"
      label={field.label}
      unit={field.unit}
      min={field.min}
      max={field.max}
      stale={stale}
    />
  )
}

/**
 * The scene, or the one sentence that says why there is none. Asked once, before the 3D chunk is
 * fetched: a browser without WebGL2 used to download three.js and then show a stack trace in the
 * canvas boundary, and one without WebAssembly showed a stack trace in every panel instead
 */
const CheckedScene = (): ReactElement => {
  const [flight] = useState(() => preflight(browserCapabilities()))
  if (!flight.scene) {
    return (
      <div className="preflight-block">
        <p className="notice notice-error" data-testid="status-preflight" data-scene="none">
          {flight.note}
        </p>
      </div>
    )
  }
  return (
    <>
      <ErrorBoundary label="3D canvas" testId="panel-canvas-failed">
        {/* null, not a spinner: `.canvas-host` already paints the sky gradient the scene
            arrives over, so the wait looks like a scene loading */}
        <Suspense fallback={null}>
          <SceneCanvas />
        </Suspense>
      </ErrorBoundary>
      {flight.note === null ? null : (
        <p
          className="notice notice-warn preflight-note"
          data-testid="status-preflight"
          data-scene="slow-light"
        >
          {flight.note}
        </p>
      )}
    </>
  )
}

// the canvas lives outside the sidebar, so switching tabs never remounts the GL context
const App = (): ReactElement => {
  useAutoRecommend()
  useAutoLight()
  const loadExample = useAppStore((s) => s.loadExample)
  const carrying = useAppStore((s) => s.carrying)
  const carry = useAppStore((s) => s.carry)
  const mode = useAppStore((s) => s.mode)
  const hovered = useAppStore((s) => s.hovered)
  /**
   * Which surface is showing, as one attribute the stylesheet can read.
   *
   * It governs every width now. Below the breakpoint the garden,
   * the editor and the conversation take turns on the whole screen; above it the garden and the
   * editor share it, and `chat` is what puts the conversation in the editor's column instead
   */
  const chosen = useAppStore((s) => s.surface)
  const wide = useAppStore((s) => s.widePlan)
  // the bake's state, for whatever waits on a light run from a step that is not the light step
  const simState = useAppStore((s) => s.raster.status)
  // one attempt, on mount. `loadExample` refuses a second one and refuses any browser that
  // already holds a design, so the visitor's own work is never overwritten by the example
  useEffect(() => {
    void loadExample()
  }, [loadExample])

  /**
   * A crop let go anywhere that is not a bed is a crop put back down.
   *
   * Ordering is what makes this safe: r3f listens on the canvas element, so a
   * release over a bed reaches that mesh's handler first and it clears `carrying` itself on the
   * way to staging the drop. This listener is on `window`, one bubble later, and by then there is
   * nothing left for it to cancel
   */
  useEffect(() => {
    if (carrying === null) return
    const putDown = (): void => carry(null)
    window.addEventListener('pointerup', putDown)
    return () => window.removeEventListener('pointerup', putDown)
  }, [carrying, carry])
  return (
    <div
      className={carrying === null ? 'app' : 'app carrying'}
      data-testid="app-root"
      data-carrying={carrying ?? undefined}
      data-surface={chosen}
      data-sim-state={simState}
      data-wide={wide ? 'true' : undefined}
    >
      <Toolbar />
      <main className="stage">
        {/*
          The mode and whether anything is under the pointer, on the element the cursor is read
          off. The 3D cannot set a cursor for what it is hovering without a React render per
          pointer move, and a design tool whose canvas says `cursor: auto` over every object it
          will happily select is a design tool that looks like a picture
        */}
        <div
          className="canvas-host"
          data-testid="canvas-root"
          data-mode={mode}
          data-hovering={hovered === null ? undefined : 'true'}
        >
          <CheckedScene />
          <GardenPlanStrip />
          <SceneTooltip />
          <SceneHint />
          <SceneCompass />
          <ExampleBanner />
          <CanvasLegend />
          {/* the banner says whose garden this is and the legend says what the colours are;
              neither says why a strip of ground reading half what another does matters, which
              is the argument the whole product rests on. Said once, over the example only */}
          <ColdOpen />
        </div>
        <Sidebar />
        {/*
          Sharing the sidebar's grid cell, and shown only on the surface that asked for it. It is
          mounted alongside the editor, outside it, because it is a way IN to the design and
          not a panel of it: leaving the conversation has to leave every answer where it was put
        */}
        {AgentPanel === null ? null : (
          <ErrorBoundary label="Ask" testId="panel-agent-failed">
            <Suspense fallback={null}>
              <AgentPanel />
            </Suspense>
          </ErrorBoundary>
        )}
      </main>
      {/*
        Below the breakpoint the garden and the editor stop sharing the screen and take turns on
        it, and this is the turn-taking. Hidden by CSS at every width where they both fit, which
        is also what keeps it out of a desktop reader's way
      */}
      <MobileTabs />
      {/* the design as one sheet: on screen it is nothing, under the print dialog it is the page */}
      <PrintPlan />
    </div>
  )
}

export default App
