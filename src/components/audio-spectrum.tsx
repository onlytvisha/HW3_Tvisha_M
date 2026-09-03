"use client";

import { useEffect, useRef } from "react";

/**
 * A live frequency spectrum for the preview that is playing.
 *
 * This is reading the actual audio, not animating on a timer: the preview is
 * routed through a Web Audio AnalyserNode and the bars are its frequency bins.
 * Quiet passages sit low, the drop jumps. That only works because both preview
 * CDNs send `Access-Control-Allow-Origin: *`, which lets the audio element be
 * marked crossorigin and keeps the graph from being tainted into silence.
 *
 * It draws nothing until the listener presses play, so the resting page is
 * exactly as it was.
 */

/** Bars drawn. Below the bin count, so each bar is a real band average. */
const BARS = 44;

/**
 * One context for the page, and at most one source node per audio element:
 * createMediaElementSource throws if it is called twice on the same element,
 * and the element is reused across tracks.
 */
let sharedContext: AudioContext | null = null;
const sourceNodes = new WeakMap<
  HTMLAudioElement,
  MediaElementAudioSourceNode
>();

type Graph = { context: AudioContext; analyser: AnalyserNode };

function buildGraph(audio: HTMLAudioElement): Graph {
  type WithWebkit = typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
  sharedContext ??= new Ctor();
  const context = sharedContext;

  let source = sourceNodes.get(audio);
  if (!source) {
    source = context.createMediaElementSource(audio);
    sourceNodes.set(audio, source);
  }

  const analyser = context.createAnalyser();
  // 128 bins over ~22 kHz is a coarse read, which is what suits 44 bars -
  // a finer transform would just be averaged back down.
  analyser.fftSize = 256;
  // Without smoothing the bars strobe. This is the standard ballistics.
  analyser.smoothingTimeConstant = 0.78;

  // Reconnect from scratch each time, and keep the path to the speakers:
  // routing an element into Web Audio and not reaching a destination is how
  // you end up with a visualiser on a silent player.
  source.disconnect();
  source.connect(analyser);
  analyser.connect(context.destination);

  return { context, analyser };
}

/** The two accent colours, re-read whenever the theme changes under us. */
function readAccents(el: HTMLElement): [string, string] {
  const style = getComputedStyle(el);
  return [
    style.getPropertyValue("--sw-pink").trim() || "#e779c1",
    style.getPropertyValue("--sw-cyan").trim() || "#58c7f3",
  ];
}

export function AudioSpectrum({
  audioRef,
  playing,
  /** Gets a --np-level custom property, 0-1, once a frame. */
  levelTarget,
  className,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playing: boolean;
  levelTarget?: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;

    const surface = canvas.getContext("2d");
    if (!surface) return;

    const clear = () => {
      surface.clearRect(0, 0, canvas.width, canvas.height);
      levelTarget?.current?.style.setProperty("--np-level", "0");
    };

    if (!playing) {
      clear();
      return;
    }

    // Someone who has asked for less motion gets the working player without
    // 60fps of bars. The audio is unaffected.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let graph: Graph;
    try {
      graph = buildGraph(audio);
    } catch {
      // No Web Audio, or the element was tainted by a CDN that did not send
      // CORS headers after all. The player itself is untouched.
      return;
    }
    void graph.context.resume();

    const bins = new Uint8Array(graph.analyser.frequencyBinCount);
    let accents = readAccents(canvas);
    let accentTheme = document.documentElement.dataset.theme ?? "";
    let frame = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);

      // Match the backing store to the box, accounting for zoom and retina.
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(canvas.clientWidth * dpr);
      const height = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const theme = document.documentElement.dataset.theme ?? "";
      if (theme !== accentTheme) {
        accentTheme = theme;
        accents = readAccents(canvas);
      }

      graph.analyser.getByteFrequencyData(bins);
      surface.clearRect(0, 0, width, height);

      const gradient = surface.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, accents[0]);
      gradient.addColorStop(1, accents[1]);
      surface.fillStyle = gradient;

      // The top of the spectrum is mostly empty air on a 30-second preview,
      // so only the lower 70% of the bins is spread across the bars.
      const usable = Math.floor(bins.length * 0.7);
      const slot = width / BARS;
      const barWidth = Math.max(1, slot * 0.55);
      const radius = Math.min(barWidth / 2, 2 * dpr);

      let sum = 0;
      for (let i = 0; i < BARS; i++) {
        const value = bins[Math.floor((i / BARS) * usable)] / 255;
        sum += value;

        // A visible floor, so a quiet passage still reads as a player rather
        // than as something broken.
        const barHeight = Math.max(1.5 * dpr, value * height);
        const x = i * slot + (slot - barWidth) / 2;

        surface.beginPath();
        surface.roundRect(x, height - barHeight, barWidth, barHeight, radius);
        surface.fill();
      }

      levelTarget?.current?.style.setProperty(
        "--np-level",
        (sum / BARS).toFixed(3),
      );
    };

    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      clear();
    };
  }, [playing, audioRef, levelTarget]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ opacity: playing ? 1 : 0 }}
    />
  );
}
