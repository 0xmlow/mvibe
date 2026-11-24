#!/bin/bash
# convert.sh — engine for the "MP4 to GIF" droplets.
#
# Usage:  convert.sh [--x | --both] [--max-mb N] <file> [<file> ...]
#   - each video  -> its own high-quality GIF (next to the source)
#   - all images  -> one unified animated GIF (slideshow, ordered by name)
#   - with --max-mb N, every produced GIF is fit under N megabytes while
#     preserving as much fidelity/resolution as possible.
#   - with --x, every GIF is made to post on X (Twitter): it fits inside
#     1280 x 1080, has at most 350 frames and stays under 5 MB, the limit for
#     posting from the phone app (pass --max-mb 15 after --x for web only).
#     Output is named <name>_X.gif.
#   - with --both, each input gets the max quality GIF AND the _X.gif.
# Prints a machine-readable summary on stdout for the AppleScript wrapper.

HERE="$(cd "$(dirname "$0")" && pwd)"
FF="$HERE/ffmpeg"
LOG="$HOME/Desktop/mp4-to-gif.log"

# ---- tunables ----
FPS=20              # frames/sec for video GIFs
IMG_SECONDS=0.6     # seconds each image is shown in the unified GIF
IMG_MAX_DIM=2560    # cap longest side of the unified image GIF (keeps detail)
IMG_SATURATION=1.40 # color pop for the image slideshow (1.0 = untouched)
IMG_CONTRAST=1.10   # slight contrast boost (1.0 = untouched)
PAD_COLOR=white     # (unused; kept for reference)
# ------------------

# ---- X (Twitter) limits, checked 2026-11 ----
X_MAX_W=1280        # GIF resolution cap on X
X_MAX_H=1080
X_MAX_FRAMES=350    # X refuses GIFs with more frames
X_MB=5              # phone app limit (web allows 15)
# ------------------

# ---- options ----
TARGET=0            # bytes; 0 = no limit (max quality)
BOXF=""             # extra scale filter that fits the frame in a box (X mode)
MAX_FRAMES=0        # 0 = no frame cap
SUFFIX=""           # appended to output names (X mode: _X)
XMODE=0; BOTH=0; MB=""
while [ $# -gt 0 ]; do
  case "$1" in
    --max-mb) MB="$2"; shift 2 ;;
    --x)      XMODE=1; shift ;;
    --both)   BOTH=1; shift ;;
    *) break ;;
  esac
done

# --both: run once at max quality and once for X, then report both together.
if [ "$BOTH" -eq 1 ]; then
  xargs_mb=(); [ -n "$MB" ] && xargs_mb=(--max-mb "$MB")
  a="$("$0" "$@")"; b="$("$0" --x "${xargs_mb[@]}" "$@")"
  c1="$(printf '%s\n%s\n' "$a" "$b" | awk -F'[= ]' '/^CREATED=/{c+=$2; e+=$4} END{print c+0, e+0}')"
  echo "CREATED=${c1% *} ERRORS=${c1#* }"
  printf '%s\n%s\n' "$a" "$b" | grep '^OUT:'
  exit 0
fi

if [ "$XMODE" -eq 1 ]; then
  [ -z "$MB" ] && MB="$X_MB"
  BOXF="scale=w='min(iw\,$X_MAX_W)':h='min(ih\,$X_MAX_H)':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,"
  MAX_FRAMES="$X_MAX_FRAMES"
  SUFFIX="_X"
fi
if [ -n "$MB" ]; then
  # decimal MB with a 3% safety margin so we land safely under the stated limit
  TARGET="$(awk -v m="$MB" 'BEGIN{printf "%d", m*1000000*0.97}')"
fi

printf '\n[%s] --- run start (target=%s bytes, x=%s, %d item[s]) ---\n' "$(date)" "$TARGET" "$XMODE" "$#" >> "$LOG"

# Seconds of a video, read from ffmpeg's banner (the droplet bundles ffmpeg only).
duration() {
  "$FF" -hide_banner -i "$1" 2>&1 | awk -F'[:, ]+' '/Duration:/{print $3*3600+$4*60+$5; exit}'
}

