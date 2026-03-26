"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { feedbackStorage, type Annotation } from "./feedback-storage";
import { getContext, resolveSelector } from "./selector-engine";

const STATUS_COLORS: Record<string, string> = { NEW: "#ef4444", ACKNOWLEDGED: "#f59e0b", RESOLVED: "#22c55e" };
const PRIORITY_COLORS: Record<string, string> = { LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#f97316", CRITICAL: "#ef4444" };
const PRIORITY_LABELS: Record<string, string> = { LOW: "נמוך", MEDIUM: "בינוני", HIGH: "גבוה", CRITICAL: "קריטי" };
const STATUS_LABELS: Record<string, string> = { NEW: "חדש", ACKNOWLEDGED: "נראה", RESOLVED: "טופל" };

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState(false); // annotation mode
  const [pins, setPins] = useState<Annotation[]>([]);
  const [activeCard, setActiveCard] = useState<{ type: "new" | "detail"; x: number; y: number; data?: any } | null>(null);
  const [popup, setPopup] = useState(false);
  const [ver, setVer] = useState(0); // force re-render
  const overlayRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    setPins(feedbackStorage.getForPage(pathname));
    setVer((v) => v + 1);
  }, [pathname]);

  useEffect(() => {
    setEnabled(feedbackStorage.isEnabled());
  }, []);

  useEffect(() => {
    reload();
    setActiveCard(null);
    setMode(false);
  }, [pathname, reload]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setMode((m) => !m);
      }
      if (e.key === "Escape") {
        setMode(false);
        setActiveCard(null);
        setPopup(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Reposition on scroll
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(t);
      t = setTimeout(reload, 200);
    };
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [reload]);

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    feedbackStorage.setEnabled(next);
    if (!next) {
      setMode(false);
      setActiveCard(null);
      setPopup(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const ctx = target ? getContext(target) : { selector: "", text: "", tag: "body" };

    setMode(false);
    setActiveCard({
      type: "new",
      x: e.clientX,
      y: e.clientY,
      data: {
        posXPercent: (e.clientX / window.innerWidth) * 100,
        posYPercent: ((e.clientY + window.scrollY) / document.documentElement.scrollHeight) * 100,
        scrollY: window.scrollY,
        ...ctx,
      },
    });
  };

  if (!enabled) {
    // Show only a tiny toggle to re-enable
    return createPortal(
      <button
        onClick={toggleEnabled}
        style={{
          position: "fixed", bottom: 8, left: 8, zIndex: 99999,
          width: 24, height: 24, borderRadius: "50%", border: "1px solid #ccc",
          background: "#f5f5f5", cursor: "pointer", fontSize: 12, display: "flex",
          alignItems: "center", justifyContent: "center", opacity: 0.4,
        }}
        title="הפעל ווידג'ט משוב"
      >
        💬
      </button>,
      document.body
    );
  }

  const openCount = pins.filter((p) => p.status === "NEW").length;

  return createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, width: 0, height: 0, zIndex: 99999, direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      {/* FAB */}
      <div
        style={{
          position: "fixed", bottom: 20, left: 20, width: 48, height: 48, borderRadius: "50%",
          background: mode ? "linear-gradient(145deg, #ef4444, #dc2626)" : "linear-gradient(145deg, #124F90, #0A3D6E)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)", transition: "all 0.2s", zIndex: 10,
        }}
        onClick={() => { setMode((m) => !m); setActiveCard(null); }}
        title={mode ? "ביטול מצב הערות" : "מצב הערות (Ctrl+Shift+F)"}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {openCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
            background: "#ef4444", color: "white", fontSize: 11, fontWeight: "bold",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
            border: "2px solid white",
          }}>
            {openCount}
          </span>
        )}
      </div>

      {/* Toggle + Popup buttons */}
      <div style={{ position: "fixed", bottom: 74, left: 20, display: "flex", flexDirection: "column", gap: 6, zIndex: 10 }}>
        <button onClick={() => setPopup((p) => !p)} style={smallBtnStyle} title="דשבורד הערות">📋</button>
        <button onClick={toggleEnabled} style={smallBtnStyle} title="כבה ווידג'ט">⛔</button>
      </div>

      {/* Overlay for annotation mode */}
      {mode && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(18, 79, 144, 0.05)", cursor: "crosshair", zIndex: 5,
          }}
        />
      )}

      {/* Pins */}
      {pins.map((ann, i) => {
        const pos = resolvePosition(ann);
        return (
          <div
            key={ann.id}
            onClick={(e) => { e.stopPropagation(); setActiveCard({ type: "detail", x: pos.x + 30, y: pos.y, data: ann }); }}
            title={`${ann.author}: ${ann.content.substring(0, 60)}`}
            style={{
              position: "absolute", left: pos.x, top: pos.y, width: 22, height: 22, borderRadius: "50%",
              background: STATUS_COLORS[ann.status] || "#ef4444", color: "white", fontSize: 11,
              fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", border: "2px solid white", boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              zIndex: 8, transition: "transform 0.15s", pointerEvents: "auto",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.3)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {i + 1}
          </div>
        );
      })}

      {/* New Annotation Card */}
      {activeCard?.type === "new" && <NewAnnotationCard x={activeCard.x} y={activeCard.y} data={activeCard.data} pathname={pathname} onClose={() => setActiveCard(null)} onSave={reload} />}

      {/* Detail Card */}
      {activeCard?.type === "detail" && <DetailCard x={activeCard.x} y={activeCard.y} ann={activeCard.data} onClose={() => setActiveCard(null)} onChange={reload} />}

      {/* Popup */}
      {popup && <PopupPanel onClose={() => setPopup(false)} onChange={reload} />}
    </div>,
    document.body
  );
}

