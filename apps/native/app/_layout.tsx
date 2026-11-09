import "@/global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { HeroUINativeProvider, useThemeColor } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppThemeProvider } from "@/contexts/app-theme-context";
import { queryClient } from "@/utils/trpc";

export const unstable_settings = {
	anchor: "index",
};

function StackLayout() {
	const [background, foreground] = useThemeColor(["background", "foreground"]);
	return (
		<Stack
			screenOptions={{
				contentStyle: { backgroundColor: background },
				headerRight: () => <ThemeToggle />,
				headerStyle: { backgroundColor: background },
				headerTintColor: foreground,
			}}
		>
			<Stack.Screen name="index" options={{ title: "GitHub 人员库" }} />
			<Stack.Screen name="people/[id]" options={{ title: "开发者详情" }} />
			<Stack.Screen
				name="modal"
				options={{ presentation: "modal", title: "Modal" }}
			/>
		</Stack>
	);
}

export default function Layout() {
	return (
		<QueryClientProvider client={queryClient}>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<KeyboardProvider>
					<AppThemeProvider>
						<HeroUINativeProvider>
							<StackLayout />
						</HeroUINativeProvider>
					</AppThemeProvider>
				</KeyboardProvider>
			</GestureHandlerRootView>
		</QueryClientProvider>
	);
}
