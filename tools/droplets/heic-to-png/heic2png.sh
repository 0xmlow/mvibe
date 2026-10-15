#!/bin/bash
# heic2png.sh — engine for the "HEIC to PNG" droplet.
#
# Each dropped HEIC/HEIF -> an UPRIGHT, full-resolution PNG saved next to the
# source (same folder). Uses macOS Quick Look (`qlmanage`) to decode, because it
# honors HEIC orientation and renders at native resolution. `sips` is only a
# fallback: it ignores orientation and dumps the raw sensor buffer, so portrait
# iPhone shots would come out sideways.
# Prints a machine-readable summary on stdout for the AppleScript wrapper.

LOG="$HOME/Desktop/heic-to-png.log"
printf '\n[%s] --- run start (%d item[s]) ---\n' "$(date)" "$#" >> "$LOG"

# Decode SRC to an upright, full-resolution PNG at OUT via Quick Look.
# md (max longest side) = larger of the ORIENTED display dims from Spotlight
# metadata; falls back to the sips buffer dims, else 4096. -> 0 ok, 1 fail.
upright_png() {
  local SRC="$1" OUT="$2" md dw dh
  dw="$(mdls -name kMDItemPixelWidth  -raw "$SRC" 2>/dev/null)"
  dh="$(mdls -name kMDItemPixelHeight -raw "$SRC" 2>/dev/null)"
  case "$dw" in ''|*[!0-9]*) dw=0;; esac
  case "$dh" in ''|*[!0-9]*) dh=0;; esac
  md="$dw"; [ "$dh" -gt "$md" ] && md="$dh"
  if [ "$md" -le 0 ]; then
    dw="$(sips -g pixelWidth  "$SRC" 2>/dev/null | awk '/pixelWidth/{print $2}')"
    dh="$(sips -g pixelHeight "$SRC" 2>/dev/null | awk '/pixelHeight/{print $2}')"
    case "$dw" in ''|*[!0-9]*) dw=0;; esac
    case "$dh" in ''|*[!0-9]*) dh=0;; esac
    md="$dw"; [ "$dh" -gt "$md" ] && md="$dh"
  fi
  [ "$md" -le 0 ] && md=4096
  local qd; qd="$(mktemp -d /tmp/heic2png_ql.XXXXXX)"
  qlmanage -t -s "$md" -o "$qd" "$SRC" >>"$LOG" 2>&1
  local ql; ql="$(ls "$qd"/*.png 2>/dev/null | head -1)"
  if [ -n "$ql" ] && [ -s "$ql" ]; then mv "$ql" "$OUT"; rm -rf "$qd"; return 0; fi
  rm -rf "$qd"; return 1
}

created=0; errors=0; outs=()

for f in "$@"; do
  ext="$(printf '%s' "${f##*.}" | tr '[:upper:]' '[:lower:]')"
  case "$ext" in
    heic|heif) ;;
    *) continue ;;                       # only convert HEIC/HEIF; ignore anything else
  esac
  [ -f "$f" ] || { errors=$((errors+1)); printf '  missing: %s\n' "$f" >> "$LOG"; continue; }

  dir="$(dirname "$f")"
  bn="${f##*/}"; bn="${bn%.*}"
  out="$dir/$bn.png"
  n=1; while [ -e "$out" ]; do out="$dir/$bn-$n.png"; n=$((n+1)); done

  if upright_png "$f" "$out"; then
    created=$((created+1)); outs+=("$out")
    printf '  ok (quicklook): %s -> %s\n' "$f" "$out" >> "$LOG"
  elif sips -s format png "$f" --out "$out" >>"$LOG" 2>&1 && [ -s "$out" ]; then
    created=$((created+1)); outs+=("$out")
    printf '  ok (sips fallback, orientation may be raw): %s -> %s\n' "$f" "$out" >> "$LOG"
  else
    errors=$((errors+1)); rm -f "$out"
    printf '  FAILED: %s\n' "$f" >> "$LOG"
  fi
done

echo "CREATED=$created ERRORS=$errors"
for o in "${outs[@]}"; do echo "OUT:$o"; done
