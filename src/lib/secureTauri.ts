import { invoke } from "@tauri-apps/api/core";

type DialogFilter = {
  name: string;
  extensions: string[];
};

type OpenDialogOptions = {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
  defaultPath?: string;
  filters?: DialogFilter[];
};

type SaveDialogOptions = {
  title?: string;
  defaultPath?: string;
  filters?: DialogFilter[];
};

export type DirEntry = {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
};

export type FileInfo = {
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  modifiedSecs?: number;
};

export async function open(options: OpenDialogOptions = {}): Promise<string | string[] | null> {
  return invoke<string | string[] | null>("secure_open_dialog", { options });
}

export async function save(options: SaveDialogOptions = {}): Promise<string | null> {
  return invoke<string | null>("secure_save_dialog", { options });
}

export async function readDir(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("secure_read_dir", { path });
}

export async function stat(path: string): Promise<FileInfo> {
  return invoke<FileInfo>("secure_stat", { path });
}

export async function readFile(path: string): Promise<Uint8Array> {
  const data = await invoke<number[]>("secure_read_binary_file", { filePath: path });
  return new Uint8Array(data);
}

export async function writeFile(path: string, data: Uint8Array): Promise<void> {
  await invoke("write_binary_file", { filePath: path, data: Array.from(data) });
}
