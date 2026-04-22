import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      },
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/types/**",
        "examples/**",
        "dist/**",

        // Real provider implementations depend on external services.
        "src/providers/SmtpProvider.ts",
        "src/providers/AwsSesProvider.ts",
        "src/providers/SendGridProvider.ts"
      ]
    }
  }
});

