import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["test/unit/**/*.test.ts"],
    environment: "node",
    // Vitest loads .env.local into process.env; pin the data layer to the
    // embedded driver so unit tests stay deterministic + offline and never reach
    // a configured cloud DB (DSQL/Postgres) or its credentials.
    env: {
      MYCELIA_DB_DRIVER: "pglite",
      DSQL_ENDPOINT: "",
      DATABASE_URL: "",
    },
  },
})
