import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractFigmaFileKey,
  extractFigmaNodeIdFromUrl,
  FigmaClient,
  normalizeFigmaNodeId,
} from "../src/figma/client.js";
import { FigmaApiError } from "../src/figma/types.js";
import { createServer } from "../src/index.js";

describe("extractFigmaFileKey", () => {
  it("extracts a simple file key", () => {
    assert.equal(extractFigmaFileKey("abc123XYZ"), "abc123XYZ");
  });

  it("extracts file key from https://www.figma.com/design/:key/:title URL", () => {
    assert.equal(
      extractFigmaFileKey(
        "https://www.figma.com/design/KDvVPrbgRj7kjZjWqvdjct/MYCAI-Introduction",
      ),
      "KDvVPrbgRj7kjZjWqvdjct",
    );
  });

  it("extracts file key from URL with query parameters including node-id", () => {
    assert.equal(
      extractFigmaFileKey(
        "https://www.figma.com/design/KDvVPrbgRj7kjZjWqvdjct/MYCAI-Introduction?node-id=14-8",
      ),
      "KDvVPrbgRj7kjZjWqvdjct",
    );
  });

  it("extracts file key from https://www.figma.com/file/:key URL", () => {
    assert.equal(
      extractFigmaFileKey(
        "https://www.figma.com/file/F1leK3y_09/Another-Design",
      ),
      "F1leK3y_09",
    );
  });

  it("rejects empty string", () => {
    assert.throws(() => extractFigmaFileKey("   "), {
      name: "FigmaApiError",
      code: "INVALID_INPUT",
    });
  });

  it("rejects invalid characters in file key", () => {
    assert.throws(() => extractFigmaFileKey("invalid key with spaces!"), {
      name: "FigmaApiError",
      code: "INVALID_INPUT",
    });
  });
});

describe("extractFigmaNodeIdFromUrl & normalizeFigmaNodeId", () => {
  it("extracts node ID from URL with hyphen format (?node-id=14-8)", () => {
    assert.equal(
      extractFigmaNodeIdFromUrl(
        "https://www.figma.com/design/KDvVPrbgRj7kjZjWqvdjct/MYCAI-Introduction?node-id=14-8",
      ),
      "14:8",
    );
  });

  it("extracts node ID from URL with encoded colon (?node-id=14%3A8)", () => {
    assert.equal(
      extractFigmaNodeIdFromUrl(
        "https://www.figma.com/design/KDvVPrbgRj7kjZjWqvdjct/MYCAI-Introduction?node-id=14%3A8",
      ),
      "14:8",
    );
  });

  it("returns null when URL has no node-id parameter", () => {
    assert.equal(
      extractFigmaNodeIdFromUrl(
        "https://www.figma.com/design/KDvVPrbgRj7kjZjWqvdjct/MYCAI-Introduction",
      ),
      null,
    );
  });

  it("returns null for non-URL strings", () => {
    assert.equal(extractFigmaNodeIdFromUrl("14:8"), null);
  });

  it("normalizes direct colon format (2:2)", () => {
    assert.equal(normalizeFigmaNodeId("2:2"), "2:2");
  });

  it("normalizes direct hyphen format (14-8 -> 14:8)", () => {
    assert.equal(normalizeFigmaNodeId("14-8"), "14:8");
  });

  it("normalizes URL input directly into extracted node ID", () => {
    assert.equal(
      normalizeFigmaNodeId(
        "https://www.figma.com/design/KDvVPrbgRj7kjZjWqvdjct/MYCAI?node-id=2-2",
      ),
      "2:2",
    );
  });

  it("rejects invalid node ID formats", () => {
    assert.throws(() => normalizeFigmaNodeId("invalid node"), {
      name: "FigmaApiError",
      code: "INVALID_INPUT",
    });
    assert.throws(() => normalizeFigmaNodeId(""), {
      name: "FigmaApiError",
      code: "INVALID_INPUT",
    });
  });
});