filesize() { stat -f%z "$1" 2>/dev/null || echo 0; }
gt() { awk -v a="$1" -v b="$2" 'BEGIN{exit !(a>b)}'; }   # a > b ?

# Decode a still image to an UPRIGHT, full-resolution PNG via macOS Quick Look,
# which honors HEIC/EXIF orientation. Neither `sips -s format png` nor the bundled
# ffmpeg apply orientation — they emit the raw sensor buffer, so portrait iPhone
# shots (landscape buffer + rotate flag) came out sideways. Quick Look bakes the
# rotation in. args: SRC OUTPNG -> 0 on success (OUTPNG written), 1 on failure.
upright_png() {
  local SRC="$1" OUT="$2" md dw dh
  dw="$(mdls -name kMDItemPixelWidth  -raw "$SRC" 2>/dev/null)"
  dh="$(mdls -name kMDItemPixelHeight -raw "$SRC" 2>/dev/null)"
  case "$dw" in ''|*[!0-9]*) dw=0;; esac
  case "$dh" in ''|*[!0-9]*) dh=0;; esac
  md="$dw"; [ "$dh" -gt "$md" ] && md="$dh"
  if [ "$md" -le 0 ]; then           # mdls gave nothing -> fall back to sips buffer
    dw="$(sips -g pixelWidth  "$SRC" 2>/dev/null | awk '/pixelWidth/{print $2}')"
    dh="$(sips -g pixelHeight "$SRC" 2>/dev/null | awk '/pixelHeight/{print $2}')"
    case "$dw" in ''|*[!0-9]*) dw=0;; esac
    case "$dh" in ''|*[!0-9]*) dh=0;; esac
    md="$dw"; [ "$dh" -gt "$md" ] && md="$dh"
  fi
  [ "$md" -le 0 ] && md=4096
  local qd; qd="$(mktemp -d /tmp/mp4gif_ql.XXXXXX)"
  qlmanage -t -s "$md" -o "$qd" "$SRC" >>"$LOG" 2>&1
  local ql; ql="$(ls "$qd"/*.png 2>/dev/null | head -1)"
  if [ -n "$ql" ] && [ -s "$ql" ]; then mv "$ql" "$OUT"; rm -rf "$qd"; return 0; fi
  rm -rf "$qd"; return 1
}

# 0 if the stored pixel buffer is rotated 90/270 relative to the oriented display
# size (sips buffer dims transposed vs mdls display dims) -> pixels need de-rotating.
needs_upright() {
  local SRC="$1" bw bh dw dh
  bw="$(sips -g pixelWidth  "$SRC" 2>/dev/null | awk '/pixelWidth/{print $2}')"
  bh="$(sips -g pixelHeight "$SRC" 2>/dev/null | awk '/pixelHeight/{print $2}')"
  dw="$(mdls -name kMDItemPixelWidth  -raw "$SRC" 2>/dev/null)"
  dh="$(mdls -name kMDItemPixelHeight -raw "$SRC" 2>/dev/null)"
  case "$bw" in ''|*[!0-9]*) return 1;; esac
  case "$bh" in ''|*[!0-9]*) return 1;; esac
  case "$dw" in ''|*[!0-9]*) return 1;; esac
  case "$dh" in ''|*[!0-9]*) return 1;; esac
  [ "$bw" = "$dh" ] && [ "$bh" = "$dw" ] && [ "$bw" != "$bh" ] && return 0
  return 1
}

# Fidelity ladder (best -> smallest). Applied only when TARGET>0.
# Parallel arrays: fps % of base, palette colors, dither spec.
L_FPS=(100 100 100 100 85 70 55)
L_COL=(256 256 256 200 160 128 96)
L_DIT=("sierra2_4a" "bayer:bayer_scale=5" "bayer:bayer_scale=4" "bayer:bayer_scale=3" "bayer:bayer_scale=2" "bayer:bayer_scale=2" "bayer:bayer_scale=1")
# Resolution scale-downs used only after the ladder is exhausted.
S_SCALE=(0.85 0.72 0.60 0.50 0.42 0.35 0.28 0.22)

