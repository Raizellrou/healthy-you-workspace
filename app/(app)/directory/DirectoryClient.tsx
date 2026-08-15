"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { BandChip } from "@/components/burnout/BandChip";
import { computeBurnout } from "@/lib/burnout";
import type { Employee } from "@/types/employee";

export function DirectoryClient({ employees }: { employees: Employee[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.team.toLowerCase().includes(q)
    );
  }, [employees, query]);

  return (
    <div>
      <label className="sr-only" htmlFor="directory-search">
        Search employees
      </label>
      <input
        id="directory-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or team…"
        className="mb-4 w-full max-w-sm rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus:border-brand"
      />

      {filtered.length === 0 ? (
        <EmptyState icon="users" message={`No employees match “${query}”.`} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-surface-2 text-xs font-medium uppercase tracking-wide text-ink-mute">
              <tr>
                <th scope="col" className="px-4 py-3">Employee</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Burnout band</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const scores = computeBurnout(e);
                return (
                  <tr key={e.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={e.name} color={e.avatarColor} />
                        <div>
                          <div className="font-medium text-ink">{e.name}</div>
                          <div className="text-xs text-ink-mute">{e.team}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{e.role}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{e.email}</td>
                    <td className="px-4 py-3">
                      <BandChip band={scores.band} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
