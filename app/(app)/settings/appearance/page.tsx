import { PageHead } from "@/components/ui/PageHead";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getUiPreferences } from "@/lib/supabase/preferences";
import { AppearanceClient } from "./AppearanceClient";

export default async function AppearancePage() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return null;

  const prefs = await getUiPreferences(employeeId);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PageHead
        title="Appearance & Accessibility"
        description="How the workspace looks and moves for you. Applies everywhere, not just here."
      />
      <AppearanceClient prefs={prefs} />
    </div>
  );
}
