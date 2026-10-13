import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "mycai-design-mcp",
  version: "0.1.0",
});

server.tool(
  "mycai.ping",
  "Check that the MYCAI Design MCP server is running.",
  {
    message: z.string().optional().describe("Optional message to echo back."),
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

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Failed to start MYCAI Design MCP:", error);
  process.exitCode = 1;
});
