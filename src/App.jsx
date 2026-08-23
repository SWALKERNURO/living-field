import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowRight,
  Brain,
  ChartScatter,
  CheckCircle,
  CirclesThreePlus,
  ClockCounterClockwise,
  Compass,
  DownloadSimple,
  Eye,
  FileArrowUp,
  Info,
  Pause,
  Play,
  Pulse,
  SlidersHorizontal,
  Sparkle,
  SquaresFour,
  WarningCircle,
} from "@phosphor-icons/react";
import anatomyPlate from "./assets/eeg-eog-anatomy.png";
import { ACCEPTED_WINDOWS, CONDITIONS, INTERNAL_EEG_PROTOCOL, INTERNAL_PROTOCOL, RECORDING_SERIES, STUDY_FACTS, VIDEO_REPEATS } from "./studyData";

const NAV_ITEMS = [
  { key: "Results overview", label: "Overview", icon: CirclesThreePlus },
  { key: "Recording map", label: "Where we recorded", icon: Brain },
  { key: "EEG ↔ EOG", label: "Brain vs. eyes", icon: Pulse },
  { key: "Condition field", label: "Condition results", icon: ChartScatter },
  { key: "Video drift", label: "Video over time", icon: Pulse },
  { key: "Sensitivity", label: "Artifact check", icon: SquaresFour },
  { key: "Methods", label: "How it works", icon: SlidersHorizontal },
  { key: "Boundary", label: "What we can say", icon: Compass },
];

const VIEW_COPY = {
  "Results overview": {
    kicker: "The recorded experiment",
    title: "Here’s what happened",
    subtitle: "We compared six situations using EEG at the back of the head and EOG around the eyes.",
  },
  "Recording map": {
    kicker: "Where the signals came from",
    title: "Brain + Eye Response Map",
    subtitle: "Explore the recorded O1/O2 and provisional EOG channels as each condition unfolds through time.",
  },
  "EEG ↔ EOG": {
    kicker: "Across two measured modalities",
    title: "The Fractal Relation",
    subtitle: "Both signals show 1/f-like spectra. Their six-condition patterns, however, do not align as one common process.",
  },
  "Condition field": {
    kicker: "Across environments",
    title: "The Condition Field",
    subtitle: "Six contexts occupy one measured space. Confidence changes how firmly each field appears.",
  },
  "Video drift": {
    kicker: "Within one long recording",
    title: "The Video Drift",
    subtitle: "Three provisional video-length segments reveal a late shift—and a simultaneous fall in ocular burden.",
  },
  Sensitivity: {
    kicker: "Artifact challenge",
    title: "What survives EOG regression?",
    subtitle: "Raw and EOG-regressed estimates stay separate so robustness remains visible.",
  },
  Methods: {
    kicker: "Analysis provenance",
    title: "How this field was made",
    subtitle: "A compact audit trail from OpenBCI recording to qualified aperiodic estimates.",
  },
  Boundary: {
    kicker: "Interpretation discipline",
    title: "What this field can—and cannot—say",
    subtitle: "Measured dynamics can be compared with contexts without turning correlation into identity.",
  },
};

