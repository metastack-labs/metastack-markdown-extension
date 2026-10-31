// File System Access API members that TypeScript's DOM lib does not declare yet.
// All are optional so call sites must feature-detect (Firefox has none of them).

type FileSystemPermissionMode = 'read' | 'readwrite';

interface FileSystemHandlePermissionDescriptor {
	mode?: FileSystemPermissionMode;
}

interface FileSystemHandle {
	queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
	requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface DataTransferItem {
	getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}

interface FilePickerAcceptType {
	description?: string;
	accept: Record<string, string | string[]>;
}

interface OpenFilePickerOptions {
	multiple?: boolean;
	excludeAcceptAllOption?: boolean;
	id?: string;
	startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads';
	types?: FilePickerAcceptType[];
}

interface SaveFilePickerOptions {
	excludeAcceptAllOption?: boolean;
	id?: string;
	startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads';
	suggestedName?: string;
	types?: FilePickerAcceptType[];
}

interface DirectoryPickerOptions {
	id?: string;
	mode?: FileSystemPermissionMode;
	startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads';
}

interface Window {
	showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
	showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
	showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
