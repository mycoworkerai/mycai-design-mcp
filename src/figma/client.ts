import {
  FigmaApiError,
  type FigmaFileSummary,
  type FigmaFindNodeResult,
  type FigmaGetFileOptions,
  type FigmaGetFileResponse,
  type FigmaGetNodeResult,
  type FigmaGetNodesApiResponse,
  type FigmaMatchedNode,
  type FigmaMatchMode,
  type FigmaNode,
  type FigmaNodeDetail,
  type FigmaNodeLayoutSummary,
  type FigmaNodeTextSummary,
  type FigmaPageSummary,
  type FigmaPaint,
} from "./types.js";

export interface FigmaClientOptions {
  accessToken?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

const FIGMA_FILE_KEY_REGEX = /^[a-zA-Z0-9_-]+$/;
const FIGMA_NODE_ID_REGEX =
  /^I?[a-zA-Z0-9]+:[a-zA-Z0-9]+(;I?[a-zA-Z0-9]+:[a-zA-Z0-9]+)*$/;

/**
 * Validates whether a string matches standard Figma node ID formats.
 */
export function isValidFigmaNodeId(id: string): boolean {
  return FIGMA_NODE_ID_REGEX.test(id.trim());
}

/**
 * Extracts and validates a Figma file key from a direct key or Figma URL.
 */
export function extractFigmaFileKey(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new FigmaApiError("INVALID_INPUT", "Figma file key cannot be empty.");
  }

  // Handle full Figma URLs, e.g.:
  // https://www.figma.com/design/:file_key/:title
  // https://www.figma.com/file/:file_key/:title
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const parsedUrl = new URL(trimmed);
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      const designIndex = segments.findIndex(
        (seg) => seg === "file" || seg === "design" || seg === "proto",
      );
      if (designIndex !== -1 && segments[designIndex + 1]) {
        const key = segments[designIndex + 1];
        if (key && FIGMA_FILE_KEY_REGEX.test(key)) {
          return key;
        }
      }
    }
  } catch {
    // If URL parsing fails, proceed to test as raw file key
  }

  if (FIGMA_FILE_KEY_REGEX.test(trimmed)) {
    return trimmed;
  }

  throw new FigmaApiError(
    "INVALID_INPUT",
    "Invalid Figma file key format. Provide a valid file key (e.g. 'abc123XYZ') or a full Figma file URL.",
  );
}

/**
 * Extracts and normalizes a Figma node ID from a URL query parameter (e.g. ?node-id=14-8 -> "14:8").
 */
export function extractFigmaNodeIdFromUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmed);
    const nodeIdParam = parsedUrl.searchParams.get("node-id");
    if (!nodeIdParam) {
      return null;
    }

    const decoded = decodeURIComponent(nodeIdParam).trim();
    if (!decoded) {
      return null;
    }

    // Convert URL node ID hyphens to colons specifically for node-id parameter
    const normalized = decoded.replace(/-/g, ":");
    if (isValidFigmaNodeId(normalized)) {
      return normalized;
    }

    throw new FigmaApiError(
      "INVALID_INPUT",
      `Invalid 'node-id' query parameter in Figma URL: "${nodeIdParam}". Expected format like "14-8" or "14:8".`,
    );
  } catch (err: unknown) {
    if (err instanceof FigmaApiError) throw err;
    return null;
  }
}

/**
 * Normalizes a Figma node ID, accepting explicit IDs ("2:2"), hyphens ("14-8"), or full URLs.
 */
export function normalizeFigmaNodeId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new FigmaApiError("INVALID_INPUT", "Figma node ID cannot be empty.");
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const fromUrl = extractFigmaNodeIdFromUrl(trimmed);
    if (fromUrl) {
      return fromUrl;
    }
    throw new FigmaApiError(
      "INVALID_INPUT",
      "No valid 'node-id' query parameter found in the provided Figma URL.",
    );
  }

  // Convert digits-digits format copied from URLs (e.g. "14-8" -> "14:8")
  let candidate = trimmed;
  if (/^I?\d+-\d+(;I?\d+-\d+)*$/.test(candidate)) {
    candidate = candidate.replace(/-/g, ":");
  }

  if (isValidFigmaNodeId(candidate)) {
    return candidate;
  }

  throw new FigmaApiError(
    "INVALID_INPUT",
    `Invalid Figma node ID format: "${input}". Expected format like "14:8" or "2:2".`,
  );
}

