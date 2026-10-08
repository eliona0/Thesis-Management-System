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
  users: new Map([[1, ["ADMIN", true]], [2, ["STUDENT", true]], [3, ["MENTOR", true]], [4, ["COMMITTEE_MEMBER", true]], [5, ["COMMITTEE_MEMBER", true]], [6, ["COMMITTEE_MEMBER", true]], [7, ["COMMITTEE_MEMBER", true]], [8, ["MENTOR", true]], [9, ["STUDENT", true]], [10, ["STUDENT", true]], [11, ["STUDENT", true]], [12, ["MENTOR", true]]]),
  theses: new Map([[100, { id: 100, studentId: 2, mentorId: 3, title: "Bachelor", status: "IN_PROGRESS", startedAt: new Date() }], [101, { id: 101, studentId: 9, mentorId: 8, title: "Grade 10", status: "IN_PROGRESS", startedAt: new Date() }], [200, { id: 200, studentId: 9, mentorId: 8, title: "Committee", status: "SUBMITTED", startedAt: new Date() }], [300, { id: 300, studentId: 10, mentorId: 3, title: "Draft proposal", status: "PENDING", startedAt: null }]]),
  versions: new Map([[1000, { id: 1000, thesisId: 100, versionNumber: 2, status: "DRAFT", isCurrent: true, submittedAt: null }], [1001, { id: 1001, thesisId: 100, versionNumber: 1, status: "DRAFT", isCurrent: false, submittedAt: null }], [1010, { id: 1010, thesisId: 101, versionNumber: 1, status: "DRAFT", isCurrent: true, submittedAt: null }]]),
  profiles: [...[101, 102, 103, 104].map((id, i) => ({ id, userId: i + 4, isActive: true })), { id: 105, userId: 99, isActive: false }],
  studyPrograms: [{ id: 1, name: "Computer Science", status: "ACTIVE" }, { id: 2, name: "Inactive Program", status: "INACTIVE" }],
  committee: null, evaluations: [], feedback: [], requests: [{ id: 55, studentId: 2, mentorId: 30, status: "PENDING" }, { id: 56, studentId: 2, mentorId: 30, status: "PENDING" }, { id: 57, studentId: 11, mentorId: 30, status: "PENDING" }, { id: 58, studentId: 3, mentorId: 30, status: "PENDING" }],
  mentors: [{ id: 30, userId: 3 }, { id: 31, userId: 8 }],
});
let db = setup();
const t = (id) => db.theses.get(id) || null;
const v = (id) => db.versions.get(id) || null;
const profileFor = (where) => db.profiles.find((p) => where.userId ? p.userId === where.userId : p.id === where.id) || null;
const committeeRows = () => db.committee?.members.map((m) => ({ ...m, member: { user: { id: m.committeeMemberId - 97, firstName: "Member", lastName: "Test", email: "member@example.test", isActive: true } } })) || [];
const prisma = {
  user: {
    findUnique: async ({ where }) => { const user = db.users.get(where.id); return user && { id: where.id, isActive: user[1], role: { name: user[0] } }; },
    update: async ({ where, data, select }) => { const user = db.users.get(where.id); if (!user) return null; db.users.set(where.id, [user[0], data.isActive]); return { id: where.id, isActive: data.isActive }; },
    findMany: async ({ select } = {}) => select?.role && Object.keys(select).length === 1
      ? [...db.users.values()].map(([name]) => ({ role: { name } }))
      : [{ id: 1, firstName: "Admin", lastName: "Test", email: "admin@example.test", isActive: true, createdAt: new Date("2025-01-01"), role: { name: "ADMIN" }, studyProgram: null }],
  },
  thesis: {
    findUnique: async ({ where, include }) => { const row = t(where.id); return row && (include?.committee ? { ...row, committee: db.committee?.thesisId === row.id ? db.committee : null } : row); },
    findMany: async ({ where = {}, orderBy, select }) => [...db.theses.values()].filter((row) => where.status ? row.status === where.status && db.committee?.thesisId !== row.id : Object.keys(where).length === 0 || row.mentorId === where.mentorId).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || b.id - a.id).map((row) => ({ ...row, student: { id: row.studentId, firstName: "Student", lastName: "Test", email: `student${row.studentId}@example.test`, studentProfile: { studentNumber: `S${row.studentId}` }, studyProgram: { id: 1, name: "Computer Science" } } })),
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
    findMany: async ({ where }) => db.profiles.filter((p) => where.id ? where.id.in.includes(p.id) : p.isActive).map((p) => ({ ...p, userId: p.userId, academicTitle: null, specialization: null, department: null, user: { isActive: p.isActive, firstName: "Member", lastName: "Test", email: "member@example.test", role: { name: db.users.get(p.userId)?.[0] || "COMMITTEE_MEMBER" } } })),
  },
  studyProgram: {
    findMany: async ({ where }) => where?.status ? db.studyPrograms.filter((p) => p.status === where.status).map(({ id, name }) => ({ id, name })) : db.studyPrograms.map((program) => ({ ...program, department: null, degreeLevel: null, createdAt: new Date("2025-01-01"), _count: { users: 1 } })),
    count: async () => db.studyPrograms.length,
    create: async ({ data }) => { const program = { id: Math.max(...db.studyPrograms.map((item) => item.id)) + 1, status: "ACTIVE", ...data }; db.studyPrograms.push(program); return program; },
    findUnique: async ({ where }) => db.studyPrograms.find((item) => item.id === where.id) || null,
    update: async ({ where, data }) => { const program = db.studyPrograms.find((item) => item.id === where.id); Object.assign(program, data); return program; },
  },
  mentorProfile: { findUnique: async ({ where }) => db.mentors.find((m) => where.userId ? m.userId === where.userId : m.id === where.id) || null },
  committee: {
    create: async ({ data }) => (db.committee = { id: 800, thesisId: data.thesisId, status: data.status, assignedDate: new Date(), defenseDate: null, members: data.members.create.map((m, i) => ({ id: i + 1, ...m })) }),
    findUnique: async ({ where, include }) => { const row = db.committee && (where.id ? db.committee.id === where.id : db.committee.thesisId === where.thesisId) ? db.committee : null; return row && (include?.members ? { ...row, members: committeeRows() } : row); },
    findMany: async () => db.committee ? [{ ...db.committee, thesis: { ...t(db.committee.thesisId), student: { id: 9, firstName: "Student", lastName: "Test", email: "student@example.test" }, evaluations: db.evaluations.map((evaluation) => ({ ...evaluation, committeeMember: { user: { id: evaluation.committeeMemberId + 3, firstName: "Member", lastName: "Test", email: "member@example.test" } } })) }, members: committeeRows() }] : [],
    count: async () => db.committee?.status === "SCHEDULED" && db.committee.defenseDate > new Date() ? 1 : 0,
    updateMany: async ({ where, data }) => { if (!db.committee || db.committee.id !== where.id || db.committee.status !== where.status) return { count: 0 }; Object.assign(db.committee, data); return { count: 1 }; },
  },
  committeeMember: {
    findMany: async ({ where }) => db.committee?.members.filter((m) => m.committeeMemberId === where.committeeMemberId).map((m) => ({
      id: m.id, role: m.role,
      committee: { id: db.committee.id, status: db.committee.status, defenseDate: db.committee.defenseDate,
        thesis: { id: 200, title: "Committee", status: t(200).status, student: { id: 9, firstName: "Student", lastName: "Test", email: "student@example.test" } },
        members: db.committee.members.map((member) => ({ role: member.role, member: { user: { firstName: "Member", lastName: String(member.committeeMemberId) } } })) },
    })) || [],
  },
  evaluation: {
    create: async ({ data }) => { if (db.evaluations.some((e) => e.thesisId === data.thesisId && e.committeeMemberId === data.committeeMemberId)) { const error = new Error(); error.code = "P2002"; throw error; } const row = { id: 900 + db.evaluations.length, ...data, evaluationDate: new Date() }; db.evaluations.push(row); return row; },
    findMany: async ({ where }) => db.evaluations.filter((e) => (!where.thesisId || (typeof where.thesisId === "object" ? where.thesisId.in.includes(e.thesisId) : e.thesisId === where.thesisId)) && (!where.committeeMemberId || (typeof where.committeeMemberId === "object" ? where.committeeMemberId.in.includes(e.committeeMemberId) : e.committeeMemberId === where.committeeMemberId))).map((e) => ({ ...e, committeeMember: { user: { id: e.committeeMemberId - 97 + 3, firstName: "Member", lastName: "Test" } } })),
  },
  feedback: {
    findFirst: async ({ where }) => db.feedback.find((f) => f.versionId === where.versionId) || null,
    findMany: async ({ where }) => where.versionId
      ? db.feedback.filter((f) => f.versionId === where.versionId).map((f) => ({ ...f, mentor: { firstName: "Mentor", lastName: "Test" } }))
      : db.feedback.filter((f) => f.mentorId === where.mentorId).map((f) => ({
        ...f,
        version: {
          ...v(f.versionId),
          thesis: {
            ...t(v(f.versionId).thesisId),
            student: { id: t(v(f.versionId).thesisId).studentId, firstName: "Student", lastName: "Test", email: `student${t(v(f.versionId).thesisId).studentId}@example.test`, studentProfile: { studentNumber: `S${t(v(f.versionId).thesisId).studentId}` }, studyProgram: { name: "Computer Science" } },
          },
        },
      })),
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

test("study programs are public and expose only active program identity", async () => {
  const result = await api("/api/study-programs");
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { success: true, programs: [{ id: 1, name: "Computer Science" }] });
});

