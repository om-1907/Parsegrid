import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/dashboard/AppHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/20">
        <AppHeader />
        {children}
      </div>
    </ProtectedRoute>
  );
}
