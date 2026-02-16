import crypto from "crypto";
import { nanoid } from "nanoid";
import { pool } from "./db.js";

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function appendAudit({
  meetingId, schoolId, ts, actorId, actorName,
  action, entityType, entityId, payload
}) {
  // Get previous hash (same meeting) for hash chain
  const prev = await pool.query(
    `SELECT hash FROM audit_log WHERE meeting_id=$1 AND school_id=$2 ORDER BY ts DESC LIMIT 1`,
    [meetingId, schoolId]
  );
  const prevHash = prev.rows[0]?.hash || null;

  const body = JSON.stringify({ meetingId, schoolId, ts, actorId, actorName, action, entityType, entityId, payload, prevHash });
  const hash = sha256(body);

  const id = nanoid(12);
  await pool.query(
    `INSERT INTO audit_log (id, meeting_id, school_id, ts, actor_id, actor_name, action, entity_type, entity_id, payload, prev_hash, hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, meetingId, schoolId, ts, actorId, actorName, action, entityType, entityId, payload, prevHash, hash]
  );

  return { id, prevHash, hash };
}
