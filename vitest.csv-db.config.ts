import { defineConfig } from "vitest/config";

// Opt-in synthetic PostgreSQL suite: isolated local socket only, no managed connection.
export default defineConfig({ test: { environment: "node", include: ["src/test/csvSafeguardsDatabase.test.ts"], testTimeout: 20000 } });