function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  const number = Number.parseInt(value, 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function qualityLabel(condition) {
  if (condition.accepted === 0 && condition.r2 < 0.8) return "low confidence";
  if (condition.accepted === 0) return "aggregate only";
  if (condition.r2 >= 0.95) return "strong fit";
  return "qualified";
}

function formatPct(value) {
  return `${Math.round(value * 100)}%`;
}

function formatNumber(value, digits = 2) {
  return value == null ? "—" : Number(value).toFixed(digits);
}

function useCanvas(draw) {
  const ref = useRef(null);
  useEffect(() => {
    let frame;
    let observer;
    const animate = (time) => {
      draw(ref.current, time);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    if (ref.current) {
      observer = new ResizeObserver(() => draw(ref.current, performance.now()));
      observer.observe(ref.current);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [draw]);
  return ref;
}

function setupCanvas(canvas) {
  if (!canvas) return null;
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
  return { ctx, width, height };
}

function drawGrid(ctx, width, height, margins, xTicks, yTicks, xLabel, yLabel) {
  const plotW = width - margins.left - margins.right;
  const plotH = height - margins.top - margins.bottom;
  ctx.save();
  ctx.strokeStyle = "rgba(141, 162, 192, .12)";
  ctx.fillStyle = "rgba(171, 185, 208, .48)";
  ctx.font = "500 9px Inter, sans-serif";
  ctx.lineWidth = 1;
  ctx.textAlign = "center";
  xTicks.forEach(({ at, label }) => {
    const x = margins.left + at * plotW;
    ctx.beginPath();
    ctx.moveTo(x, margins.top);
    ctx.lineTo(x, margins.top + plotH);
    ctx.stroke();
    ctx.fillText(label, x, height - 31);
  });
  ctx.textAlign = "right";
  yTicks.forEach(({ at, label }) => {
    const y = margins.top + (1 - at) * plotH;
    ctx.beginPath();
    ctx.moveTo(margins.left, y);
    ctx.lineTo(margins.left + plotW, y);
    ctx.stroke();
    ctx.fillText(label, margins.left - 10, y + 3);
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(224, 232, 245, .72)";
  ctx.font = "600 9px Inter, sans-serif";
  ctx.fillText(xLabel.toUpperCase(), margins.left + plotW / 2, height - 10);
  ctx.save();
  ctx.translate(15, margins.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel.toUpperCase(), 0, 0);
  ctx.restore();
  ctx.restore();
}

function ConditionCanvas({ selectedKey, compareKey, onSelect }) {
  const map = useCallback((width, height, exponent, alphaPw) => {
    const margins = { left: 62, right: 35, top: 36, bottom: 58 };
    const x = margins.left + ((exponent - 0.6) / 1.55) * (width - margins.left - margins.right);
    const alpha = alphaPw == null ? 0.04 : Math.min(alphaPw, 2);
    const y = margins.top + (1 - alpha / 2) * (height - margins.top - margins.bottom);
    return { x, y, margins };
  }, []);

  const draw = useCallback((canvas, timestamp = 0) => {
    const ready = setupCanvas(canvas);
    if (!ready) return;
    const { ctx, width, height } = ready;
    const { margins } = map(width, height, 1, 1);
    drawGrid(
      ctx,
      width,
      height,
      margins,
      [0, 0.25, 0.5, 0.75, 1].map((at) => ({ at, label: (0.6 + at * 1.55).toFixed(1) })),
      [0, 0.25, 0.5, 0.75, 1].map((at) => ({ at, label: (at * 2).toFixed(1) })),
      "Aperiodic exponent — flatter → steeper",
      "Alpha peak power",
    );

    ACCEPTED_WINDOWS.forEach((windowValue) => {
      const condition = CONDITIONS.find((item) => item.key === windowValue.condition);
      const point = map(width, height, windowValue.exponent, windowValue.alphaPw);
      ctx.fillStyle = rgba(condition.color, 0.25 + windowValue.r2 * 0.34);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    CONDITIONS.forEach((condition, index) => {
      const point = map(width, height, condition.exponent, condition.alphaPw);
      const selected = condition.key === selectedKey;
      const compared = condition.key === compareKey;
      const pulse = 1 + Math.sin(timestamp * 0.0015 + index * 1.7) * 0.09;
      const radius = (condition.accepted === 0 ? 7 : 8 + Math.sqrt(condition.accepted) * 1.1) * pulse;

      if (selected || compared) {
        const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 4.5);
        glow.addColorStop(0, rgba(condition.color, selected ? 0.28 : 0.18));
        glow.addColorStop(1, rgba(condition.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      if (condition.accepted === 0) ctx.setLineDash([4, 4]);
      ctx.strokeStyle = rgba(condition.color, Math.max(0.3, condition.r2 - 0.16));
      ctx.lineWidth = selected ? 2.2 : 1.3;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = condition.accepted === 0 ? "#080f1d" : rgba(condition.color, 0.88);
      ctx.strokeStyle = condition.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = selected ? "#f7fbff" : "#c2cede";
      ctx.font = `${selected ? 700 : 600} 9px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(condition.short, point.x, point.y - radius - 11);
      ctx.fillStyle = "rgba(162, 176, 198, .72)";
      ctx.font = "500 8px Inter, sans-serif";
      ctx.fillText(`χ ${condition.exponent.toFixed(2)}`, point.x, point.y + radius + 17);
    });
  }, [compareKey, map, selectedKey]);

  const canvasRef = useCanvas(draw);
  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const closest = CONDITIONS.map((condition) => {
      const point = map(rect.width, rect.height, condition.exponent, condition.alphaPw);
      return { condition, distance: Math.hypot(point.x - x, point.y - y) };
    }).sort((a, b) => a.distance - b.distance)[0];
    if (closest?.distance < 34) onSelect(closest.condition.key);
  };

  return <canvas ref={canvasRef} onClick={handleClick} className="field-canvas interactive-canvas" aria-label="Condition state-space field: aperiodic exponent by alpha peak power" />;
}

function VideoCanvas({ selectedRepeat, progress, onSelect }) {
  const draw = useCallback((canvas, timestamp = 0) => {
    const ready = setupCanvas(canvas);
    if (!ready) return;
    const { ctx, width, height } = ready;
    const margins = { left: 62, right: 35, top: 40, bottom: 62 };
    const plotW = width - margins.left - margins.right;
    const plotH = height - margins.top - margins.bottom;
    const mapX = (index) => margins.left + ((index + 0.5) / 3) * plotW;
    const mapY = (value) => margins.top + (1 - (value - 1.1) / 0.7) * plotH;
    drawGrid(ctx, width, height, margins, VIDEO_REPEATS.map((item, index) => ({ at: (index + 0.5) / 3, label: item.label })), [1.1, 1.3, 1.5, 1.7].map((value) => ({ at: (value - 1.1) / 0.7, label: value.toFixed(1) })), "Provisional video-length segment", "Median exponent");

    ctx.beginPath();
    VIDEO_REPEATS.forEach((item, index) => {
      const x = mapX(index);
      const y = mapY(item.exponent);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "rgba(183,248,141,.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    VIDEO_REPEATS.forEach((item, index) => {
      const x = mapX(index);
      const y = mapY(item.exponent);
      const selected = item.id === selectedRepeat;
      const reached = index <= progress;
      const radius = 10 + item.accepted * 0.25;
      const pulse = 1 + Math.sin(timestamp * 0.0018 + index) * 0.08;
      const color = index === 2 ? "#b7f88d" : index === 1 ? "#52dde5" : "#a372f6";
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      glow.addColorStop(0, rgba(color, selected ? 0.34 : 0.16));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = reached ? rgba(color, 0.86) : rgba(color, 0.22);
      ctx.strokeStyle = color;
      ctx.lineWidth = selected ? 2.4 : 1.2;
      ctx.beginPath();
      ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#dce7f3";
      ctx.font = "600 9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`χ ${item.exponent.toFixed(2)}`, x, y - radius - 13);
      ctx.fillStyle = "rgba(235,113,131,.82)";
      ctx.fillRect(x - 26, height - 42, 52 * item.eogRate, 3);
      ctx.fillStyle = "rgba(153,166,188,.62)";
      ctx.font = "500 7px Inter, sans-serif";
      ctx.fillText(`EOG ${formatPct(item.eogRate)}`, x, height - 47);
    });
  }, [progress, selectedRepeat]);
  const ref = useCanvas(draw);
  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.max(0, Math.min(2, Math.floor(((event.clientX - rect.left - 62) / (rect.width - 97)) * 3)));
    onSelect(index + 1);
  };
  return <canvas ref={ref} onClick={handleClick} className="field-canvas interactive-canvas" aria-label="Video exponent drift across three provisional repeats" />;
}

function SensitivityCanvas({ selectedKey, onSelect }) {
  const draw = useCallback((canvas, timestamp = 0) => {
    const ready = setupCanvas(canvas);
    if (!ready) return;
    const { ctx, width, height } = ready;
    const margins = { left: 120, right: 45, top: 34, bottom: 54 };
    const plotW = width - margins.left - margins.right;
    const plotH = height - margins.top - margins.bottom;
    const mapX = (value) => margins.left + ((value - 0.5) / 1.25) * plotW;
    drawGrid(ctx, width, height, margins, [0.5, 0.75, 1, 1.25, 1.5, 1.75].map((value) => ({ at: (value - 0.5) / 1.25, label: value.toFixed(2) })), [], "Median exponent", "Condition");
    CONDITIONS.forEach((condition, index) => {
      const y = margins.top + ((index + 0.5) / CONDITIONS.length) * plotH;
      const selected = condition.key === selectedKey;
      ctx.textAlign = "right";
      ctx.fillStyle = selected ? "#edf5ff" : "rgba(172,185,207,.7)";
      ctx.font = `${selected ? 700 : 500} 9px Inter, sans-serif`;
      ctx.fillText(condition.label, margins.left - 14, y + 3);
      ctx.strokeStyle = rgba(condition.color, selected ? 0.9 : 0.45);
      ctx.lineWidth = selected ? 2.5 : 1.3;
      ctx.beginPath();
      ctx.moveTo(mapX(condition.rawExponent), y);
      ctx.lineTo(mapX(condition.correctedExponent), y);
      ctx.stroke();
      [{ value: condition.rawExponent, filled: true }, { value: condition.correctedExponent, filled: false }].forEach((point) => {
        ctx.fillStyle = point.filled ? condition.color : "#080f1d";
        ctx.strokeStyle = condition.color;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.arc(mapX(point.value), y, selected ? 6.5 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      if (selected) {
        ctx.fillStyle = rgba(condition.color, 0.08 + Math.sin(timestamp * 0.001) * 0.015);
        ctx.fillRect(margins.left, y - 18, plotW, 36);
      }
    });
  }, [selectedKey]);
  const ref = useCanvas(draw);
  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.max(0, Math.min(CONDITIONS.length - 1, Math.floor(((event.clientY - rect.top - 34) / (rect.height - 88)) * CONDITIONS.length)));
    onSelect(CONDITIONS[index].key);
  };
  return <canvas ref={ref} onClick={handleClick} className="field-canvas interactive-canvas" aria-label="Raw versus EOG-regressed exponent sensitivity" />;
}

function InsideOutsideCanvas({ selectedDomain, selectedKey, selectedImageryKey, selectedEogKey, onSelectExternal, onSelectImagery, onSelectEog }) {
  const pointMap = useCallback((width, height) => {
    const centerY = height * 0.52;
    const radiusX = Math.min(width * 0.17, 150);
    const radiusY = Math.min(height * 0.31, 128);
    const leftX = width * 0.27;
    const rightX = width * 0.73;
    const external = CONDITIONS.map((condition, index) => {
      const angle = (-145 + index * 58) * (Math.PI / 180);
      return { item: condition, x: leftX + Math.cos(angle) * radiusX, y: centerY + Math.sin(angle) * radiusY };
    });
    const internal = INTERNAL_EEG_PROTOCOL.map((condition, index) => {
      const angle = (-90 + index * 180) * (Math.PI / 180);
      return { item: condition, x: rightX + Math.cos(angle) * radiusX, y: centerY + Math.sin(angle) * radiusY };
    });
    const eog = INTERNAL_PROTOCOL.map((condition, index) => ({
      item: condition,
      x: width * 0.35 + (index / (INTERNAL_PROTOCOL.length - 1)) * width * 0.3,
      y: height * 0.89,
    }));
    return { centerY, leftX, rightX, radiusX, radiusY, external, internal, eog };
  }, []);

  const draw = useCallback((canvas, timestamp = 0) => {
    const ready = setupCanvas(canvas);
    if (!ready) return;
    const { ctx, width, height } = ready;
    const map = pointMap(width, height);
    const pulse = 1 + Math.sin(timestamp * 0.0013) * 0.035;

    ctx.save();
    ctx.strokeStyle = "rgba(141, 162, 192, .11)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.ellipse(map.leftX, map.centerY, map.radiusX, map.radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(map.rightX, map.centerY, map.radiusX, map.radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const bridgeStart = map.leftX + map.radiusX * 0.66;
    const bridgeEnd = map.rightX - map.radiusX * 0.66;
    const bridge = ctx.createLinearGradient(bridgeStart, 0, bridgeEnd, 0);
    bridge.addColorStop(0, "rgba(82,221,229,.6)");
    bridge.addColorStop(0.5, "rgba(245,207,104,.74)");
    bridge.addColorStop(1, "rgba(163,114,246,.5)");
    ctx.strokeStyle = bridge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bridgeStart, map.centerY);
    ctx.bezierCurveTo(width * 0.44, map.centerY - 26, width * 0.56, map.centerY + 26, bridgeEnd, map.centerY);
    ctx.stroke();
    ctx.fillStyle = "#f5cf68";
    ctx.beginPath();
    ctx.arc(width * 0.5, map.centerY, 4.5 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(245,207,104,.72)";
    ctx.font = "600 8px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RELATION TO TEST", width * 0.5, map.centerY - 16);
    ctx.fillStyle = "rgba(134,148,171,.58)";
    ctx.font = "500 7px Inter, sans-serif";
    ctx.fillText("not a shared metric", width * 0.5, map.centerY + 22);

    [
      { x: map.leftX, label: "OUTSIDE", sub: "O1/O2 EEG · 1/f + alpha", color: "#52dde5", active: selectedDomain === "external" },
      { x: map.rightX, label: "INSIDE", sub: "O1/O2 EEG · imagined", color: "#a372f6", active: selectedDomain === "internal" },
    ].forEach((center) => {
      const glow = ctx.createRadialGradient(center.x, map.centerY, 0, center.x, map.centerY, 66);
      glow.addColorStop(0, rgba(center.color, center.active ? 0.17 : 0.08));
      glow.addColorStop(1, rgba(center.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(center.x, map.centerY, 66, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = center.active ? "#edf5ff" : "#b5c0d0";
      ctx.font = "700 16px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(center.label, center.x, map.centerY - 3);
      ctx.fillStyle = "rgba(137,151,173,.7)";
      ctx.font = "500 8px Inter, sans-serif";
      ctx.fillText(center.sub, center.x, map.centerY + 15);
    });

    map.external.forEach(({ item, x, y }) => {
      const selected = selectedDomain === "external" && item.key === selectedKey;
      const radius = selected ? 11 : 8;
      if (selected) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 34);
        glow.addColorStop(0, rgba(item.color, 0.34));
        glow.addColorStop(1, rgba(item.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 34, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = rgba(item.color, Math.max(0.46, item.r2 - 0.08));
      ctx.strokeStyle = item.color;
      ctx.lineWidth = selected ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = selected ? "#f4f8ff" : "#aebacc";
      ctx.font = `${selected ? 700 : 600} 8px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(item.short, x, y - radius - 8);
      ctx.fillStyle = "rgba(153,166,187,.65)";
      ctx.font = "500 7px Inter, sans-serif";
      ctx.fillText(`χ ${item.exponent.toFixed(2)}`, x, y + radius + 12);
    });

    map.internal.forEach(({ item, x, y }) => {
      const selected = selectedDomain === "internal" && item.key === selectedImageryKey;
      const radius = selected ? 12 : 9;
      if (selected) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 34);
        glow.addColorStop(0, rgba(item.color, 0.24));
        glow.addColorStop(1, rgba(item.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 34, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.fillStyle = "#080f1d";
      ctx.strokeStyle = rgba(item.color, selected ? 0.95 : 0.62);
      ctx.lineWidth = selected ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = selected ? "#f4f8ff" : "#aebacc";
      ctx.font = `${selected ? 700 : 600} 8px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(item.short, x, y - radius - 8);
      ctx.fillStyle = "rgba(153,166,187,.58)";
      ctx.font = "500 7px Inter, sans-serif";
      ctx.fillText("awaiting data", x, y + radius + 12);
    });

    ctx.strokeStyle = "rgba(82,221,229,.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(map.eog[0].x, map.eog[0].y);
    ctx.lineTo(map.eog[map.eog.length - 1].x, map.eog[map.eog.length - 1].y);
    ctx.stroke();
    map.eog.forEach(({ item, x, y }) => {
      const selected = selectedDomain === "eog" && item.key === selectedEogKey;
      if (selected) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
        glow.addColorStop(0, rgba(item.color, 0.25));
        glow.addColorStop(1, rgba(item.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.fillStyle = "#080f1d";
      ctx.strokeStyle = rgba(item.color, selected ? 0.95 : 0.55);
      ctx.lineWidth = selected ? 2.2 : 1.3;
      ctx.beginPath();
      ctx.arc(x, y, selected ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = selected ? "#eef5ff" : "rgba(170,182,201,.72)";
      ctx.font = `${selected ? 700 : 600} 7px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(item.short, x, y + 20);
    });
    ctx.fillStyle = "rgba(112,127,151,.62)";
    ctx.font = "600 8px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DAY 2 · CLOSED-EYE EOG MOVEMENT FIELD", width * 0.5, height * 0.79);

    ctx.fillStyle = "rgba(112,127,151,.62)";
    ctx.font = "600 8px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MEASURED EXTERNAL FIELD", map.leftX, 24);
    ctx.fillText("PROTOCOL-DEFINED INTERNAL FIELD", map.rightX, 24);
  }, [pointMap, selectedDomain, selectedEogKey, selectedImageryKey, selectedKey]);

  const ref = useCanvas(draw);
  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const map = pointMap(rect.width, rect.height);
    const candidates = [
      ...map.external.map((point) => ({ ...point, domain: "external" })),
      ...map.internal.map((point) => ({ ...point, domain: "internal" })),
      ...map.eog.map((point) => ({ ...point, domain: "eog" })),
    ].map((point) => ({ ...point, distance: Math.hypot(point.x - x, point.y - y) })).sort((a, b) => a.distance - b.distance);
    if (candidates[0]?.distance > 34) return;
    if (candidates[0].domain === "external") onSelectExternal(candidates[0].item.key);
    else if (candidates[0].domain === "internal") onSelectImagery(candidates[0].item.key);
    else onSelectEog(candidates[0].item.key);
  };

  return <canvas ref={ref} onClick={handleClick} className="field-canvas interactive-canvas" aria-label="Internal and external fractal study evidence map" />;
}

function ContextContinuumCanvas({ selectedKey, compareKey, onSelect }) {
  const positions = {
    "eyes-open": 0.11,
    "eyes-closed": 0.23,
    video: 0.42,
    "still-image": 0.54,
    nature: 0.74,
    "sturm-hall": 0.9,
  };
  const map = useCallback((width, height, condition) => {
    const margins = { left: 60, right: 32, top: 42, bottom: 62 };
    const plotW = width - margins.left - margins.right;
    const plotH = height - margins.top - margins.bottom;
    const x = margins.left + positions[condition.key] * plotW;
    const y = margins.top + (1 - (condition.exponent - 0.6) / 1.2) * plotH;
    return { x, y, margins, plotW, plotH };
  }, []);

  const draw = useCallback((canvas, timestamp = 0) => {
    const ready = setupCanvas(canvas);
    if (!ready) return;
    const { ctx, width, height } = ready;
    const { margins, plotW, plotH } = map(width, height, CONDITIONS[0]);
    const zones = [
      { start: 0, end: 0.29, label: "BASELINE", color: "#52dde5" },
      { start: 0.29, end: 0.62, label: "MEDIATED VISUAL FIELD", color: "#a372f6" },
      { start: 0.62, end: 0.82, label: "NATURAL ENVIRONMENT", color: "#50e4b0" },
      { start: 0.82, end: 1, label: "BUILT ENVIRONMENT", color: "#eb7183" },
    ];

    zones.forEach((zone, index) => {
      const x = margins.left + zone.start * plotW;
      const w = (zone.end - zone.start) * plotW;
      ctx.fillStyle = rgba(zone.color, index % 2 === 0 ? 0.025 : 0.016);
      ctx.fillRect(x, margins.top, w, plotH);
      ctx.strokeStyle = "rgba(141,162,192,.11)";
      ctx.beginPath();
      ctx.moveTo(x, margins.top);
      ctx.lineTo(x, margins.top + plotH);
      ctx.stroke();
      ctx.fillStyle = rgba(zone.color, 0.62);
      ctx.font = "600 7px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(zone.label, x + w / 2, 22);
    });
    ctx.strokeStyle = "rgba(141,162,192,.11)";
    ctx.beginPath();
    ctx.moveTo(margins.left + plotW, margins.top);
    ctx.lineTo(margins.left + plotW, margins.top + plotH);
    ctx.stroke();

    [0.6, 0.9, 1.2, 1.5, 1.8].forEach((value) => {
      const y = margins.top + (1 - (value - 0.6) / 1.2) * plotH;
      ctx.strokeStyle = "rgba(141,162,192,.12)";
      ctx.beginPath();
      ctx.moveTo(margins.left, y);
      ctx.lineTo(margins.left + plotW, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(159,173,195,.5)";
      ctx.font = "500 8px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(value.toFixed(1), margins.left - 10, y + 3);
    });

    ctx.beginPath();
    CONDITIONS.forEach((condition, index) => {
      const point = map(width, height, condition);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = "rgba(183,248,141,.34)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    CONDITIONS.forEach((condition, index) => {
      const point = map(width, height, condition);
      const selected = condition.key === selectedKey;
      const compared = condition.key === compareKey;
      const radius = 8 + Math.sqrt(Math.max(1, condition.accepted)) * 1.25;
      const alphaRadius = condition.alphaPw == null ? 0 : 14 + Math.min(18, condition.alphaPw * 9);
      const pulse = 1 + Math.sin(timestamp * 0.0014 + index) * 0.06;

      if (alphaRadius > 0) {
        const glow = ctx.createRadialGradient(point.x, point.y, radius, point.x, point.y, alphaRadius * pulse);
        glow.addColorStop(0, rgba(condition.color, selected ? 0.22 : 0.1));
        glow.addColorStop(1, rgba(condition.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(point.x, point.y, alphaRadius * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      if (selected || compared) {
        ctx.strokeStyle = rgba(condition.color, selected ? 0.62 : 0.38);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.save();
      if (condition.accepted === 0) ctx.setLineDash([3, 3]);
      ctx.fillStyle = condition.accepted === 0 ? "#080f1d" : rgba(condition.color, Math.max(0.45, condition.r2 - 0.08));
      ctx.strokeStyle = condition.color;
      ctx.lineWidth = selected ? 2.4 : 1.5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = selected ? "#f4f8ff" : "#b9c4d4";
      ctx.font = `${selected ? 700 : 600} 8px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(condition.label.toUpperCase(), point.x, point.y - radius - 12);
      ctx.fillStyle = "rgba(159,173,194,.7)";
      ctx.font = "500 7px Inter, sans-serif";
      ctx.fillText(`χ ${condition.exponent.toFixed(2)} · R² ${condition.r2.toFixed(2)}`, point.x, point.y + radius + 14);
    });

    ctx.fillStyle = "rgba(222,231,243,.74)";
    ctx.font = "600 9px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RECORDED CONDITION ORDER →", margins.left + plotW / 2, height - 12);
    ctx.save();
    ctx.translate(15, margins.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("APERIODIC EXPONENT", 0, 0);
    ctx.restore();
  }, [compareKey, map, selectedKey]);

  const ref = useCanvas(draw);
  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const closest = CONDITIONS.map((condition) => {
      const point = map(rect.width, rect.height, condition);
      return { condition, distance: Math.hypot(point.x - x, point.y - y) };
    }).sort((a, b) => a.distance - b.distance)[0];
    if (closest?.distance < 38) onSelect(closest.condition.key);
  };
  return <canvas ref={ref} onClick={handleClick} className="field-canvas interactive-canvas" aria-label="Six-condition EEG context continuum" />;
}

function FractalRelationCanvas({ selectedKey, onSelect }) {
  const map = useCallback((width, height, condition, index) => {
    const margins = { left: 54, right: 54, top: 64, bottom: 48 };
    const center = width / 2;
    const laneWidth = Math.max(120, center - margins.left - 108);
    const y = margins.top + ((index + 0.5) / CONDITIONS.length) * (height - margins.top - margins.bottom);
    const eegX = margins.left + ((condition.exponent - 0.6) / 1.2) * laneWidth;
    const eogX = center + 108 + ((condition.eogExponent - 1.2) / 1.8) * laneWidth;
    return { eegX, eogX, y, center, margins, laneWidth };
  }, []);

  const draw = useCallback((canvas, timestamp = 0) => {
    const ready = setupCanvas(canvas);
    if (!ready) return;
    const { ctx, width, height } = ready;
    const base = map(width, height, CONDITIONS[0], 0);

    ctx.fillStyle = "rgba(82,221,229,.035)";
    ctx.fillRect(base.margins.left, base.margins.top - 18, base.laneWidth, height - base.margins.top - base.margins.bottom + 36);
    ctx.fillStyle = "rgba(163,114,246,.035)";
    ctx.fillRect(base.center + 108, base.margins.top - 18, base.laneWidth, height - base.margins.top - base.margins.bottom + 36);

    ctx.fillStyle = "rgba(213,226,241,.88)";
    ctx.font = "700 10px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("O1/O2 EEG", base.margins.left, 24);
    ctx.fillStyle = "rgba(154,171,193,.72)";
    ctx.font = "500 8px Inter, sans-serif";
    ctx.fillText("APERIODIC EXPONENT · 2–40 HZ", base.margins.left, 39);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(213,226,241,.88)";
    ctx.font = "700 10px Inter, sans-serif";
    ctx.fillText("EOG-A/B", width - base.margins.right, 24);
    ctx.fillStyle = "rgba(154,171,193,.72)";
    ctx.font = "500 8px Inter, sans-serif";
    ctx.fillText("TEMPORAL EXPONENT · 0.5–15 HZ", width - base.margins.right, 39);

    [0.6, 0.9, 1.2, 1.5, 1.8].forEach((value) => {
      const x = base.margins.left + ((value - 0.6) / 1.2) * base.laneWidth;
      ctx.strokeStyle = "rgba(141,162,192,.1)";
      ctx.beginPath();
      ctx.moveTo(x, base.margins.top - 18);
      ctx.lineTo(x, height - base.margins.bottom + 18);
      ctx.stroke();
      ctx.fillStyle = "rgba(151,168,192,.55)";
      ctx.font = "500 7px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(value.toFixed(1), x, height - 13);
    });
    [1.2, 1.65, 2.1, 2.55, 3.0].forEach((value) => {
      const x = base.center + 108 + ((value - 1.2) / 1.8) * base.laneWidth;
      ctx.strokeStyle = "rgba(141,162,192,.1)";
      ctx.beginPath();
      ctx.moveTo(x, base.margins.top - 18);
      ctx.lineTo(x, height - base.margins.bottom + 18);
      ctx.stroke();
      ctx.fillStyle = "rgba(151,168,192,.55)";
      ctx.font = "500 7px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(value.toFixed(1), x, height - 13);
    });

    CONDITIONS.forEach((condition, index) => {
      const point = map(width, height, condition, index);
      const selected = condition.key === selectedKey;
      const pulse = 1 + Math.sin(timestamp * 0.0015 + index) * 0.06;
      ctx.strokeStyle = rgba(condition.color, selected ? 0.52 : 0.2);
      ctx.lineWidth = selected ? 1.8 : 1;
      ctx.beginPath();
      ctx.moveTo(point.eegX + 8, point.y);
      ctx.bezierCurveTo(point.center - 45, point.y, point.center + 45, point.y, point.eogX - 8, point.y);
      ctx.stroke();

      const labelWidth = 78;
      ctx.fillStyle = selected ? "rgba(16,28,45,.96)" : "rgba(8,15,29,.82)";
      ctx.strokeStyle = rgba(condition.color, selected ? 0.65 : 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(point.center - labelWidth / 2, point.y - 11, labelWidth, 22, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = selected ? "#f4f8ff" : "rgba(190,203,221,.82)";
      ctx.font = `${selected ? 700 : 600} 7px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(condition.short, point.center, point.y + 3);

      if (selected) {
        [point.eegX, point.eogX].forEach((x) => {
          const glow = ctx.createRadialGradient(x, point.y, 0, x, point.y, 26 * pulse);
          glow.addColorStop(0, rgba(condition.color, 0.28));
          glow.addColorStop(1, rgba(condition.color, 0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, point.y, 26 * pulse, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.save();
      if (condition.accepted === 0) ctx.setLineDash([3, 3]);
      ctx.fillStyle = condition.accepted === 0 ? "#080f1d" : rgba(condition.color, 0.9);
      ctx.strokeStyle = condition.color;
      ctx.lineWidth = selected ? 2.4 : 1.5;
      ctx.beginPath();
      ctx.arc(point.eegX, point.y, 7 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = rgba(condition.color, Math.max(0.58, condition.eogR2));
      ctx.strokeStyle = condition.color;
      ctx.lineWidth = selected ? 2.4 : 1.5;
      ctx.beginPath();
      ctx.arc(point.eogX, point.y, 7 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(199,211,227,.78)";
      ctx.font = "600 8px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(condition.exponent.toFixed(2), point.eegX - 12, point.y + 3);
      ctx.textAlign = "left";
      ctx.fillText(condition.eogExponent.toFixed(2), point.eogX + 12, point.y + 3);
    });
  }, [map, selectedKey]);

  const ref = useCanvas(draw);
  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const closest = CONDITIONS.map((condition, index) => {
      const point = map(rect.width, rect.height, condition, index);
      return { condition, distance: Math.min(Math.hypot(point.eegX - x, point.y - y), Math.hypot(point.eogX - x, point.y - y), Math.abs(point.y - y) + Math.abs(point.center - x) * 0.1) };
    }).sort((a, b) => a.distance - b.distance)[0];
    if (closest?.distance < 30) onSelect(closest.condition.key);
  };
  return <canvas ref={ref} onClick={handleClick} className="field-canvas interactive-canvas" aria-label="Linked EEG and EOG exponent profiles across six recorded conditions" />;
}

function ResultsOverview({ onOpenMap }) {
  const [showNumbers, setShowNumbers] = useState(false);
  return (
    <div className="simple-results">
      <section className="plain-conclusion">
        <span>Main result</span>
        <h3>The brain and eye signals both changed—but they did not change together in a simple, consistent way.</h3>
        <p>That means the recording found interesting differences between situations, but it did <strong>not</strong> show that EEG and eye movement share one fractal process.</p>
      </section>

      <section className="plain-findings" aria-label="Three main findings">
        <article><div className="plain-icon brain-icon"><Brain weight="fill" /></div><div><span>Brain signal</span><h3>The brain’s background pattern was steepest during the video.</h3><p>Nature was next. Both were steeper than the two baseline recordings.</p></div></article>
        <article><div className="plain-icon eye-icon"><Eye weight="fill" /></div><div><span>Useful quality check</span><h3>Eyes closed produced the expected alpha pattern.</h3><p>This is reassuring because O1 and O2 were placed over the visual part of the brain.</p></div></article>
        <article><div className="plain-icon relation-icon"><Pulse weight="fill" /></div><div><span>Brain compared with eyes</span><h3>The two patterns did not reliably rise and fall together.</h3><p>The eye signal looked 1/f-like, but it was also strongly affected by eye-signal size.</p></div></article>
      </section>

      <section className="plain-comparison">
        <div className="plain-section-heading"><div><span>The six situations</span><h3>How steep was the background brain pattern?</h3><p>Scientists call this the 1/f slope.</p></div><button type="button" onClick={() => setShowNumbers((value) => !value)}>{showNumbers ? "Hide technical numbers" : "Show technical numbers"}</button></div>
        <div className="simple-bars">
          {CONDITIONS.map((condition) => {
            const width = `${Math.max(8, Math.min(100, ((condition.exponent - 0.6) / 1.1) * 100))}%`;
            return <div className={`simple-bar-row ${condition.accepted === 0 ? "fragile" : ""}`} key={condition.key}><span>{condition.label}</span><div className="simple-bar-track"><i style={{ width, background: condition.color }} /></div><strong>{condition.key === "video" ? "steepest" : condition.key === "nature" ? "second" : condition.key === "sturm-hall" ? "flattest" : ""}</strong>{showNumbers && <small>χ {condition.exponent.toFixed(2)} · R² {condition.r2.toFixed(2)}{condition.accepted === 0 ? " · low confidence" : ""}</small>}</div>;
          })}
        </div>
        <div className="slope-key"><span>flatter slope</span><i /><span>steeper slope</span></div>
      </section>

      <section className="plain-next-step">
        <div><CheckCircle weight="fill" /><p><strong>Most reassuring:</strong> the eyes-closed alpha result behaved as expected.</p></div>
        <div><WarningCircle weight="fill" /><p><strong>Use caution:</strong> Still Image and Sturm Hall had no strictly accepted EEG windows.</p></div>
        <button type="button" onClick={onOpenMap}>See where we recorded <ArrowRight /></button>
      </section>
    </div>
  );
}

function RecordingMapCanvas({ selectedKey, progress, selectedRegion, onSelectRegion }) {
  const imageRef = useRef(null);
  const series = RECORDING_SERIES[selectedKey] || RECORDING_SERIES.video;
  const index = Math.min(series.eeg.length - 1, Math.max(0, Math.round(progress)));
  const eegValue = series.eeg[index];
  const eogValue = series.eog[index];
  const quality = series.quality[index];

  const draw = useCallback((canvas, timestamp = 0) => {
    const ready = setupCanvas(canvas);
    if (!ready) return;
    const { ctx, width, height } = ready;
    if (!imageRef.current) {
      imageRef.current = new Image();
      imageRef.current.src = anatomyPlate;
    }
    const image = imageRef.current;
    const top = 22;
    const bottomPanel = 118;
    const availableH = height - top - bottomPanel;
    const scale = image.naturalWidth ? Math.min((width - 36) / image.naturalWidth, availableH / image.naturalHeight) : 0;
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const drawX = (width - drawW) / 2;
    const drawY = top + (availableH - drawH) / 2;
    if (image.complete && image.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = 0.82;
      ctx.drawImage(image, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    const positions = {
      O1: { x: drawX + drawW * 0.225, y: drawY + drawH * 0.42, channel: "EEG" },
      O2: { x: drawX + drawW * 0.315, y: drawY + drawH * 0.42, channel: "EEG" },
      "EOG-A": { x: drawX + drawW * 0.59, y: drawY + drawH * 0.51, channel: "EOG" },
      "EOG-B": { x: drawX + drawW * 0.82, y: drawY + drawH * 0.42, channel: "EOG" },
    };
    const eegNorm = Math.max(0, Math.min(1, (eegValue - 0.2) / 1.9));
    const eogNorm = Math.max(0, Math.min(1, (eogValue - 1) / 2.2));
    Object.entries(positions).forEach(([label, point], pointIndex) => {
      const valueNorm = point.channel === "EEG" ? eegNorm : eogNorm;
      const color = point.channel === "EEG" ? "#52dde5" : "#a372f6";
      const selected = selectedRegion === label;
      const pulse = 1 + Math.sin(timestamp * 0.0022 + pointIndex) * 0.12;
      const outer = (16 + valueNorm * 23) * pulse;
      const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, outer);
      glow.addColorStop(0, rgba(color, selected ? 0.55 : 0.36));
      glow.addColorStop(0.38, rgba(color, 0.18));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(point.x, point.y, outer, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = selected ? "#eef9ff" : color;
      ctx.strokeStyle = selected ? "#ffffff" : rgba(color, 0.9);
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5 + valueNorm * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = selected ? "#f4f8ff" : "rgba(205,216,231,.82)";
      ctx.font = `${selected ? 700 : 600} 8px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(label, point.x, point.y - outer - 7);
    });

    const traceTop = height - 100;
    const traceLeft = 54;
    const traceRight = width - 30;
    const traceW = traceRight - traceLeft;
    const drawTrace = (values, min, max, color, yBase, label) => {
      ctx.strokeStyle = rgba(color, 0.13);
      ctx.beginPath();
      ctx.moveTo(traceLeft, yBase);
      ctx.lineTo(traceRight, yBase);
      ctx.stroke();
      ctx.beginPath();
      values.forEach((value, traceIndex) => {
        const x = traceLeft + (traceIndex / Math.max(1, values.length - 1)) * traceW;
        const y = yBase - ((value - min) / (max - min) - 0.5) * 34;
        if (traceIndex === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = rgba(color, 0.78);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const currentX = traceLeft + (index / Math.max(1, values.length - 1)) * traceW;
      ctx.strokeStyle = rgba("#f5cf68", 0.7);
      ctx.beginPath();
      ctx.moveTo(currentX, yBase - 23);
      ctx.lineTo(currentX, yBase + 23);
      ctx.stroke();
      ctx.fillStyle = rgba(color, 0.92);
      ctx.font = "700 7px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, 12, yBase + 3);
    };
    drawTrace(series.eeg, 0.2, 2.1, "#52dde5", traceTop + 18, "EEG");
    drawTrace(series.eog, 1, 3.2, "#a372f6", traceTop + 63, "EOG");
    ctx.fillStyle = "rgba(153,169,193,.58)";
    ctx.font = "500 7px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${series.windows} reviewed windows · ${quality > 0 ? "current EEG bin includes accepted data" : "current EEG bin did not pass strict screen"}`, traceRight, height - 9);
  }, [eegValue, eogValue, index, quality, selectedRegion, series]);

  const ref = useCanvas(draw);
  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const image = imageRef.current;
    if (!image?.naturalWidth) return;
    const top = 22;
    const bottomPanel = 118;
    const availableH = rect.height - top - bottomPanel;
    const scale = Math.min((rect.width - 36) / image.naturalWidth, availableH / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const drawX = (rect.width - drawW) / 2;
    const drawY = top + (availableH - drawH) / 2;
    const candidates = [
      ["O1", drawX + drawW * 0.225, drawY + drawH * 0.42],
      ["O2", drawX + drawW * 0.315, drawY + drawH * 0.42],
      ["EOG-A", drawX + drawW * 0.59, drawY + drawH * 0.51],
      ["EOG-B", drawX + drawW * 0.82, drawY + drawH * 0.42],
    ].map(([label, x, y]) => ({ label, distance: Math.hypot(event.clientX - rect.left - x, event.clientY - rect.top - y) })).sort((a, b) => a.distance - b.distance)[0];
    if (candidates?.distance < 48) onSelectRegion(candidates.label);
  };
  return <canvas ref={ref} onClick={handleClick} className="field-canvas interactive-canvas" aria-label="Interactive posterior EEG and eye EOG recording map" />;
}

function MethodsView() {
  const steps = [
    ["01", "OpenBCI source", "12 recordings · O1/O2 + three EOG channels · approximately 250 Hz"],
    ["02", "Qualified windows", "20-second non-overlapping windows; EOG, EEG amplitude, and model screens"],
    ["03", "Spectral model", "Welch PSD over 2–40 Hz; fixed-mode aperiodic fit plus oscillatory peaks"],
    ["04", "EOG temporal model", "EOG-A/B filtered 0.25–20 Hz; Welch slope fit over 0.5–15 Hz across 134 windows"],
    ["05", "Relation + sensitivity", "Condition profiles compared descriptively; raw EEG also challenged with EOG regression"],
  ];
  return (
    <div className="method-stage">
      <div className="method-chain">{steps.map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
      <div className="method-summary"><div><strong>{STUDY_FACTS.recordings}</strong><span>recordings</span></div><div><strong>{STUDY_FACTS.minutes}</strong><span>minutes</span></div><div><strong>{STUDY_FACTS.accepted}/{STUDY_FACTS.total}</strong><span>strict EEG windows</span></div><div><strong>134</strong><span>EOG windows</span></div></div>
    </div>
  );
}

function BoundaryView() {
  return (
    <div className="boundary-stage">
      <div className="boundary-statement"><Sparkle weight="fill" /><p>The field is a map of <strong>measured spectral organization</strong>. It is not an image of consciousness, a consciousness score, or proof that 1/f activity causes experience.</p></div>
      <div className="boundary-columns">
        <article className="can-say"><span>Supported here</span><h3>Two scale-free signatures</h3><p>Both posterior EEG and provisional EOG channels have condition-level spectra compatible with 1/f-like structure.</p></article>
        <article className="cannot-say"><span>Not established</span><h3>One shared process</h3><p>The full six-condition EEG↔EOG rank relation is near zero; EOG exponent also tracks amplitude, so resemblance is not identity.</p></article>
        <article className="next-test"><span>Productive question</span><h3>Does the relation repeat?</h3><p>Repeat the protocol with synchronized markers, counterbalanced order, more participants, and reports collected at defined moments.</p></article>
      </div>
    </div>
  );
}

function ObservationStrip({ activeNav, selected, compared, compareKey }) {
  let heading = compareKey ? "Active comparison" : "Patterns worth testing";
  let items;
  if (activeNav === "Results overview") {
    heading = "Pilot conclusion";
    items = [
      ["01", <><strong>Context mattered descriptively:</strong> Video and Nature had steeper reviewed EEG aggregates than baseline.</>],
      ["02", <><strong>Modality resemblance remained unproven:</strong> the six-condition EEG↔EOG relation was ρ 0.09.</>],
    ];
  } else if (activeNav === "Recording map") {
    heading = "How to read the anatomy";
    items = [
      ["EEG", <><strong>O1/O2</strong> sample posterior occipital activity; the rest of the brain is anatomical context, not measured coverage.</>],
      ["EOG", <><strong>EOG-A/B</strong> are provisional ocular channels; glow follows the measured temporal exponent, not eye position.</>],
    ];
  } else if (activeNav === "EEG ↔ EOG") {
    heading = "What the relation says";
    items = [
      ["ρ", <><strong>All six conditions: 0.09.</strong> EEG and EOG condition ranks do not move together overall.</>],
      ["ALT", <><strong>EOG exponent tracks EOG amplitude</strong> (ρ 0.89), a major alternative explanation for the apparent fractal structure.</>],
    ];
  } else if (compareKey) {
    items = [
      ["Δχ", <><strong>{selected.label}</strong> differs from {compared.label} by <strong>{(selected.exponent - compared.exponent).toFixed(2)}</strong>.</>],
      ["QC", selected.accepted === 0 || compared.accepted === 0 ? "At least one estimate has no strict accepted windows; treat this as exploratory." : "Both estimates include strict accepted windows, but this remains a single-participant comparison."],
    ];
  } else if (activeNav === "Video drift") {
    items = [
      ["01", <>Median exponent rises from <strong>1.26 to 1.64</strong> across the provisional repeats.</>],
      ["02", <>EOG-flagged windows fall from <strong>94% to 26%</strong>, complicating any experiential reading.</>],
    ];
  } else {
    items = [
      ["01", <>Eyes closed shows the clearest alpha organization: <strong>100% peak detection</strong> in accepted windows.</>],
      ["02", <>Video and Nature have steeper aggregate exponents than baseline, but <strong>order and artifact remain confounds.</strong></>],
    ];
  }
  return <section className="observation-strip"><div className="observation-heading"><Pulse weight="fill" /><span>{heading}</span></div>{items.map(([label, text]) => <article key={label}><span>{label}</span><p>{text}</p></article>)}</section>;
}

export function App() {
  const [activeNav, setActiveNav] = useState("Results overview");
  const [selectedKey, setSelectedKey] = useState("video");
  const [selectedDomain, setSelectedDomain] = useState("external");
  const [selectedInternalKey, setSelectedInternalKey] = useState("imagined-fractals");
  const [compareKey, setCompareKey] = useState(null);
  const [selectedRepeat, setSelectedRepeat] = useState(3);
  const [videoProgress, setVideoProgress] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [mapProgress, setMapProgress] = useState(0);
  const [mapPlaying, setMapPlaying] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState("O1");
  const selected = CONDITIONS.find((condition) => condition.key === selectedKey) || CONDITIONS[2];
  const selectedInternal = INTERNAL_PROTOCOL.find((condition) => condition.key === selectedInternalKey) || INTERNAL_PROTOCOL[2];
  const compared = CONDITIONS.find((condition) => condition.key === compareKey);
  const repeat = VIDEO_REPEATS.find((item) => item.id === selectedRepeat) || VIDEO_REPEATS[2];
  const copy = VIEW_COPY[activeNav];
  const mapSeries = RECORDING_SERIES[selectedKey] || RECORDING_SERIES.video;
  const mapIndex = Math.min(mapSeries.eeg.length - 1, Math.max(0, Math.round(mapProgress)));
  const currentMapEeg = mapSeries.eeg[mapIndex];
  const currentMapEog = mapSeries.eog[mapIndex];
  const regionInfo = {
    O1: "Left posterior occipital EEG channel, positioned over visual cortex.",
    O2: "Right posterior occipital EEG channel, paired with O1 for the reviewed posterior estimate.",
    "EOG-A": "First analyzed ocular channel. Its physical horizontal/vertical identity remains provisional.",
    "EOG-B": "Second analyzed ocular channel. Its physical horizontal/vertical identity remains provisional.",
  }[selectedRegion];
  const panelKicker = activeNav === "Results overview" ? "The short version" : activeNav === "Recording map" ? "Recorded anatomy" : activeNav === "EEG ↔ EOG" ? "Cross-modality test" : activeNav === "Video drift" ? "Time-linked field" : activeNav === "Sensitivity" ? "Robustness layer" : "Measured field";
  const panelTitle = activeNav === "Results overview" ? "What changed—and what did not" : activeNav === "Recording map" ? "O1/O2 + provisional EOG-A/B" : activeNav === "EEG ↔ EOG" ? "Do the two spectra move together?" : activeNav === "Condition field" ? "Aperiodic exponent × alpha peak power" : activeNav === "Video drift" ? "Median exponent across provisional repeats" : activeNav === "Sensitivity" ? "Raw → EOG-regressed exponent" : activeNav === "Methods" ? "Five-stage analytical chain" : "Claim boundary";

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setVideoProgress((value) => {
        const next = value + 0.025;
        if (next >= 2.2) {
          setPlaying(false);
          setSelectedRepeat(3);
          return 2;
        }
        setSelectedRepeat(Math.min(3, Math.floor(next) + 1));
        return next;
      });
    }, 55);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (!mapPlaying || activeNav !== "Recording map") return undefined;
    const timer = window.setInterval(() => {
      setMapProgress((value) => value >= mapSeries.eeg.length - 1 ? 0 : value + 0.035);
    }, 55);
    return () => window.clearInterval(timer);
  }, [activeNav, mapPlaying, mapSeries.eeg.length]);

  useEffect(() => {
    setMapProgress(0);
  }, [selectedKey]);

  const selectNav = (label) => {
    setActiveNav(label);
    if (label === "Video drift") setSelectedKey("video");
    if (label !== "Results overview") setSelectedDomain("external");
  };

  const reset = () => {
    setActiveNav("Results overview");
    setSelectedKey("video");
    setSelectedDomain("external");
    setSelectedInternalKey("imagined-fractals");
    setCompareKey(null);
    setSelectedRepeat(3);
    setVideoProgress(2);
    setPlaying(false);
    setMapProgress(0);
    setMapPlaying(true);
    setSelectedRegion("O1");
  };

  const toggleCompare = () => {
    if (compareKey) setCompareKey(null);
    else setCompareKey(selectedKey === "eyes-open" ? "eyes-closed" : "eyes-open");
  };

  return (
    <div className={activeNav === "Results overview" ? "app-shell simple-overview-shell" : "app-shell"}>
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><Sparkle weight="fill" /></div><div><strong>Living Field</strong><span>signal · context · relation</span></div></div>
        <nav className="primary-nav" aria-label="Living Field sections"><div className="nav-label">Explore</div>{NAV_ITEMS.map(({ key, label, icon: Icon }) => <button key={key} type="button" className={activeNav === key ? "nav-item active" : "nav-item"} onClick={() => selectNav(key)}><Icon weight={activeNav === key ? "fill" : "regular"} /><span>{label}</span></button>)}</nav>
        <div className="sidebar-study"><span>Current study</span><strong>Environment study 01</strong><small>1 participant · O1/O2 · 250 Hz</small><div className="study-quality"><i /> Qualified with limits</div></div>
        <div className="project-actions"><button type="button" onClick={() => window.alert("This visual is linked to the reviewed June 5 OpenBCI analysis.")}><FileArrowUp /><span>Study source</span></button><button type="button" onClick={reset}><ArrowCounterClockwise /><span>Reset field</span></button></div>
        <div className="sidebar-boundary"><Info weight="fill" /><span>This is a hypothesis explorer, not a consciousness detector.</span></div>
      </aside>

      <main className="workspace">
        <header className="topbar"><div><div className="eyebrow"><span /> {copy.kicker}</div><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><div className="topbar-actions"><span className="mode-badge"><Eye /> Evidence view</span><button className="icon-button" type="button" title="Export current view" onClick={() => window.print()}><DownloadSimple /></button></div></header>

        <section className={`atlas-panel view-${activeNav.toLowerCase().replaceAll(" ", "-")}`} aria-label={activeNav}>
          <div className="atlas-title-row"><div><span className="section-kicker">{panelKicker}</span><h2>{panelTitle}</h2></div>{activeNav === "Recording map" && <div className="legend"><span><i className="legend-report" /> O1/O2 EEG</span><span><i className="legend-event" /> EOG-A/B</span><span><i className="legend-path" /> Current time bin</span></div>}{activeNav === "EEG ↔ EOG" && <div className="legend"><span><i className="legend-report" /> Qualified EEG</span><span><i className="legend-hollow" /> Fragile EEG</span><span><i className="legend-path" /> Same condition</span></div>}{activeNav === "Condition field" && <div className="legend"><span><i className="legend-path" /> Accepted window</span><span><i className="legend-report" /> Aggregate</span><span><i className="legend-hollow" /> Aggregate only</span></div>}{activeNav === "Video drift" && <div className="legend"><span><i className="legend-path" /> Exponent drift</span><span><i className="legend-event" /> EOG burden</span></div>}{activeNav === "Sensitivity" && <div className="legend"><span><i className="legend-report" /> Raw</span><span><i className="legend-hollow" /> EOG-regressed</span></div>}</div>

          {activeNav === "Results overview" && <ResultsOverview onOpenMap={() => selectNav("Recording map")} />}

          {activeNav === "Recording map" && <><div className="condition-tabs map-condition-tabs" role="tablist" aria-label="Recording conditions">{CONDITIONS.map((condition) => <button key={condition.key} type="button" className={selectedKey === condition.key ? "active" : ""} onClick={() => { setSelectedKey(condition.key); setMapProgress(0); }}><i style={{ background: condition.color }} />{condition.label}<small>{RECORDING_SERIES[condition.key].windows}w</small></button>)}</div><div className="field-stage recording-map-stage"><RecordingMapCanvas selectedKey={selectedKey} progress={mapProgress} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} /><div className="map-channel-note"><Info weight="fill" /> EOG physical H/V mapping remains provisional</div></div><div className="map-controls"><button type="button" className="play-button" onClick={() => setMapPlaying((value) => !value)} aria-label={mapPlaying ? "Pause recording map" : "Play recording map"}>{mapPlaying ? <Pause weight="fill" /> : <Play weight="fill" />}</button><span>{`W${mapIndex + 1}`}</span><input aria-label="Recording map progress" type="range" min="0" max={Math.max(0, mapSeries.eeg.length - 1)} step="0.01" value={mapProgress} onChange={(event) => { setMapProgress(Number(event.target.value)); setMapPlaying(false); }} style={{ "--progress": `${mapSeries.eeg.length > 1 ? (mapProgress / (mapSeries.eeg.length - 1)) * 100 : 0}%` }} /><strong>{selected.label}</strong><small>EEG χ {currentMapEeg.toFixed(2)} · EOG χ {currentMapEog.toFixed(2)}</small></div></>}

          {activeNav === "EEG ↔ EOG" && <><div className="relation-summary"><div><span>All six conditions</span><strong>ρ 0.09</strong><small>little rank alignment · descriptive n=6</small></div><p>Each line joins the <strong>same condition</strong> across two separately scaled spectra. Position is comparable within a lane, not across lanes.</p><div className="channel-warning"><Info weight="fill" /><span>EOG-A/B axes provisional</span></div></div><div className="field-stage relation-stage"><FractalRelationCanvas selectedKey={selectedKey} onSelect={setSelectedKey} /><div className="provisional-note">EOG is 1/f-like; resemblance does not establish a shared generator</div></div></>}

          {activeNav === "Condition field" && <><div className="condition-tabs" role="tablist" aria-label="Conditions">{CONDITIONS.map((condition) => <button key={condition.key} type="button" className={selectedKey === condition.key ? "active" : ""} onClick={() => setSelectedKey(condition.key)}><i style={{ background: condition.color }} />{condition.label}<small>{condition.exponent.toFixed(2)}</small></button>)}</div><div className="field-stage"><ConditionCanvas selectedKey={selectedKey} compareKey={compareKey} onSelect={setSelectedKey} /><div className="field-readout field-readout-left"><span>lower alpha power</span><strong>diffuse / undetected</strong></div><div className="field-readout field-readout-right"><span>higher alpha power</span><strong>organized peak</strong></div></div></>}

          {activeNav === "Video drift" && <><div className="repeat-tabs">{VIDEO_REPEATS.map((item) => <button type="button" key={item.id} className={selectedRepeat === item.id ? "active" : ""} onClick={() => { setSelectedRepeat(item.id); setVideoProgress(item.id - 1); setPlaying(false); }}><span>{item.label}</span><strong>χ {item.exponent.toFixed(2)}</strong><small>{item.accepted}/{item.total} accepted</small></button>)}</div><div className="field-stage"><VideoCanvas selectedRepeat={selectedRepeat} progress={videoProgress} onSelect={(id) => { setSelectedRepeat(id); setVideoProgress(id - 1); }} /><div className="provisional-note">Provisional segmentation · stimulus markers were absent</div></div><div className="timeline-controls"><button type="button" className="play-button" onClick={() => { if (!playing && videoProgress >= 2) setVideoProgress(0); setPlaying((value) => !value); }} aria-label={playing ? "Pause drift" : "Replay drift"}>{playing ? <Pause weight="fill" /> : <Play weight="fill" />}</button><span className="time-current">R{Math.min(3, Math.floor(videoProgress) + 1)}</span><div className="timeline-wrap"><input aria-label="Video segment progress" type="range" min="0" max="2" step="0.01" value={Math.min(2, videoProgress)} onChange={(event) => { const value = Number(event.target.value); setVideoProgress(value); setSelectedRepeat(Math.min(3, Math.floor(value) + 1)); setPlaying(false); }} style={{ "--progress": `${(Math.min(2, videoProgress) / 2) * 100}%` }} /></div><span className="time-total">R3</span></div></>}

          {activeNav === "Sensitivity" && <><div className="sensitivity-callout"><span>Solid = raw</span><span>Hollow = EOG-regressed</span><strong>{selected.label}: Δχ {(selected.correctedExponent - selected.rawExponent).toFixed(2)}</strong></div><div className="field-stage sensitivity-stage"><SensitivityCanvas selectedKey={selectedKey} onSelect={setSelectedKey} /></div></>}
          {activeNav === "Methods" && <MethodsView />}
          {activeNav === "Boundary" && <BoundaryView />}
        </section>

        {activeNav !== "Results overview" && <ObservationStrip activeNav={activeNav} selected={selected} compared={compared} compareKey={compareKey} />}
        <footer className="research-boundary"><Info weight="fill" /><p><strong>Aperiodic activity is not consciousness.</strong> This view tests relations among neural dynamics and recording contexts; it does not collapse them into an identity.</p></footer>
      </main>

      <aside className="inspector">
        <div className="inspector-heading"><div><span className="section-kicker">{activeNav === "Recording map" ? "Selected recording site" : activeNav === "Video drift" ? `Video · repeat ${selectedRepeat}` : activeNav === "EEG ↔ EOG" ? "Linked condition" : "Selected condition"}</span><h2>{activeNav === "Recording map" ? selectedRegion : activeNav === "Video drift" ? repeat.label : selected.label}</h2></div><div className={`reliability reliability-${qualityLabel(selected).replaceAll(" ", "-")}`}><i /> {activeNav === "Recording map" ? `W${mapIndex + 1}` : activeNav === "Video drift" ? repeat.r2.toFixed(2) : activeNav === "EEG ↔ EOG" ? selected.eogR2.toFixed(2) : selected.r2.toFixed(2)} <span>{activeNav === "Recording map" ? selected.label : activeNav === "EEG ↔ EOG" ? "EOG fit" : activeNav === "Video drift" ? (repeat.r2 >= 0.8 ? "qualified" : "fragile") : qualityLabel(selected)}</span></div></div>
        <div className="window-note"><ClockCounterClockwise /> {activeNav === "Recording map" ? `${mapSeries.windows} reviewed windows · display bin ${mapIndex + 1}` : activeNav === "Video drift" ? `${repeat.accepted} of ${repeat.total} strict windows accepted` : activeNav === "EEG ↔ EOG" ? `${selected.duration} · same recording context, two modalities` : `${selected.duration} · ${selected.accepted} of ${selected.total} strict windows accepted`}</div>
        <section className="inspector-card measured-card"><div className="card-label"><span>01</span> {activeNav === "Recording map" ? "Current response" : activeNav === "EEG ↔ EOG" ? "Linked spectra" : "Measured spectrum"}</div><div className="metric-grid"><div><span>{activeNav === "Recording map" ? "EEG exponent" : activeNav === "EEG ↔ EOG" ? "EEG exponent" : "Exponent"}</span><strong>{formatNumber(activeNav === "Recording map" ? currentMapEeg : activeNav === "Video drift" ? repeat.exponent : selected.exponent)}</strong><small>χ · 2–40 Hz</small></div><div><span>{activeNav === "Recording map" ? "EOG exponent" : activeNav === "EEG ↔ EOG" ? "EOG exponent" : "Alpha PW"}</span><strong>{activeNav === "Recording map" ? formatNumber(currentMapEog) : activeNav === "EEG ↔ EOG" ? formatNumber(selected.eogExponent) : activeNav === "Video drift" ? "—" : formatNumber(selected.alphaPw)}{selected.alphaPw != null && activeNav !== "Recording map" && activeNav !== "Video drift" && activeNav !== "EEG ↔ EOG" && <em>log</em>}</strong><small>{activeNav === "Recording map" || activeNav === "EEG ↔ EOG" ? "0.5–15 Hz" : activeNav === "Video drift" ? "segment view" : `${formatPct(selected.alphaDetection)} detected`}</small></div></div><div className="quality-row"><span>{activeNav === "Recording map" ? "Current EEG screen" : activeNav === "EEG ↔ EOG" ? "EEG / EOG reliability" : "Model reliability"}</span><strong>{activeNav === "Recording map" ? (mapSeries.quality[mapIndex] > 0 ? "includes accepted data" : "did not pass strict screen") : activeNav === "EEG ↔ EOG" ? `R² ${formatNumber(selected.r2)} / ${formatNumber(selected.eogR2)}` : `R² ${formatNumber(activeNav === "Video drift" ? repeat.r2 : selected.r2)}`}</strong></div><p>{activeNav === "Recording map" ? "Glow intensity follows the reviewed temporal exponent at this window. It is not a map of activation across the whole brain." : activeNav === "EEG ↔ EOG" ? "The exponents come from different channels and fit ranges. Compare their condition patterns, not their raw magnitudes." : "Posterior channels O1 + O2. The mark describes a spectral estimate, not a mental state."}</p></section>
        <section className="inspector-card report-card"><div className="card-label"><span>02</span> {activeNav === "Recording map" ? "Recording site" : activeNav === "EEG ↔ EOG" ? "Ocular context" : "Recording context"}</div>{activeNav === "Recording map" ? <><blockquote>“{regionInfo}”</blockquote><dl><div><dt>Condition</dt><dd>{selected.label}</dd></div><div><dt>Display bin</dt><dd>{mapIndex + 1} of {mapSeries.eeg.length}</dd></div><div><dt>Coverage</dt><dd>{selectedRegion.startsWith("O") ? "posterior only" : "ocular only"}</dd></div></dl></> : activeNav === "Video drift" ? <><blockquote>“Provisional segment {repeat.id} of the long video recording.”</blockquote><dl><div><dt>EOG flagged</dt><dd>{formatPct(repeat.eogRate)}</dd></div><div><dt>Strict retention</dt><dd>{formatPct(repeat.accepted / repeat.total)}</dd></div><div><dt>Timing</dt><dd>stimulus-length proxy</dd></div></dl></> : activeNav === "EEG ↔ EOG" ? <><blockquote>“The EOG spectrum is steep and 1/f-like, but that alone does not make it neural or fractal in the same sense as EEG.”</blockquote><dl><div><dt>EOG RMS</dt><dd>{formatNumber(selected.eogRms)} µV</dd></div><div><dt>EOG fit</dt><dd>R² {formatNumber(selected.eogR2)}</dd></div><div><dt>Axes</dt><dd>provisional A/B</dd></div></dl></> : <><blockquote>“{selected.note}”</blockquote><dl><div><dt>Condition</dt><dd>{selected.label}</dd></div><div><dt>Strict retention</dt><dd>{formatPct(selected.accepted / selected.total)}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div></dl></>}</section>
        <section className="inspector-card hypothesis-card"><div className="card-label"><span>03</span> Hypothesis to test</div><h3>{activeNav === "Recording map" ? "Do these traces couple?" : activeNav === "EEG ↔ EOG" ? "Coupled scale-free dynamics?" : activeNav === "Video drift" ? "Late spectral change" : selected.accepted === 0 ? "Estimate needs replication" : "Context-linked organization"}</h3><p>{activeNav === "Recording map" ? "Does within-recording EEG↔EOG coordination survive ocular-amplitude controls and repeat across participants?" : activeNav === "EEG ↔ EOG" ? "Do EEG and EOG exponents covary within synchronized windows after controlling for ocular amplitude, blinks, drift and condition order?" : activeNav === "Video drift" ? "Would this late increase remain after synchronized stimulus markers and stronger artifact control?" : selected.accepted === 0 ? "Does this aggregate position reappear when clean individual windows can be recovered?" : "Does this condition-linked field position recur across counterbalanced sessions and participants?"}</p><div className="hypothesis-status"><i /> provisional relation</div></section>
        <div className="inspector-actions"><button type="button" className="primary-action" onClick={activeNav === "Recording map" ? () => setSelectedRegion(selectedRegion.startsWith("O") ? "EOG-A" : "O1") : activeNav === "EEG ↔ EOG" ? () => setSelectedKey("eyes-open") : toggleCompare}><CirclesThreePlus weight="fill" /> {activeNav === "Recording map" ? (selectedRegion.startsWith("O") ? "Jump to eye channels" : "Jump to O1/O2") : activeNav === "EEG ↔ EOG" ? "Inspect eyes-open baseline" : compareKey ? "End comparison" : "Compare with baseline"}</button><button type="button" className="secondary-action" onClick={() => selectNav(activeNav === "Sensitivity" ? "Condition field" : "Sensitivity")}><Play weight="fill" /> {activeNav === "Sensitivity" ? "Return to field" : "Challenge with EOG regression"}</button></div>
        <div className="interpretation-note"><span>Interpretation discipline</span><p>Measured pattern → recording context → testable relation. Each remains distinct from conscious experience.</p></div>
      </aside>
    </div>
  );
}
