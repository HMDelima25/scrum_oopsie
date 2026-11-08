const { PGlite } = require("@electric-sql/pglite");
const fs = require("node:fs/promises");
const path = require("node:path");
const identifier = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error("Unsafe identifier");
  return `"${s}"`;
};
// Test-only PostgREST adapter. Every operation executes against actual PostgreSQL
// tables/functions/triggers in PGlite; it does not fabricate query results.
async function createDatabase() {
  const pg = new PGlite();
  await pg.exec(
    `CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;`,
  );
  const sql = await fs.readFile(
    path.join(__dirname, "../../db/migrations/20261107000100_hope_erp.sql"),
    "utf8",
  );
  await pg.exec(sql.split("-- migrate:down")[0]);
  await pg.exec(
    (
      await fs.readFile(
        path.join(
          __dirname,
          "../../db/migrations/20261107000200_live_ui_versions.sql",
        ),
        "utf8",
      )
    ).split("-- migrate:down")[0],
  );
  await pg.exec((await fs.readFile(path.join(__dirname,'../../db/migrations/20261107000300_account_signin.sql'),'utf8')).split('-- migrate:down')[0]);
  await pg.exec((await fs.readFile(path.join(__dirname,'../../db/migrations/20261107000500_automatic_codes.sql'),'utf8')).split('-- migrate:down')[0]);
  await pg.exec((await fs.readFile(path.join(__dirname,'../../db/migrations/20261108000700_permission_roles.sql'),'utf8')).split('-- migrate:down')[0]);
  await pg.exec((await fs.readFile(path.join(__dirname,'../../db/migrations/20261108000800_inactivate_together.sql'),'utf8')).split('-- migrate:down')[0]);
  await pg.exec((await fs.readFile(path.join(__dirname,'../../db/migrations/20261108000900_job_fields.sql'),'utf8')).split('-- migrate:down')[0]);
  await pg.exec((await fs.readFile(path.join(__dirname,'../../db/migrations/20261108001000_employee_lifecycle.sql'),'utf8')).split('-- migrate:down')[0]);
  await pg.exec((await fs.readFile(path.join(__dirname,'../../db/migrations/20261108001200_employee_directory.sql'),'utf8')).split('-- migrate:down')[0]);
  await pg.exec((await fs.readFile(path.join(__dirname,'../../db/migrations/20261108001300_hr_record_members.sql'),'utf8')).split('-- migrate:down')[0]);
  const db = {
    pg,
    from(table) {
      return new Query(pg, table);
    },
    async rpc(name, args) {
      try {
        const names = Object.keys(args);
        const q = `SELECT public.${identifier(name)}(${names.map((n, i) => `${identifier(n)}=>$${i + 1}`).join(",")}) result`;
        const { rows } = await pg.query(q, Object.values(args));
        return { data: rows[0].result, error: null };
      } catch (error) {
        return {
          data: null,
          error: { code: error.code, message: error.message },
        };
      }
    },
  };
  return db;
}
class Query {
  constructor(pg, table) {
    this.pg = pg;
    this.table = table;
    this.filters = [];
    this.orders = [];
    this.mode = "select";
    this.fields = "*";
  }
  select(fields = "*", options = {}) {
    this.fields = fields;
    this.options = options;
    this.returning = true;
    return this;
  }
  eq(k, v) {
    this.filters.push([k, v, "="]);
    return this;
  }
  in(k, v) {
    this.filters.push([k, v, "IN"]);
    return this;
  }
  lte(k, v) {
    this.filters.push([k, v, "<="]);
    return this;
  }
  ilike(k,v){this.filters.push([k,v,"ILIKE"]);return this;}
  gte(k,v){this.filters.push([k,v,">="]);return this;}
  is(k,v){this.filters.push([k,v,"IS"]);return this;}
  not(k,op,v){if(op!=="is")throw new Error("Unsupported test operator");this.filters.push([k,v,"IS NOT"]);return this;}
  or(expression){
    const parts=[];let start=0,quote=false,escaped=false;
    for(let i=0;i<expression.length;i++){const ch=expression[i];if(escaped){escaped=false;continue;}if(ch==="\\"){escaped=true;continue;}if(ch==='"')quote=!quote;if(ch===','&&!quote){parts.push(expression.slice(start,i));start=i+1;}}
    parts.push(expression.slice(start));
    this.orFilters=parts.map(part=>{const match=part.match(/^([a-z_]+)\.ilike\.(".*")$/);if(!match)throw new Error("Unsupported test OR filter");return [match[1],JSON.parse(match[2])];});return this;
  }
  order(k, { ascending = true } = {}) {
    this.orders.push(`${identifier(k)} ${ascending ? "ASC" : "DESC"}`);
    return this;
  }
  limit(n) {
    this.take = n;
    return this;
  }
  range(a, b) {
    this.offset = a;
    this.take = b - a + 1;
    return this;
  }
  insert(v) {
    this.mode = "insert";
    this.value = v;
    return this;
  }
  upsert(v) {
    this.mode = "upsert";
    this.value = v;
    return this;
  }
  update(v) {
    this.mode = "update";
    this.value = v;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  maybeSingle() {
    this.maybe = true;
    return this;
  }
  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }
  async run() {
    try {
      const params = [];
      const bind = (v) => {
        params.push(
          typeof v === "object" && v !== null ? JSON.stringify(v) : v,
        );
        return `$${params.length}`;
      };
      const table = identifier(this.table);
      let sql;
      const fields =
        this.fields === "*"
          ? "*"
          : this.fields.split(",").map(identifier).join(",");
      if (["insert", "upsert"].includes(this.mode)) {
        const value = Array.isArray(this.value) ? this.value[0] : this.value;
        const keys = Object.keys(value);
        sql = `INSERT INTO ${table}(${keys.map(identifier).join(",")}) VALUES(${keys.map((k) => bind(value[k])).join(",")})`;
        if (this.mode === "upsert")
          sql += ` ON CONFLICT (${identifier(this.table === "app_session" ? "sid" : "key")}) DO UPDATE SET ${keys.map((k) => `${identifier(k)}=excluded.${identifier(k)}`).join(",")}`;
      } else if (this.mode === "update")
        sql = `UPDATE ${table} SET ${Object.entries(this.value)
          .map(([k, v, op = "="]) =>
            op === "IN"
              ? `${identifier(k)} IN (${v.map(bind).join(",")})`
              : `${identifier(k)}${op}${bind(v)}`,
          )
          .join(",")}`;
      else
        sql =
          this.mode === "delete"
            ? `DELETE FROM ${table}`
            : `SELECT ${fields} FROM ${table}`;
      if (this.filters.length)
        sql +=
          " WHERE " +
          this.filters
            .map(([k, v, op = "="]) =>
              op === "IN"
                ? `${identifier(k)} IN (${v.map(bind).join(",")})`
                : ["IS","IS NOT"].includes(op) ? `${identifier(k)} ${op} NULL` : `${identifier(k)} ${op} ${bind(v)}`,
            )
            .join(" AND ");
      if(this.orFilters?.length){sql+=(this.filters.length?" AND ":" WHERE ")+"("+this.orFilters.map(([k,v])=>`${identifier(k)} ILIKE ${bind(v)}`).join(" OR ")+")";}
      let exactCount;
      if(this.mode==="select"&&this.options?.count==="exact")exactCount=Number((await this.pg.query(sql.replace(/^SELECT .*? FROM /,"SELECT count(*) AS n FROM "),params)).rows[0].n);
      if (this.mode === "select") {
        if (this.orders.length) sql += " ORDER BY " + this.orders.join(",");
        if (this.take !== undefined) sql += ` LIMIT ${this.take}`;
        if (this.offset) sql += ` OFFSET ${this.offset}`;
      } else if (this.returning) sql += " RETURNING " + fields;
      const { rows } = await this.pg.query(sql, params);
      if (this.one && rows.length !== 1)
        return {
          data: null,
          error: { code: "PGRST116", message: "Record not found" },
        };
      return {
        data: this.options?.head
          ? null
          : this.one || this.maybe
            ? rows[0] || null
            : rows,
        error: null,
        count: exactCount ?? rows.length,
      };
    } catch (e) {
      return { data: null, error: { code: e.code, message: e.message } };
    }
  }
}
module.exports = { createDatabase };
