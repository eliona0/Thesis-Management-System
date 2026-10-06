const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const Module = require("node:module");
const jwt = require("jsonwebtoken");
const fs = require("node:fs");
const path = require("node:path");
process.env.JWT_SECRET = "workflow-test-secret";
console.error = () => {};

const setup = () => ({
  users: new Map([[1, ["ADMIN", true]], [2, ["STUDENT", true]], [3, ["MENTOR", true]], [4, ["COMMITTEE_MEMBER", true]], [5, ["COMMITTEE_MEMBER", true]], [6, ["COMMITTEE_MEMBER", true]], [7, ["COMMITTEE_MEMBER", true]], [8, ["MENTOR", true]], [9, ["STUDENT", true]], [10, ["STUDENT", true]], [11, ["STUDENT", true]]]),
  theses: new Map([[100, { id: 100, studentId: 2, mentorId: 3, title: "Bachelor", status: "IN_PROGRESS", startedAt: new Date() }], [101, { id: 101, studentId: 9, mentorId: 8, title: "Grade 10", status: "IN_PROGRESS", startedAt: new Date() }], [200, { id: 200, studentId: 9, mentorId: 8, title: "Committee", status: "SUBMITTED", startedAt: new Date() }], [300, { id: 300, studentId: 10, mentorId: 3, title: "Draft proposal", status: "PENDING", startedAt: null }]]),
  versions: new Map([[1000, { id: 1000, thesisId: 100, versionNumber: 2, status: "DRAFT", isCurrent: true, submittedAt: null }], [1001, { id: 1001, thesisId: 100, versionNumber: 1, status: "DRAFT", isCurrent: false, submittedAt: null }], [1010, { id: 1010, thesisId: 101, versionNumber: 1, status: "DRAFT", isCurrent: true, submittedAt: null }]]),
  profiles: [...[101, 102, 103, 104].map((id, i) => ({ id, userId: i + 4, isActive: true })), { id: 105, userId: 99, isActive: false }],
  committee: null, evaluations: [], feedback: [], requests: [{ id: 55, studentId: 2, mentorId: 30, status: "PENDING" }, { id: 56, studentId: 2, mentorId: 30, status: "PENDING" }, { id: 57, studentId: 11, mentorId: 30, status: "PENDING" }, { id: 58, studentId: 3, mentorId: 30, status: "PENDING" }],
  mentors: [{ id: 30, userId: 3 }, { id: 31, userId: 8 }],
});
let db = setup();
const t = (id) => db.theses.get(id) || null;
const v = (id) => db.versions.get(id) || null;
const profileFor = (where) => db.profiles.find((p) => where.userId ? p.userId === where.userId : p.id === where.id) || null;
const committeeRows = () => db.committee?.members.map((m) => ({ ...m, member: { user: { id: m.committeeMemberId - 97, firstName: "Member", lastName: "Test", email: "member@example.test", isActive: true } } })) || [];
const prisma = {
  user: { findUnique: async ({ where }) => { const user = db.users.get(where.id); return user && { id: where.id, isActive: user[1], role: { name: user[0] } }; } },
  thesis: {
    findUnique: async ({ where, include }) => { const row = t(where.id); return row && (include?.committee ? { ...row, committee: db.committee?.thesisId === row.id ? db.committee : null } : row); },
    findFirst: async ({ where }) => [...db.theses.values()].find((row) => row.studentId === where.studentId && (!where.status?.in || where.status.in.includes(row.status))) || null,
    updateMany: async ({ where, data }) => { const row = t(where.id); if (!row || row.status !== where.status || (where.mentorId && row.mentorId !== where.mentorId)) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
    create: async ({ data }) => { const id = Math.max(...db.theses.keys()) + 1; const row = { id, ...data, startedAt: null }; db.theses.set(id, row); return row; },
  },
  thesisVersion: {
    findUnique: async ({ where, include }) => { const row = v(where.id); return row && (include?.thesis ? { ...row, thesis: t(row.thesisId) } : row); },
    findFirst: async ({ where, orderBy, include }) => { const rows = [...db.versions.values()].filter((row) => where.filePath ? row.filePath === where.filePath : row.thesisId === where.thesisId && (!where.status?.in || where.status.in.includes(row.status))); if (orderBy) rows.sort((a, b) => b.versionNumber - a.versionNumber); const row = rows[0] || null; return row && (include?.thesis ? { ...row, thesis: t(row.thesisId) } : row); },
    updateMany: async ({ where, data }) => { const row = v(where.id); if (!row || (where.thesisId !== undefined && row.thesisId !== where.thesisId) || row.status !== where.status || (Object.hasOwn(where, "submittedAt") && row.submittedAt !== where.submittedAt)) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
    findMany: async ({ where }) => [...db.versions.values()].filter((row) => row.thesisId === where.thesisId),
  },
  committeeMemberProfile: {
    findUnique: async ({ where }) => profileFor(where),
    findMany: async ({ where }) => db.profiles.filter((p) => where.id.in.includes(p.id)).map((p) => ({ ...p, user: { isActive: p.isActive, role: { name: "COMMITTEE_MEMBER" } } })),
  },
  mentorProfile: { findUnique: async ({ where }) => db.mentors.find((m) => where.userId ? m.userId === where.userId : m.id === where.id) || null },
  committee: {
    create: async ({ data }) => (db.committee = { id: 800, thesisId: data.thesisId, status: data.status, assignedDate: new Date(), defenseDate: null, members: data.members.create.map((m, i) => ({ id: i + 1, ...m })) }),
    findUnique: async ({ where, include }) => { const row = db.committee && (where.id ? db.committee.id === where.id : db.committee.thesisId === where.thesisId) ? db.committee : null; return row && (include?.members ? { ...row, members: committeeRows() } : row); },
    updateMany: async ({ where, data }) => { if (!db.committee || db.committee.id !== where.id || db.committee.status !== where.status) return { count: 0 }; Object.assign(db.committee, data); return { count: 1 }; },
  },
  evaluation: {
    create: async ({ data }) => { if (db.evaluations.some((e) => e.thesisId === data.thesisId && e.committeeMemberId === data.committeeMemberId)) { const error = new Error(); error.code = "P2002"; throw error; } const row = { id: 900 + db.evaluations.length, ...data, evaluationDate: new Date() }; db.evaluations.push(row); return row; },
    findMany: async ({ where }) => db.evaluations.filter((e) => e.thesisId === where.thesisId),
  },
  feedback: {
    findFirst: async ({ where }) => db.feedback.find((f) => f.versionId === where.versionId) || null,
    create: async ({ data }) => { const row = { id: 700 + db.feedback.length, ...data }; db.feedback.push(row); return row; },
  },
  mentorRequest: {
    findUnique: async ({ where }) => db.requests.find((r) => r.id === where.id) || null,
    findMany: async ({ where }) => db.requests.filter((r) => r.studentId === where.studentId),
    updateMany: async ({ where, data }) => { const row = db.requests.find((r) => r.id === where.id); if (!row || (where.studentId && row.studentId !== where.studentId) || (where.mentorId && row.mentorId !== where.mentorId) || row.status !== where.status) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
  },
  $transaction: async (fn) => fn(prisma),
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) { return request.endsWith("config/prisma") ? prisma : originalLoad.call(this, request, parent, isMain); };
const app = require("./app");
const server = http.createServer(app);
let origin;
const auth = (id) => ({ authorization: `Bearer ${jwt.sign({ userId: id, role: "UNTRUSTED" }, process.env.JWT_SECRET)}` });
async function api(path, { id, method = "GET", body } = {}) {
  const headers = id ? auth(id) : {};
  if (body !== undefined && !(body instanceof FormData)) headers["content-type"] = "application/json";
  const response = await fetch(origin + path, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  return { status: response.status, json: await response.json() };
}
before(async () => { await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.closeAllConnections?.(); await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => { db = setup(); });

test("current role and account activity are enforced", async () => {
  assert.equal((await api("/api/committee/thesis/200")).status, 401);
  assert.equal((await api("/api/committee/thesis/200", { id: 2 })).status, 403);
  db.users.get(2)[1] = false;
  assert.equal((await api("/api/thesis/my-thesis", { id: 2 })).status, 401);
});

test("thesis PDF URLs require authentication and thesis ownership", async () => {
  const fileName = "api-guard-check.pdf";
  const diskPath = path.join(__dirname, "../uploads/theses", fileName);
  v(1000).filePath = `/uploads/theses/${fileName}`;
  fs.mkdirSync(path.dirname(diskPath), { recursive: true });
  fs.writeFileSync(diskPath, "%PDF-test");
  try {
    const anonymous = await fetch(`${origin}${v(1000).filePath}`);
    assert.equal(anonymous.status, 401);
    const otherStudent = await fetch(`${origin}${v(1000).filePath}`, { headers: auth(9) });
    assert.equal(otherStudent.status, 403);
    const owner = await fetch(`${origin}${v(1000).filePath}`, { headers: auth(2) });
    assert.equal(owner.status, 200);
    assert.equal(await owner.text(), "%PDF-test");
  } finally {
    fs.rmSync(diskPath, { force: true });
  }
});

test("normal review stays separate from final submission and post-approval writes are blocked", async () => {
  assert.equal((await api("/api/thesis/my-thesis/versions/1001/submit", { id: 2, method: "PATCH" })).status, 200);
  assert.equal(v(1001).submittedAt, null);
  assert.equal((await api("/api/feedback/1001", { id: 3, method: "POST", body: { comment: "Feedback" } })).status, 201);
  assert.equal(v(1001).status, "REVIEWED");
  assert.equal((await api("/api/thesis/my-thesis/versions/1000/submit-final", { id: 2, method: "PATCH" })).json.code, "MINIMUM_DURATION_NOT_COMPLETED");
  const start = new Date(); start.setMonth(start.getMonth() - 3); start.setMinutes(start.getMinutes() - 1); t(100).startedAt = start;
  assert.equal((await api("/api/thesis/my-thesis/versions/1000/submit-final", { id: 2, method: "PATCH" })).status, 200);
  assert.ok(v(1000).submittedAt instanceof Date);
  assert.equal(t(100).status, "IN_PROGRESS");
  assert.equal((await api("/api/feedback/1000", { id: 3, method: "POST", body: { comment: "Not a normal review" } })).status, 409);
  assert.equal((await api("/api/thesis/versions/1000/approve-final", { id: 8, method: "PATCH" })).status, 403);
  assert.equal((await api("/api/thesis/versions/1000/approve-final", { id: 2, method: "PATCH" })).status, 403);
  for (const grade of [5, 11]) assert.equal((await api("/api/thesis/versions/1000/approve-final", { id: 3, method: "PATCH", body: { finalGrade: grade } })).status, 400);
  v(1000).submittedAt = new Date(Date.now() - 8 * 86400000);
  assert.equal((await api("/api/thesis/versions/1000/approve-final", { id: 3, method: "PATCH" })).json.code, "FINAL_EVALUATION_DEADLINE_EXCEEDED");
  v(1000).submittedAt = new Date();
  assert.equal((await api("/api/thesis/versions/1000/approve-final", { id: 3, method: "PATCH", body: { mentorFinalEvaluation: "Approved", finalGrade: 6 } })).status, 200);
  assert.equal(v(1000).status, "APPROVED"); assert.ok(v(1000).reviewedAt instanceof Date);
  assert.equal(t(100).status, "SUBMITTED"); assert.equal(t(100).finalGrade, 6); assert.ok(t(100).finalEvaluatedAt instanceof Date);
  assert.equal(db.committee, null);
  assert.equal((await api("/api/thesis/my-thesis/versions/1000/submit-final", { id: 2, method: "PATCH" })).status, 400);
  assert.equal((await api("/api/thesis/my-thesis/versions/1000/submit", { id: 2, method: "PATCH" })).status, 400);
  assert.equal((await api("/api/thesis/my-thesis/versions/1000", { id: 2, method: "DELETE" })).status, 400);
  assert.equal((await api("/api/thesis/versions/1000/approve-final", { id: 3, method: "PATCH" })).status, 400);
  const lockedUpload = new FormData(); lockedUpload.append("thesisFile", new Blob(["%PDF-fixture"], { type: "application/pdf" }), "locked.pdf");
  assert.equal((await api("/api/thesis/my-thesis/versions", { id: 2, method: "POST", body: lockedUpload })).status, 400);
  const upload = new FormData(); upload.append("thesisFile", new Blob(["pdf fixture"], { type: "application/pdf" }), "locked.pdf");
  assert.equal((await api("/api/thesis/my-thesis/versions", { id: 2, method: "POST", body: upload })).status, 400);

  const gradeStart = new Date(); gradeStart.setMonth(gradeStart.getMonth() - 4); t(101).startedAt = gradeStart;
  assert.equal((await api("/api/thesis/my-thesis/versions/1010/submit-final", { id: 9, method: "PATCH" })).status, 200);
  v(1010).submittedAt = new Date();
  assert.equal((await api("/api/thesis/versions/1010/approve-final", { id: 8, method: "PATCH", body: { finalGrade: 10 } })).status, 200);
});

test("invalid thesis uploads receive a safe API error", async () => {
  const upload = new FormData(); upload.append("thesisFile", new Blob(["not a PDF"]), "invalid.txt");
  const result = await api("/api/thesis/my-thesis/versions", { id: 2, method: "POST", body: upload });
  assert.equal(result.status, 400);
  assert.equal(result.json.message, "Only PDF files are allowed");
  const fakePdf = new FormData(); fakePdf.append("thesisFile", new Blob(["not a PDF"]), "fake.pdf");
  assert.equal((await api("/api/thesis/my-thesis/versions", { id: 2, method: "POST", body: fakePdf })).status, 400);
});

test("committee assignment requires three members and all assigned evaluations to complete", async () => {
  const path = "/api/committee/thesis/200";
  const chair = { committeeMemberId: 101, role: "CHAIR" }, first = { committeeMemberId: 102, role: "MEMBER" }, second = { committeeMemberId: 103, role: "MEMBER" };
  const admin = (url, method, body) => api(url, { id: 1, method, body });
  assert.equal((await admin(path, "POST", { members: [chair, first] })).status, 400);
  assert.equal((await admin(path, "POST", { members: [chair, first, second, { committeeMemberId: 104, role: "MEMBER" }] })).status, 400);
  assert.equal((await admin(path, "POST", { members: [chair, { committeeMemberId: 102, role: "CHAIR" }, second] })).status, 400);
  assert.equal((await admin(path, "POST", { members: [chair, first, { committeeMemberId: 102, role: "MEMBER" }] })).status, 400);
  assert.equal((await admin(path, "POST", { members: [chair, first, { committeeMemberId: 999, role: "MEMBER" }] })).status, 404);
  assert.equal((await admin(path, "POST", { members: [chair, first, { committeeMemberId: 105, role: "MEMBER" }] })).status, 400);
  assert.equal((await admin("/api/committee/thesis/100", "POST", { members: [chair, first, second] })).status, 400);
  assert.equal((await admin(path, "POST", { members: [chair, first, second] })).status, 201);
  assert.equal((await admin(path, "POST", { members: [chair, first, second] })).status, 409);
  assert.equal(db.committee.status, "ASSIGNED"); assert.equal(db.committee.members.length, 3);
  const retrieved = await admin(path, "GET"); assert.equal(retrieved.status, 200); assert.equal(JSON.stringify(retrieved.json).includes("passwordHash"), false);
  assert.equal((await admin(path + "/schedule", "PATCH", { defenseDate: "invalid" })).status, 400);
  assert.equal((await admin(path + "/schedule", "PATCH", { defenseDate: "2000-01-01" })).status, 400);
  assert.equal((await admin(path + "/schedule", "PATCH", { defenseDate: new Date(Date.now() + 86400000).toISOString() })).status, 200);
  const evalPath = path + "/evaluations";
  assert.equal((await api(evalPath, { id: 7, method: "POST", body: { grade: 9 } })).status, 403);
  assert.equal((await api(evalPath, { id: 4, method: "POST", body: { grade: 5 } })).status, 400);
  assert.equal((await api(evalPath, { id: 4, method: "POST", body: { grade: 11 } })).status, 400);
  assert.equal((await api(evalPath, { id: 4, method: "POST", body: { grade: 6 } })).status, 201);
  assert.equal((await api(evalPath, { id: 4, method: "POST", body: { grade: 8 } })).status, 409);
  assert.equal((await api(evalPath, { id: 5, method: "POST", body: { grade: 8 } })).status, 201); assert.equal(db.committee.status, "SCHEDULED");
  assert.equal((await api(evalPath, { id: 6, method: "POST", body: { grade: 10 } })).status, 201); assert.equal(db.committee.status, "COMPLETED");
  assert.equal((await admin(path + "/schedule", "PATCH", { defenseDate: new Date(Date.now() + 86400000).toISOString() })).status, 409);
});

test("students can cancel only their own pending mentor request", async () => {
  assert.equal((await api("/api/mentor-requests/my", { id: 2 })).status, 200);
  assert.equal((await api("/api/mentor-requests/55/cancel", { id: 9, method: "PATCH" })).status, 403);
  assert.equal(db.requests[0].status, "PENDING");
  assert.equal((await api("/api/mentor-requests/55/cancel", { id: 2, method: "PATCH" })).status, 200);
  assert.equal(db.requests[0].status, "CANCELLED");
  assert.equal((await api("/api/mentor-requests/55/cancel", { id: 2, method: "PATCH" })).status, 409);
});

test("mentor request accept, reject, ownership and self-accept transitions are enforced", async () => {
  assert.equal((await api("/api/mentor/requests/57/accept", { id: 8, method: "PATCH" })).status, 403);
  assert.equal((await api("/api/mentor/requests/58/accept", { id: 3, method: "PATCH" })).status, 403);
  assert.equal(db.requests.find((r) => r.id === 58).status, "PENDING");
  assert.equal((await api("/api/mentor/requests/57/accept", { id: 3, method: "PATCH" })).status, 200);
  assert.equal(db.requests.find((r) => r.id === 57).status, "ACCEPTED");
  assert.ok([...db.theses.values()].some((thesis) => thesis.studentId === 11 && thesis.mentorId === 3 && thesis.status === "PENDING"));
  assert.equal((await api("/api/mentor/requests/56/reject", { id: 8, method: "PATCH" })).status, 403);
  assert.equal((await api("/api/mentor/requests/56/reject", { id: 3, method: "PATCH" })).status, 200);
  assert.equal(db.requests.find((r) => r.id === 56).status, "REJECTED");
});

test("mentor approval establishes a server timestamp that students cannot edit", async () => {
  assert.equal((await api("/api/thesis/300/approve", { id: 10, method: "PATCH" })).status, 403);
  const wrongMentor = await api("/api/thesis/300/approve", { id: 8, method: "PATCH" });
  assert.equal(wrongMentor.status, 403);
  const approved = await api("/api/thesis/300/approve", { id: 3, method: "PATCH" });
  assert.equal(approved.status, 200);
  const officialStart = t(300).startedAt;
  assert.ok(officialStart instanceof Date);
  const edit = await api("/api/thesis/my-thesis", { id: 10, method: "PATCH", body: { title: "Try to change start", startedAt: "2000-01-01" } });
  assert.equal(edit.status, 409);
  assert.equal(t(300).startedAt, officialStart);
});
