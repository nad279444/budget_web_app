import GoogleSignInButton from "@/components/auth/google-sign-in-button";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const callbackURL = ["/dashboard", "/transaction"].some((p) =>
    (redirect ?? "").startsWith(p)
  )
    ? (redirect ?? "")
    : "/dashboard";

  return (
    <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Create account</h1>
      <p className="mt-1 text-sm text-gray-500">
        Get started with wealth tracking in seconds.
      </p>
      <div className="mt-6">
        <GoogleSignInButton callbackURL={callbackURL} />
      </div>
      <p className="mt-4 text-xs text-gray-400">
        Your Wealth account logs you in across sign-in and sign-up.
      </p>
    </div>
  );
}