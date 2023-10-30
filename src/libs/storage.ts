const storage = logseq.Assets.makeSandboxStorage()

export async function readExpansionState(key: string) {
  key = `expansion-${key}.json`
  const str = (await storage.hasItem(key))
    ? (await storage.getItem(key))!
    : "{}"
  return JSON.parse(str) as Record<string, boolean>
}

export async function readRootExpansionState(key: string) {
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
