import { requireAdmin } from "../../lib/auth";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }) {
  await requireAdmin();
  return <DashboardShell>{children}</DashboardShell>;
}
