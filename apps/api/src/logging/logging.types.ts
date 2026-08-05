export interface LogDestination {
  readonly stream: NodeJS.WritableStream;
  readonly activeFile?: string;
  close(): Promise<void>;
}

export interface FileDestinationOptions {
  directory: string;
  retentionDays: number;
  now?: () => Date;
}
