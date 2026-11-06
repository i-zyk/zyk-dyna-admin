import type { Session } from "@zyk-dyna-admin/auth";
import type { Database } from "@zyk-dyna-admin/db";

export type Context = {
  session: Session | null;
  db: Database;
};
