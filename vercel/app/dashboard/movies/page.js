import styles from "../page.module.css";
import ManageMovies from "./ManageMovies";
import { getMoviesPageData } from "./getPageData";

export default async function MoviesPage() {
  const data = await getMoviesPageData();
  return (
    <section className={styles.card}>
      <h2>Movies Management</h2>
      <p className={styles.hint}>Add movie categories and publish movies for homepage Movies mode.</p>
      <ManageMovies initialCategories={data.categories} initialMovies={data.movies} />
    </section>
  );
}
