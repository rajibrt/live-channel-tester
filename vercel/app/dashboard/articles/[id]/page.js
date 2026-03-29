import { notFound } from "next/navigation";
import AnnouncementCreateForm from "../../announcements/AnnouncementCreateForm";
import { getAnnouncementItemById } from "../../announcements/data";

export default async function EditArticlePage({ params }) {
  const id = String((await params)?.id || "").trim();
  const { item, error } = await getAnnouncementItemById(id);

  if (error || !item) notFound();
  if (String(item?.content_type || "").trim().toLowerCase() !== "article") notFound();

  return <AnnouncementCreateForm mode="articles" initialData={item} editId={id} />;
}
