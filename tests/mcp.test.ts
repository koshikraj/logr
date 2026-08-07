import { describe, it, expect, vi, beforeEach } from "vitest";

// The conformance suite drives the real route-mounted handler through the
// real MCP client over an in-process fetch — full protocol, no network, no DB
// (prisma is mocked at the module boundary getProfile/find_profiles use).
vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    event: {
      aggregate: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { createMcpHandler, type AuthInfo } from "@modelcontextprotocol/server";
import { Client, StreamableHTTPClientTransport, type FetchLike } from "@modelcontextprotocol/client";
import { createLogrMcpServer } from "@/lib/mcp";

const findUnique = prisma.profile.findUnique as ReturnType<typeof vi.fn>;
const findMany = prisma.profile.findMany as ReturnType<typeof vi.fn>;
const profileUpdate = prisma.profile.update as ReturnType<typeof vi.fn>;
const eventAggregate = prisma.event.aggregate as ReturnType<typeof vi.fn>;
const eventCreate = prisma.event.create as ReturnType<typeof vi.fn>;
const eventUpdateMany = prisma.event.updateMany as ReturnType<typeof vi.fn>;
const eventDeleteMany = prisma.event.deleteMany as ReturnType<typeof vi.fn>;

function ownerAuth(scopes: string[]): AuthInfo {
  return {
    token: "logr_at_test",
    clientId: "client1",
    scopes,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    extra: { userId: "u1", profileId: "p1" },
  };
}

/** A DB row in the exact shape getProfile() selects (profile + events + media). */
function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    username: "koshik",
    name: "Koshik Raj",
    bio: "Builder of logr",
    status: "building logr",
    location: "Bengaluru",
    about: "Longer form about.",
    avatarUrl: "/uploads/avatar.png",
    socials: JSON.stringify([{ label: "GitHub", href: "https://github.com/koshikraj" }]),
    theme: "{}",
    pinned: JSON.stringify(["e1"]),
    claimStatus: "owned",
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    events: [
      {
        id: "e1",
        dateOn: "2026-04-15",
        title: "Shipped logr MCP",
        tags: ["work"],
        featured: true,
        fullDate: false,
        body: "Exposed profiles over the Model Context Protocol.",
        icon: null,
        linkLabel: "announcement",
        linkHref: "https://logr.it/blog/mcp",
        provenance: "userCreated",
        sourceUrl: null,
        position: 0,
        media: [
          {
            kind: "image",
            url: "/uploads/mcp.png",
            poster: null,
            provider: null,
            title: null,
            position: 0,
          },
        ],
      },
      {
        id: "e2",
        dateOn: "2025-11-02",
        title: "Talk on agent identity",
        tags: ["talk"],
        featured: false,
        fullDate: false,
        body: "Spoke about portfolios as agent-readable interfaces.",
        icon: null,
        linkLabel: null,
        linkHref: null,
        provenance: "seeded",
        sourceUrl: "https://example.com/talk",
        position: 1,
        media: [],
      },
    ],
    ...overrides,
  };
}