test("admin directories require an active administrator and return safe account and program summaries", async () => {
  for (const endpoint of ["/api/admin/users", "/api/admin/study-programs"]) {
    assert.equal((await api(endpoint)).status, 401);
    assert.equal((await api(endpoint, { id: 2 })).status, 403);
  }
  const users = await api("/api/admin/users", { id: 1 });
  assert.equal(users.status, 200);
  assert.equal(users.json.users[0].role.name, "ADMIN");
  assert.equal(JSON.stringify(users.json).includes("passwordHash"), false);
  const programs = await api("/api/admin/study-programs", { id: 1 });
  assert.equal(programs.status, 200);
  assert.deepEqual(programs.json.programs.map(({ name, status }) => [name, status]), [["Computer Science", "ACTIVE"], ["Inactive Program", "INACTIVE"]]);
});

test("admin dashboard is role-protected and calculates live summary data", async () => {
  assert.equal((await api("/api/admin/dashboard")).status, 401);
  assert.equal((await api("/api/admin/dashboard", { id: 2 })).status, 403);
  const result = await api("/api/admin/dashboard", { id: 1 });
  assert.equal(result.status, 200);
  assert.equal(result.json.dashboard.totalUsers, db.users.size);
  assert.equal(result.json.dashboard.students, 4);
  assert.equal(result.json.dashboard.studyPrograms, 2);
  assert.equal(result.json.dashboard.activeTheses, 2);
  assert.equal(result.json.dashboard.completedTheses, 0);
  assert.equal(result.json.dashboard.upcomingDefenseCount, 0);
  assert.ok(Array.isArray(result.json.dashboard.upcomingDefenses));
});

