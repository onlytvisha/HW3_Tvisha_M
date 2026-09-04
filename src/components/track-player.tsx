"use client";

import { ExternalLink, Music4, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ArtistAvatar } from "@/components/artist-avatar";
import { AudioSpectrum } from "@/components/audio-spectrum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Artist, ArtistProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { youtubeMusicLink } from "@/lib/youtube";

type PlayableSong = {
  rank: number;
  video_id: string;
  track_name: string;
  thumbnail: string | null;
  previewUrl: string | null;
  artworkUrl: string | null;
};

/**
 * Merges the pipeline's ranked track list with the request-time preview
 * lookup for each of them, keyed on video_id. A song YouTube Music resolved
 * but Apple had no preview for still gets an entry - just one with no
 * previewUrl, which the player treats as "playable on YouTube Music only".
 */
function mergeSongs(artist: Artist, profile: ArtistProfile): PlayableSong[] {
  const previews = new Map(profile.track_previews.map((p) => [p.video_id, p]));

  return (artist.top_songs ?? []).map((song) => {
    const preview = previews.get(song.video_id);
    return {
      rank: song.rank,
      video_id: song.video_id,
      track_name: song.track_name,
      thumbnail: song.thumbnail,
      previewUrl: preview?.preview_url ?? null,
      artworkUrl: preview?.artwork_url ?? null,
    };
  });
}

/**
 * The recorder: a vinyl disk either side of the transport, playing whichever
 * of the artist's top 5 YouTube Music tracks is selected.
 *
 * Two ways to hear a track, which is deliberate:
 *
 *   the preview   a real, permanent 30-second file from Apple, played by a
 *                 plain <audio> element with a transport built to match the
 *                 page. It is CORS-readable, which is what lets the spectrum
 *                 above the scrub bar be the actual audio rather than an
 *                 animation on a timer.
 *   YouTube Music the whole song, free, no account. The preview is a sample;
 *                 this is the record. It is a link rather than an embed
 *                 because a YouTube iframe is cross-origin, so Web Audio
 *                 cannot read it - embedding it here would have silently
 *                 cost the visualiser.
 */