describe("FigmaClient — getFile", () => {
  const dummyToken = "figd_mock_token_12345";

  it("throws MISSING_TOKEN if no access token is configured", async () => {
    const client = new FigmaClient({
      accessToken: "",
      fetchFn: async () => new Response("{}"),
    });
    await assert.rejects(
      async () => client.getFile("validKey123"),
      (err: unknown) => {
        assert(err instanceof FigmaApiError);
        assert.equal(err.code, "MISSING_TOKEN");
        assert(!err.message.includes(dummyToken));
        return true;
      },
    );
  });

  it("sends X-Figma-Token header and returns parsed file summary", async () => {
    let capturedHeaders: HeadersInit | undefined;
    let capturedUrl: string | undefined;

    const mockResponsePayload = {
      name: "MYCAI — Instagram Introduction Post",
      role: "viewer",
      lastModified: "2026-10-13T10:00:00Z",
      editorType: "figma",
      version: "12345678",
      document: {
        id: "0:0",
        name: "Document",
        type: "DOCUMENT",
        children: [
          {
            id: "0:1",
            name: "Page 1",
            type: "CANVAS",
            children: [
              {
                id: "2:2",
                name: "01 — Instagram Post Artwork (1080 × 1350)",
                type: "FRAME",
              },
            ],
          },
        ],
      },
      components: { c1: {} },
      componentSets: {},
      styles: { s1: {} },
    };

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify(mockResponsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: mockFetch,
    });

    const summary = await client.getFileSummary("KDvVPrbgRj7kjZjWqvdjct", {
      depth: 2,
    });

    assert.ok(capturedUrl?.includes("/files/KDvVPrbgRj7kjZjWqvdjct?depth=2"));
    assert.equal(
      (capturedHeaders as Record<string, string>)["X-Figma-Token"],
      dummyToken,
    );
    assert.equal(summary.name, "MYCAI — Instagram Introduction Post");
    assert.equal(summary.fileKey, "KDvVPrbgRj7kjZjWqvdjct");
    assert.equal(summary.componentsCount, 1);
    assert.equal(summary.stylesCount, 1);
    assert.equal(summary.pages.length, 1);
    assert.equal(summary.pages[0]?.name, "Page 1");
    assert.equal(summary.pages[0]?.childrenCount, 1);
  });

  it("handles 401 Unauthorized securely without leaking token", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ status: 401, err: "Invalid token" }), {
        status: 401,
      });

    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: mockFetch,
    });

    await assert.rejects(
      async () => client.getFile("validKey123"),
      (err: unknown) => {
        assert(err instanceof FigmaApiError);
        assert.equal(err.code, "UNAUTHORIZED");
        assert.equal(err.statusCode, 401);
        assert(!err.message.includes(dummyToken));
        return true;
      },
    );
  });

  it("handles 403 Forbidden securely", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ status: 403, err: "Forbidden" }), {
        status: 403,
      });

    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: mockFetch,
    });

    await assert.rejects(
      async () => client.getFile("validKey123"),
      (err: unknown) => {
        assert(err instanceof FigmaApiError);
        assert.equal(err.code, "FORBIDDEN");
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  it("handles 404 Not Found securely", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ status: 404, err: "Not found" }), {
        status: 404,
      });

    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: mockFetch,
    });

    await assert.rejects(
      async () => client.getFile("nonexistentKey"),
      (err: unknown) => {
        assert(err instanceof FigmaApiError);
        assert.equal(err.code, "NOT_FOUND");
        assert.equal(err.statusCode, 404);
        return true;
      },
    );
  });

  it("handles 429 Rate Limit cleanly", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ status: 429, err: "Rate limited" }), {
        status: 429,
      });

    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: mockFetch,
    });

    await assert.rejects(
      async () => client.getFile("validKey123"),
      (err: unknown) => {
        assert(err instanceof FigmaApiError);
        assert.equal(err.code, "RATE_LIMITED");
        assert.equal(err.statusCode, 429);
        return true;
      },
    );
  });

  it("handles 500 server error cleanly", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response("Internal Server Error", { status: 500 });

    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: mockFetch,
    });

    await assert.rejects(
      async () => client.getFile("validKey123"),
      (err: unknown) => {
        assert(err instanceof FigmaApiError);
        assert.equal(err.code, "API_ERROR");
        assert.equal(err.statusCode, 500);
        return true;
      },
    );
  });
});