// ========== Sub-components ==========

function NewAnnotationCard({ x, y, data, pathname, onClose, onSave }: { x: number; y: number; data: any; pathname: string; onClose: () => void; onSave: () => void }) {
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [author, setAuthor] = useState(feedbackStorage.getAuthor());
  const [showAuthor] = useState(!feedbackStorage.getAuthor());
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setTimeout(() => (showAuthor ? null : textRef.current?.focus()), 50); }, [showAuthor]);

  const cardW = 300;
  let left = x + 15;
  let top = y + 15;
  if (left + cardW > window.innerWidth) left = x - cardW - 15;
  if (top + 300 > window.innerHeight) top = y - 300;
  if (left < 10) left = 10;
  if (top < 10) top = 10;

  const submit = () => {
    if (!content.trim()) { textRef.current?.focus(); return; }
    if (!author.trim()) return;
    feedbackStorage.setAuthor(author);
    feedbackStorage.save({
      pagePath: pathname,
      pageTitle: document.title,
      posXPercent: data.posXPercent,
      posYPercent: data.posYPercent,
      scrollY: data.scrollY,
      cssSelector: data.selector,
      elementText: data.text,
      elementTag: data.tag,
      content: content.trim(),
      priority: priority as Annotation["priority"],
      author,
      devNote: "",
    });
    onClose();
    onSave();
  };

  return (
    <div style={{ ...cardStyle, left, top, width: cardW }}>
      <div style={{ fontWeight: "bold", marginBottom: 8, fontSize: 14 }}>הערה חדשה</div>
      {showAuthor && <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="השם שלך" dir="rtl" style={inputStyle} />}
      <textarea ref={textRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="מה צריך לתקן כאן?" dir="rtl" rows={4} style={{ ...inputStyle, resize: "vertical" }}
        onKeyDown={(e) => { if (e.ctrlKey && e.key === "Enter") submit(); }}
      />
      <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#666" }}>עדיפות:</span>
        {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => (
          <button key={p} onClick={() => setPriority(p)} style={{
            padding: "3px 10px", borderRadius: 12, border: `2px solid ${PRIORITY_COLORS[p]}`,
            background: priority === p ? PRIORITY_COLORS[p] : "white",
            color: priority === p ? "white" : PRIORITY_COLORS[p],
            fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>
            {PRIORITY_LABELS[p]}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#999", marginBottom: 8, direction: "ltr", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {data.tag}: {data.text?.substring(0, 50) || "(ריק)"}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={submit} style={btnPrimaryStyle}>שלח</button>
        <button onClick={onClose} style={btnStyle}>ביטול</button>
      </div>
    </div>
  );
}

function DetailCard({ x, y, ann, onClose, onChange }: { x: number; y: number; ann: Annotation; onClose: () => void; onChange: () => void }) {
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(ann.devNote || "");

  let left = x;
  let top = y;
  if (left + 300 > window.innerWidth) left = window.innerWidth - 320;
  if (top + 250 > window.innerHeight) top = window.innerHeight - 260;
  if (left < 10) left = 10;
  if (top < 10) top = 10;

  return (
    <div style={{ ...cardStyle, left, top, width: 300 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: "bold", marginBottom: 8, fontSize: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[ann.status], flexShrink: 0 }} />
        <span>{ann.author}</span>
        <span style={{ fontWeight: "normal", color: "#888", fontSize: 11, marginRight: "auto" }}>{timeAgo(ann.createdAt)}</span>
      </div>
      <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>{ann.content}</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: `${PRIORITY_COLORS[ann.priority]}20`, color: PRIORITY_COLORS[ann.priority], fontWeight: 600 }}>{PRIORITY_LABELS[ann.priority]}</span>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#f3f4f6", color: "#666" }}>{STATUS_LABELS[ann.status]}</span>
      </div>
      {ann.devNote && (
        <div style={{ marginBottom: 8, padding: 8, borderRadius: 6, background: "#f0f7ff", borderRight: "3px solid #124F90", fontSize: 12 }}>
          <strong>תגובת מפתח:</strong> {ann.devNote}
        </div>
      )}
      {showNote && (
        <div style={{ marginBottom: 8 }}>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="תגובת מפתח..." dir="rtl" rows={2} style={{ ...inputStyle, minHeight: 40 }} />
          <button onClick={() => { feedbackStorage.update(ann.id, { devNote: noteText }); onClose(); onChange(); }} style={btnPrimaryStyle}>שמור</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <select value={ann.status} onChange={(e) => { feedbackStorage.update(ann.id, { status: e.target.value as Annotation["status"] }); onClose(); onChange(); }}
          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, cursor: "pointer" }}>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowNote(true)} style={btnStyle}>תגובה</button>
        <button onClick={() => { if (confirm("למחוק?")) { feedbackStorage.remove(ann.id); onClose(); onChange(); } }}
          style={{ ...btnStyle, color: "#ef4444", borderColor: "#fca5a5" }}>מחק</button>
        <button onClick={onClose} style={btnStyle}>סגור</button>
      </div>
    </div>
  );
}

function PopupPanel({ onClose, onChange }: { onClose: () => void; onChange: () => void }) {
  const [all, setAll] = useState<Annotation[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { setAll(feedbackStorage.getAll()); }, []);

  const filtered = statusFilter === "ALL" ? all : all.filter((a) => a.status === statusFilter);

  const groups: Record<string, { title: string; items: Annotation[] }> = {};
  for (const a of filtered) {
    if (!groups[a.pagePath]) groups[a.pagePath] = { title: a.pageTitle || a.pagePath, items: [] };
    groups[a.pagePath].items.push(a);
  }

  const doExport = () => {
    const json = feedbackStorage.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `motty-beats-feedback-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("הקובץ יורד...");
  };

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = feedbackStorage.importJSON(text);
      showToast(`יובאו ${result.added} חדשות, ${result.updated} עודכנו`);
      setAll(feedbackStorage.getAll());
      onChange();
    } catch (err: any) {
      showToast("שגיאה: " + err.message);
    }
    e.target.value = "";
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  return (
    <div style={{
      position: "fixed", bottom: 80, left: 20, width: 360, maxHeight: 480,
      background: "white", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
      zIndex: 20, overflow: "hidden", display: "flex", flexDirection: "column",
      pointerEvents: "auto", fontSize: 13,
    }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(145deg, #124F90, #0A3D6E)", color: "white", padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 15 }}>Motty Beats Feedback</strong>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
          {all.filter((a) => a.status === "NEW").length} חדשות | {all.filter((a) => a.status === "RESOLVED").length} טופלו | {all.length} סה״כ
        </div>
      </div>

      {/* Filter */}
      <div style={{ padding: "8px 16px", background: "#f7f8fa", borderBottom: "1px solid #eee" }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: "100%", padding: "5px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12 }}>
          <option value="ALL">הכל</option>
          <option value="NEW">חדש</option>
          <option value="ACKNOWLEDGED">נראה</option>
          <option value="RESOLVED">טופל</option>
        </select>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", maxHeight: 280 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 20px", color: "#aaa" }}>💬 אין הערות</div>
        ) : (
          Object.entries(groups).map(([path, group]) => (
            <div key={path} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ padding: "6px 16px", fontWeight: 600, fontSize: 12, color: "#124F90", background: "#f9fafb" }}>
                📄 {group.title} <span style={{ background: "#124F90", color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 10, marginRight: 6 }}>{group.items.length}</span>
              </div>
              {group.items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((ann) => (
                <div key={ann.id} style={{ padding: "6px 16px 6px 24px", borderBottom: "1px solid #f5f5f5", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[ann.status], marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ann.content}</div>
                    <div style={{ fontSize: 11, color: "#999" }}>{ann.author} · {timeAgo(ann.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px", borderTop: "1px solid #eee", background: "#f7f8fa" }}>
        <button onClick={doExport} style={btnPrimaryStyle}>📤 ייצוא</button>
        <label style={{ ...btnStyle, cursor: "pointer", textAlign: "center" }}>
          📥 ייבוא
          <input ref={fileRef} type="file" accept=".json" onChange={doImport} hidden />
        </label>
        <button onClick={() => { if (confirm("למחוק הכל?")) { feedbackStorage.clearAll(); setAll([]); onChange(); } }}
          style={{ ...btnStyle, color: "#ef4444", borderColor: "#fca5a5" }}>🗑️</button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "absolute", bottom: 55, left: "50%", transform: "translateX(-50%)", background: "#333", color: "white", padding: "6px 14px", borderRadius: 6, fontSize: 12, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ========== Helpers ==========

function resolvePosition(ann: Annotation) {
  if (ann.cssSelector) {
    const el = resolveSelector(ann.cssSelector, ann.elementText);
    if (el) {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2 - 10, y: rect.top + window.scrollY - 10 };
    }
  }
  return {
    x: (ann.posXPercent / 100) * window.innerWidth,
    y: (ann.posYPercent / 100) * document.documentElement.scrollHeight,
  };
}

// ========== Inline styles ==========

const cardStyle: React.CSSProperties = {
  position: "fixed", background: "white", borderRadius: 10,
  boxShadow: "0 8px 30px rgba(0,0,0,0.2)", padding: 14, zIndex: 20,
  fontSize: 13, lineHeight: 1.5, pointerEvents: "auto",
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px",
  border: "1px solid #ddd", borderRadius: 6, fontSize: 13, marginBottom: 8,
  fontFamily: "inherit", outline: "none",
};
const btnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd",
  background: "white", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
};
const btnPrimaryStyle: React.CSSProperties = {
  ...btnStyle, background: "#124F90", color: "white", borderColor: "#124F90",
};
const smallBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: "50%", border: "1px solid #ddd",
  background: "white", cursor: "pointer", fontSize: 14,
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 2px 6px rgba(0,0,0,0.15)", pointerEvents: "auto",
};
