import { readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Fronteras de la arquitectura modular (ver docs/ARQUITECTURA.md).
const modulos = readdirSync("src/modules", { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 1. Un módulo no importa a otro módulo: solo se hablan a través del armazón (src/erp).
  ...(modulos.length > 1 ? modulos : []).map((m) => ({
    files: [`src/modules/${m}/**`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: modulos.filter((o) => o !== m).map((o) => `@/modules/${o}/**`),
              message: "Un módulo no debe importar a otro módulo. Compartir algo = subirlo al armazón (src/erp).",
            },
          ],
        },
      ],
    },
  })),
  // 2. core/ es lógica de negocio pura: sin framework, sin red, sin base de datos, sin otras capas.
  {
    files: ["src/modules/*/core/**"],
    ignores: ["src/modules/*/core/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "@/*", "next", "next/*", "react", "react/*", "react-dom", "@supabase/*", "@anthropic-ai/*", "google-auth-library"],
              message: "core/ debe ser puro: solo importa archivos de su misma carpeta.",
            },
          ],
        },
      ],
    },
  },
  // 3. El armazón solo conoce de cada módulo su manifiesto (modulo.ts).
  {
    files: ["src/erp/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*/*", "!@/modules/*/modulo"],
              message: "El armazón (src/erp) solo importa el manifiesto de cada módulo (modulo.ts).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
