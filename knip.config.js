/** @type {import('knip').KnipConfig} */
const config = {
  ignoreExportsUsedInFile: true,
  ignoreBinaries: ["flyctl", "fly", "oxlint"],

  // Exclude entire workspaces from analysis (ignoreWorkspaces, not ignore)
  ignoreWorkspaces: ["apps/*-e2e", "libs/ui-kit"],

  ignoreDependencies: [
    // Nx executor names — referenced by string in project configs, not imported
    "@nx/nest",
    "@nx/node",
    "@nx/vite",
    "@nx/web",
    "@nx/workspace",
    "@nestjs/schematics",
    // Nx tooling — consumed by Nx CLI/plugins, not imported directly in source
    "@nx/devkit",
    "@nx/react",
    "jiti",
    // Peer deps of @nx/react/babel — used via ui-kit/.babelrc (ui-kit is ignored)
    "@babel/core",
    "@babel/preset-react",
    // ESLint peer deps — required by eslint-config-next and @nx/eslint-plugin
    "@eslint/js",
    "eslint-config-next",
    "eslint-plugin-import",
    "eslint-plugin-jsx-a11y",
    "eslint-plugin-react",
    "eslint-plugin-react-hooks",
    "eslint-plugin-playwright",
    "typescript-eslint",
    // Runtime deps used via NestJS DI / decorator reflection, not direct imports
    "reflect-metadata",
    "@nestjs/config",
    "@thallesp/nestjs-better-auth",
    // Auth — bcrypt used internally by better-auth
    "bcrypt",
    "@types/bcrypt",
    // Type packages for deps used via NestJS/framework (not direct imports)
    "@types/jsonwebtoken",
    "@types/ws",
    // Validation — joi/jsonwebtoken referenced by string in NestJS config
    "joi",
    "jsonwebtoken",
    // WebSocket — loaded by NestJS platform, not imported directly
    "socket.io-client",
    "ws",
    // AWS / media — dynamically loaded in scripts
    "@aws-sdk/client-s3",
    "@deepgram/sdk",
    // UI — imported via barrel re-exports knip doesn't trace
    "@heroicons/react",
    // Puppeteer — loaded via plugin mechanism, not direct import
    "puppeteer-core",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "puppeteer-stream",
    // Utilities used only in scripts
    "simple-git",
    "tslib",
    // JSON schema validator — peer dep of vitest/webpack tooling
    "ajv",
    // Root package.json shared deps — declared at root for hoisting but each
    // workspace also declares them; removing from root is a separate cleanup task
    "@prisma/client",
    "@tailwindcss/typography",
    "axios",
    "rxjs",
    "prisma",
    "tailwindcss",
    "vite-plugin-dts",
  ],

  workspaces: {
    // Root workspace: only scripts/ — all apps/libs are their own workspaces
    ".": {
      entry: ["scripts/**/*.{ts,js}"],
      project: ["scripts/**/*.{ts,js}"],
    },
    // Override entry points per app (Knip's defaults don't know these conventions)
    "apps/web": {
      entry: [
        "src/app/**/page.{ts,tsx}",
        "src/app/**/layout.{ts,tsx}",
        "src/app/**/route.{ts,tsx}",
      ],
      project: ["src/**/*.{ts,tsx}"],
      ignoreDependencies: [
        "shiki", // peer dep bundled transitively by Next.js tooling
      ],
    },
    "apps/backend": {
      entry: ["src/main.ts"],
      project: ["src/**/*.ts"],
      webpack: false,
    },
    "apps/ai-agents": {
      entry: [
        "src/agents/index.ts", // LangGraph CLI entry (langgraph.json)
        "src/main.ts",
      ],
      project: ["src/**/*.ts"],
    },
    // libs/core, libs/models, libs/sales — auto-discovered, default patterns work
  },
};

export default config;
