import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
// biome-ignore lint/performance/noNamespaceImport: expoClient needs the whole SecureStore module as its storage adapter
import * as SecureStore from "expo-secure-store";

import { ENV } from "../src/env";

export const authClient = createAuthClient({
	baseURL: ENV.EXPO_PUBLIC_SERVER_URL,
	plugins: [
		expoClient({
			scheme: Constants.expoConfig?.scheme as string,
			storage: SecureStore,
			storagePrefix: Constants.expoConfig?.scheme as string,
		}),
	],
});
