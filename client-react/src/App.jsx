import { useMemo, useRef, useState, useEffect } from "react";
import { io } from "socket.io-client";
import { API_BASE, login, createMeeting, exportCsvUrl, exportPdfUrl } from "./api.js";

const voteLabel = (v) => (v === "Y" ? "同意" : v === "N" ? "反對" : v === "A" ? "棄權" : "未投票");

export default function App() {
  const [schoolId, setSchoolId] = useState("soochow");
  const [userId, setUserId] = useState("sunny");
  const [name, setName] = useState("Sunny");
  const [role, setRole] = useState("host");

  const [token, setToken] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [title, setTitle] = useState("");

  const [members, setMembers] = useState([]);
  const [motions, setMotions] = useState([]);
  const [currentMotionId, setCurrentMotionId] = useState("");

  const [mName, setMName] = useState("");
  const [mRole, setMRole] = useState("");

  const [motionTitle, setMotionTitle] = useState("");
  const [motionDesc, setMotionDesc] = useState("");

  const socketRef = useRef(null);
  const isHost = useMemo(() => role === "host" || role === "admin", [role]);

  const doLogin = async () => {
    const { token } = await login({ schoolId, userId, name, role });
    setToken(token);
  };

  const doCreateMeeting = async () => {
    const r = await createMeeting(token, title || "校務會議");
    setMeetingId(r.meetingId);
  };

  const join = () => {
    if (!token || !meetingId) return alert("先登入並輸入 meetingId");

    if (socketRef.current) socketRef.current.disconnect();
    const s = io(API_BASE, { auth: { token } });
    socketRef.current = s;

    s.on("connect", () => {
      s.emit("join_meeting", { meetingId });
    });

    s.on("meeting_snapshot", (snap) => {
      setMembers(snap.members || []);
      setMotions(snap.motions || []);
      setCurrentMotionId((snap.motions?.[0]?.id) || "");
    });

    s.on("state_patch", (patch) => {
      if (patch.type === "member_upsert") {
        setMembers(prev => {
          const map = new Map(prev.map(x => [x.id, x]));
          map.set(patch.member.id, patch.member);
          return [...map.values()];
        });
      }
      if (patch.type === "motion_upsert") {
        setMotions(prev => {
          const map = new Map(prev.map(x => [x.id, x]));
          map.set(patch.motion.id, patch.motion);
          const arr = [...map.values()].sort((a, b) => a.created_at - b.created_at);
          if (!currentMotionId) setCurrentMotionId(patch.motion.id);
          return arr;
        });
      }
      if (patch.type === "member_vote") {
        setMembers(prev => prev.map(m =>
          m.id === patch.memberId
            ? { ...m, vote: patch.vote, locked: patch.locked, updated_at: patch.updatedAt }
            : m
        ));
      }
    });
  };

  const addMember = () => {
    if (!isHost) return;
    if (!mName.trim()) return alert("請輸入姓名");
    socketRef.current?.emit("add_member", {
      meetingId, name: mName.trim(), role: mRole.trim() || "一般議員"
    });
    setMName(""); setMRole("");
  };

  const openMotion = () => {
    if (!isHost) return;
    if (!motionTitle.trim()) return alert("請輸入表決題目");
    socketRef.current?.emit("open_motion", {
      meetingId, title: motionTitle.trim(), description: motionDesc.trim()
    });
    setMotionTitle(""); setMotionDesc("");
  };

  const vote = (memberId, choice) => {
    if (!currentMotionId) return alert("請先建立/選擇表決題目");
    socketRef.current?.emit("submit_vote", {
      meetingId, motionId: currentMotionId, memberId, choice
    });
  };

  const revoke = (memberId) =>
    socketRef.current?.emit("revoke_vote", { meetingId, memberId });

  useEffect(() => () => socketRef.current?.disconnect(), []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h2>Meeting SaaS</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
          <h3>1) 登入 (JWT)</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={schoolId} onChange={e => setSchoolId(e.target.value)} placeholder="schoolId" />
            <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="userId" />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="name" />
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="viewer">viewer</option>
              <option value="member">member</option>
              <option value="host">host</option>
              <option value="admin">admin</option>
            </select>
            <button onClick={doLogin}>Login</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            token: {token ? "已取得" : "—"}
          </div>
        </div>

        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
          <h3>2) 建立/加入會議</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="會議名稱" />
            <button onClick={doCreateMeeting} disabled={!token || !isHost}>Create meeting</button>
            <input value={meetingId} onChange={e => setMeetingId(e.target.value)} placeholder="meetingId" />
            <button onClick={join} disabled={!token || !meetingId}>Join</button>
          </div>

          {meetingId && (
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={exportCsvUrl(meetingId)} target="_blank" rel="noreferrer">Export CSV</a>
              <a href={exportPdfUrl(meetingId)} target="_blank" rel="noreferrer">Export PDF</a>
            </div>
          )}
        </div>
      </div>

      <hr />

      {isHost && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
            <h3>主持人：新增議員</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={mName} onChange={e => setMName(e.target.value)} placeholder="姓名" />
              <input value={mRole} onChange={e => setMRole(e.target.value)} placeholder="職稱" />
              <button onClick={addMember}>新增</button>
            </div>
          </div>

          <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
            <h3>主持人：建立表決題目</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={motionTitle} onChange={e => setMotionTitle(e.target.value)} placeholder="題目" />
              <input value={motionDesc} onChange={e => setMotionDesc(e.target.value)} placeholder="說明（可空）" />
              <button onClick={openMotion}>Open motion</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
        <h3>目前表決題目</h3>
        <select value={currentMotionId} onChange={e => setCurrentMotionId(e.target.value)}>
          <option value="">（尚無）</option>
          {motions.map(m => (
            <option key={m.id} value={m.id}>{m.title} | {m.status}</option>
          ))}
        </select>
      </div>

      <h3 style={{ marginTop: 16 }}>記名投票名單（投票鎖定，主持人可撤銷）</h3>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["姓名", "職稱", "投票狀態", "操作"].map(h => (
              <th key={h} style={{ border: "1px solid #ddd", padding: 8, textAlign: "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id}>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{m.name}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{m.role}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{voteLabel(m.vote)}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>
                <button disabled={!!m.locked} onClick={() => vote(m.id, "Y")}>同意</button>{" "}
                <button disabled={!!m.locked} onClick={() => vote(m.id, "N")}>反對</button>{" "}
                <button disabled={!!m.locked} onClick={() => vote(m.id, "A")}>棄權</button>{" "}
                <button disabled={!isHost} onClick={() => revoke(m.id)}>撤銷</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
        * 匯出 PDF/CSV 會從 Postgres 取資料；Audit Log 以 Hash Chain 寫入 audit_log（不可抵賴）。
      </div>
    </div>
  );
}
