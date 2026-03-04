"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clapperboard, FolderPlus, Pencil, Trash2 } from "lucide-react";
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
  const [movieSort, setMovieSort] = useState("updated_desc");

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    slug: "",
    position: "0",
  });

  const [movieForm, setMovieForm] = useState({ ...EMPTY_MOVIE_FORM });

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

  const filteredMoviesInSelectedCategory = useMemo(() => {
    const q = movieSearch.trim().toLowerCase();
    const next = moviesInSelectedCategory.filter((row) => {
      const title = String(row?.title || "").toLowerCase();
      const slug = String(row?.slug || "").toLowerCase();
      const matchesText = !q || title.includes(q) || slug.includes(q);
      const matchesStatus =
        movieStatusFilter === "published"
          ? Boolean(row?.is_published)
          : movieStatusFilter === "hidden"
            ? !Boolean(row?.is_published)
            : true;
      return matchesText && matchesStatus;
    });
    next.sort((a, b) => {
      if (movieSort === "title_asc") {
        return String(a?.title || "").localeCompare(String(b?.title || ""), undefined, { sensitivity: "base" });
      }
      if (movieSort === "title_desc") {
        return String(b?.title || "").localeCompare(String(a?.title || ""), undefined, { sensitivity: "base" });
      }
      const aTime = new Date(a?.updated_at || 0).getTime();
      const bTime = new Date(b?.updated_at || 0).getTime();
      return bTime - aTime;
    });
    return next;
  }, [movieSearch, movieSort, movieStatusFilter, moviesInSelectedCategory]);

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
    setMovieForm({ ...EMPTY_MOVIE_FORM });
    setImdbQuery("");
  };

  const openNewMovieForm = () => {
    setShowMovieForm(true);
    setImdbQuery("");
    setMovieForm({
      ...EMPTY_MOVIE_FORM,
      category_ids: selectedCategory ? [Number(selectedCategory.id)] : [],
    });
  };

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
      if (!res.ok) throw new Error(payload?.error || "Failed to fetch IMDb data");
      const item = payload?.item || {};
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
      if (item.imdb_id) setImdbQuery(item.imdb_id);
      setMessage("IMDb তথ্য auto-fill হয়েছে। এখন চাইলে edit করে save করুন।");
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
      if (String(movieForm.id || "") === String(id)) resetMovieForm();
      setMessage("Movie deleted.");
    } catch (err) {
      setError(err?.message || "Movie delete failed");
    }
  };

  const openMovieEditor = (row) => {
    if (!row) return;
    const firstSource = Array.isArray(row.sources) ? row.sources[0] : null;
    setImdbQuery(String(row.imdb_id || ""));
    setMovieForm({
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
    });
    setShowMovieForm(true);
  };

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
                        onClick={() => router.push(`/dashboard/movies/category/${encodeURIComponent(String(row.slug || ""))}`)}
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
              onClick={() => router.push("/dashboard/movies")}
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
                onChange={(e) => setMovieSearch(e.target.value)}
                placeholder="Search by movie title or slug"
              />
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select value={movieStatusFilter} onChange={(e) => setMovieStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Sort</span>
              <select value={movieSort} onChange={(e) => setMovieSort(e.target.value)}>
                <option value="updated_desc">Latest Updated</option>
                <option value="title_asc">Title A to Z</option>
                <option value="title_desc">Title Z to A</option>
              </select>
            </label>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMoviesInSelectedCategory.length ? (
                  filteredMoviesInSelectedCategory.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{row.is_published ? "Published" : "Hidden"}</td>
                      <td>{row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>
                      <td>
                        <button type="button" className={styles.ghostBtn} onClick={() => openMovieEditor(row)}>
                          <Pencil size={14} aria-hidden="true" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No movies found for current filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
            </>
          ) : (
            <p className={styles.hint}>This category does not exist. Go back to categories list.</p>
          )}
        </section>
      ) : null}

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
        <section className={styles.card}>
          <h2>{movieForm.id ? "Edit Movie" : "Add Movie"}</h2>
          <p className={styles.hint}>Add movie and one primary source URL. Source URL stays server-side and client plays via proxy.</p>

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
              <input value={movieForm.source_url} onChange={(e) => setMovieForm((prev) => ({ ...prev, source_url: e.target.value }))} placeholder="https://.../movie.m3u8" />
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
                onClick={() => {
                  setShowMovieForm(false);
                  resetMovieForm();
                }}
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
        </section>
      ) : null}
    </div>
  );
}
