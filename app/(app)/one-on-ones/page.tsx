import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui/PageHead";
import { getCurrentPerson } from "@/lib/supabase/people";
import { getReportAgendas, getOneOnOnes } from "@/lib/supabase/one-on-ones";
import { todayInTz } from "@/lib/date";
import { OneOnOnesClient } from "./OneOnOnesClient";

/**
 * Open to everyone signed in, but showing very different things.
 *
 * A manager or HR gets the running-the-meeting side: live agendas for their
 * reports, and scheduling. An employee gets exactly one thing — their own
 * 1:1 records, including the agenda that was generated about them.
 *
 * That second half is not a nice-to-have. 0021 deliberately gives the
 * subject SELECT on their own rows and ships no private manager notes,
 * on the grounds that this must not become a hidden file on somebody. A
 * manager-only route would have quietly broken that: the scheduling
 * notification tells the person "you can see all of it" and links here,
 * so a 404 would have made the promise a lie. Caught live.
 */
export default async function OneOnOnesPage() {
  const me = await getCurrentPerson();
  if (!me) notFound();

  const canManage = me.appRole === "manager" || me.appRole === "hr";
  const [agendas, meetings] = await Promise.all([
    canManage ? getReportAgendas(me) : Promise.resolve([]),
    getOneOnOnes(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead
        title="1:1s"
        description={
          canManage
            ? "Agendas assembled from signals the rest of the app already tracks, so a conversation starts from what actually changed. Everything here is visible to the person it's about."
            : "Your 1:1 records, including the agenda that was prepared for each one. Nothing about these meetings is hidden from you."
        }
      />
      <OneOnOnesClient
        agendas={agendas}
        meetings={meetings}
        currentPersonId={me.id}
        canManage={canManage}
        today={todayInTz(me.timezone)}
      />
    </div>
  );
}
