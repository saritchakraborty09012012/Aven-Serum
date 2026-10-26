import { onAnchorClick } from "../lib/scroll";

export default function Beat({
  id,
  variant = "",
  from,
  to,
  eyebrow,
  lines,
  body,
  actions,
  headingLevel = "h2",
  hero = false,
}) {
  const Heading = headingLevel;
  return (
    <section
      className={`beat ${variant}`}
      id={id}
      data-from={from}
      data-to={to}
      aria-hidden={false}
    >
      {hero ? <h1 className="sr">AVEN, a blood-orange vitamin C serum</h1> : null}
      <p className="eyebrow">{eyebrow}</p>
      <Heading className="display">
        {lines.map((line, index) => (
          <span className="ln" key={index}>
            <i>{line.em ? <em>{line.text}</em> : line.text}</i>
          </span>
        ))}
      </Heading>
      <p className="body">{body}</p>
      {actions ? <div className="actions">{actions}</div> : null}
    </section>
  );
}
