export interface DatabaseConfig {
	DATABASE_URL: string;
	password?: () => Promise<string>;
}
