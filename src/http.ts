import { createServer as createHttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer } from "./index.js";

const MAX_BODY_BYTES = 1_000_000;
const MCP_PATH = "/mcp";

function authorized(authorization: string | undefined, expectedToken: string): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function readBody(req: AsyncIterable<Buffer | string>): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function serveHttp(): void {
  const port = Number(process.env.PORT ?? 3000);
  const authToken = process.env.MCP_AUTH_TOKEN;

  if (!authToken || authToken.length < 32) {
    console.error("MCP_AUTH_TOKEN must be configured and contain at least 32 characters.");
    process.exitCode = 1;
    return;
  }

  const handler = createMcpHandler(() => createServer());

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: true, service: "mycai-design-mcp" }));
      return;
    }

    if (url.pathname !== MCP_PATH) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }

    if (!authorized(req.headers.authorization, authToken)) {
      res.writeHead(401, {
        "content-type": "application/json",
        "www-authenticate": "Bearer",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }

    try {
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers as HeadersInit,
        ...(body !== undefined && body.length > 0 ? { body } : {}),
      });
      const response = await handler.fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      if (!response.body) {
        res.end();
        return;
      }
      for await (const chunk of response.body) {
        if (!res.write(Buffer.from(chunk))) {
          await new Promise<void>((resolve) => res.once("drain", resolve));
        }
      }
      res.end();
    } catch (error) {
      const message = error instanceof Error && error.message === "Request body too large"
        ? "Request body too large"
        : "Internal server error";
      const status = message === "Request body too large" ? 413 : 500;
      if (!res.headersSent) {
        res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify({ ok: false, error: message }));
      } else {
        res.destroy();
      }
      if (status === 500) console.error("MCP HTTP request failed.");
    }
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.error(`MYCAI Design MCP listening on port ${port} at ${MCP_PATH} (Streamable HTTP).`);
  });
}
