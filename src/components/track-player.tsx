"use client";

import { ExternalLink, Music4, Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AudioSpectrum } from "@/components/audio-spectrum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ArtistProfile } from "@/lib/types";

/**
 * Plays the artist's current biggest track.
 *
 * Both catalogue sources hand back a real 30-second preview file, so this is a
 * plain <audio> element with a transport built to match the rest of the page -
 * no embed, no third-party iframe, and nothing that needs the listener to be
 * signed in to anything.
 */
export function TrackPlayer({ profile }: { profile: ArtistProfile }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  // The spectrum needs the element marked crossorigin, and both preview CDNs
  // send the header for it. If one ever stops, the request fails outright
  // rather than degrading, so a load error drops the attribute and retries
  // once: the visualiser is worth having, never at the cost of the audio.
  const [allowAnalysis, setAllowAnalysis] = useState(true);

  // Reset the transport if this component is handed a different track.
  // Adjusted during render rather than in an effect, so a stale progress bar
  // is never committed to the screen first.
  const src = profile.top_track_preview_url;
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setPlaying(false);
    setElapsed(0);
    setAllowAnalysis(true);
  }

  // Space toggles the preview, the way it does in every music player. Ignored
  // while the listener is in a field or on another control, so it never steals
  // the key from the archive search box or from activating a focused button.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.metaKey || event.ctrlKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(
          target?.tagName ?? "",
        )
      ) {
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;

      event.preventDefault(); // otherwise the page jumps a screen
      if (audio.paused) {
        void audio.play();
        setPlaying(true);
      } else {
        audio.pause();
        setPlaying(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!profile.top_track_name) {
    return (
      <Card className="sw-card">
        <CardContent className="text-sw-text-dim flex items-center gap-3 px-5 text-sm">
          <Music4 className="size-4 shrink-0" aria-hidden="true" />
          <p>
            No playable track came back for this artist. They may be listed
            under a different name in the catalogues we search.
          </p>
        </CardContent>
      </Card>
    );
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  /** Scrub to wherever the listener clicked on the progress bar. */
  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;

    const bar = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bar.left) / bar.width;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
  }

  const progress = duration > 0 ? (elapsed / duration) * 100 : 0;

  return (
    <Card ref={cardRef} className="sw-card np-card overflow-hidden">
      <CardContent className="px-5">
        <div className="flex items-start gap-4">
          {profile.top_track_image && (
            // The sleeve carries the loudness: --np-level is written straight
            // onto the card by the spectrum, so it tracks the audio without a
            // React render a frame.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.top_track_image}
              alt=""
              className="np-art size-20 shrink-0 rounded-lg object-cover shadow-lg"
              loading="lazy"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sw-pink/15 text-sw-pink border-sw-pink/40 border text-[0.6875rem]">
                Biggest right now
              </Badge>
              {profile.provider && (
                <Badge
                  variant="outline"
                  className="text-sw-text-dim border-sw-line text-[0.6875rem]"
                  title={
                    profile.top_track_rank
                      ? `Deezer popularity rank ${profile.top_track_rank.toLocaleString("en-US")} - the highest of any track this artist leads`
                      : undefined
                  }
                >
                  via {profile.provider}
                </Badge>
              )}
            </div>

            <h2 className="mt-2 truncate text-xl font-semibold">
              {profile.top_track_name}
            </h2>
            {profile.top_track_album && (
              <p className="text-sw-text-dim truncate text-sm">
                {profile.top_track_album}
              </p>
            )}
          </div>

          {profile.top_track_url && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label="Open this track in a new tab"
            >
              <a
                href={profile.top_track_url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink className="size-4" />
              </a>
            </Button>
          )}
        </div>

        {src ? (
          <>
            <div className="mt-5 flex items-center gap-4">
              <Button
                onClick={toggle}
                size="icon"
                className="size-12 shrink-0 rounded-full"
                aria-label={
                  playing
                    ? `Pause ${profile.top_track_name}`
                    : `Play ${profile.top_track_name}`
                }
              >
                {playing ? (
                  <Pause className="size-5 fill-current" />
                ) : (
                  <Play className="size-5 translate-x-0.5 fill-current" />
                )}
              </Button>

              <div className="min-w-0 flex-1">
                {/* The spectrum sits above the scrub bar and collapses to
                    nothing when stopped, so the card does not change height
                    or reserve empty space on a page nobody has played yet. */}
                <AudioSpectrum
                  audioRef={audioRef}
                  playing={playing}
                  levelTarget={cardRef}
                  className={`block w-full transition-all duration-500 ${
                    playing ? "mb-2 h-9" : "mb-0 h-0"
                  }`}
                />

                {/* Clickable scrub area, padded vertically so the hit target is
                    comfortably bigger than the 6px bar it contains. */}
                <div
                  onClick={seek}
                  className="group -my-2 cursor-pointer py-2"
                  role="progressbar"
                  aria-label="Preview progress"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="bg-sw-surface-2 h-1.5 overflow-hidden rounded-full transition-all group-hover:h-2">
                    <div
                      className="bg-sw-pink h-full rounded-full transition-[width] duration-150 ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="text-sw-text-dim/80 mt-2 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <Volume2 className="size-3" aria-hidden="true" />
                    30-second preview
                    <kbd className="border-sw-line bg-sw-surface-2/60 ml-1 hidden rounded border px-1.5 py-px font-sans text-[0.625rem] sm:inline">
                      space
                    </kbd>
                  </span>
                  <span className="tnum">
                    {formatTime(elapsed)} / {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>

            <audio
              // Keying on the mode forces a fresh element for the retry
              // below - crossOrigin is only read when the source is loaded.
              key={allowAnalysis ? "cors" : "plain"}
              ref={audioRef}
              src={src}
              crossOrigin={allowAnalysis ? "anonymous" : undefined}
              preload="metadata"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
              onError={() => {
                // First failure may be the crossorigin request being refused.
                // Drop it and try again plainly: no spectrum, but it plays.
                if (allowAnalysis) setAllowAnalysis(false);
              }}
              onEnded={() => {
                setPlaying(false);
                setElapsed(0);
              }}
            />
          </>
        ) : (
          <p className="text-sw-text-dim mt-4 text-sm">
            No preview audio is available for this track.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** 27.4 -> "0:27" */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
