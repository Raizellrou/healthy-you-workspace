import { describe, expect, it } from "vitest";
import { buildMentionLookup, parseMentions } from "@/lib/notify";

// A realistic caller (addComment) indexes both full names and first names,
// so parseMentions itself only has to try progressively shorter prefixes of
// whatever it captured — it doesn't need its own first-name-splitting logic.
const nameToId = new Map([
  ["amara adeyemi", "amara-id"],
  ["amara", "amara-id"],
  ["beatriz haddad", "beatriz-id"],
  ["priya fontaine", "priya-id"],
]);

describe("parseMentions", () => {
  it("matches a full two-word name", () => {
    expect(parseMentions("cc @Amara Adeyemi on this", nameToId)).toEqual(["amara-id"]);
  });

  it("matches a first name alone when punctuation stops the capture early", () => {
    expect(parseMentions("@Amara, can you look at this?", nameToId)).toEqual(["amara-id"]);
  });

  it("falls back to the first word when the captured two-word phrase isn't a registered name", () => {
    // "Amara Petrov" isn't anyone's name, but the regex still greedily
    // captures both words since nothing stops it — the fallback is what
    // recovers the real mention.
    expect(parseMentions("@Amara Petrov please review", nameToId)).toEqual(["amara-id"]);
  });

  it("resolves multiple distinct mentions", () => {
    const ids = parseMentions("@Beatriz Haddad and @Priya Fontaine, please review", nameToId);
    expect(new Set(ids)).toEqual(new Set(["beatriz-id", "priya-id"]));
  });

  it("de-duplicates repeated mentions of the same person", () => {
    expect(parseMentions("@Amara Adeyemi ping @Amara Adeyemi again", nameToId)).toEqual(["amara-id"]);
  });

  it("silently ignores an @mention that matches nobody", () => {
    expect(parseMentions("@Nobody Here should not resolve", nameToId)).toEqual([]);
  });

  it("returns an empty array when there are no mentions", () => {
    expect(parseMentions("just a plain comment", nameToId)).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(parseMentions("@AMARA ADEYEMI", nameToId)).toEqual(["amara-id"]);
  });
});

describe("buildMentionLookup", () => {
  it("indexes every full name", () => {
    const lookup = buildMentionLookup([{ id: "1", name: "Amara Adeyemi" }, { id: "2", name: "Beatriz Haddad" }]);
    expect(lookup.get("amara adeyemi")).toBe("1");
    expect(lookup.get("beatriz haddad")).toBe("2");
  });

  it("also indexes a first name when it's unique across the roster", () => {
    const lookup = buildMentionLookup([{ id: "1", name: "Amara Adeyemi" }]);
    expect(lookup.get("amara")).toBe("1");
  });

  it("omits a first name shared by more than one person, so a mention can't resolve to the wrong one", () => {
    const lookup = buildMentionLookup([
      { id: "1", name: "Amara Adeyemi" },
      { id: "2", name: "Amara Okafor" },
    ]);
    expect(lookup.has("amara")).toBe(false);
    expect(lookup.get("amara adeyemi")).toBe("1");
    expect(lookup.get("amara okafor")).toBe("2");
  });
});
