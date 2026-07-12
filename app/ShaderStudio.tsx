"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { DEFAULT_FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

type Mode = "form" | "flow" | "matter" | "light" | "lens" | "patch";

type StudioValues = {
  style: number;
  seed: number;
  speed: number;
  motion: number;
  scale: number;
  zoom: number;
  rotation: number;
  warp: number;
  turbulence: number;
  detail: number;
  symmetry: number;
  twist: number;
  density: number;
  softness: number;
  contour: number;
  exposure: number;
  contrast: number;
  saturation: number;
  glow: number;
  grain: number;
  vignette: number;
  hue: number;
  lightAngle: number;
  pointerForce: number;
  pixelate: number;
  aberration: number;
  palette: [string, string, string, string];
};

type MacroValues = {
  pulse: number;
  twist: number;
  grain: number;
  heat: number;
  drift: number;
  space: number;
};

type NumericKey = Exclude<keyof StudioValues, "palette">;
type MacroKey = keyof MacroValues;

const DEFAULTS: StudioValues = {
  style: 0,
  seed: 8417,
  speed: 0.34,
  motion: 0.62,
  scale: 2.45,
  zoom: 0.92,
  rotation: 0,
  warp: 0.72,
  turbulence: 0.68,
  detail: 5,
  symmetry: 6,
  twist: 0.34,
  density: 6.2,
  softness: 0.24,
  contour: 0.52,
  exposure: 1.28,
  contrast: 1.18,
  saturation: 1.16,
  glow: 0.68,
  grain: 0.035,
  vignette: 0.28,
  hue: 0.04,
  lightAngle: -0.72,
  pointerForce: 0.52,
  pixelate: 0,
  aberration: 0.2,
  palette: ["#06161c", "#21d5c3", "#d8ff69", "#ff6957"],
};

const DEFAULT_MACROS: MacroValues = {
  pulse: 0.35,
  twist: 0.28,
  grain: 0.12,
  heat: 0.18,
  drift: 0.32,
  space: 0.22,
};

const PRESETS: Array<{
  name: string;
  note: string;
  values: Partial<StudioValues> & { palette: StudioValues["palette"] };
}> = [
  {
    name: "Ion Garden",
    note: "bio-electric bloom",
    values: {
      style: 0,
      seed: 8417,
      symmetry: 6,
      warp: 0.72,
      twist: 0.34,
      palette: ["#06161c", "#21d5c3", "#d8ff69", "#ff6957"],
    },
  },
  {
    name: "Velvet Cells",
    note: "slow cellular velvet",
    values: {
      style: 1,
      seed: 2213,
      scale: 3.1,
      symmetry: 3,
      softness: 0.42,
      glow: 0.86,
      palette: ["#120822", "#641cff", "#ef8dff", "#ffd37a"],
    },
  },
  {
    name: "Topo Signal",
    note: "synthetic terrain scan",
    values: {
      style: 2,
      seed: 6029,
      detail: 6,
      density: 8.8,
      contour: 0.84,
      symmetry: 1,
      palette: ["#05070c", "#163a59", "#5de6ff", "#fff7d6"],
    },
  },
  {
    name: "Solar Choir",
    note: "radiant orbital rings",
    values: {
      style: 3,
      seed: 1941,
      speed: 0.52,
      symmetry: 9,
      twist: 0.72,
      glow: 1.22,
      palette: ["#150804", "#7c1f07", "#ff8f1f", "#fff2a1"],
    },
  },
  {
    name: "Cold Weave",
    note: "polar interference",
    values: {
      style: 4,
      seed: 9901,
      warp: 1.1,
      symmetry: 4,
      density: 5.4,
      aberration: 0.7,
      palette: ["#050613", "#2e37d9", "#44d4ff", "#edfbff"],
    },
  },
];

const PARAM_RANGES: Record<NumericKey, [number, number]> = {
  style: [0, 4],
  seed: [1, 9999],
  speed: [-1.5, 1.5],
  motion: [0, 2],
  scale: [0.4, 7],
  zoom: [0.25, 2.2],
  rotation: [-Math.PI, Math.PI],
  warp: [0, 2.4],
  turbulence: [0, 1.5],
  detail: [1, 7],
  symmetry: [1, 14],
  twist: [-2, 2],
  density: [1, 14],
  softness: [0.02, 1],
  contour: [0, 1.5],
  exposure: [0.35, 2.6],
  contrast: [0.5, 2],
  saturation: [0, 2],
  glow: [0, 1.8],
  grain: [0, 0.22],
  vignette: [0, 0.85],
  hue: [-1, 1],
  lightAngle: [-Math.PI, Math.PI],
  pointerForce: [0, 1.8],
  pixelate: [0, 36],
  aberration: [0, 2],
};

