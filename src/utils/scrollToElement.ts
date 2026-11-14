export function scrollToElement(element: HTMLElement | null, offset = 24) {
  if (!element) return;

  const top = element.getBoundingClientRect().top + window.scrollY - offset;

  window.scrollTo({
    top: Math.max(0, top),
    behavior: "smooth",
  });
}
