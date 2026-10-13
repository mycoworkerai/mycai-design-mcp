/**
 * Types for Figma REST API and MYCAI Figma Client.
 */

export interface FigmaBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number | undefined;
}

export interface FigmaPaint {
  type: string;
  visible?: boolean | undefined;
  opacity?: number | undefined;
  color?: FigmaColor | undefined;
}

export interface FigmaTypeStyle {
  fontFamily?: string | undefined;
  fontWeight?: number | string | undefined;
  fontSize?: number | undefined;
  textAlignHorizontal?: string | undefined;
  textAlignVertical?: string | undefined;
  letterSpacing?: number | undefined;
  lineHeightPx?: number | undefined;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean | undefined;
  children?: FigmaNode[] | undefined;
  absoluteBoundingBox?: FigmaBoundingBox | undefined;
  size?: { x: number; y: number } | undefined;
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL" | undefined;
  itemSpacing?: number | undefined;
  paddingLeft?: number | undefined;
  paddingRight?: number | undefined;
  paddingTop?: number | undefined;
  paddingBottom?: number | undefined;
  primaryAxisAlignItems?: string | undefined;
  counterAxisAlignItems?: string | undefined;
  characters?: string | undefined;
  style?: FigmaTypeStyle | undefined;
  fills?: FigmaPaint[] | undefined;
  strokes?: FigmaPaint[] | undefined;
  cornerRadius?: number | undefined;
  opacity?: number | undefined;
}

export interface FigmaGetFileResponse {
  name: string;
  role?: string | undefined;
  lastModified: string;
  editorType?: string | undefined;
  thumbnailUrl?: string | undefined;
  version: string;
  document: FigmaNode;
  components?: Record<string, unknown> | undefined;
  componentSets?: Record<string, unknown> | undefined;
  schemaVersion?: number | undefined;
  styles?: Record<string, unknown> | undefined;
}

export interface FigmaGetFileOptions {
  depth?: number | undefined;
  version?: string | undefined;
  ids?: string[] | undefined;
}

export interface FigmaPageSummary {
  id: string;
  name: string;
  childrenCount: number;
  childrenSummary?:
    | Array<{
        id: string;
        name: string;
        type: string;
      }>
    | undefined;
}

export interface FigmaFileSummary {
  fileKey: string;
  name: string;
  lastModified: string;
  version: string;
  role?: string | undefined;
  editorType?: string | undefined;
  thumbnailUrl?: string | undefined;
  componentsCount: number;
  componentSetsCount: number;
  stylesCount: number;
  pages: FigmaPageSummary[];
}

export type FigmaMatchMode = "exact" | "contains";

export interface FigmaMatchedNode {
  id: string;
  name: string;
  type: string;
  parentId?: string | undefined;
  pageId?: string | undefined;
  pageName?: string | undefined;
  path: string[];
}

export interface FigmaFindNodeResult {
  fileKey: string;
  query: string;
  match: FigmaMatchMode;
  totalMatches: number;
  truncated: boolean;
  matches: FigmaMatchedNode[];
  message?: string | undefined;
}

export interface FigmaGetNodesApiResponse {
  name: string;
  role?: string | undefined;
  lastModified: string;
  editorType?: string | undefined;
  err?: string | null | undefined;
  nodes: Record<
    string,
    | {
        document: FigmaNode;
        components?: Record<string, unknown> | undefined;
        schemaVersion?: number | undefined;
        styles?: Record<string, unknown> | undefined;
      }
    | null
    | undefined
  >;
}

export interface FigmaNodeLayoutSummary {
  mode: "NONE" | "HORIZONTAL" | "VERTICAL";
  itemSpacing?: number | undefined;
  padding?:
    | {
        top?: number | undefined;
        right?: number | undefined;
        bottom?: number | undefined;
        left?: number | undefined;
      }
    | undefined;
  primaryAxisAlignItems?: string | undefined;
  counterAxisAlignItems?: string | undefined;
}

export interface FigmaNodeTextSummary {
  characters: string;
  fontSize?: number | undefined;
  fontWeight?: number | string | undefined;
  fontFamily?: string | undefined;
  textAlignHorizontal?: string | undefined;
  textAlignVertical?: string | undefined;
}

export interface FigmaNodeDetail {
  id: string;
  name: string;
  type: string;
  visible?: boolean | undefined;
  box?: FigmaBoundingBox | undefined;
  layout?: FigmaNodeLayoutSummary | undefined;
  text?: FigmaNodeTextSummary | undefined;
  fills?: string[] | undefined;
  strokes?: string[] | undefined;
  cornerRadius?: number | undefined;
  opacity?: number | undefined;
  childrenCount: number;
  children?: FigmaNodeDetail[] | undefined;
}

export interface FigmaGetNodeResult {
  fileKey: string;
  nodeId: string;
  fileName?: string | undefined;
  lastModified?: string | undefined;
  node: FigmaNodeDetail;
}

export type FigmaErrorCode =
  | "MISSING_TOKEN"
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "API_ERROR"
  | "NETWORK_ERROR";

export class FigmaApiError extends Error {
  public readonly code: FigmaErrorCode;
  public readonly statusCode?: number | undefined;

  constructor(
    code: FigmaErrorCode,
    message: string,
    statusCode?: number | undefined,
  ) {
    super(message);
    this.name = "FigmaApiError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, FigmaApiError.prototype);
  }
}
