# Render deployment

The project supports two transports:

- **STDIO** for local MCP clients: `npm start`
- **Streamable HTTP** for remote MCP clients: `npm run start:http`

## Render Web Service

Create a Web Service from this repository and branch `feat/render-streamable-http` while validating the first deployment.

- Runtime: Node
- Region: choose the region closest to your users
- Build command: `npm ci && npm run build`
- Start command: `npm run start:http`
- Health check path: `/health`
- Node version: 22 or newer

Set these environment variables in the Render dashboard. Never commit real values to Git.

- `FIGMA_ACCESS_TOKEN`: a valid Figma personal access token with only the required file-read scope.
- `MCP_AUTH_TOKEN`: a random secret with at least 32 characters. The client must send it as `Authorization: Bearer <secret>`.
- `NODE_ENV=production` (optional; Render sets `PORT` automatically).

Generate a secret locally with a password manager or a cryptographically secure generator, for example:
```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```
Do not paste the secret or Figma token into source control, issues, or chat.

## Endpoint

After deployment, configure the MCP client to use:

`https://<your-render-service>.onrender.com/mcp`

Use the bearer token as the authorization credential if the client supports custom HTTP headers. The `/health` endpoint is public and returns only service liveness; it does not expose Figma data.

## Smoke test

1. Open `https://<your-render-service>.onrender.com/health` and confirm `{"ok":true,"service":"mycai-design-mcp"}`.
2. Send an MCP request to `/mcp` with `Authorization: Bearer <MCP_AUTH_TOKEN>`.
3. List tools and verify `mycai.ping`, `figma.get_file`, `figma.find_node`, and `figma.get_node`.
4. Test `mycai.ping`, then call a read-only Figma tool with a file you can access.
5. Confirm requests without the bearer token receive HTTP 401.

## Security and scope

This deployment exposes a public network endpoint protected by a shared bearer secret. Anyone holding that secret can invoke the available tools using the configured Figma account's permissions. Rotate the secret if it is exposed, and use a dedicated Figma token with minimum required permissions. This initial deployment is read-only and does not support Figma document mutations.
