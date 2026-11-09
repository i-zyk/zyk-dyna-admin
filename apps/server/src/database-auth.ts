import { Signer } from "@aws-sdk/rds-signer";

export function createDatabasePassword(url: string, region: string) {
	const connection = new URL(url);
	const signer = new Signer({
		hostname: connection.hostname,
		port: Number(connection.port || 5432),
		region,
		username: decodeURIComponent(connection.username),
	});
	// Called for each new physical connection, including after the 15-minute expiry.
	return () => signer.getAuthToken();
}
