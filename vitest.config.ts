import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";
import react from "@vitejs/plugin-react";

dotenv.config();

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
