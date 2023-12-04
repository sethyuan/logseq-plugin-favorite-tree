import { partition } from "rambdax"

let language: string

export function setLanguage(val: string) {
  language = val
}

export async function hash(text: string) {
  if (!text) return ""

  const bytes = new TextEncoder().encode(text)
  const hashedArray = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-1", bytes)),
  )
  const hashed = hashedArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return hashed
}

export async function queryForSubItems(name: string) {
  name = name.toLowerCase()

  const namespaceChildren = (
    await logseq.DB.datascriptQuery(
      `[:find (pull ?p [:block/name :block/original-name :block/uuid :block/properties])
       :in $ ?name
       :where
       [?t :block/name ?name]
       [?p :block/namespace ?t]]`,
      `"${name}"`,
    )
  ).flat()
  namespaceChildren.forEach((p: any) => {
    const originalName = p["original-name"]
    const trimStart = originalName.lastIndexOf("/")
    p.displayName =
      trimStart > -1 ? originalName.substring(trimStart + 1) : originalName
  })

  const hierarchyProperty = logseq.settings?.hierarchyProperty ?? "tags"
  const taggedPages = (
    await logseq.DB.datascriptQuery(
      hierarchyProperty === "tags"
        ? `[:find (pull ?p [:block/name :block/original-name :block/uuid :block/properties])
            :in $ ?name ?equals ?contains
            :where
            [?t :block/name ?name]
            [?p :block/tags ?t]]`
        : `[:find (pull ?p [:block/name :block/original-name :block/uuid :block/properties])
            :in $ ?name ?equals ?contains
            :where
            [?p :block/original-name]
            [?p :block/properties ?props]
            [(get ?props :${hierarchyProperty}) ?v]
            (or [(?equals ?v ?name)] [(?contains ?v ?name)])]`,
      `"${name}"`,
      equals,
      contains,
    )
  )
    .flat()
    .filter((p: any) => !p.name.startsWith(`${name}/`))

  const quickFilters = await getQuickFilters(name)

  if (
    namespaceChildren.length === 0 &&
    taggedPages.length === 0 &&
    quickFilters.length === 0
  )
    return namespaceChildren

  const list = namespaceChildren.concat(taggedPages).concat(quickFilters)
  const [fixed, dynamic] = partition(
    (p: any) => p.properties?.fixed != null,
    list,
  )
  fixed.sort((a, b) => a.properties.fixed - b.properties.fixed)
  dynamic.sort((a, b) =>
    (a.displayName ?? a["original-name"]).localeCompare(
      b.displayName ?? b["original-name"],
      language,
    ),
  )
  const result = fixed
    .concat(dynamic)
    .slice(0, logseq.settings?.taggedPageLimit ?? 30)

  return result
}

export function waitForEl(selector: string, timeout: number) {
  const start = Date.now()

  function tryFindEl(resolve: (el: Element | null) => void) {
    const el = parent.document.querySelector(selector)
    if (el != null) {
      resolve(el)
    } else if (Date.now() - start <= timeout) {
      setTimeout(() => tryFindEl(resolve), 100)
    } else {
      resolve(null)
    }
  }

  return new Promise(tryFindEl)
}

async function getQuickFilters(name: string) {
  const [{ uuid: blockUUID }, { uuid: pageUUID }] = (
    await logseq.DB.datascriptQuery(
      `[:find (pull ?b [:block/uuid]) (pull ?p [:block/uuid])
      :in $ ?name
      :where
      [?p :block/name ?name]
      [?b :block/page ?p]
      [?b :block/pre-block? true]]`,
      `"${name}"`,
    )
  )[0] ?? [{}, {}]
  if (blockUUID == null || pageUUID == null) return []

  let quickFiltersStr
  try {
    quickFiltersStr = JSON.parse(
      (await logseq.Editor.getBlockProperty(blockUUID, "quick-filters")) ??
        '""',
    )
  } catch (err) {
    console.error(err)
    return []
  }
  if (!quickFiltersStr) return []

  const groups = quickFiltersStr.match(/(?:\d+\s+)?(?:\[\[[^\]]+\]\]\s*)+/g)
  if (groups == null) return []

  const quickFilters = groups
    .map((filterStr: string) => {
      const matches = Array.from(
        filterStr.matchAll(/\[\[([^\]]+)\]\]\s*|(\d+)/g),
      )
      const fixed = matches[0][2] ? +matches[0][2] : null
      const tags = (fixed == null ? matches : matches.slice(1)).map((m) => m[1])
      return [tags, fixed]
    })
    .filter(([tags, fixed]: any) => tags.length > 0)
    .reduce((filter: any, [tags, fixed]: any) => {
      if (filter[tags[0]] == null) {
        filter[tags[0]] = {}
        if (fixed != null) {
          filter[tags[0]].properties = { fixed }
        }
      }
      constructFilter(filter[tags[0]], name, blockUUID, pageUUID, tags, [])
      return filter
    }, {})

  return Object.values(quickFilters)
}

function constructFilter(
  obj: Record<string, any>,
  name: string,
  blockUUID: string,
  pageUUID: string,
  tags: string[],
  path: string[],
) {
  if (obj.displayName == null) {
    obj.name = name
    obj.blockUUID = blockUUID
    obj.pageUUID = pageUUID
    obj.displayName = tags[0]
    obj.filters = [...path, tags[0]]
  }

  tags = tags.slice(1)
  if (tags.length === 0) return

  if (obj.subitems == null) {
    obj.subitems = {}
  }
  if (obj.subitems[tags[0]] == null) {
    obj.subitems[tags[0]] = {}
  }
  constructFilter(
    obj.subitems[tags[0]],
    name,
    blockUUID,
    pageUUID,
    tags,
    obj.filters,
  )
}

function equals(prop: any, val: string) {
  if (prop.toLowerCase == null) return false
  return prop.toLowerCase() === val.toLowerCase()
}

function contains(prop: any, val: string) {
  if (!Array.isArray(prop)) return false
  const lowerVal = val.toLowerCase()
  return prop.some((v) => v.toLowerCase() === lowerVal)
}
