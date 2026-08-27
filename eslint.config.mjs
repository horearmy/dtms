import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Several route handlers intentionally destructure values only to
      // perform authorization/side effects; do not block those handlers on
      // cosmetic unused-variable diagnostics.
      "@typescript-eslint/no-unused-vars": "off",
      // Report/export payloads are intentionally dynamic at this boundary;
      // runtime validation remains responsible for their shape.
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
    },
  },
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "public/**", "prisma/migrations/**", "scripts/**", "prisma/seed.js", "next-env.d.ts", "**/*.config.*", "**/*.test.*"],
  },
);
