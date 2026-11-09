const catalogue = require("../config/rights.json");
const { HttpError, object } = require("./http");
function allowed(user, key) {
  if (user.role === "superadmin") return true;
  const module = key.split(".")[0];
  return (
    user.rights?.[`${module}.view`] === true && user.rights?.[key] === true
  );
}
function normalizeRights(value) {
  object(value);
  const result = {};
  for (const [key, v] of Object.entries(value)) {
    if (!Object.hasOwn(catalogue,key) || typeof v !== "boolean")
      throw new HttpError(400, `Unknown right or non-boolean value: ${key}`);
    result[key] = v;
  }
  for(const key of Object.keys(result))if(!key.endsWith(".view")&&result[key.split(".")[0]+".view"]!==true)result[key]=false;
  return result;
}
module.exports = { catalogue, allowed, normalizeRights };
