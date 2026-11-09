import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Button, Card, Input, Label, TextField } from "heroui-native";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";
import type { RouterOutputs } from "@/utils/trpc-types";

type Person = RouterOutputs["githubPerson"]["getById"];
const count = new Intl.NumberFormat("zh-CN", { notation: "compact" });

function PersonRow({ person }: { person: Person }) {
	return (
		<Pressable
			accessibilityLabel={`查看 ${person.displayName ?? person.name ?? person.login}`}
			accessibilityRole="button"
			onPress={() =>
				router.push({ params: { id: person.id }, pathname: "/people/[id]" })
			}
		>
			<Card className="mb-3 p-4" variant="secondary">
				<View className="flex-row items-center gap-3">
					<Image
						accessibilityLabel={`${person.login} 的头像`}
						source={person.avatarUrl}
						style={{ borderRadius: 28, height: 56, width: 56 }}
					/>
					<View className="flex-1 gap-1">
						<Text
							className="font-semibold text-foreground text-lg"
							numberOfLines={1}
						>
							{person.displayName ?? person.name ?? person.login}
						</Text>
						<Text className="text-muted text-sm">@{person.login}</Text>
					</View>
					<Text className="text-muted text-xl">›</Text>
				</View>
				{person.bio ? (
					<Text className="mt-3 text-foreground text-sm" numberOfLines={2}>
						{person.bio}
					</Text>
				) : null}
				<View className="mt-3 flex-row flex-wrap gap-3">
					<Text className="text-muted text-xs">
						{count.format(person.publicRepos)} 个仓库
					</Text>
					<Text className="text-muted text-xs">
						{count.format(person.followers)} 位关注者
					</Text>
					{person.location ? (
						<Text className="text-muted text-xs" numberOfLines={1}>
							{person.location}
						</Text>
					) : null}
				</View>
			</Card>
		</Pressable>
	);
}

export function GithubDirectory() {
	const { data: session, isPending: sessionPending } = authClient.useSession();
	const [search, setSearch] = useState("");
	const [keyword, setKeyword] = useState("");
	const [page, setPage] = useState(1);
	const [register, setRegister] = useState(false);
	const insets = useSafeAreaInsets();
	const query = useQuery(
		trpc.githubPerson.list.queryOptions(
			{ keyword, page, pageSize: 20 },
			{ enabled: Boolean(session?.user) }
		)
	);
	if (sessionPending) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<Text className="text-muted" selectable>
					正在恢复登录状态…
				</Text>
			</View>
		);
	}
	if (!session?.user) {
		return (
			<ScrollView
				className="flex-1 bg-background"
				contentContainerStyle={{
					gap: 20,
					padding: 20,
					paddingBottom: insets.bottom + 24,
				}}
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
			>
				<Card className="gap-3 p-6" variant="secondary">
					<Text className="font-medium text-accent text-xs tracking-widest">
						DEVELOPER DIRECTORY
					</Text>
					<Card.Title className="text-3xl">认识优秀的开发者</Card.Title>
					<Card.Description>
						登录后浏览团队添加的 GitHub
						人员，查看他们的资料、项目数据和团队备注。
					</Card.Description>
				</Card>
				{register ? <SignUp /> : <SignIn />}
				<Button onPress={() => setRegister(!register)} variant="tertiary">
					{register ? "已有账号？去登录" : "没有账号？创建账号"}
				</Button>
			</ScrollView>
		);
	}
	let emptyMessage = "没有找到匹配的人员，试试其他姓名或用户名。";
	if (!keyword) {
		emptyMessage =
			"人员库还是空的。在 Web 管理端搜索并添加 GitHub 用户后，这里就会同步显示。";
	}
	if (query.isPending) {
		emptyMessage = "正在同步人员库…";
	}
	if (query.isError) {
		emptyMessage = "请检查网络连接，然后重新加载。";
	}
	return (
		<View className="flex-1 bg-background">
			<FlatList
				contentContainerStyle={{
					padding: 20,
					paddingBottom: insets.bottom + 24,
				}}
				contentInsetAdjustmentBehavior="automatic"
				data={query.data?.items ?? []}
				keyboardShouldPersistTaps="handled"
				keyExtractor={(item) => item.id}
				ListEmptyComponent={
					<Card className="gap-3 p-6" variant="secondary">
						<Card.Title>
							{query.isError ? "暂时无法同步" : "GitHub 人员库"}
						</Card.Title>
						<Card.Description>{emptyMessage}</Card.Description>
						{query.isError ? (
							<Button
								onPress={async () => {
									await query.refetch();
								}}
							>
								重新加载
							</Button>
						) : null}
					</Card>
				}
				ListFooterComponent={
					<View className="mt-4 gap-5">
						<View className="flex-row items-center justify-between">
							<Button
								isDisabled={page === 1 || query.isFetching}
								onPress={() => setPage(page - 1)}
								size="sm"
								variant="secondary"
							>
								上一页
							</Button>
							<Text className="text-muted text-sm">第 {page} 页</Text>
							<Button
								isDisabled={
									page * 20 >= (query.data?.total ?? 0) || query.isFetching
								}
								onPress={() => setPage(page + 1)}
								size="sm"
								variant="secondary"
							>
								下一页
							</Button>
						</View>
						<Text className="text-center text-muted text-xs">
							资料由 Web 管理端维护 · 下拉刷新获取最新信息
						</Text>
						<Button
							onPress={async () => {
								const result = await authClient.signOut();
								if (!result.error) {
									queryClient.clear();
								}
							}}
							variant="tertiary"
						>
							退出登录
						</Button>
					</View>
				}
				ListHeaderComponent={
					<View className="mb-5 gap-5">
						<Card className="gap-2 p-5" variant="secondary">
							<Text className="text-accent text-xs tracking-widest">
								PEOPLE WORTH FOLLOWING
							</Text>
							<Card.Title className="text-3xl">开发者星球</Card.Title>
							<Card.Description>
								{query.isSuccess
									? `${query.data.total} 位开发者，灵感在这里相遇。`
									: "正在与云端人员库同步。"}
							</Card.Description>
							<Text className="mt-2 text-muted text-xs" selectable>
								欢迎回来，{session.user.name}
							</Text>
						</Card>
						<TextField>
							<Label>搜索人员</Label>
							<Input
								autoCapitalize="none"
								maxLength={100}
								onChangeText={setSearch}
								onSubmitEditing={() => {
									setKeyword(search.trim());
									setPage(1);
								}}
								placeholder="GitHub 用户名或姓名"
								returnKeyType="search"
								value={search}
							/>
						</TextField>
						<Button
							onPress={() => {
								setKeyword(search.trim());
								setPage(1);
							}}
							variant="secondary"
						>
							搜索
						</Button>
					</View>
				}
				onRefresh={async () => {
					await query.refetch();
				}}
				refreshing={query.isRefetching}
				renderItem={({ item }) => <PersonRow person={item} />}
			/>
		</View>
	);
}
