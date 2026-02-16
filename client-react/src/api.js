const API = import.meta.env.VITE_API_BASE || "http://localhost:3000";

export async function login({ schoolId, userId, name, role }) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolId, userId, name, role })
  });
  if (!r.ok) throw new Error("login failed");
  return r.json();
}

export async function createMeeting(token, title) {
  const r = await fetch(`${API}/api/meetings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title })
  });
  if (!r.ok) throw new Error("create meeting failed");
  return r.json();
}

export function exportCsvUrl(meetingId) { return `${API}/api/meetings/${meetingId}/export.csv`; }
export function exportPdfUrl(meetingId) { return `${API}/api/meetings/${meetingId}/export.pdf`; }
export const API_BASE = API;
