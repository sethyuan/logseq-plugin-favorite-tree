import type { IAsyncStorage } from "@logseq/libs/dist/modules/LSPlugin.Storage"

declare global {
  const storage: IAsyncStorage
}

export {}
