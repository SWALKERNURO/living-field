# Living Field

Living Field is an experimental visualization instrument for exploring relationships among continuous EEG dynamics, experimental events, and first-person reports.

It is a standalone project with its own identity and research boundary. It is not a Flux EEG version or workflow mode.

![Living Field Atlas](living-field-desktop.png)

## The central idea

The interface keeps three forms of evidence visibly separate:

1. **Measured field** — a time-linked state-space view of aperiodic exponent and alpha organization.
2. **Reported experience** — sparse, timestamped first-person descriptions with context and confidence.
3. **Hypothesis to test** — provisional questions about how changes in the measured field relate to events and reports.

This separation is essential. Living Field does not claim that 1/f activity, aperiodic activity, or any other EEG measurement is consciousness. It provides a disciplined environment for asking whether measurable patterns and reported experiences vary together.

## Current prototype

The working interface includes:

- An animated EEG state-space field with a continuous trajectory
- Aperiodic exponent and alpha-organization axes
- Selectable first-person report markers
- Experimental event markers
- Timeline playback and scrubbing
- A moment-by-moment evidence inspector
- A comparison mode for examining repeated reports
- Visible reliability and analysis-window context
- Responsive desktop and mobile layouts
- Explicit interpretive and scientific boundary language

The included recording is realistic demonstration data. Recording parsing and the full analysis pipeline are intentionally left for the next implementation layer.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

To create a production build and run the packaging checks:

```bash
npm run build
npm run test:sites
```

## Technology

- React
- Vite
- HTML Canvas for the state-space visualization
- Phosphor Icons
- Local Inter and Manrope font packages

## Research boundary

Living Field is a hypothesis explorer, not a diagnostic system or consciousness detector. Its visualizations are intended to generate testable questions without collapsing neural measurement, lived experience, and philosophical interpretation into the same category.