const MODE_ITEMS: Array<{ id: Mode; glyph: string; label: string }> = [
  { id: "form", glyph: "◌", label: "Form" },
  { id: "flow", glyph: "≈", label: "Flow" },
  { id: "matter", glyph: "◆", label: "Matter" },
  { id: "light", glyph: "✦", label: "Light" },
  { id: "lens", glyph: "◉", label: "Lens" },
  { id: "patch", glyph: "{·}", label: "Patch" },
];

const STYLE_OPTIONS = ["Vapor", "Cells", "Topo", "Rings", "Weave"];

function srgbHexToLinear(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const raw = clean.length === 3 ? clean.split("").map((x) => x + x).join("") : clean;
  const channels = [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16) / 255);
  return channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${[channel(0), channel(8), channel(4)]
    .map((value) => Math.round(value * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function downloadText(filename: string, text: string, type = "text/plain") {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([text], { type }));
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function ShaderCanvas({
  values,
  macros,
  paused,
  source,
  onFps,
  onTime,
  onCompileError,
  captureRef,
  seekRef,
}: {
  values: StudioValues;
  macros: MacroValues;
  paused: boolean;
  source: string;
  onFps: (fps: number) => void;
  onTime: (time: number) => void;
  onCompileError: (error: string | null) => void;
  captureRef: MutableRefObject<(() => void) | null>;
  seekRef: MutableRefObject<((time: number) => void) | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef({ values, macros, paused });
  const sourceRef = useRef(source);
  const appliedSourceRef = useRef("");
  const recompileRef = useRef<((nextSource: string) => void) | null>(null);
  const callbackRef = useRef({ onFps, onTime, onCompileError });

  useEffect(() => {
    liveRef.current = { values, macros, paused };
  }, [values, macros, paused]);

  useEffect(() => {
    callbackRef.current = { onFps, onTime, onCompileError };
  }, [onFps, onTime, onCompileError]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      callbackRef.current.onCompileError("WebGL2 is not available in this browser.");
      return;
    }

    let program: WebGLProgram | null = null;
    let animationFrame = 0;
    let lastFrame = performance.now();
    let elapsed = 0;
    let fpsStart = lastFrame;
    let fpsFrames = 0;
    let lastTimeReport = 0;
    let contextLost = false;
    let uniformCache = new Map<string, WebGLUniformLocation | null>();
    const pointer = { x: 0, y: 0, down: 0, speed: 0, px: 0, py: 0, stamp: lastFrame };
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const compileShader = (type: number, shaderSource: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Unable to create a GPU shader.");
      gl.shaderSource(shader, shaderSource);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader) || "Unknown shader compilation error.";
        gl.deleteShader(shader);
        throw new Error(error);
      }
      return shader;
    };

    const compileProgram = (fragmentSource: string) => {
      const vertex = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
      const nextProgram = gl.createProgram();
      if (!nextProgram) throw new Error("Unable to create a GPU program.");
      gl.attachShader(nextProgram, vertex);
      gl.attachShader(nextProgram, fragment);
      gl.linkProgram(nextProgram);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(nextProgram) || "Unknown shader link error.";
        gl.deleteProgram(nextProgram);
        throw new Error(error);
      }
      return nextProgram;
    };

    const recompile = (nextSource: string) => {
      try {
        const nextProgram = compileProgram(nextSource);
        const previous = program;
        program = nextProgram;
        uniformCache = new Map();
        appliedSourceRef.current = nextSource;
        callbackRef.current.onCompileError(null);
        if (previous) gl.deleteProgram(previous);
      } catch (error) {
        callbackRef.current.onCompileError(error instanceof Error ? error.message : String(error));
      }
    };

    recompileRef.current = recompile;
    recompile(sourceRef.current);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const getLocation = (name: string) => {
      if (!program) return null;
      if (!uniformCache.has(name)) uniformCache.set(name, gl.getUniformLocation(program, name));
      return uniformCache.get(name) ?? null;
    };

    const setFloat = (name: string, value: number) => {
      if (!program) return;
      const location = getLocation(name);
      if (location !== null) gl.uniform1f(location, value);
    };

    const setInt = (name: string, value: number) => {
      if (!program) return;
      const location = getLocation(name);
      if (location !== null) gl.uniform1i(location, value);
    };

    const draw = (timestamp: number) => {
      if (contextLost) return;
      resize();
      const dt = Math.min((timestamp - lastFrame) / 1000, 0.1);
      lastFrame = timestamp;
      const live = liveRef.current;
      if (!live.paused) elapsed += dt;

      if (program) {
        const { values: v, macros: m } = live;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        const resolution = getLocation("uResolution");
        if (resolution !== null) gl.uniform2f(resolution, canvas.width, canvas.height);
        const pointerLocation = getLocation("uPointer");
        if (pointerLocation !== null) gl.uniform4f(pointerLocation, pointer.x, pointer.y, pointer.down, pointer.speed);
        setFloat("uTime", elapsed);
        setFloat("uSeed", v.seed);
        setFloat("uSpeed", v.speed + m.drift * 0.24);
        setFloat("uMotion", v.motion + m.drift * 0.7);
        setFloat("uScale", v.scale);
        setFloat("uZoom", Math.max(0.12, v.zoom + m.space * 0.3));
        setFloat("uRotation", v.rotation);
        setFloat("uWarp", v.warp + m.drift * 0.55);
        setFloat("uTurbulence", v.turbulence);
        setFloat("uDetail", v.detail);
        setFloat("uSymmetry", v.symmetry + Math.round(m.space * 3));
        setFloat("uTwist", v.twist + m.twist * 1.25);
        setFloat("uDensity", v.density + m.pulse * 2.8);
        setFloat("uSoftness", v.softness);
        setFloat("uContour", v.contour);
        setFloat("uExposure", v.exposure + m.heat * 0.42);
        setFloat("uContrast", v.contrast);
        setFloat("uSaturation", v.saturation + m.heat * 0.3);
        setFloat("uGlow", v.glow + m.pulse * 0.66);
        setFloat("uGrain", v.grain + m.grain * 0.09);
        setFloat("uVignette", v.vignette);
        setFloat("uHue", v.hue + m.heat * 0.16);
        setFloat("uLightAngle", v.lightAngle);
        setFloat("uPointerForce", v.pointerForce);
        setFloat("uPixelate", v.pixelate);
        setFloat("uAberration", v.aberration);
        setInt("uStyle", v.style);
        v.palette.forEach((color, index) => {
          const location = getLocation(`uColor${index}`);
          if (location !== null) gl.uniform3fv(location, srgbHexToLinear(color));
        });
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      fpsFrames += 1;
      if (timestamp - fpsStart > 600) {
        callbackRef.current.onFps(Math.round((fpsFrames * 1000) / (timestamp - fpsStart)));
        fpsStart = timestamp;
        fpsFrames = 0;
      }
      if (timestamp - lastTimeReport > 100) {
        callbackRef.current.onTime(elapsed % 24);
        lastTimeReport = timestamp;
      }
      pointer.speed *= Math.exp(-dt * 8);
      animationFrame = requestAnimationFrame(draw);
    };

    const movePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = (1 - (event.clientY - rect.top) / rect.height) * 2 - 1;
      const aspect = rect.width / Math.max(1, rect.height);
      const now = performance.now();
      const delta = Math.max(8, now - pointer.stamp);
      pointer.speed = Math.min(1.5, Math.hypot(nx - pointer.px, ny - pointer.py) * (180 / delta));
      pointer.px = nx;
      pointer.py = ny;
      pointer.stamp = now;
      pointer.x = nx * (aspect > 1 ? aspect : 1);
      pointer.y = ny * (aspect < 1 ? 1 / aspect : 1);
    };

    const pointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      pointer.down = event.pressure || 1;
      movePointer(event);
    };
    const pointerUp = () => {
      pointer.down = 0;
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(animationFrame);
      callbackRef.current.onCompileError("Graphics context paused. Restoring…");
    };
    const handleContextRestored = () => {
      window.location.reload();
    };

    canvas.addEventListener("pointermove", movePointer);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    seekRef.current = (time: number) => {
      elapsed = Math.max(0, time);
      callbackRef.current.onTime(elapsed % 24);
    };

    captureRef.current = () => {
      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) return;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const flipped = new Uint8ClampedArray(pixels.length);
      const rowSize = width * 4;
      for (let row = 0; row < height; row += 1) {
        flipped.set(pixels.subarray(row * rowSize, (row + 1) * rowSize), (height - row - 1) * rowSize);
      }
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      const context = exportCanvas.getContext("2d");
      if (!context) return;
      context.putImageData(new ImageData(flipped, width, height), 0, 0);
      exportCanvas.toBlob((blob) => {
        if (!blob) return;
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `lumen-${liveRef.current.values.seed}.png`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
      }, "image/png");
    };

    animationFrame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("pointermove", movePointer);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      if (program) gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      recompileRef.current = null;
      captureRef.current = null;
      seekRef.current = null;
    };
  }, [captureRef, seekRef]);

  useEffect(() => {
    sourceRef.current = source;
    if (source !== appliedSourceRef.current) recompileRef.current?.(source);
  }, [source]);

  return <canvas ref={canvasRef} className="shader-canvas" aria-label="Interactive procedural shader canvas" />;
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onGestureStart,
  onGestureEnd,
  defaultValue,
  format = (number) => number.toFixed(step < 0.1 ? 2 : 1),
  locked,
  onToggleLock,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  defaultValue: number;
  format?: (value: number) => string;
  locked: boolean;
  onToggleLock: () => void;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <div className={`range-control ${locked ? "is-locked" : ""}`}>
      <div className="control-meta">
        <div className="control-name">
          <button
            className="mod-socket"
            type="button"
            title="Modulation input"
            aria-label={`Modulate ${label}`}
          />
          <span>{label}</span>
        </div>
        <div className="control-value-wrap">
          <output>{format(value)}</output>
          <button
            type="button"
            className="lock-button"
            onClick={onToggleLock}
            title={locked ? "Unlock from mutation" : "Lock from mutation"}
            aria-label={`${locked ? "Unlock" : "Lock"} ${label}`}
          >
            {locked ? "▣" : "□"}
          </button>
        </div>
      </div>
      <input
        className="range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--range-progress": `${progress}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerDown={onGestureStart}
        onPointerUp={onGestureEnd}
        onPointerCancel={onGestureEnd}
        onDoubleClick={() => onChange(defaultValue)}
        aria-label={label}
      />
    </div>
  );
}

function MacroKnob({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const angle = -132 + value * 264;
  return (
    <label className="macro-control" htmlFor={id}>
      <span className="macro-knob-shell">
        <span
          className="macro-knob-fill"
          style={{ "--macro-fill": `${value * 100}%` } as CSSProperties}
        />
        <span className="macro-tick" style={{ transform: `rotate(${angle}deg)` }} />
        <input
          id={id}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={`${label} macro`}
        />
      </span>
      <span>{label}</span>
      <output>{Math.round(value * 100)}</output>
    </label>
  );
}

function Module({
  title,
  badge,
  children,
  defaultOpen = true,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`parameter-module ${open ? "is-open" : ""}`}>
      <button className="module-header" type="button" onClick={() => setOpen((value) => !value)}>
        <span className="module-live-dot" />
        <span>{title}</span>
        {badge && <span className="module-badge">{badge}</span>}
        <span className="module-chevron">⌄</span>
      </button>
      {open && <div className="module-body">{children}</div>}
    </section>
  );
}

export default function ShaderStudio() {
  const [values, setValues] = useState<StudioValues>(DEFAULTS);
  const [macros, setMacros] = useState<MacroValues>(DEFAULT_MACROS);
  const [mode, setMode] = useState<Mode>("form");
  const [paused, setPaused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [markers, setMarkers] = useState<number[]>([]);
  const [playhead, setPlayhead] = useState(0);
  const [fps, setFps] = useState(60);
  const [presetName, setPresetName] = useState("Ion Garden");
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [mutateOpen, setMutateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [locked, setLocked] = useState<Set<string>>(() => new Set());
  const [appliedSource, setAppliedSource] = useState(DEFAULT_FRAGMENT_SHADER);
  const [editorSource, setEditorSource] = useState(DEFAULT_FRAGMENT_SHADER);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [historyStats, setHistoryStats] = useState({ undo: 0, redo: 0 });
  const undoRef = useRef<StudioValues[]>([]);
  const redoRef = useRef<StudioValues[]>([]);
  const gestureStartRef = useRef<StudioValues | null>(null);
  const lastMarkerRef = useRef(-1);
  const captureRef = useRef<(() => void) | null>(null);
  const seekRef = useRef<((time: number) => void) | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  useEffect(() => {
    let hydrated: StudioValues | null = null;
    let hydratedName = "";
    try {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const encoded = hash.get("design");
      if (encoded) {
        const design = JSON.parse(decodeURIComponent(atob(encoded))) as Partial<StudioValues>;
        hydrated = { ...DEFAULTS, ...design, palette: design.palette || DEFAULTS.palette };
        hydratedName = "Shared study";
      } else {
        const saved = window.localStorage.getItem("lumen-design-v1");
        if (!saved) return;
        const design = JSON.parse(saved) as Partial<StudioValues>;
        hydrated = { ...DEFAULTS, ...design, palette: design.palette || DEFAULTS.palette };
        hydratedName = "Last session";
      }
    } catch {
      // Invalid shared state falls back to the curated default.
    }
    if (!hydrated) return;
    const nextValues = hydrated;
    const timer = window.setTimeout(() => {
      setValues(nextValues);
      setPresetName(hydratedName);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("lumen-design-v1", JSON.stringify(values));
  }, [values]);

  const pushHistory = useCallback((snapshot: StudioValues) => {
    undoRef.current = [...undoRef.current.slice(-39), snapshot];
    redoRef.current = [];
    setHistoryStats({ undo: undoRef.current.length, redo: 0 });
  }, []);

  const beginGesture = useCallback(() => {
    if (!gestureStartRef.current) gestureStartRef.current = values;
  }, [values]);

  const endGesture = useCallback(() => {
    const start = gestureStartRef.current;
    if (start && JSON.stringify(start) !== JSON.stringify(values)) pushHistory(start);
    gestureStartRef.current = null;
  }, [pushHistory, values]);

  const markPerformance = useCallback(() => {
    if (!recording || Math.abs(playhead - lastMarkerRef.current) < 0.16) return;
    lastMarkerRef.current = playhead;
    setMarkers((current) => [...current.slice(-31), playhead]);
  }, [playhead, recording]);

  const updateValue = useCallback(
    (key: NumericKey, next: number) => {
      setValues((current) => ({ ...current, [key]: next }));
      markPerformance();
      setPresetName("Untitled study");
    },
    [markPerformance],
  );

  const updateMacro = useCallback(
    (key: MacroKey, next: number) => {
      setMacros((current) => ({ ...current, [key]: next }));
      markPerformance();
    },
    [markPerformance],
  );

  const toggleLock = (key: string) => {
    setLocked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const undo = () => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    redoRef.current.push(values);
    setValues(previous);
    setHistoryStats({ undo: undoRef.current.length, redo: redoRef.current.length });
    setPresetName("History state");
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(values);
    setValues(next);
    setHistoryStats({ undo: undoRef.current.length, redo: redoRef.current.length });
    setPresetName("History state");
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    pushHistory(values);
    setValues({ ...DEFAULTS, ...preset.values });
    setMacros(DEFAULT_MACROS);
    setPresetName(preset.name);
    setPresetsOpen(false);
    showToast(`${preset.name} loaded`);
  };

  const mutate = (strength: "subtle" | "medium" | "wild" | "palette" | "structure") => {
    pushHistory(values);
    const magnitude = strength === "subtle" ? 0.08 : strength === "medium" ? 0.22 : 0.55;
    const structureKeys: NumericKey[] = [
      "scale",
      "zoom",
      "warp",
      "turbulence",
      "symmetry",
      "twist",
      "density",
      "softness",
      "contour",
    ];
    const finishingKeys: NumericKey[] = [
      "speed",
      "motion",
      "exposure",
      "contrast",
      "saturation",
      "glow",
      "grain",
      "vignette",
      "hue",
      "lightAngle",
      "aberration",
    ];
    const keys = strength === "structure" ? structureKeys : [...structureKeys, ...finishingKeys];
    const next = { ...values };
    if (strength !== "palette") {
      keys.forEach((key) => {
        if (locked.has(key)) return;
        const [min, max] = PARAM_RANGES[key];
        const delta = (Math.random() * 2 - 1) * (max - min) * magnitude;
        const mutated = Math.min(max, Math.max(min, Number(values[key]) + delta));
        next[key] = ["symmetry", "detail", "style", "seed"].includes(key) ? Math.round(mutated) : mutated;
      });
      next.seed = Math.floor(1000 + Math.random() * 8999);
      if (strength === "wild" && !locked.has("style")) next.style = Math.floor(Math.random() * 5);
    }
    if (strength !== "structure" && !locked.has("palette")) {
      const baseHue = Math.random() * 360;
      next.palette = [
        hslToHex(baseHue, 0.52, 0.055),
        hslToHex((baseHue + 45 + Math.random() * 45) % 360, 0.76, 0.42),
        hslToHex((baseHue + 125 + Math.random() * 60) % 360, 0.84, 0.68),
        hslToHex((baseHue + 210 + Math.random() * 80) % 360, 0.92, 0.72),
      ];
    }
    setValues(next);
    setPresetName(`${strength[0].toUpperCase()}${strength.slice(1)} mutation`);
    setMutateOpen(false);
    showToast("A new mutation is alive");
  };

  const shareDesign = async () => {
    const encoded = btoa(encodeURIComponent(JSON.stringify(values)));
    const url = `${window.location.origin}${window.location.pathname}#design=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Share link copied");
    } catch {
      window.history.replaceState(null, "", `#design=${encoded}`);
      showToast("Share state added to the URL");
    }
  };

  const reset = () => {
    pushHistory(values);
    setValues(DEFAULTS);
    setMacros(DEFAULT_MACROS);
    setPresetName("Ion Garden");
    showToast("Instrument reset");
  };

  const range = (
    key: NumericKey,
    label: string,
    min: number,
    max: number,
    step: number,
    format?: (value: number) => string,
  ) => (
    <RangeControl
      key={key}
      label={label}
      value={values[key]}
      min={min}
      max={max}
      step={step}
      defaultValue={DEFAULTS[key]}
      format={format}
      onChange={(next) => updateValue(key, next)}
      onGestureStart={beginGesture}
      onGestureEnd={endGesture}
      locked={locked.has(key)}
      onToggleLock={() => toggleLock(key)}
    />
  );

  const inspector = {
    form: (
      <>
        <Module title="Field topology" badge="05 TYPES">
          <div className="style-grid" role="group" aria-label="Field style">
            {STYLE_OPTIONS.map((style, index) => (
              <button
                type="button"
                key={style}
                className={values.style === index ? "is-active" : ""}
                onClick={() => {
                  pushHistory(values);
                  updateValue("style", index);
                }}
              >
                <span className={`style-glyph style-${index}`} />
                {style}
              </button>
            ))}
          </div>
        </Module>
        <Module title="Composition">
          {range("scale", "Field scale", 0.4, 7, 0.01)}
          {range("zoom", "Camera zoom", 0.25, 2.2, 0.01)}
          {range("rotation", "Rotation", -Math.PI, Math.PI, 0.01, (value) => `${Math.round((value * 180) / Math.PI)}°`)}
          {range("symmetry", "Symmetry", 1, 14, 1, (value) => `${Math.round(value)}×`)}
        </Module>
        <Module title="Structure">
          {range("twist", "Polar twist", -2, 2, 0.01)}
          {range("density", "Density", 1, 14, 0.01)}
        </Module>
      </>
    ),
    flow: (
      <>
        <Module title="Time engine" badge={paused ? "HELD" : "RUNNING"}>
          {range("speed", "Time direction", -1.5, 1.5, 0.01)}
          {range("motion", "Orbital drift", 0, 2, 0.01)}
        </Module>
        <Module title="Domain flow">
          {range("warp", "Domain warp", 0, 2.4, 0.01)}
          {range("turbulence", "Turbulence", 0, 1.5, 0.01)}
          {range("detail", "Noise octaves", 1, 7, 1, (value) => `${Math.round(value)}`)}
        </Module>
        <Module title="Interaction">
          {range("pointerForce", "Pointer gravity", 0, 1.8, 0.01)}
          <p className="module-hint">Press and sweep across the field. Velocity and pressure bend the domain in real time.</p>
        </Module>
      </>
    ),
    matter: (
      <>
        <Module title="Spectral ramp" badge="LINEAR RGB">
          <div className="palette-row">
            {values.palette.map((color, index) => (
              <label key={`${color}-${index}`} className="color-well" style={{ "--well-color": color } as CSSProperties}>
                <input
                  type="color"
                  value={color}
                  onChange={(event) => {
                    const palette = [...values.palette] as StudioValues["palette"];
                    palette[index] = event.target.value;
                    setValues((current) => ({ ...current, palette }));
                    setPresetName("Untitled study");
                  }}
                  aria-label={`Palette color ${index + 1}`}
                />
                <span>0{index + 1}</span>
              </label>
            ))}
            <button
              type="button"
              className={`palette-lock ${locked.has("palette") ? "is-active" : ""}`}
              onClick={() => toggleLock("palette")}
              title="Lock palette from mutation"
            >
              {locked.has("palette") ? "▣" : "□"}
            </button>
          </div>
          {range("hue", "Palette phase", -1, 1, 0.001)}
          {range("saturation", "Saturation", 0, 2, 0.01)}
        </Module>
        <Module title="Surface">
          {range("softness", "Edge softness", 0.02, 1, 0.01)}
          {range("contour", "Contour mix", 0, 1.5, 0.01)}
        </Module>
      </>
    ),
    light: (
      <>
        <Module title="Radiance" badge="HDR MATH">
          {range("exposure", "Exposure", 0.35, 2.6, 0.01)}
          {range("contrast", "Contrast", 0.5, 2, 0.01)}
          {range("glow", "Edge radiance", 0, 1.8, 0.01)}
        </Module>
        <Module title="Directional light">
          <div className="light-dial">
            <span className="light-orbit" />
            <span className="light-source" style={{ transform: `rotate(${values.lightAngle}rad) translateX(43px)` }} />
            <span className="light-core">✦</span>
          </div>
          {range("lightAngle", "Light angle", -Math.PI, Math.PI, 0.01, (value) => `${Math.round((value * 180) / Math.PI)}°`)}
        </Module>
      </>
    ),
    lens: (
      <>
        <Module title="Optics">
          {range("vignette", "Edge falloff", 0, 0.85, 0.01)}
          {range("aberration", "Chromatic split", 0, 2, 0.01)}
          {range("pixelate", "Pixel aperture", 0, 36, 0.2, (value) => value < 0.5 ? "OFF" : `${Math.round(value)} px`)}
        </Module>
        <Module title="Texture">
          {range("grain", "Photon grain", 0, 0.22, 0.001)}
          <div className="dither-matrix" aria-hidden="true">
            {Array.from({ length: 64 }, (_, index) => <i key={index} />)}
          </div>
        </Module>
      </>
    ),
    patch: (
      <>
        <Module title="Fragment patch" badge={compileError ? "ERROR" : "LIVE GLSL"}>
          <div className="code-toolbar">
            <span>fragment.glsl</span>
            <span>WebGL2 · GLSL ES 3.00</span>
          </div>
          <textarea
            className="code-editor"
            value={editorSource}
            onChange={(event) => setEditorSource(event.target.value)}
            spellCheck={false}
            aria-label="Fragment shader source"
          />
          {compileError && <pre className="compile-error">{compileError}</pre>}
          <div className="code-actions">
            <button
              type="button"
              onClick={() => {
                setAppliedSource(editorSource);
                showToast("Patch sent to the GPU");
              }}
            >
              Compile patch
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEditorSource(DEFAULT_FRAGMENT_SHADER);
                setAppliedSource(DEFAULT_FRAGMENT_SHADER);
              }}
            >
              Restore source
            </button>
          </div>
        </Module>
      </>
    ),
  }[mode];

  return (
    <main className="studio-shell">
      <header className="command-bar">
        <div className="brand-lockup">
          <span className="brand-mark"><i /><i /><i /></span>
          <div>
            <strong>LUMEN</strong>
            <span>SHADER INSTRUMENT</span>
          </div>
        </div>
        <button className="project-switcher" type="button" onClick={() => setPresetsOpen((open) => !open)}>
          <span>{presetName}</span>
          <small>STUDY · {String(values.seed).padStart(4, "0")}</small>
          <b>⌄</b>
        </button>
        <div className="command-actions">
          <div className="history-actions">
            <button type="button" onClick={undo} disabled={!historyStats.undo} aria-label="Undo">↶</button>
            <button type="button" onClick={redo} disabled={!historyStats.redo} aria-label="Redo">↷</button>
          </div>
          <div className="menu-wrap">
            <button className="mutate-button" type="button" onClick={() => mutate("medium")}>✣ Mutate</button>
            <button className="menu-caret" type="button" onClick={() => setMutateOpen((open) => !open)} aria-label="Mutation options">⌄</button>
            {mutateOpen && (
              <div className="floating-menu mutate-menu">
                {(["subtle", "medium", "wild", "palette", "structure"] as const).map((strength) => (
                  <button key={strength} type="button" onClick={() => mutate(strength)}>
                    <span>{strength}</span>
                    <small>{strength === "subtle" ? "±8%" : strength === "medium" ? "±22%" : strength === "wild" ? "±55%" : "selective"}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="quiet-action share-action" type="button" onClick={shareDesign}>Share</button>
          <div className="menu-wrap">
            <button className="primary-action" type="button" onClick={() => setExportOpen((open) => !open)}>Export <span>⌄</span></button>
            {exportOpen && (
              <div className="floating-menu export-menu">
                <button type="button" onClick={() => { captureRef.current?.(); setExportOpen(false); }}><span>PNG frame</span><small>current resolution</small></button>
                <button type="button" onClick={() => { downloadText("lumen-fragment.glsl", editorSource); setExportOpen(false); }}><span>GLSL source</span><small>editable patch</small></button>
                <button type="button" onClick={() => { downloadText("lumen-study.json", JSON.stringify({ version: 1, values, macros }, null, 2), "application/json"); setExportOpen(false); }}><span>Preset JSON</span><small>portable design</small></button>
              </div>
            )}
          </div>
        </div>
      </header>

      {presetsOpen && (
        <section className="preset-filmstrip" aria-label="Shader presets">
          <div className="filmstrip-title"><span>LIVE STUDIES</span><small>Curated starting points</small></div>
          {PRESETS.map((preset) => (
            <button key={preset.name} type="button" className={preset.name === presetName ? "is-active" : ""} onClick={() => applyPreset(preset)}>
              <span className="preset-preview" style={{ background: `radial-gradient(circle at 25% 30%, ${preset.values.palette[2]}, transparent 27%), conic-gradient(from ${Number(preset.values.twist || 0) * 90}deg, ${preset.values.palette.join(", ")})` }} />
              <span><strong>{preset.name}</strong><small>{preset.note}</small></span>
            </button>
          ))}
          <button className="filmstrip-close" type="button" onClick={() => setPresetsOpen(false)} aria-label="Close presets">×</button>
        </section>
      )}

      <section className="studio-workspace">
        <nav className="mode-rail" aria-label="Shader editing modes">
          <div className="rail-live"><span /><small>LIVE</small></div>
          {MODE_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={mode === item.id ? "is-active" : ""}
              onClick={() => {
                setMode(item.id);
                setInspectorOpen(true);
              }}
              aria-label={item.label}
              title={item.label}
            >
              <b>{item.glyph}</b>
              <span>{item.label}</span>
            </button>
          ))}
          <button className="rail-reset" type="button" onClick={reset} aria-label="Reset instrument" title="Reset">↺</button>
        </nav>

        <div className="stage" ref={stageRef}>
          <ShaderCanvas
            values={values}
            macros={macros}
            paused={paused}
            source={appliedSource}
            onFps={setFps}
            onTime={setPlayhead}
            onCompileError={setCompileError}
            captureRef={captureRef}
            seekRef={seekRef}
          />
          <div className="stage-shine" />
          <div className="canvas-hud hud-top-left">
            <span>ACTIVE FIELD</span>
            <strong>{STYLE_OPTIONS[values.style]} / {String(values.seed).padStart(4, "0")}</strong>
          </div>
          <div className="canvas-hud hud-top-right">
            <span className="fps-dot" />
            <strong>{fps} FPS</strong>
            <i />
            <span>ADAPTIVE</span>
          </div>
          <div className="canvas-hud hud-bottom-left">
            <span className="pointer-icon">↗</span>
            <span>PRESS + MOVE TO BEND THE FIELD</span>
          </div>
          <div className="canvas-hud hud-bottom-right">
            <button type="button" onClick={() => captureRef.current?.()} title="Capture PNG" aria-label="Capture PNG">□</button>
            <button type="button" onClick={() => stageRef.current?.requestFullscreen()} title="Fullscreen" aria-label="Fullscreen">⌗</button>
          </div>
          {compileError && mode !== "patch" && <button className="compile-toast" type="button" onClick={() => setMode("patch")}><span>!</span> Patch error · open editor</button>}
          <button className="mobile-inspector-toggle" type="button" onClick={() => setInspectorOpen((open) => !open)}>
            {MODE_ITEMS.find((item) => item.id === mode)?.label} controls <span>{inspectorOpen ? "×" : "⌃"}</span>
          </button>
        </div>

        <aside className={`inspector ${inspectorOpen ? "is-open" : ""}`}>
          <div className="inspector-heading">
            <div><span>INSTRUMENT RACK</span><strong>{MODE_ITEMS.find((item) => item.id === mode)?.label}</strong></div>
            <button type="button" onClick={() => setInspectorOpen(false)} aria-label="Close inspector">×</button>
          </div>
          <div className="inspector-scroll">{inspector}</div>
          <footer className="inspector-footer">
            <span><i /> GPU ACTIVE</span>
            <button type="button" onClick={reset}>RESET MODE</button>
          </footer>
        </aside>
      </section>

      <footer className="signal-strip">
        <section className="transport">
          <button className={`record-button ${recording ? "is-recording" : ""}`} type="button" onClick={() => setRecording((value) => !value)} aria-label="Record performance"><span /></button>
          <button className="play-button" type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Play" : "Pause"}>{paused ? "▶" : "Ⅱ"}</button>
          <div className="timeline">
            <div className="timeline-meta"><span>{paused ? "HELD" : "PLAYING"}</span><time>00:{playhead.toFixed(1).padStart(4, "0")}</time><small>24.0s LOOP</small></div>
            <div className="timeline-track">
              <i className="timeline-fill" style={{ width: `${(playhead / 24) * 100}%` }} />
              {markers.map((marker, index) => <b key={`${marker}-${index}`} style={{ left: `${(marker / 24) * 100}%` }} />)}
              <input type="range" min="0" max="24" step="0.01" value={playhead} onChange={(event) => { const time = Number(event.target.value); setPlayhead(time); seekRef.current?.(time); }} aria-label="Timeline playhead" />
            </div>
          </div>
        </section>
        <section className="macro-bank" aria-label="Performance macros">
          {(Object.keys(macros) as MacroKey[]).map((key) => (
            <MacroKnob key={key} id={`macro-${key}`} label={key} value={macros[key]} onChange={(next) => updateMacro(key, next)} />
          ))}
        </section>
        <section className="signal-status">
          <span><i className="signal-bars" /> AUTO</span>
          <button type="button" onClick={() => { setMarkers([]); showToast("Performance cleared"); }}>CLEAR TAKE</button>
        </section>
      </footer>

      {toast && <div className="app-toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
