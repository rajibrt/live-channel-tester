"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clapperboard, FolderPlus, Pencil, Trash2 } from "lucide-react";
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
  const router = useRouter();
  const currentCategorySlug = String(categorySlug || "").trim().toLowerCase();
  const isCategoryDetailsPage = Boolean(currentCategorySlug);
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
  const [movieMetadataSettingsLoading, setMovieMetadataSettingsLoading] = useState(false);
  const [movieMetadataSettingsSaving, setMovieMetadataSettingsSaving] = useState(false);
  const [omdbKeysText, setOmdbKeysText] = useState("");
  const [omdbUsageInfo, setOmdbUsageInfo] = useState(null);
  const [previewSourceUrl, setPreviewSourceUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [imdbImagePreviewUrls, setImdbImagePreviewUrls] = useState([]);
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
  const selectAllCheckboxRef = useRef(null);
  const [importForm, setImportForm] = useState({
    base_url: "",
    include: "movies,animation,hindi,english,bangla",
    exclude: "android games,software,tv shows,series",
    providers: "imdb,omdb,tmdb",
    publish: true,
    limit: "0",
    max_depth: "6",
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

  useEffect(() => {
    if (!selectAllCheckboxRef.current) return;
    selectAllCheckboxRef.current.indeterminate = someSelectableSelected;
  }, [someSelectableSelected]);

  const selectedCategory = useMemo(
    () => categories.find((row) => String(row?.slug || "").trim().toLowerCase() === currentCategorySlug) || null,
    [categories, currentCategorySlug]
  );

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
    setShowMovieForm(true);
    setImdbQuery("");
    setImdbImagePreviewUrls([]);
    setMovieForm(next);
    setMovieFormInitialSnapshot(serializeMovieForm(next));
  };

  const closeSourcePreview = () => {
    setPreviewSourceUrl("");
    setPreviewTitle("");
  };

  const openSourcePreview = () => {
    const source = String(movieForm.source_url || "").trim();
    if (!source) {
      setError("Source URL দিন, তারপর Preview চাপুন।");
      return;
    }
    setError("");
    setPreviewSourceUrl(source);
    setPreviewTitle(String(movieForm.title || "Source Preview"));
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

  const handleImportMovies = async (event) => {
    event.preventDefault();
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
    setImportingMovies(true);
    try {
      const payload = {
        base_url: String(importForm.base_url || "").trim(),
        include: String(importForm.include || ""),
        exclude: String(importForm.exclude || ""),
        providers: String(importForm.providers || ""),
        publish: Boolean(importForm.publish),
        limit: Number(importForm.limit || 0),
        max_depth: Number(importForm.max_depth || 6),
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
      setMessage("Scan complete. Duplicate list review করে Import দিন।");
    } catch (err) {
      setError(err?.message || "Movie import failed");
    } finally {
      setImportingMovies(false);
    }
  };

  const handleImportPreparedMovies = async () => {
    if (!preparedItems.length) {
      setError("আগে scan চালান, তারপর import দিন।");
      return;
    }
    setError("");
    setMessage("");
    setImportingPrepared(true);
    try {
      const selectedItems = preparedItems.filter((item) => {
        const id = String(item?.item_id || "");
        if (!id) return false;
        if (!selectionMap[id]) return false;
        return importStatusMap[id] !== "saved";
      });
      if (!selectedItems.length) {
        throw new Error("Import করার জন্য অন্তত ১টা item select করুন।");
      }
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

      setImportSummary((prev) => ({
        ...(prev || {}),
        import_result: finalSummary,
      }));
      await Promise.all([refreshMovies(), refreshCategories()]);
      setMessage(
        `Import done. Saved ${Number(finalSummary?.saved_count || 0)}, skipped ${Number(finalSummary?.skipped_count || 0)}, failed ${Number(finalSummary?.failed_count || 0)}. Failed rows are marked as "failed".`
      );
    } catch (err) {
      setError(err?.message || "Import failed");
    } finally {
      setImportingPrepared(false);
    }
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

  const handleMovieSubmit = async (event) => {
    event.preventDefault();
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
      resetMovieForm();
      setShowMovieForm(false);
      setMessage("Movie saved.");
    } catch (err) {
      setError(err?.message || "Movie save failed");
    } finally {
      setSavingMovie(false);
    }
  };

  const handleFetchImdb = async () => {
    setError("");
    setMessage("");
    if (!imdbQuery.trim()) {
      setError("Enter IMDb ID or URL first (example: tt39961926)");
      return;
    }
    setFetchingImdb(true);
    try {
      const res = await fetch("/api/admin/movies/imdb", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: imdbQuery }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(payload?.error || "Failed to fetch IMDb data").trim());
      }
      const item = payload?.item || {};
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
      const provider = String(payload?.provider || "imdb");
      setMessage(`Metadata auto-fill হয়েছে (${provider}). এখন চাইলে edit করে save করুন।`);
    } catch (err) {
      setError(err?.message || "Failed to fetch IMDb data");
    } finally {
      setFetchingImdb(false);
    }
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
    setMovieForm(next);
    setMovieFormInitialSnapshot(serializeMovieForm(next));
    setShowMovieForm(true);
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
    try {
      const res = await fetch("/api/admin/movies/metadata-refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          movie_ids: targetIds,
          providers: String(importForm.providers || "imdb,omdb,tmdb")
            .split(",")
            .map((v) => String(v || "").trim().toLowerCase())
            .filter(Boolean),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Metadata refresh failed");
      setMetadataRefreshSummary({
        processed: Number(payload?.processed || 0),
        succeeded: Number(payload?.succeeded || 0),
        failed: Number(payload?.failed || 0),
      });
      const failedItems = Array.isArray(payload?.results)
        ? payload.results.filter((row) => !row?.ok).slice(0, 5)
        : [];
      if (payload?.omdb_usage) setOmdbUsageInfo(payload.omdb_usage);
      await refreshMovies();
      setMessage(`Metadata refresh done. Success: ${payload?.succeeded || 0}, Failed: ${payload?.failed || 0}`);
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
    ],
    [handleDeleteMovie, openMovieEditor]
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

  useEffect(() => {
    setMovieRowSelection({});
  }, [currentCategorySlug, movies]);

  useEffect(() => {
    setMoviePagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [currentCategorySlug, movieSearch, movieStatusFilter, movieDataFilter]);

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
                          router.push(`/dashboard/movies/category/${encodeURIComponent(String(row.slug || ""))}`);
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
                router.push("/dashboard/movies");
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
          <div className={styles.formGrid}>
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
          </div>
          <div className={styles.actions}>
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
                ? "Refreshing Metadata..."
                : `Refetch Selected Metadata (${movieTable.getSelectedRowModel().rows.length})`}
            </button>
          </div>
          {metadataRefreshSummary ? (
            <p className={styles.hint} style={{ marginBottom: 8 }}>
              Metadata Refresh: Processed {metadataRefreshSummary.processed} | Success {metadataRefreshSummary.succeeded} | Failed{" "}
              {metadataRefreshSummary.failed}
            </p>
          ) : null}
          <div className={styles.paginationBar}>
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
                    <PaginationItem key={String(item)}>
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
          প্রতি লাইনে একটি OMDb API key দিন। একটি key limit (1000/day) শেষ বা invalid না হওয়া পর্যন্ত সেটাই ব্যবহার হবে, তারপর পরের key শুরু হবে।
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
              <span>Max Depth</span>
              <input
                type="number"
                min="1"
                value={importForm.max_depth}
                onChange={(e) => setImportForm((prev) => ({ ...prev, max_depth: e.target.value }))}
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
                  </tr>
                </thead>
                <tbody>
                  {preparedItems.map((row, idx) => {
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
                        <span className={statusClass}>{status}</span>
                      </td>
                    </tr>
                    );
                  })}
                  {!preparedItems.length ? (
                    <tr>
                      <td colSpan={7}>No scan result yet.</td>
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
                    </tr>
                  ))}
                  {!scanRawItems.length ? (
                    <tr>
                      <td colSpan={3}>Scanning চলছে... প্রথম মুভি পেলে এখানে সাথে সাথে দেখাবে।</td>
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

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>IMDb ID / URL</span>
              <input
                value={imdbQuery}
                onChange={(e) => setImdbQuery(e.target.value)}
                placeholder="tt39961926 or https://m.imdb.com/title/tt39961926/"
              />
            </label>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryBtn} disabled={fetchingImdb} onClick={handleFetchImdb}>
                {fetchingImdb ? "Fetching IMDb..." : "Fetch IMDb Data"}
              </button>
            </div>
          </div>

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
                  onChange={(e) => setMovieForm((prev) => ({ ...prev, source_url: e.target.value }))}
                  placeholder="https://.../movie.m3u8"
                />
                <button type="button" className={styles.ghostBtn} onClick={openSourcePreview}>
                  Preview
                </button>
              </div>
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
              <h4>{previewTitle || "Source Preview"}</h4>
              <button type="button" className={styles.closeBtn} onClick={closeSourcePreview}>
                Close
              </button>
            </div>
            <video
              key={previewSourceUrl}
              className={styles.video}
              controls
              playsInline
              preload="metadata"
              src={previewSourceUrl}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
