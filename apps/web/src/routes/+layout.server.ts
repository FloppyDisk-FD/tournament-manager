export const load = async ({ cookies }) => {
	const token = cookies.get('auth');
	return { authenticated: !!token };
};
