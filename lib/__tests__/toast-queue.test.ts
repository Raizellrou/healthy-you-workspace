import { describe, it, expect } from "vitest";
import { enqueue, dismiss, MAX_VISIBLE_TOASTS, type Toast } from "@/lib/toast-queue";

function toast(id: string): Toast {
  return { id, title: id, variant: "info", duration: 5000 };
}

describe("enqueue", () => {
  it("appends below the cap", () => {
    const queue = enqueue(enqueue([], toast("a")), toast("b"));
    expect(queue.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("caps at MAX_VISIBLE_TOASTS, evicting the oldest first", () => {
    let queue: Toast[] = [];
    for (let i = 0; i < MAX_VISIBLE_TOASTS + 2; i++) {
      queue = enqueue(queue, toast(`t${i}`));
    }
    expect(queue).toHaveLength(MAX_VISIBLE_TOASTS);
    // t0 and t1 evicted — the two oldest — leaving the most recent MAX entries.
    expect(queue.map((t) => t.id)).toEqual(["t2", "t3", "t4"]);
  });
});

describe("dismiss", () => {
  it("removes the toast with the given id", () => {
    const queue = [toast("a"), toast("b"), toast("c")];
    expect(dismiss(queue, "b").map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("is a no-op when the id is already gone", () => {
    const queue = [toast("a"), toast("b")];
    expect(dismiss(queue, "z")).toEqual(queue);
  });
});
