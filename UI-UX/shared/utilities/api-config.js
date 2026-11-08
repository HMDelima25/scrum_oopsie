(() => {
  if (window.API_BASE !== undefined) return;
  const { protocol, hostname, port } = window.location;
  const localDevServer = port !== "5000" && Boolean(port);
  window.API_BASE = localDevServer
    ? `${protocol}//${hostname}:5000`
    : "";
})();
