#!/bin/bash
# photo2png.sh — engine for the "RAW + HEIC to PNG" droplet.
#
# Each dropped HEIC/HEIF or camera RAW (NEF, CR2/CR3, ARW, RAF, RW2, ORF, DNG, …)
# -> an UPRIGHT, full-resolution PNG saved next to the source (same folder).
#
# Decoding goes through macOS Quick Look (`qlmanage`), which:
#   - honors orientation (sips and ffmpeg dump the raw sensor buffer -> sideways), and
#   - runs the system RAW pipeline (demosaic + camera color profile) so RAW colors
#     come out looking like the shot, not flat/grey.
# RAW decodes come back 16-bit; we losslessly flatten those to standard 8-bit sRGB
# PNG (smaller, opens everywhere) via a BMP round-trip. Colors are unchanged.
# Prints a machine-readable summary on stdout for the AppleScript wrapper.

LOG="$HOME/Desktop/photo-to-png.log"
printf '\n[%s] --- run start (%d item[s]) ---\n' "$(date)" "$#" >> "$LOG"

# Losslessly flatten a >8-bit PNG to 8-bit in place (RAW decodes are 16-bit).
# BMP is 8-bit/channel and uncompressed, so the round-trip loses no color. No-op
# for already-8-bit images (HEIC), so this is safe to call on every decode.
flatten_8bit() {
  local P="$1" bps d
  bps="$(sips -g bitsPerSample "$P" 2>/dev/null | awk '/bitsPerSample/{print $2}')"
  case "$bps" in ''|*[!0-9]*) return 0;; esac
  [ "$bps" -le 8 ] && return 0
  d="$(mktemp -d /tmp/photo2png_f8.XXXXXX)"
  if sips -s format bmp "$P" --out "$d/m.bmp" >>"$LOG" 2>&1 \
     && sips -s format png "$d/m.bmp" --out "$d/o.png" >>"$LOG" 2>&1 \
     && [ -s "$d/o.png" ]; then
    mv "$d/o.png" "$P"
  fi
  rm -rf "$d"
}

# Decode SRC to an upright, full-resolution 8-bit PNG at OUT via Quick Look.
# md (max longest side) = larger of the ORIENTED display dims from Spotlight
# metadata; falls back to the sips buffer dims, else 8192. -> 0 ok, 1 fail.
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
  [ "$md" -le 0 ] && md=8192
  local qd; qd="$(mktemp -d /tmp/photo2png_ql.XXXXXX)"
  qlmanage -t -s "$md" -o "$qd" "$SRC" >>"$LOG" 2>&1
  local ql; ql="$(ls "$qd"/*.png 2>/dev/null | head -1)"
  if [ -n "$ql" ] && [ -s "$ql" ]; then
    flatten_8bit "$ql"            # flatten in temp first, so OUT appears only once (8-bit)
    mv "$ql" "$OUT"; rm -rf "$qd"; return 0
  fi
  rm -rf "$qd"; return 1
}

created=0; errors=0; outs=()

for f in "$@"; do
  ext="$(printf '%s' "${f##*.}" | tr '[:upper:]' '[:lower:]')"
  case "$ext" in
    heic|heif|nef|nrw|cr2|cr3|crw|arw|sr2|srf|raf|rw2|orf|dng|pef|raw|3fr|dcr|erf|mrw|x3f) ;;
    *) continue ;;                       # only HEIC + camera RAW; ignore anything else
  esac
  [ -f "$f" ] || { errors=$((errors+1)); printf '  missing: %s\n' "$f" >> "$LOG"; continue; }

  dir="$(dirname "$f")"
  bn="${f##*/}"; bn="${bn%.*}"
  out="$dir/$bn.png"
  n=1; while [ -e "$out" ]; do out="$dir/$bn-$n.png"; n=$((n+1)); done

  if upright_png "$f" "$out" && [ -s "$out" ]; then
    created=$((created+1)); outs+=("$out")
    printf '  ok (quicklook): %s -> %s\n' "$f" "$out" >> "$LOG"
  elif sips -s format png "$f" --out "$out" >>"$LOG" 2>&1 && [ -s "$out" ]; then
    flatten_8bit "$out"
    created=$((created+1)); outs+=("$out")
    printf '  ok (sips fallback, orientation may be raw): %s -> %s\n' "$f" "$out" >> "$LOG"
  else
    errors=$((errors+1)); rm -f "$out"
    printf '  FAILED: %s\n' "$f" >> "$LOG"
  fi
done

echo "CREATED=$created ERRORS=$errors"
for o in "${outs[@]}"; do echo "OUT:$o"; done
