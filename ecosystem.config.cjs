module.exports = {
  apps: [
    {
      name: "1mbrain",
      cwd: "/home/project/1Mbrain",
      script: "packages/api/dist/index.js",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: "3100",
        HOST: "0.0.0.0",
        DB_PROVIDER: "sqlite",
        SQLITE_PATH: "./data/1mbrain.db",
        REDIS_URL: "redis://127.0.0.1:6379",
        EMBEDDING_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-9cc4df59416ac9ec-l1d73e-d205a549",
        OPENAI_EMBEDDING_MODEL: "openrouter/openai/text-embedding-3-small",
        OPENAI_BASE_URL: "http://100.121.96.53:20128/v1",
        MASTER_API_KEY: "sk-1mbrain-d0b91ac75c82837c09301e2f676af281",
        LOG_LEVEL: "info",
        CONSOLIDATION_ENABLED: "true",
        CONSOLIDATION_THRESHOLD: "50",
        CONSOLIDATION_MIN_AGE_DAYS: "1",
        INGEST_FACT_EXTRACTION_PROVIDER: "openai",
        INGEST_FACT_EXTRACTION_API_KEY: "sk-9cc4df59416ac9ec-l1d73e-d205a549",
        INGEST_FACT_EXTRACTION_MODEL: "ag/gemini-3-flash-agent",
        INGEST_FACT_EXTRACTION_BASE_URL: "http://100.121.96.53:20128"
      }
    },
    {
      name: "archive-backend",
      script: "server/index.js",
      watch: false,
      env: { NODE_ENV: "production", NODE_TLS_REJECT_UNAUTHORIZED: "0" }
    },
    {
      name: "archive-worker-bullmq",
      script: "server/worker.js",
      args: "--mode=bullmq",
      watch: false,
      env: { IS_WORKER: "true", NODE_ENV: "production", NODE_TLS_REJECT_UNAUTHORIZED: "0" },
      node_args: "--max-old-space-size=2048"
    },
    {
      name: "archive-worker-polling",
      script: "server/worker.js",
      args: "--mode=polling",
      watch: false,
      env: { IS_WORKER: "true", NODE_ENV: "production", NODE_TLS_REJECT_UNAUTHORIZED: "0" },
      node_args: "--max-old-space-size=2048"
    },
    {
      name: "archive-frontend",
      script: "node_modules/.bin/vite",
      args: "--host 0.0.0.0 --port 5174",
      watch: false,
      env: { NODE_ENV: "production", NODE_TLS_REJECT_UNAUTHORIZED: "0" }
    }
  ]
};
