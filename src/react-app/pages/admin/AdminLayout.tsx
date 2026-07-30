import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bookmark, FolderTree, Home, LogOut, Menu, Settings, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuthStatus, useLogout } from "@/lib/queries";

const navItems = [
	{ to: "/admin", end: true, icon: Bookmark, label: "书签管理" },
	{ to: "/admin/categories", end: false, icon: FolderTree, label: "分类管理" },
	{ to: "/admin/import-export", end: false, icon: Share2, label: "导入导出" },
	{ to: "/admin/settings", end: false, icon: Settings, label: "站点设置" },
];

// 侧栏/抽屉共用的导航内容
function NavContent({ onNavigate }: { onNavigate?: () => void }) {
	const navigate = useNavigate();
	const logout = useLogout();
	return (
		<>
			<nav className="flex flex-1 flex-col gap-1">
				{navItems.map(({ to, end, icon: Icon, label }) => (
					<NavLink
						key={to}
						to={to}
						end={end}
						onClick={onNavigate}
						className={({ isActive }) =>
							cn(
								"flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
								isActive
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)
						}
					>
						<Icon className="size-4" />
						{label}
					</NavLink>
				))}
			</nav>
			<div className="flex flex-col gap-1 border-t pt-3">
				<Button variant="ghost" size="sm" className="justify-start" asChild>
					<Link to="/" onClick={onNavigate}>
						<Home className="size-4" /> 返回前台
					</Link>
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="justify-start text-muted-foreground"
					onClick={async () => {
						await logout.mutateAsync();
						navigate("/");
					}}
				>
					<LogOut className="size-4" /> 退出登录
				</Button>
			</div>
		</>
	);
}

export default function AdminLayout() {
	const navigate = useNavigate();
	const location = useLocation();
	const { data: auth, isLoading } = useAuthStatus();
	const [drawerOpen, setDrawerOpen] = useState(false);

	// 当前路由对应的页面标题,显示在固定顶栏
	const currentTitle =
		navItems.find(({ to, end }) =>
			end ? location.pathname === to : location.pathname.startsWith(to),
		)?.label ?? "后台管理";

	// 未登录跳转登录页
	useEffect(() => {
		if (!isLoading && auth && !auth.authenticated) {
			navigate("/login", { replace: true });
		}
	}, [auth, isLoading, navigate]);

	if (isLoading || !auth?.authenticated) {
		return (
			<div className="flex min-h-screen items-center justify-center text-muted-foreground">
				加载中…
			</div>
		);
	}

	return (
		<div className="flex h-dvh flex-col overflow-hidden bg-muted/40 md:flex-row">
			{/* 移动端顶栏:汉堡菜单 + 抽屉导航(固定,不随内容滚动) */}
			<header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3 md:hidden">
				<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
					<SheetTrigger asChild>
						<Button variant="ghost" size="icon" aria-label="打开菜单">
							<Menu className="size-5" />
						</Button>
					</SheetTrigger>
					<SheetContent side="left" className="flex w-64 flex-col p-4">
						<SheetHeader className="p-0">
							<SheetTitle className="px-2 text-left">后台管理</SheetTitle>
						</SheetHeader>
						<NavContent onNavigate={() => setDrawerOpen(false)} />
					</SheetContent>
				</Sheet>
				<span className="font-bold">{currentTitle}</span>
				<div className="ml-auto">
					<ThemeToggle />
				</div>
			</header>

			{/* 桌面侧栏:固定不动,菜单过长时自身滚动 */}
			<aside className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r bg-background p-4 md:flex">
				<div className="mb-6 px-2 text-lg font-bold">后台管理</div>
				<NavContent />
			</aside>

			{/* 内容列:固定顶栏显示当前页标题,下方内容独立滚动(min-h-0 保证 flex 子项可收缩出滚动区) */}
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<header className="hidden h-14 shrink-0 items-center border-b bg-background px-6 md:flex">
					<h1 className="text-lg font-bold">{currentTitle}</h1>
					<div className="ml-auto">
						<ThemeToggle />
					</div>
				</header>
				<main className="flex-1 overflow-y-auto p-4 md:p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
