# MYCAI Design MCP

An MCP server that will let MYCAI Agents interact with Figma through supported Figma APIs.

> **Status:** Initial setup scaffold. Figma operations are not implemented yet.

## Requirements

- Node.js 22 or newer (use an active LTS release)
- npm 10 or newer

## Quick start

```bash
git clone https://github.com/mycoworkerai/mycai-design-mcp.git
cd mycai-design-mcp
npm install
cp .env.example .env
npm run dev
```

The server listens on `http://localhost:3000` by default.

- Health check: `GET /health`
- MCP endpoint: `POST /mcp`

Use `npm run typecheck`, `npm test`, and `npm run build` before committing.

## Environment

See [`.env.example`](.env.example). Never commit real credentials or access tokens.

## Architecture principles

- MCP is the interface exposed to AI hosts; it does not itself grant Figma access.
- Figma access must use the appropriate official API, credentials, and permissions.
- Read/write capabilities will be implemented only after confirming which operations are supported by the Figma REST API versus the Plugin API.
- The initial `mycai.ping` tool is a scaffold smoke test, not a Figma integration.

## Development scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the TypeScript server with automatic reload |
| `npm run typecheck` | Check TypeScript types without emitting files |
| `npm test` | Run the Node.js built-in test runner |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |

## Security

The MCP endpoint requires `MCP_AUTH_TOKEN` when `NODE_ENV=production`. For local development, authentication is optional. Configure a strong secret in your deployment environment; do not store production secrets in GitHub.

## Official references

- [Node.js documentation](https://nodejs.org/docs/latest/api/)
- [Node.js TypeScript support](https://nodejs.org/api/typescript.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript TSConfig reference](https://www.typescriptlang.org/tsconfig/)
- [MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)
- [Figma Developers](https://developers.figma.com/)
