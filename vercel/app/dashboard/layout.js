import { requireAdmin } from "../../lib/auth";

export default async function DashboardLayout({ children }) {
  await requireAdmin();
  return children;
}
