import type { Request } from "express";

export type ToolRateClass = "read" | "write" | "audit";

const AUDIT_TOOLS = new Set([
  "proton_drive_audit",
  "proton_drive_organize",
]);

const WRITE_TOOLS = new Set([
  "proton_send_email",
  "proton_reply_email",
  "proton_forward_email",
  "proton_move_email",
  "proton_delete_email",
  "proton_flag_email",
  "proton_create_folder",
  "proton_pass_insert",
  "proton_pass_remove",
  "proton_pass_move",
  "proton_pass_copy",
  "proton_pass_generate",
  "proton_drive_upload",
  "proton_drive_download",
  "proton_drive_move",
  "proton_drive_copy",
  "proton_drive_remove",
  "proton_drive_create_folder",
  "proton_drive_share",
  "proton_drive_auth_login",
  "proton_bridge_login",
  "proton_bridge_logout",
  "proton_ecosystem_install",
  "proton_agent_plan",
]);

interface JsonRpcBody {
  method?: unknown;
  params?: unknown;
}

/** Classifies MCP tool calls for tiered HTTP rate limits. Non-tool RPC uses read tier. */
export function getToolRateClass(req: Request): ToolRateClass {
  const body = req.body as JsonRpcBody | null | undefined;
  if (!body || typeof body !== "object" || body.method !== "tools/call") {
    return "read";
  }
  const params = body.params;
  if (!params || typeof params !== "object") return "read";
  const name = (params as { name?: unknown }).name;
  if (typeof name !== "string") return "read";
  if (AUDIT_TOOLS.has(name)) return "audit";
  if (WRITE_TOOLS.has(name)) return "write";
  return "read";
}
