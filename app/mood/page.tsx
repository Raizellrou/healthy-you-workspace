import { PageHead } from "@/components/ui/PageHead";
import { MoodClient } from "./MoodClient";

export default function MoodPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead title="Track the Mood" description="A quick, private daily check-in." />
      <MoodClient />
    </div>
  );
}