test("admin can create and edit programs, while non-admins cannot manage them", async () => {
  assert.equal((await api("/api/admin/study-programs", { id: 2, method: "POST", body: { name: "New Program" } })).status, 403);
  const created = await api("/api/admin/study-programs", { id: 1, method: "POST", body: { name: "New Program", department: "Science", degreeLevel: "Master" } });
  assert.equal(created.status, 201);
  const programId = created.json.program.id;
  assert.equal((await api(`/api/admin/study-programs/${programId}`, { id: 1, method: "PATCH", body: { status: "INACTIVE" } })).json.program.status, "INACTIVE");
  assert.equal((await api("/api/admin/study-programs", { id: 1, method: "POST", body: { name: "  " } })).status, 400);
});

test("admin can change account status without self-deactivation or non-admin access", async () => {
  assert.equal((await api("/api/admin/users/2/status", { id: 2, method: "PATCH", body: { isActive: false } })).status, 403);
  assert.equal((await api("/api/admin/users/1/status", { id: 1, method: "PATCH", body: { isActive: false } })).status, 400);
  assert.equal((await api("/api/admin/users/2/status", { id: 1, method: "PATCH", body: { isActive: false } })).json.user.isActive, false);
  assert.equal((await api("/api/admin/users/2/status", { id: 1, method: "PATCH", body: { isActive: true } })).json.user.isActive, true);
});

