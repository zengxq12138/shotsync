import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        miniflare: {
          r2Buckets: ["BUCKET"],
          bindings: {
            AUTH_TOKEN: "test-token",
            // Fake S3 credentials: signing is local crypto (no network), so
            // presign paths run for real; copyObject calls are vi.mock'd in
            // archive tests because Miniflare serves no S3 API.
            R2_ACCESS_KEY_ID: "test-key",
            R2_SECRET_ACCESS_KEY: "test-secret",
            R2_S3_ENDPOINT: "https://test-account.r2.cloudflarestorage.com/test-bucket",
          },
        },
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
