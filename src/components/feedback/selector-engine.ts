const SKIP_CLASSES =
  /^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|p-|m-|w-|h-|min-|max-|text-|font-|bg-|border-|rounded-|shadow-|opacity-|transition-|transform-|gap-|space-|items-|justify-|overflow-|z-|cursor-|animate-|col-|row-|sm:|md:|lg:|xl:|hover:|focus:|dark:|group|peer)/;

export function getSelector(el: Element): string {
  if (!el || el === document.body || el === document.documentElement) return "body";

  if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
    return `#${CSS.escape(el.id)}`;
  }

  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("data-") && attr.name !== "data-reactroot") {
      const sel = `[${attr.name}="${CSS.escape(attr.value)}"]`;
      try {
        if (document.querySelectorAll(sel).length === 1) return sel;
      } catch {
        /* invalid */
      }
    }
  }

  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let segment = current.tagName.toLowerCase();
    const classes = Array.from(current.classList || []).filter(
      (c) => !SKIP_CLASSES.test(c) && c.length > 2 && c.length < 40
    );
    if (classes.length > 0) {
      segment += "." + classes.slice(0, 2).map((c) => CSS.escape(c)).join(".");
    }

    path.unshift(segment);
    const candidate = path.join(" > ");
    try {
      if (document.querySelectorAll(candidate).length === 1) return candidate;
    } catch {
      /* continue */
    }

    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((s) => s.tagName === current!.tagName);
      if (siblings.length > 1) {
        path[0] = segment + `:nth-child(${siblings.indexOf(current!) + 1})`;
        try {
          if (document.querySelectorAll(path.join(" > ")).length === 1) return path.join(" > ");
        } catch {
          /* continue */
        }
      }
    }

    current = parent;
    if (path.length >= 6) break;
  }

  return "body > " + path.join(" > ");
}

export function getContext(el: Element) {
  return {
    selector: getSelector(el),
    text: (el.textContent || "").trim().substring(0, 100),
    tag: el.tagName.toLowerCase(),
  };
}

export function resolveSelector(selector: string, expectedText: string): Element | null {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    if (expectedText) {
      const actual = (el.textContent || "").trim().substring(0, 100);
      if (
        actual.includes(expectedText.substring(0, 20)) ||
        expectedText.includes(actual.substring(0, 20))
      )
        return el;
      return null;
    }
    return el;
  } catch {
    return null;
  }
}
