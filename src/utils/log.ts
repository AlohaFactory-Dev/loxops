import * as core from '@actions/core';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

export class Logger {
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
}