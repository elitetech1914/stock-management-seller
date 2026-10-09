import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/sidebar";
import { auth } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user) {
    redirect("/admin/login");
  }

  if (
    session.user.role !== "admin"
  ) {
    redirect("/");
  }

  return (
    <div className="admin-shell min-h-screen bg-background xl:flex">
      <AdminSidebar />

      <main className="admin-content min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
