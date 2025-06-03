import ora, { Ora } from 'ora';
import { green, gray } from 'kleur';

export class SpinnerManager {
  private static spinners: Map<string, Ora> = new Map();

  static start(id: string, text: string, options?: { color?: string; spinner?: string }): Ora {
    const spinner = ora({
      text,
      color: options?.color as any || 'cyan',
      spinner: options?.spinner as any || 'dots'
    }).start();

    this.spinners.set(id, spinner);
    return spinner;
  }

  static update(id: string, text: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.text = text;
    }
  }

  static succeed(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.succeed(text);
      this.spinners.delete(id);
    }
  }

  static fail(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.fail(text);
      this.spinners.delete(id);
    }
  }

  static warn(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.warn(text);
      this.spinners.delete(id);
    }
  }

  static info(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.info(text);
      this.spinners.delete(id);
    }
  }

  static stop(id: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.stop();
      this.spinners.delete(id);
    }
  }

  static stopAll(): void {
    for (const [id, spinner] of this.spinners) {
      spinner.stop();
    }
    this.spinners.clear();
  }

  static async withSpinner<T>(
    id: string,
    text: string,
    task: () => Promise<T>,
    options?: {
      successText?: string;
      errorText?: string;
      color?: string;
      spinner?: string;
    }
  ): Promise<T> {
    const spinner = this.start(id, text, {
      color: options?.color,
      spinner: options?.spinner
    });

    try {
      const result = await task();
      this.succeed(id, options?.successText || `${text} completed`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.fail(id, options?.errorText || `${text} failed: ${errorMessage}`);
      throw error;
    }
  }

  static createProgress(id: string, total: number, options?: { 
    format?: string;
    complete?: string;
    incomplete?: string;
    width?: number;
  }): {
    update: (current: number, text?: string) => void;
    finish: (text?: string) => void;
  } {
    const opts = {
      format: options?.format || '{bar} {percentage}% | {current}/{total} | {text}',
      complete: options?.complete || '█',
      incomplete: options?.incomplete || '░',
      width: options?.width || 20,
      ...options
    };

    let spinner = this.start(id, '', { color: 'cyan' });

    return {
      update: (current: number, text?: string) => {
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round((current / total) * opts.width);
        const bar = green(opts.complete.repeat(filled)) + 
                   gray(opts.incomplete.repeat(opts.width - filled));
        
        const progressText = opts.format
          .replace('{bar}', bar)
          .replace('{percentage}', percentage.toString())
          .replace('{current}', current.toString())
          .replace('{total}', total.toString())
          .replace('{text}', text || '');

        this.update(id, progressText);
      },
      finish: (text?: string) => {
        this.succeed(id, text || 'Progress completed');
      }
    };
  }
}