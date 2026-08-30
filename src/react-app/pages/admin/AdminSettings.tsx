import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminSettings, useSaveSettings } from "@/lib/admin-queries";

// 图标服务预设(国内常用,含 {domain} 占位符)
const iconServicePresets = [
	{ label: "FaviconExtractor", value: "https://www.faviconextractor.com/favicon/{domain}" },
	{ label: "favicon.im", value: "https://favicon.im/{domain}" },

] as const;

export default function AdminSettings() {
	const { data, isLoading } = useAdminSettings();
	const save = useSaveSettings();
	const [siteName, setSiteName] = useState("");
	const [footer, setFooter] = useState("");
	const [iconService, setIconService] = useState("");

	// 首次加载回填
	useEffect(() => {
		if (data) {
			setSiteName(data.siteName ?? "");
			setFooter(data.footer ?? "");
			setIconService(data["icon.service"] ?? "");
		}
	}, [data]);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		save.mutate({ siteName, footer });
	}

	function handleIconSubmit(e: FormEvent) {
		e.preventDefault();
		save.mutate({ "icon.service": iconService });
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>基础信息</CardTitle>
					<CardDescription>前台展示页使用的站点配置</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="site-name">站点名称</Label>
							<Input
								id="site-name"
								value={siteName}
								onChange={(e) => setSiteName(e.target.value)}
								placeholder="书签导航"
								disabled={isLoading}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="site-footer">页脚文字</Label>
							<Textarea
								id="site-footer"
								value={footer}
								onChange={(e) => setFooter(e.target.value)}
								rows={2}
								disabled={isLoading}
							/>
						</div>
						<Button type="submit" disabled={save.isPending || isLoading}>
							{save.isPending ? "保存中…" : "保存"}
						</Button>
					</form>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>图标获取</CardTitle>
					<CardDescription>
						配置 favicon 服务地址模板，用 {`{domain}`} 占位书签域名；留空则不自动获取图标
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleIconSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="icon-service">服务地址模板</Label>
							<Input
								id="icon-service"
								value={iconService}
								onChange={(e) => setIconService(e.target.value)}
								placeholder="https://favicon.im/{domain}"
								disabled={isLoading}
							/>
						</div>
						<div className="flex flex-wrap gap-2">
							{iconServicePresets.map(({ label, value }) => (
								<Button
									key={value}
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setIconService(value)}
								>
									{label}
								</Button>
							))}
						</div>
						<Button type="submit" disabled={save.isPending || isLoading}>
							{save.isPending ? "保存中…" : "保存"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}