describe("FigmaClient — findNodes", () => {
  const dummyToken = "figd_mock_token_12345";

  const mockFileTree = {
    name: "MYCAI — Instagram Introduction Post",
    lastModified: "2026-10-13T10:00:00Z",
    version: "123",
    document: {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [
        {
          id: "0:1",
          name: "Page 1",
          type: "CANVAS",
          children: [
            {
              id: "2:2",
              name: "01 — Instagram Post Artwork (1080 × 1350)",
              type: "FRAME",
              children: [
                {
                  id: "14:8",
                  name: "Headline Text",
                  type: "TEXT",
                  children: [],
                },
                {
                  id: "14:9",
                  name: "Action Button",
                  type: "INSTANCE",
                  children: [
                    {
                      id: "14:10",
                      name: "Button Label",
                      type: "TEXT",
                      children: [],
                    },
                  ],
                },
              ],
            },
            {
              id: "2:3",
              name: "02 — Second Post Artwork",
              type: "FRAME",
              children: [],
            },
          ],
        },
      ],
    },
  };

  it("finds top-level frame using exact match (grounded test fixture)", async () => {
    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: async () =>
        new Response(JSON.stringify(mockFileTree), { status: 200 }),
    });

    const result = await client.findNodes(
      "KDvVPrbgRj7kjZjWqvdjct",
      "01 — Instagram Post Artwork (1080 × 1350)",
      { match: "exact" },
    );

    assert.equal(result.fileKey, "KDvVPrbgRj7kjZjWqvdjct");
    assert.equal(result.totalMatches, 1);
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0]?.id, "2:2");
    assert.equal(result.matches[0]?.type, "FRAME");
    assert.equal(
      result.matches[0]?.name,
      "01 — Instagram Post Artwork (1080 × 1350)",
    );
    assert.equal(result.matches[0]?.pageName, "Page 1");
  });

  it("finds deeply nested node recursively", async () => {
    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: async () =>
        new Response(JSON.stringify(mockFileTree), { status: 200 }),
    });

    const result = await client.findNodes(
      "KDvVPrbgRj7kjZjWqvdjct",
      "Button Label",
      { match: "exact" },
    );

    assert.equal(result.totalMatches, 1);
    assert.equal(result.matches[0]?.id, "14:10");
    assert.equal(result.matches[0]?.type, "TEXT");
    assert.equal(result.matches[0]?.parentId, "14:9");
    assert.deepEqual(result.matches[0]?.path, [
      "Page 1",
      "01 — Instagram Post Artwork (1080 × 1350)",
      "Action Button",
      "Button Label",
    ]);
  });

  it("finds nodes with contains match", async () => {
    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: async () =>
        new Response(JSON.stringify(mockFileTree), { status: 200 }),
    });

    const result = await client.findNodes("KDvVPrbgRj7kjZjWqvdjct", "Artwork", {
      match: "contains",
    });

    assert.equal(result.totalMatches, 2);
    assert.equal(result.matches.length, 2);
    assert.equal(result.matches[0]?.id, "2:2");
    assert.equal(result.matches[1]?.id, "2:3");
  });

  it("returns clean result with ok: true and empty matches when nothing matches", async () => {
    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: async () =>
        new Response(JSON.stringify(mockFileTree), { status: 200 }),
    });

    const result = await client.findNodes(
      "KDvVPrbgRj7kjZjWqvdjct",
      "Nonexistent Layer",
      { match: "exact" },
    );

    assert.equal(result.totalMatches, 0);
    assert.equal(result.matches.length, 0);
    assert.equal(result.truncated, false);
    assert.ok(result.message?.includes("No nodes found"));
  });

  it("handles result truncation when limit is reached", async () => {
    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: async () =>
        new Response(JSON.stringify(mockFileTree), { status: 200 }),
    });

    const result = await client.findNodes("KDvVPrbgRj7kjZjWqvdjct", "Post", {
      match: "contains",
      maxResults: 1,
    });

    assert.equal(result.totalMatches, 2);
    assert.equal(result.matches.length, 1);
    assert.equal(result.truncated, true);
  });

  it("rejects empty search query", async () => {
    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: async () => new Response("{}"),
    });

    await assert.rejects(
      async () => client.findNodes("KDvVPrbgRj7kjZjWqvdjct", "   "),
      (err: unknown) => {
        assert(err instanceof FigmaApiError);
        assert.equal(err.code, "INVALID_INPUT");
        return true;
      },
    );
  });
});

