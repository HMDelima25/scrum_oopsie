const router = require("express").Router();
const resources = require("../config/resources");
const ui = require("../config/ui.json");
const { requireUser } = require("../middleware/auth.middleware");
const { allowed } = require("../lib/permissions");
const { wrap, check, HttpError } = require("../lib/http");
router.use(requireUser);
router.get("/ui-schema", (req, res) =>
  res.json({ status: "success", data: { ...ui, resources } }),
);
router.get("/ui-bootstrap", wrap(async(req,res)=>{
  const group=ui.groups[req.query.screen];
  if(!Array.isArray(group))throw new HttpError(400,"Unknown workspace.");
  const views=group.filter(key=>{const c=resources[key];return !c||allowed(req.user,`${c.module}.${c.read||"view"}`);});
  const view=views.includes(req.query.view)?req.query.view:views[0];
  const {id,username,email,name,role,status,rights}=req.user;
  const records=resources[view]?await require("../lib/list-records")(req,view):null;
  res.json({status:"success",data:{user:{id,username,email,name,role,status,rights},schema:{...ui,resources},view,records}});
}));
router.get("/ui-dashboard-data",wrap(async(req,res)=>{
  const names=["customers","products","prices","employees","departments","jobs","sales","payments"];
  const records={};
  await Promise.all(names.map(async name=>{
    const c=resources[name];records[name]=[];
    if(!allowed(req.user,`${c.module}.${c.read||"view"}`))return;
    let offset=0;
    while(true){
      const result=await require("../lib/list-records")({app:req.app,user:req.user,query:{status:"active",limit:"200",offset:String(offset)}},name);
      records[name].push(...result.data);offset+=result.data.length;
      if(offset>=result.count||!result.data.length)break;
    }
  }));
  const {id,username,email,name,role,status,rights}=req.user;
  res.json({status:"success",data:{user:{id,username,email,name,role,status,rights},records}});
}));
router.get("/next-code/:resource",wrap(async(req,res)=>{
 const code=ui.autoCodes[req.params.resource],c=resources[req.params.resource];
 if(!code||!c)throw new HttpError(400,"This record uses related keys rather than a generated code.");
 if(!allowed(req.user,`${c.module}.${c.actions[0]}`))throw new HttpError(403,"Adding this record is not permitted.");
 let prefixes=[];
 if(code.departmentPrefix){
  if(req.query.prefix!==undefined)throw new HttpError(400,'Choose an existing department instead of a job prefix.');
  if(req.query.deptcode===undefined)return res.json({status:'success',data:{field:code.field,code:null,prefix:null,prefixes:[]}});
  if(typeof req.query.deptcode!=='string'||req.query.deptcode.length>3)throw new HttpError(400,'Choose an existing department.');
  const prefix=check(await req.app.locals.db.rpc('hope_department_job_prefix',{p_deptcode:req.query.deptcode})),value=check(await req.app.locals.db.rpc('hope_next_code',{p_table:c.table,p_prefix:prefix,p_reserve:false}));
  return res.json({status:'success',data:{field:code.field,code:value,prefix,prefixes:[]}});
 }
 if(code.choosePrefix){
   const capacity=ui.fields[code.field][2];let offset=0;
   while(true){const result=await req.app.locals.db.from(c.table).select(code.field,{count:"exact"}).order(code.field).range(offset,offset+499);const rows=check(result);prefixes.push(...rows.map(r=>(r[code.field].match(/^[A-Z]+/)||[""])[0].slice(0,capacity-1)).filter(Boolean));offset+=rows.length;if(offset>=result.count||!rows.length)break;}
   prefixes=[...new Set(prefixes)].sort();if(!prefixes.length)prefixes=[{products:"AD",departments:"AC",jobs:"SA"}[req.params.resource]];
 }
 if(req.query.prefix!==undefined && (typeof req.query.prefix!=="string" || !prefixes.includes(req.query.prefix)))throw new HttpError(400,"Choose an available code prefix.");
 const prefix=code.choosePrefix?(req.query.prefix||prefixes[0]):null;
 const value=check(await req.app.locals.db.rpc("hope_next_code",{p_table:c.table,p_prefix:prefix,p_reserve:false}));
 res.json({status:"success",data:{field:code.field,code:value,prefix,prefixes}});
}));
const choices = {
  customers: ["custno", "custname"],
  products: ["prodcode", "description", "unit"],
  employees: ["empno", "firstname", "lastname"],
  departments: ["deptcode", "deptname"],
  jobs: ["jobcode", "jobname", "jobdesc"],
  sales: ["transno", "salesdate", "custno"],
};
router.get(
  "/lookups/:resource",
  wrap(async (req, res) => {
    const name = req.params.resource;
    const purpose = resources[req.query.for];
    const fields = choices[name];
    if (
      !purpose ||
      !fields ||
      ![
        ...Object.values(ui.lookups[req.query.for] || {}),
        ...(req.query.for === "sales" ? ["products"] : []),
        ...(req.query.for === "reports" ? ["employees"] : []),
      ].includes(name)
    ) {
      if (
        !(
          req.query.for === "reports" &&
          name === "employees" &&
          allowed(req.user, "reports.empJobHistory")
        )
      )
        throw new HttpError(400, "Unsupported record choice.");
    }
    if (
      req.query.for !== "reports" &&
      !allowed(req.user, `${purpose.module}.${purpose.actions[0]}`) &&
      !allowed(req.user, `${purpose.module}.${purpose.actions[1]}`)
    )
      throw new HttpError(403, "These choices are not permitted.");
    const c = resources[name];
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const result = await req.app.locals.db
      .from(c.table)
      .select(fields.join(","), { count: "exact" })
      .eq("is_deleted", false)
      .order(c.pk[0])
      .range(offset, offset + 199);
    res.json({ status: "success", data: check(result), count: result.count });
  }),
);
router.get(
  "/sale-price",
  wrap(async (req, res) => {
    if (
      !allowed(req.user, "sales.add") &&
      !allowed(req.user, "sales.detailAdd") &&
      !allowed(req.user, "sales.detailEdit")
    )
      throw new HttpError(403, "Sales access required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date || ""))
      throw new HttpError(400, "Select a sale date.");
    const row = check(
      await req.app.locals.db
        .from("pricehist")
        .select("unitprice,effdate")
        .eq("prodcode", req.query.product)
        .eq("is_deleted", false)
        .lte("effdate", req.query.date)
        .order("effdate", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    res.json({ status: "success", data: row });
  }),
);
module.exports = router;
