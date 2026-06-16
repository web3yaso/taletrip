import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests cover the PURE logic only (no RN/Expo runtime). Tests live in test/
// and import the dependency-free modules under src/ via the @ alias, mirroring
// tsconfig paths. Device/integration behaviour is covered by the manual
// regression checklist (docs/taletrip-regression-checklist.md).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
