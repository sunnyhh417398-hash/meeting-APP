import PDFDocument from "pdfkit";
import { pool } from "./db.js";

export async function exportCsv(meetingId, schoolId) {
  const members = await pool.query(
    `SELECT name, role, vote, locked, updated_at FROM members WHERE meeting_id=$1 AND school_id=$2 ORDER BY name`,
    [meetingId, schoolId]
  );

  const header = ["name", "role", "vote", "locked", "updated_at"];
  const rows = members.rows.map(r => header.map(k => (r[k] ?? "")));

  const csv = [
    header.join(","),
    ...rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))
  ].join("\n");
  return csv;
}

export async function exportPdf(res, meetingId, schoolId) {
  const meeting = await pool.query(
    `SELECT * FROM meetings WHERE id=$1 AND school_id=$2`,
    [meetingId, schoolId]
  );
  const members = await pool.query(
    `SELECT name, role, vote, updated_at FROM members WHERE meeting_id=$1 AND school_id=$2 ORDER BY role, name`,
    [meetingId, schoolId]
  );
  const motions = await pool.query(
    `SELECT id, title, status, created_at, closed_at FROM motions WHERE meeting_id=$1 AND school_id=$2 ORDER BY created_at`,
    [meetingId, schoolId]
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="meeting_${meetingId}.pdf"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.fontSize(18).text("Meeting Report", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Meeting ID: ${meetingId}`);
  doc.text(`School ID: ${schoolId}`);
  doc.text(`Title: ${meeting.rows[0]?.title || "-"}`);
  doc.moveDown();

  doc.fontSize(14).text("Members");
  doc.moveDown(0.5);
  members.rows.forEach(m => {
    doc.fontSize(12).text(
      `${m.role} | ${m.name} | ${m.vote ?? "未投票"} | ${m.updated_at ? new Date(Number(m.updated_at)).toLocaleString() : "-"}`
    );
  });

  doc.moveDown();
  doc.fontSize(14).text("Motions");
  doc.moveDown(0.5);
  motions.rows.forEach(x => {
    doc.fontSize(12).text(
      `${x.title} | ${x.status} | ${new Date(Number(x.created_at)).toLocaleString()}`
    );
  });

  doc.end();
}
