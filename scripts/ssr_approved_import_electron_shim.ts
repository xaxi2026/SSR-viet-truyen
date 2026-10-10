/** The approved chapter CLI never accesses Electron's application secret. */
export const app = {
  getPath(key: string): string {
    throw new Error(`SSR pilot import cannot access Electron application path: ${key}`)
  },
}
