import { requireUser } from "@/lib/auth";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await requireUser();
  return <DashboardClient username={user.username} />;
}
