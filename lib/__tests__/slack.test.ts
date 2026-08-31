import { describe, expect, it } from "vitest";
import { escapeSlackText } from "@/lib/slack";

describe("escapeSlackText", () => {
  it("escapes the three characters mrkdwn treats specially", () => {
    expect(escapeSlackText("A & B")).toBe("A &amp; B");
    expect(escapeSlackText("<script>")).toBe("&lt;script&gt;");
  });

  it("neutralizes a channel-wide ping attempt", () => {
    expect(escapeSlackText("<!channel> urgent")).toBe("&lt;!channel&gt; urgent");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeSlackText("Hey — no rush, just following up.")).toBe("Hey — no rush, just following up.");
  });
});
