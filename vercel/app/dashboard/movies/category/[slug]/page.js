import styles from "../../../page.module.css";
import ManageMovies from "../../ManageMovies";
import { getMoviesPageData } from "../../getPageData";

export default async function CategoryMoviesPage({ params }) {
  const resolvedParams = await params;
  const data = await getMoviesPageData();
  const categorySlug = String(resolvedParams?.slug || "").trim().toLowerCase();

  return (
    <section className={styles.card}>
      <h2>Movies Management</h2>
      <p className={styles.hint}>View and manage movies under selected category.</p>
      <ManageMovies
        initialCategories={data.categories}
        initialMovies={data.movies}
        categorySlug={categorySlug}
      />
    </section>
  );
}
