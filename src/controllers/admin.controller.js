const { check, HttpError, text, email, object } = require("../lib/http");
const { normalizeRights } = require("../lib/permissions");
const { issueToken } = require("../lib/tokens");
const safe =
  "id,username,email,name,status,role,rights,permission_role_id,created_at,is_deleted,updated_at";
async function target(req) {
  const user = check(
    await req.app.locals.db
      .from("users")
      .select(safe)
      .eq("id", req.params.id)
      .maybeSingle(),
  );
  if (!user || user.is_deleted) throw new HttpError(404, "User not found.");
  if (req.user.role === "admin" && user.role !== "user")
    throw new HttpError(403, "Admins manage Users only.");
  return user;
}
async function mutate(req, p_operation, p_data, p_key = {}) {
  return require("../lib/mutate")(req, {
    p_actor: req.user.id,
    p_table: "users",
    p_operation,
    p_data,
    p_key,
  });
}

async function getUsersList(req, res) {
  let q = req.app.locals.db.from("users").select(safe,{count:"exact"});
  const status=req.query.status||"active";
  if(!["active","inactive","all"].includes(status))throw new HttpError(400,"Unknown record status.");
  if(status!=="all")q=q.eq("is_deleted",status==="inactive");
  if(req.user.role==="admin")q=q.eq("role","user");
  q=require("../lib/table-query")(q,req.query,"users",safe.split(","),["id"],req.user);
  const limit=Math.min(200,Math.max(1,parseInt(req.query.limit)||50)),offset=Math.max(0,parseInt(req.query.offset)||0);
  const result=await q.range(offset,offset+limit-1);
  const rows=check(result);const ids=[...new Set(rows.map(u=>u.permission_role_id).filter(Boolean))];
  const profiles=ids.length?check(await req.app.locals.db.from("permission_role").select("id,name,status").in("id",ids)):[];
  for(const row of rows){const profile=profiles.find(p=>p.id===row.permission_role_id);row.permission_role=profile?profile.name+(profile.status==='inactive'?' (inactive)':''):'Custom permissions';}
  res.json({status:"success",access:{role:req.user.role,rights:req.user.rights},data:rows,count:result.count,limit,offset});
}
async function addUser(req, res) {
  const b = object(req.body);
  const row = {
    name: text(
      b.name || [b.firstName, b.lastName].filter(Boolean).join(" "),
      "Name",
    ),
    email: email(b.email),
    role: b.role || "user",
    status: "pending",
  };
  if (req.user.role === "admin" && row.role !== "user")
    throw new HttpError(403, "Admins create Users only.");
  if (!["admin", "user"].includes(row.role))
    throw new HttpError(
      400,
      "Use User or Admin; bootstrap Superadmins from the server.",
    );
  const data = await mutate(req, "insert", row);
  res.status(201).json({
    status: "success",
    message: "Pending account created. Approve and send a setup invitation.",
    data,
  });
}
async function updateUser(req, res) {
  const account=await target(req);
  const b = object(req.body);
  const update = {};
  for (const key of Object.keys(b))
    if (!["name", "email", "role", "status"].includes(key))
      throw new HttpError(400, `Unsupported field: ${key}`);
  if (b.name !== undefined) update.name = text(b.name, "Name");
  if (b.email !== undefined) update.email = email(b.email);
  if (b.role !== undefined) {
    if (req.user.role !== "superadmin")
      throw new HttpError(403, "Only Superadmin designates roles.");
    if (!["user", "admin"].includes(b.role))
      throw new HttpError(400, "Only User/Admin designation is supported.");
    update.role = b.role;
    if(b.role!=="user")update.permission_role_id=null;
  }
  if (b.status !== undefined) {
    if (!["pending", "approved", "blocked"].includes(b.status))
      throw new HttpError(400, "Invalid status.");
    if (b.status === "approved" && req.user.role !== "superadmin")
      throw new HttpError(403, "Superadmin approval required.");
    update.status = b.status;
  }
  const data = await mutate(req, "update", update, { id: req.params.id });
  res.json({ status: "success", data });
}
async function toggleUserStatus(req, res) {
  const u = await target(req);
  const status = object(req.body).status;
  if (!["approved", "blocked"].includes(status))
    throw new HttpError(400, "Choose approved or blocked.");
  if (status === "approved" && req.user.role !== "superadmin")
    throw new HttpError(403, "Superadmin approval required.");
  const data = await mutate(req, "update", { status }, { id: req.params.id });
  res.json({ status: "success", data });
}
async function getUserRights(req, res) {
  const u = await target(req);
  res.json({ status: "success", data: u.rights });
}
async function updateUserRights(req, res) {
  const account=await target(req);
  if(account.role==="superadmin")throw new HttpError(400,"Superadmin access is fixed and cannot be customized.");
  const rights = normalizeRights(object(req.body).rights);
  const data = await mutate(req, "update", { rights,permission_role_id:null }, { id: req.params.id });
  res.json({ status: "success", data: { id: data.id, rights: data.rights } });
}
async function inviteUser(req, res) {
  const u = await target(req);
  if (u.status !== "approved")
    throw new HttpError(
      400,
      "Approve the account before sending a setup invitation.",
    );
  await issueToken(req.app.locals.db, u, "setup");
  res.json({
    status: "success",
    message:
      process.env.MAIL_DELIVERY === "local"
        ? "Setup link saved to private local outbox; no email was sent."
        : "Setup invitation sent.",
  });
}
module.exports = {
  getUsersList,
  addUser,
  updateUser,
  toggleUserStatus,
  getUserRights,
  updateUserRights,
  inviteUser,
};
