import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.FNI_API_PORT?.trim() || env.PORT?.trim() || "4100";
  const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim() || `http://localhost:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": apiProxyTarget,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id) return undefined;

            if (id.includes("node_modules/react-router-dom") || id.includes("node_modules/@remix-run")) {
              return "router-vendor";
            }

            if (
              id.includes("node_modules/react") ||
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/scheduler")
            ) {
              return "react-vendor";
            }

            if (id.includes("/src/shared/fni/schema/")) {
              return "fni-schema";
            }

            if (id.includes("/src/pages/admin/")) {
              return "admin-routes";
            }

            if (id.includes("/src/pages/foundation/")) {
              return "foundation-routes";
            }

            if (id.includes("/src/pages/school/")) {
              return "school-routes";
            }

            return undefined;
          },
        },
      },
    },
  };
});
