module.exports = {
  apps: [
    {
      name: "archive-backend",
      script: "server/index.js",
      watch: false,
      env: { NODE_ENV: "production" }
    },
    {
      name: "archive-worker-bullmq",
      script: "server/worker.js",
      args: "--mode=bullmq",
      watch: false,
      env: { IS_WORKER: "true", NODE_ENV: "production" },
      node_args: "--max-old-space-size=2048"
    },
    {
      name: "archive-worker-polling",
      script: "server/worker.js",
      args: "--mode=polling",
      watch: false,
      env: { IS_WORKER: "true", NODE_ENV: "production" },
      node_args: "--max-old-space-size=2048"
    }
  ]
};