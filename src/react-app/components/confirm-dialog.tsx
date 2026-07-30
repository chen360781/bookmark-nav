import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

// 待确认的操作:null 表示弹窗关闭
export interface ConfirmState {
	title: string;
	description?: string;
	confirmText?: string;
	onConfirm: () => void;
}

// 统一风格的危险操作确认弹窗,替代原生 confirm()
export function ConfirmDialog({
	state,
	onClose,
}: {
	state: ConfirmState | null;
	onClose: () => void;
}) {
	return (
		<AlertDialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{state?.title}</AlertDialogTitle>
					{state?.description && (
						<AlertDialogDescription>{state.description}</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>取消</AlertDialogCancel>
					<AlertDialogAction
						className={buttonVariants({ variant: "destructive" })}
						onClick={() => {
							state?.onConfirm();
							onClose();
						}}
					>
						{state?.confirmText ?? "删除"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
