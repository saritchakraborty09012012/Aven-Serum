import { memo, useCallback, useState } from "react";
import BottleViewer from "./BottleViewer";
import useInViewClass from "../hooks/useInViewClass";

const ProductVisual = memo(function ProductVisual({ onOpen }) {
  return (
    <div className="pframe rise">
      <img
        src="/catalog/serum.webp"
        srcSet="/catalog/serum-s.webp 928w, /catalog/serum.webp 1392w"
        sizes="(max-width:900px) 92vw, 46vw"
        alt="AVEN Vitamin C Serum, an amber glass dropper bottle with a cream bulb, on white"
        width="1392"
        height="1740"
        loading="lazy"
        decoding="async"
      />
      <img
        className="alt"
        src="/catalog/serum-orange.webp"
        srcSet="/catalog/serum-orange-s.webp 928w, /catalog/serum-orange.webp 1392w"
        sizes="(max-width:900px) 92vw, 46vw"
        alt=""
        width="1392"
        height="1740"
        loading="lazy"
        decoding="async"
      />
      <button type="button" className="p3d" onClick={onOpen} aria-label="Explore the bottle in 3D">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 2.8 21 8v8l-9 5.2L3 16V8l9-5.2Z" />
          <path d="M3.4 8.2 12 13.4l8.6-5.2M12 13.4V21" />
        </svg>
        View in 3D
      </button>
    </div>
  );
});

const ProductInfo = memo(function ProductInfo() {
  return (
    <article
      className="pinfo rise"
      style={{ "--d": "0.1s" }}
      data-sku="serum"
      data-name="AVEN Vitamin C Serum"
      data-price="68"
      data-img="/catalog/serum-s.webp"
      data-note="30 ml · Dropper bottle"
    >
      <p className="eyebrow">Shop</p>
      <h2 className="display">
        AVEN <em>Serum</em>
      </h2>
      <p className="pnote">A blood-orange vitamin C serum for dark spots and uneven tone.</p>
      <p className="pprice">
        $68 <small>30 ml · about two months, daily</small>
      </p>
      <ul className="facts">
        <li>
          <b>Key ingredient</b>
          <span>Vitamin C from blood-orange extract</span>
        </li>
        <li>
          <b>Texture</b>
          <span>Light golden serum, absorbs without a sticky finish</span>
        </li>
        <li>
          <b>Use</b>
          <span>Two or three drops, every morning, before sunscreen</span>
        </li>
        <li>
          <b>Bottle</b>
          <span>Amber glass dropper with a silicone bulb</span>
        </li>
      </ul>
      <button type="button" className="co-add" data-co-add>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M5 8h14l-1.2 12H6.2z" />
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
        </svg>
        <span>Add to bag</span>
      </button>
    </article>
  );
});

export default function Shop() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const sectionRef = useInViewClass("in");
  const openViewer = useCallback(() => setViewerOpen(true), []);
  const closeViewer = useCallback(() => setViewerOpen(false), []);

  return (
    <>
      <section className="shop" id="shop" ref={sectionRef}>
        <div className="pdp">
          <ProductVisual onOpen={openViewer} />
          <ProductInfo />
        </div>
        <div className="ritual">
          <div className="rise">
            <span>01</span>
            <h3>Clean skin</h3>
            <p>Wash your face and pat it dry.</p>
          </div>
          <div className="rise" style={{ "--d": "0.08s" }}>
            <span>02</span>
            <h3>Two or three drops</h3>
            <p>Smooth them over your face and neck with your fingertips.</p>
          </div>
          <div className="rise" style={{ "--d": "0.16s" }}>
            <span>03</span>
            <h3>Every morning</h3>
            <p>Follow with moisturiser and sunscreen.</p>
          </div>
        </div>
      </section>
      <BottleViewer open={viewerOpen} onClose={closeViewer} />
    </>
  );
}
