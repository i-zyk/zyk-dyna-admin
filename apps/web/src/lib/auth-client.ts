import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV } from "@/env";

export const authClient = createAuthClient({
	baseURL: ENV.NEXT_PUBLIC_SERVER_URL,
	plugins: [usernameClient()],
});
