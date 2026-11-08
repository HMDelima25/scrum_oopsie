const listRecords = require("../lib/list-records");
const mutateChecked = require("../lib/mutate");
const mutationResult = async (req, args) => ({
  data: await mutateChecked(req, args),
  error: null,
});
const router = require("express").Router();
const resources = require("../config/resources");
const ui = require("../config/ui.json");
const {
  requireUser,
  checkPermission,
} = require("../middleware/auth.middleware");
const { wrap, check, HttpError, object } = require("../lib/http");
const { allowed } = require("../lib/permissions");
router.use(requireUser);
router.post('/employees/:key/fire',require('../middleware/auth.middleware').requireAdmin,checkPermission('hr','empEdit'),checkPermission('hr','empDelete'),wrap(async(req,res)=>{
  if(object(req.body).confirm!==true||Object.keys(req.body).some(k=>k!=='confirm'))throw new HttpError(400,'Confirm firing this employee first.');
  let expected;try{expected=JSON.parse(req.get('if-match')||'null');}catch{throw new HttpError(400,'Invalid employee version.');}
  if(typeof expected!=='string'||!Number.isFinite(Date.parse(expected)))throw new HttpError(400,'Reopen the employee before confirming.');
  const result=check(await req.app.locals.db.rpc('hope_fire_employee',{p_actor:req.user.id,p_empno:req.params.key,p_expected:expected}));res.json({status:'success',data:result});
}));
router.get(
  "/dashboard",
  wrap(async (req, res) => {
    const modules = ["customers", "products", "hr", "sales", "reports"].filter(
      (m) => allowed(req.user, `${m}.view`),
    );
    const counts = {};
    for (const [resource, module] of [
      ["customers", "customers"],
      ["products", "products"],
      ["employees", "hr"],
      ["sales", "sales"],
    ]) {
      if (!modules.includes(module)) continue;
      const { error, count } = await req.app.locals.db
        .from(resources[resource].table)
        .select("*", { count: "exact", head: true })
        .eq("is_deleted", false);
      check({ error });
      counts[resource] = count;
    }
    res.json({
      status: "success",
      data: {
        modules,
        counts,
        administration:
          req.user.role === "superadmin"
            ? ["users", "settings"]
            : req.user.role === "admin"
              ? ["users"]
              : [],
      },
    });
  }),
);
function key(c, value) {
  const parts = value.split("~");
  if (parts.length !== c.pk.length || parts.some((v) => !v))
    throw new HttpError(400, `Key must contain ${c.pk.join("~")}.`);
  return Object.fromEntries(c.pk.map((k, i) => [k, parts[i]]));
}
function data(c, input, update = false) {
  object(input);
  if (!Object.keys(input).length)
    throw new HttpError(400, "Fields are required.");
  for (const k of Object.keys(input))
    if (!c.fields.includes(k) || (update && c.pk.includes(k)))
      throw new HttpError(400, `Unsupported or immutable field: ${k}`);
  for (const [k, v] of Object.entries(input)) {
    if (v !== null && !["string", "number"].includes(typeof v))
      throw new HttpError(400, `Invalid value: ${k}`);
    if (typeof v === "number" && !Number.isFinite(v))
      throw new HttpError(400, `Invalid number: ${k}`);
  }
  return input;
}
function filtered(q, k) {
  for (const [name, v] of Object.entries(k)) q = q.eq(name, v);
  return q;
}
function visible(req, row) {
  if (req.user.role === "user") {
    const { stamp, is_deleted, ...data } = row;
    return data;
  }
  return row;
}
for (const [path, c] of Object.entries(resources)) {
  router.get(`/${path}/:key/inactivation`,checkPermission(c.module,c.actions[2]),wrap(async(req,res)=>{
    const plan=check(await req.app.locals.db.rpc('hope_inactivation_plan',{p_actor:req.user.id,p_table:c.table,p_key:key(c,req.params.key)}));
    res.json({status:'success',data:plan});
  }));
  router.post(`/${path}/:key/inactivate`,checkPermission(c.module,c.actions[2]),wrap(async(req,res)=>{
    const plan=object(req.body).plan;if(!Array.isArray(plan))throw new HttpError(400,'Review the affected records first.');
    const result=check(await req.app.locals.db.rpc('hope_inactivate_together',{p_actor:req.user.id,p_table:c.table,p_key:key(c,req.params.key),p_plan:plan}));
    res.json({status:'success',data:result});
  }));
  const read = checkPermission(c.module, c.read || "view");
  router.get(
    `/${path}`,
    read,
    wrap(async (req, res) => {
      res.json(await listRecords(req,path));
    }),
  );
  router.get(
    `/${path}/:key`,
    read,
    wrap(async (req, res) => {
      let q = filtered(
        req.app.locals.db
          .from(c.listView||c.table)
          .select(
            req.user.role === "user"
              ? [...new Set([...c.pk, ...c.fields, ...(c.readFields||[]), "updated_at"])].join(",")
              : "*",
          ),
        key(c, req.params.key),
      );
      if (req.user.role === "user") q = q.eq("is_deleted", false);
      const row = check(await q.maybeSingle());
      if (!row) throw new HttpError(404, "Record not found.");
      res.json({ status: "success", data: row });
    }),
  );
  router.post(
    `/${path}`,
    checkPermission(c.module, c.actions[0]),
    wrap(async (req, res) => {
      let result;
      if(path==='employees'){
        const {job_assignment,...employee}=object(req.body);data(c,employee);
        if(job_assignment!==undefined){object(job_assignment);if(!allowed(req.user,'hr.jhAdd'))throw new HttpError(403,'Add Job History permission required to assign a job.');
          for(const field of Object.keys(job_assignment))if(!['jobcode','deptcode','effdate','salary'].includes(field))throw new HttpError(400,'Unsupported assignment field.');
          if(typeof job_assignment.jobcode!=='string'||!job_assignment.jobcode.trim()||typeof job_assignment.salary!=='number'||!Number.isFinite(job_assignment.salary)||job_assignment.salary<0)throw new HttpError(400,'Choose a job and enter a nonnegative salary.');
        }
        const saved=check(await req.app.locals.db.rpc('hope_create_employee',{p_actor:req.user.id,p_data:employee,p_assignment:job_assignment??null}));if(saved.job_assignment)saved.job_assignment=visible(req,saved.job_assignment);return res.status(201).json({status:'success',data:visible(req,saved)});
      }
      if(path==='jobs'&&!req.body.jobcode){
        const {text}=require('../lib/http');
        req.body.jobname=text(req.body.jobname,'Job name',80);
        req.body.jobdesc=text(req.body.jobdesc,'Job description',500);
        req.body.jobprefix=text(req.body.jobprefix,'Job prefix',3).toUpperCase();
        if(!/^[A-Z]{1,3}$/.test(req.body.jobprefix))throw new HttpError(400,'Job prefix must use 1–3 letters.');
      }
      if (path === "sales") {
        const b = object(req.body);
        if (!allowed(req.user, "sales.detailAdd"))
          throw new HttpError(403, "Add Sale Detail right is required.");
        const { lines, ...header } = b;
        data(c, header);
        if (!Array.isArray(lines) || !lines.length || lines.length > 200)
          throw new HttpError(400, "Provide 1–200 sale lines.");
        for (const line of lines) {
          data(resources["sale-details"], line);
          if (line.transno !== undefined)
            throw new HttpError(
              400,
              "Transaction number is generated by the server.",
            );
        }
        result = await req.app.locals.db.rpc("hope_create_sale", {
          p_actor: req.user.id,
          p_header: header,
          p_lines: lines,
        });
      } else
        result = await mutationResult(req, {
          p_actor: req.user.id,
          p_table: c.table,
          p_operation: "insert",
          p_key: {},
          p_data: data(c, Object.fromEntries(Object.entries(object(req.body)).filter(([key])=>key!=="_code_prefix"))),
        });
      res
        .status(201)
        .json({ status: "success", data: visible(req, check(result)) });
    }),
  );
  router.patch(
    `/${path}/:key`,
    checkPermission(c.module, c.actions[1]),
    wrap(async (req, res) =>
      res.json({
        status: "success",
        data: visible(
          req,
          check(
            await mutationResult(req, {
              p_actor: req.user.id,
              p_table: c.table,
              p_operation: "update",
              p_key: key(c, req.params.key),
              p_data: data(c, req.body, true),
            }),
          ),
        ),
      }),
    ),
  );
  for (const [verb, deleted] of [
    ["delete", true],
    ["restore", false],
  ]) {
    const method = verb === "delete" ? "delete" : "post";
    const url = `/${path}/:key${verb === "restore" ? "/restore" : ""}`;
    router[method](
      url,
      checkPermission(c.module, c.actions[2]),
      wrap(async (req, res) =>
        res.json({
          status: "success",
          data: visible(
            req,
            check(
              await mutationResult(req, {
                p_actor: req.user.id,
                p_table: c.table,
                p_operation: "update",
                p_key: key(c, req.params.key),
                p_data: { is_deleted: deleted },
              }),
            ),
          ),
        }),
      ),
    );
  }
}
module.exports = router;
