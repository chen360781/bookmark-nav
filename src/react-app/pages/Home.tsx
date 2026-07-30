import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, Lock, Pin, Search, Settings, LogOut, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	client,
	bookmarkIcon,
	flattenCategoryTree,
	type Bookmark,
	type Category,
} from "@/lib/api";
import { useAuthStatus, useLogout, useNavData, useSiteSettings } from "@/lib/queries";

function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
	const icon = bookmarkIcon(bookmark);
	return (
		<a
			href={bookmark.url}
			target="_blank"
			rel="noreferrer"
			onClick={() => {
				// 点击计数上报,不阻塞跳转
				void client.api.public.bookmarks[":id"].click.$post({
					param: { id: String(bookmark.id) },
				});
			}}
			className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
		>
			<div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
				{icon ? (
					<img
						src={icon}
						alt=""
						className="size-6"
						loading="lazy"
						onError={(e) => {
							e.currentTarget.style.display = "none";
						}}
					/>
				) : (
					<Globe className="size-5 text-muted-foreground" />
				)}
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5">
					<span className="truncate font-medium group-hover:text-primary">
						{bookmark.title}
					</span>
					{bookmark.isPinned && <Pin className="size-3.5 shrink-0 text-amber-500" />}
					{bookmark.visibility === "private" && (
						<Lock className="size-3.5 shrink-0 text-muted-foreground" />
					)}
				</div>
				{bookmark.description && (
					<p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
						{bookmark.description}
					</p>
				)}
				{bookmark.tags.length > 0 && (
					<div className="mt-1.5 flex flex-wrap gap-1">
						{bookmark.tags.map((t) => (
							<Badge key={t} variant="secondary" className="px-1.5 py-0 text-xs">
								{t}
							</Badge>
						))}
					</div>
				)}
			</div>
		</a>
	);
}

export default function Home() {
	const { data: auth } = useAuthStatus();
	const { data, isLoading, isError } = useNavData();
	const { data: site } = useSiteSettings();
	const logout = useLogout();
	const [keyword, setKeyword] = useState("");

	const siteName = site?.siteName || "书签导航";

	// 前端本地过滤:数据量小,无需请求搜索接口
	const filtered = useMemo(() => {
		if (!data) return [];
		const kw = keyword.trim().toLowerCase();
		if (!kw) return data.bookmarks;
		return data.bookmarks.filter(
			(b) =>
				b.title.toLowerCase().includes(kw) ||
				(b.description ?? "").toLowerCase().includes(kw) ||
				b.url.toLowerCase().includes(kw) ||
				b.tags.some((t) => t.toLowerCase().includes(kw)),
		);
	}, [data, keyword]);

	// 分类树按深度优先拍平成小节,子分类标题显示父级路径前缀(超过两级省略为 … / 上级)
	const grouped = useMemo(() => {
		const flat = flattenCategoryTree(data?.categories ?? []);
		const groups: {
			category: Category | null;
			parentPath: string;
			items: Bookmark[];
		}[] = flat.map(({ category, path }) => {
			const segments = path.split(" / ").slice(0, -1);
			return {
				category,
				parentPath:
					segments.length > 2
						? `… / ${segments[segments.length - 1]}`
						: segments.join(" / "),
				items: [],
			};
		});
		const uncategorized: Bookmark[] = [];
		const byId = new Map(groups.map((g) => [g.category!.id, g]));
		for (const b of filtered) {
			const g = b.categoryId !== null ? byId.get(b.categoryId) : undefined;
			if (g) g.items.push(b);
			else uncategorized.push(b);
		}
		if (uncategorized.length > 0)
			groups.push({ category: null, parentPath: "", items: uncategorized });
		return groups.filter((g) => g.items.length > 0);
	}, [data, filtered]);

	return (
		<div className="min-h-screen bg-background">
			<header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-0 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
					<Link to="/" className="shrink-0 text-lg font-bold">
						{siteName}
					</Link>
					{/* 移动端:搜索框换行独占一行;桌面:居中单行 */}
					<div className="relative order-last mt-2 w-full sm:order-none sm:mx-auto sm:mt-0 sm:max-w-md">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={keyword}
							onChange={(e) => setKeyword(e.target.value)}
							placeholder="搜索书签…"
							className="pl-9"
						/>
					</div>
					<div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
						<ThemeToggle />
						{auth?.authenticated ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon" aria-label="账户菜单">
										<User className="size-4.5" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem asChild>
										<Link to="/admin">
											<Settings className="size-4" /> 后台管理
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => logout.mutate()}>
										<LogOut className="size-4" /> 退出登录
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							<Button variant="ghost" size="sm" asChild>
								<Link to="/login">登录</Link>
							</Button>
						)}
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-4 py-8">
				{isLoading && (
					<p className="py-20 text-center text-muted-foreground">加载中…</p>
				)}
				{isError && (
					<p className="py-20 text-center text-destructive">加载失败,请刷新重试</p>
				)}
				{grouped.map(({ category, parentPath, items }) => (
					<section key={category?.id ?? "uncategorized"} className="mb-10">
						<h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
							{category?.icon && <span>{category.icon}</span>}
							{parentPath && (
								<span className="font-normal text-muted-foreground">
									{parentPath} /
								</span>
							)}
							{category?.name ?? "未分类"}
							{category?.visibility === "private" && (
								<Lock className="size-3.5 text-muted-foreground" />
							)}
							<span className="text-sm font-normal text-muted-foreground">
								{items.length}
							</span>
						</h2>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{items.map((b) => (
								<BookmarkCard key={b.id} bookmark={b} />
							))}
						</div>
					</section>
				))}
				{!isLoading && !isError && grouped.length === 0 && (
					<p className="py-20 text-center text-muted-foreground">
						{keyword ? "没有匹配的书签" : "还没有书签,登录后台添加吧"}
					</p>
				)}
			</main>
			{site?.footer && (
				<footer className="border-t py-6 text-center text-sm text-muted-foreground">
					{site.footer}
				</footer>
			)}
		</div>
	);
}
