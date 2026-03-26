export interface Annotation {
  id: string;
  pagePath: string;
  pageTitle: string;
  posXPercent: number;
  posYPercent: number;
  scrollY: number;
  cssSelector: string;
  elementText: string;
  elementTag: string;
  content: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "NEW" | "ACKNOWLEDGED" | "RESOLVED";
  author: string;
  devNote: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "mbf_annotations";
const AUTHOR_KEY = "mbf_author";
const ENABLED_KEY = "mbf_enabled";

function read(): Annotation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function write(annotations: Annotation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
}

export const feedbackStorage = {
  getAll: read,

  getForPage(pagePath: string) {
    return read().filter((a) => a.pagePath === pagePath);
  },

  save(data: Omit<Annotation, "id" | "createdAt" | "updatedAt" | "status">): Annotation {
    const all = read();
    const ann: Annotation = {
      ...data,
      id: "ann_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      status: "NEW",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(ann);
    write(all);
    return ann;
  },

  update(id: string, updates: Partial<Annotation>) {
    const all = read();
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    Object.assign(all[idx], updates, { updatedAt: new Date().toISOString() });
    write(all);
    return all[idx];
  },

  remove(id: string) {
    write(read().filter((a) => a.id !== id));
  },

  clearAll() {
    write([]);
  },

  exportJSON(): string {
    return JSON.stringify(
      { version: "1.0", exportedAt: new Date().toISOString(), annotations: read() },
      null,
      2
    );
  },

  importJSON(jsonStr: string): { added: number; updated: number; total: number } {
    const data = JSON.parse(jsonStr);
    const incoming: Annotation[] = data.annotations || data;
    if (!Array.isArray(incoming)) throw new Error("Invalid format");

    const existing = read();
    const map = new Map(existing.map((a) => [a.id, a]));
    let added = 0,
      updated = 0;

    for (const ann of incoming) {
      if (!ann.id) continue;
      const ex = map.get(ann.id);
      if (ex) {
        const exTime = new Date(ex.updatedAt || ex.createdAt).getTime();
        const inTime = new Date(ann.updatedAt || ann.createdAt).getTime();
        if (inTime > exTime) {
          const devNote = ex.devNote || ann.devNote;
          Object.assign(ex, ann);
          if (devNote) ex.devNote = devNote;
          updated++;
        } else if (ann.devNote && !ex.devNote) {
          ex.devNote = ann.devNote;
          updated++;
        }
      } else {
        map.set(ann.id, ann);
        added++;
      }
    }

    write(Array.from(map.values()));
    return { added, updated, total: map.size };
  },

  getAuthor: () => localStorage.getItem(AUTHOR_KEY) || "",
  setAuthor: (name: string) => localStorage.setItem(AUTHOR_KEY, name),

  isEnabled: () => localStorage.getItem(ENABLED_KEY) !== "false",
  setEnabled: (v: boolean) => localStorage.setItem(ENABLED_KEY, String(v)),
};
