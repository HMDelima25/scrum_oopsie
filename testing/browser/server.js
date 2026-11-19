// Deliberately separate from src/server.js. Never connects to Supabase or loads .env.
const express = require("express");
const { buildFixtures } = require("./fixtures");
process.env.GOOGLE_OAUTH_ENABLED = "false";
const port = Number(process.env.BROWSER_TEST_PORT || 5179);
const origin = `http://127.0.0.1:${port}`;
(async () => {
  let state = await buildFixtures(origin);
  const wrapper = express();
  wrapper.get("/_test/registration-code", (req,res)=>res.json({code:state.registrationMessages.at(-1)?.text.match(/code is (\d{6})/)[1]}));
  wrapper.get("/_test/ready", (req, res) => res.json({ isolated: true }));
  wrapper.get("/_test/fixtures", (req, res) => res.json({ ids: state.ids }));
  wrapper.post("/_test/reset", async (req, res, next) => {
    try {
      const previous = state;
      state = await buildFixtures(origin);
      await previous.db.pg.close();
      res.json({ isolated: true });
    } catch (error) {
      next(error);
    }
  });
  wrapper.use((req, res, next) => state.app(req, res, next));
  const server = wrapper.listen(port, "127.0.0.1", () =>
    console.log(`Isolated browser test server: ${origin}`),
  );
  const close = () =>
    server.close(() => state.db.pg.close().then(() => process.exit(0)));
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
})().catch(() => {
  console.error("Could not start isolated browser fixtures.");
  process.exitCode = 1;
});
