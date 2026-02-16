import express from "express";
import http from "http";
import cors from "cors";
import { nanoid } from "nanoid";

import { initDb, pool } from "./db.js";
import { signToken, requireAuth } from "./auth.js";
import { requireRole } from "./rbac.js";
import { attachSocket } from "./socket.js";
import { exportCsv, exportPdf } from "./export.js";
import { MEETING_FLOW } from "./agenda.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

await initDb();

app.get("/health", (_, res) => res.json({ ok: true }));

// 1) Login (Demo) — replace with school SSO in production
app.post("/api/auth/login", (req, res) => {
  const { schoolId, userId, name, role } = req.body || {};
  if (!schoolId || !userId || !name || !role)
    return res.status(400).json({ error: "missing fields" });
  const token = signToken({ schoolId, userId, name, role });
  res.json({ token });
});

// 2) Create meeting
app.post("/api/meetings", requireAuth, requireRole("host"), async (req, res) => {
  const u = req.user;
  const id = nanoid(8);
  const ts = Date.now();
  const title = req.body?.title || `Meeting ${id}`;

  await pool.query(
    `INSERT INTO meetings (id, school_id, title, status, created_at, updated_at)
     VALUES ($1,$2,$3,'DRAFT',$4,$5)`,
    [id, u.schoolId, title, ts, ts]
  );
  res.json({ meetingId: id, title });
});

// 3) Meeting flow (agenda steps 1-9)
app.get("/api/meeting_flow", requireAuth, (req, res) => {
  res.json({ flow: MEETING_FLOW });
});

// 4) Export CSV
app.get("/api/meetings/:id/export.csv", requireAuth, async (req, res) => {
  const u = req.user;
  const meetingId = req.params.id;
  const csv = await exportCsv(meetingId, u.schoolId);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="meeting_${meetingId}.csv"`);
  res.send(csv);
});

// 5) Export PDF
app.get("/api/meetings/:id/export.pdf", requireAuth, async (req, res) => {
  const u = req.user;
  const meetingId = req.params.id;
  await exportPdf(res, meetingId, u.schoolId);
});

const server = http.createServer(app);
attachSocket(server, process.env.CORS_ORIGIN || "*");

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server on http://localhost:${process.env.PORT || 3000}`);
});
