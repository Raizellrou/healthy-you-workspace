"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { searchIndex, type SearchItem } from "@/lib/search";

const GROUP_LABEL: Record<SearchItem["type"], string> = {
  page: "Pages",
  person: "People",
  project: "Projects",
  task: "Tasks",
};

const GROUP_ORDER: SearchItem["type"][] = ["page", "person", "project", "task"];
const GROUP_LIMIT = 5;
const CANDIDATE_LIMIT = 24;

/** Fired by anything that wants to open the palette without owning its
 *  state — e.g. MobileTabBar's search button. The palette is the single
 *  owner of open/closed; nothing else should hold a mirror of it. */
export const OPEN_PALETTE_EVENT = "axionhr:open-command-palette";

/**
 * Global ⌘K / Ctrl+K search, built on the same native-`<dialog>` mechanics
 * as components/ui/Modal.tsx (focus trap, Esc-to-close via the `cancel`
 * event, top-layer stacking) rather than Modal's own header/footer chrome,
 * which doesn't fit a spotlight-style search UI.
 *
 * The keydown listener here is the one global shortcut handler this app
 * has — Phase 4's nudge-toast and focus-mode shortcuts extend this same
 * effect rather than adding a second document-level listener.
 *
 * components/ui/Menu.tsx has its own document-level Escape listener for
 * closing row-action dropdowns. A native dialog's Escape does NOT stop that
 * keydown from also bubbling to document — inert only blocks pointer/focus,
 * not event propagation — so the input here calls stopPropagation() on
 * Escape specifically, keeping a Menu that happens to be open underneath
 * from also closing when the palette closes.
 */
export function CommandPalette({ index }: { index: SearchItem[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const candidates = useMemo(() => searchIndex(index, query, CANDIDATE_LIMIT), [index, query]);
  const groups = useMemo(
    () =>
      GROUP_ORDER.map((type) => ({ type, items: candidates.filter((c) => c.type === type).slice(0, GROUP_LIMIT) })).filter(
        (g) => g.items.length > 0
      ),
    [candidates]
  );
  const orderedResults = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      setOpen(false);
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);

  // Reset query/activeIndex during render rather than in an effect —
  // React's own recommended pattern for "adjust state when a value
  // changes" (see "You Might Not Need an Effect"), which avoids the extra
  // render an effect-based reset would cost.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  function select(item: SearchItem) {
    setOpen(false);
    router.push(item.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      // Close via our own state rather than leaning on the native `cancel`
      // event (still wired below as a fallback for the rare case focus
      // isn't on this input). Chromium's own Escape-closes-dialog handling
      // turned out to participate in ordinary event propagation — a plain
      // stopPropagation() here was *also* silently suppressing that native
      // close, leaving the dialog open with no visible effect. Confirmed
      // against the built app: instrumenting the dialog's `cancel`
      // listener showed it never fired while stopPropagation was in play.
      //
      // Shielding Menu.tsx's own `document.addEventListener("keydown", …)`
      // listener needs stopImmediatePropagation() on the native event, not
      // React's stopPropagation() — React's delegated listener and Menu's
      // plain listener are both registered on the same `document` node,
      // and stopPropagation() only stops an event moving to the NEXT node
      // in the bubble path; it does nothing for another listener already
      // registered on the SAME node. Confirmed by the same live check:
      // with only stopPropagation(), Menu still closed alongside us.
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, orderedResults.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = orderedResults[activeIndex];
      if (item) select(item);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search"
      onClick={(event) => {
        if (event.target === dialogRef.current) setOpen(false);
      }}
      className="m-auto mt-[12vh] w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Icon name="search" size={18} className="shrink-0 text-ink-mute" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={orderedResults.length > 0}
          aria-controls="command-palette-listbox"
          aria-activedescendant={orderedResults[activeIndex] ? `command-palette-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Search people, projects, tasks, pages…"
          className="w-full border-none bg-transparent text-sm text-ink placeholder:text-ink-mute focus:outline-none"
        />
        <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-mute">Esc</kbd>
      </div>

      <div id="command-palette-listbox" role="listbox" aria-label="Search results" className="max-h-[60vh] overflow-y-auto p-2">
        {query.trim() && orderedResults.length === 0 ? (
          <p className="px-2.5 py-4 text-center text-sm text-ink-mute">No matches for &ldquo;{query}&rdquo;</p>
        ) : null}
        {groups.map((group) => {
          let groupStart = 0;
          for (const g of groups) {
            if (g.type === group.type) break;
            groupStart += g.items.length;
          }
          return (
            <div key={group.type} role="group" aria-label={GROUP_LABEL[group.type]} className="mb-1 last:mb-0">
              <div className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-mute">
                {GROUP_LABEL[group.type]}
              </div>
              {group.items.map((item, i) => {
                const flatIndex = groupStart + i;
                const active = flatIndex === activeIndex;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    id={`command-palette-option-${flatIndex}`}
                    role="option"
                    aria-selected={active}
                    type="button"
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    onClick={() => select(item)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      active ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <Icon name={item.icon} size={16} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.sublabel ? <span className="shrink-0 truncate text-xs text-ink-mute">{item.sublabel}</span> : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </dialog>
  );
}
