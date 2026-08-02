/** 从 JWT payload 解码 role（仅用于 UI 显示判断，不做安全边界） */
function decodeRole(token: string): string | undefined {
	try {
		const payload = token.split('.')[1];
		const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		return json?.role;
	} catch {
		return undefined;
	}
}

export const load = async ({ cookies }) => {
	const token = cookies.get('auth');
	return { authenticated: !!token, role: token ? decodeRole(token) : undefined };
};
