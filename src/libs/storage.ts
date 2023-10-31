const storage = logseq.Assets.makeSandboxStorage()

export async function readExpansionState(key: string, readKeys?: Set<string>) {
  readKeys?.add(key)
  key = `expansion-${key}.json`
  const hasItem = await storage.hasItem(key)
  const str = hasItem ? (await storage.getItem(key))! : "{}"
  return JSON.parse(str) as Record<string, boolean>
}

export async function readRootExpansionState(
  key: string,
  readKeys?: Set<string>,
) {
  readKeys?.add(`_${key}`)
  key = `expansion-_${key}.json`
  if (await storage.hasItem(key)) {
    return JSON.parse((await storage.getItem(key))!) as boolean
  } else {
    return false
  }
}

export async function writeRootExpansionState(key: string, value: boolean) {
  key = `expansion-_${key}.json`
  await storage.setItem(key, `${value}`)
}

export async function writeExpansionState(
  key: string,
  value: Record<string, boolean>,
) {
  key = `expansion-${key}.json`
  await storage.setItem(key, JSON.stringify(value))
}

export async function allExpansionKeys() {
  const keys = await storage.allKeys()
  return keys
    .filter((key) => key.startsWith("expansion-"))
    .map((key) =>
      key.substring("expansion-".length, key.length - ".json".length),
    )
}

export async function removeExpansionState(key: string) {
  key = `expansion-${key}.json`
  await storage.removeItem(key)
}
