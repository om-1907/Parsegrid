"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      try {
        await apiFetch("/api/v1/auth/me");
        if (!cancelled) setIsAuthenticated(true);
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      }
    };
    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (isAuthenticated === false) router.push("/login");
  }, [isAuthenticated, router]);

  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <span className="text-sm">Verifying your session…</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated === false) return null;

  return <>{children}</>;
}
