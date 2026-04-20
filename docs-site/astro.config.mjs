import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://docs.hee.la",
  integrations: [
    starlight({
      title: "Hee Docs",
      description: "Custom domains for SaaS — Hee documentation.",
      logo: {
        src: "./src/assets/logo.svg",
        replacesTitle: false,
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/shekhardtu/heela",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/shekhardtu/heela/edit/main/docs-site/",
      },
      lastUpdated: true,
      customCss: ["./src/styles/custom.css"],
      head: [
        {
          tag: "link",
          attrs: { rel: "preconnect", href: "https://rsms.me/" },
        },
        {
          tag: "link",
          attrs: { rel: "stylesheet", href: "https://rsms.me/inter/inter.css" },
        },
      ],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Quickstart", slug: "quickstart" },
            { label: "Why Hee", slug: "why-hee" },
          ],
        },
        {
          label: "Concepts",
          autogenerate: { directory: "concepts" },
        },
        {
          label: "Guides",
          autogenerate: { directory: "guides" },
        },
        {
          label: "SDK",
          autogenerate: { directory: "sdk" },
        },
        {
          label: "API reference",
          autogenerate: { directory: "api" },
        },
      ],
    }),
  ],
});