function formatPaint(paint: FigmaPaint): string | undefined {
  if (paint.visible === false) return undefined;
  if (paint.type === "SOLID" && paint.color) {
    const r = Math.round(paint.color.r * 255);
    const g = Math.round(paint.color.g * 255);
    const b = Math.round(paint.color.b * 255);
    const a = paint.opacity ?? paint.color.a ?? 1;
    if (a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(2))})`;
    }
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return paint.type;
}

function summarizeNode(
  node: FigmaNode,
  currentDepth: number,
  maxDepth: number,
): FigmaNodeDetail {
  const detail: FigmaNodeDetail = {
    id: node.id,
    name: node.name,
    type: node.type,
    childrenCount: node.children?.length ?? 0,
  };

  if (node.visible !== undefined) {
    detail.visible = node.visible;
  }

  if (node.absoluteBoundingBox) {
    detail.box = {
      x: Math.round(node.absoluteBoundingBox.x),
      y: Math.round(node.absoluteBoundingBox.y),
      width: Math.round(node.absoluteBoundingBox.width),
      height: Math.round(node.absoluteBoundingBox.height),
    };
  }

  if (node.layoutMode && node.layoutMode !== "NONE") {
    const layout: FigmaNodeLayoutSummary = {
      mode: node.layoutMode,
    };
    if (node.itemSpacing !== undefined) layout.itemSpacing = node.itemSpacing;
    if (
      node.paddingTop !== undefined ||
      node.paddingRight !== undefined ||
      node.paddingBottom !== undefined ||
      node.paddingLeft !== undefined
    ) {
      const padding: {
        top?: number | undefined;
        right?: number | undefined;
        bottom?: number | undefined;
        left?: number | undefined;
      } = {};
      if (node.paddingTop !== undefined) padding.top = node.paddingTop;
      if (node.paddingRight !== undefined) padding.right = node.paddingRight;
      if (node.paddingBottom !== undefined) padding.bottom = node.paddingBottom;
      if (node.paddingLeft !== undefined) padding.left = node.paddingLeft;
      layout.padding = padding;
    }
    if (node.primaryAxisAlignItems)
      layout.primaryAxisAlignItems = node.primaryAxisAlignItems;
    if (node.counterAxisAlignItems)
      layout.counterAxisAlignItems = node.counterAxisAlignItems;
    detail.layout = layout;
  }

  if (node.type === "TEXT" || node.characters !== undefined) {
    const text: FigmaNodeTextSummary = {
      characters: (node.characters ?? "").slice(0, 500),
    };
    if (node.style?.fontSize !== undefined) text.fontSize = node.style.fontSize;
    if (node.style?.fontWeight !== undefined)
      text.fontWeight = node.style.fontWeight;
    if (node.style?.fontFamily !== undefined)
      text.fontFamily = node.style.fontFamily;
    if (node.style?.textAlignHorizontal !== undefined)
      text.textAlignHorizontal = node.style.textAlignHorizontal;
    if (node.style?.textAlignVertical !== undefined)
      text.textAlignVertical = node.style.textAlignVertical;
    detail.text = text;
  }

  if (Array.isArray(node.fills) && node.fills.length > 0) {
    const fills = node.fills
      .map(formatPaint)
      .filter((f): f is string => Boolean(f));
    if (fills.length > 0) detail.fills = fills;
  }

  if (Array.isArray(node.strokes) && node.strokes.length > 0) {
    const strokes = node.strokes
      .map(formatPaint)
      .filter((s): s is string => Boolean(s));
    if (strokes.length > 0) detail.strokes = strokes;
  }

  if (node.cornerRadius !== undefined) {
    detail.cornerRadius = node.cornerRadius;
  }

  if (node.opacity !== undefined && node.opacity < 1) {
    detail.opacity = Number(node.opacity.toFixed(2));
  }

  if (
    currentDepth < maxDepth &&
    Array.isArray(node.children) &&
    node.children.length > 0
  ) {
    detail.children = node.children.map((child) =>
      summarizeNode(child, currentDepth + 1, maxDepth),
    );
  }

  return detail;
}

export class FigmaClient {
  private readonly accessToken: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: FigmaClientOptions = {}) {
    this.accessToken = options.accessToken ?? process.env.FIGMA_ACCESS_TOKEN;
    this.baseUrl = (options.baseUrl ?? "https://api.figma.com/v1").replace(
      /\/+$/,
      "",
    );
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  /**
   * Fetches the raw Figma file document tree from the REST API.
   */
  public async getFile(
    fileKeyInput: string,
    options: FigmaGetFileOptions = {},
  ): Promise<FigmaGetFileResponse> {
    const fileKey = extractFigmaFileKey(fileKeyInput);

    if (!this.accessToken || !this.accessToken.trim()) {
      throw new FigmaApiError(
        "MISSING_TOKEN",
        "FIGMA_ACCESS_TOKEN environment variable is not configured. Please set FIGMA_ACCESS_TOKEN in your .env file or environment.",
      );
    }

    const url = new URL(`${this.baseUrl}/files/${encodeURIComponent(fileKey)}`);

    if (typeof options.depth === "number" && options.depth > 0) {
      url.searchParams.set("depth", String(options.depth));
    }
    if (options.version) {
      url.searchParams.set("version", options.version);
    }
    if (options.ids && options.ids.length > 0) {
      url.searchParams.set("ids", options.ids.join(","));
    }

    let response: Response;
    try {
      response = await this.fetchFn(url.toString(), {
        method: "GET",
        headers: {
          "X-Figma-Token": this.accessToken,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new FigmaApiError(
          "NETWORK_ERROR",
          `Request to Figma API timed out after ${this.timeoutMs}ms.`,
        );
      }
      throw new FigmaApiError(
        "NETWORK_ERROR",
        "Failed to connect to Figma API due to a network error.",
      );
    }

    if (!response.ok) {
      await this.handleHttpError(response);
    }

    try {
      const data = (await response.json()) as FigmaGetFileResponse;
      return data;
    } catch {
      throw new FigmaApiError(
        "API_ERROR",
        "Failed to parse Figma API response as JSON.",
        response.status,
      );
    }
  }

  /**
   * Fetches and returns a compact, structured summary of a Figma file.
   */
  public async getFileSummary(
    fileKeyInput: string,
    options: FigmaGetFileOptions = {},
  ): Promise<FigmaFileSummary> {
    const fileKey = extractFigmaFileKey(fileKeyInput);
    const data = await this.getFile(fileKey, options);

    const pages: FigmaPageSummary[] = [];
    if (data.document && Array.isArray(data.document.children)) {
      for (const canvas of data.document.children) {
        if (canvas.type === "CANVAS") {
          const children = canvas.children ?? [];
          const topChildren = children.slice(0, 20).map((child) => ({
            id: child.id,
            name: child.name,
            type: child.type,
          }));

          const pageSummary: FigmaPageSummary = {
            id: canvas.id,
            name: canvas.name,
            childrenCount: children.length,
          };

          if (topChildren.length > 0) {
            pageSummary.childrenSummary = topChildren;
          }

          pages.push(pageSummary);
        }
      }
    }

    const summary: FigmaFileSummary = {
      fileKey,
      name: data.name,
      lastModified: data.lastModified,
      version: data.version,
      componentsCount: Object.keys(data.components ?? {}).length,
      componentSetsCount: Object.keys(data.componentSets ?? {}).length,
      stylesCount: Object.keys(data.styles ?? {}).length,
      pages,
    };

    if (data.role) {
      summary.role = data.role;
    }
    if (data.editorType) {
      summary.editorType = data.editorType;
    }
    if (data.thumbnailUrl) {
      summary.thumbnailUrl = data.thumbnailUrl;
    }

    return summary;
  }

  /**
   * Recursively searches for nodes by name across a Figma document.
   */
  public async findNodes(
    fileKeyInput: string,
    nameQuery: string,
    options: {
      match?: FigmaMatchMode | undefined;
      maxResults?: number | undefined;
    } = {},
  ): Promise<FigmaFindNodeResult> {
    const trimmedQuery = nameQuery.trim();
    if (!trimmedQuery) {
      throw new FigmaApiError(
        "INVALID_INPUT",
        "Node search name query cannot be empty.",
      );
    }

    const fileKey = extractFigmaFileKey(fileKeyInput);
    const matchMode = options.match ?? "exact";
    const maxResults = options.maxResults ?? 50;

    // Retrieve document tree
    const data = await this.getFile(fileKey);

    const matches: FigmaMatchedNode[] = [];
    let totalMatches = 0;
    let truncated = false;

    const lowerQuery = trimmedQuery.toLowerCase();

    const walk = (
      node: FigmaNode,
      pageId: string | undefined,
      pageName: string | undefined,
      parentId: string | undefined,
      currentPath: string[],
    ) => {
      const nodeName = node.name.trim();
      const isMatch =
        matchMode === "exact"
          ? nodeName.toLowerCase() === lowerQuery
          : nodeName.toLowerCase().includes(lowerQuery);

      const path = [...currentPath, node.name];

      if (isMatch) {
        totalMatches++;
        if (matches.length < maxResults) {
          const matchItem: FigmaMatchedNode = {
            id: node.id,
            name: node.name,
            type: node.type,
            path,
          };
          if (parentId) matchItem.parentId = parentId;
          if (pageId) matchItem.pageId = pageId;
          if (pageName) matchItem.pageName = pageName;
          matches.push(matchItem);
        } else {
          truncated = true;
        }
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child, pageId, pageName, node.id, path);
        }
      }
    };

    if (data.document && Array.isArray(data.document.children)) {
      for (const canvas of data.document.children) {
        if (canvas.type === "CANVAS") {
          // Check canvas itself if relevant
          const canvasMatch =
            matchMode === "exact"
              ? canvas.name.trim().toLowerCase() === lowerQuery
              : canvas.name.toLowerCase().includes(lowerQuery);

          if (canvasMatch) {
            totalMatches++;
            if (matches.length < maxResults) {
              matches.push({
                id: canvas.id,
                name: canvas.name,
                type: canvas.type,
                pageId: canvas.id,
                pageName: canvas.name,
                path: [canvas.name],
              });
            } else {
              truncated = true;
            }
          }

          // Walk children of canvas
          if (Array.isArray(canvas.children)) {
            for (const child of canvas.children) {
              walk(child, canvas.id, canvas.name, canvas.id, [canvas.name]);
            }
          }
        }
      }
    }

    const result: FigmaFindNodeResult = {
      fileKey,
      query: trimmedQuery,
      match: matchMode,
      totalMatches,
      truncated,
      matches,
    };

    if (totalMatches === 0) {
      result.message = `No nodes found matching "${trimmedQuery}" with match="${matchMode}".`;
    }

    return result;
  }

  /**
   * Retrieves and inspects a specific node from the Figma REST API.
   */
  public async getNode(
    fileKeyInput: string,
    nodeIdInput?: string | undefined,
    options: { depth?: number | undefined } = {},
  ): Promise<FigmaGetNodeResult> {
    const fileKey = extractFigmaFileKey(fileKeyInput);

    let nodeId: string;
    if (nodeIdInput && nodeIdInput.trim()) {
      nodeId = normalizeFigmaNodeId(nodeIdInput);
    } else {
      const fromUrl = extractFigmaNodeIdFromUrl(fileKeyInput);
      if (fromUrl) {
        nodeId = fromUrl;
      } else {
        throw new FigmaApiError(
          "INVALID_INPUT",
          "A Figma node ID is required. Pass 'nodeId' (e.g. '2:2') or provide a Figma URL containing a ?node-id= parameter.",
        );
      }
    }

    if (!this.accessToken || !this.accessToken.trim()) {
      throw new FigmaApiError(
        "MISSING_TOKEN",
        "FIGMA_ACCESS_TOKEN environment variable is not configured. Please set FIGMA_ACCESS_TOKEN in your .env file or environment.",
      );
    }

    const targetDepth = Math.min(Math.max(options.depth ?? 2, 1), 5);
    const url = new URL(
      `${this.baseUrl}/files/${encodeURIComponent(fileKey)}/nodes`,
    );
    url.searchParams.set("ids", nodeId);
    url.searchParams.set("depth", String(targetDepth));

    let response: Response;
    try {
      response = await this.fetchFn(url.toString(), {
        method: "GET",
        headers: {
          "X-Figma-Token": this.accessToken,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new FigmaApiError(
          "NETWORK_ERROR",
          `Request to Figma API timed out after ${this.timeoutMs}ms.`,
        );
      }
      throw new FigmaApiError(
        "NETWORK_ERROR",
        "Failed to connect to Figma API due to a network error.",
      );
    }

    if (!response.ok) {
      await this.handleHttpError(response);
    }

    let data: FigmaGetNodesApiResponse;
    try {
      data = (await response.json()) as FigmaGetNodesApiResponse;
    } catch {
      throw new FigmaApiError(
        "API_ERROR",
        "Failed to parse Figma API response as JSON.",
        response.status,
      );
    }

    const nodeEntry = data.nodes?.[nodeId];
    if (!nodeEntry || !nodeEntry.document) {
      throw new FigmaApiError(
        "NOT_FOUND",
        `Node "${nodeId}" was not found in Figma file "${fileKey}".`,
        404,
      );
    }

    const summarized = summarizeNode(nodeEntry.document, 1, targetDepth);

    const result: FigmaGetNodeResult = {
      fileKey,
      nodeId,
      node: summarized,
    };

    if (data.name) {
      result.fileName = data.name;
    }
    if (data.lastModified) {
      result.lastModified = data.lastModified;
    }

    return result;
  }

  private async handleHttpError(response: Response): Promise<never> {
    const status = response.status;

    if (status === 400) {
      throw new FigmaApiError(
        "INVALID_INPUT",
        "Figma API rejected the request as invalid (HTTP 400).",
        status,
      );
    }
    if (status === 401) {
      throw new FigmaApiError(
        "UNAUTHORIZED",
        "Figma authentication failed (HTTP 401). Verify that your FIGMA_ACCESS_TOKEN is valid.",
        status,
      );
    }
    if (status === 403) {
      throw new FigmaApiError(
        "FORBIDDEN",
        "Access denied (HTTP 403). Your Figma token does not have permission to view this file.",
        status,
      );
    }
    if (status === 404) {
      throw new FigmaApiError(
        "NOT_FOUND",
        "Figma resource not found (HTTP 404). Check that the file key and/or node ID are correct and exist.",
        status,
      );
    }
    if (status === 429) {
      throw new FigmaApiError(
        "RATE_LIMITED",
        "Figma API rate limit exceeded (HTTP 429). Please wait before trying again.",
        status,
      );
    }
    if (status >= 500) {
      throw new FigmaApiError(
        "API_ERROR",
        `Figma API server error (HTTP ${status}). Please retry later.`,
        status,
      );
    }

    throw new FigmaApiError(
      "API_ERROR",
      `Figma API returned an unexpected response (HTTP ${status}).`,
      status,
    );
  }
}
