/** GitHub Pages project site: https://ntgiahuy.github.io/dam/ */
export const BASE_PATH = "/dam";

export function withBasePath(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === BASE_PATH || p.startsWith(`${BASE_PATH}/`)) return p;
  return `${BASE_PATH}${p}`;
}
