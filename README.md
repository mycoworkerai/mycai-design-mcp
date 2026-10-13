# MYCAI Design MCP

An MCP (Model Context Protocol) server for agent-driven design workflows, providing secure and controlled access to Figma.

> **Current Phase: Read-Only Figma REST API Integration (File & Node Inspection).**  
> Enables AI agents to inspect file metadata, discover nodes across document trees, and inspect specific frames/nodes via official Figma REST API endpoints. Arbitrary document write/mutation operations are not supported by the REST API and will require a Figma Plugin environment in future phases.

---

## Requirements

- **Node.js**: 22 or newer (Node 22+ native `.env` loading and ES modules supported)
- **npm**: 10 or newer
- **Git**
- **Figma Account & Personal Access Token (PAT)**

---

## Quick Start & Installation

```bash
# 1. Clone the repository
git clone https://github.com/mycoworkerai/mycai-design-mcp.git
cd mycai-design-mcp

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and paste your FIGMA_ACCESS_TOKEN

# 4. Run development mode with automatic reload
npm run dev
```

---

## Environment Configuration

Create a `.env` file in the project root:

```env
# Server
NODE_ENV=development
PORT=3000

# Figma Credentials
# Generate at: Figma Account Settings -> Security -> Personal access tokens
FIGMA_ACCESS_TOKEN=figd_your_personal_access_token_here
```

> **Security Note:**  
> The `.env` file is excluded from Git via `.gitignore`. Never commit tokens, paste them into issues, or expose them in chat. The server never logs or transmits credentials to any endpoint other than official Figma API endpoints (`https://api.figma.com/v1`).

---

## Scripts

| Command             | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Run server with hot reload using `tsx`             |
| `npm run build`     | Compile TypeScript into `dist/`                    |
| `npm start`         | Run compiled production server                     |
| `npm run typecheck` | Type-check without emitting files (`tsc --noEmit`) |
| `npm test`          | Run automated test suite (`tsx --test`)            |

---

## Key Concepts: File Keys vs. Node IDs

In Figma:

- **File Key**: The unique identifier for a file document (e.g. `KDvVPrbgRj7kjZjWqvdjct` from `https://www.figma.com/design/KDvVPrbgRj7kjZjWqvdjct/MYCAI-Introduction`).
- **Node ID**: The unique identifier for an element inside a document (e.g. `2:2` or `14:8`).
- **Figma URLs with `node-id`**: In Figma URLs, colons are encoded as hyphens in the `node-id` query parameter (e.g. `?node-id=14-8` corresponds to node ID `14:8`). The server automatically extracts and normalizes this parameter when passing URLs to `figma.get_node`.

---

## Available MCP Tools

### 1. `mycai.ping`

A diagnostic smoke test tool confirming that the server is alive and responding.

- **Inputs:**
  - `message` (string, optional): Echo text (defaults to `"pong"`).
- **Example Call:**
  ```json
  {
    "message": "hello"
  }
  ```
- **Example Response:**
  ```json
  {
    "ok": true,
    "server": "mycai-design-mcp",
    "message": "hello"
  }
  ```

---

### 2. `figma.get_file`

Fetches high-level metadata, component/style counts, and a structured summary of canvas pages and top-level frames.

- **Endpoint**: `GET /v1/files/:file_key`
- **Inputs:**
  - `fileKey` (string, required): Figma file key or full Figma URL (e.g. `KDvVPrbgRj7kjZjWqvdjct` or `https://www.figma.com/design/KDvVPrbgRj7kjZjWqvdjct/MYCAI-Introduction`).
  - `depth` (number, optional): Document tree traversal depth (defaults to `2`, retrieving canvases and top-level frames).
- **Example Call:**
  ```json
  {
    "fileKey": "KDvVPrbgRj7kjZjWqvdjct",
    "depth": 2
  }
  ```