# encode one VIDEO gif. args: IN OUT FPS COLORS DITHER SCALEEXPR
enc_video() {
  local IN="$1" OUT="$2" F="$3" C="$4" D="$5" S="$6"
  local pal; pal="$(mktemp -t mp4gif_pal).png"
  local tl=(); [ -n "$TLIM" ] && tl=(-t "$TLIM")
  "$FF" -y "${tl[@]}" -i "$IN" -vf "fps=$F,${BOXF}scale=$S:flags=lanczos,palettegen=max_colors=$C:stats_mode=diff" "$pal" >>"$LOG" 2>&1 \
  && "$FF" -y "${tl[@]}" -i "$IN" -i "$pal" -filter_complex "fps=$F,${BOXF}scale=$S:flags=lanczos[x];[x][1:v]paletteuse=dither=$D:diff_mode=rectangle" -loop 0 "$OUT" >>"$LOG" 2>&1
  local rc=$?; rm -f "$pal"; return $rc
}

# encode one IMAGE-SEQUENCE gif. args: FRAMESGLOB FR OUT COLORS DITHER SCALEEXPR
# Uses a PER-FRAME palette (stats_mode=single + new=1) so every image keeps its
# own vivid 256 colors instead of sharing one washed-out global palette.
enc_images() {
  local G="$1" FR="$2" OUT="$3" C="$4" D="$5" S="$6"
  "$FF" -y -framerate "$FR" -i "$G" -lavfi "${BOXF}scale=$S,split[a][b];[a]palettegen=max_colors=$C:stats_mode=single[p];[b][p]paletteuse=dither=$D:new=1" -loop 0 "$OUT" >>"$LOG" 2>&1
}

# Drive an encoder to hit TARGET. args: KIND SRC OUT BASEFPS(or FR)
# KIND = video|images ; SRC = input path or frames glob
fit() {
  local KIND="$1" SRC="$2" OUT="$3" BASE="$4"
  local i F C D sz
  rm -f "$OUT"

  # No target -> single best-quality encode at native res.
  if [ "$TARGET" -eq 0 ]; then
    if [ "$KIND" = "video" ]; then enc_video "$SRC" "$OUT" "$BASE" 256 "sierra2_4a" "iw:ih"
    else enc_images "$SRC" "$BASE" "$OUT" 256 "sierra2_4a" "iw:ih"; fi
    return $?
  fi

  # Phase 1: keep full resolution, walk the fidelity ladder.
  for i in 0 1 2 3 4 5 6; do
    C="${L_COL[$i]}"; D="${L_DIT[$i]}"
    if [ "$KIND" = "video" ]; then
      F="$(awk -v b="$BASE" -v p="${L_FPS[$i]}" 'BEGIN{f=b*p/100; m=(b<8)?b:8; if(f<m)f=m; printf "%d",(f+0.5)}')"
      enc_video "$SRC" "$OUT" "$F" "$C" "$D" "iw:ih" || continue
    else
      enc_images "$SRC" "$BASE" "$OUT" "$C" "$D" "iw:ih" || continue
    fi
    sz="$(filesize "$OUT")"
    printf '  ladder[%d] colors=%s dither=%s -> %s bytes\n' "$i" "$C" "$D" "$sz" >> "$LOG"
    gt "$sz" "$TARGET" || return 0
    # Fewer colours never halve a GIF. Still over twice the target once the
    # ordered dither is on? Skip the rest of the ladder and go to resizing.
    if [ "$i" -ge 1 ] && gt "$sz" "$((TARGET*2))"; then
      printf '  over 2x the target: straight to resizing\n' >> "$LOG"; break
    fi
  done

  # Phase 2: still too big -> scale resolution down at the most aggressive params.
  C="${L_COL[6]}"; D="${L_DIT[6]}"
  if [ "$KIND" = "video" ]; then
    F="$(awk -v b="$BASE" -v p="${L_FPS[6]}" 'BEGIN{f=b*p/100; m=(b<8)?b:8; if(f<m)f=m; printf "%d",(f+0.5)}')"
  fi
  for sc in "${S_SCALE[@]}"; do
    local SEXP="trunc(iw*$sc/2)*2:trunc(ih*$sc/2)*2"
    if [ "$KIND" = "video" ]; then
      enc_video "$SRC" "$OUT" "$F" "$C" "$D" "$SEXP" || continue
    else
      enc_images "$SRC" "$BASE" "$OUT" "$C" "$D" "$SEXP" || continue
    fi
    sz="$(filesize "$OUT")"
    printf '  scale[%s] -> %s bytes\n' "$sc" "$sz" >> "$LOG"
    gt "$sz" "$TARGET" || return 0
  done
  # Keep the smallest we managed, but only claim success if a file exists.
  [ -s "$OUT" ] && return 0 || return 1
}

