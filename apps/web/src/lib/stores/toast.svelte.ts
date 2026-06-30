// Toast 通知 store — Swiss Style 克制动效
// 支持：入场动画、退场动画（leaving 状态）、进度条倒计时
export type ToastType = 'success' | 'error' | 'info';

interface Toast {
	id: number;
	type: ToastType;
	message: string;
	duration: number;
	leaving: boolean;
}

let toasts = $state<Toast[]>([]);
let nextId = 0;

export function getToasts() {
	return toasts;
}

function remove(id: number) {
	toasts = toasts.filter((t) => t.id !== id);
}

export function toast(message: string, type: ToastType = 'info', duration = 2500) {
	const id = ++nextId;
	toasts = [...toasts, { id, type, message, duration, leaving: false }];
	// duration 后触发退场动画，动画结束后真正移除
	setTimeout(() => dismiss(id), duration);
}

export function success(message: string, duration = 2500) {
	toast(message, 'success', duration);
}

export function error(message: string, duration = 3000) {
	toast(message, 'error', duration);
}

export function info(message: string, duration = 2500) {
	toast(message, 'info', duration);
}

export function dismiss(id: number) {
	// 先标记 leaving 触发退场动画，动画结束后移除
	const t = toasts.find((x) => x.id === id);
	if (!t || t.leaving) return;
	toasts = toasts.map((x) => (x.id === id ? { ...x, leaving: true } : x));
	// 退场动画时长 200ms
	setTimeout(() => remove(id), 200);
}
