if (process.env.NEXT_RUNTIME) {
  await import("server-only");
}

import clientPromise from "./mongo.js";

export { clientPromise };
