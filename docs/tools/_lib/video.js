/* video.js: decode a dropped video with the browser's own <video> element.
 * Frames are pulled by seeking, so every frame lands on an exact time. The browser applies
 * the container's rotation, so portrait phone clips come out upright. */

export class VideoError extends Error {}

export function cannotDecodeMessage(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const hint = ext === "mov" || ext === "hevc"
    ? "iPhone MOV files are often HEVC. Safari, and Chrome on a Mac, can read those. Firefox and many Windows browsers cannot."
    : ext === "mkv" || ext === "avi" || ext === "wmv" || ext === "flv" || ext === "mpg" || ext === "mpeg" || ext === "ts" || ext === "mts" || ext === "m2ts" || ext === "3gp"
      ? `Browsers rarely play .${ext} files. Convert it to MP4 (H.264) first.`
      : "Try another browser, or convert it to MP4 (H.264).";
  return `This browser cannot decode ${file.name}. ${hint}`;
}

export async function openVideo(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto"; video.crossOrigin = "anonymous";
  // Some engines only decode frames for a video that is attached to the document.
  video.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.appendChild(video);
  const close = () => { video.removeAttribute("src"); video.load(); video.remove(); URL.revokeObjectURL(url); };
  try {
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new VideoError(cannotDecodeMessage(file))), 30000);
      video.onloadeddata = () => { clearTimeout(t); res(); };
      video.onerror = () => { clearTimeout(t); rej(new VideoError(cannotDecodeMessage(file))); };
      video.src = url;
    });
    if (!video.videoWidth || !video.videoHeight) throw new VideoError(cannotDecodeMessage(file) + " (no picture track was found)");
    let duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      // Streams without a duration in the header: seek far to make the browser find the end.
      await seekFrame(video, 1e7);
      duration = video.duration;
      if (!isFinite(duration) || duration <= 0) duration = video.currentTime || 0;
    }
    if (!(duration > 0)) throw new VideoError(`${file.name} has no readable length.`);
    return { video, width: video.videoWidth, height: video.videoHeight, duration, close };
  } catch (e) {
    close();
    throw e;
  }
}

let rvfcWorks = null; // learned on the first seek
export function seekFrame(video, t) {
  return new Promise((res) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; res(); } };
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      if ("requestVideoFrameCallback" in video && rvfcWorks !== false) {
        // Wait until the new frame is really composited (matters in Safari).
        const timer = setTimeout(() => { if (rvfcWorks === null) rvfcWorks = false; done(); }, 120);
        video.requestVideoFrameCallback(() => { rvfcWorks = true; clearTimeout(timer); done(); });
      } else {
        done();
      }
    };
    video.addEventListener("seeked", onSeeked);
    const target = Math.max(0, t + 0.0005);
    if (Math.abs(video.currentTime - target) < 1e-6) { video.removeEventListener("seeked", onSeeked); done(); return; }
    video.currentTime = target;
  });
}
