import { memo } from "react";
import { onAnchorClick } from "../lib/scroll";

function SplitWord({ text }) {
  return (
    <span className="lt-w" aria-label={text}>
      {Array.from(text).map((letter, index) => (
        <i key={`${letter}-${index}`} style={{ "--i": index }} aria-hidden="true">
          {letter}
        </i>
      ))}
    </span>
  );
}

const dropIcon = (
  <svg className="ico ico-drop" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.2C12 3.2 5.6 10.4 5.6 14.6a6.4 6.4 0 0 0 12.8 0C18.4 10.4 12 3.2 12 3.2Z" />
    <path className="sh" d="M9.2 15.4a3 3 0 0 0 2.4 2.5" />
  </svg>
);

const spotsIcon = (
  <svg className="ico ico-spots" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="s1" cx="7.5" cy="14.5" r="3.1" />
    <circle className="s2" cx="15.5" cy="8.5" r="2.4" />
    <circle className="s3" cx="16.5" cy="17" r="1.7" />
  </svg>
);

const starIcon = (
  <svg className="ico ico-star" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.5c.7 4.7 3.8 7.8 8.5 8.5-4.7.7-7.8 3.8-8.5 8.5-.7-4.7-3.8-7.8-8.5-8.5 4.7-.7 7.8-3.8 8.5-8.5Z" />
  </svg>
);

function Nav() {
  return (
    <nav className="nav">
      <div className="pill">
        <a className="brand" href="#top" aria-label="AVEN — back to top" onClick={onAnchorClick}>
          AVEN
        </a>
        <a className="link" href="#formula" onClick={onAnchorClick}>
          {dropIcon}
          <SplitWord text="The formula" />
        </a>
        <a className="link" href="#spots" onClick={onAnchorClick}>
          {spotsIcon}
          <SplitWord text="The spots" />
        </a>
        <a className="link" href="#result" onClick={onAnchorClick}>
          {starIcon}
          <SplitWord text="The result" />
        </a>
        <span data-co-bag />
        <a className="pbook" href="#shop" onClick={onAnchorClick}>
          Shop
        </a>
      </div>
    </nav>
  );
}

export default memo(Nav);
