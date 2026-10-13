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
cp .env.example .env
npm run dev
```

This starter currently uses MCP's **stdio transport**. It is launched by an MCP-compatible host; it does not run as a standalone HTTP service yet.

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

## Environment

Copy `.env.example` to `.env`. Never commit access tokens or production secrets. The environment file is a placeholder until the Figma authentication strategy is decided.

## Development principles

- TypeScript strict mode.
- Validate tool inputs at runtime.
- Keep tool handlers small and isolate Figma API logic in an adapter.
- Never log access tokens.
- Require explicit authorization before destructive operations.

## Official documentation

- [Node.js documentation](https://nodejs.org/docs/latest/api/)
- [Node.js TypeScript support](https://nodejs.org/api/typescript.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript TSConfig reference](https://www.typescriptlang.org/tsconfig/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Figma Developers](https://developers.figma.com/)
