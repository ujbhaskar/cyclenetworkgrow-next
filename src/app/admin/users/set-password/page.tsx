import { requireRole } from "@/lib/auth/dal";
import SetPasswordForm from "@/components/admin/SetPasswordForm";

export default async function AdminSetPasswordPage() {
  await requireRole("admin");
  return <SetPasswordForm />;
}
