import { requireRole } from "@/lib/auth/dal";
import { listAllUsers } from "@/lib/admin-user-management";
import UsersTable from "@/components/admin/UsersTable";

export default async function AdminUsersPage() {
  const session = await requireRole("admin");
  const users = await listAllUsers();

  return <UsersTable initialUsers={users} currentUid={session.uid} />;
}
