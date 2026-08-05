import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Writable } from "node:stream";
import type { FileDestinationOptions, LogDestination } from "./logging.types";

const FILE_PATTERN = /^logger-(\d{4}-\d{2}-\d{2})\.log$/;
const utcDate = (date: Date) => date.toISOString().slice(0, 10);
const filename = (date: Date) => `logger-${utcDate(date)}.log`;

const parseUtcDate = (value: string): Date | undefined => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return utcDate(date) === value ? date : undefined;
};

const openWriteStream = (path: string): Promise<WriteStream> =>
  new Promise((resolve, reject) => {
    const stream = createWriteStream(path, { flags: "a" });
    const onOpen = () => {
      stream.off("error", onError);
      resolve(stream);
    };
    const onError = (error: Error) => {
      stream.off("open", onOpen);
      reject(error);
    };

    stream.once("open", onOpen);
    stream.once("error", onError);
  });

const closeWriteStream = (stream: WriteStream): Promise<void> =>
  new Promise((resolve, reject) => {
    const onClose = () => {
      stream.off("error", onError);
      resolve();
    };
    const onError = (error: Error) => {
      stream.off("close", onClose);
      reject(error);
    };

    stream.once("close", onClose);
    stream.once("error", onError);
    stream.end();
  });

class DailyFileStream extends Writable {
  private activeDate: string;
  private activeStream!: WriteStream;
  private readonly forwardActiveStreamError = (error: Error): void => {
    this.destroy(error);
  };

  private constructor(
    private readonly options: Required<FileDestinationOptions>,
  ) {
    super();
    this.activeDate = utcDate(options.now());
  }

  static async create(
    options: FileDestinationOptions,
  ): Promise<DailyFileStream> {
    const stream = new DailyFileStream({
      ...options,
      now: options.now ?? (() => new Date()),
    });
    await mkdir(stream.options.directory, { recursive: true });
    await stream.openActiveStream(stream.activeDate);
    return stream;
  }

  get activeFile(): string {
    return join(
      this.options.directory,
      filename(parseUtcDate(this.activeDate)!),
    );
  }

  override _write(
    chunk: Uint8Array,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    const recordDate = utcDate(this.options.now());
    void this.writeRecord(chunk, encoding, recordDate, callback);
  }

  override _final(callback: (error?: Error | null) => void): void {
    void this.closeActiveStream().then(
      () => callback(),
      (error: Error) => callback(error),
    );
  }

  private async writeRecord(
    chunk: Uint8Array,
    encoding: BufferEncoding,
    recordDate: string,
    callback: (error?: Error | null) => void,
  ): Promise<void> {
    try {
      if (recordDate !== this.activeDate) {
        await this.closeActiveStream();
        await this.openActiveStream(recordDate);
      }

      this.activeStream.write(chunk, encoding, (error?: Error | null) =>
        callback(error),
      );
    } catch (error) {
      callback(error as Error);
    }
  }

  private async openActiveStream(date: string): Promise<void> {
    const path = join(this.options.directory, filename(parseUtcDate(date)!));
    const stream = await openWriteStream(path);

    try {
      await this.cleanup(date);
      this.activeDate = date;
      this.activeStream = stream;
      stream.on("error", this.forwardActiveStreamError);
    } catch (error) {
      await closeWriteStream(stream);
      throw error;
    }
  }

  private async closeActiveStream(): Promise<void> {
    this.activeStream.off("error", this.forwardActiveStreamError);
    await closeWriteStream(this.activeStream);
  }

  private async cleanup(activeDate: string): Promise<void> {
    const active = parseUtcDate(activeDate)!;
    const cutoff = new Date(
      Date.UTC(
        active.getUTCFullYear(),
        active.getUTCMonth(),
        active.getUTCDate() - (this.options.retentionDays - 1),
      ),
    );
    const entries = await readdir(this.options.directory, {
      withFileTypes: true,
    });

    await Promise.all(
      entries.map(async (entry) => {
        const match = FILE_PATTERN.exec(entry.name);
        if (!match || !entry.isFile()) return;

        const date = parseUtcDate(match[1]);
        if (date && date < cutoff) {
          await unlink(join(this.options.directory, entry.name));
        }
      }),
    );
  }
}

class FileDestination implements LogDestination {
  private closePromise: Promise<void> | undefined;

  constructor(private readonly fileStream: DailyFileStream) {}

  get stream(): NodeJS.WritableStream {
    return this.fileStream;
  }

  get activeFile(): string {
    return this.fileStream.activeFile;
  }

  close(): Promise<void> {
    this.closePromise ??= new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        this.fileStream.off("error", onError);
        reject(error);
      };

      this.fileStream.once("error", onError);
      this.fileStream.end((error?: Error | null) => {
        this.fileStream.off("error", onError);
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    return this.closePromise;
  }
}

export async function createFileDestination(
  options: FileDestinationOptions,
): Promise<LogDestination> {
  return new FileDestination(await DailyFileStream.create(options));
}
