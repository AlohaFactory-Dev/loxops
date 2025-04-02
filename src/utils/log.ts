import * as core from "@actions/core";

export enum LogLevel {
	DEBUG = "debug",
	INFO = "info",
	WARNING = "warning",
	ERROR = "error",
}

interface TimerRecord {
	name: string;
	startTime: number;
}

export class Logger {
	private static timers: Map<string, TimerRecord> = new Map();

	static debug(message: string): void {
		core.debug(message);
	}

	static info(message: string): void {
		core.info(message);
	}

	static warning(message: string): void {
		core.warning(message);
	}

	static error(message: string): void {
		core.error(message);
	}

	static group(name: string): void {
		core.startGroup(name);
	}

	static endGroup(): void {
		core.endGroup();
	}

	static startTimer(name: string): void {
		this.timers.set(name, {
			name,
			startTime: Date.now(),
		});
		this.debug(`Timer "${name}" started`);
	}

	static endTimer(name: string): number {
		const timer = this.timers.get(name);
		if (!timer) {
			this.warning(`Timer "${name}" does not exist`);
			return 0;
		}

		const duration = Date.now() - timer.startTime;
		this.info(`Timer "${name}" ended after ${duration}ms`);
		this.timers.delete(name);
		return duration;
	}
}
