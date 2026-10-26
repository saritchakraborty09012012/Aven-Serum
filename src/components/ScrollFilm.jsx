import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import Beat from "./Beat";
import Loader from "./Loader";
import Nav from "./Nav";
import { onAnchorClick } from "../lib/scroll";
import framemapData from "../data/framemap.json";
import desktopPreviewData from "../data/previews.json";
import portraitPreviewData from "../data/previews-portrait.json";

const IS_PORTRAIT =
  typeof window !== "undefined" &&
  window.innerWidth / Math.max(1, window.innerHeight) < 0.85;
const PREVIEW = IS_PORTRAIT ? portraitPreviewData : desktopPreviewData;
const PREVIEW_DIR = IS_PORTRAIT ? "/previews-portrait" : "/previews";
const FRAME_DIR = IS_PORTRAIT ? "/frames-portrait" : "/frames";
const TOTAL = PREVIEW.total;
const SHEET_COUNT = PREVIEW.sheets.length;
const FRAMES_PER_SHEET = PREVIEW.sheets[0].cols * PREVIEW.sheets[0].rows;
const FRAME_MAP = IS_PORTRAIT
  ? framemapData.portrait.map((value) => value / 2)
  : framemapData.desktop;
const W_IN = 0.035;
const DERIVA = 0.045;
const EASE_TAU = 28;
const ANCHOR_PROGRESS = { "#top": 0, "#formula": 0.245, "#spots": 0.57, "#result": 0.87 };
const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
const easeOut = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : 1 - Math.pow(1 - value, 3));
const pad = (index) => String(index + 1).padStart(4, "0");
const frameSource = (index) => `${FRAME_DIR}/f_${pad(index)}.webp`;

function frameAtProgress(progress) {
  const x = clamp(progress, 0, 1) * (FRAME_MAP.length - 1);
  const k = Math.min(FRAME_MAP.length - 2, Math.floor(x));
  const frame = FRAME_MAP[k] + (FRAME_MAP[k + 1] - FRAME_MAP[k]) * (x - k);
  return clamp(frame, 0, TOTAL - 1);
}

function sheetForFrame(frame) {
  return clamp(Math.floor(frame / FRAMES_PER_SHEET), 0, SHEET_COUNT - 1);
}

