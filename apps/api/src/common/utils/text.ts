export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;
