import AuthPageLayout from "@/components/auth/AuthPageLayout";
import SignupForm from "@/components/auth/SignupForm";
import { safeNextPath } from "@/lib/auth/redirect";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const next = safeNextPath((await searchParams).next);

  return (
    <AuthPageLayout
      eyebrow="Sign up"
      heading="Create your account"
      subtitle="Create your account to join events, track your rides, and connect with the community."
      maxWidth={720}
    >
      <SignupForm redirectTo={next} />
    </AuthPageLayout>
  );
}