test("Committee dashboard returns assigned progress and names without any evaluation grades", async () => {
  assert.equal((await api("/api/committee/dashboard")).status, 401);
  assert.equal((await api("/api/committee/dashboard", { id: 2 })).status, 403);
  await api("/api/committee/thesis/200", { id: 1, method: "POST", body: { members: [{ committeeMemberId: 101, role: "CHAIR" }, { committeeMemberId: 102, role: "MEMBER" }, { committeeMemberId: 103, role: "MEMBER" }] } });
  await api("/api/committee/thesis/200/schedule", { id: 1, method: "PATCH", body: { defenseDate: new Date(Date.now() + 86400000).toISOString() } });
  db.evaluations.push({ id: 1, thesisId: 200, committeeMemberId: 102, grade: 9, comments: "Private" });
  const own = await api("/api/committee/dashboard", { id: 4 });
  assert.equal(own.status, 200);
  assert.equal(own.json.assignments[0].evaluationCount, 1);
  assert.equal(own.json.assignments[0].evaluationSubmitted, false);
  assert.equal(own.json.assignments[0].members.length, 3);
  assert.equal(JSON.stringify(own.json).includes("grade"), false);
  assert.equal(JSON.stringify(own.json).includes("Private"), false);
  const evaluator = await api("/api/committee/dashboard", { id: 5 });
  assert.equal(evaluator.json.assignments[0].evaluationSubmitted, true);
});

test("committee directory is admin-only and returns minimal active identities", async () => {
  assert.equal((await api("/api/committee/members")).status, 401);
  assert.equal((await api("/api/committee/members", { id: 2 })).status, 403);
  const result = await api("/api/committee/members", { id: 1 });
  assert.equal(result.status, 200);
  assert.ok(result.json.members.length > 0);
  assert.equal(JSON.stringify(result.json).includes("passwordHash"), false);
  assert.equal(JSON.stringify(result.json).includes("Inactive Program"), false);
  assert.deepEqual(Object.keys(result.json.members[0]).sort(), ["email", "firstName", "id", "lastName", "userId"].sort());
});

