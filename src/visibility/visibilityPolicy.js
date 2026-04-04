import { MembershipRole } from "../domain/entities.js";

const ROLE_FIELD_ALLOWLIST = Object.freeze({
  [MembershipRole.GM]: new Set(["gm_truth", "player_summary"]),
  [MembershipRole.HELPER_GM]: new Set(["gm_truth", "player_summary"]),
  [MembershipRole.PLAYER]: new Set(["player_summary"]),
});

function sanitizeObjectForRole(payload, allowedFields) {
  const sanitized = {};

  for (const [key, value] of Object.entries(payload)) {
    if ((key === "gm_truth" || key === "player_summary") && !allowedFields.has(key)) {
      continue;
    }

    sanitized[key] = sanitizeVisibilityPayloadForRole(value, allowedFields);
  }

  return sanitized;
}

export function sanitizeVisibilityPayloadForRole(payload, role) {
  const allowedFields = role instanceof Set ? role : ROLE_FIELD_ALLOWLIST[role];

  if (!allowedFields) {
    throw new Error(`Unsupported role: ${role}`);
  }

  if (Array.isArray(payload)) {
    return payload.map((entry) => sanitizeVisibilityPayloadForRole(entry, allowedFields));
  }

  if (payload && typeof payload === "object") {
    return sanitizeObjectForRole(payload, allowedFields);
  }

  return payload;
}
