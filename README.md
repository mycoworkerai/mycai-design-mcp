# MYCAI Design MCP

An MCP server for agent-driven design workflows, starting with Figma integration.

> **Status:** Initial setup template. Figma tools are not implemented yet.

## Requirements

- Node.js 22 or newer
- npm
- Git

## Quick start

```bash
git clone https://github.com/mycoworkerai/mycai-design-mcp.git
cd mycai-design-mcp
npm install
npm run dev
```

The starter uses MCP's **stdio transport** and is launched by an MCP-compatible host. It is not a standalone HTTP service yet.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run with automatic reload |
| `npm run typecheck` | Type-check without emitting files |
| `npm run build` | Compile TypeScript into `dist/` |
| `npm start` | Run the compiled server |

## Initial tool

- `mycai.ping` — smoke test confirming the MCP server is running.

## Architecture direction

The server will expose tools that let MYCAI Agents interact with Figma through supported APIs. Before implementing CRUD tools, we will verify each operation against official Figma documentation and distinguish between:

- **Figma REST API:** file and resource operations exposed over HTTP.
- **Figma Plugin API:** document mutations that may require code running inside Figma's plugin environment.

Do not assume full CRUD support for every Figma resource.

## Development principles

- TypeScript strict mode.
- Runtime validation for MCP tool inputs using Zod.
- Keep tool handlers small and isolate Figma API logic in an adapter.
- Never log access tokens.
- Require explicit authorization before destructive operations.

## Official documentation

- [Node.js documentation](https://nodejs.org/docs/latest/api/)
- [Node.js TypeScript support](https://nodejs.org/api/typescript.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript TSConfig reference](https://www.typescriptlang.org/tsconfig/)
- [Official MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)
- [Figma Developers](https://developers.figma.com/)
