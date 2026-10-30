#!/usr/bin/env bash
# Rebuild the browser versions of MLow's tools into docs/tools/ from tools/.
# Spinlab (the page) is built from tools/spinlab-v5; V3 and V2 keep their own pages.
#
#   scripts/build-site-tools.sh            build all five
#   scripts/build-site-tools.sh spinlab    build only the named ones
#                                          (mosh-lab svg-forge-3d spinlab spinlab-v3 spinlab-v2 m-texture)
#
# tools/ is never modified. Builds happen in a temp dir that is deleted at the end,
# so the repo never gets node_modules. Web-only changes live in site-tools-patch.py.
#
# Node modules:
#   SVG Forge 3D  npm install in the temp dir (three + esbuild, about 40 MB).
#   Spinlab       set SPINLAB_NODE_MODULES to an existing node_modules that has vite 8,
#                 @vitejs/plugin-react, react 19, three, gifenc and @tailwindcss/postcss 4
#                 to skip the install.
#                 Otherwise only those packages are installed in the temp dir.
#
# Running it twice gives the same docs/tools/ (every target is replaced whole).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="$ROOT/tools"
OUT="$ROOT/docs/tools"
PATCH="python3 $ROOT/scripts/site-tools-patch.py"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/mvibe-site.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

TARGETS=("$@")
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(mosh-lab svg-forge-3d spinlab spinlab-v3 spinlab-v2 m-texture)

[ -f "$ROOT/docs/shared/mvibe.js" ] || { echo "docs/shared/mvibe.js is missing" >&2; exit 1; }
[ -f "$ROOT/docs/assets/demo/mlow-helmet.glb" ] || { echo "docs/assets/demo/mlow-helmet.glb is missing" >&2; exit 1; }
mkdir -p "$OUT"

say() { printf '\n== %s\n' "$*"; }

# fresh() DIR: empty the target so files a tool dropped do not linger
fresh() { rm -rf "$1"; mkdir -p "$1"; }

build_mosh_lab() {
  say "MOSH LAB"
  local dst="$OUT/mosh-lab"
  fresh "$dst"
  cp "$TOOLS/mosh-lab/app/"{index.html,brand-assets.js,effects.js,overlays.js,app.js,casino.js} "$dst/"
  # MOSH LAB stamps its own MLOW wordmark into every export, so the hook adds metadata only.
  $PATCH head "$dst/index.html" --slug mosh-lab --name "MOSH LAB" \
    --title "MOSH LAB by MLow" --visible self --pill bottom-left \
    --desc "A glitch instrument with 60 stackable effects. Make loop perfect GIFs and videos in your browser. An MLow tool."
}

build_svg_forge() {
  say "SVG Forge 3D"
  local src="$TMP/svg-forge-3d" dst="$OUT/svg-forge-3d"
  mkdir -p "$src"
  cp "$TOOLS/svg-forge-3d/package.json" "$src/"
  cp -R "$TOOLS/svg-forge-3d/Web" "$src/Web"
  (cd "$src" && npm install --no-audit --no-fund --loglevel=error && npm run bundle --silent)
  fresh "$dst"
  cp "$src/Web/"{index.html,styles.css,app.js,three-engine.js} "$dst/"
  $PATCH head "$dst/index.html" --slug svg-forge-3d --name "SVG Forge 3D" \
    --title "SVG Forge 3D by MLow" --pill bottom-left \
    --desc "Turn SVG art into 3D. Export GLB, STL and PNG in your browser. An MLow tool."
}

# build_spinlab SRC_NAME SLUG DISPLAY_NAME TITLE DESC
build_spinlab() {
  local name="$1" slug="$2" display="$3" title="$4" desc="$5"
  say "$display (from tools/$name)"
  local src="$TMP/$name" dst="$OUT/$slug"
  mkdir -p "$src"
  (cd "$TOOLS/$name" && tar cf - --exclude node_modules --exclude desktop-dist --exclude 'release*' --exclude .next --exclude runs .) | (cd "$src" && tar xf -)
  if [ -n "${SPINLAB_NODE_MODULES:-}" ]; then
    ln -s "$SPINLAB_NODE_MODULES" "$src/node_modules"
  else
    # Only what desktop.vite.config.ts needs; the full Electron/Next tree is not required.
    (cd "$src" && mv package.json package.full.json && printf '{"name":"%s-web","private":true,"type":"module"}\n' "$slug" > package.json \
      && npm install --no-audit --no-fund --loglevel=error vite@8.0.13 @vitejs/plugin-react@6.0.2 react@19.2.6 react-dom@19.2.6 three@0.185.1 gifenc@1.0.3 \
         tailwindcss@4.2.1 @tailwindcss/postcss@4.2.1)
  fi
  $PATCH spinlab "$src" --title "$title"
  (cd "$src" && ./node_modules/.bin/vite build --config desktop.vite.config.ts --logLevel warn)
  local built="$src/desktop-dist"
  # Next.js template icons are not used by the studio
  rm -f "$built/"{file.svg,globe.svg,window.svg,og.png}
  fresh "$dst"
  cp -R "$built/." "$dst/"
  $PATCH head "$dst/index.html" --slug "$slug" --name "$display" --title "$title" \
    --visible self --pill bottom-left --desc "$desc"
}

build_m_texture() {
  say "~M.Texture~"
  local dst="$OUT/m-texture"
  fresh "$dst"
  cp -R "$TOOLS/m-texture/docs/." "$dst/"
  $PATCH mtexture "$dst"
  $PATCH head "$dst/index.html" --slug m-texture --name "~M.Texture~" \
    --title "~M.Texture~ by MLow" --pill top-right \
    --desc "Wrap your 3D models in your 2D art and download a GLB. Runs in your browser. An MLow tool."
}

for t in "${TARGETS[@]}"; do
  case "$t" in
    mosh-lab) build_mosh_lab ;;
    svg-forge-3d) build_svg_forge ;;
    spinlab) build_spinlab spinlab-v5 spinlab "Spinlab" "Spinlab by MLow" \
      "Spin a GLB through 42 built worlds and export a looping GIF, MP4 or poster. Runs in your browser. An MLow tool." ;;
    spinlab-v3) build_spinlab spinlab-v3 spinlab-v3 "Spinlab V3" "Spinlab V3 by MLow" \
      "The Spinlab the WRAPPED tokens render with, frozen. Spin a GLB and export a looping GIF in your browser. An MLow tool." ;;
    spinlab-v2) build_spinlab spinlab-v2 spinlab-v2 "Spinlab V2" "Spinlab V2 by MLow" \
      "The earlier Spinlab studio. Spin a GLB and export a GIF or video in your browser. An MLow tool." ;;
    m-texture) build_m_texture ;;
    *) echo "unknown target: $t" >&2; exit 2 ;;
  esac
done

say "done"
for t in "${TARGETS[@]}"; do du -sh "$OUT/$t"; done
