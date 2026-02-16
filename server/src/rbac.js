export const ROLES = ["viewer", "member", "host", "admin"];

export function can(userRole, needRole) {
  const order = { viewer: 0, member: 1, host: 2, admin: 3 };
  return (order[userRole] ?? 0) >= (order[needRole] ?? 0);
}

export function requireRole(needRole) {
  return (req, res, next) => {
    if (!can(req.user?.role, needRole)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
