interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface ShowOpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: {
    description?: string;
    accept: Record<string, string[]>;
  }[];
}

interface ShowSaveFilePickerOptions {
  excludeAcceptAllOption?: boolean;
  suggestedName?: string;
  types?: {
    description?: string;
    accept: Record<string, string[]>;
  }[];
}

interface DataTransferItem {
  getAsFileSystemHandle(): Promise<FileSystemHandle>;
}

interface Window {
  showOpenFilePicker(options?: ShowOpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: ShowSaveFilePickerOptions): Promise<FileSystemFileHandle>;
} 