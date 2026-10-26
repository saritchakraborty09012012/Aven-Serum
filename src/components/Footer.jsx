import useInViewClass from "../hooks/useInViewClass";
import { onAnchorClick } from "../lib/scroll";

export default function Footer() {
  const footerRef = useInViewClass("in");
  return (
    <footer className="foot" id="end" ref={footerRef}>
      <span className="foot-wm" aria-hidden="true">
        SAMPLE
      </span>
      <div className="foot-in">
        <div className="fmain rise">
          <div>
            <p className="flogo">AVEN</p>
            <p className="ftag">One serum in amber glass, made in small batches and shipped from New York.</p>
          </div>
          <nav className="fcol">
            <h4>Shop</h4>
            <a href="#shop" onClick={onAnchorClick}>
              Vitamin C Serum
            </a>
          </nav>
          <nav className="fcol">
            <h4>Help</h4>
            <a href="#" onClick={(event) => event.preventDefault()}>
              Shipping &amp; returns
            </a>
            <a href="#" onClick={(event) => event.preventDefault()}>
              Ingredients
            </a>
            <a href="#" onClick={(event) => event.preventDefault()}>
              Questions
            </a>
            <a href="#" onClick={(event) => event.preventDefault()}>
              Contact
            </a>
          </nav>
          <div className="fcol">
            <h4>Studio</h4>
            <p>New York, NY</p>
            <p>Free shipping in the US</p>
          </div>
        </div>
        <div className="fbar rise" style={{ "--d": "0.12s" }}>
          <span className="fcopy">
            <i className="fcirc" aria-hidden="true">
              C
            </i>
            <span className="sr">©</span>
            2026 AVEN
          </span>
          <div className="flegal">
            <a href="#" onClick={(event) => event.preventDefault()}>
              Terms
            </a>
            <a href="#" onClick={(event) => event.preventDefault()}>
              Privacy
            </a>
            <a href="#" onClick={(event) => event.preventDefault()}>
              Accessibility
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
