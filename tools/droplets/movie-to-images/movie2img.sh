#!/bin/bash
# movie2img.sh — engine for the "Movie to Images" droplet.
#
# Each dropped VIDEO -> a folder of full-resolution PNG frames, sampled at a few
# frames per second, saved NEXT TO the source video in a "<name> frames" folder.
# Prints a machine-readable summary on stdout for the AppleScript wrapper.

HERE="$(cd "$(dirname "$0")" && pwd)"
FF="$HERE/ffmpeg"
LOG="$HOME/Desktop/movie-to-images.log"

# ---- tunables ----
FPS_SAMPLE=2        # frames extracted per second of video (a few/sec)
# ------------------

printf '\n[%s] --- run start (%d item[s], fps=%s) ---\n' "$(date)" "$#" "$FPS_SAMPLE" >> "$LOG"

# True if ffmpeg sees a real video stream in the file (works for ANY container:
# mov, mp4, mkv, avi, webm, m4v, wmv, flv, mts, mxf, … — no extension allowlist).
has_video_stream() {
  "$FF" -hide_banner -i "$1" 2>&1 | grep -qE 'Stream #[0-9].*: Video:'
}

created=0; errors=0; outs=()

for f in "$@"; do
  ext="$(printf '%s' "${f##*.}" | tr '[:upper:]' '[:lower:]')"
  # Never treat a still image as a movie (ffmpeg reports images as a "Video:" stream too).
  case "$ext" in
    png|jpg|jpeg|heic|heif|bmp|tif|tiff|webp|gif) continue ;;
  esac
  [ -f "$f" ] || { errors=$((errors+1)); printf '  missing: %s\n' "$f" >> "$LOG"; continue; }
  # Accept any file that actually contains video, whatever its extension.
  has_video_stream "$f" || { printf '  skipped (no video stream): %s\n' "$f" >> "$LOG"; continue; }

  dir="$(dirname "$f")"
  bn="${f##*/}"; bn="${bn%.*}"
  outdir="$dir/$bn frames"
  n=1; while [ -e "$outdir" ]; do outdir="$dir/$bn frames $n"; n=$((n+1)); done
  mkdir -p "$outdir" || { errors=$((errors+1)); printf '  mkdir FAILED: %s\n' "$outdir" >> "$LOG"; continue; }

  # Extract frames. -vsync vfr with fps filter yields evenly-sampled frames.
  # Full native resolution (no scaling); ffmpeg auto-rotates via the container's
  # rotation matrix so portrait phone videos come out upright.
  if "$FF" -y -i "$f" -vf "fps=$FPS_SAMPLE" -vsync vfr "$outdir/${bn}_%04d.png" >>"$LOG" 2>&1; then
    cnt="$(ls "$outdir"/*.png 2>/dev/null | wc -l | tr -d ' ')"
    if [ "$cnt" -gt 0 ]; then
      created=$((created+1)); outs+=("$outdir")
      printf '  ok: %s -> %s (%s frames)\n' "$f" "$outdir" "$cnt" >> "$LOG"
    else
      errors=$((errors+1)); rmdir "$outdir" 2>/dev/null
      printf '  no frames produced: %s\n' "$f" >> "$LOG"
    fi
  else
    errors=$((errors+1)); rm -rf "$outdir"
    printf '  FFMPEG FAILED: %s\n' "$f" >> "$LOG"
  fi
done

echo "CREATED=$created ERRORS=$errors"
for o in "${outs[@]}"; do echo "OUT:$o"; done
