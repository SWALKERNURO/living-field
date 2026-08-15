import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ChartScatter,
  CirclesThreePlus,
  ClockCounterClockwise,
  Compass,
  DownloadSimple,
  Eye,
  FileArrowUp,
  FloppyDisk,
  FolderOpen,
  Info,
  Pause,
  Play,
  Pulse,
  SlidersHorizontal,
  Sparkle,
  SquaresFour,
} from "@phosphor-icons/react";

const DURATION = 3751;

const REPORTS = [
  {
    id: "clarity",
    label: "clarity",
    time: 497,
    x: -1.35,
    y: 0.92,
    accent: "#f5cf68",
    report: "Experience felt unusually clear and open.",
    context: "resting attention",
    confidence: 4,
  },
  {
    id: "effort",
    label: "effort",
    time: 903,
    x: -0.48,
    y: -0.04,
    accent: "#f5cf68",
    report: "Maintaining the task felt effortful.",
    context: "task onset",
    confidence: 3,
  },
  {
    id: "self-boundary",
    label: "self-boundary",
    time: 1302,
    x: -0.12,
    y: 0.78,
    accent: "#f5cf68",
    report: "The boundary of self felt less fixed.",
    context: "open monitoring",
    confidence: 4,
  },
  {
    id: "clarity-return",
    label: "clarity",
    time: 2098,
    x: 0.77,
    y: 0.26,
    accent: "#f5cf68",
    report: "Clarity returned, but with a different felt quality.",
    context: "task recovery",
    confidence: 4,
  },
  {
    id: "self-boundary-return",
    label: "self-boundary",
    time: 3431,
    x: 0.86,
    y: -0.66,
    accent: "#f5cf68",
    report: "Self-boundary felt pronounced again.",
    context: "late recording",
    confidence: 3,
  },
];

const EVENTS = [
  { label: "task begins", time: 870 },
  { label: "prompt", time: 1940 },
  { label: "task ends", time: 2775 },
];

const NAV_ITEMS = [
  { label: "Field atlas", icon: ChartScatter },
  { label: "Reports", icon: CirclesThreePlus },
  { label: "Comparisons", icon: SquaresFour },
  { label: "Methods", icon: SlidersHorizontal },
  { label: "Boundary", icon: Compass },
];

