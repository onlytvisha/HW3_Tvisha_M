"use client";

import { ExternalLink, Music4, Pause, Play, Volume2 } from "lucide-react";
import { useRef, useState } from "react";

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
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  // Reset the transport if this component is handed a different track.
  // Adjusted during render rather than in an effect, so a stale progress bar
  // is never committed to the screen first.
  const src = profile.top_track_preview_url;
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setPlaying(false);
    setElapsed(0);
  }

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
    <Card className="sw-card overflow-hidden">
      <CardContent className="px-5">
        <div className="flex items-start gap-4">
          {profile.top_track_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.top_track_image}
              alt=""
              className="size-20 shrink-0 rounded-lg object-cover shadow-lg"
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
                  </span>
                  <span className="tnum">
                    {formatTime(elapsed)} / {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={src}
              preload="metadata"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
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
