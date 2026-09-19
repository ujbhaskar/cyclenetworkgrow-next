import AuthPageLayout from "@/components/auth/AuthPageLayout";
import SignupForm from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <AuthPageLayout
      eyebrow="Sign up"
      heading="Create your account"
      subtitle="Create your account to join events, track your rides, and connect with the community."
    >
      <SignupForm />
    </AuthPageLayout>
  );
}
