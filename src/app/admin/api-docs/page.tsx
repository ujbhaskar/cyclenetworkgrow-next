import { requireRole } from "@/lib/auth/dal";
import { getApiDocs } from "@/lib/swagger";
import ApiDocsClient from "@/components/ApiDocsClient";

export default async function ApiDocsPage() {
  await requireRole("admin");
  const spec = getApiDocs();

  return <ApiDocsClient spec={spec} />;
}