describe("FigmaClient — getNode", () => {
  const dummyToken = "figd_mock_token_12345";

  const mockNodeResponse = {
    name: "MYCAI — Instagram Introduction Post",
    lastModified: "2026-10-13T10:00:00Z",
    nodes: {
      "2:2": {
        document: {
          id: "2:2",
          name: "01 — Instagram Post Artwork (1080 × 1350)",
          type: "FRAME",
          visible: true,
          absoluteBoundingBox: { x: 0, y: 0, width: 1080, height: 1350 },
          layoutMode: "VERTICAL",
          itemSpacing: 24,
          paddingTop: 40,
          paddingBottom: 40,
          fills: [{ type: "SOLID", color: { r: 0.1, g: 0.2, b: 0.3 } }],
          children: [
            {
              id: "14:8",
              name: "Headline Text",
              type: "TEXT",
              characters: "Hello World",
              style: { fontSize: 32, fontFamily: "Inter" },
              children: [],
            },
          ],
        },
      },
    },
  };

  it("retrieves and parses specific frame using GET /v1/files/:key/nodes", async () => {
    let capturedUrl: string | undefined;

    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: async (url) => {
        capturedUrl = String(url);
        return new Response(JSON.stringify(mockNodeResponse), { status: 200 });
      },
    });

    const result = await client.getNode("KDvVPrbgRj7kjZjWqvdjct", "2:2", {
      depth: 2,
    });

    assert.ok(
      capturedUrl?.includes(
        "/files/KDvVPrbgRj7kjZjWqvdjct/nodes?ids=2%3A2&depth=2",
      ),
    );
    assert.equal(result.nodeId, "2:2");
    assert.equal(result.fileName, "MYCAI — Instagram Introduction Post");
    assert.equal(result.node.name, "01 — Instagram Post Artwork (1080 × 1350)");
    assert.equal(result.node.type, "FRAME");
    assert.deepEqual(result.node.box, {
      x: 0,
      y: 0,
      width: 1080,
      height: 1350,
    });
    assert.equal(result.node.layout?.mode, "VERTICAL");
    assert.equal(result.node.layout?.itemSpacing, 24);
    assert.equal(result.node.childrenCount, 1);
    assert.equal(result.node.children?.[0]?.name, "Headline Text");
    assert.equal(result.node.children?.[0]?.text?.characters, "Hello World");
  });

  it("extracts nodeId automatically from URL query if omitted", async () => {
    let capturedUrl: string | undefined;

    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: async (url) => {
        capturedUrl = String(url);
        return new Response(JSON.stringify(mockNodeResponse), { status: 200 });
      },
    });

    const result = await client.getNode(
      "https://www.figma.com/design/KDvVPrbgRj7kjZjWqvdjct/MYCAI-Intro?node-id=2-2",
    );

    assert.ok(capturedUrl?.includes("ids=2%3A2"));
    assert.equal(result.nodeId, "2:2");
  });

  it("throws NOT_FOUND when requested node is missing in response", async () => {
    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: async () =>
        new Response(
          JSON.stringify({ name: "File", nodes: { "99:99": null } }),
          { status: 200 },
        ),
    });

    await assert.rejects(
      async () => client.getNode("KDvVPrbgRj7kjZjWqvdjct", "99:99"),
      (err: unknown) => {
        assert(err instanceof FigmaApiError);
        assert.equal(err.code, "NOT_FOUND");
        assert.equal(err.statusCode, 404);
        return true;
      },
    );
  });

  it("handles 401 Unauthorized securely", async () => {
    const client = new FigmaClient({
      accessToken: dummyToken,
      fetchFn: async () =>
        new Response(JSON.stringify({ status: 401, err: "Invalid token" }), {
          status: 401,
        }),
    });

    await assert.rejects(
      async () => client.getNode("KDvVPrbgRj7kjZjWqvdjct", "2:2"),
      (err: unknown) => {
        assert(err instanceof FigmaApiError);
        assert.equal(err.code, "UNAUTHORIZED");
        assert(!err.message.includes(dummyToken));
        return true;
      },
    );
  });
});

