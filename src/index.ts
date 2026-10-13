try {
  process.loadEnvFile?.();
} catch {
  // Ignore if .env is missing or not accessible
}

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import { FigmaClient } from "./figma/client.js";
import { FigmaApiError } from "./figma/types.js";

export interface CreateServerOptions {
  figmaClient?: FigmaClient;
}

function handleToolError(err: unknown) {
  if (err instanceof FigmaApiError) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              ok: false,
              error: {
                code: err.code,
                message: err.message,
                ...(err.statusCode ? { statusCode: err.statusCode } : {}),
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            ok: false,
            error: {
              code: "UNEXPECTED_ERROR",
              message:
                "An unexpected error occurred while communicating with Figma API.",
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  const server = new McpServer({
    name: "mycai-design-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "mycai.ping",
    {
      description: "Check that the MYCAI Design MCP server is running.",
      inputSchema: {
        message: z
          .string()
          .optional()
          .describe("Optional message to echo back."),
      },
    },
    async ({ message }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            server: "mycai-design-mcp",
            message: message ?? "pong",
          }),
        },
      ],
    }),
  );

  server.registerTool(
    "figma.get_file",
    {
      description:
        "Retrieve metadata and a compact structured summary of a Figma design file via official Figma REST API.",
      inputSchema: {
        fileKey: z
          .string()
          .min(1)
          .describe(
            "Figma file key or full file URL (e.g. 'abc123XYZ' or 'https://www.figma.com/design/abc123XYZ/My-Design').",
          ),
        depth: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Document tree traversal depth (passed to Figma REST API). Defaults to 2 (canvases and top-level frames).",
          ),
      },
    },
    async ({ fileKey, depth }) => {
      try {
        const client = options.figmaClient ?? new FigmaClient();
        const summary = await client.getFileSummary(fileKey, {
          depth: depth ?? 2,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  file: summary,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "figma.find_node",
    {
      description:
        "Discover nodes by name across a Figma document tree using exact or partial matching.",
      inputSchema: {
        fileKey: z
          .string()
          .min(1)
          .describe(
            "Figma file key or full Figma file URL (e.g. 'abc123XYZ' or 'https://www.figma.com/design/abc123XYZ/My-Design').",
          ),
        name: z
          .string()
          .min(1)
          .describe(
            "Node name to search for (e.g. '01 — Instagram Post Artwork (1080 × 1350)').",
          ),
        match: z
          .enum(["exact", "contains"])
          .optional()
          .describe(
            "Matching mode: 'exact' (default, case-insensitive full match) or 'contains' (case-insensitive substring match).",
          ),
      },
    },
    async ({ fileKey, name, match }) => {
      try {
        const client = options.figmaClient ?? new FigmaClient();
        const result = await client.findNodes(fileKey, name, {
          match: match ?? "exact",
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  ...result,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "figma.get_node",
    {
      description:
        "Retrieve and inspect a specific Figma node (properties, layout, text, geometry, descendants) via GET /v1/files/:key/nodes.",
      inputSchema: {
        fileKey: z
          .string()
          .min(1)
          .describe(
            "Figma file key or full Figma URL (e.g. 'abc123XYZ' or 'https://www.figma.com/design/abc123XYZ/My-Design?node-id=14-8').",
          ),
        nodeId: z
          .string()
          .optional()
          .describe(
            "Figma node ID (e.g. '2:2' or '14:8'). If omitted, it will be extracted from '?node-id=' parameter in fileKey URL.",
          ),
        depth: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("Descendant tree depth to retrieve (1-5, defaults to 2)."),
      },
    },
    async ({ fileKey, nodeId, depth }) => {
      try {
        const client = options.figmaClient ?? new FigmaClient();
        const result = await client.getNode(fileKey, nodeId, {
          depth: depth ?? 2,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  ...result,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        return handleToolError(err);
      }
    },
  );

  return server;
}

// Start stdio transport only when executed directly
if (
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js")
) {
  void serveStdio(() => createServer());
  console.error("MYCAI Design MCP running over stdio.");
}