test("committee members see only their assignments and own evaluation", async () => {
  assert.equal((await api("/api/committee/my")).status, 401);
  assert.equal((await api("/api/committee/my", { id: 2 })).status, 403);
  const path = "/api/committee/thesis/200";
  await api(path, { id: 1, method: "POST", body: { members: [
    { committeeMemberId: 101, role: "CHAIR" }, { committeeMemberId: 102, role: "MEMBER" }, { committeeMemberId: 103, role: "MEMBER" },
  ] } });
  await api(path + "/schedule", { id: 1, method: "PATCH", body: { defenseDate: new Date(Date.now() + 86400000).toISOString() } });
  db.committee.defenseDate = new Date(Date.now() - 1000);
  await api(path + "/evaluations", { id: 4, method: "POST", body: { grade: 9, comments: "Own evaluation" } });
  await api(path + "/evaluations", { id: 5, method: "POST", body: { grade: 8, comments: "Other member evaluation" } });
  const own = await api("/api/committee/my", { id: 4 });
  assert.equal(own.status, 200);
  assert.equal(own.json.assignments.length, 1);
  assert.equal(own.json.assignments[0].committee.status, "SCHEDULED");
  assert.ok(own.json.assignments[0].committee.defenseDate);
  assert.deepEqual(own.json.assignments[0].thesis, { id: 200, title: "Committee", status: "SUBMITTED", student: { id: 9, firstName: "Student", lastName: "Test", email: "student@example.test" } });
  assert.deepEqual(own.json.assignments[0].member, { id: 101, role: "CHAIR" });
  assert.equal(own.json.assignments[0].evaluation.comments, "Own evaluation");
  assert.notEqual(own.json.assignments[0].evaluation.comments, "Other member evaluation");
  const memberOne = await api("/api/committee/my", { id: 5 });
  assert.equal(memberOne.json.assignments.length, 1);
  assert.equal(memberOne.json.assignments[0].member.role, "MEMBER");
  assert.equal(memberOne.json.assignments[0].evaluation.comments, "Other member evaluation");
  const unassigned = await api("/api/committee/my", { id: 7 });
  assert.deepEqual(unassigned.json, { success: true, assignments: [] });
  assert.equal(JSON.stringify(own.json).includes("passwordHash"), false);
});

