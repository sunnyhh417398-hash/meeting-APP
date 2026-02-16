import { Server } from "socket.io";
import { verifyToken } from "./auth.js";
import { can } from "./rbac.js";
import { nanoid } from "nanoid";
import { pool } from "./db.js";
import { appendAudit } from "./audit.js";
import { getSnapshot, setSnapshot } from "./store.js";

export function attachSocket(httpServer, corsOrigin) {
  const io = new Server(httpServer, { cors: { origin: corsOrigin || "*" } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || "";
    try {
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_meeting", async ({ meetingId }) => {
      const u = socket.data.user;
      socket.data.meetingId = meetingId;
      socket.join(`${u.schoolId}:${meetingId}`);

      // snapshot: try Redis first, fallback to DB
      let snap = await getSnapshot(u.schoolId, meetingId);
      if (!snap) {
        const meeting = await pool.query(
          `SELECT * FROM meetings WHERE id=$1 AND school_id=$2`,
          [meetingId, u.schoolId]
        );
        const members = await pool.query(
          `SELECT * FROM members WHERE meeting_id=$1 AND school_id=$2`,
          [meetingId, u.schoolId]
        );
        const motions = await pool.query(
          `SELECT * FROM motions WHERE meeting_id=$1 AND school_id=$2`,
          [meetingId, u.schoolId]
        );
        snap = {
          meeting: meeting.rows[0] || null,
          members: members.rows,
          motions: motions.rows
        };
        await setSnapshot(u.schoolId, meetingId, snap);
      }

      socket.emit("meeting_snapshot", snap);
    });

    socket.on("add_member", async ({ meetingId, name, role }) => {
      const u = socket.data.user;
      if (!can(u.role, "host")) return;

      const id = nanoid(8);
      const updatedAt = Date.now();

      await pool.query(
        `INSERT INTO members (id, meeting_id, school_id, name, role, vote, locked, updated_at)
         VALUES ($1,$2,$3,$4,$5,NULL,false,$6)`,
        [id, meetingId, u.schoolId, name, role || "一般議員", updatedAt]
      );

      await appendAudit({
        meetingId, schoolId: u.schoolId, ts: updatedAt,
        actorId: u.userId, actorName: u.name,
        action: "ADD_MEMBER", entityType: "member", entityId: id,
        payload: { name, role }
      });

      io.to(`${u.schoolId}:${meetingId}`).emit("state_patch", {
        type: "member_upsert",
        member: {
          id, meeting_id: meetingId, school_id: u.schoolId,
          name, role: role || "一般議員",
          vote: null, locked: false, updated_at: updatedAt
        }
      });
    });

    socket.on("open_motion", async ({ meetingId, title, description }) => {
      const u = socket.data.user;
      if (!can(u.role, "host")) return;

      const id = nanoid(8);
      const ts = Date.now();
      await pool.query(
        `INSERT INTO motions (id, meeting_id, school_id, title, description, status, created_at)
         VALUES ($1,$2,$3,$4,$5,'OPEN',$6)`,
        [id, meetingId, u.schoolId, title, description || "", ts]
      );

      await appendAudit({
        meetingId, schoolId: u.schoolId, ts,
        actorId: u.userId, actorName: u.name,
        action: "OPEN_MOTION", entityType: "motion", entityId: id,
        payload: { title, description }
      });

      io.to(`${u.schoolId}:${meetingId}`).emit("state_patch", {
        type: "motion_upsert",
        motion: {
          id, meeting_id: meetingId, school_id: u.schoolId,
          title, description: description || "",
          status: "OPEN", created_at: ts, closed_at: null
        }
      });
    });

    socket.on("submit_vote", async ({ meetingId, motionId, memberId, choice }) => {
      const u = socket.data.user;
      if (!can(u.role, "member")) return;
      if (!["Y", "N", "A"].includes(choice)) return;

      // Check if member is locked
      const m = await pool.query(
        `SELECT locked FROM members WHERE id=$1 AND meeting_id=$2 AND school_id=$3`,
        [memberId, meetingId, u.schoolId]
      );
      if (!m.rowCount) return;
      if (m.rows[0].locked) return;

      const ts = Date.now();
      const voteId = nanoid(10);

      await pool.query("BEGIN");
      try {
        await pool.query(
          `INSERT INTO votes (id, meeting_id, school_id, motion_id, member_id, choice, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [voteId, meetingId, u.schoolId, motionId, memberId, choice, ts]
        );

        await pool.query(
          `UPDATE members SET vote=$1, locked=true, updated_at=$2 WHERE id=$3 AND meeting_id=$4 AND school_id=$5`,
          [choice, ts, memberId, meetingId, u.schoolId]
        );

        await appendAudit({
          meetingId, schoolId: u.schoolId, ts,
          actorId: u.userId, actorName: u.name,
          action: "VOTE", entityType: "vote", entityId: voteId,
          payload: { motionId, memberId, choice }
        });

        await pool.query("COMMIT");
      } catch (e) {
        await pool.query("ROLLBACK");
        return;
      }

      io.to(`${u.schoolId}:${meetingId}`).emit("state_patch", {
        type: "member_vote",
        memberId, vote: choice, locked: true, updatedAt: ts
      });
    });

    socket.on("revoke_vote", async ({ meetingId, memberId }) => {
      const u = socket.data.user;
      if (!can(u.role, "host")) return;

      const ts = Date.now();
      await pool.query(
        `UPDATE members SET vote=NULL, locked=false, updated_at=$1 WHERE id=$2 AND meeting_id=$3 AND school_id=$4`,
        [ts, memberId, meetingId, u.schoolId]
      );

      await appendAudit({
        meetingId, schoolId: u.schoolId, ts,
        actorId: u.userId, actorName: u.name,
        action: "REVOKE", entityType: "member", entityId: memberId,
        payload: {}
      });

      io.to(`${u.schoolId}:${meetingId}`).emit("state_patch", {
        type: "member_vote",
        memberId, vote: null, locked: false, updatedAt: ts
      });
    });
  });

  return io;
}
