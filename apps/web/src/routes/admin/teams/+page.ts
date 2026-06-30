export const load = async ({ fetch }) => {
	const res = await fetch('/api/v1/teams', { credentials: 'include' });
	const raw = await res.json();
	const teams = Array.isArray(raw) ? raw : (raw.items ?? []);
	return { teams };
};
