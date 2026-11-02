// The web build: the picker hands over blob: URLs that play for as long as the page is open. Nothing can be
// copied into lasting storage here, so web imports are kept for the session only (see isSessionOnly).

export const KEEPS_IMPORTS = false;

export async function keepCopy(pickedUri: string, _fileName: string): Promise<string> {
  return pickedUri;
}

export function deleteCopy(uri: string): void {
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}

export function hasFile(_uri: string): boolean {
  return true;
}
