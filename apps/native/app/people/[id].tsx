import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card } from "heroui-native";
import { Linking, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export default function GithubPersonDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { data: session, isPending } = authClient.useSession();
	const query = useQuery(
		trpc.githubPerson.getById.queryOptions(
			{ id: id ?? "" },
			{ enabled: Boolean(id && session?.user) }
		)
	);
	const insets = useSafeAreaInsets();
	if (isPending) {
		return (
			<View className="flex-1 bg-background p-6">
				<Text className="text-muted">正在加载…</Text>
			</View>
		);
	}
	if (!session?.user) {
		return (
			<View className="flex-1 justify-center gap-4 bg-background p-6">
				<Text className="text-foreground">请先登录后查看人员详情。</Text>
				<Button onPress={() => router.replace("/")}>前往登录</Button>
			</View>
		);
	}
	if (query.isPending) {
		return (
			<View className="flex-1 bg-background p-6">
				<Text className="text-muted">正在获取开发者资料…</Text>
			</View>
		);
	}
	if (query.isError) {
		return (
			<View className="flex-1 justify-center gap-4 bg-background p-6">
				<Text className="text-foreground" selectable>
					无法加载资料。该人员可能已被移除，或网络暂时不可用。
				</Text>
				<Button
					onPress={async () => {
						await query.refetch();
					}}
				>
					重试
				</Button>
				<Button onPress={() => router.replace("/")} variant="tertiary">
					返回人员库
				</Button>
			</View>
		);
	}
	const person = query.data;
	return (
		<ScrollView
			className="flex-1 bg-background"
			contentContainerStyle={{
				gap: 18,
				padding: 20,
				paddingBottom: insets.bottom + 24,
			}}
			contentInsetAdjustmentBehavior="automatic"
		>
			<Card className="items-center gap-3 p-6" variant="secondary">
				<Image
					accessibilityLabel={`${person.login} 的头像`}
					source={person.avatarUrl}
					style={{ borderRadius: 52, height: 104, width: 104 }}
				/>
				<Card.Title className="text-center text-3xl">
					{person.displayName ?? person.name ?? person.login}
				</Card.Title>
				<Text className="text-accent" selectable>
					@{person.login}
				</Text>
				{person.bio ? (
					<Text className="text-center text-foreground" selectable>
						{person.bio}
					</Text>
				) : null}
			</Card>
			<View className="flex-row gap-3">
				{[
					{ label: "公开仓库", value: person.publicRepos },
					{ label: "关注者", value: person.followers },
					{ label: "正在关注", value: person.following },
				].map((stat) => (
					<Card
						className="flex-1 items-center gap-1 p-3"
						key={stat.label}
						variant="secondary"
					>
						<Text className="font-semibold text-foreground text-xl" selectable>
							{stat.value}
						</Text>
						<Text className="text-muted text-xs">{stat.label}</Text>
					</Card>
				))}
			</View>
			<Card className="gap-3 p-5" variant="secondary">
				<Card.Title>关于这位开发者</Card.Title>
				{person.company ? (
					<Text className="text-foreground" selectable>
						公司 · {person.company}
					</Text>
				) : null}
				{person.location ? (
					<Text className="text-foreground" selectable>
						位置 · {person.location}
					</Text>
				) : null}
				<Text className="text-muted text-sm" selectable>
					加入 GitHub ·{" "}
					{new Date(person.githubCreatedAt).toLocaleDateString("zh-CN")}
				</Text>
			</Card>
			{person.note ? (
				<Card className="gap-3 p-5" variant="secondary">
					<Card.Title>团队备注</Card.Title>
					<Text className="text-foreground" selectable>
						{person.note}
					</Text>
				</Card>
			) : null}
			<Button
				onPress={async () => {
					await Linking.openURL(person.htmlUrl);
				}}
			>
				在 GitHub 查看主页 ↗
			</Button>
		</ScrollView>
	);
}