export default function ScrollFilm() {
  const canvasRef = useRef(null);
  const progressRef = useRef(null);
  const trackRef = useRef(null);
  const [progress, setProgress] = useState(0.04);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    const progressBar = progressRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });
    const full = new Map();
    const fullPending = new Map();
    const pendingDirection = new Map();
    const fullDesired = new Set();
    const fullFailed = new Map();
    const atlasImages = new Map();
    const atlasPending = new Set();
    const bootFrames = new Set();
    const timers = [];
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let ready = false;
    let frame0 = false;
    let atlas0 = false;
    let fontsReady = false;
    let lastTime = performance.now();
    let lastDrawIndex = -1;
    let invalidate = true;
    let cur = 0;
    let target = 0;
    let lastProgress = 0;
    let lastProgressString = "";
    let lastRequested = -999;
    let lastRequestAt = 0;
    let direction = 1;
    let filmEnd = 1;
    let trackTop = 0;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let navBottom = 0;
    let portrait = viewportWidth / viewportHeight < 0.85;
    let resizeTimer = 0;
    let raf = 0;
    let lenis = null;
    let beats = [];
    let pageReady = false;
    let lastBeatKey = "";
    let velocity = 0;
    let requestStride = 1;
    let lastTier = "boot";
    let lastDrawnFrame = -1;
    let drawDirection = 0;
    let lastCurForDirection = 0;
    let lastSettleIndex = -999;
    let trace = null;

    // Full frames decode at ~8 MB each, so keep the cache small but the request
    // set deep enough to cover fast scrolling.
    const MAX_FULL_INFLIGHT = coarse ? 4 : 7;
    const FULL_CACHE = coarse ? 18 : 26;
    const FULL_RANGE = 160;

    const nav = document.querySelector(".nav");
    const beatElements = [...document.querySelectorAll(".beat")];
    const anchorElements = [...document.querySelectorAll(".anchor[data-progress]")];

    function measureBeats() {
      lastBeatKey = "";
      beats = beatElements.map((el) => ({
        el,
        from: Number(el.dataset.from),
        to: Number(el.dataset.to),
        lines: [...el.querySelectorAll(".ln > i")],
        height: el.offsetHeight,
        lastOpacity: -1,
        lastY: Number.NaN,
        visible: false,
        active: false,
      }));
    }

    function refreshLayout() {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      portrait = viewportWidth / Math.max(1, viewportHeight) < 0.85;
      navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
      const rect = track.getBoundingClientRect();
      trackTop = rect.top + window.scrollY;
      filmEnd = Math.max(1, trackTop + rect.height - viewportHeight);
      anchorElements.forEach((anchor) => {
        anchor.style.top = `${Number(anchor.dataset.progress) * filmEnd}px`;
      });
      resizeCanvas();
      measureBeats();
      invalidate = true;
    }

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      const scale = Math.min(1, 3840 / Math.max(width, height));
      const nextWidth = Math.max(1, Math.round(width * scale));
      const nextHeight = Math.max(1, Math.round(height * scale));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      invalidate = true;
    }

    function evictFull(center) {
      if (full.size <= FULL_CACHE) return;
      // Keep frames near the playhead *and* near the picture actually on
      // screen. At speed the two can be dozens of frames apart, and evicting
      // the drawn frame's neighbours is what made reversing feel like it had
      // to buffer from scratch.
      const score = (index) => {
        const toPlayhead = Math.abs(index - center);
        if (lastDrawnFrame < 0) return toPlayhead;
        return Math.min(toPlayhead, Math.abs(index - lastDrawnFrame));
      };
      const sorted = [...full.keys()].sort((a, b) => score(b) - score(a));
      for (const index of sorted) {
        if (full.size <= FULL_CACHE - 2) break;
        if (index === center || index === lastDrawnFrame) continue;
        if (fullDesired.has(index) || fullPending.has(index)) continue;
        const image = full.get(index);
        full.delete(index);
        if (image) {
          // Clear listeners first: src="" on a loaded image fires an error,
          // which used to blacklist the frame forever.
          image.onload = null;
          image.onerror = null;
          image.src = "";
        }
      }
    }

    function updateBootProgress() {
      if (ready || disposed) return;
      const value = Math.min(
        0.96,
        0.05 + (Math.min(bootFrames.size, 18) / 18) * 0.79 + (atlas0 ? 0.12 : 0)
      );
      setProgress((previous) => (value > previous ? value : previous));
    }

    function startFull(index) {
      const image = new Image();
      image.decoding = "async";
      fullPending.set(index, image);
      pendingDirection.set(index, direction);
      image.onload = () => {
        if (disposed) return;
        image.onload = null;
        image.onerror = null;
        fullPending.delete(index);
        pendingDirection.delete(index);
        fullFailed.delete(index);
        full.set(index, image);
        fullDesired.delete(index);
        invalidate = true;
        if (index < 18 && !bootFrames.has(index)) {
          bootFrames.add(index);
          updateBootProgress();
          maybeReveal();
        }
        evictFull(Math.round(cur));
        pumpFull();
      };
      image.onerror = () => {
        image.onload = null;
        image.onerror = null;
        fullPending.delete(index);
        pendingDirection.delete(index);
        // Retry transient failures after a pause instead of blacklisting the
        // frame for the rest of the session.
        fullFailed.set(index, performance.now() + 4000);
        pumpFull();
      };
      image.src = frameSource(index);
    }

    function isFailed(index) {
      const retryAt = fullFailed.get(index);
      if (retryAt === undefined) return false;
      if (retryAt > performance.now()) return true;
      fullFailed.delete(index);
      return false;
    }

    function ensureFull(index) {
      if (index < 0 || index >= TOTAL || full.has(index) || fullPending.has(index) || isFailed(index)) {
        return;
      }
      fullDesired.add(index);
    }

    function cancelFull(index) {
      const image = fullPending.get(index);
      if (!image) return;
      image.onload = null;
      image.onerror = null;
      fullPending.delete(index);
      pendingDirection.delete(index);
      fullDesired.delete(index);
      image.src = "";
    }

    // Browser connections are the bottleneck, not bandwidth. After a direction
    // change the queue is full of frames requested for the old direction, so
    // the frames actually needed next cannot even start loading. Drop only
    // those stale requests and let same-direction loads finish; otherwise fast
    // scrolling keeps cancelling frames the film is just about to reach.
    function pruneFullPending(anchor) {
      for (const index of [...fullPending.keys()]) {
        const distance = Math.abs(index - anchor);
        if (distance > FULL_RANGE || pendingDirection.get(index) !== direction) cancelFull(index);
      }
    }

    // Start only the frames closest to the playhead and drop requests that the
    // viewer has already scrolled past. Without this a fast wheel flick queues
    // hundreds of images and the frame actually on screen arrives late, which
    // is what made the film flash soft previews.
    function pumpFull(anchor = Math.round(cur)) {
      if (disposed) return;
      for (const index of fullDesired) {
        if (Math.abs(index - anchor) > FULL_RANGE) fullDesired.delete(index);
      }
      while (fullPending.size < MAX_FULL_INFLIGHT && fullDesired.size) {
        let pick = -1;
        let best = Infinity;
        for (const index of fullDesired) {
          if (full.has(index) || fullPending.has(index) || isFailed(index)) {
            fullDesired.delete(index);
            continue;
          }
          let distance = Math.abs(index - anchor);
          if ((index - anchor) * direction < 0) distance *= 1.35;
          if (index === anchor) distance = -1;
          if (distance < best) {
            best = distance;
            pick = index;
          }
        }
        if (pick < 0) break;
        fullDesired.delete(pick);
        startFull(pick);
      }
    }

    function evictAtlases(centerSheet) {
      if (atlasImages.size <= 7) return;
      const sorted = [...atlasImages.keys()].sort(
        (a, b) => Math.abs(b - centerSheet) - Math.abs(a - centerSheet)
      );
      for (const sheet of sorted) {
        if (atlasImages.size <= 6) break;
        if (Math.abs(sheet - centerSheet) <= 2) continue;
        const image = atlasImages.get(sheet);
        atlasImages.delete(sheet);
        if (image) image.src = "";
      }
    }

    function ensureAtlas(sheetIndex) {
      if (sheetIndex < 0 || sheetIndex >= SHEET_COUNT) return;
      if (atlasImages.has(sheetIndex) || atlasPending.has(sheetIndex)) return;
      atlasPending.add(sheetIndex);
      const meta = PREVIEW.sheets[sheetIndex];
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (disposed) return;
        atlasPending.delete(sheetIndex);
        atlasImages.set(sheetIndex, image);
        if (sheetIndex === 0) {
          atlas0 = true;
          updateBootProgress();
          maybeReveal();
        }
        invalidate = true;
        evictAtlases(sheetForFrame(Math.round(cur)));
      };
      image.onerror = () => {
        atlasPending.delete(sheetIndex);
      };
      image.src = `${PREVIEW_DIR}/${meta.file}`;
    }

    // At 400 frames/s we cannot usefully decode every source frame: the screen
    // only refreshes 60 times a second. Requesting every frame anyway saturates
    // the decoder and leaves no room for the frames needed after a direction
    // change. Space requests out while moving fast, then fill the gaps in when
    // the scroll slows down.
    function strideForSpeed(speed) {
      if (speed < 90) return 1;
      if (speed < 180) return 2;
      if (speed < 320) return 3;
      if (speed < 520) return 4;
      if (speed < 800) return 6;
      return 8;
    }

    function requestWindow(center) {
      const index = clamp(Math.round(center), 0, TOTAL - 1);
      pruneFullPending(index);
      requestStride = strideForSpeed(velocity);
      ensureFull(index);
      const lead = clamp(Math.ceil(velocity * 0.12), 12, 32);
      for (let step = 1; step <= lead; step++) {
        ensureFull(clamp(index + direction * step * requestStride, 0, TOTAL - 1));
      }
      pumpFull(index);
    }

    function drawCover(image, sx, sy, sw, sh) {
      const scale = Math.max(canvas.width / sw, canvas.height / sh);
      const width = sw * scale;
      const height = sh * scale;
      const fx = portrait ? 0.5 : 0.2;
      const fy = portrait ? 1 : 0.5;
      const x = (canvas.width - width) * fx;
      const y = (canvas.height - height) * fy;
      ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
    }

    // On phones the whole frame stays visible, like the laptop cut shows the
    // whole scene: fit it instead of cropping into it (cover, bottom-anchored,
    // was zooming the bottle and cutting the top of the shot away). Whatever
    // margin is left is filled from the frame's own outermost row/column, so
    // the picture still reaches every edge — no letterbox, no blur, no canvas
    // downscale. Desktop keeps drawCover: the laptop framing does not change.
    function drawFit(image, sx, sy, sw, sh) {
      const scale = Math.min(canvas.width / sw, canvas.height / sh);
      const width = sw * scale;
      const height = sh * scale;
      const x = (canvas.width - width) / 2;
      const y = (canvas.height - height) / 2;
      ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
      if (x > 0.5) {
        ctx.drawImage(image, sx, sy, 1, sh, 0, 0, x, canvas.height);
        ctx.drawImage(image, sx + sw - 1, sy, 1, sh, x + width, 0, x, canvas.height);
      }
      if (y > 0.5) {
        ctx.drawImage(image, sx, sy, sw, 1, 0, 0, canvas.width, y);
        ctx.drawImage(image, sx, sy + sh - 1, sw, 1, 0, y + height, canvas.width, y);
      }
    }

    function placeFrame(image, sx, sy, sw, sh) {
      if (portrait) drawFit(image, sx, sy, sw, sh);
      else drawCover(image, sx, sy, sw, sh);
    }

    function drawFull(index) {
      const image = full.get(index);
      if (!image || !image.naturalWidth) return false;
      placeFrame(image, 0, 0, image.naturalWidth, image.naturalHeight);
      return true;
    }

    function drawPreview(index) {
      const sheet = sheetForFrame(index);
      const image = atlasImages.get(sheet);
      const meta = PREVIEW.sheets[sheet];
      if (!image) return false;
      const slot = index - meta.start;
      if (slot < 0 || slot >= meta.count) return false;
      const col = slot % meta.cols;
      const row = Math.floor(slot / meta.cols);
      placeFrame(image, col * meta.width, row * meta.height, meta.width, meta.height);
      return true;
    }

    function draw(index) {
      const center = clamp(Math.round(index), 0, TOTAL - 1);

      // Pick the closest loaded frame, but only on the side the scroll is
      // travelling towards. A late image finishing on the other side can no
      // longer pop an older frame in between newer ones.
      let candidate = -1;
      if (drawDirection > 0) {
        let best = Infinity;
        for (const key of full.keys()) {
          if (lastDrawnFrame >= 0 && key < lastDrawnFrame) continue;
          if (key > center + 12) continue;
          const difference = Math.abs(key - center);
          if (difference < best) {
            best = difference;
            candidate = key;
          }
        }
      } else if (drawDirection < 0) {
        let best = Infinity;
        for (const key of full.keys()) {
          if (lastDrawnFrame >= 0 && key > lastDrawnFrame) continue;
          if (key < center - 12) continue;
          const difference = Math.abs(key - center);
          if (difference < best) {
            best = difference;
            candidate = key;
          }
        }
      } else {
        let best = Infinity;
        for (const key of full.keys()) {
          const difference = Math.abs(key - center);
          if (difference < best && difference <= 24) {
            best = difference;
            candidate = key;
          }
        }
      }

      if (candidate >= 0 && drawFull(candidate)) {
        lastDrawnFrame = candidate;
        lastTier = candidate === center ? "full" : `step${Math.abs(center - candidate)}`;
        return;
      }

      // Previews are only a cold-start placeholder before any sharp frame has
      // been painted. After that we always hold a full-resolution frame so a
      // low-res atlas can never flash on screen during a direction change.
      if (lastDrawnFrame < 0 && drawPreview(center)) {
        lastDrawnFrame = center;
        lastTier = "preview";
        return;
      }
      // Repaint the held frame. This keeps the film on screen if a resize or
      // mobile browser-chrome change just cleared the canvas while the next
      // frame is still loading.
      const held = lastDrawnFrame >= 0 ? full.get(lastDrawnFrame) : null;
      if (held && held.naturalWidth) {
        drawCover(held, 0, 0, held.naturalWidth, held.naturalHeight);
      }
      lastTier = "hold";
    }

    function syncBeats(progressValue, scroll) {
      if (!beats.length) return;
      const tail = clamp((scroll - filmEnd) / (viewportHeight * 0.3), 0, 1);
      const beatKey = `${pageReady ? 1 : 0}:${progressValue.toFixed(4)}:${tail.toFixed(2)}:${viewportHeight}:${navBottom}`;
      if (beatKey === lastBeatKey) return;
      lastBeatKey = beatKey;

      for (const beat of beats) {
        const entrance = easeOut((progressValue - (beat.from - W_IN)) / W_IN);
        const exit = easeOut((progressValue - beat.to) / W_IN);
        const opacity = pageReady ? entrance * (1 - exit) * (1 - tail) : 0;
        const start = beat.from - W_IN;
        const end = beat.to + W_IN;
        const drift =
          (0.5 - clamp((progressValue - start) / Math.max(0.001, end - start), 0, 1)) *
          viewportHeight *
          DERIVA;
        const offset = drift + (1 - entrance) * 28 - exit * 28;
        const y = portrait
          ? navBottom + 22 + offset
          : (viewportHeight - beat.height) / 2 + offset;

        if (Math.abs(opacity - beat.lastOpacity) > 0.002) {
          beat.lastOpacity = opacity;
          beat.el.style.opacity = opacity.toFixed(3);
        }
        if (!Number.isFinite(beat.lastY) || Math.abs(y - beat.lastY) > 0.05) {
          beat.lastY = y;
          beat.el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
        }

        const visible = opacity > 0.001;
        if (visible !== beat.visible) {
          beat.visible = visible;
          beat.el.classList.toggle("vis", visible);
        }
        const active = opacity > 0.98;
        if (active !== beat.active) {
          beat.active = active;
          beat.el.classList.toggle("on", active);
        }

        if (beat.lines.length) {
          const lineProgress = clamp((progressValue - (beat.from - W_IN)) / W_IN, 0, 1);
          const count = beat.lines.length;
          const stagger = 0.3;
          beat.lines.forEach((line, lineIndex) => {
            const local = easeOut((lineProgress - lineIndex * stagger) / (1 - stagger * (count - 1)));
            const shift = (1 - local) * 110 - exit * 110;
            line.style.transform = `translateY(${shift.toFixed(1)}%)`;
          });
        }
      }
    }

    function syncChrome(progressValue, scroll) {
      if (progressBar && Math.abs(progressValue - lastProgress) > 0.0002) {
        lastProgress = progressValue;
        const value = progressValue.toFixed(4);
        if (value !== lastProgressString) {
          lastProgressString = value;
          progressBar.style.transform = `scaleX(${value})`;
        }
      }
      document.body.classList.toggle("scrolled", scroll > 24);
      syncBeats(progressValue, scroll);
    }

    function reveal() {
      if (ready || disposed) return;
      ready = true;
      setProgress(1);
      setLoaded(true);
      pageReady = true;
      document.body.classList.add("ready");
      if (lenis) lenis.start();
      refreshLayout();
      const scroll = window.scrollY;
      target = cur = frameAtProgress(clamp(scroll / filmEnd, 0, 1));
      invalidate = true;
      requestWindow(cur);
      for (let index = 0; index < 26; index++) ensureFull(index);
      syncBeats(clamp(scroll / filmEnd, 0, 1), scroll);
    }

    function maybeReveal() {
      if (ready || disposed) return;
      const elapsed = performance.now() - startedAt;
      if (frame0 && atlas0 && fontsReady && bootFrames.size >= 6 && elapsed > 650) reveal();
    }

    const startedAt = performance.now();
    timers.push(setTimeout(maybeReveal, 800));
    timers.push(setTimeout(() => {
      if (!ready && !disposed) reveal();
    }, 9000));

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (disposed) return;
        fontsReady = true;
        refreshLayout();
        maybeReveal();
      });
    } else {
      fontsReady = true;
    }

    function initializeFullFrame() {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (disposed) return;
        full.set(0, image);
        frame0 = true;
        invalidate = true;
        updateBootProgress();
        maybeReveal();
      };
      image.onerror = () => {
        frame0 = true;
      };
      image.src = frameSource(0);
    }

    initializeFullFrame();
    ensureAtlas(0);
    for (let index = 1; index < 18; index++) ensureFull(index);
    pumpFull(0);

    const anchors = { ...ANCHOR_PROGRESS };
    function scrollToProgress(progressValue) {
      const top = trackTop + clamp(progressValue, 0, 1) * filmEnd;
      if (lenis) lenis.scrollTo(top, { duration: reduced ? 0 : 1.6 });
      else window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    }
    function scrollToAnchor(href) {
      if (href === "#shop" || href === "#end") {
        const element = document.querySelector(href);
        if (element) {
          if (lenis) lenis.scrollTo(element, { duration: reduced ? 0 : 1.6 });
          else element.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
        }
        return;
      }
      scrollToProgress(anchors[href] ?? 0);
    }

    const api = {
      scrollToAnchor,
      scrollToProgress,
      getProgress: () => lastProgress,
      getFrame: () => Math.round(cur),
      getTier: () => lastTier,
      getStats: () => ({
        tier: lastTier,
        frame: Math.round(cur),
        target: Math.round(target),
        drawn: lastDrawnFrame,
        loaded: full.size,
        pending: fullPending.size,
        desired: fullDesired.size,
        failed: fullFailed.size,
        velocity: Math.round(velocity),
        stride: requestStride,
        requested: Math.round(lastRequested),
        direction,
      }),
      startTrace: () => {
        trace = [];
      },
      stopTrace: () => {
        const data = trace;
        trace = null;
        return data;
      },
      isReady: () => ready,
      lenis: () => lenis,
    };
    window.__ambarFilm = api;

    lenis = new Lenis({
      lerp: reduced ? 1 : 0.12,
      wheelMultiplier: 1,
      smoothWheel: !reduced,
    });
    window.lenis = lenis;
    lenis.stop();

    function tick(time) {
      if (disposed) return;
      lenis.raf(time);
      const now = performance.now();
      const delta = Math.min(now - lastTime, 50);
      lastTime = now;
      const scroll = window.scrollY;
      const progressValue = clamp(scroll / filmEnd, 0, 1);
      const nextTarget = frameAtProgress(progressValue);
      const frameDelta = nextTarget - target;
      if (frameDelta !== 0) {
        const instant = (Math.abs(frameDelta) / Math.max(1, delta)) * 1000;
        velocity = velocity * 0.8 + instant * 0.2;
      } else {
        velocity *= 0.88;
        if (velocity < 2) velocity = 0;
      }
      target = nextTarget;
      const difference = target - cur;
      if (Math.abs(difference) > 0.0005) {
        cur += difference * (1 - Math.exp(-delta / EASE_TAU));
      } else {
        cur = target;
      }
      const curStep = cur - lastCurForDirection;
      if (curStep > 0.03) {
        drawDirection = 1;
      } else if (curStep < -0.03) {
        drawDirection = -1;
      } else if (Math.abs(target - cur) < 0.25 && velocity < 4) {
        drawDirection = 0;
      }
      lastCurForDirection = cur;
      if (Math.abs(target - lastRequested) > 1.1 && now - lastRequestAt > 65) {
        direction = target >= lastRequested ? 1 : -1;
        lastRequested = target;
        lastRequestAt = now;
        if (ready) requestWindow(cur);
      } else if (ready && velocity < 24) {
        // The scroll has settled. Fill in the frames that were skipped while
        // moving fast so the film can land on the exact frame.
        const settleIndex = clamp(Math.round(target), 0, TOTAL - 1);
        if (settleIndex !== lastSettleIndex) {
          lastSettleIndex = settleIndex;
          requestStride = 1;
          for (let offset = -2; offset <= 2; offset++) ensureFull(settleIndex + offset);
          pumpFull(settleIndex);
        }
      }
      const index = clamp(Math.round(cur), 0, TOTAL - 1);
      if (index !== lastDrawIndex || invalidate) {
        draw(index);
        lastDrawIndex = index;
        invalidate = false;
      }
      syncChrome(progressValue, scroll);
      if (trace && trace.length < 12000) {
        trace.push([Math.round(now), Math.round(target), Math.round(cur), lastDrawnFrame, lastTier]);
      }
      raf = requestAnimationFrame(tick);
    }

    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        refreshLayout();
        syncChrome(clamp(window.scrollY / filmEnd, 0, 1), window.scrollY);
      }, 140);
    });
    resizeObserver.observe(document.documentElement);

    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        refreshLayout();
        syncChrome(clamp(window.scrollY / filmEnd, 0, 1), window.scrollY);
      }, 160);
    }, { passive: true });

    refreshLayout();
    syncChrome(0, 0);
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      timers.forEach((timer) => clearTimeout(timer));
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      lenis.destroy();
      if (window.lenis === lenis) window.lenis = undefined;
      if (window.__ambarFilm === api) window.__ambarFilm = undefined;
      document.body.classList.remove("ready", "scrolled");
    };
  }, []);

  return (
    <>
      <canvas id="film" ref={canvasRef} aria-hidden="true" />
      <div className="prog" ref={progressRef} />
      <Nav />
      <header className="beat lt beat-hero" id="b-hero" data-from="0" data-to="0.12">
        <h1 className="sr">AVEN, a blood-orange vitamin C serum</h1>
        <p className="eyebrow">Vitamin C serum · 30 ml</p>
        <p className="body">A blood-orange serum for dark spots and uneven tone.</p>
        <div className="actions">
          <button className="btn" type="button" data-co-add-sku="serum">
            Add to bag · $68
          </button>
          <a className="tlink" href="#spots" onClick={onAnchorClick}>
            See how it works
          </a>
        </div>
      </header>
      <Beat
        id="b-formula"
        variant="lt beat-formula"
        from="0.2"
        to="0.29"
        eyebrow="The formula"
        lines={[{ text: "Blood orange," }, { text: "in a dropper.", em: true }]}
        body="Vitamin C from blood-orange extract, in a light golden serum that sinks in without any stickiness."
      />
      <Beat
        id="b-spots"
        variant="beat-spots"
        from="0.545"
        to="0.595"
        eyebrow="The problem"
        lines={[{ text: "Dark spots" }, { text: "stay put.", em: true }]}
        body="Sun and time leave patches a regular moisturiser won't touch."
      />
      <Beat
        id="b-use"
        variant="beat-use"
        from="0.655"
        to="0.74"
        eyebrow="How to use"
        lines={[{ text: "Two or three drops." }, { text: "Smooth them in.", em: true }]}
        body="On clean skin every morning, before sunscreen."
      />
      <Beat
        id="b-result"
        variant="beat-result"
        from="0.815"
        to="1.05"
        eyebrow="The result"
        lines={[{ text: "Spots fade." }, { text: "Tone evens out.", em: true }]}
        body="With daily use, dark spots look softer and your skin looks more even."
        actions={
          <a className="btn solid" href="#shop" onClick={onAnchorClick}>
            Shop AVEN
          </a>
        }
      />
      <div className="scroll-hint">
        Scroll <i />
      </div>
      <div className="track" id="track" ref={trackRef} aria-hidden="true">
        <span className="anchor" id="top" data-progress="0" style={{ top: 0 }} />
        <span className="anchor" id="formula" data-progress="0.245" />
        <span className="anchor" id="spots" data-progress="0.57" />
        <span className="anchor" id="result" data-progress="0.87" />
      </div>
      <Loader progress={progress} done={loaded} poster={frameSource(0)} />
    </>
  );
}
