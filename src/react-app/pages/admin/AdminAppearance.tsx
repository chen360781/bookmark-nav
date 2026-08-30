import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAdminSettings, useSaveSettings } from "@/lib/admin-queries";

export default function AdminAppearance() {
	const { theme, setTheme } = useTheme();
	const { data: settings } = useAdminSettings();
	const save = useSaveSettings();
	const compact = settings?.["appearance.compact"] === "1";
	const themeOptions = [
		{ value: "system", label: "跟随系统", icon: Monitor },
		{ value: "light", label: "浅色", icon: Sun },
		{ value: "dark", label: "深色", icon: Moon },
	] as const;

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>外观设置</CardTitle>
					<CardDescription>设置后台及前台的明暗主题，默认跟随系统</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-2">
						{themeOptions.map(({ value, label, icon: Icon }) => (
							<Button
								key={value}
								type="button"
								variant="outline"
								size="sm"
								className={cn(
									"gap-2",
									theme === value && "border-primary bg-primary/10 text-primary",
								)}
								onClick={() => setTheme(value)}
							>
								<Icon className="size-4" />
								{label}
							</Button>
						))}
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>前台显示</CardTitle>
					<CardDescription>前台导航页的展示密度</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">紧凑模式</p>
							<p className="text-sm text-muted-foreground">
								卡片更小、隐藏描述与标签，单页显示更多书签
							</p>
						</div>
						<Switch
							checked={compact}
							onCheckedChange={(v) => save.mutate({ "appearance.compact": v ? "1" : "0" })}
							disabled={save.isPending}
							aria-label="紧凑模式"
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}