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
    <div className="flex min-h-screen bg-[#f7f7f5]">
      <div className="sticky top-0 h-screen shrink-0">
        <AdminSidebar />
      </div>

      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}