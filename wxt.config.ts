import { defineConfig } from "wxt";
import { version } from "./package.json";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
  }),
  manifest: {
    name: "Bilibili 无限历史记录",
    description: "不限制数量的保存你的bilibili历史记录",
    permissions: [
      "storage",
      "tabs",
      "cookies",
      "alarms",
      "identity",
    ],
    host_permissions: ["<all_urls>"],
    web_accessible_resources: [
      {
        resources: ["injected.js"],
        matches: ["*://*.bilibili.com/*"],
      },
    ],
  },
});