function formatTime(value) {
  const seconds = Math.max(0, Math.round(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function gaussian(random) {
  const u = Math.max(random(), 0.0001);
  const v = Math.max(random(), 0.0001);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function trajectoryAt(t) {
  return {
    x: -1.7 + 3.45 * t + 0.24 * Math.sin(t * Math.PI * 5.2),
    y: 0.82 - 1.42 * t + 0.48 * Math.sin(t * Math.PI * 4.1 + 0.2),
  };
}

function FieldCanvas({ progress, selectedId, comparing }) {
  const canvasRef = useRef(null);
  const particles = useMemo(() => {
    const random = seededRandom(1948);
    return Array.from({ length: 2600 }, () => {
      const t = random();
      const base = trajectoryAt(t);
      const spread = 0.09 + 0.22 * Math.sin(Math.PI * t);
      return {
        t,
        x: base.x + gaussian(random) * spread,
        y: base.y + gaussian(random) * (spread * 0.72),
        alpha: 0.16 + random() * 0.62,
        size: 0.45 + random() * 1.35,
        phase: random() * Math.PI * 2,
      };
    });
  }, []);

  const draw = useCallback(
    (timestamp = 0) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const margins = { left: 62, right: 28, top: 26, bottom: 54 };
      const plotW = width - margins.left - margins.right;
      const plotH = height - margins.top - margins.bottom;
      const mapX = (x) => margins.left + ((x + 2.05) / 4.1) * plotW;
      const mapY = (y) => margins.top + ((1.55 - y) / 3.1) * plotH;

      ctx.save();
      ctx.strokeStyle = "rgba(141, 162, 192, .12)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i += 1) {
        const x = margins.left + (plotW * i) / 4;
        ctx.beginPath();
        ctx.moveTo(x, margins.top);
        ctx.lineTo(x, margins.top + plotH);
        ctx.stroke();
      }
      for (let i = 0; i <= 3; i += 1) {
        const y = margins.top + (plotH * i) / 3;
        ctx.beginPath();
        ctx.moveTo(margins.left, y);
        ctx.lineTo(margins.left + plotW, y);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "lighter";
      particles.forEach((particle) => {
        const isPast = particle.t <= progress;
        const pulse = 0.78 + Math.sin(timestamp * 0.0012 + particle.phase) * 0.22;
        const r = Math.round(91 + particle.t * 67);
        const g = Math.round(226 - particle.t * 132);
        const b = Math.round(235 + particle.t * 16);
        ctx.fillStyle = `rgba(${r},${g},${b},${particle.alpha * pulse * (isPast ? 0.82 : 0.28)})`;
        ctx.beginPath();
        ctx.arc(mapX(particle.x), mapY(particle.y), particle.size * (isPast ? 1.08 : 0.82), 0, Math.PI * 2);
        ctx.fill();
      });

      const drawPath = (end, color, widthValue, alpha) => {
        ctx.beginPath();
        for (let i = 0; i <= 180 * end; i += 1) {
          const t = i / 180;
          const point = trajectoryAt(t);
          if (i === 0) ctx.moveTo(mapX(point.x), mapY(point.y));
          else ctx.lineTo(mapX(point.x), mapY(point.y));
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = widthValue;
        ctx.lineCap = "round";
        ctx.stroke();
      };

      drawPath(1, "#8491ad", 1.2, 0.25);
      drawPath(progress, "#bafc98", 2.2, 0.92);
      ctx.globalAlpha = 1;

      EVENTS.forEach((event) => {
        const point = trajectoryAt(event.time / DURATION);
        const x = mapX(point.x);
        const y = mapY(point.y);
        const radius = 7 + Math.sin(timestamp * 0.002 + event.time) * 2;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
        glow.addColorStop(0, "rgba(183,248,141,.85)");
        glow.addColorStop(1, "rgba(183,248,141,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#b7f88d";
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });

      REPORTS.forEach((report) => {
        const x = mapX(report.x);
        const y = mapY(report.y);
        const selected = report.id === selectedId;
        if (selected || (comparing && report.label === "clarity")) {
          ctx.strokeStyle = "rgba(245,207,104,.38)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, selected ? 14 : 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = report.accent;
        ctx.beginPath();
        ctx.arc(x, y, selected ? 5.2 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalCompositeOperation = "source-over";
      ctx.font = "500 10px Inter, sans-serif";
      ctx.letterSpacing = ".08em";
      ctx.fillStyle = "rgba(187,199,221,.62)";
      ctx.textAlign = "center";
      ctx.fillText("STEEPER", margins.left + 10, height - 19);
      ctx.fillText("FLATTER", margins.left + plotW - 8, height - 19);
      ctx.fillStyle = "rgba(224,232,245,.78)";
      ctx.fillText("APERIODIC EXPONENT", margins.left + plotW / 2, height - 19);

      ctx.save();
      ctx.translate(17, margins.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("ALPHA ORGANIZATION", 0, 0);
      ctx.restore();
      ctx.restore();
    },
    [comparing, particles, progress, selectedId],
  );

  useEffect(() => {
    let frame;
    let observer;
    const animate = (timestamp) => {
      draw(timestamp);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    if (canvasRef.current) {
      observer = new ResizeObserver(() => draw(performance.now()));
      observer.observe(canvasRef.current);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [draw]);

  return <canvas ref={canvasRef} className="field-canvas" aria-label="EEG state-space field over time" />;
}

function ConfidenceDots({ value }) {
  return (
    <span className="confidence-dots" aria-label={`${value} of 5 confidence`}>
      {[1, 2, 3, 4, 5].map((dot) => (
        <span key={dot} className={dot <= value ? "filled" : ""} />
      ))}
    </span>
  );
}

export function App() {
  const [selectedId, setSelectedId] = useState("self-boundary");
  const [currentTime, setCurrentTime] = useState(1302);
  const [playing, setPlaying] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [activeNav, setActiveNav] = useState("Field atlas");
  const fileInputRef = useRef(null);

  const selected = REPORTS.find((report) => report.id === selectedId) || REPORTS[2];
  const progress = currentTime / DURATION;

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setCurrentTime((time) => {
        if (time >= DURATION) {
          setPlaying(false);
          return 0;
        }
        return Math.min(DURATION, time + 9);
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [playing]);

  const selectReport = (report) => {
    setSelectedId(report.id);
    setCurrentTime(report.time);
  };

  const resetDemo = () => {
    setSelectedId("self-boundary");
    setCurrentTime(1302);
    setPlaying(false);
    setComparing(false);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkle weight="fill" /></div>
          <div>
            <strong>Living Field</strong>
            <span>signal · report · relation</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Living Field sections">
          <div className="nav-label">Explore</div>
          {NAV_ITEMS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className={activeNav === label ? "nav-item active" : "nav-item"}
              onClick={() => setActiveNav(label)}
              title={label === "Field atlas" ? "Return to the live atlas" : `${label} is represented in this prototype`}
            >
              <Icon weight={activeNav === label ? "fill" : "regular"} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-study">
          <span>Current study</span>
          <strong>Demo session 01</strong>
          <small>O1 + O2 · 250 Hz</small>
          <div className="study-quality"><i /> Signal ready</div>
        </div>

        <div className="project-actions">
          <button type="button" onClick={() => fileInputRef.current?.click()}><FileArrowUp /> Import recording</button>
          <button type="button" onClick={resetDemo}><ArrowCounterClockwise /> Load demo</button>
          <button type="button" onClick={() => window.alert("Prototype snapshot saved locally.")}><FloppyDisk /> Save snapshot</button>
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.edf" hidden onChange={() => window.alert("Recording selected. Data parsing belongs to the next implementation layer.")} />
        </div>

        <div className="sidebar-boundary">
          <Info weight="fill" />
          <span>This is a hypothesis explorer, not a consciousness detector.</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow"><span /> Experimental instrument</div>
            <h1>The Living Field Atlas</h1>
            <p>The background moves. Experience is reported. Their relation remains a question.</p>
          </div>
          <div className="topbar-actions">
            <span className="mode-badge"><Eye /> Hypothesis explorer</span>
            <button className="icon-button" type="button" title="Export current view" onClick={() => window.print()}><DownloadSimple /></button>
          </div>
        </header>

        <section className="atlas-panel" aria-label="Living Field Atlas">
          <div className="atlas-title-row">
            <div>
              <span className="section-kicker">Measured field</span>
              <h2>Aperiodic background × alpha organization</h2>
            </div>
            <div className="legend" aria-label="Legend">
              <span><i className="legend-path" /> Signal trajectory</span>
              <span><i className="legend-report" /> First-person report</span>
              <span><i className="legend-event" /> Task event</span>
            </div>
          </div>

          <div className="field-stage">
            <FieldCanvas progress={progress} selectedId={selectedId} comparing={comparing} />
            <div className="field-readout field-readout-left">
              <span>more periodic</span>
              <strong>organized rhythm</strong>
            </div>
            <div className="field-readout field-readout-right">
              <span>less periodic</span>
              <strong>diffuse rhythm</strong>
            </div>
            {REPORTS.map((report) => (
              <button
                key={report.id}
                type="button"
                className={`report-pin report-pin-${report.id} ${selectedId === report.id ? "selected" : ""}`}
                onClick={() => selectReport(report)}
              >
                <span>{report.label}</span>
                <small>{formatTime(report.time).slice(3)}</small>
              </button>
            ))}
            {EVENTS.map((event) => (
              <span key={event.label} className={`event-label event-${event.label.replace(" ", "-")}`}>{event.label}</span>
            ))}
            <div className="current-moment" style={{ left: `${8 + progress * 81}%` }}>
              <span /> {formatTime(currentTime)}
            </div>
          </div>

          <div className="timeline-controls">
            <button type="button" className="play-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause replay" : "Play replay"}>
              {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
            </button>
            <span className="time-current">{formatTime(currentTime)}</span>
            <div className="timeline-wrap">
              <input
                aria-label="Recording time"
                type="range"
                min="0"
                max={DURATION}
                value={currentTime}
                onChange={(event) => {
                  setCurrentTime(Number(event.target.value));
                  setPlaying(false);
                }}
                style={{ "--progress": `${progress * 100}%` }}
              />
              <div className="timeline-markers">
                {REPORTS.map((report) => (
                  <button key={report.id} type="button" style={{ left: `${(report.time / DURATION) * 100}%` }} onClick={() => selectReport(report)} aria-label={`Go to ${report.label} report`} />
                ))}
              </div>
            </div>
            <span className="time-total">{formatTime(DURATION)}</span>
          </div>
        </section>

        <section className="observation-strip">
          <div className="observation-heading"><Pulse weight="fill" /><span>Patterns worth testing</span></div>
          <article>
            <span>01</span>
            <p>The field changed <strong>before</strong> the first task marker.</p>
          </article>
          <article className={comparing ? "emphasized" : ""}>
            <span>02</span>
            <p>The recording revisited a similar spectral region under <strong>two different reports.</strong></p>
          </article>
        </section>

        <footer className="research-boundary">
          <Info weight="fill" />
          <p><strong>Aperiodic activity is not consciousness.</strong> This view tests relations among neural dynamics, events, and reports; it does not collapse them into an identity.</p>
        </footer>
      </main>

      <aside className="inspector">
        <div className="inspector-heading">
          <div>
            <span className="section-kicker">Selected moment</span>
            <h2>{formatTime(selected.time)}</h2>
          </div>
          <div className="reliability"><i /> 0.89 <span>high</span></div>
        </div>
        <div className="window-note"><ClockCounterClockwise /> 24-second analysis window</div>

        <section className="inspector-card measured-card">
          <div className="card-label"><span>01</span> Measured field</div>
          <div className="metric-grid">
            <div><span>Exponent</span><strong>{selected.x < 0 ? "1.91" : "1.48"}</strong><small>{selected.x < 0 ? "steeper" : "flatter"}</small></div>
            <div><span>Alpha CF</span><strong>{selected.y > 0.5 ? "10.2" : "9.7"}<em>Hz</em></strong><small>{selected.y > 0.5 ? "organized" : "diffuse"}</small></div>
          </div>
          <div className="quality-row"><span>Model reliability</span><strong>R² 0.89</strong></div>
          <p>Posterior channels O1 + O2. Values describe the signal, not an experience.</p>
        </section>

        <section className="inspector-card report-card">
          <div className="card-label"><span>02</span> Reported experience</div>
          <blockquote>“{selected.report}”</blockquote>
          <dl>
            <div><dt>Prompt</dt><dd>{selected.context}</dd></div>
            <div><dt>Confidence</dt><dd><ConfidenceDots value={selected.confidence} /></dd></div>
            <div><dt>Lag</dt><dd>8 sec after window</dd></div>
          </dl>
        </section>

        <section className="inspector-card hypothesis-card">
          <div className="card-label"><span>03</span> Hypothesis to test</div>
          <h3>{comparing ? "Similarity does not guarantee sameness" : "Transition precedes report"}</h3>
          <p>{comparing ? "Do similar spectral states support meaningfully different reported experiences?" : "Does the field begin moving toward this region before the report is made?"}</p>
          <div className="hypothesis-status"><i /> provisional relation</div>
        </section>

        <div className="inspector-actions">
          <button type="button" className="primary-action" onClick={() => setComparing((value) => !value)}>
            <CirclesThreePlus weight="fill" /> {comparing ? "End comparison" : "Compare reported moments"}
          </button>
          <button type="button" className="secondary-action" onClick={() => { setCurrentTime(0); setPlaying(true); }}>
            <Play weight="fill" /> Replay field
          </button>
        </div>

        <div className="interpretation-note">
          <span>Interpretation discipline</span>
          <p>Measured pattern → reported experience → testable relation. Each remains a different kind of evidence.</p>
        </div>
      </aside>
    </div>
  );
}