# -------- classify inputs --------
vids=(); imgs=()
for f in "$@"; do
  ext="$(printf '%s' "${f##*.}" | tr '[:upper:]' '[:lower:]')"
  case "$ext" in
    mp4|mov|m4v|mkv|webm|avi|mpg|mpeg|wmv|flv|ts|3gp|mts|m2ts) vids+=("$f") ;;
    png|jpg|jpeg|bmp|tiff|tif|heic|heif|webp)                  imgs+=("$f") ;;
  esac
done

created=(); errors=0

# -------- videos: one GIF each --------
for v in "${vids[@]}"; do
  out="${v%.*}$SUFFIX.gif"
  vf="$FPS"; TLIM=""
  if [ "$MAX_FRAMES" -gt 0 ]; then
    # Keep under the frame cap: lower the frame rate (not below 5 fps), and
    # only if that is not enough, keep the first MAX_FRAMES/5 seconds.
    dur="$(duration "$v")"
    read vf TLIM <<EOF
$(awk -v d="${dur:-0}" -v f="$FPS" -v m="$MAX_FRAMES" 'BEGIN{
  if (d<=0 || d*f<=m) { print f, ""; exit }
  c=int(m/d); if (c>=5) { print c, ""; exit }
  printf "5 %.3f\n", m/5 }')
EOF
    printf '  %s: %ss -> %s fps%s\n' "$v" "$dur" "$vf" "${TLIM:+, first ${TLIM}s}" >> "$LOG"
  fi
  if fit video "$v" "$out" "$vf"; then created+=("$out"); else errors=$((errors+1)); fi
done
TLIM=""

