"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Code2, Italic, Link2, List, ListOrdered, Palette, Underline } from "lucide-react";
import { Button } from "../../../components/ui/button";
import styles from "../page.module.css";

function normalizeColorValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const validHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const validRgb = /^rgba?\([^)]*\)$/i;
  const validHsl = /^hsla?\([^)]*\)$/i;
  if (validHex.test(text) || validRgb.test(text) || validHsl.test(text)) return text;
  const named = /^[a-z]+$/i;
  return named.test(text) ? text : "";
}

function pickColorStyle(styleText) {
  const parts = String(styleText || "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx < 1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (prop !== "color") continue;
    const color = normalizeColorValue(val);
    if (!color) continue;
    return `color: ${color}`;
  }
  return "";
}

function normalizeHtml(html) {
  const sanitized = String(html || "")
    .replace(/<font\b([^>]*)>/gi, (_all, attrs) => {
      const colorMatch = String(attrs || "").match(/\bcolor\s*=\s*["']?([^"'>\s]+)/i);
      const color = normalizeColorValue(colorMatch?.[1] || "");
      return color ? `<span style="color: ${color}">` : "<span>";
    })
    .replace(/<\/font>/gi, "</span>")
    .replace(/\sstyle=(["'])(.*?)\1/gi, (_all, _quote, styleText) => {
      const safe = pickColorStyle(styleText);
      return safe ? ` style="${safe}"` : "";
    })
    .replace(/&nbsp;/gi, " ");

  const textOnly = String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, " ")
    .trim();
  return textOnly ? sanitized : "";
}

export default function RichArticleEditor({ value, onChange, placeholder = "Write article content..." }) {
  const editorRef = useRef(null);
  const colorInputRef = useRef(null);
  const localValueRef = useRef("");
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState("");

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const nextHtml = normalizeHtml(value);
    if (document.activeElement === el) return;
    if (localValueRef.current === nextHtml) return;
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
    localValueRef.current = nextHtml;
  }, [value]);

  useEffect(() => {
    if (!htmlMode) return;
    setHtmlDraft(normalizeHtml(value));
  }, [htmlMode, value]);

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    const next = normalizeHtml(el.innerHTML);
    localValueRef.current = next;
    onChange(next);
  };

  const run = (command, commandValue) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const createLink = () => {
    const href = window.prompt("Enter URL", "https://");
    if (!href) return;
    run("createLink", href);
  };

  const openColorPicker = () => {
    const input = colorInputRef.current;
    if (!input) return;
    input.click();
  };

  const applyColor = (color) => {
    if (!color) return;
    run("foreColor", color);
  };

  const toggleHtmlMode = () => {
    setHtmlMode((prev) => {
      const next = !prev;
      if (!prev) {
        const nextHtml = normalizeHtml(value);
        setHtmlDraft(nextHtml);
      }
      return next;
    });
  };

  const applyHtmlDraft = () => {
    const next = normalizeHtml(htmlDraft);
    localValueRef.current = next;
    const el = editorRef.current;
    if (el) {
      el.innerHTML = next;
    }
    onChange(next);
  };

  const resetHtmlDraft = () => {
    setHtmlDraft(normalizeHtml(value));
  };

  return (
    <div className={styles.richEditor}>
      <div className={styles.richToolbar}>
        <Button type="button" variant="outline" size="sm" className={styles.richToolBtn} onClick={() => run("bold")} title="Bold">
          <Bold size={14} />
        </Button>
        <Button type="button" variant="outline" size="sm" className={styles.richToolBtn} onClick={() => run("italic")} title="Italic">
          <Italic size={14} />
        </Button>
        <Button type="button" variant="outline" size="sm" className={styles.richToolBtn} onClick={() => run("underline")} title="Underline">
          <Underline size={14} />
        </Button>
        <Button type="button" variant="outline" size="sm" className={styles.richToolBtn} onClick={createLink} title="Insert link">
          <Link2 size={14} />
        </Button>
        <Button type="button" variant="outline" size="sm" className={styles.richToolBtn} onClick={() => run("insertUnorderedList")} title="Bulleted list">
          <List size={14} />
        </Button>
        <Button type="button" variant="outline" size="sm" className={styles.richToolBtn} onClick={() => run("insertOrderedList")} title="Numbered list">
          <ListOrdered size={14} />
        </Button>
        <input
          ref={colorInputRef}
          type="color"
          className={styles.richColorInput}
          aria-label="Pick text color"
          onChange={(e) => applyColor(e.target.value)}
          value="#ffffff"
        />
        <Button type="button" variant="outline" size="sm" className={styles.richToolBtn} onClick={openColorPicker} title="Text color">
          <Palette size={14} />
        </Button>
        <div className={styles.richToolbarDivider} aria-hidden="true" />
        <Button type="button" variant="outline" size="sm" className={styles.richToolBtn} onClick={toggleHtmlMode} title="Toggle HTML source mode">
          <Code2 size={14} />
          <span>{htmlMode ? "Hide HTML" : "HTML"}</span>
        </Button>
        {htmlMode ? (
          <Button type="button" size="sm" className={styles.richApplyBtn} onClick={applyHtmlDraft} title="Apply HTML source">
            Apply HTML
          </Button>
        ) : null}
      </div>
      {htmlMode ? (
        <div className={styles.richSourcePanel}>
          <div className={styles.richSourceHeader}>
            <strong>HTML Source Mode</strong>
            <div className={styles.richSourceActions}>
              <Button type="button" variant="outline" size="sm" className={styles.richToolBtn} onClick={resetHtmlDraft}>
                Reset
              </Button>
              <Button type="button" size="sm" className={styles.richApplyBtn} onClick={applyHtmlDraft}>
                Apply HTML
              </Button>
            </div>
          </div>
          <textarea
            className={styles.richSourceInput}
            value={htmlDraft}
            onChange={(e) => setHtmlDraft(e.target.value)}
            spellCheck={false}
            placeholder="<p></p>"
          />
        </div>
      ) : null}
      <div
        ref={editorRef}
        className={styles.richEditable}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
      />
    </div>
  );
}
