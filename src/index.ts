import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

function createServer(): McpServer {
  const server = new McpServer({
    name: "mycai-design-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "mycai.ping",
    {
      description: "Check that the MYCAI Design MCP server is running.",
      inputSchema: {
        message: z.string().optional().describe("Optional message to echo back."),
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

  return server;
}

void serveStdio(createServer);
console.error("MYCAI Design MCP running over stdio.");
