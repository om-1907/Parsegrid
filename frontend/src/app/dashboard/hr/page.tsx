import { redirect } from "next/navigation";

// The HR/resume workspace is now the "Resumes" tab of the unified dashboard.
// Keep this route as a redirect for any existing bookmarks/links.
export default function HRDashboardRedirect() {
  redirect("/dashboard");
}
