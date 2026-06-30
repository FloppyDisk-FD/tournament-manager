import { redirect } from '@sveltejs/kit';

export const load = async ({ cookies }) => {
	const token = cookies.get('auth');
	if (!token) {
		throw redirect(302, '/login');
	}
	return { authenticated: true };
};