# -------- images: one unified GIF --------
if [ "${#imgs[@]}" -gt 0 ]; then
  oldIFS="$IFS"; IFS=$'\n'
  sorted=($(printf '%s\n' "${imgs[@]}" | sort -V))
  IFS="$oldIFS"
  if [ "$MAX_FRAMES" -gt 0 ] && [ "${#sorted[@]}" -gt "$MAX_FRAMES" ]; then
    printf '  %d images, over the %d frame cap: keeping the first %d\n' "${#sorted[@]}" "$MAX_FRAMES" "$MAX_FRAMES" >> "$LOG"
    sorted=("${sorted[@]:0:$MAX_FRAMES}")
  fi

  tmpd="$(mktemp -d /tmp/mp4gif_frames.XXXXXX)"; norm_ok=1

  # Pre-decode to UPRIGHT PNGs. Two orientation traps we must dodge:
  #  - ffmpeg mis-reads HEIC (grabs the embedded thumbnail / a single tile), so
  #    never feed HEIC to it.
  #  - NEITHER sips NOR ffmpeg apply orientation: they emit the raw sensor buffer,
  #    so a portrait iPhone shot (landscape buffer + rotate flag) comes out sideways.
  # macOS Quick Look (`qlmanage`) decodes full-res AND honors orientation, so we use
  # it for every HEIC and for any other image whose buffer is stored rotated. Plain,
  # already-upright JPEG/PNG pass straight through (no re-encode, no color shift).
  decoded=(); di=0
  for im in "${sorted[@]}"; do
    di=$((di+1)); dn="$(printf '%04d' "$di")"
    iext="$(printf '%s' "${im##*.}" | tr '[:upper:]' '[:lower:]')"
    dpng="$tmpd/src_$dn.png"
    case "$iext" in
      heic|heif)
        if upright_png "$im" "$dpng"; then
          decoded+=("$dpng")
        elif sips -s format png "$im" --out "$dpng" >>"$LOG" 2>&1 && [ -s "$dpng" ]; then
          printf '  HEIC via sips fallback (orientation may be raw): %s\n' "$im" >> "$LOG"
          decoded+=("$dpng")
        else
          printf '  HEIC decode FAILED: %s\n' "$im" >> "$LOG"; norm_ok=0
        fi
        ;;
      *)
        if needs_upright "$im" && upright_png "$im" "$dpng"; then
          printf '  de-rotated via Quick Look: %s\n' "$im" >> "$LOG"
          decoded+=("$dpng")
        else
          decoded+=("$im")
        fi
        ;;
    esac
  done

  first="${decoded[0]}"
  # Measure the canvas from the DECODED first image. ffmpeg auto-applies EXIF
  # rotation on decode, but its -i banner reports the raw pre-rotation size —
  # using the banner made portrait photos build a landscape canvas (the "vertical
  # turned horizontal" bug). Decode one frame, then read its true upright size.
  "$FF" -y -i "$first" -frames:v 1 "$tmpd/_probe.png" >>"$LOG" 2>&1
  dims="$("$FF" -hide_banner -i "$tmpd/_probe.png" 2>&1 | grep -oE '[0-9]{2,}x[0-9]{2,}' | head -1)"
  W="${dims%x*}"; H="${dims#*x}"; [ -z "$W" ] && W=1080; [ -z "$H" ] && H=1080
  read W H <<EOF
$(awk -v w="$W" -v h="$H" -v m="$IMG_MAX_DIM" 'BEGIN{s=1; if(w>m||h>m){s=(w>h)?m/w:m/h} W=int(w*s);H=int(h*s);W-=W%2;H-=H%2; if(W<2)W=2; if(H<2)H=2; print W,H}')
EOF
  i=0
  for im in "${decoded[@]}"; do
    i=$((i+1)); n="$(printf '%04d' "$i")"
    # CROP-TO-FILL + color boost. eq runs BEFORE palettegen so the richer,
    # more saturated colors get captured in each frame's palette.
    "$FF" -y -i "$im" -vf "scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,eq=contrast=$IMG_CONTRAST:saturation=$IMG_SATURATION,setsar=1" "$tmpd/frame_$n.png" >>"$LOG" 2>&1 || norm_ok=0
  done

  outdir="$(dirname "${sorted[0]}")"
  # Name the GIF after the files it contains, plus "animation".
  nm=""; cnt="${#sorted[@]}"; k=0
  for sp in "${sorted[@]}"; do
    k=$((k+1)); [ "$k" -gt 4 ] && break
    bn="${sp##*/}"; bn="${bn%.*}"
    bn="$(printf '%s' "$bn" | tr -c 'A-Za-z0-9._-' '-')"
    if [ -z "$nm" ]; then nm="$bn"; else nm="$nm-$bn"; fi
  done
  [ "$cnt" -gt 4 ] && nm="$nm-and-$((cnt-4))-more"
  base="$(printf '%s' "$nm-animation" | sed 's/-\{2,\}/-/g; s/^-//; s/-$//' | cut -c1-120)"
  [ -z "$base" ] && base="animation"
  base="$base$SUFFIX"
  out="$outdir/$base.gif"
  n2=1; while [ -e "$out" ]; do out="$outdir/$base-$n2.gif"; n2=$((n2+1)); done
  fr="$(awk -v s="$IMG_SECONDS" 'BEGIN{printf "%.5f", 1.0/s}')"
  if [ "$norm_ok" -eq 1 ] && fit images "$tmpd/frame_%04d.png" "$out" "$fr"; then created+=("$out"); else errors=$((errors+1)); fi
  rm -rf "$tmpd"
fi

echo "CREATED=${#created[@]} ERRORS=$errors"
for c in "${created[@]}"; do echo "OUT:$c"; done
