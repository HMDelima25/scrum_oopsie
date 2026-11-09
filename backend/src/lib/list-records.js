const resources=require("../config/resources");
const ui=require("../config/ui.json");
const {check,HttpError}=require("./http");
module.exports=async function listRecords(req,path){
 const c=resources[path];
      let q = req.app.locals.db
        .from(c.listView||c.table)
        .select(
          req.user.role === "user"
            ? [...new Set([...c.pk, ...c.fields, ...(c.readFields||[]), "updated_at"])].join(",")
            : "*",
          {
            count: "exact",
          },
        );
      if (req.user.role === "user" || req.query.status !== "all")
        q = q.eq(
          "is_deleted",
          req.user.role !== "user" && req.query.status === "inactive",
        );
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
      const offset = Math.max(0, parseInt(req.query.offset) || 0);
      const filterFields = [...new Set([...c.pk, ...(ui.listFilters[path] || [])])];
      for (const field of filterFields) {
        if (req.query[field] === undefined) continue;
        if (typeof req.query[field] !== "string" || !req.query[field].trim() || req.query[field].length > 100)
          throw new HttpError(400, "Invalid record filter.");
        q = q.eq(field, req.query[field]);
      }
      if(req.query.status!==undefined && !["active","inactive","all"].includes(req.query.status))throw new HttpError(400,"Unknown record status.");
      q = require("./table-query")(q,req.query,path,[...new Set([...c.pk,...c.fields,...(c.readFields||[]),"is_deleted","stamp","updated_at"])],c.pk,req.user).range(offset, offset + limit - 1);
      const result = await q;
      const rows = check(result);
      if (rows.length && ["products", "sales"].includes(path)) {
        const key = path === "products" ? "prodcode" : "transno";
        const computed = check(
          await req.app.locals.db
            .from(
              path === "products" ? "product_current_price" : "sales_balance",
            )
            .select(
              path === "products"
                ? "prodcode,unitprice,effdate"
                : "transno,total,paid,balance",
            )
            .in(
              key,
              rows.map((row) => row[key]),
            ),
        );
        const byKey = new Map(computed.map((row) => [row[key], row]));
        for (const row of rows) {
          const extra = byKey.get(row[key]);
          if (path === "products") {
            row.current_price = extra?.unitprice ?? null;
            row.price_effective_date = extra?.effdate ?? null;
          } else {
            row.total = extra?.total ?? null;
            row.paid = extra?.paid ?? null;
            row.balance = extra?.balance ?? null;
          }
        }
      }
      return {
        status: "success",
        access:{role:req.user.role,rights:req.user.rights},
        data: rows,
        count: result.count,
        limit,
        offset,
      };
};
