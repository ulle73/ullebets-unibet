if (process.env.NEXT_RUNTIME) {
  await import("server-only");
}

export {
  clientPromise,
  getDb,
  getMongoClient,
  closeMongoClient,
} from "./mongo.js";