async function connect(authInfo?: AuthInfo) {
  const handler = createMcpHandler((ctx) => createLogrMcpServer(ctx));
  const fetchLike: FetchLike = (input, init) =>
    handler.fetch(new Request(input, init), { authInfo });
  const client = new Client({ name: "conformance-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("https://logr.it/mcp"), {
    fetch: fetchLike,
  });
  await client.connect(transport);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("global /mcp server", () => {
  it("completes the handshake and lists the six read tools", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "find_profiles",
      "get_context",
      "get_event",
      "get_profile",
      "get_timeline",
      "search_events",
    ]);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
    await client.close();
  });

  it("lists the profile context resource template", async () => {
    const client = await connect();
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates).toHaveLength(1);
    expect(resourceTemplates[0].uriTemplate).toBe("logr://profiles/{username}");
    expect(resourceTemplates[0].mimeType).toBe("text/markdown");
    await client.close();
  });

  it("get_profile returns the identity card", async () => {
    findUnique.mockResolvedValue(profileRow());
    const client = await connect();
    const result = await client.callTool({
      name: "get_profile",
      arguments: { username: "koshik" },
    });
    expect(result.isError).toBeFalsy();
    const card = result.structuredContent as Record<string, unknown>;
    expect(card.username).toBe("koshik");
    expect(card.name).toBe("Koshik Raj");
    expect(card.unverified).toBe(false);
    expect(card.eventCount).toBe(2);
    expect(card.years).toEqual({ first: 2025, last: 2026 });
    await client.close();
  });

  it("get_timeline filters by tag and reports pinned state", async () => {
    findUnique.mockResolvedValue(profileRow());
    const client = await connect();
    const result = await client.callTool({
      name: "get_timeline",
      arguments: { username: "koshik", tag: "work" },
    });
    const timeline = result.structuredContent as {
      total: number;
      events: { id: string; pinned: boolean }[];
    };
    expect(timeline.total).toBe(1);
    expect(timeline.events[0].id).toBe("e1");
    expect(timeline.events[0].pinned).toBe(true);
    await client.close();
  });

  it("search_events matches on body text and keeps seeded source citations", async () => {
    findUnique.mockResolvedValue(profileRow());
    const client = await connect();
    const result = await client.callTool({
      name: "search_events",
      arguments: { username: "koshik", query: "agent interfaces" },
    });
    const search = result.structuredContent as {
      total: number;
      events: { id: string; sourceUrl: string | null }[];
    };
    expect(search.total).toBe(1);
    expect(search.events[0].id).toBe("e2");
    expect(search.events[0].sourceUrl).toBe("https://example.com/talk");
    await client.close();
  });

  it("get_event returns media with absolute image URLs", async () => {
    findUnique.mockResolvedValue(profileRow());
    const client = await connect();
    const result = await client.callTool({
      name: "get_event",
      arguments: { username: "koshik", id: "e1" },
    });
    const event = result.structuredContent as { media: { url: string }[] };
    expect(event.media[0].url).toBe("https://logr.it/uploads/mcp.png");
    await client.close();
  });

  it("reads the profile context resource as Markdown", async () => {
    findUnique.mockResolvedValue(profileRow());
    const client = await connect();
    const result = await client.readResource({ uri: "logr://profiles/koshik" });
    expect(result.contents[0].mimeType).toBe("text/markdown");
    expect(result.contents[0].text).toContain("# Koshik Raj");
    expect(result.contents[0].text).toContain("Shipped logr MCP");
    await client.close();
  });

  it("draft profiles are invisible to tools and resources", async () => {
    findUnique.mockResolvedValue(profileRow({ claimStatus: "draft" }));
    const client = await connect();

    const tool = await client.callTool({
      name: "get_profile",
      arguments: { username: "koshik" },
    });
    expect(tool.isError).toBe(true);

    await expect(client.readResource({ uri: "logr://profiles/koshik" })).rejects.toThrow();
    await client.close();
  });

  it("takedown profiles are invisible too", async () => {
    findUnique.mockResolvedValue(profileRow({ claimStatus: "takedown" }));
    const client = await connect();
    const tool = await client.callTool({
      name: "get_context",
      arguments: { username: "koshik" },
    });
    expect(tool.isError).toBe(true);
    await client.close();
  });

  it("unverified (seeded published) profiles carry the disclosure", async () => {
    findUnique.mockResolvedValue(profileRow({ claimStatus: "published" }));
    const client = await connect();
    const result = await client.callTool({
      name: "get_profile",
      arguments: { username: "koshik" },
    });
    const card = result.structuredContent as { unverified: boolean; disclosure: string };
    expect(card.unverified).toBe(true);
    expect(card.disclosure).toContain("NOT been verified");
    await client.close();
  });

  it("find_profiles queries only visible claim states", async () => {
    findMany.mockResolvedValue([
      {
        username: "koshik",
        name: "Koshik Raj",
        bio: "Builder of logr",
        location: "Bengaluru",
        claimStatus: "owned",
      },
    ]);
    const client = await connect();
    const result = await client.callTool({
      name: "find_profiles",
      arguments: { query: "koshik" },
    });
    const found = result.structuredContent as { profiles: { username: string; url: string }[] };
    expect(found.profiles[0].username).toBe("koshik");
    expect(found.profiles[0].url).toBe("https://logr.it/koshik");

    const where = findMany.mock.calls[0][0].where;
    expect(where.claimStatus).toEqual({ notIn: ["draft", "takedown"] });
    await client.close();
  });

  it("write tools appear only for authorized requests, gated by scope", async () => {
    const anon = await connect();
    const anonTools = (await anon.listTools()).tools.map((t) => t.name);
    expect(anonTools).not.toContain("create_event");
    expect(anonTools).not.toContain("update_profile");
    await anon.close();

    const eventsOnly = await connect(ownerAuth(["events:write"]));
    const eventTools = (await eventsOnly.listTools()).tools.map((t) => t.name);
    expect(eventTools).toEqual(
      expect.arrayContaining(["create_event", "update_event", "delete_event"])
    );
    expect(eventTools).not.toContain("update_profile");
    await eventsOnly.close();

    const full = await connect(ownerAuth(["events:write", "profile:write"]));
    const fullTools = (await full.listTools()).tools.map((t) => t.name);
    expect(fullTools).toContain("update_profile");
    const del = (await full.listTools()).tools.find((t) => t.name === "delete_event");
    expect(del?.annotations?.destructiveHint).toBe(true);
    await full.close();
  });

  it("create_event writes to the authorized profile at the top slot", async () => {
    eventAggregate.mockResolvedValue({ _min: { position: -4 } });
    eventCreate.mockResolvedValue({ id: "new1" });
    const client = await connect(ownerAuth(["events:write"]));
    const result = await client.callTool({
      name: "create_event",
      arguments: { dateOn: "2026-08-07", title: "Wired up MCP writes", tags: ["work"] },
    });
    expect(result.isError).toBeFalsy();
    const data = eventCreate.mock.calls[0][0].data;
    expect(data.profileId).toBe("p1");
    expect(data.position).toBe(-5);
    expect(data.provenance).toBe("userCreated");
    await client.close();
  });

  it("delete_event refuses without confirm and deletes with it", async () => {
    eventDeleteMany.mockResolvedValue({ count: 1 });
    const client = await connect(ownerAuth(["events:write"]));

    const refused = await client.callTool({
      name: "delete_event",
      arguments: { id: "e1", confirm: false },
    });
    expect(refused.isError).toBe(true);
    expect(eventDeleteMany).not.toHaveBeenCalled();

    const deleted = await client.callTool({
      name: "delete_event",
      arguments: { id: "e1", confirm: true },
    });
    expect(deleted.isError).toBeFalsy();
    expect(eventDeleteMany.mock.calls[0][0].where).toEqual({ id: "e1", profileId: "p1" });
    await client.close();
  });

  it("update_event scopes the write to the authorized profile", async () => {
    eventUpdateMany.mockResolvedValue({ count: 0 });
    const client = await connect(ownerAuth(["events:write"]));
    const result = await client.callTool({
      name: "update_event",
      arguments: { id: "someone-elses", title: "hijack" },
    });
    expect(result.isError).toBe(true); // count 0 → not on this profile
    expect(eventUpdateMany.mock.calls[0][0].where).toEqual({
      id: "someone-elses",
      profileId: "p1",
    });
    await client.close();
  });

  it("update_profile updates only the provided fields", async () => {
    profileUpdate.mockResolvedValue({});
    const client = await connect(ownerAuth(["profile:write"]));
    const result = await client.callTool({
      name: "update_profile",
      arguments: { status: "building MCP", about: "" },
    });
    expect(result.isError).toBeFalsy();
    expect(profileUpdate.mock.calls[0][0]).toEqual({
      where: { id: "p1" },
      data: { status: "building MCP", about: null },
    });
    await client.close();
  });

  it("rejects invalid tool arguments with a validation error", async () => {
    findUnique.mockResolvedValue(profileRow());
    const client = await connect();
    const result = await client.callTool({
      name: "get_timeline",
      arguments: { username: "koshik", limit: 0 },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("Input validation error");
    await client.close();
  });
});
