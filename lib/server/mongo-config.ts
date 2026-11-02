import { serverEnv } from "./env";

export function mongoConfig() {
  const env = serverEnv();
  return {
    uri: env.MONGODB_URI,
    database: env.MONGODB_DB,
    options: {
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
      socketTimeoutMS: env.MONGODB_SOCKET_TIMEOUT_MS,
    },
  };
}
