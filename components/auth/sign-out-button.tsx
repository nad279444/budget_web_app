"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const SignOutButton = ({ className }: { className?: string }) => {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
      },
    });
  };

  return (
    <Button
      variant="ghost"
      className={className}
      onClick={handleSignOut}
    >
      Sign out
    </Button>
  );
};

export default SignOutButton;