"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clapperboard, FolderPlus, Pencil, Trash2 } from "lucide-react";
import {
  resolveBrowserPlaybackUrl,
  shouldForceVideoTranscode,
  toStreamTranscodeUrl,
} from "../../../lib/streamUrl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../../../components/ui/pagination";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import styles from "../page.module.css";

function isHlsUrl(url) {
  return /\.m3u8(\?|$)/i.test(String(url || ""));
}

function loadHlsScript() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Hls) return Promise.resolve(window.Hls);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-hls-script="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Hls || null), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load HLS script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
    script.async = true;
    script.dataset.hlsScript = "1";
    script.onload = () => resolve(window.Hls || null);
    script.onerror = () => reject(new Error("Failed to load HLS script."));
    document.head.appendChild(script);
  });
}

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeIds(values) {
  return Array.isArray(values)
    ? values.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0)
    : [];
}

function toCsv(values) {
  return Array.isArray(values)
    ? values
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .join(", ")
    : "";
}

function toList(csv) {
  return String(csv || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function clampPositiveInteger(value, fallback) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function clampNonNegativeInteger(value, fallback = 0) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

const IMPORT_RESUME_STORAGE_KEY = "webtvbd:movies-import-resume:v1";

function normalizeCsvTokens(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join(",");
}

function buildImportResumeSignature(form) {
  const normalized = {
    base_url: String(form?.base_url || "").trim().replace(/\/+$/, "").toLowerCase(),
    include: normalizeCsvTokens(form?.include),
    exclude: normalizeCsvTokens(form?.exclude),
    providers: normalizeCsvTokens(form?.providers),
    max_depth: clampPositiveInteger(form?.max_depth, 6),
    category_ids: normalizeIds(form?.category_ids).sort((a, b) => a - b),
  };
  return JSON.stringify(normalized);
}

function serializeMovieForm(form) {
  return JSON.stringify({
    ...form,
    is_published: Boolean(form?.is_published),
    category_ids: normalizeIds(form?.category_ids),
  });
}

function movieHasSource(row) {
  return (row?.sources || []).some((src) => String(src?.source_url || "").trim());
}

function text(value) {
  return String(value || "").trim();
}

function listHasValue(values) {
  return Array.isArray(values) && values.some((v) => text(v));
}

function getMetadataSignals(row) {
  const imdbId = text(row?.imdb_id).toLowerCase();
  const hasImdbId = /^tt\d{7,12}$/.test(imdbId) && imdbId !== "tt1234567";
  const hasSynopsis = text(row?.synopsis).length >= 20;
  const hasPoster = /^https?:\/\//i.test(text(row?.poster_url)) || /^https?:\/\//i.test(text(row?.backdrop_url));
  const releaseYear = Number(row?.release_year || 0);
  const hasYear = Number.isInteger(releaseYear) && releaseYear >= 1888 && releaseYear <= 2100;
  const hasReleaseDate = text(row?.imdb_release_date).length >= 4;
  const hasRating = Number(row?.imdb_rating || 0) > 0 || Number(row?.imdb_votes || 0) > 0;
  const hasPeople = listHasValue(row?.imdb_directors) || listHasValue(row?.imdb_writers) || listHasValue(row?.imdb_stars);
  const hasTaxonomy = listHasValue(row?.imdb_genres) || listHasValue(row?.imdb_languages) || listHasValue(row?.imdb_countries);
  return {
    hasImdbId,
    hasSynopsis,
    hasPoster,
    hasYear,
    hasReleaseDate,
    hasRating,
    hasPeople,
    hasTaxonomy,
  };
}

function movieHasMetadata(row) {
  const s = getMetadataSignals(row);
  return (
    s.hasImdbId ||
    s.hasSynopsis ||
    s.hasPoster ||
    s.hasYear ||
    s.hasReleaseDate ||
    s.hasRating ||
    s.hasPeople ||
    s.hasTaxonomy
  );
}

function movieHasCompleteMetadata(row) {
  const hasList = (values) => Array.isArray(values) && values.some((v) => String(v || "").trim());
  const s = getMetadataSignals(row);
  const hasCoreNarrative = s.hasSynopsis && s.hasPoster;
  const hasIdentity = s.hasImdbId || s.hasTaxonomy || s.hasPeople;
  const hasTiming = s.hasYear || s.hasReleaseDate;
  const hasDetail = s.hasRating || hasList(row?.imdb_genres) || hasList(row?.imdb_stars);
  return Boolean(hasCoreNarrative && hasIdentity && hasTiming && hasDetail);
}

function movieDataState(row) {
  const hasSource = movieHasSource(row);
  const hasAnyMeta = movieHasMetadata(row);
  const hasCompleteMeta = movieHasCompleteMetadata(row);
  if (hasSource && hasCompleteMeta) return "complete";
  if (hasSource && hasAnyMeta && !hasCompleteMeta) return "metadata_partial";
  if (!hasSource && hasAnyMeta) return "source_missing";
  if (hasSource && !hasAnyMeta) return "metadata_missing";
  return "missing_both";
}

function movieDataStateLabel(state) {
  if (state === "complete") return "Complete";
  if (state === "metadata_partial") return "Partial Metadata";
  if (state === "source_missing") return "No Source";
  if (state === "metadata_missing") return "No Metadata";
  if (state === "missing_both") return "No Source + Metadata";
  return "Unknown";
}

function buildPageItems(currentPage, totalPages) {
  const total = Math.max(1, Number(totalPages || 1));
  const current = Math.min(Math.max(1, Number(currentPage || 1)), total);
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(keep)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i];
    const prev = sorted[i - 1];
    if (i > 0 && value - prev > 1) out.push(`ellipsis-${prev}-${value}`);
    out.push(value);
  }
  return out;
}

const EMPTY_MOVIE_FORM = {
  id: "",
  title: "",
  slug: "",
  synopsis: "",
  poster_url: "",
  backdrop_url: "",
  release_year: "",
  runtime_seconds: "",
  source_url: "",
  imdb_id: "",
  imdb_url: "",
  imdb_rating: "",
  imdb_votes: "",
  content_rating: "",
  imdb_genres: "",
  imdb_directors: "",
  imdb_writers: "",
  imdb_stars: "",
  imdb_release_date: "",
  imdb_countries: "",
  imdb_languages: "",
  is_published: true,
  category_ids: [],
};