- **Example Response:**
  ```json
  {
    "ok": true,
    "file": {
      "fileKey": "KDvVPrbgRj7kjZjWqvdjct",
      "name": "MYCAI — Instagram Introduction Post",
      "lastModified": "2026-10-13T10:00:00Z",
      "version": "12345678",
      "role": "viewer",
      "editorType": "figma",
      "componentsCount": 4,
      "componentSetsCount": 1,
      "stylesCount": 3,
      "pages": [
        {
          "id": "0:1",
          "name": "Page 1",
          "childrenCount": 2,
          "childrenSummary": [
            {
              "id": "2:2",
              "name": "01 — Instagram Post Artwork (1080 × 1350)",
              "type": "FRAME"
            }
          ]
        }
      ]
    }
  }
  ```

---

### 3. `figma.find_node`

Discovers nodes by name within a Figma file using recursive tree traversal across all canvas pages and nested descendants.

- **Endpoint**: `GET /v1/files/:file_key` (searches the document hierarchy)
- **Inputs:**
  - `fileKey` (string, required): Figma file key or full Figma file URL.
  - `name` (string, required): Node name to search for (e.g. `"01 — Instagram Post Artwork (1080 × 1350)"`).
  - `match` (string, optional): Matching mode: `"exact"` (default, case-insensitive full match) or `"contains"` (case-insensitive substring match).
- **Example Call:**
  ```json
  {
    "fileKey": "KDvVPrbgRj7kjZjWqvdjct",
    "name": "01 — Instagram Post Artwork (1080 × 1350)",
    "match": "exact"
  }
  ```
- **Example Response:**
  ```json
  {
    "ok": true,
    "fileKey": "KDvVPrbgRj7kjZjWqvdjct",
    "query": "01 — Instagram Post Artwork (1080 × 1350)",
    "match": "exact",
    "totalMatches": 1,
    "truncated": false,
    "matches": [
      {
        "id": "2:2",
        "name": "01 — Instagram Post Artwork (1080 × 1350)",
        "type": "FRAME",
        "pageId": "0:1",
        "pageName": "Page 1",
        "path": ["Page 1", "01 — Instagram Post Artwork (1080 × 1350)"]
      }
    ]
  }
  ```
- **Nested Traversal & Limitations**:
  - Traversal inspects the entire document tree recursively down to leaf nodes (TEXT, RECTANGLE, VECTOR, INSTANCE).
  - Safety limit: Returns up to 50 matches per query. When more matches exist, `truncated` is set to `true`.
  - For files exceeding Figma's single-response payload limit, consider searching within specific pages or frames once identified.

---

### 4. `figma.get_node`

Retrieves and inspects a specific Figma node (properties, layout, text styles, geometry bounding box, fills, strokes, and child descendants) without loading the entire document.

- **Endpoint**: `GET /v1/files/:file_key/nodes?ids=:node_id&depth=:depth`
- **Inputs:**
  - `fileKey` (string, required): Figma file key or full Figma URL. If the URL contains `?node-id=...`, `nodeId` is automatically extracted if not explicitly supplied.
  - `nodeId` (string, optional): Node ID (e.g. `"2:2"` or `"14:8"`). Hyphen format (e.g. `"14-8"`) is automatically converted to colon format (`"14:8"`).
  - `depth` (number, optional): Descendant tree depth to inspect (1 to 5, defaults to `2`).
- **Example Call:**
  ```json
  {
    "fileKey": "KDvVPrbgRj7kjZjWqvdjct",
    "nodeId": "2:2",
    "depth": 2
  }
  ```
- **Example Call with URL Parameter:**
  ```json
  {
    "fileKey": "https://www.figma.com/design/KDvVPrbgRj7kjZjWqvdjct/MYCAI-Introduction?node-id=2-2",
    "depth": 2
  }
  ```
