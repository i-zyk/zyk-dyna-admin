import { createAuth } from "@zyk-dyna-admin/auth";
import { createPrismaClient } from "@zyk-dyna-admin/db";

import { ENV } from "./env.server";

export const db = createPrismaClient(ENV);
export const auth = createAuth(ENV, db);
