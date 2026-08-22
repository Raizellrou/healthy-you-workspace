"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import type { Person, Team } from "@/types/person";
import { assignManager, setHr } from "./actions";

export function TeamsClient({
  teams,
  employees,
  currentPersonId,
}: {
  teams: Team[];
  employees: Person[];
  currentPersonId: string;
}) {
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [pendingHrId, setPendingHrId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const byTeam = new Map<string, Person[]>();
  for (const e of employees) {
    if (!e.teamId) continue;
    const list = byTeam.get(e.teamId) ?? [];
    list.push(e);
    byTeam.set(e.teamId, list);
  }

  function handleAssignManager(teamId: string, employeeId: string) {
    setError(null);
    setPendingTeamId(teamId);
    startTransition(async () => {
      const result = await assignManager(teamId, employeeId);
      setPendingTeamId(null);
      if (!result.ok) setError(result.error ?? "Failed to reassign manager.");
    });
  }

  function handleSetHr(employeeId: string, grant: boolean) {
    setError(null);
    setPendingHrId(employeeId);
    startTransition(async () => {
      const result = await setHr(employeeId, grant);
      setPendingHrId(null);
      if (!result.ok) setError(result.error ?? "Failed to update HR access.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-risk-critical/30 bg-risk-critical/10 px-4 py-2 text-sm text-risk-critical">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => {
          const members = byTeam.get(team.id) ?? [];
          return (
            <Card key={team.id}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">{team.name}</h2>
                <Chip tone="brand">{members.length} people</Chip>
              </div>

              <Field label="Manager" className="mb-4">
                {(props) => (
                  <Select
                    {...props}
                    value={team.managerId ?? ""}
                    disabled={isPending && pendingTeamId === team.id}
                    onChange={(e) => handleAssignManager(team.id, e.target.value)}
                    options={members.map((m) => ({ value: m.id, label: m.name }))}
                    placeholder={members.length === 0 ? "No members yet" : "Choose a manager"}
                  />
                )}
              </Field>

              <ul className="flex flex-col gap-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className={`flex items-center gap-2.5 ${
                      isPending && pendingHrId === m.id ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    <Avatar name={m.name} color={m.avatarColor} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {m.name}
                        {m.id === currentPersonId && (
                          <span className="ml-1.5 text-xs font-normal text-ink-mute">(you)</span>
                        )}
                      </div>
                      <div className="truncate text-xs text-ink-mute">{m.email}</div>
                    </div>
                    {m.id === team.managerId && <Chip tone="brand">Manager</Chip>}
                    {m.appRole === "hr" && <Chip tone="success">HR</Chip>}
                    <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                      HR
                      <Switch
                        id={`hr-${m.id}`}
                        label={`Grant HR access to ${m.name}`}
                        checked={m.appRole === "hr"}
                        onChange={(next) => handleSetHr(m.id, next)}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