- **Example Response:**
  ```json
  {
    "ok": true,
    "fileKey": "KDvVPrbgRj7kjZjWqvdjct",
    "nodeId": "2:2",
    "fileName": "MYCAI — Instagram Introduction Post",
    "lastModified": "2026-10-13T10:00:00Z",
    "node": {
      "id": "2:2",
      "name": "01 — Instagram Post Artwork (1080 × 1350)",
      "type": "FRAME",
      "visible": true,
      "box": {
        "x": 0,
        "y": 0,
        "width": 1080,
        "height": 1350
      },
      "layout": {
        "mode": "VERTICAL",
        "itemSpacing": 24,
        "padding": {
          "top": 40,
          "bottom": 40
        }
      },
      "fills": ["#1a202c"],
      "childrenCount": 4,
      "children": [
        {
          "id": "14:8",
          "name": "Headline Text",
          "type": "TEXT",
          "text": {
            "characters": "Transform your workflow",
            "fontSize": 32,
            "fontFamily": "Inter"
          },
          "childrenCount": 0
        }
      ]
    }
  }
  ```

---

## Testing with MCP Inspector

You can test all tools locally using the official Model Context Protocol Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Or in development mode:

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

In the MCP Inspector UI:

1. Connect via **stdio** transport.
2. Select **Tools** -> **List Tools**. Verify `mycai.ping`, `figma.get_file`, `figma.find_node`, and `figma.get_node` are present.
3. Test `mycai.ping` with `{ "message": "hello" }`.
4. Test `figma.find_node` with a file key and name query.
5. Test `figma.get_node` with a file key and node ID or Figma URL.

---

## REST API vs. Plugin API Boundary

| API                  | Transport                      | Current Capabilities                                                                                                   | Future Write Support                                                                                        |
| -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Figma REST API**   | HTTPS / REST (`api.figma.com`) | Read-only inspection: file summaries, node discovery (`find_node`), node details (`get_node`), styles, and components. | REST API does not support document tree mutations (adding frames, editing shapes, modifying vector points). |
| **Figma Plugin API** | Execution inside Figma Client  | Not available over HTTP without a dedicated bridge.                                                                    | Required for document mutations, generative design editing, and interactive canvas manipulations.           |

> **Important:** The current phase is strictly read-only. No simulated write operations or unsupported REST mutations are exposed.

---

## Figma Token Permissions & Troubleshooting

### Token Permissions (PAT Scopes)

- **File content**: `file:read` (required to read files and nodes)

### Troubleshooting Common Errors

| Error Code      | HTTP Status | Probable Cause                          | Action                                                     |
| --------------- | ----------- | --------------------------------------- | ---------------------------------------------------------- |
| `MISSING_TOKEN` | -           | `FIGMA_ACCESS_TOKEN` is unset in `.env` | Add `FIGMA_ACCESS_TOKEN` to `.env`                         |
| `INVALID_INPUT` | 400         | Malformed file key, node ID, or query   | Ensure file key and node ID match expected formats         |
| `UNAUTHORIZED`  | 401         | Invalid or revoked PAT                  | Regenerate PAT in Figma Account Settings and update `.env` |
| `FORBIDDEN`     | 403         | Token lacks permissions for file        | Ensure the account has viewer/editor access to the file    |
| `NOT_FOUND`     | 404         | File or node not found                  | Verify file key and node ID (e.g. check `figma.find_node`) |
| `RATE_LIMITED`  | 429         | Figma API rate limit reached            | Wait 1-2 minutes before retrying requests                  |
| `NETWORK_ERROR` | -           | Network connection failed or timed out  | Check internet connection or Figma service status          |

---

## Architecture

- **`src/index.ts`**: MCP server initialization, tool registration (`mycai.ping`, `figma.get_file`, `figma.find_node`, `figma.get_node`), and sanitized error formatting.
- **`src/figma/client.ts`**: Authenticated HTTP client, URL parser, node ID normalizer, recursive tree search (`findNodes`), and specific node inspection (`getNode`).
- **`src/figma/types.ts`**: TypeScript definitions for Figma REST payloads, error classes, bounding boxes, text styles, and summary models.
- **`tests/figma.test.ts`**: Automated test suite with 36 tests covering URL parsing, mock responses, edge cases, rate limits, and MCP handlers.

---

## License

MIT
