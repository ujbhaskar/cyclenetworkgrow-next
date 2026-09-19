import AuthPageLayout from "@/components/auth/AuthPageLayout";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthPageLayout
      eyebrow="Sign in"
      heading="Welcome back, rider"
      subtitle="Log in to track your rides, join events, and connect with the community."
    >
      <LoginForm />
    </AuthPageLayout>
  );
}
