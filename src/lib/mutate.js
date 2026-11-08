const { check, HttpError } = require("./http");
module.exports = async function mutate(req, args) {
  const expected = req.get("if-match");
  if (expected && args.p_operation === "update") {
    let value;
    try {
      value = JSON.parse(expected);
    } catch {
      throw new HttpError(400, "Invalid record version.");
    }
    return check(
      await req.app.locals.db.rpc("hope_mutate_checked", {
        ...args,
        p_expected: value,
      }),
    );
  }
  const auto=Object.values(require("../config/ui.json").autoCodes).find(c=>c.table===args.p_table);
  if(args.p_operation==="insert" && auto && !args.p_data?.[auto.field])return check(await req.app.locals.db.rpc("hope_insert_auto",{
    p_actor:args.p_actor,p_table:args.p_table,p_data:args.p_data,p_prefix:args.p_table==='job'?args.p_data.jobprefix:req.body._code_prefix??null
  }));
  return check(await req.app.locals.db.rpc("hope_mutate", args));
};
