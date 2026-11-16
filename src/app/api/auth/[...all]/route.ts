import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better Auth's own addresses: the sign-in link of a letter
// (/api/auth/magic-link/verify), sign-in requests and the session.
export const { GET, POST } = toNextJsHandler(auth);
