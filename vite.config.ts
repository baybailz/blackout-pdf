import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative so the same build works on
// <user>.github.io/blackout-pdf/ and on a custom apex domain.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
  },
});
