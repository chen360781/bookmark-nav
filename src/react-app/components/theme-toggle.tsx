import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const options = [
	{ value: "light", label: "浅色", icon: Sun },
	{ value: "dark", label: "深色", icon: Moon },
	{ value: "system", label: "跟随系统", icon: Monitor },
] as const;

// 外观设置:浅色 / 深色 / 跟随系统(默认跟随系统),偏好存 localStorage
export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="外观设置">
					<Sun className="size-4.5 dark:hidden" />
					<Moon className="hidden size-4.5 dark:block" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{options.map(({ value, label, icon: Icon }) => (
					<DropdownMenuItem
						key={value}
						onClick={() => setTheme(value)}
						className={theme === value ? "bg-accent" : undefined}
					>
						<Icon className="size-4" /> {label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