test("Committee admin endpoints list only unassigned SUBMITTED theses and are admin-only", async () => {
  assert.equal((await api("/api/committee/eligible-theses")).status, 401);
  for (const id of [2, 3, 4]) assert.equal((await api("/api/committee/eligible-theses", { id })).status, 403);
  const eligible = await api("/api/committee/eligible-theses", { id: 1 });
  assert.equal(eligible.status, 200);
  assert.deepEqual(eligible.json.theses.map((thesis) => thesis.id), [200]);
  assert.equal((await api("/api/committee/admin", { id: 2 })).status, 403);
  assert.equal((await api("/api/committee/admin", { id: 3 })).status, 403);
  assert.deepEqual((await api("/api/committee/admin", { id: 1 })).json.committees, []);
  const members = [
    { committeeMemberId: 101, role: "CHAIR" }, { committeeMemberId: 102, role: "MEMBER" }, { committeeMemberId: 103, role: "MEMBER" },
  ];
  assert.equal((await api("/api/committee/thesis/200", { id: 1, method: "POST", body: { members } })).status, 201);
  assert.deepEqual((await api("/api/committee/eligible-theses", { id: 1 })).json.theses, []);
  assert.equal((await api("/api/committee/admin", { id: 1 })).json.committees.length, 1);
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
  assert.equal((await api("/api/thesis/versions/1000/reject-final", { id: 3, method: "PATCH", body: { feedback: "No longer eligible" } })).status, 409);
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

test("final rejection stores feedback, preserves thesis progress, and permits no duplicate decision", async () => {
  const start = new Date(); start.setMonth(start.getMonth() - 4); t(100).startedAt = start;
  assert.equal((await api("/api/thesis/my-thesis/versions/1000/submit-final", { id: 2, method: "PATCH" })).status, 200);
  assert.equal((await api("/api/thesis/versions/1000/reject-final", { id: 3, method: "PATCH", body: { feedback: "   " } })).status, 400);
  assert.equal((await api("/api/thesis/versions/1000/reject-final", { id: 8, method: "PATCH", body: { feedback: "Revise" } })).status, 403);
  v(1000).submittedAt = new Date(Date.now() - 8 * 86400000);
  assert.equal((await api("/api/thesis/versions/1000/reject-final", { id: 3, method: "PATCH", body: { feedback: "Revise" } })).json.code, "FINAL_EVALUATION_DEADLINE_EXCEEDED");
  v(1000).submittedAt = new Date();
  const rejected = await api("/api/thesis/versions/1000/reject-final", { id: 3, method: "PATCH", body: { feedback: "Please correct the methodology." } });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.json.version.status, "REVIEWED");
  assert.equal(t(100).status, "IN_PROGRESS");
  assert.equal(rejected.json.feedback.comment, "Please correct the methodology.");
  assert.equal((await api("/api/thesis/versions/1000/approve-final", { id: 3, method: "PATCH" })).status, 400);
  assert.equal((await api("/api/thesis/versions/1000/reject-final", { id: 3, method: "PATCH", body: { feedback: "Again" } })).status, 409);
  assert.equal((await api("/api/thesis/versions/1000/final-approval-status", { id: 3 })).json.available, false);
  const visible = await api("/api/feedback/my-version/1000", { id: 2 });
  assert.equal(visible.status, 200);
  assert.equal(visible.json.feedback[0].comment, "Please correct the methodology.");
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
  assert.equal((await admin("/api/committee/thesis/300", "POST", { members: [chair, first, second] })).status, 400);
  assert.equal((await api(path, { id: 2, method: "POST", body: { members: [chair, first, second] } })).status, 403);
  assert.equal((await api(path, { id: 3, method: "POST", body: { members: [chair, first, second] } })).status, 403);
  db.users.get(4)[0] = "MENTOR";
  assert.equal((await admin(path, "POST", { members: [chair, first, second] })).status, 400);
  db.users.get(4)[0] = "COMMITTEE_MEMBER";
  assert.equal((await admin(path, "POST", { members: [chair, first, second] })).status, 201);
  assert.equal((await admin(path, "POST", { members: [chair, first, second] })).status, 409);
  assert.equal(t(200).status, "SUBMITTED");
  assert.equal(db.committee.status, "ASSIGNED"); assert.equal(db.committee.members.length, 3);
  const retrieved = await admin(path, "GET"); assert.equal(retrieved.status, 200); assert.equal(JSON.stringify(retrieved.json).includes("passwordHash"), false);
  assert.equal((await api(path + "/evaluations", { id: 4, method: "POST", body: { grade: 9 } })).status, 409);
  assert.equal((await admin(path + "/schedule", "PATCH", { defenseDate: "invalid" })).status, 400);
  assert.equal((await admin(path + "/schedule", "PATCH", { defenseDate: "2000-01-01" })).status, 400);
  assert.equal((await admin(path + "/schedule", "PATCH", { defenseDate: new Date(Date.now() + 86400000).toISOString() })).status, 200);
  const evalPath = path + "/evaluations";
  assert.equal((await api(evalPath, { id: 4, method: "POST", body: { grade: 9 } })).status, 409);
  assert.match((await api(evalPath, { id: 4, method: "POST", body: { grade: 9 } })).json.message, /defense date/i);
  db.committee.defenseDate = new Date(Date.now() - 1000);
  assert.equal((await api(evalPath, { id: 7, method: "POST", body: { grade: 9 } })).status, 403);
  assert.equal((await api(evalPath, { id: 4, method: "POST", body: { grade: 5 } })).status, 400);
  assert.equal((await api(evalPath, { id: 4, method: "POST", body: { grade: 11 } })).status, 400);
  assert.equal((await api(evalPath, { id: 4, method: "POST", body: { grade: 9.999 } })).status, 400);
  assert.equal((await api(evalPath, { id: 4, method: "POST", body: { grade: 6, committeeMemberId: 102, memberId: 102 } })).status, 201);
  assert.equal(db.evaluations[0].committeeMemberId, 101);
  let progress = (await admin("/api/committee/admin")).json.committees[0];
  assert.equal(progress.thesis.evaluations.length, 1);
  assert.equal(progress.status, "SCHEDULED");
  assert.equal((await api(path + "/final-decision", { id: 4, method: "POST", body: { finalGrade: 9 } })).status, 409);
  assert.equal((await api(evalPath, { id: 4, method: "POST", body: { grade: 8 } })).status, 409);
  assert.equal((await api(evalPath, { id: 5, method: "POST", body: { grade: 8 } })).status, 201); assert.equal(db.committee.status, "SCHEDULED");
  progress = (await admin("/api/committee/admin")).json.committees[0];
  assert.equal(progress.thesis.evaluations.length, 2);
  assert.equal(progress.status, "SCHEDULED");
  assert.equal((await api(path + "/final-decision", { id: 4, method: "POST", body: { finalGrade: 9 } })).status, 409);
  assert.equal((await api(evalPath, { id: 6, method: "POST", body: { grade: 10 } })).status, 201); assert.equal(db.committee.status, "SCHEDULED");
  progress = (await admin("/api/committee/admin")).json.committees[0];
  assert.equal(progress.thesis.evaluations.length, 3);
  assert.equal(progress.status, "SCHEDULED");
  assert.equal(t(200).status, "SUBMITTED");
  assert.equal((await api(path + "/final-decision", { id: 5, method: "POST", body: { finalGrade: 9, chairId: 4 } })).status, 403);
  assert.equal((await api(path + "/final-decision", { id: 4, method: "POST", body: { finalGrade: 9 } })).status, 200);
  assert.equal(db.committee.finalGrade, 9); assert.equal(db.committee.status, "COMPLETED"); assert.equal(t(200).status, "COMPLETED");
  assert.equal((await admin(path + "/schedule", "PATCH", { defenseDate: new Date(Date.now() + 86400000).toISOString() })).status, 409);
});

test("final decision requires all three evaluations and a Chair decision; agreement and disagreement never average", async () => {
  const path = "/api/committee/thesis/200", evaluationPath = path + "/evaluations", decisionPath = path + "/final-decision";
  await api(path, { id: 1, method: "POST", body: { members: [{ committeeMemberId: 101, role: "CHAIR" }, { committeeMemberId: 102, role: "MEMBER" }, { committeeMemberId: 103, role: "MEMBER" }] } });
  await api(path + "/schedule", { id: 1, method: "PATCH", body: { defenseDate: new Date(Date.now() + 86400000).toISOString() } });
  db.committee.defenseDate = new Date(Date.now() - 1000);
  assert.equal((await api(decisionPath, { id: 4, method: "POST", body: { finalGrade: 9 } })).status, 409);
  assert.equal((await api(decisionPath, { id: 2, method: "POST", body: { finalGrade: 9 } })).status, 403);
  for (const [id, grade] of [[4, 10], [5, 9], [6, 8]]) assert.equal((await api(evaluationPath, { id, method: "POST", body: { grade } })).status, 201);
  assert.equal(db.committee.status, "SCHEDULED"); assert.equal(t(200).status, "SUBMITTED");
  const chairAssignments = await api("/api/committee/my", { id: 4 });
  assert.equal(chairAssignments.json.assignments[0].evaluationCount, 3);
  assert.equal(chairAssignments.json.assignments[0].gradesAgree, false);
  assert.equal(chairAssignments.json.assignments[0].committeeEvaluations.length, 3);
  const memberAssignments = await api("/api/committee/my", { id: 5 });
  assert.equal(memberAssignments.json.assignments[0].committeeEvaluations, undefined);
  assert.equal((await api(decisionPath, { id: 4, method: "POST", body: { finalGrade: 5 } })).status, 400);
  assert.equal((await api(decisionPath, { id: 4, method: "POST", body: { finalGrade: 11 } })).status, 400);
  assert.equal((await api(decisionPath, { id: 4, method: "POST", body: { finalGrade: 9.999 } })).status, 400);
  assert.equal((await api(decisionPath, { id: 4, method: "POST", body: { finalGrade: 9, userId: 5, chairId: 5 } })).status, 200);
  assert.equal(db.committee.finalGrade, 9); assert.equal(db.committee.status, "COMPLETED"); assert.equal(t(200).status, "COMPLETED");
});

test("unanimous evaluation can only be confirmed at the agreed grade", async () => {
  const path = "/api/committee/thesis/200";
  for (const grade of [6, 7, 8, 9, 10]) {
    db = setup();
    await api(path, { id: 1, method: "POST", body: { members: [{ committeeMemberId: 101, role: "CHAIR" }, { committeeMemberId: 102, role: "MEMBER" }, { committeeMemberId: 103, role: "MEMBER" }] } });
    await api(path + "/schedule", { id: 1, method: "PATCH", body: { defenseDate: new Date(Date.now() + 86400000).toISOString() } });
    db.committee.defenseDate = new Date(Date.now() - 1000);
    for (const id of [4, 5, 6]) await api(path + "/evaluations", { id, method: "POST", body: { grade } });
    if (grade === 6) {
      assert.equal((await api(path + "/final-decision", { id: 4, method: "POST", body: { finalGrade: 8 } })).status, 400);
      assert.equal(db.committee.status, "SCHEDULED");
    }
    assert.equal((await api(path + "/final-decision", { id: 4, method: "POST", body: { finalGrade: grade } })).status, 200);
    assert.equal(db.committee.finalGrade, grade);
  }
});

test("students can cancel only their own pending mentor request", async () => {
  assert.equal((await api("/api/mentor-requests/my", { id: 2 })).status, 200);
  assert.equal((await api("/api/mentor-requests/55/cancel", { id: 9, method: "PATCH" })).status, 403);
  assert.equal(db.requests[0].status, "PENDING");
  assert.equal((await api("/api/mentor-requests/55/cancel", { id: 2, method: "PATCH" })).status, 200);
  assert.equal(db.requests[0].status, "CANCELLED");
  assert.equal((await api("/api/mentor-requests/55/cancel", { id: 2, method: "PATCH" })).status, 409);
});

test("mentor thesis listing is authenticated, role-restricted, and scoped to the current mentor", async () => {
  assert.equal((await api("/api/mentor/theses")).status, 401);
  for (const id of [1, 2, 4]) assert.equal((await api("/api/mentor/theses", { id })).status, 403);
  const own = await api("/api/mentor/theses", { id: 3 });
  assert.equal(own.status, 200);
  assert.deepEqual(own.json.theses.map((thesis) => thesis.id), [300, 100]);
  assert.equal(own.json.theses[0].student.studentProfile.studentNumber, "S10");
  assert.equal(JSON.stringify(own.json).includes("passwordHash"), false);
  assert.deepEqual((await api("/api/mentor/theses?mentorId=8", { id: 3 })).json.theses.map((thesis) => thesis.id), [300, 100]);
  assert.deepEqual((await api("/api/mentor/theses", { id: 8 })).json.theses.map((thesis) => thesis.id), [200, 101]);
  assert.deepEqual((await api("/api/mentor/theses", { id: 12 })).json, { success: true, theses: [] });
});

test("mentor feedback history is authenticated, role-restricted, and scoped to the current mentor", async () => {
  assert.equal((await api("/api/mentor/feedbacks")).status, 401);
  for (const id of [1, 2, 4]) assert.equal((await api("/api/mentor/feedbacks", { id })).status, 403);
  db.feedback.push(
    { id: 1, mentorId: 3, versionId: 1000, comment: "Improve the analysis", createdAt: new Date() },
    { id: 2, mentorId: 8, versionId: 1010, comment: "Other mentor note", createdAt: new Date() },
  );
  const own = await api("/api/mentor/feedbacks?mentorId=8", { id: 3 });
  assert.equal(own.status, 200);
  assert.deepEqual(own.json.feedback.map((item) => item.id), [1]);
  assert.equal(own.json.feedback[0].version.thesis.student.studentProfile.studentNumber, "S2");
  assert.deepEqual((await api("/api/mentor/feedbacks", { id: 8 })).json.feedback.map((item) => item.id), [2]);
  assert.deepEqual((await api("/api/mentor/feedbacks", { id: 12 })).json, { success: true, feedback: [] });
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
