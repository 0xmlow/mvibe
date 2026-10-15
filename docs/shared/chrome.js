/* chrome.js: the small "mvibe" pill that sits on every tool page and leads home.
 * Kept tiny and fixed so it never fights a tool's own full screen interface.
 * Pages can set <meta name="mvibe-pill" content="bottom-left"> to move it. */
(function () {
  const where = (document.querySelector('meta[name="mvibe-pill"]') || {}).content || "top-left";
  const name = (document.querySelector('meta[name="mvibe-tool-name"]') || {}).content || "";
  const depth = (document.querySelector('meta[name="mvibe-depth"]') || {}).content || "../../";
  const css = `
  .mvibe-pill{position:fixed;z-index:2147483000;display:flex;align-items:center;gap:8px;
    padding:6px 12px 6px 6px;border-radius:999px;background:rgba(1,6,27,.78);color:#eef1f7;
    font:600 12px/1 Inter,system-ui,-apple-system,Arial,sans-serif;letter-spacing:.02em;text-decoration:none;
    border:1px solid rgba(84,197,222,.28);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    box-shadow:0 10px 30px -12px rgba(0,0,0,.8);transition:transform .25s cubic-bezier(.22,1,.36,1),border-color .25s}
  .mvibe-pill:hover{transform:translateY(-1px);border-color:rgba(223,71,104,.7)}
  .mvibe-pill img{width:22px;height:22px;border-radius:50%}
  .mvibe-pill b{font-weight:800}.mvibe-pill span{opacity:.62;font-weight:500}
  .mvibe-pill.top-left{top:10px;left:10px}.mvibe-pill.bottom-left{bottom:10px;left:10px}
  .mvibe-pill.top-right{top:10px;right:10px}.mvibe-pill.bottom-right{bottom:10px;right:10px}
  @media print{.mvibe-pill{display:none}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const a = document.createElement("a");
  a.className = "mvibe-pill " + where;
  a.href = depth;
  a.title = "Back to mvibe, MLow's tools";
  a.innerHTML = `<img src="${depth}assets/brand/eye.png" alt=""><b>mvibe</b>${name ? `<span>/ ${name}</span>` : ""}`;
  const add = () => document.body.appendChild(a);
  document.body ? add() : document.addEventListener("DOMContentLoaded", add);
})();
