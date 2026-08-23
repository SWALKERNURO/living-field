# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable product decisions

- Living Field is a standalone experimental instrument. Do not present it as a Flux EEG version, mode, or workflow step, and do not use Flux branding in this project.
- The interface must keep three evidentiary layers distinct: measured EEG field, first-person report, and hypothesis to test.
- Never claim that aperiodic activity or 1/f activity is consciousness. The product explores relations without asserting identity or causation.
- The primary visualization is a time-linked state-space atlas of aperiodic exponent and alpha organization, rendered as a quantitative canvas visualization.
- The selected source image is `source-living-field-atlas.png`; preserve its compact dark scientific aesthetic, cyan-violet field, gold report markers, lime events, and right-side evidence inspector.
- The Windows desktop build uses Electron, the private `living-field://app` origin, sandboxing, context isolation, and a standalone Living Field application identity.
- The default Overview must explain the result in plain language before exposing technical values; dense evidence views remain available as separate navigation destinations.
