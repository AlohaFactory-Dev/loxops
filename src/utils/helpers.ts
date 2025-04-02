import path from "node:path";

/**
 * Groups an array into chunks of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
}

/**
 * Extracts filename without extension
 */
export function getFilenameWithoutExt(filePath: string): string {
	const basename = path.basename(filePath);
	return basename.substring(0, basename.lastIndexOf("."));
}

/**
 * Truncates a string to a maximum length with an ellipsis
 */
export function truncate(str: string, maxLength: number): string {
	if (str.length <= maxLength) {
		return str;
	}
	// This approach might truncate in the middle of a word
	return `${str.substring(0, maxLength - 3)}...`;
}

/**
 * Estimates token count in a string (very rough approximation)
 */
export function estimateTokenCount(text: string): number {
	// Rough approximation: 1 token ~= 4 characters for English text
	return Math.ceil(text.length / 4);
}

/**
 * Delays execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a function with exponential backoff
 */
export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	initialDelay = 1000,
): Promise<T> {
	let retries = 0;
	let delay = initialDelay;

	while (true) {
		try {
			return await fn();
		} catch (error) {
			retries++;
			if (retries >= maxRetries) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, delay));
			delay *= 2; // Exponential backoff
		}
	}
}

/**
 * Formats a duration in milliseconds to a human-readable form
 */
export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000) % 60;
	const minutes = Math.floor(ms / (1000 * 60)) % 60;
	const hours = Math.floor(ms / (1000 * 60 * 60));

	return hours > 0
		? `${hours}h ${minutes}m ${seconds}s`
		: minutes > 0
			? `${minutes}m ${seconds}s`
			: `${seconds}s`;
}
