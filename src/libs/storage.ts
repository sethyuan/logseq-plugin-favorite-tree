export async function readExpansionState(key: string, readKeys?: Set<string>) {
  const graphKey = await getGraphKey(key)
  readKeys?.add(graphKey)
  const storeKey = `expansion-${graphKey}.json`
  const hasItem = await storage.hasItem(storeKey)
  const str = hasItem ? (await storage.getItem(storeKey))! : "{}"
  return JSON.parse(str) as Record<string, boolean>
}

export async function readRootExpansionState(
  key: string,
  readKeys?: Set<string>,
) {
  const graphKey = await getGraphKey(key)
  readKeys?.add(`_${graphKey}`)
  const storeKey = `expansion-_${graphKey}.json`
  if (await storage.hasItem(storeKey)) {
    return JSON.parse((await storage.getItem(storeKey))!) as boolean
  } else {
    return false
  }
}

export async function writeRootExpansionState(key: string, value: boolean) {
  const graphKey = await getGraphKey(key)
  const storeKey = `expansion-_${graphKey}.json`
  await storage.setItem(storeKey, `${value}`)
}

export async function writeExpansionState(
  key: string,
  value: Record<string, boolean>,
) {
  const graphKey = await getGraphKey(key)
  const storeKey = `expansion-${graphKey}.json`
  await storage.setItem(storeKey, JSON.stringify(value))
}

export async function allExpansionKeys() {
  const keys = await storage.allKeys()
  if (keys == null) return []
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

async function getGraphKey(key: string) {
  const graph = await logseq.App.getCurrentGraph()
  return `${key}-${graph?.name ?? ""}`
}
