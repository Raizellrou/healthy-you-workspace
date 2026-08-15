import { PageHead } from "@/components/ui/PageHead";
import { KudosClient } from "./KudosClient";

export default function KudosPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead title="Give Me a Coffee" description="Send your buddy a quick note of thanks." />
      <KudosClient />
    </div>
  );
}
