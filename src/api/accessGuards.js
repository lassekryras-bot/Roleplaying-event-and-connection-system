const FORBIDDEN_ERROR = Object.freeze({
  error: "forbidden",
  code: "FORBIDDEN",
});

function normalizeRole(roleHeaderValue) {
  if (typeof roleHeaderValue !== "string") {
    return null;
  }

  const normalizedRole = roleHeaderValue.trim().toUpperCase();
  return normalizedRole.length > 0 ? normalizedRole : null;
}

function isMembershipActive(membership) {
  return membership && membership.status === "active";
}

export function resolveRequestContext(request, { getProjectMembershipByUserId } = {}) {
  const role = normalizeRole(request.headers["x-role"]);
  const userId = typeof request.headers["x-user-id"] === "string" ? request.headers["x-user-id"].trim() : "";

  return {
    role,
    userId: userId.length > 0 ? userId : null,
    getMembership: (projectId) => {
      if (!projectId || !userId || typeof getProjectMembershipByUserId !== "function") {
        return null;
      }

      return getProjectMembershipByUserId(projectId, userId);
    },
  };
}

export function requireAccess(context, { requiresRole = true, allowRoles = [], projectId = null } = {}) {
  if (requiresRole && !context.role) {
    return { allowed: false, status: 401, payload: { error: "role header is required" } };
  }

  if (allowRoles.length > 0 && !allowRoles.includes(context.role)) {
    return { allowed: false, status: 403, payload: FORBIDDEN_ERROR };
  }

  if (projectId) {
    const membership = context.getMembership(projectId);

    if (!isMembershipActive(membership)) {
      return { allowed: false, status: 403, payload: FORBIDDEN_ERROR };
    }

    if (membership.role !== context.role) {
      return { allowed: false, status: 403, payload: FORBIDDEN_ERROR };
    }
  }

  return { allowed: true };
}

export function forbiddenErrorPayload() {
  return FORBIDDEN_ERROR;
}

export function getWriteEndpoints() {
  return [
    { method: "POST", path: "/projects/:projectId/commands", domain: "campaign commands" },
    { method: "POST", path: "/projects/:projectId/history/undo", domain: "campaign history" },
    { method: "POST", path: "/projects/:projectId/history/redo", domain: "campaign history" },
    { method: "PATCH", path: "/threads/:threadId", domain: "thread updates" },
    { method: "POST", path: "/projects/:projectId/memberships", domain: "memberships" },
    { method: "POST", path: "/projects/:projectId/invites", domain: "invites" },
  ];
}