describe("McpServer tool registration & execution", () => {
  it("initializes server with all tools registered", () => {
    const server = createServer();
    assert.ok(server);
    const registered = (
      server as unknown as {
        _registeredTools: Record<
          string,
          { handler: (args: unknown) => Promise<unknown> }
        >;
      }
    )._registeredTools;
    assert.ok(registered["mycai.ping"]);
    assert.ok(registered["figma.get_file"]);
    assert.ok(registered["figma.find_node"]);
    assert.ok(registered["figma.get_node"]);
  });

  it("executes mycai.ping successfully", async () => {
    const server = createServer();
    const registered = (
      server as unknown as {
        _registeredTools: Record<
          string,
          {
            handler: (
              args: unknown,
            ) => Promise<{ content: Array<{ text: string }> }>;
          }
        >;
      }
    )._registeredTools;
    const pingTool = registered["mycai.ping"];
    assert.ok(pingTool);

    const result = await pingTool.handler({ message: "test-echo" });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    assert.equal(parsed.ok, true);
    assert.equal(parsed.message, "test-echo");
    assert.equal(parsed.server, "mycai-design-mcp");
  });

  it("executes figma.find_node tool handler", async () => {
    const mockClient = new FigmaClient({
      accessToken: "mock_token",
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            name: "Doc",
            document: {
              id: "0:0",
              name: "Document",
              type: "DOCUMENT",
              children: [
                {
                  id: "0:1",
                  name: "Page 1",
                  type: "CANVAS",
                  children: [
                    {
                      id: "2:2",
                      name: "01 — Instagram Post Artwork (1080 × 1350)",
                      type: "FRAME",
                      children: [],
                    },
                  ],
                },
              ],
            },
          }),
        ),
    });

    const server = createServer({ figmaClient: mockClient });
    const registered = (
      server as unknown as {
        _registeredTools: Record<
          string,
          {
            handler: (args: unknown) => Promise<{
              content: Array<{ text: string }>;
              isError?: boolean;
            }>;
          }
        >;
      }
    )._registeredTools;
    const findTool = registered["figma.find_node"];
    assert.ok(findTool);

    const result = await findTool.handler({
      fileKey: "KDvVPrbgRj7kjZjWqvdjct",
      name: "Instagram Post",
      match: "contains",
    });

    assert.equal(result.isError, undefined);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    assert.equal(parsed.ok, true);
    assert.equal(parsed.totalMatches, 1);
    assert.equal(parsed.matches[0].id, "2:2");
  });

  it("executes figma.get_node tool handler", async () => {
    const mockClient = new FigmaClient({
      accessToken: "mock_token",
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            name: "Doc",
            nodes: {
              "2:2": {
                document: {
                  id: "2:2",
                  name: "01 — Instagram Post Artwork (1080 × 1350)",
                  type: "FRAME",
                  children: [],
                },
              },
            },
          }),
        ),
    });

    const server = createServer({ figmaClient: mockClient });
    const registered = (
      server as unknown as {
        _registeredTools: Record<
          string,
          {
            handler: (args: unknown) => Promise<{
              content: Array<{ text: string }>;
              isError?: boolean;
            }>;
          }
        >;
      }
    )._registeredTools;
    const getNodeTool = registered["figma.get_node"];
    assert.ok(getNodeTool);

    const result = await getNodeTool.handler({
      fileKey: "KDvVPrbgRj7kjZjWqvdjct",
      nodeId: "2:2",
    });

    assert.equal(result.isError, undefined);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    assert.equal(parsed.ok, true);
    assert.equal(parsed.nodeId, "2:2");
    assert.equal(parsed.node.name, "01 — Instagram Post Artwork (1080 × 1350)");
  });

  it("handles FigmaApiError securely when executing figma.get_node", async () => {
    const mockClient = new FigmaClient({
      accessToken: "mock_token",
      fetchFn: async () => new Response("Forbidden", { status: 403 }),
    });

    const server = createServer({ figmaClient: mockClient });
    const registered = (
      server as unknown as {
        _registeredTools: Record<
          string,
          {
            handler: (args: unknown) => Promise<{
              content: Array<{ text: string }>;
              isError?: boolean;
            }>;
          }
        >;
      }
    )._registeredTools;
    const getNodeTool = registered["figma.get_node"];
    assert.ok(getNodeTool);

    const result = await getNodeTool.handler({
      fileKey: "KDvVPrbgRj7kjZjWqvdjct",
      nodeId: "2:2",
    });

    assert.equal(result.isError, true);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error.code, "FORBIDDEN");
    assert.equal(parsed.error.statusCode, 403);
  });
});
