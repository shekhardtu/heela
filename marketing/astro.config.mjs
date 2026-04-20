import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://hee.la",
  integrations: [tailwind()],
  output: "static",
  build: { inlineStylesheets: "auto" },
});
