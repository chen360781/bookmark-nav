import { useRef } from "react";
import { Download, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useImportBookmarks } from "@/lib/admin-queries";

export default function AdminImportExport() {
	const fileRef = useRef<HTMLInputElement>(null);
	const importBookmarks = useImportBookmarks();

	async function handleFile(file: File | undefined) {
		if (!file) return;
		if (file.size > 20 * 1024 * 1024) {
			toast.error("文件过大(超过 20MB)");
			return;
		}
		const html = await file.text();
		importBookmarks.mutate(html);
		// 清空 input,允许重复选择同一文件
		if (fileRef.current) fileRef.current.value = "";
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Upload className="size-4" /> 导入书签
					</CardTitle>
					<CardDescription>
						支持 Chrome / Edge / Firefox / Safari 导出的书签 HTML 文件,
						文件夹层级(二级、三级、四级…)会完整保留为嵌套分类。
						重复网址自动跳过,可放心重复导入。
					</CardDescription>
				</CardHeader>
				<CardContent>
					<input
						ref={fileRef}
						type="file"
						accept=".html,.htm,text/html"
						className="hidden"
						onChange={(e) => handleFile(e.target.files?.[0])}
					/>
					<Button
						onClick={() => fileRef.current?.click()}
						disabled={importBookmarks.isPending}
					>
						<FileUp className="size-4" />
						{importBookmarks.isPending ? "导入中…" : "选择书签 HTML 文件"}
					</Button>
					<p className="mt-3 text-xs text-muted-foreground">
						浏览器导出入口:Chrome/Edge 书签管理器 → 导出书签;Firefox
						书签管理 → 导入和备份 → 导出书签到 HTML;Safari 文件 → 导出 → 书签。
						导入的书签默认为公开,可在书签管理中调整。
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Download className="size-4" /> 导出书签
					</CardTitle>
					<CardDescription>
						导出为标准 Netscape 书签 HTML(含公开与私密书签及完整分类层级),
						可直接导入任意主流浏览器,也可作为备份。
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button variant="outline" asChild>
						<a href="/api/admin/export" download>
							<Download className="size-4" /> 下载书签文件
						</a>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