function CategoryCombobox({ categories = [], value = [], onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handleOutside(event) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selectedIds = useMemo(() => new Set(normalizeIds(value)), [value]);
  const selectedCategories = useMemo(
    () => categories.filter((row) => selectedIds.has(Number(row?.id))),
    [categories, selectedIds]
  );

  const filteredCategories = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((row) => {
      const name = String(row?.name || "").toLowerCase();
      const slug = String(row?.slug || "").toLowerCase();
      return name.includes(q) || slug.includes(q);
    });
  }, [categories, query]);

  const toggleCategory = (id) => {
    const normalized = normalizeIds(value);
    const hasItem = normalized.includes(id);
    const next = hasItem ? normalized.filter((item) => item !== id) : [...normalized, id];
    onChange(normalizeIds(next));
  };

  return (
    <div className={styles.field}>
      <span>Categories</span>
      {selectedCategories.length ? (
        <div className={styles.actions}>
          {selectedCategories.map((row) => (
            <button
              key={row.id}
              type="button"
              className={styles.resultTabBtn}
              onClick={() => toggleCategory(Number(row.id))}
            >
              {row.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className={`${styles.menuWrap} ${styles.groupComboWrap}`} ref={rootRef}>
        <input
          className={styles.inlineInput}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Search and select category"
          aria-label="Search and select category"
        />
        {open ? (
          <div className={`${styles.menuList} ${styles.groupComboMenu}`}>
            {filteredCategories.length ? (
              filteredCategories.map((row) => {
                const isSelected = selectedIds.has(Number(row.id));
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`${styles.menuItem} ${isSelected ? styles.selectedRow : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggleCategory(Number(row.id))}
                  >
                    {isSelected ? "✓ " : ""}
                    {row.name}
                  </button>
                );
              })
            ) : (
              <div className={styles.menuItem}>No matching category</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function IndeterminateCheckbox({ indeterminate, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.indeterminate = Boolean(indeterminate) && !props.checked;
  }, [indeterminate, props.checked]);
  return <input ref={ref} type="checkbox" {...props} />;
}

export default function ManageMovies({ initialCategories = [], initialMovies = [], categorySlug = "" }) {
  const currentCategorySlug = String(categorySlug || "").trim().toLowerCase();
  const [activeCategorySlug, setActiveCategorySlug] = useState(currentCategorySlug);
  const isCategoryDetailsPage = Boolean(activeCategorySlug);
  const [categories, setCategories] = useState(Array.isArray(initialCategories) ? initialCategories : []);
  const [movies, setMovies] = useState(Array.isArray(initialMovies) ? initialMovies : []);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingMovie, setSavingMovie] = useState(false);
  const [fetchingImdb, setFetchingImdb] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showMovieForm, setShowMovieForm] = useState(false);
  const [imdbQuery, setImdbQuery] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryCountFilter, setCategoryCountFilter] = useState("all");
  const [movieSearch, setMovieSearch] = useState("");
  const [movieStatusFilter, setMovieStatusFilter] = useState("all");
  const [movieDataFilter, setMovieDataFilter] = useState("all");
  const [movieSorting, setMovieSorting] = useState([{ id: "updated_at", desc: true }]);
  const [movieColumnFilters, setMovieColumnFilters] = useState([]);
  const [movieRowSelection, setMovieRowSelection] = useState({});
  const [moviePagination, setMoviePagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [refreshingMovieMetadata, setRefreshingMovieMetadata] = useState(false);
  const [metadataRefreshSummary, setMetadataRefreshSummary] = useState(null);
  const [metadataRefreshCurrentTitle, setMetadataRefreshCurrentTitle] = useState("");
  const [checkingBrokenMovies, setCheckingBrokenMovies] = useState(false);
  const [brokenMovieCleanupSummary, setBrokenMovieCleanupSummary] = useState(null);
  const [brokenMovieCleanupCurrentTitle, setBrokenMovieCleanupCurrentTitle] = useState("");
  const [movieMetadataSettingsLoading, setMovieMetadataSettingsLoading] = useState(false);
  const [movieMetadataSettingsSaving, setMovieMetadataSettingsSaving] = useState(false);
  const [omdbKeysText, setOmdbKeysText] = useState("");
  const [omdbUsageInfo, setOmdbUsageInfo] = useState(null);
  const [previewSourceUrl, setPreviewSourceUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [sourceCheckLoading, setSourceCheckLoading] = useState(false);
  const [sourceCheckResult, setSourceCheckResult] = useState(null);
  const [sourceCheckUrl, setSourceCheckUrl] = useState("");
  const [imdbImagePreviewUrls, setImdbImagePreviewUrls] = useState([]);
  const [searchingMetadataByTitle, setSearchingMetadataByTitle] = useState(false);
  const [metadataSearchCandidates, setMetadataSearchCandidates] = useState([]);
  const [selectedMetadataCandidateId, setSelectedMetadataCandidateId] = useState("");
  const [importingMovies, setImportingMovies] = useState(false);
  const [importingPrepared, setImportingPrepared] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [preparedItems, setPreparedItems] = useState([]);
  const [selectionMap, setSelectionMap] = useState({});
  const [importStatusMap, setImportStatusMap] = useState({});
  const [scanRawItems, setScanRawItems] = useState([]);
  const [scanRawCount, setScanRawCount] = useState(0);
  const [scanPreparedCount, setScanPreparedCount] = useState(0);
  const [importProgress, setImportProgress] = useState({
    total: 0,
    processed: 0,
    remaining: 0,
    saved: 0,
    skipped: 0,
    failed: 0,
    current_title: "",
    current_status: "",
  });
  const [importBatchState, setImportBatchState] = useState({
    source_ids: [],
    queue: [],
    queue_total: 0,
    processed: 0,
    remaining: 0,
    batch_size: 0,
    next_batch_number: 1,
    paused: false,
    saved: 0,
    skipped: 0,
    failed: 0,
    range_start: 0,
    range_end: 0,
    category_ids: [],
  });
  const selectAllCheckboxRef = useRef(null);
  const [importForm, setImportForm] = useState({
    base_url: "",
    include: "movies,animation,hindi,english,bangla",
    exclude: "android games,software,tv shows,series",
    providers: "imdb,omdb,tmdb",
    publish: true,
    limit: "0",
    max_depth: "6",
    category_ids: [],
    range_start: "1",
    range_end: "0",
    batch_size: "50",
  });
  const [movieFormInitialSnapshot, setMovieFormInitialSnapshot] = useState(
    serializeMovieForm(EMPTY_MOVIE_FORM)
  );

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    slug: "",
    position: "0",
  });

  const [movieForm, setMovieForm] = useState({ ...EMPTY_MOVIE_FORM });
  const [previewVideoEl, setPreviewVideoEl] = useState(null);
  const previewHlsRef = useRef(null);
  const resumeAppliedSignatureRef = useRef("");
  const [importResumeInfo, setImportResumeInfo] = useState(null);
  const isMovieFormDirty = useMemo(
    () => showMovieForm && serializeMovieForm(movieForm) !== movieFormInitialSnapshot,
    [movieForm, movieFormInitialSnapshot, showMovieForm]
  );
  const importSelectionStats = useMemo(() => {
    const stats = {
      total: preparedItems.length,
      selected: 0,
      ready: 0,
      duplicate: 0,
      saved: 0,
      failed: 0,
      skipped: 0,
    };
    for (const row of preparedItems) {
      const id = String(row?.item_id || "");
      const status = String(importStatusMap[id] || (row?.duplicate?.is_duplicate ? "duplicate" : "ready"));
      if (status === "saved") stats.saved += 1;
      else if (status === "failed") stats.failed += 1;
      else if (status === "duplicate") stats.duplicate += 1;
      else if (status === "skipped") stats.skipped += 1;
      else stats.ready += 1;
      if (selectionMap[id]) stats.selected += 1;
    }
    return stats;
  }, [preparedItems, selectionMap, importStatusMap]);
  const selectableIds = useMemo(() => {
    return preparedItems
      .map((row) => String(row?.item_id || ""))
      .filter((id) => {
        if (!id) return false;
        const status = String(importStatusMap[id] || "");
        return status !== "saved" && status !== "skipped";
      });
  }, [preparedItems, importStatusMap]);
  const selectedSelectableCount = useMemo(() => {
    let count = 0;
    for (const id of selectableIds) {
      if (selectionMap[id]) count += 1;
    }
    return count;
  }, [selectableIds, selectionMap]);
  const allSelectableSelected = selectableIds.length > 0 && selectedSelectableCount === selectableIds.length;
  const someSelectableSelected = selectedSelectableCount > 0 && selectedSelectableCount < selectableIds.length;
  const selectedImportCategories = useMemo(() => {
    const selectedIds = new Set(normalizeIds(importForm.category_ids));
    return categories.filter((row) => selectedIds.has(Number(row?.id)));
  }, [categories, importForm.category_ids]);
  const selectedImportCategoryLabel = selectedImportCategories.map((row) => row?.name).filter(Boolean).join(", ");
  const effectivePreparedItems = useMemo(() => {
    const selectedIds = normalizeIds(importForm.category_ids);
    if (!selectedIds.length) return preparedItems;
    return preparedItems.map((row) => ({
      ...row,
      category_ids: selectedIds,
      category_names: selectedImportCategories.map((item) => String(item?.name || "").trim()).filter(Boolean),
      category_name: selectedImportCategories[0]?.name || row?.category_name || "",
      category_slug: selectedImportCategories[0]?.slug || row?.category_slug || "",
      category_source: "manual_override",
    }));
  }, [importForm.category_ids, preparedItems, selectedImportCategories]);

  const queuedImportIds = useMemo(() => new Set(importBatchState.queue || []), [importBatchState.queue]);
  const importResumeSignature = useMemo(() => buildImportResumeSignature(importForm), [
    importForm.base_url,
    importForm.include,
    importForm.exclude,
    importForm.providers,
    importForm.max_depth,
    importForm.category_ids,
  ]);
  const isImportableItemId = (id) => {
    const status = String(importStatusMap[id] || "");
    if (!id) return false;
    if (status === "saved" || status === "skipped" || status === "duplicate") return false;
    return Boolean(selectionMap[id]);
  };
  const rangePreviewSummary = useMemo(() => {
    const orderedIds = effectivePreparedItems.map((item) => String(item?.item_id || "")).filter(Boolean);
    const totalOrdered = orderedIds.length;
    if (!totalOrdered) {
      return { start: 0, end: 0, totalInRange: 0, importable: 0 };
    }
    const parsedRangeStart = clampPositiveInteger(importForm.range_start, 1);
    const parsedRangeEndRaw = clampNonNegativeInteger(importForm.range_end, 0);
    const safeRangeEnd = parsedRangeEndRaw > 0 ? Math.min(parsedRangeEndRaw, totalOrdered) : totalOrdered;
    const safeRangeStart = Math.min(parsedRangeStart, safeRangeEnd);
    const rangeIds = orderedIds.slice(Math.max(0, safeRangeStart - 1), safeRangeEnd);
    return {
      start: safeRangeStart,
      end: safeRangeEnd,
      totalInRange: rangeIds.length,
      importable: rangeIds.filter((id) => isImportableItemId(id)).length,
    };
  }, [
    effectivePreparedItems,
    importForm.range_start,
    importForm.range_end,
    importStatusMap,
    selectionMap,
  ]);
  const continueBatchSummary = useMemo(() => {
    const currentEndRaw = clampNonNegativeInteger(importForm.range_end, 0);
    const currentStart = clampPositiveInteger(importForm.range_start, 1);
    const currentEnd = currentEndRaw > 0 ? currentEndRaw : currentStart - 1;
    const batchSize = Math.max(1, clampNonNegativeInteger(importForm.batch_size, 0) || 50);
    const nextStart = Math.max(1, currentEnd + 1);
    const nextEnd = nextStart + batchSize - 1;
    return {
      canContinue: Boolean(String(importForm.base_url || "").trim()) && !importingMovies,
      pendingCount: batchSize,
      nextStart,
      nextEnd,
    };
  }, [
    importForm.base_url,
    importForm.range_start,
    importForm.range_end,
    importForm.batch_size,
    importingMovies,
  ]);
  const selectedCategory = useMemo(
    () => categories.find((row) => String(row?.slug || "").trim().toLowerCase() === activeCategorySlug) || null,
    [categories, activeCategorySlug]
  );

  useEffect(() => {
    if (!selectAllCheckboxRef.current) return;
    selectAllCheckboxRef.current.indeterminate = someSelectableSelected;
  }, [someSelectableSelected]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const signature = String(importResumeSignature || "");
    if (!signature) {
      setImportResumeInfo(null);
      return;
    }
    try {
      const raw = window.localStorage.getItem(IMPORT_RESUME_STORAGE_KEY);
      const store = raw ? JSON.parse(raw) || {} : {};
      const nextInfo = store?.[signature] && typeof store[signature] === "object" ? store[signature] : null;
      setImportResumeInfo(nextInfo);
    } catch {
      setImportResumeInfo(null);
    }
  }, [importResumeSignature]);

  useEffect(() => {
    if (!importResumeInfo) return;
    const signature = String(importResumeSignature || "");
    if (!signature || resumeAppliedSignatureRef.current === signature) return;
    const processed = Math.max(0, Number(importResumeInfo?.processed_count || 0));
    if (processed <= 0) return;
    const preferredBatchSize = clampNonNegativeInteger(importForm.batch_size, 0) || Math.max(1, Number(importResumeInfo?.batch_size || 50));
    const suggestedStart = processed + 1;
    const suggestedEnd = processed + preferredBatchSize;
    setImportForm((prev) => {
      const currentStart = clampPositiveInteger(prev.range_start, 1);
      const currentEndRaw = clampNonNegativeInteger(prev.range_end, 0);
      if (!(currentStart === 1 && currentEndRaw === 0)) return prev;
      return {
        ...prev,
        range_start: String(suggestedStart),
        range_end: String(suggestedEnd),
      };
    });
    resumeAppliedSignatureRef.current = signature;
  }, [importForm.batch_size, importResumeInfo, importResumeSignature]);

  useEffect(() => {
    if (!selectedCategory?.id) return;
    setImportForm((prev) => {
      const normalized = normalizeIds(prev.category_ids);
      if (normalized.length) return prev;
      return { ...prev, category_ids: [Number(selectedCategory.id)] };
    });
  }, [selectedCategory]);

  useEffect(() => {
    setActiveCategorySlug(currentCategorySlug);
  }, [currentCategorySlug]);

  useEffect(() => {
    const onPopState = () => {
      const rawPath = typeof window === "undefined" ? "" : String(window.location.pathname || "");
      const match = rawPath.match(/^\/dashboard\/movies\/category\/([^/]+)$/i);
      if (match?.[1]) {
        setActiveCategorySlug(decodeURIComponent(match[1]).trim().toLowerCase());
        return;
      }
      if (/^\/dashboard\/movies\/?$/i.test(rawPath)) {
        setActiveCategorySlug("");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateMovieCategory = (nextSlug = "") => {
    const normalized = String(nextSlug || "").trim().toLowerCase();
    const nextPath = normalized
      ? `/dashboard/movies/category/${encodeURIComponent(normalized)}`
      : "/dashboard/movies";
    if (typeof window !== "undefined") {
      window.history.pushState({ movieCategorySlug: normalized }, "", nextPath);
    }
    setActiveCategorySlug(normalized);
  };

  const moviesInSelectedCategory = useMemo(() => {
    const selectedId = String(selectedCategory?.id || "");
    if (!selectedId) return [];
    return movies.filter((movie) =>
      (movie?.categories || []).some((cat) => String(cat?.id || "") === selectedId)
    );
  }, [movies, selectedCategory]);

  const categoryMovieCount = useMemo(() => {
    const counts = new Map();
    for (const movie of movies) {
      for (const category of movie?.categories || []) {
        const key = String(category?.id || "");
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return counts;
  }, [movies]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return categories.filter((row) => {
      const name = String(row?.name || "").toLowerCase();
      const slug = String(row?.slug || "").toLowerCase();
      const count = Number(categoryMovieCount.get(String(row?.id || "")) || 0);
      const matchesText = !q || name.includes(q) || slug.includes(q);
      const matchesCount =
        categoryCountFilter === "with_movies"
          ? count > 0
          : categoryCountFilter === "without_movies"
            ? count === 0
            : true;
      return matchesText && matchesCount;
    });
  }, [categories, categoryCountFilter, categoryMovieCount, categorySearch]);

  useEffect(() => {
    if (!showMovieForm || !selectedCategory?.id) return;
    setMovieForm((prev) => {
      const normalized = normalizeIds(prev.category_ids);
      const categoryId = Number(selectedCategory.id);
      if (normalized.includes(categoryId)) return prev;
      return { ...prev, category_ids: normalizeIds([...normalized, categoryId]) };
    });
  }, [showMovieForm, selectedCategory]);

  const resetMovieForm = () => {
    const next = { ...EMPTY_MOVIE_FORM };
    setMovieForm(next);
    setMovieFormInitialSnapshot(serializeMovieForm(next));
    setImdbQuery("");
    setImdbImagePreviewUrls([]);
    setMetadataSearchCandidates([]);
    setSelectedMetadataCandidateId("");
    setSearchingMetadataByTitle(false);
    setSourceCheckLoading(false);
    setSourceCheckResult(null);
    setSourceCheckUrl("");
  };
  const closeMovieForm = () => {
    if (!confirmDiscardMovieForm()) return;
    setShowMovieForm(false);
    resetMovieForm();
  };

  const openNewMovieForm = () => {
    const next = {
      ...EMPTY_MOVIE_FORM,
      category_ids: selectedCategory ? [Number(selectedCategory.id)] : [],
    };
    setSourceCheckLoading(false);
    setSourceCheckResult(null);
    setSourceCheckUrl("");
    setShowMovieForm(true);
    setImdbQuery("");
    setImdbImagePreviewUrls([]);
    setMetadataSearchCandidates([]);
    setSelectedMetadataCandidateId("");
    setMovieForm(next);
    setMovieFormInitialSnapshot(serializeMovieForm(next));
  };

  const closeSourcePreview = () => {
    setPreviewLoading(false);
    setPreviewError("");
    setPreviewSourceUrl("");
    setPreviewTitle("");
  };

  const openSourcePreview = () => {
    const source = String(movieForm.source_url || "").trim();
    if (!source) {
      setError("Source URL দিন, তারপর Test Link চাপুন।");
      return;
    }
    openPreviewForSource(String(movieForm.title || "Link Test Preview"), source);
  };

  const openPreviewForSource = (title, sourceUrl) => {
    const source = String(sourceUrl || "").trim();
    if (!source) {
      setError("Preview করার জন্য source URL পাওয়া যায়নি।");
      return;
    }
    setError("");
    setPreviewError("");
    setPreviewLoading(true);
    setPreviewSourceUrl(source);
    setPreviewTitle(String(title || "Link Test Preview"));
  };

  const handleValidateSource = async () => {
    const source = String(movieForm.source_url || "").trim();
    if (!source) {
      setError("Source URL দিন, তারপর Validate Live চাপুন।");
      return;
    }
    setError("");
    setSourceCheckLoading(true);
    try {
      const res = await fetch("/api/admin/movie-source-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: source }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Source validation failed");
      setSourceCheckResult(payload);
      setSourceCheckUrl(source);
    } catch (err) {
      setSourceCheckResult({
        verdict: "fail",
        summary: String(err?.message || "Source validation failed"),
        reasons: [],
        checks: null,
      });
      setSourceCheckUrl(source);
    } finally {
      setSourceCheckLoading(false);
    }
  };

  const confirmDiscardMovieForm = () => {
    if (!isMovieFormDirty) return true;
    return window.confirm("আপনি পরিবর্তনগুলো save করেননি। Save না করে বের হতে চান?");
  };

  useEffect(() => {
    if (!isMovieFormDirty) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      const ok = window.confirm("আপনি পরিবর্তনগুলো save করেননি। Save না করে বের হতে চান?");
      if (!ok) {
        window.history.pushState({ movieFormGuard: true }, "", window.location.href);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.history.pushState({ movieFormGuard: true }, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isMovieFormDirty]);

  useEffect(() => {
    if (!previewSourceUrl) return undefined;

    const video = previewVideoEl;
    const source = resolveBrowserPlaybackUrl(
      previewSourceUrl,
      typeof window === "undefined" ? "" : window.location.protocol
    );
    if (!video) return undefined;

    if (previewHlsRef.current) {
      previewHlsRef.current.destroy();
      previewHlsRef.current = null;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();

    setPreviewError("");
    setPreviewLoading(true);
    let cancelled = false;
    let nativeFallbackTried = false;
    let compatibilityFallbackTried = false;
    const compatibilitySource = shouldForceVideoTranscode(previewSourceUrl)
      ? toStreamTranscodeUrl(previewSourceUrl, { video: "transcode" })
      : "";

    const onCanPlay = () => {
      if (cancelled) return;
      setPreviewLoading(false);
      setPreviewError("");
    };

    const onError = () => {
      if (cancelled) return;
      if (!compatibilityFallbackTried && compatibilitySource) {
        compatibilityFallbackTried = true;
        video.pause();
        video.src = compatibilitySource;
        video.load();
        video.play().catch(() => {});
        return;
      }
      setPreviewLoading(false);
      setPreviewError("Unable to play this movie link.");
    };

    video.addEventListener("loadedmetadata", onCanPlay);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onCanPlay);
    video.addEventListener("error", onError);

    const startNativePlayback = () => {
      video.src = source;
      video.load();
      video.play().catch(() => {});
    };

    (async () => {
      try {
        if (isHlsUrl(source)) {
          const Hls = await loadHlsScript();
          if (cancelled) return;
          if (Hls?.isSupported?.()) {
            const hls = new Hls({ lowLatencyMode: true, maxBufferLength: 30 });
            previewHlsRef.current = hls;
            hls.loadSource(source);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (cancelled) return;
              setPreviewLoading(false);
              video.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data?.fatal || cancelled) return;
              hls.destroy();
              previewHlsRef.current = null;
              if (!nativeFallbackTried) {
                nativeFallbackTried = true;
                startNativePlayback();
                return;
              }
              setPreviewLoading(false);
              setPreviewError("Unable to play this movie link.");
            });
            return;
          }
        }
        startNativePlayback();
      } catch {
        if (cancelled) return;
        setPreviewLoading(false);
        setPreviewError("Unable to load movie link preview.");
      }
    })();

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onCanPlay);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onCanPlay);
      video.removeEventListener("error", onError);
      if (previewHlsRef.current) {
        previewHlsRef.current.destroy();
        previewHlsRef.current = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
      setPreviewLoading(false);
    };
  }, [previewSourceUrl, previewVideoEl]);

  const refreshCategories = async () => {
    const res = await fetch("/api/admin/movie-categories", { cache: "no-store" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || "Failed to load categories");
    setCategories(Array.isArray(payload?.items) ? payload.items : []);
  };

  const refreshMovies = async () => {
    const res = await fetch("/api/admin/movies", { cache: "no-store" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || "Failed to load movies");
    setMovies(Array.isArray(payload?.items) ? payload.items : []);
  };

  const refreshMovieMetadataSettings = async () => {
    setMovieMetadataSettingsLoading(true);
    try {
      const res = await fetch("/api/admin/movie-metadata-settings", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to load movie metadata settings");
      setOmdbKeysText(Array.isArray(payload?.omdb_api_keys) ? payload.omdb_api_keys.join("\n") : "");
      setOmdbUsageInfo(payload?.omdb_usage || null);
    } catch (err) {
      setError(err?.message || "Failed to load movie metadata settings");
    } finally {
      setMovieMetadataSettingsLoading(false);
    }
  };

  const handleSaveOmdbKeys = async () => {
    setMovieMetadataSettingsSaving(true);
    setError("");
    setMessage("");
    try {
      const keys = String(omdbKeysText || "")
        .split(/[,\n\r]+/g)
        .map((item) => item.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/movie-metadata-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ omdb_api_keys: keys }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to save OMDb keys");
      setOmdbKeysText(Array.isArray(payload?.omdb_api_keys) ? payload.omdb_api_keys.join("\n") : "");
      setOmdbUsageInfo(payload?.omdb_usage || null);
      setMessage("OMDb API keys saved.");
    } catch (err) {
      setError(err?.message || "Failed to save OMDb keys");
    } finally {
      setMovieMetadataSettingsSaving(false);
    }
  };

  const runMovieScan = async (formOverrides = {}) => {
    const scanForm = { ...importForm, ...formOverrides };
    setError("");
    setMessage("");
    setImportSummary(null);
    setPreparedItems([]);
    setSelectionMap({});
    setImportStatusMap({});
    setScanRawItems([]);
    setScanRawCount(0);
    setScanPreparedCount(0);
    setImportProgress({
      total: 0,
      processed: 0,
      remaining: 0,
      saved: 0,
      skipped: 0,
      failed: 0,
      current_title: "",
      current_status: "",
    });
    setImportBatchState({
      source_ids: [],
      queue: [],
      queue_total: 0,
      processed: 0,
      remaining: 0,
      batch_size: 0,
      next_batch_number: 1,
      paused: false,
      saved: 0,
      skipped: 0,
      failed: 0,
      range_start: 0,
      range_end: 0,
      category_ids: [],
    });
    setImportingMovies(true);
    try {
      const parsedRangeStart = clampPositiveInteger(scanForm.range_start, 1);
      const parsedRangeEndRaw = clampNonNegativeInteger(scanForm.range_end, 0);
      const payload = {
        base_url: String(scanForm.base_url || "").trim(),
        include: String(scanForm.include || ""),
        exclude: String(scanForm.exclude || ""),
        providers: String(scanForm.providers || ""),
        publish: Boolean(scanForm.publish),
        limit: Number(scanForm.limit || 0),
        max_depth: Number(scanForm.max_depth || 6),
        range_start: parsedRangeStart,
        range_end: parsedRangeEndRaw,
      };
      const res = await fetch("/api/admin/movies/import/scan-stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Movie scan failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalSummary = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const raw = line.trim();
          if (!raw) continue;
          let evt = null;
          try {
            evt = JSON.parse(raw);
          } catch {
            continue;
          }
          if (evt?.type === "raw_found") {
            setScanRawCount(Number(evt.raw_count || 0));
            setScanRawItems((prev) => {
              const next = prev.concat({
                title: String(evt.title || "Untitled"),
                category_name: String(evt.category_name || ""),
                source_url: String(evt.source_url || ""),
              });
              return next.slice(-200);
            });
          }
          if (evt?.type === "prepared") {
            setScanPreparedCount(Number(evt.prepared_count || 0));
            const item = evt?.item && typeof evt.item === "object" ? evt.item : null;
            if (item) {
              const id = String(item?.item_id || "");
              if (id) {
                setPreparedItems((prev) => {
                  const has = prev.some((row) => String(row?.item_id || "") === id);
                  if (has) return prev;
                  return prev.concat(item);
                });
                setSelectionMap((prev) => {
                  if (Object.prototype.hasOwnProperty.call(prev || {}, id)) return prev;
                  return { ...(prev || {}), [id]: !Boolean(item?.duplicate?.is_duplicate) };
                });
                setImportStatusMap((prev) => {
                  if (Object.prototype.hasOwnProperty.call(prev || {}, id)) return prev;
                  return {
                    ...(prev || {}),
                    [id]: item?.duplicate?.is_duplicate ? "duplicate" : "ready",
                  };
                });
              }
            }
          }
          if (evt?.type === "error") {
            throw new Error(evt.error || "Movie scan failed");
          }
          if (evt?.type === "complete") {
            finalSummary = evt.summary || null;
          }
        }
      }

      if (!finalSummary) {
        throw new Error("Scan finished without summary.");
      }

      const items = Array.isArray(finalSummary?.items) ? finalSummary.items : [];
      setScanRawCount(Number(finalSummary?.scanned_count || 0));
      setScanPreparedCount(Number(finalSummary?.candidate_count || 0));
      const nextSelection = {};
      const nextStatus = {};
      for (const row of items) {
        const id = String(row?.item_id || "");
        if (!id) continue;
        nextSelection[id] = !Boolean(row?.duplicate?.is_duplicate);
        nextStatus[id] = row?.duplicate?.is_duplicate ? "duplicate" : "ready";
      }
      setPreparedItems(items);
      setSelectionMap(nextSelection);
      setImportStatusMap(nextStatus);
      setImportSummary(finalSummary);
      setImportForm((prev) => ({
        ...prev,
        ...formOverrides,
        range_start: String(Number(finalSummary?.range_start || parsedRangeStart) || parsedRangeStart),
        range_end: String(Number(finalSummary?.range_end || parsedRangeEndRaw) || parsedRangeEndRaw || 0),
      }));
      setMessage("Scan complete. এই range review করে Import দিন।");
    } catch (err) {
      setError(err?.message || "Movie import failed");
    } finally {
      setImportingMovies(false);
    }
  };

  const handleImportMovies = async (event) => {
    event.preventDefault();
    await runMovieScan();
  };

  const persistImportResumeInfo = ({ processedCount = 0, batchSize = 0, lastRangeStart = 1, lastRangeEnd = 0 } = {}) => {
    if (typeof window === "undefined") return;
    const signature = String(importResumeSignature || "");
    if (!signature) return;
    const safeProcessed = Math.max(0, Number(processedCount || 0));
    if (!safeProcessed) return;
    const nextInfo = {
      processed_count: safeProcessed,
      batch_size: Math.max(0, Number(batchSize || 0)),
      range_start: Math.max(1, Number(lastRangeStart || 1)),
      range_end: Math.max(0, Number(lastRangeEnd || 0)),
      updated_at: new Date().toISOString(),
      base_url: String(importForm.base_url || "").trim(),
    };
    try {
      const raw = window.localStorage.getItem(IMPORT_RESUME_STORAGE_KEY);
      const store = raw ? JSON.parse(raw) || {} : {};
      store[signature] = nextInfo;
      window.localStorage.setItem(IMPORT_RESUME_STORAGE_KEY, JSON.stringify(store));
      setImportResumeInfo(nextInfo);
    } catch {
      // ignore localStorage write issues
    }
  };

  const handleApplyResumeRange = () => {
    const processed = Math.max(0, Number(importResumeInfo?.processed_count || 0));
    if (processed <= 0) return;
    const preferredBatchSize = clampNonNegativeInteger(importForm.batch_size, 0) || Math.max(1, Number(importResumeInfo?.batch_size || 50));
    setImportForm((prev) => ({
      ...prev,
      range_start: String(processed + 1),
      range_end: String(processed + preferredBatchSize),
    }));
    setMessage(
      `Resume range set to ${processed + 1}-${processed + preferredBatchSize}. একই link scan দিলে এই range থেকে next import শুরু করতে পারবেন।`
    );
  };

  const runPreparedMovieImportBatch = async ({
    queuedIds,
    batchStartIndex,
    batchSize,
    rangeStart,
    rangeEnd,
    categoryIds = [],
  }) => {
    const safeQueue = Array.isArray(queuedIds) ? queuedIds.filter(Boolean) : [];
    if (!safeQueue.length) {
      throw new Error("Import queue empty.");
    }

    const startIndex = Math.max(0, Number(batchStartIndex || 0));
    const safeBatchSize = Math.max(1, clampPositiveInteger(batchSize, safeQueue.length));
    const batchIds = safeQueue.slice(startIndex, startIndex + safeBatchSize);
    if (!batchIds.length) {
      throw new Error("No queued items left for import.");
    }

    const queuedIdSet = new Set(batchIds);
    const frozenCategoryIds = normalizeIds(categoryIds);
    const frozenCategoryRows = categories.filter((row) => frozenCategoryIds.includes(Number(row?.id)));
    const itemsSource = frozenCategoryIds.length
      ? preparedItems.map((row) => ({
          ...row,
          category_ids: frozenCategoryIds,
          category_names: frozenCategoryRows.map((item) => String(item?.name || "").trim()).filter(Boolean),
          category_name: frozenCategoryRows[0]?.name || row?.category_name || "",
          category_slug: frozenCategoryRows[0]?.slug || row?.category_slug || "",
          category_source: "manual_override",
        }))
      : effectivePreparedItems;
    const selectedItems = itemsSource.filter((item) => {
      const id = String(item?.item_id || "");
      return queuedIdSet.has(id) && isImportableItemId(id);
    });

    setImportProgress({
      total: selectedItems.length,
      processed: 0,
      remaining: selectedItems.length,
      saved: 0,
      skipped: 0,
      failed: 0,
      current_title: "",
      current_status: "",
    });

    const nextProcessed = startIndex + batchIds.length;
    const remaining = Math.max(0, safeQueue.length - nextProcessed);
    const nextBatchNumber = Math.floor(nextProcessed / safeBatchSize) + 1;
    const absoluteProcessedCount = Math.max(0, Number(rangeStart || 1) - 1 + nextProcessed);

    if (!selectedItems.length) {
      setImportBatchState((prev) => ({
        ...prev,
        source_ids:
          Array.isArray(prev?.source_ids) && prev.source_ids.length
            ? prev.source_ids
            : safeQueue,
        queue: safeQueue,
        queue_total: safeQueue.length,
        processed: nextProcessed,
        remaining,
        batch_size: safeBatchSize,
        next_batch_number: nextBatchNumber,
        paused: remaining > 0,
        range_start: rangeStart,
        range_end: rangeEnd,
        category_ids: frozenCategoryIds,
      }));
      persistImportResumeInfo({
        processedCount: absoluteProcessedCount,
        batchSize: safeBatchSize,
        lastRangeStart: rangeStart,
        lastRangeEnd: rangeEnd,
      });
      setMessage(
        remaining > 0
          ? `Current batch-এ নতুন importable item ছিল না. Continue Next Batch চাপলে পরের ${Math.min(safeBatchSize, remaining)}টি position check হবে।`
          : "Selected range-এর সব item already imported, duplicate, বা unselected."
      );
      return;
    }

    const res = await fetch("/api/admin/movies/import/import-stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "import",
        publish: Boolean(importForm.publish),
        skip_duplicates: false,
        prepared_items: selectedItems,
      }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || "Import failed");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalSummary = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const raw = line.trim();
        if (!raw) continue;
        let evt = null;
        try {
          evt = JSON.parse(raw);
        } catch {
          continue;
        }
        if (evt?.type === "error") {
          throw new Error(evt.error || "Import failed");
        }
        if (evt?.type === "progress") {
          const itemId = String(evt?.item_id || "");
          const status = String(evt?.status || "");
          if (itemId && status) {
            setImportStatusMap((prev) => ({ ...(prev || {}), [itemId]: status }));
            if (status === "saved" || status === "skipped") {
              setSelectionMap((prev) => ({ ...(prev || {}), [itemId]: false }));
            }
          }
          const c = evt?.counters || {};
          setImportProgress({
            total: Number(c?.total || selectedItems.length),
            processed: Number(c?.processed || 0),
            remaining: Number(c?.remaining || 0),
            saved: Number(c?.saved || 0),
            skipped: Number(c?.skipped || 0),
            failed: Number(c?.failed || 0),
            current_title: String(evt?.title || ""),
            current_status: status,
          });
        }
        if (evt?.type === "complete") {
          finalSummary = evt.summary || null;
        }
      }
    }

    if (!finalSummary) {
      throw new Error("Import finished without summary.");
    }

    setImportBatchState((prev) => ({
      ...prev,
      source_ids:
        Array.isArray(prev?.source_ids) && prev.source_ids.length
          ? prev.source_ids
          : safeQueue,
      queue: safeQueue,
      queue_total: safeQueue.length,
      processed: nextProcessed,
      remaining,
      batch_size: safeBatchSize,
      next_batch_number: nextBatchNumber,
      paused: remaining > 0,
      saved: Number(prev?.saved || 0) + Number(finalSummary?.saved_count || 0),
      skipped: Number(prev?.skipped || 0) + Number(finalSummary?.skipped_count || 0),
      failed: Number(prev?.failed || 0) + Number(finalSummary?.failed_count || 0),
      range_start: rangeStart,
      range_end: rangeEnd,
      category_ids: frozenCategoryIds,
    }));
    persistImportResumeInfo({
      processedCount: absoluteProcessedCount,
      batchSize: safeBatchSize,
      lastRangeStart: rangeStart,
      lastRangeEnd: rangeEnd,
    });

    setImportSummary((prev) => ({
      ...(prev || {}),
      import_result: finalSummary,
    }));
    await Promise.all([refreshMovies(), refreshCategories()]);

    if (remaining > 0) {
      setMessage(
        `Batch ${Math.floor(startIndex / safeBatchSize) + 1} done. Saved ${Number(finalSummary?.saved_count || 0)}, skipped ${Number(finalSummary?.skipped_count || 0)}, failed ${Number(finalSummary?.failed_count || 0)}. Continue Next Batch চাপলে পরের ${Math.min(safeBatchSize, remaining)}টি import হবে।`
      );
    } else {
      setMessage(
        `Import done. Saved ${Number(finalSummary?.saved_count || 0)}, skipped ${Number(finalSummary?.skipped_count || 0)}, failed ${Number(finalSummary?.failed_count || 0)}. Failed rows are marked as "failed".`
      );
    }
  };

  const handleImportPreparedMovies = async () => {
    if (!effectivePreparedItems.length) {
      setError("আগে scan চালান, তারপর import দিন।");
      return;
    }
    setError("");
    setMessage("");
    setImportingPrepared(true);
    try {
      const orderedIds = effectivePreparedItems.map((item) => String(item?.item_id || "")).filter(Boolean);
      if (!orderedIds.length) {
        throw new Error("Prepared list-এ valid item নেই।");
      }
      const totalOrdered = orderedIds.length;
      const parsedRangeStart = clampPositiveInteger(importForm.range_start, 1);
      const parsedRangeEndRaw = clampNonNegativeInteger(importForm.range_end, 0);
      const safeRangeEnd = parsedRangeEndRaw > 0 ? Math.min(parsedRangeEndRaw, totalOrdered) : totalOrdered;
      const safeRangeStart = Math.min(parsedRangeStart, safeRangeEnd);
      const rangeOrderedIds = orderedIds.slice(Math.max(0, safeRangeStart - 1), safeRangeEnd);
      if (!rangeOrderedIds.length) {
        throw new Error("Selected range-এ কোনো item নেই।");
      }
      const importableCountInRange = rangeOrderedIds.filter((id) => isImportableItemId(id)).length;
      if (!importableCountInRange) {
        throw new Error("Selected range-এর সব item duplicate, already imported, অথবা unselected.");
      }

      const batchSize = clampNonNegativeInteger(importForm.batch_size, 0);
      const effectiveBatchSize = batchSize > 0 ? batchSize : rangeOrderedIds.length;

      setImportBatchState({
        source_ids: orderedIds,
        queue: rangeOrderedIds,
        queue_total: rangeOrderedIds.length,
        processed: 0,
        remaining: rangeOrderedIds.length,
        batch_size: effectiveBatchSize,
        next_batch_number: 1,
        paused: false,
        saved: 0,
        skipped: 0,
        failed: 0,
        range_start: safeRangeStart,
        range_end: safeRangeEnd,
        category_ids: normalizeIds(importForm.category_ids),
      });

      await runPreparedMovieImportBatch({
        queuedIds: rangeOrderedIds,
        batchStartIndex: 0,
        batchSize: effectiveBatchSize,
        rangeStart: safeRangeStart,
        rangeEnd: safeRangeEnd,
        categoryIds: normalizeIds(importForm.category_ids),
      });
    } catch (err) {
      setError(err?.message || "Import failed");
    } finally {
      setImportingPrepared(false);
    }
  };

  const handleContinueImportBatch = async () => {
    const currentEndRaw = clampNonNegativeInteger(importForm.range_end, 0);
    const currentStart = clampPositiveInteger(importForm.range_start, 1);
    const currentEnd = currentEndRaw > 0 ? currentEndRaw : currentStart - 1;
    const batchSize = Math.max(1, clampNonNegativeInteger(importForm.batch_size, 0) || 50);
    const nextStart = Math.max(1, currentEnd + 1);
    const nextEnd = nextStart + batchSize - 1;

    if (!String(importForm.base_url || "").trim()) {
      setError("আগে Base URL দিন।");
      return;
    }
    await runMovieScan({
      range_start: String(nextStart),
      range_end: String(nextEnd),
    });
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSavingCategory(true);
    try {
      const body = {
        name: categoryForm.name,
        slug: categoryForm.slug || toSlug(categoryForm.name),
        position: Number(categoryForm.position || 0),
      };
      const isEdit = Boolean(categoryForm.id);
      const url = isEdit
        ? `/api/admin/movie-categories/${encodeURIComponent(categoryForm.id)}`
        : "/api/admin/movie-categories";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Category save failed");
      await refreshCategories();
      setCategoryForm({ id: "", name: "", slug: "", position: "0" });
      setShowCategoryForm(false);
      setMessage("Category saved.");
    } catch (err) {
      setError(err?.message || "Category save failed");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!id) return;
    if (!window.confirm("Delete this category?")) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/movie-categories/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Category delete failed");
      await refreshCategories();
      setMessage("Category deleted.");
    } catch (err) {
      setError(err?.message || "Category delete failed");
    }
  };

  const saveMovieForm = async ({ closeAfterSave = false } = {}) => {
    setError("");
    setMessage("");
    setSavingMovie(true);
    try {
      const body = {
        title: movieForm.title,
        slug: movieForm.slug || toSlug(movieForm.title),
        synopsis: movieForm.synopsis,
        poster_url: movieForm.poster_url,
        backdrop_url: movieForm.backdrop_url,
        release_year: Number(movieForm.release_year || 0),
        runtime_seconds: Number(movieForm.runtime_seconds || 0),
        source_url: movieForm.source_url,
        imdb_id: movieForm.imdb_id,
        imdb_url: movieForm.imdb_url,
        imdb_rating: movieForm.imdb_rating === "" ? null : Number(movieForm.imdb_rating),
        imdb_votes: movieForm.imdb_votes === "" ? null : Number(movieForm.imdb_votes),
        content_rating: movieForm.content_rating,
        imdb_genres: toList(movieForm.imdb_genres),
        imdb_directors: toList(movieForm.imdb_directors),
        imdb_writers: toList(movieForm.imdb_writers),
        imdb_stars: toList(movieForm.imdb_stars),
        imdb_release_date: movieForm.imdb_release_date,
        imdb_countries: toList(movieForm.imdb_countries),
        imdb_languages: toList(movieForm.imdb_languages),
        is_published: Boolean(movieForm.is_published),
        category_ids: normalizeIds(movieForm.category_ids),
      };

      const isEdit = Boolean(movieForm.id);
      const url = isEdit ? `/api/admin/movies/${encodeURIComponent(movieForm.id)}` : "/api/admin/movies";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Movie save failed");

      await refreshMovies();
      if (!isEdit || closeAfterSave) {
        resetMovieForm();
        setShowMovieForm(false);
        setMessage(isEdit ? "Movie updated and closed." : "Movie saved.");
      } else {
        setMovieForm((prev) => {
          const next = {
            ...prev,
            slug: body.slug,
          };
          setMovieFormInitialSnapshot(serializeMovieForm(next));
          return next;
        });
        setMessage("Movie updated.");
      }
    } catch (err) {
      setError(err?.message || "Movie save failed");
    } finally {
      setSavingMovie(false);
    }
  };

  const handleMovieSubmit = async (event) => {
    event.preventDefault();
    await saveMovieForm({ closeAfterSave: false });
  };

  const applyFetchedMovieMetadata = (item = {}, payload = {}) => {
    const imageUrls = Array.isArray(item.image_urls)
      ? item.image_urls.map((v) => String(v || "").trim()).filter(Boolean)
      : [];
    const previewUrls = [
      ...new Set([item.poster_url, item.backdrop_url, ...imageUrls].map((v) => String(v || "").trim()).filter(Boolean)),
    ];
    setMovieForm((prev) => ({
      ...prev,
      title: item.title || prev.title,
      slug: toSlug(item.title || prev.title || prev.slug),
      synopsis: item.synopsis || prev.synopsis,
      poster_url: item.poster_url || prev.poster_url,
      backdrop_url: item.backdrop_url || item.poster_url || prev.backdrop_url,
      release_year: item.release_year ? String(item.release_year) : prev.release_year,
      runtime_seconds: item.runtime_seconds ? String(item.runtime_seconds) : prev.runtime_seconds,
      imdb_id: item.imdb_id || prev.imdb_id,
      imdb_url: item.imdb_url || prev.imdb_url,
      imdb_rating: Number.isFinite(item.imdb_rating) ? String(item.imdb_rating) : prev.imdb_rating,
      imdb_votes: Number.isInteger(item.imdb_votes) ? String(item.imdb_votes) : prev.imdb_votes,
      content_rating: item.content_rating || prev.content_rating,
      imdb_genres: toCsv(item.imdb_genres) || prev.imdb_genres,
      imdb_directors: toCsv(item.imdb_directors) || prev.imdb_directors,
      imdb_writers: toCsv(item.imdb_writers) || prev.imdb_writers,
      imdb_stars: toCsv(item.imdb_stars) || prev.imdb_stars,
      imdb_release_date: item.imdb_release_date || prev.imdb_release_date,
      imdb_countries: toCsv(item.imdb_countries) || prev.imdb_countries,
      imdb_languages: toCsv(item.imdb_languages) || prev.imdb_languages,
    }));
    setImdbImagePreviewUrls(previewUrls);
    if (payload?.omdb_usage) setOmdbUsageInfo(payload.omdb_usage);
    if (item.imdb_id) setImdbQuery(item.imdb_id);
    setMetadataSearchCandidates([]);
    setSelectedMetadataCandidateId("");
    const provider = String(payload?.provider || item?.provider || "imdb");
    setMessage(`Metadata auto-fill হয়েছে (${provider}). এখন চাইলে edit করে save করুন।`);
  };

  const handleFetchImdb = async () => {
    setError("");
    setMessage("");
    const query = String(imdbQuery || "").trim();
    if (!query) {
      setError("IMDb ID / URL বা title দিন (example: tt39961926 বা Punascha)");
      return;
    }
    setFetchingImdb(true);
    try {
      const isImdbLookup = /tt\d{6,12}/i.test(query) || /imdb\.com\/title\//i.test(query);
      const res = await fetch("/api/admin/movies/imdb", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isImdbLookup
            ? { query }
            : {
                mode: "fetch_title",
                query,
                year: Number(movieForm.release_year || 0) || undefined,
              }
        ),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(payload?.error || "Failed to fetch IMDb data").trim());
      }
      applyFetchedMovieMetadata(payload?.item || {}, payload);
    } catch (err) {
      setError(err?.message || "Failed to fetch IMDb data");
    } finally {
      setFetchingImdb(false);
    }
  };

  const handleSearchMetadataByTitle = async () => {
    setError("");
    setMessage("");
    const titleQuery = String(imdbQuery || movieForm.title || "").trim();
    if (!titleQuery) {
      setError("Title দিন, তারপর Search by Title চাপুন।");
      return;
    }
    setSearchingMetadataByTitle(true);
    setMetadataSearchCandidates([]);
    setSelectedMetadataCandidateId("");
    try {
      const res = await fetch("/api/admin/movies/imdb", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "search_title",
          query: titleQuery,
          year: Number(movieForm.release_year || 0) || undefined,
          limit: 6,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(payload?.error || "Failed to search metadata candidates").trim());
      }
      const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
      setMetadataSearchCandidates(candidates);
      setSelectedMetadataCandidateId(String(candidates[0]?.imdb_id || ""));
      if (!candidates.length) {
        setError("এই title-এর জন্য কোনো metadata candidate পাওয়া যায়নি।");
        return;
      }
      setMessage(`${candidates.length}টি metadata candidate পাওয়া গেছে। পোস্টার দেখে সঠিকটা select করুন।`);
    } catch (err) {
      setError(err?.message || "Failed to search metadata candidates");
    } finally {
      setSearchingMetadataByTitle(false);
    }
  };

  const handleApplyMetadataCandidate = () => {
    const picked = metadataSearchCandidates.find((row) => String(row?.imdb_id || "") === String(selectedMetadataCandidateId || ""));
    if (!picked?.item) {
      setError("আগে একটি candidate select করুন।");
      return;
    }
    setError("");
    applyFetchedMovieMetadata(picked.item, {
      provider: picked?.item?.provider || picked?.source || "imdb",
    });
  };

  const handleDeleteMovie = async (id) => {
    if (!id) return;
    if (!window.confirm("Delete this movie?")) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/movies/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Movie delete failed");
      await refreshMovies();
      setMovieRowSelection((prev) => {
        if (!prev[String(id)]) return prev;
        const next = { ...prev };
        delete next[String(id)];
        return next;
      });
      if (String(movieForm.id || "") === String(id)) resetMovieForm();
      setMessage("Movie deleted.");
    } catch (err) {
      setError(err?.message || "Movie delete failed");
    }
  };

  const openMovieEditor = (row) => {
    if (!row) return;
    const firstSource = Array.isArray(row.sources) ? row.sources[0] : null;
    const next = {
      id: String(row.id || ""),
      title: String(row.title || ""),
      slug: String(row.slug || ""),
      synopsis: String(row.synopsis || ""),
      poster_url: String(row.poster_url || ""),
      backdrop_url: String(row.backdrop_url || ""),
      release_year: String(row.release_year || ""),
      runtime_seconds: String(row.runtime_seconds || ""),
      source_url: String(firstSource?.source_url || ""),
      imdb_id: String(row.imdb_id || ""),
      imdb_url: String(row.imdb_url || ""),
      imdb_rating: row.imdb_rating == null ? "" : String(row.imdb_rating),
      imdb_votes: row.imdb_votes == null ? "" : String(row.imdb_votes),
      content_rating: String(row.content_rating || ""),
      imdb_genres: toCsv(row.imdb_genres),
      imdb_directors: toCsv(row.imdb_directors),
      imdb_writers: toCsv(row.imdb_writers),
      imdb_stars: toCsv(row.imdb_stars),
      imdb_release_date: String(row.imdb_release_date || ""),
      imdb_countries: toCsv(row.imdb_countries),
      imdb_languages: toCsv(row.imdb_languages),
      is_published: Boolean(row.is_published),
      category_ids: (row.categories || []).map((cat) => Number(cat.id)).filter(Boolean),
    };
    setImdbImagePreviewUrls(
      [...new Set([row.poster_url, row.backdrop_url].map((v) => String(v || "").trim()).filter(Boolean))]
    );
    setImdbQuery(String(row.imdb_id || ""));
    setMetadataSearchCandidates([]);
    setSelectedMetadataCandidateId("");
    setSourceCheckLoading(false);
    setSourceCheckResult(null);
    setSourceCheckUrl("");
    setMovieForm(next);
    setMovieFormInitialSnapshot(serializeMovieForm(next));
    setShowMovieForm(true);
  };

  const openMoviePreview = (row) => {
    if (!row) return;
    const firstSource = Array.isArray(row.sources) ? row.sources[0] : null;
    openPreviewForSource(String(row.title || "Movie Preview"), String(firstSource?.source_url || ""));
  };

  const handleDeleteSelectedMovies = async () => {
    const selectedIds = Object.entries(movieRowSelection)
      .filter(([, checked]) => Boolean(checked))
      .map(([id]) => String(id));
    if (!selectedIds.length) {
      setError("Delete করার জন্য আগে movie select করুন।");
      return;
    }
    const selectedRows = moviesInSelectedCategory.filter((row) => selectedIds.includes(String(row.id)));
    if (!window.confirm(`${selectedRows.length}টি movie delete করবেন?`)) return;

    setError("");
    setMessage("");
    setSavingMovie(true);
    const failedTitles = [];
    let deleted = 0;
    for (const row of selectedRows) {
      try {
        const res = await fetch(`/api/admin/movies/${encodeURIComponent(row.id)}`, { method: "DELETE" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Movie delete failed");
        deleted += 1;
      } catch {
        failedTitles.push(String(row?.title || row?.id || "Unknown"));
      }
    }

    await refreshMovies();
    setMovieRowSelection({});
    if (failedTitles.length) {
      setError(`Delete failed (${failedTitles.length}): ${failedTitles.slice(0, 5).join(", ")}`);
    }
    if (deleted > 0) {
      setMessage(`${deleted}টি movie deleted.`);
    }
    setSavingMovie(false);
  };

  const handleCheckAndDeleteBrokenMovies = async () => {
    const rows = Array.isArray(moviesInSelectedCategory) ? moviesInSelectedCategory : [];
    if (!rows.length) {
      setError("এই category-তে কোনো movie পাওয়া যায়নি।");
      return;
    }

    const ok = window.confirm(
      `এই category-এর ${rows.length}টা movie check করা হবে। শুধুমাত্র যেগুলো explicit hard-broken ধরা পড়বে সেগুলোই delete হবে; warning/fetch-uncertain source delete হবে না। Continue করবেন?`
    );
    if (!ok) return;

    setCheckingBrokenMovies(true);
    setBrokenMovieCleanupSummary(null);
    setBrokenMovieCleanupCurrentTitle("");
    setError("");
    setMessage("");

    const summary = {
      total: rows.length,
      checked: 0,
      remaining: rows.length,
      deleted: 0,
      safe: 0,
      warnings: 0,
      missingSource: 0,
      validationErrors: 0,
      deletedTitles: [],
    };

    try {
      for (const row of rows) {
        setBrokenMovieCleanupCurrentTitle(String(row?.title || ""));
        summary.checked += 1;
        summary.remaining = Math.max(0, summary.total - summary.checked);
        setBrokenMovieCleanupSummary({ ...summary, deletedTitles: [...summary.deletedTitles] });
        const firstSource = Array.isArray(row?.sources) ? row.sources[0] : null;
        const sourceUrl = String(firstSource?.source_url || "").trim();
        if (!sourceUrl) {
          summary.missingSource += 1;
          setBrokenMovieCleanupSummary({ ...summary, deletedTitles: [...summary.deletedTitles] });
          continue;
        }

        let validation = null;
        try {
          const validateRes = await fetch("/api/admin/movie-source-check", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: sourceUrl }),
          });
          validation = await validateRes.json().catch(() => ({}));
          if (!validateRes.ok) {
            summary.validationErrors += 1;
            setBrokenMovieCleanupSummary({ ...summary, deletedTitles: [...summary.deletedTitles] });
            continue;
          }
        } catch {
          summary.validationErrors += 1;
          setBrokenMovieCleanupSummary({ ...summary, deletedTitles: [...summary.deletedTitles] });
          continue;
        }

        const verdict = String(validation?.verdict || "").toLowerCase();
        const cleanupSafe = Boolean(validation?.cleanup_safe);
        if (verdict === "fail" && cleanupSafe) {
          try {
            const deleteRes = await fetch(`/api/admin/movies/${encodeURIComponent(row.id)}`, {
              method: "DELETE",
            });
            const deletePayload = await deleteRes.json().catch(() => ({}));
            if (!deleteRes.ok) {
              throw new Error(deletePayload?.error || "Movie delete failed");
            }
            summary.deleted += 1;
            summary.deletedTitles.push(String(row?.title || `#${row?.id || "?"}`));
            setMovies((prev) => prev.filter((item) => String(item?.id || "") !== String(row?.id || "")));
            setMovieRowSelection((prev) => {
              if (!prev[String(row?.id || "")]) return prev;
              const next = { ...prev };
              delete next[String(row?.id || "")];
              return next;
            });
          } catch {
            summary.validationErrors += 1;
          }
          setBrokenMovieCleanupSummary({ ...summary, deletedTitles: [...summary.deletedTitles] });
          continue;
        }

        if (verdict === "warning" || (verdict === "fail" && !cleanupSafe)) {
          summary.warnings += 1;
        } else {
          summary.safe += 1;
        }
        setBrokenMovieCleanupSummary({ ...summary, deletedTitles: [...summary.deletedTitles] });
      }

      setBrokenMovieCleanupSummary(summary);
      setMessage(
        `Broken source check done. Checked ${summary.checked}, deleted ${summary.deleted}, safe ${summary.safe}, warnings ${summary.warnings}.`
      );
    } catch (err) {
      setError(err?.message || "Broken movie cleanup failed");
    } finally {
      setCheckingBrokenMovies(false);
      setBrokenMovieCleanupCurrentTitle("");
    }
  };

  const handleRefreshMissingMetadata = async () => {
    const selectedRows = movieTable.getSelectedRowModel().rows.map((row) => row.original);
    if (!selectedRows.length) {
      setError("Metadata fetch করার জন্য আগে movie select করুন।");
      return;
    }
    const targetIds = selectedRows
      .filter((row) => {
        const state = movieDataState(row);
        return state === "metadata_missing" || state === "metadata_partial" || state === "missing_both";
      })
      .map((row) => Number(row.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!targetIds.length) {
      setError("Selected movie-গুলোর মধ্যে metadata missing পাওয়া যায়নি।");
      return;
    }
    if (
      !window.confirm(
        `Selected ${selectedRows.length}টির মধ্যে ${targetIds.length}টি movie-তে metadata re-fetch/update করবেন?`
      )
    )
      return;

    setRefreshingMovieMetadata(true);
    setError("");
    setMessage("");
    setMetadataRefreshSummary(null);
    setMetadataRefreshCurrentTitle("");
    try {
      const providers = String(importForm.providers || "imdb,omdb,tmdb")
        .split(",")
        .map((v) => String(v || "").trim().toLowerCase())
        .filter(Boolean);
      const rowsById = new Map(selectedRows.map((row) => [Number(row?.id), row]));
      const summary = {
        total: targetIds.length,
        processed: 0,
        remaining: targetIds.length,
        succeeded: 0,
        failed: 0,
      };
      const failedItems = [];

      for (const movieId of targetIds) {
        const row = rowsById.get(Number(movieId));
        setMetadataRefreshCurrentTitle(String(row?.title || `#${movieId}`));
        setMetadataRefreshSummary({ ...summary });

        const res = await fetch("/api/admin/movies/metadata-refresh", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            movie_ids: [movieId],
            providers,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Metadata refresh failed");

        summary.processed += 1;
        summary.remaining = Math.max(0, summary.total - summary.processed);
        summary.succeeded += Number(payload?.succeeded || 0);
        summary.failed += Number(payload?.failed || 0);
        setMetadataRefreshSummary({ ...summary });

        const currentFailedItems = Array.isArray(payload?.results)
          ? payload.results.filter((item) => !item?.ok)
          : [];
        if (currentFailedItems.length) {
          failedItems.push(...currentFailedItems);
        }
        if (payload?.omdb_usage) setOmdbUsageInfo(payload.omdb_usage);
      }

      await refreshMovies();
      setMessage(`Metadata refresh done. Success: ${summary.succeeded || 0}, Failed: ${summary.failed || 0}`);
      if (failedItems.length) {
        const reasonText = failedItems
          .map((row) => `${row?.movie_id || "?"}: ${String(row?.error || "failed")}`)
          .join(" | ");
        setError(`Metadata refresh failed details -> ${reasonText}`);
      }
    } catch (err) {
      setError(err?.message || "Metadata refresh failed");
    } finally {
      setRefreshingMovieMetadata(false);
      setMetadataRefreshCurrentTitle("");
    }
  };

  const movieColumns = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <IndeterminateCheckbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            aria-label="Select all movies"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Select ${row.original?.title || "movie"}`}
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <button type="button" className={styles.tableHeadBtn} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Title
          </button>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => (row?.is_published ? "Published" : "Hidden"),
        header: ({ column }) => (
          <button type="button" className={styles.tableHeadBtn} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Status
          </button>
        ),
      },
      {
        id: "metadata_state",
        accessorFn: (row) => movieDataState(row),
        header: ({ column }) => (
          <button type="button" className={styles.tableHeadBtn} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Metadata
          </button>
        ),
        filterFn: (row, columnId, filterValue) => {
          const current = String(row.getValue(columnId) || "");
          const wanted = String(filterValue || "").trim().toLowerCase();
          if (!wanted || wanted === "all") return true;
          if (wanted === "metadata_missing")
            return current === "metadata_missing" || current === "metadata_partial" || current === "missing_both";
          if (wanted === "metadata_partial") return current === "metadata_partial";
          if (wanted === "source_missing") return current === "source_missing" || current === "missing_both";
          if (wanted === "missing_both") return current === "missing_both";
          if (wanted === "complete") return current === "complete";
          return current === wanted;
        },
        cell: ({ row }) => {
          const state = movieDataState(row.original);
          const badgeClass =
            state === "complete"
              ? styles.importStatusSaved
              : state === "metadata_partial"
                ? styles.importStatusDuplicate
              : state === "metadata_missing"
                ? styles.importStatusFailed
                : state === "source_missing"
                  ? styles.importStatusDuplicate
                  : styles.importStatusSkipped;
          return <span className={badgeClass}>{movieDataStateLabel(state)}</span>;
        },
      },
      {
        id: "updated_at",
        accessorFn: (row) => new Date(row?.updated_at || 0).getTime(),
        cell: ({ row }) => (row.original?.updated_at ? new Date(row.original.updated_at).toLocaleString() : "-"),
        header: ({ column }) => (
          <button type="button" className={styles.tableHeadBtn} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Updated
          </button>
        ),
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <div className={styles.rowActions}>
            <button type="button" className={styles.ghostBtn} onClick={() => openMovieEditor(row.original)}>
              <Pencil size={14} aria-hidden="true" />
              Edit
            </button>
            <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteMovie(row.original.id)}>
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </button>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        id: "preview",
        header: "Preview",
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <button
            type="button"
            className={styles.previewCellBtn}
            onClick={() => openMoviePreview(row.original)}
          >
            Preview
          </button>
        ),
      },
    ],
    [handleDeleteMovie, openMovieEditor, openMoviePreview]
  );

  const movieTable = useReactTable({
    data: moviesInSelectedCategory,
    columns: movieColumns,
    getRowId: (row) => String(row.id),
    state: {
      sorting: movieSorting,
      columnFilters: movieColumnFilters,
      rowSelection: movieRowSelection,
      pagination: moviePagination,
    },
    onSortingChange: setMovieSorting,
    onColumnFiltersChange: setMovieColumnFilters,
    onRowSelectionChange: setMovieRowSelection,
    onPaginationChange: setMoviePagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const movieCurrentPage = movieTable.getState().pagination.pageIndex + 1;
  const movieTotalPages = movieTable.getPageCount() || 1;
  const moviePageItems = useMemo(
    () => buildPageItems(movieCurrentPage, movieTotalPages),
    [movieCurrentPage, movieTotalPages]
  );
  const renderMovieTableHeader = (suffix = "top", compact = false) => (
    <>
      {!compact ? <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Search Movie</span>
          <input
            value={movieSearch}
            onChange={(e) => {
              const value = e.target.value;
              setMovieSearch(value);
              setMovieColumnFilters((prev) => {
                const next = prev.filter((item) => item.id !== "title");
                if (String(value || "").trim()) next.push({ id: "title", value });
                return next;
              });
            }}
            placeholder="Search by movie title or slug"
          />
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select
            value={movieStatusFilter}
            onChange={(e) => {
              const value = e.target.value;
              setMovieStatusFilter(value);
              setMovieColumnFilters((prev) => {
                const next = prev.filter((item) => item.id !== "status");
                if (value === "published") next.push({ id: "status", value: "Published" });
                if (value === "hidden") next.push({ id: "status", value: "Hidden" });
                return next;
              });
            }}
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Data Filter</span>
          <select
            value={movieDataFilter}
            onChange={(e) => {
              const value = e.target.value;
              setMovieDataFilter(value);
              setMovieColumnFilters((prev) => {
                const next = prev.filter((item) => item.id !== "metadata_state");
                if (value !== "all") next.push({ id: "metadata_state", value });
                return next;
              });
            }}
          >
            <option value="all">All Data</option>
            <option value="complete">Complete (Source + Metadata)</option>
            <option value="metadata_missing">Metadata Missing</option>
            <option value="metadata_partial">Partial Metadata</option>
            <option value="source_missing">Source Missing</option>
            <option value="missing_both">Missing Both</option>
          </select>
        </label>
      </div> : null}
      {!compact ? <div className={styles.actions}>
        <button type="button" className={styles.ghostBtn} onClick={() => movieTable.toggleAllRowsSelected(true)}>
          Select All
        </button>
        <button type="button" className={styles.ghostBtn} onClick={() => movieTable.toggleAllRowsSelected(false)}>
          Deselect All
        </button>
        <button type="button" className={styles.deleteBtn} onClick={handleDeleteSelectedMovies} disabled={savingMovie}>
          <Trash2 size={14} aria-hidden="true" />
          Delete Selected ({movieTable.getSelectedRowModel().rows.length})
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={handleRefreshMissingMetadata}
          disabled={refreshingMovieMetadata || movieTable.getSelectedRowModel().rows.length === 0}
        >
          {refreshingMovieMetadata
            ? `Refreshing Metadata... ${metadataRefreshSummary?.processed || 0}/${metadataRefreshSummary?.total || 0}`
            : `Refetch Selected Metadata (${movieTable.getSelectedRowModel().rows.length})`}
        </button>
        {isCategoryDetailsPage ? (
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={handleCheckAndDeleteBrokenMovies}
            disabled={checkingBrokenMovies || !moviesInSelectedCategory.length}
          >
            {checkingBrokenMovies
              ? `Checking ${moviesInSelectedCategory.length}...`
              : "Check & Delete Broken"}
          </button>
        ) : null}
      </div> : null}
      {!compact && refreshingMovieMetadata && metadataRefreshSummary ? (
        <div className={styles.resultBox} style={{ marginBottom: 8 }}>
          <p className={styles.hint} style={{ margin: 0 }}>
            Metadata Refresh Live: Total {metadataRefreshSummary.total} | Processed {metadataRefreshSummary.processed} |
            {" "}Success {metadataRefreshSummary.succeeded} | Failed {metadataRefreshSummary.failed} | Remaining{" "}
            {metadataRefreshSummary.remaining}
          </p>
          {metadataRefreshCurrentTitle ? (
            <p className={styles.hint} style={{ margin: "6px 0 0" }}>
              Running now: {metadataRefreshCurrentTitle}
            </p>
          ) : null}
        </div>
      ) : null}
      {!compact && metadataRefreshSummary ? (
        <p className={styles.hint} style={{ marginBottom: 8 }}>
          Metadata Refresh: Total {metadataRefreshSummary.total} | Processed {metadataRefreshSummary.processed} | Success{" "}
          {metadataRefreshSummary.succeeded} | Failed {metadataRefreshSummary.failed} | Remaining{" "}
          {metadataRefreshSummary.remaining}
        </p>
      ) : null}
      {!compact && brokenMovieCleanupSummary ? (
        <div className={styles.resultBox} style={{ marginBottom: 8 }}>
          <p className={styles.hint} style={{ margin: 0 }}>
            Total: {brokenMovieCleanupSummary.total} | Checked: {brokenMovieCleanupSummary.checked} | Remaining:{" "}
            {brokenMovieCleanupSummary.remaining} | Deleted: {brokenMovieCleanupSummary.deleted} | Safe:{" "}
            {brokenMovieCleanupSummary.safe} | Warnings: {brokenMovieCleanupSummary.warnings} | Missing Source:{" "}
            {brokenMovieCleanupSummary.missingSource} | Validation Errors:{" "}
            {brokenMovieCleanupSummary.validationErrors}
          </p>
          {checkingBrokenMovies && brokenMovieCleanupCurrentTitle ? (
            <p className={styles.hint} style={{ margin: 0 }}>
              Checking now: {brokenMovieCleanupCurrentTitle}
            </p>
          ) : null}
          {brokenMovieCleanupSummary.deletedTitles?.length ? (
            <p className={styles.errorText}>
              Deleted: {brokenMovieCleanupSummary.deletedTitles.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className={styles.paginationBar} key={`movie-table-header-${suffix}`}>
        <div className={styles.paginationInfo}>
          <span>
            Showing {movieTable.getRowModel().rows.length} of {movieTable.getFilteredRowModel().rows.length} movies
          </span>
          <label className={styles.pageSizeControl}>
            <span>Rows per page</span>
            <select
              value={movieTable.getState().pagination.pageSize}
              onChange={(e) => movieTable.setPageSize(Number(e.target.value))}
            >
              {[10, 25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.paginationActions}>
          <Pagination className={styles.paginationNavInline}>
            <PaginationContent>
              <PaginationItem>
                <PaginationLink
                  size="default"
                  onClick={() => movieTable.setPageIndex(0)}
                  disabled={!movieTable.getCanPreviousPage()}
                >
                  First
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => movieTable.previousPage()}
                  disabled={!movieTable.getCanPreviousPage()}
                />
              </PaginationItem>
              {moviePageItems.map((item) => (
                <PaginationItem key={`${suffix}-${String(item)}`}>
                  {typeof item === "number" ? (
                    <PaginationLink
                      isActive={item === movieCurrentPage}
                      size="icon"
                      onClick={() => movieTable.setPageIndex(Math.max(item - 1, 0))}
                    >
                      {item}
                    </PaginationLink>
                  ) : (
                    <PaginationEllipsis />
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => movieTable.nextPage()}
                  disabled={!movieTable.getCanNextPage()}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink
                  size="default"
                  onClick={() => movieTable.setPageIndex(Math.max(movieTable.getPageCount() - 1, 0))}
                  disabled={!movieTable.getCanNextPage()}
                >
                  Last
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </>
  );

  useEffect(() => {
    setMovieRowSelection({});
  }, [activeCategorySlug, movies]);

  useEffect(() => {
    setMoviePagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [activeCategorySlug, movieSearch, movieStatusFilter, movieDataFilter]);

  useEffect(() => {
    refreshMovieMetadataSettings().catch(() => {});
  }, []);

  return (
    <div className={styles.form}>
      {message ? <p className={styles.success}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {!isCategoryDetailsPage ? (
      <section className={styles.card}>
        <div className={styles.controlRowEnd}>
          <h2 style={{ margin: 0 }}>Movie Categories</h2>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                setShowCategoryForm(true);
                setCategoryForm({ id: "", name: "", slug: "", position: "0" });
              }}
            >
              <FolderPlus size={16} aria-hidden="true" />
              New Category
            </button>
          </div>
        </div>
        <p className={styles.hint}>Click a category to open its movies on a separate page.</p>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Search Category</span>
            <input
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search by category name or slug"
            />
          </label>
          <label className={styles.field}>
            <span>Filter</span>
            <select value={categoryCountFilter} onChange={(e) => setCategoryCountFilter(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="with_movies">With Movies</option>
              <option value="without_movies">Without Movies</option>
            </select>
          </label>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Slug</th>
                <th>Position</th>
                <th>Movies</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length ? (
                filteredCategories.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className={styles.rowLinkBtn}
                        onClick={() => {
                          if (!confirmDiscardMovieForm()) return;
                          navigateMovieCategory(String(row.slug || ""));
                        }}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td>{row.slug}</td>
                    <td>{row.position}</td>
                    <td>{Number(categoryMovieCount.get(String(row.id)) || 0)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={() => {
                            setShowCategoryForm(true);
                            setCategoryForm({
                              id: String(row.id),
                              name: String(row.name || ""),
                              slug: String(row.slug || ""),
                              position: String(row.position || 0),
                            });
                          }}
                        >
                          <Pencil size={14} aria-hidden="true" />
                          Edit
                        </button>
                        <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteCategory(row.id)}>
                          <Trash2 size={14} aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No category found for current filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {isCategoryDetailsPage ? (
        <section className={styles.card}>
          <div className={styles.controlRowEnd}>
            <h2 style={{ margin: 0 }}>
              {selectedCategory ? `${selectedCategory.name} Movies` : "Category Not Found"}
            </h2>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => {
                if (!confirmDiscardMovieForm()) return;
                navigateMovieCategory("");
              }}
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to Categories
            </button>
            {selectedCategory ? (
              <button
                type="button"
                className={`${styles.primaryBtnCompact} ${styles.primaryBtnTight}`}
                onClick={openNewMovieForm}
              >
                <Clapperboard size={16} aria-hidden="true" />
                New Movie
              </button>
            ) : null}
          </div>
          {selectedCategory ? <p className={styles.hint}>Movies under this category.</p> : null}
          {selectedCategory ? (
            <>
          {renderMovieTableHeader("top")}
          <div className={styles.tableWrap}>
            <Table>
              <TableHeader>
                {movieTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {movieTable.getRowModel().rows.length ? (
                  movieTable.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={movieColumns.length}>No movies found for current filter.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {renderMovieTableHeader("bottom", true)}
            </>
          ) : (
            <p className={styles.hint}>This category does not exist. Go back to categories list.</p>
          )}
        </section>
      ) : null}

      <section className={styles.card}>
        <div className={styles.controlRowEnd}>
          <h2 style={{ margin: 0 }}>Movie Metadata API Keys</h2>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => refreshMovieMetadataSettings()}
              disabled={movieMetadataSettingsLoading}
            >
              {movieMetadataSettingsLoading ? "Loading..." : "Reload Usage"}
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleSaveOmdbKeys}
              disabled={movieMetadataSettingsSaving}
            >
              {movieMetadataSettingsSaving ? "Saving..." : "Save API Keys"}
            </button>
          </div>
        </div>
        <p className={styles.hint}>
          প্রতি লাইনে একটি OMDb API key দিন। Successful OMDb data response এ usage count হবে। কোনো key response না দিলে, invalid হলে, বা usable data না এলে next key try করবে।
        </p>
        <label className={styles.field}>
          <span>OMDb API Keys (one per line)</span>
          <textarea
            value={omdbKeysText}
            onChange={(e) => setOmdbKeysText(e.target.value)}
            placeholder={"key_1\nkey_2\nkey_3"}
            rows={4}
          />
        </label>
        {omdbUsageInfo ? (
          <>
            <p className={styles.hint} style={{ marginTop: 8 }}>
              Usage Date: {omdbUsageInfo.date || "-"} | Total Used: {omdbUsageInfo.total_used || 0}/
              {omdbUsageInfo.total_limit || 0}
            </p>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Key</th>
                    <th>Source</th>
                    <th>Used</th>
                    <th>Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(omdbUsageInfo.per_key || []).map((row, index) => (
                    <tr key={String(row?.key_hash || `idx-${index}`)}>
                      <td>{Number(row?.index || 0) + 1}</td>
                      <td>{row?.masked_key || "-"}</td>
                      <td>{row?.source || "-"}</td>
                      <td>{row?.used || 0}</td>
                      <td>{row?.remaining || 0}</td>
                      <td>
                        <span className={row?.exhausted ? styles.importStatusFailed : styles.importStatusSaved}>
                          {row?.exhausted ? "Limit Reached" : row?.active ? "Active" : "Ready"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!Array.isArray(omdbUsageInfo.per_key) || !omdbUsageInfo.per_key.length ? (
                    <tr>
                      <td colSpan={6}>No OMDb key configured yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.card}>
        <h2>FTP / Apache Movie Import</h2>
        <p className={styles.hint}>
          FTP/Apache directory URL দিন। Script title detect করে IMDb primary + OMDb/TMDb fallback দিয়ে movie metadata update করবে।
        </p>
        <form className={styles.form} onSubmit={handleImportMovies}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Base URL</span>
              <input
                value={importForm.base_url}
                onChange={(e) => setImportForm((prev) => ({ ...prev, base_url: e.target.value }))}
                placeholder="http://10.1.1.1/data/"
                required
              />
              {importResumeInfo?.processed_count ? (
                <p className={styles.fieldHint}>
                  Last remembered import for this link: {Number(importResumeInfo.processed_count)} items
                  {importResumeInfo?.updated_at
                    ? ` | ${new Date(importResumeInfo.updated_at).toLocaleString()}`
                    : ""}
                </p>
              ) : null}
            </label>
            <label className={styles.field}>
              <span>Metadata Providers</span>
              <input
                value={importForm.providers}
                onChange={(e) => setImportForm((prev) => ({ ...prev, providers: e.target.value }))}
                placeholder="imdb,omdb,tmdb"
              />
            </label>
          </div>

          {importResumeInfo?.processed_count ? (
            <div className={styles.actions}>
              <button type="button" className={styles.ghostBtn} onClick={handleApplyResumeRange}>
                Resume From #{Number(importResumeInfo.processed_count) + 1}
              </button>
              <p className={styles.fieldHint} style={{ margin: 0 }}>
                Example: last imported {Number(importResumeInfo.processed_count)} থাকলে current batch size অনুযায়ী next range auto-fill হবে.
              </p>
            </div>
          ) : null}

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Include Keywords (comma separated)</span>
              <input
                value={importForm.include}
                onChange={(e) => setImportForm((prev) => ({ ...prev, include: e.target.value }))}
                placeholder="movies,animation,hindi,english,bangla"
              />
            </label>
            <label className={styles.field}>
              <span>Exclude Keywords (comma separated)</span>
              <input
                value={importForm.exclude}
                onChange={(e) => setImportForm((prev) => ({ ...prev, exclude: e.target.value }))}
                placeholder="android games,software,tv shows,series"
              />
            </label>
          </div>

          <div className={styles.formGrid}>
            <CategoryCombobox
              categories={categories}
              value={importForm.category_ids}
              onChange={(nextIds) => setImportForm((prev) => ({ ...prev, category_ids: nextIds }))}
            />
            <label className={styles.field}>
              <span>Import Range</span>
              <div className={styles.sourcePreviewRow}>
                <input
                  type="number"
                  min="1"
                  value={importForm.range_start}
                  onChange={(e) => setImportForm((prev) => ({ ...prev, range_start: e.target.value }))}
                  placeholder="1"
                />
                <input
                  type="number"
                  min="0"
                  value={importForm.range_end}
                  onChange={(e) => setImportForm((prev) => ({ ...prev, range_end: e.target.value }))}
                  placeholder="0 = last"
                />
              </div>
              <p className={styles.fieldHint}>
                প্রথম item থেকে শুরু করতে `1` দিন। End `0` হলে selected list-এর শেষ item পর্যন্ত যাবে।
              </p>
              {rangePreviewSummary.totalInRange ? (
                <p className={styles.fieldHint}>
                  Current range: #{rangePreviewSummary.start}-#{rangePreviewSummary.end} | Rows: {rangePreviewSummary.totalInRange} | Importable: {rangePreviewSummary.importable}
                </p>
              ) : null}
            </label>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Limit (0 = all)</span>
              <input
                type="number"
                min="0"
                value={importForm.limit}
                onChange={(e) => setImportForm((prev) => ({ ...prev, limit: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Batch Size (0 = all selected range)</span>
              <input
                type="number"
                min="0"
                value={importForm.batch_size}
                onChange={(e) => setImportForm((prev) => ({ ...prev, batch_size: e.target.value }))}
              />
            </label>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Max Depth</span>
              <input
                type="number"
                min="1"
                value={importForm.max_depth}
                onChange={(e) => setImportForm((prev) => ({ ...prev, max_depth: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Selected Import Category</span>
              <input
                value={selectedImportCategoryLabel || "Auto-detect from metadata/folder"}
                readOnly
              />
            </label>
          </div>

          <div className={styles.actions}>
            <label className={styles.ghostBtn} style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={Boolean(importForm.publish)}
                onChange={(e) => setImportForm((prev) => ({ ...prev, publish: e.target.checked }))}
              />
              Publish Imported
            </label>
            <button type="submit" className={styles.primaryBtn} disabled={importingMovies}>
              {importingMovies ? "Scanning..." : "Start Scan"}
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={importingPrepared || !preparedItems.length}
              onClick={handleImportPreparedMovies}
            >
              {importingPrepared
                ? "Importing..."
                : `Import Selected${importSelectionStats.selected ? ` (${importSelectionStats.selected})` : ""}`}
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              disabled={importingMovies || !continueBatchSummary.canContinue}
              onClick={handleContinueImportBatch}
            >
              {importingMovies
                ? "Scanning Next..."
                : `Continue Next Batch (#${continueBatchSummary.nextStart}-#${continueBatchSummary.nextEnd})`}
            </button>
          </div>
        </form>

        {importSummary || preparedItems.length ? (
          <>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Scanned</span>
                <input value={String(importSummary?.scanned_count || scanRawCount || 0)} readOnly />
              </label>
              <label className={styles.field}>
                <span>Candidates</span>
                <input value={String(importSummary?.candidate_count || scanPreparedCount || 0)} readOnly />
              </label>
              <label className={styles.field}>
                <span>Saved</span>
                <input value={String(importSummary?.import_result?.saved_count || 0)} readOnly />
              </label>
              <label className={styles.field}>
                <span>Duplicates</span>
                <input value={String(importSummary?.duplicates_count || 0)} readOnly />
              </label>
              <label className={styles.field}>
                <span>Failed</span>
                <input value={String(importSummary?.import_result?.failed_count || 0)} readOnly />
              </label>
            </div>

            <h3 style={{ margin: "8px 0 0" }}>Scan Results (select multiple তারপর Import Selected)</h3>
            <p className={styles.hint} style={{ marginBottom: 8 }}>
              Selected: {importSelectionStats.selected} / {importSelectionStats.total} | Ready:{" "}
              {importSelectionStats.ready} | Duplicate: {importSelectionStats.duplicate} | Saved:{" "}
              {importSelectionStats.saved} | Failed: {importSelectionStats.failed}
            </p>
            <p className={styles.hint} style={{ marginBottom: 8 }}>
              Import Target: {selectedImportCategoryLabel || "Auto category"} | Range: {importForm.range_start || "1"} to{" "}
              {importForm.range_end || "0"} | Batch Size: {importForm.batch_size || "0"}
            </p>
            {importBatchState.queue_total > 0 ? (
              <p className={styles.hint} style={{ marginBottom: 8 }}>
                Batch Queue: {importBatchState.processed}/{importBatchState.queue_total} processed | Remaining:{" "}
                {importBatchState.remaining} | Saved: {importBatchState.saved} | Skipped: {importBatchState.skipped} | Failed:{" "}
                {importBatchState.failed}
                {importBatchState.paused && importBatchState.remaining > 0
                  ? ` | Paused before batch ${importBatchState.next_batch_number}`
                  : ""}
              </p>
            ) : null}
            <div className={styles.actions} style={{ marginBottom: 8 }}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() =>
                  setSelectionMap((prev) => {
                    const next = { ...(prev || {}) };
                    for (const id of selectableIds) next[id] = true;
                    return next;
                  })
                }
              >
                Select All
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() =>
                  setSelectionMap((prev) => {
                    const next = { ...(prev || {}) };
                    for (const id of selectableIds) next[id] = false;
                    return next;
                  })
                }
              >
                Deselect All
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() =>
                  setSelectionMap((prev) => {
                    const next = { ...(prev || {}) };
                    for (const row of preparedItems) {
                      const id = String(row?.item_id || "");
                      if (!id) continue;
                      const status = String(
                        importStatusMap[id] || (row?.duplicate?.is_duplicate ? "duplicate" : "ready")
                      );
                      if (status === "ready" || status === "failed") next[id] = true;
                    }
                    return next;
                  })
                }
              >
                Select Ready + Failed
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() =>
                  setSelectionMap((prev) => {
                    const next = { ...(prev || {}) };
                    for (const row of preparedItems) {
                      const id = String(row?.item_id || "");
                      if (!id) continue;
                      const status = String(
                        importStatusMap[id] || (row?.duplicate?.is_duplicate ? "duplicate" : "ready")
                      );
                      next[id] = status === "failed";
                    }
                    return next;
                  })
                }
              >
                Select Failed Only
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => {
                  const next = {};
                  for (const row of preparedItems) {
                    const id = String(row?.item_id || "");
                    if (!id) continue;
                    next[id] = false;
                  }
                  setSelectionMap(next);
                }}
              >
                Clear Selection
              </button>
            </div>
            {importProgress.total > 0 ? (
              <p className={styles.hint} style={{ marginBottom: 8 }}>
                Import Progress: {importProgress.processed}/{importProgress.total} | Remaining:{" "}
                {importProgress.remaining} | Saved: {importProgress.saved} | Failed: {importProgress.failed} | Skipped:{" "}
                {importProgress.skipped}
                {importProgress.current_title ? ` | Current: ${importProgress.current_title}` : ""}
              </p>
            ) : null}
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        checked={allSelectableSelected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectionMap((prev) => {
                            const next = { ...(prev || {}) };
                            for (const id of selectableIds) next[id] = checked;
                            return next;
                          });
                        }}
                      />
                    </th>
                    <th>Title</th>
                    <th>Duplicate Reason</th>
                    <th>Matched Existing</th>
                    <th>Auto Category</th>
                    <th>Metadata</th>
                    <th>Status</th>
                    <th>Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {effectivePreparedItems.map((row, idx) => {
                    const id = String(row?.item_id || "");
                    const status = String(importStatusMap[id] || (row?.duplicate?.is_duplicate ? "duplicate" : "ready"));
                    const locked = status === "saved" || status === "skipped";
                    const statusClass =
                      status === "saved"
                        ? styles.importStatusSaved
                        : status === "failed"
                          ? styles.importStatusFailed
                          : status === "duplicate"
                            ? styles.importStatusDuplicate
                            : status === "skipped"
                              ? styles.importStatusSkipped
                              : styles.importStatusReady;
                    const rowClass =
                      status === "saved"
                        ? styles.importRowSaved
                        : status === "failed"
                          ? styles.importRowFailed
                          : status === "duplicate"
                            ? styles.importRowDuplicate
                            : "";
                    const isQueued = queuedImportIds.has(id);
                    return (
                    <tr key={`${row.item_id || row.title || "dup"}-${idx}`} className={rowClass}>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(selectionMap[id])}
                          disabled={locked}
                          onChange={(e) =>
                            setSelectionMap((prev) => ({ ...prev, [id]: e.target.checked }))
                          }
                        />
                      </td>
                      <td>{row.title || "-"}</td>
                      <td>{Array.isArray(row?.duplicate?.reasons) ? row.duplicate.reasons.join(", ") : "-"}</td>
                      <td>
                        {Array.isArray(row?.duplicate?.matches) && row.duplicate.matches.length
                          ? row.duplicate.matches
                              .slice(0, 2)
                              .map((m) => `${m.title || "Untitled"}${m.release_year ? ` (${m.release_year})` : ""}`)
                              .join(" | ")
                          : "-"}
                      </td>
                      <td>{row?.category_name || "-"}</td>
                      <td>
                        {[
                          row?.release_year ? `Year: ${row.release_year}` : "",
                          Number.isFinite(Number(row?.imdb_rating)) ? `IMDb: ${row.imdb_rating}` : "",
                          row?.imdb_release_date ? `Date: ${row.imdb_release_date}` : "",
                          Array.isArray(row?.imdb_languages) && row.imdb_languages.length
                            ? `Lang: ${row.imdb_languages.slice(0, 2).join(", ")}`
                            : "",
                          Array.isArray(row?.imdb_countries) && row.imdb_countries.length
                            ? `Country: ${row.imdb_countries.slice(0, 2).join(", ")}`
                            : "",
                          Array.isArray(row?.imdb_genres) && row.imdb_genres.length
                            ? `Genres: ${row.imdb_genres.slice(0, 2).join(", ")}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" | ") || "-"}
                      </td>
                      <td>
                        <span className={statusClass}>
                          {status}
                          {isQueued && status !== "saved" && status !== "skipped" ? " queued" : ""}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={() => openPreviewForSource(row.title || "Movie Preview", row?.source_url || row?.url || "")}
                          disabled={!String(row?.source_url || row?.url || "").trim()}
                        >
                          Preview
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                  {!effectivePreparedItems.length ? (
                    <tr>
                      <td colSpan={8}>No scan result yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {importingMovies ? (
          <>
            <h3 style={{ margin: "8px 0 0" }}>Live Scan Feed</h3>
            <p className={styles.hint}>
              Found: {scanRawCount} | Prepared: {scanPreparedCount}
            </p>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Source URL</th>
                    <th>Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {scanRawItems.slice(-40).map((row, idx) => (
                    <tr key={`${row.title}-${idx}`}>
                      <td>{row.title}</td>
                      <td>{row.category_name || "-"}</td>
                      <td style={{ maxWidth: 460, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {row.source_url || "-"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={() => openPreviewForSource(row.title || "Movie Preview", row?.source_url || row?.url || "")}
                          disabled={!String(row?.source_url || row?.url || "").trim()}
                        >
                          Preview
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!scanRawItems.length ? (
                    <tr>
                      <td colSpan={4}>Scanning চলছে... প্রথম মুভি পেলে এখানে সাথে সাথে দেখাবে।</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      {showCategoryForm ? (
        <section className={styles.card}>
          <h2>{categoryForm.id ? "Edit Category" : "Add Category"}</h2>
          <form className={styles.form} onSubmit={handleCategorySubmit}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Name</span>
                <input
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, name: e.target.value, slug: prev.slug || toSlug(e.target.value) }))
                  }
                  placeholder="Category name"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Slug</span>
                <input
                  value={categoryForm.slug}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, slug: toSlug(e.target.value) }))}
                  placeholder="category-slug"
                />
              </label>
              <label className={styles.field}>
                <span>Position</span>
                <input
                  type="number"
                  value={categoryForm.position}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, position: e.target.value }))}
                />
              </label>
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.primaryBtn} disabled={savingCategory}>
                {savingCategory ? "Saving..." : categoryForm.id ? "Update Category" : "Add Category"}
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => {
                  setShowCategoryForm(false);
                  setCategoryForm({ id: "", name: "", slug: "", position: "0" });
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {showMovieForm ? (
        <div className={styles.modalWrap} onClick={closeMovieForm}>
          <div className={`${styles.modalCard} ${styles.movieFormModalCard}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>{movieForm.id ? "Edit Movie" : "Add Movie"}</h4>
              <button type="button" className={styles.closeBtn} onClick={closeMovieForm}>
                Close
              </button>
            </div>
            <p className={styles.hint}>Add movie and one primary source URL.</p>

            <form className={styles.form} onSubmit={handleMovieSubmit}>
          <CategoryCombobox
            categories={categories}
            value={movieForm.category_ids}
            onChange={(next) => setMovieForm((prev) => ({ ...prev, category_ids: normalizeIds(next) }))}
          />

          <div className={styles.searchActionRow}>
            <label className={styles.field}>
              <span>IMDb ID / URL / Search Title</span>
              <input
                value={imdbQuery}
                onChange={(e) => setImdbQuery(e.target.value)}
                placeholder="tt39961926, https://m.imdb.com/title/tt39961926/ বা movie title"
              />
            </label>
            <div className={styles.searchActionButtons}>
              <button type="button" className={styles.primaryBtnCompact} disabled={fetchingImdb} onClick={handleFetchImdb}>
                {fetchingImdb ? "Fetching IMDb..." : "Fetch IMDb Data"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtnCompact}
                disabled={searchingMetadataByTitle}
                onClick={handleSearchMetadataByTitle}
              >
                {searchingMetadataByTitle ? "Searching..." : "Search by Title"}
              </button>
            </div>
          </div>
          <p className={styles.fieldHint} style={{ marginTop: -4 }}>
            IMDb ID দিয়ে direct fetch করুন, আর title দিয়ে multiple result খুঁজে poster preview দেখে select করুন।
          </p>

          {metadataSearchCandidates.length ? (
            <div className={styles.resultBox}>
              <div className={styles.controlRowEnd} style={{ marginBottom: 10 }}>
                <div>
                  <strong>Metadata Candidates</strong>
                  <p className={styles.fieldHint} style={{ margin: "4px 0 0" }}>
                    {metadataSearchCandidates.length}টি result এসেছে। poster দেখে সঠিক movie select করে তারপর apply করুন।
                  </p>
                </div>
                <div className={styles.actions}>
                  <button type="button" className={styles.primaryBtn} onClick={handleApplyMetadataCandidate}>
                    Apply Selected Metadata
                  </button>
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={() => {
                      setMetadataSearchCandidates([]);
                      setSelectedMetadataCandidateId("");
                    }}
                  >
                    Clear Results
                  </button>
                </div>
              </div>
              <div className={styles.metadataCandidateGrid}>
                {metadataSearchCandidates.map((candidate, idx) => {
                  const item = candidate?.item || {};
                  const candidateId = String(candidate?.imdb_id || `candidate-${idx}`);
                  const previewUrl = String(item?.poster_url || item?.backdrop_url || "").trim();
                  const isSelected = candidateId === String(selectedMetadataCandidateId || "");
                  return (
                    <button
                      key={candidateId}
                      type="button"
                      className={`${styles.metadataCandidateCard} ${isSelected ? styles.metadataCandidateCardActive : ""}`}
                      onClick={() => setSelectedMetadataCandidateId(candidateId)}
                    >
                      <div className={styles.metadataCandidatePosterWrap}>
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={`${item?.title || candidate?.title || "Movie"} poster`}
                            className={styles.metadataCandidatePoster}
                            loading="lazy"
                          />
                        ) : (
                          <div className={styles.metadataCandidatePosterFallback}>No Poster</div>
                        )}
                      </div>
                      <div className={styles.metadataCandidateBody}>
                        <strong>{item?.title || candidate?.title || "Untitled"}</strong>
                        <p className={styles.fieldHint} style={{ margin: "4px 0 0" }}>
                          Year: {item?.release_year || candidate?.year || "-"} | IMDb: {candidate?.imdb_id || "-"}
                        </p>
                        <p className={styles.fieldHint} style={{ margin: "4px 0 0" }}>
                          Source: {candidate?.source || item?.provider || "imdb"} | Confidence:{" "}
                          {Number(candidate?.score || item?.confidence || 0).toFixed(2)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Title</span>
              <input
                value={movieForm.title}
                onChange={(e) => setMovieForm((prev) => ({ ...prev, title: e.target.value, slug: prev.slug || toSlug(e.target.value) }))}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Slug</span>
              <input value={movieForm.slug} onChange={(e) => setMovieForm((prev) => ({ ...prev, slug: toSlug(e.target.value) }))} />
            </label>
            <label className={styles.field}>
              <span>Release Year</span>
              <input type="number" value={movieForm.release_year} onChange={(e) => setMovieForm((prev) => ({ ...prev, release_year: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>Runtime Seconds</span>
              <input type="number" value={movieForm.runtime_seconds} onChange={(e) => setMovieForm((prev) => ({ ...prev, runtime_seconds: e.target.value }))} />
            </label>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Poster URL</span>
              <input value={movieForm.poster_url} onChange={(e) => setMovieForm((prev) => ({ ...prev, poster_url: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>Backdrop URL</span>
              <input value={movieForm.backdrop_url} onChange={(e) => setMovieForm((prev) => ({ ...prev, backdrop_url: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>Source URL</span>
              <div className={styles.sourcePreviewRow}>
                <input
                  value={movieForm.source_url}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setMovieForm((prev) => ({ ...prev, source_url: nextValue }));
                    if (String(sourceCheckUrl || "").trim() !== String(nextValue || "").trim()) {
                      setSourceCheckResult(null);
                    }
                  }}
                  placeholder="https://.../movie.m3u8"
                />
                <button type="button" className={styles.ghostBtn} onClick={openSourcePreview}>
                  Test Link
                </button>
                <button type="button" className={styles.ghostBtn} onClick={handleValidateSource} disabled={sourceCheckLoading}>
                  {sourceCheckLoading ? "Checking..." : "Validate Live"}
                </button>
              </div>
              {sourceCheckResult ? (
                <div className={styles.resultBox}>
                  <p
                    className={
                      sourceCheckResult?.verdict === "ok"
                        ? styles.success
                        : sourceCheckResult?.verdict === "warning"
                          ? styles.hint
                          : styles.error
                    }
                    style={{ margin: 0 }}
                  >
                    {sourceCheckResult?.verdict === "ok"
                      ? "Live Ready"
                      : sourceCheckResult?.verdict === "warning"
                        ? "Live Risk"
                        : "Live Unsafe"}
                    : {String(sourceCheckResult?.summary || "")}
                  </p>
                  {sourceCheckResult?.checks ? (
                    <p className={styles.fieldHint}>
                      HTTP {sourceCheckResult.checks.status_code || 0} | Type:{" "}
                      {sourceCheckResult.checks.content_type || "unknown"} | Range:{" "}
                      {sourceCheckResult.checks.supports_ranges ? "yes" : "no"} | Final protocol:{" "}
                      {sourceCheckResult.checks.final_protocol || "unknown"}
                    </p>
                  ) : null}
                  {Array.isArray(sourceCheckResult?.reasons) && sourceCheckResult.reasons.length ? (
                    <div className={styles.fieldHint}>
                      {sourceCheckResult.reasons.map((reason, idx) => (
                        <p key={`${reason}-${idx}`} style={{ margin: 0 }}>
                          - {reason}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className={styles.fieldHint}>
                  Save করার আগে live fetch check করুন। HTTPS, server fetch, আর range support দেখা হবে।
                </p>
              )}
            </label>
            <label className={styles.field}>
              <span>Visibility</span>
              <select
                value={movieForm.is_published ? "published" : "hidden"}
                onChange={(e) => setMovieForm((prev) => ({ ...prev, is_published: e.target.value === "published" }))}
              >
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>IMDb ID</span>
              <input value={movieForm.imdb_id} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_id: e.target.value }))} placeholder="tt1234567" />
            </label>
            <label className={styles.field}>
              <span>IMDb URL</span>
              <input value={movieForm.imdb_url} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_url: e.target.value }))} placeholder="https://www.imdb.com/title/tt..." />
            </label>
            <label className={styles.field}>
              <span>IMDb Rating</span>
              <input type="number" step="0.1" min="0" max="10" value={movieForm.imdb_rating} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_rating: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>IMDb Votes</span>
              <input type="number" value={movieForm.imdb_votes} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_votes: e.target.value }))} />
            </label>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Content Rating</span>
              <input value={movieForm.content_rating} onChange={(e) => setMovieForm((prev) => ({ ...prev, content_rating: e.target.value }))} placeholder="TV-MA / PG-13" />
            </label>
            <label className={styles.field}>
              <span>IMDb Release Date</span>
              <input value={movieForm.imdb_release_date} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_release_date: e.target.value }))} placeholder="2026-02-14" />
            </label>
            <label className={styles.field}>
              <span>Genres (comma separated)</span>
              <input value={movieForm.imdb_genres} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_genres: e.target.value }))} placeholder="Drama, Horror" />
            </label>
            <label className={styles.field}>
              <span>Countries (comma separated)</span>
              <input value={movieForm.imdb_countries} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_countries: e.target.value }))} placeholder="Bangladesh, India" />
            </label>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Directors (comma separated)</span>
              <input value={movieForm.imdb_directors} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_directors: e.target.value }))} placeholder="Director A, Director B" />
            </label>
            <label className={styles.field}>
              <span>Writers (comma separated)</span>
              <input value={movieForm.imdb_writers} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_writers: e.target.value }))} placeholder="Writer A, Writer B" />
            </label>
            <label className={styles.field}>
              <span>Stars (comma separated)</span>
              <input value={movieForm.imdb_stars} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_stars: e.target.value }))} placeholder="Actor A, Actor B" />
            </label>
            <label className={styles.field}>
              <span>Languages (comma separated)</span>
              <input value={movieForm.imdb_languages} onChange={(e) => setMovieForm((prev) => ({ ...prev, imdb_languages: e.target.value }))} placeholder="Bangla, Hindi, English" />
            </label>
          </div>

          {imdbImagePreviewUrls.length ? (
            <label className={styles.field}>
              <span>IMDb Image Preview ({imdbImagePreviewUrls.length})</span>
              <div className={styles.imdbPreviewGrid}>
                {imdbImagePreviewUrls.map((url, idx) => (
                  <a
                    key={`${url}-${idx}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.imdbPreviewCard}
                    title={url}
                  >
                    <img
                      src={url}
                      alt={`IMDb preview ${idx + 1}`}
                      className={styles.imdbPreviewImage}
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </label>
          ) : null}

          <label className={styles.field}>
            <span>Synopsis</span>
            <textarea value={movieForm.synopsis} onChange={(e) => setMovieForm((prev) => ({ ...prev, synopsis: e.target.value }))} />
          </label>

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryBtn} disabled={savingMovie}>
                {savingMovie ? "Saving..." : movieForm.id ? "Update Movie" : "Add Movie"}
              </button>
              {movieForm.id ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={savingMovie}
                  onClick={() => saveMovieForm({ closeAfterSave: true })}
                >
                  {savingMovie ? "Saving..." : "Update & Close"}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={closeMovieForm}
              >
                Cancel
              </button>
              {movieForm.id ? (
                <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteMovie(movieForm.id)}>
                  <Trash2 size={14} aria-hidden="true" />
                  Delete Movie
                </button>
              ) : null}
            </div>
            </form>
          </div>
        </div>
      ) : null}

      {previewSourceUrl ? (
        <div className={styles.modalWrap} onClick={closeSourcePreview}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>{previewTitle || "Link Test Preview"}</h4>
              <button type="button" className={styles.closeBtn} onClick={closeSourcePreview}>
                Close
              </button>
            </div>
            <p className={styles.hint}>Test the current movie source link before saving.</p>
            {previewLoading ? <p className={styles.pending}>Loading link preview...</p> : null}
            {previewError ? <p className={styles.errorText}>{previewError}</p> : null}
            <video
              ref={setPreviewVideoEl}
              key={previewSourceUrl}
              className={styles.video}
              controls
              autoPlay
              playsInline
              preload="metadata"
            >
              Your browser does not support video playback.
            </video>
            <p className={styles.pending}>
              Open direct link:{" "}
              <a href={previewSourceUrl} target="_blank" rel="noreferrer" className={styles.url}>
                {previewSourceUrl}
              </a>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
