import type { Plugin } from "vite";

export function mendixPatchViteClientPlugin(): Plugin {
  return {
    name: "mendix-patch-vite-client",
    enforce: "pre",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";

        if (url.includes("@react-refresh")) {
          const transformed = await server.transformRequest("/@react-refresh");

          if (!transformed?.code) {
            next();
            return;
          }

          res.setHeader(
            "Content-Type",
            "application/javascript; charset=utf-8",
          );
          res.end(transformed.code);
          return;
        }

        if (url.includes("@vite/client")) {
          const requestPath = url.includes("client.mjs")
            ? "/@vite/client.mjs"
            : "/@vite/client";
          const transformed = await server.transformRequest(requestPath);
          let code = transformed?.code || "";
          const rePageReload =
            /const\s+pageReload\s*=\s*debounceReload\(\s*(\d+)\s*\)/;
          const m = code.match(rePageReload);

          if (m) {
            const delay = m[1];
            const injectScript = `
const __mx_debounceReload = (time) => {
  let timer;
  return () => {
    if (timer) { clearTimeout(timer); timer = null; }

    timer = setTimeout(() => {
      try {
        const mx = (typeof window !== 'undefined') ? window.mx : undefined;

        if (mx) {
          mx.reloadWithState();
          return;
        }
      } catch (e) {
        console.warn('[patch-vite-client-debounce] mx.reloadWithState failed:', e);
      }

      location.reload();
    }, time);
  };
};
            `;

            code = code.replace(
              rePageReload,
              `${injectScript}\nconst pageReload = __mx_debounceReload(${delay})`,
            );
          }

          res.setHeader(
            "Content-Type",
            "application/javascript; charset=utf-8",
          );
          res.end(code);
          return;
        }

        next();
      });
    },
  };
}
