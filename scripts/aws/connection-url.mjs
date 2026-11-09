export function createIamMigrationUrl(host, database, username, token) {
	const url = new URL(`postgresql://${host}:5432/${database}`);
	url.username = encodeURIComponent(username);
	url.password = encodeURIComponent(token);
	url.searchParams.set("sslmode", "require");
	url.searchParams.set("sslaccept", "strict");
	return url.toString();
}
