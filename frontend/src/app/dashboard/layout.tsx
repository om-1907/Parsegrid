import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { FixedVideoBg } from "@/components/landing/FixedVideoBg";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      {/* Same fixed video backdrop as the landing / login pages so the workspace
          shares one visual language. Content scrolls over it on a glass layer. */}
      <div className="relative min-h-screen text-white">
        <FixedVideoBg />
        <div className="relative z-10 flex min-h-screen flex-col">
          <AppHeader />
          {children}
        </div>
      </div>
    </ProtectedRoute>
  );
}