export function TrackPlayer({
  artist,
  profile,
}: {
  artist: Artist;
  profile: ArtistProfile;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // The spectrum needs the element marked crossorigin, and Apple's preview
  // CDN sends the header for it. If it ever stops, the request fails
  // outright rather than degrading, so a load error drops the attribute and
  // retries once: the visualiser is worth having, never at the cost of the
  // audio.
  const [allowAnalysis, setAllowAnalysis] = useState(true);

  const songs = mergeSongs(artist, profile);
  const song = songs[selectedIndex];
  const src = song?.previewUrl ?? null;

  // Reset the transport when the selected track changes. Adjusted during
  // render rather than in an effect, so a stale progress bar or a previous
  // track's loudness glow is never committed to the screen first.
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

  // Computed before the early return so both branches can offer it. There is
  // always somewhere to send a listener: with no resolved video id at all,
  // this degrades to a YouTube Music search, which needs nothing fetched and
  // no key.
  const youtube = song
    ? youtubeMusicLink({ artistName: artist.name, videoId: song.video_id })
    : youtubeMusicLink({ artistName: artist.name });

  if (songs.length === 0) {
    return (
      <Card className="sw-card">
        <CardContent className="px-5">
          <div className="text-sw-text-dim flex items-center gap-3 text-sm">
            <Music4 className="size-4 shrink-0" aria-hidden="true" />
            <p>
              No playable tracks came back for this artist. They may be listed
              under a different name in the catalogues we search.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <a href={youtube.href} target="_blank" rel="noreferrer noopener">
              <Music4 className="size-3.5" />
              Find {artist.name} on YouTube Music
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </Button>
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-sw-pink/15 text-sw-pink border-sw-pink/40 border text-[0.6875rem]">
            #{song.rank} on YouTube Music
          </Badge>
          <Badge
            variant="outline"
            className="text-sw-text-dim border-sw-line text-[0.6875rem]"
          >
            30-second preview via Apple
          </Badge>
          <div className="flex-1" />
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Open this track in a new tab"
          >
            <a href={youtube.href} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>

        {/* The recorder: two disks flank the transport. data-playing switches
            their spin on; the glow on each reads --np-level, which cascades
            down from .np-card above and is updated once a frame by the
            spectrum, same technique the sleeve art elsewhere on the site
            uses to "breathe" with the track. */}
        <div
          className="recorder mt-5 flex items-center gap-4 sm:gap-6"
          data-playing={playing ? "true" : "false"}
        >
          <div
            className="recorder-disk size-14 shrink-0 sm:size-20"
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-base font-semibold sm:text-lg">
              {song.track_name}
            </p>

            {src ? (
              <>
                <AudioSpectrum
                  audioRef={audioRef}
                  playing={playing}
                  levelTarget={cardRef}
                  className={`mx-auto block w-full max-w-xs transition-all duration-500 ${
                    playing ? "mt-2 mb-1 h-8" : "mt-0 mb-0 h-0"
                  }`}
                />

                <div
                  onClick={seek}
                  className="play-slider relative mx-auto mt-3 max-w-xs cursor-pointer py-2"
                  role="progressbar"
                  aria-label="Preview progress"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="slider-track bg-sw-surface-2 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="slider-fill bg-sw-pink h-full rounded-full transition-[width] duration-150 ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div
                    className="slider-knob"
                    style={{ left: `${progress}%` }}
                  />
                </div>

                <div className="timestamps text-sw-text-dim/80 tnum mt-1.5 flex items-center justify-center gap-2 text-xs">
                  <span>{formatTime(elapsed)}</span>
                  <span>/</span>
                  <span>{formatTime(duration)}</span>
                </div>

                <audio
                  // Keying on the mode forces a fresh element for the retry
                  // below - crossOrigin is only read when the source is
                  // loaded. One persistent element per selected track: this
                  // remounts on a CORS retry, never on a track switch, since
                  // AudioSpectrum can only register a source node once per
                  // <audio> element.
                  key={allowAnalysis ? "cors" : "plain"}
                  ref={audioRef}
                  src={src}
                  crossOrigin={allowAnalysis ? "anonymous" : undefined}
                  preload="metadata"
                  onLoadedMetadata={(e) =>
                    setDuration(e.currentTarget.duration)
                  }
                  onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
                  onError={() => {
                    if (allowAnalysis) setAllowAnalysis(false);
                  }}
                  onEnded={() => {
                    setPlaying(false);
                    setElapsed(0);
                  }}
                />

                <button
                  onClick={toggle}
                  className="play-circle border-sw-pink bg-sw-pink text-sw-void hover:bg-sw-pink/90 mt-3 inline-flex size-11 items-center justify-center rounded-full border shadow-md transition-colors"
                  aria-label={
                    playing
                      ? `Pause ${song.track_name}`
                      : `Play ${song.track_name}`
                  }
                >
                  {playing ? (
                    <Pause className="size-4.5 fill-current" />
                  ) : (
                    <Play className="size-4.5 translate-x-0.5 fill-current" />
                  )}
                </button>
              </>
            ) : (
              <p className="text-sw-text-dim mt-3 text-sm">
                No preview audio for this track.
              </p>
            )}
          </div>

          <div
            className="recorder-disk size-14 shrink-0 sm:size-20"
            aria-hidden="true"
          />
        </div>

        {/* The top 5, as a switchable row. Selecting one swaps the <audio>
            src in place rather than mounting a second element. */}
        {songs.length > 1 && (
          <div className="mt-5 flex items-center justify-center gap-2 overflow-x-auto pb-1">
            {songs.map((s, i) => (
              <button
                key={s.video_id}
                onClick={() => setSelectedIndex(i)}
                aria-label={`Play ${s.track_name}`}
                aria-pressed={i === selectedIndex}
                className={cn(
                  "shrink-0 rounded-md transition-all",
                  i === selectedIndex
                    ? "ring-sw-pink ring-2 ring-offset-2 ring-offset-transparent"
                    : "opacity-60 hover:opacity-100",
                )}
              >
                <ArtistAvatar
                  name={s.track_name}
                  imageUrl={s.artworkUrl ?? s.thumbnail}
                  className="size-9 rounded-md text-xs"
                />
              </button>
            ))}
          </div>
        )}

        {/* The preview is a sample; this is the record. Sits below the
            transport rather than beside it because it leaves the site, and a
            link that navigates away should not sit in the same row as the
            control that plays in place. */}
        <div className="border-sw-line/60 mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-sw-pink/40 text-sw-pink hover:bg-sw-pink/10 hover:text-sw-pink"
          >
            <a href={youtube.href} target="_blank" rel="noreferrer noopener">
              <Music4 className="size-3.5" aria-hidden="true" />
              Listen on YouTube Music
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </Button>

          <p className="text-sw-text-dim/80 text-xs">
            {youtube.exact
              ? "Full track, free, no account needed."
              : "Opens a search - we have no exact match for this one yet."}
          </p>
        </div>
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
