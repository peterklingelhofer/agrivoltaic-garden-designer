import { existsSync } from 'node:fs'

/**
 * Whether the sentence-embedding weights are on disk, in one place.
 *
 * The same `existsSync` on the same path was written out in three test files, and the
 * duplication was not the problem with it. The problem was what it was used for: each of those
 * files skipped its embedding half when the answer was false, silently, and CI had no `models/`:
 * the directory is gitignored and `.github/workflows/ci.yml` did not fetch it then. So the
 * router that the whole feature rests on was tested on a developer's laptop and nowhere else,
 * and eight tests reported themselves as skipped in a run nobody reads. The workflow fetches them
 * now, against a cache, which is what made the skip a failure instead.
 *
 * Hence `MODEL_REQUIRED`. Locally, absent weights still skip, because a fresh clone should be
 * able to run the suite without a 58 MB download it did not ask for. In CI the same absence is a
 * hard failure, asserted by `model-presence.test.ts`, because there the weights are fetched on
 * purpose and their absence means the fetch broke rather than that somebody is working offline.
 *
 * Node-only, and imported by tests alone; `boundary.test.ts` holds that. Nothing the browser
 * loads may reach this file, because `node:fs` does not exist there
 */
export const MODEL_DIR = 'models'

export const MODEL_FILE = `${MODEL_DIR}/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx`

export const HAVE_MODEL = existsSync(MODEL_FILE)

/**
 * Opt-in by its own variable, and deliberately NOT inferred from `CI`.
 *
 * It read `Boolean(process.env.CI)` for about an hour, and that was a bug waiting on a second CI.
 * There is one: Cloudflare Workers Builds deploys this repo on every push to `main`, it runs `bun run test` as part of its build command, and it sets `CI` the
 * way every builder does.
 *
 * This said Workers Builds "has no `models/`" until 2026-09-09. It has them: `build:deploy` runs
 * `fetch-agent-model` before the suite, and that script writes to `models/` at the repo root,
 * which is the path `HAVE_MODEL` reads. Whether the claim was ever true is not checkable from
 * here. Both builders fetch the weights today,
 * so the case that motivated this variable does not bite either of them.
 *
 * The rule stays regardless, and not out of caution. "This builder fetches the weights" is still
 * not derivable from "this is a builder", and the next one to set `CI` without fetching would
 * fail on a file nobody asked it for. Only the workflow that actually fetches them sets this
 */
export const MODEL_REQUIRED = process.env.REQUIRE_AGENT_MODEL === '1'
