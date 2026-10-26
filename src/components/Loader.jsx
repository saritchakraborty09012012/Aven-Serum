export default function Loader({ progress, done, poster }) {
  const percent = Math.round(progress * 100);
  return (
    <div className={`veil ${done ? "gone" : ""}`} aria-hidden={done}>
      <img className="veil-photo" src={poster || "/frames/f_0001.webp"} alt="" />
      <div className="veil-inner">
        <div className="veil-mark">AVEN</div>
        <div className="veil-kicker">Blood orange · Vitamin C</div>
        <div className="veil-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}>
          <span style={{ transform: `scaleX(${Math.max(0.08, progress).toFixed(3)})` }} />
        </div>
        <div className="veil-count">{done ? "Ready" : `${String(percent).padStart(2, "0")} / 100`}</div>
      </div>
    </div>
  );
}
