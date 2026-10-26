export function goToAnchor(href) {
  const film = window.__ambarFilm;
  if (film?.scrollToAnchor) {
    film.scrollToAnchor(href);
    return true;
  }
  const target = document.querySelector(href);
  if (target) {
    target.scrollIntoView({ behavior: "smooth" });
    return true;
  }
  return false;
}

export function onAnchorClick(event) {
  const href = event.currentTarget.getAttribute("href");
  if (href && href.startsWith("#") && goToAnchor(href)) {
    event.preventDefault();
  }
}
