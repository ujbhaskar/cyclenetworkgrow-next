import AuthPageLayout from "@/components/auth/AuthPageLayout";
import LoginForm from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/auth/redirect";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath((await searchParams).next);

  return (
    <AuthPageLayout
      eyebrow="Sign in"
      heading="Welcome back, rider"
      subtitle="Log in to track your rides, join events, and connect with the community."
    >
      <LoginForm redirectTo={next} />
    </AuthPageLayout>
  );
}
