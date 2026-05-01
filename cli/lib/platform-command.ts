export function npmCommand(name: 'npm' | 'npx'): string {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

export function npmPackageCommand(name: string): string {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}
