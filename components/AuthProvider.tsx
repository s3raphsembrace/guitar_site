// components/AuthProvider.tsx

"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";

// Inner component that can use useSession
function SessionLogger() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") {
      console.log("[SESSION] ⏳ Loading session...");
    } else if (status === "authenticated" && session?.user) {
      console.log("[SESSION] ✅ Authenticated:", {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      });
    } else if (status === "unauthenticated") {
      console.log("[SESSION] 🔒 No active session");
    }
  }, [status, session]);

  return null;
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <SessionLogger />
      {children}
    </SessionProvider>
  );
}