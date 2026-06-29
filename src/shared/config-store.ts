const CONFIG_NAMESPACE = "config";

function configKey(name: string): string {
  return `${CONFIG_NAMESPACE}:${name}`;
}

export const ConfigKeys = {
  COMBINE_RULES: "combine-rules",
  INDEX_FILTERS: "index-filters",
  SECTOR_FILTERS: "sector-filters",
} as const;

export function loadConfig<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(configKey(name));
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveConfig<T>(name: string, value: T): void {
  localStorage.setItem(configKey(name), JSON.stringify(value));
}

export function removeConfig(name: string): void {
  localStorage.removeItem(configKey(name));
}
