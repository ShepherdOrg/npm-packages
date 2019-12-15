export type TExtensionsMap = { [index: string]: boolean }

export const kubeSupportedExtensions: TExtensionsMap = {
  ".yml": true,
  ".yaml": true,
  ".json": true,
}
