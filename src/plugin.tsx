import "@logseq/libs"
import { setup, t } from "logseq-l10n"
import { render } from "preact"
import { throttle } from "rambdax"
import FavList from "./comps/FavList"
import { allExpansionKeys, removeExpansionState } from "./libs/storage"
import { hash, queryForSubItems, setLanguage, waitForEl } from "./libs/utils"
import zhCN from "./translations/zh-CN.json"

const CLEAN_WAIT = 3000

let dragHandle: HTMLElement | null = null

async function main() {
  const { preferredLanguage: lang } = await logseq.App.getUserConfigs()
  setLanguage(logseq.settings?.sortingLocale || lang)

  await setup({ builtinTranslations: { "zh-CN": zhCN } })

  provideStyles()

  logseq.useSettingsSchema([
    {
      key: "hierarchyProperty",
      title: "",
      type: "string",
      default: "tags",
      description: t(
        "It controls which property is used to decide a tag's hierarchy.",
      ),
    },
    {
      key: "filterIcon",
      title: "",
      type: "string",
      default: "🔍",
      description: t("Define an icon for quick filters."),
    },
    {
      key: "hoverArrow",
      title: "",
      type: "boolean",
      default: false,
      description: t("Show arrows only when hovered."),
    },
    {
      key: "taggedPageLimit",
      title: "",
      type: "number",
      default: 30,
      description: t(
        "Maximum number of tagged pages to display on each level for favorites.",
      ),
    },
    {
      key: "sortingLocale",
      title: "",
      type: "string",
      default: "",
      description: t(
        "Locale used in sorting hierarchical favorites. E.g, zh-CN. Keep it empty to use Logseq's language setting.",
      ),
    },
  ])

  const favoritesObserver = new MutationObserver(async (mutationList) => {
    const mutation = mutationList[0]
    if (mutation?.target == null) return
    const target = mutation.target as HTMLElement

    if (
      target.classList?.contains("nav-content-item-inner") ||
      target.classList?.contains("favorites")
    ) {
      await processFavorites()
    }
  })
  const favoritesEl = await waitForEl("#left-sidebar .favorites", 300)
  if (favoritesEl != null) {
    favoritesObserver.observe(favoritesEl, { childList: true, subtree: true })
  }

  const transactionOff = logseq.DB.onChanged(onTransaction)

  const graphOff = logseq.App.onCurrentGraphChanged(async () => {
    ;(window as any).storage = logseq.Assets.makeSandboxStorage()
    await adjustLeftBarWidth()
  })

  await waitForEl("#left-sidebar .favorite-item", 1000)
  ;(window as any).storage = logseq.Assets.makeSandboxStorage()

  const readKeys = new Set<string>()
  await processFavorites(readKeys)
  setTimeout(async () => {
    const keys = await allExpansionKeys()
    const notReadKeys = keys.filter((key) => !readKeys.has(key))
    for (const key of notReadKeys) {
      await removeExpansionState(key)
    }
  }, CLEAN_WAIT)

  await adjustLeftBarWidth()

  logseq.provideUI({
    key: "kef-ft-drag-handle",
    path: "#left-sidebar",
    template: `<div class="kef-ft-drag-handle"></div>`,
  })
  setTimeout(() => {
    dragHandle = parent.document.querySelector(
      "#left-sidebar .kef-ft-drag-handle",
    )!
    dragHandle.addEventListener("pointerdown", onPointerDown)
  }, 0)

  logseq.beforeunload(async () => {
    graphOff()
    transactionOff()
    favoritesObserver.disconnect()
    dragHandle?.removeEventListener("pointerdown", onPointerDown)
  })

  console.log("#favorite-tree loaded")
}

function provideStyles() {
  logseq.provideStyle({
    key: "kef-ft-fav",
    style: `
      .kef-ft-fav-list {
        padding-left: 24px;
        display: none;
      }
      .kef-ft-fav-expanded {
        display: block;
      }
      .kef-ft-fav-arrow {
        flex: 0 0 auto;
        padding: 4px 20px 4px 10px;
        margin-right: -20px;
        opacity: ${logseq.settings?.hoverArrow ? 0 : 1};
        transition: opacity 0.3s;
      }
      :is(.favorite-item, .recent-item):hover > a > .kef-ft-fav-arrow,
      .kef-ft-fav-item:hover > .kef-ft-fav-arrow {
        opacity: 1;
      }
      .kef-ft-fav-arrow svg {
        transform: rotate(90deg) scale(0.8);
        transition: transform 0.04s linear;
      }
      .kef-ft-fav-arrow-expanded svg {
        transform: rotate(0deg) scale(0.8);
      }
      .kef-ft-fav-item {
        display: flex;
        align-items: center;
        padding: 0 24px;
        line-height: 28px;
        color: var(--ls-header-button-background);
        cursor: pointer;
      }
      .kef-ft-fav-item:hover {
        background-color: var(--ls-quaternary-background-color);
      }
      .kef-ft-fav-item-icon {
        flex: 0 0 auto;
        margin-right: 5px;
        width: 16px;
        text-align: center;
      }
      .kef-ft-fav-item-name {
        flex: 1 1 auto;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .kef-ft-drag-handle {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        width: 4px;
        z-index: 10;
      }
      .kef-ft-drag-handle:hover,
      .kef-ft-dragging .kef-ft-drag-handle {
        cursor: col-resize;
        background: var(--ls-active-primary-color);
      }
      .kef-ft-dragging {
        cursor: col-resize;
      }
      .kef-ft-dragging :is(#left-sidebar, #main-content-container) {
        pointer-events: none;
      }
    `,
  })
}

async function processFavorites(readKeys?: Set<string>) {
  const favorites = parent.document.querySelectorAll<HTMLElement>(
    `#left-sidebar .favorite-item`,
  )
  for (const fav of favorites) {
    const items = await queryForSubItems(fav.dataset.ref!)
    injectList(fav, items ?? [], readKeys)
  }
}

async function injectList(
  el: HTMLElement,
  items: any[],
  readKeys?: Set<string>,
) {
  const key = `kef-ft-f-${await hash(el.dataset.ref!)}`

  const arrowContainer = el.querySelector("a")!
  const arrow = arrowContainer.querySelector(".kef-ft-fav-arrow")
  if (arrow != null) {
    arrow.remove()
  }

  if (parent.document.getElementById(key) == null) {
    logseq.provideUI({
      key,
      path: `.favorite-item[data-ref="${el.dataset.ref}"]`,
      template: `<div id="${key}"></div>`,
    })
  }

  setTimeout(() => {
    renderList(key, items, arrowContainer, el.dataset.ref!, readKeys)
  }, 0)
}

function renderList(
  key: string,
  items: any[],
  arrowContainer: HTMLElement,
  name: string,
  readKeys?: Set<string>,
) {
  const el = parent.document.getElementById(key)!
  render(
    <FavList
      items={items}
      arrowContainer={arrowContainer}
      name={name}
      readKeys={readKeys}
    />,
    el,
  )
}

async function onTransaction({ blocks, txData, txMeta }: any) {
  if (needsProcessing(txData)) {
    await processFavorites()
  }
}

async function adjustLeftBarWidth() {
  const graph = (await logseq.App.getCurrentGraph())!
  const storedWidth = parent.localStorage.getItem(`kef-ft-lsw-${graph.name}`)
  if (storedWidth) {
    parent.document.documentElement.style.setProperty(
      "--ls-left-sidebar-width",
      `${+storedWidth}px`,
    )
  }
}

function needsProcessing(txData: any[]) {
  const hierarchyProperty = logseq.settings?.hierarchyProperty ?? "tags"
  let oldProperty, newProperty
  let oldQuickFilters, newQuickFilters
  for (const [_e, attr, val, _tx, added] of txData) {
    if (attr === "originalName") return true
    if (hierarchyProperty === "tags" && attr === "tags") return true
    if (attr === "properties") {
      if (val[hierarchyProperty]) {
        if (added) {
          newProperty = val[hierarchyProperty]
        } else {
          oldProperty = val[hierarchyProperty]
        }
      }
      if (val.quickFilters) {
        if (added) {
          newQuickFilters = val.quickFilters
        } else {
          oldQuickFilters = val.quickFilters
        }
      }
    }
  }
  if (
    (!oldProperty && !newProperty && !oldQuickFilters && !newQuickFilters) ||
    (oldProperty?.toString() === newProperty?.toString() &&
      oldQuickFilters === newQuickFilters)
  )
    return false
  return true
}

function onPointerDown(e: Event) {
  e.preventDefault()
  parent.document.documentElement.classList.add("kef-ft-dragging")
  parent.document.addEventListener("pointermove", onPointerMove)
  parent.document.addEventListener("pointerup", onPointerUp)
  parent.document.addEventListener("pointercancel", onPointerUp)
}

function onPointerUp(e: MouseEvent) {
  e.preventDefault()
  parent.document.removeEventListener("pointermove", onPointerMove)
  parent.document.removeEventListener("pointerup", onPointerUp)
  parent.document.removeEventListener("pointercancel", onPointerUp)
  parent.document.documentElement.classList.remove("kef-ft-dragging")

  const pos = Math.max(150, e.clientX)
  parent.document.documentElement.style.setProperty(
    "--ls-left-sidebar-width",
    `${pos}px`,
  )
  ;(async () => {
    const graph = (await logseq.App.getCurrentGraph())!
    parent.localStorage.setItem(`kef-ft-lsw-${graph.name}`, `${pos}`)
  })()
}

function onPointerMove(e: MouseEvent) {
  e.preventDefault()
  move(Math.max(150, e.clientX))
}

const move = throttle((pos) => {
  parent.document.documentElement.style.setProperty(
    "--ls-left-sidebar-width",
    `${pos}px`,
  )
}, 12)

logseq.ready(main).catch(console.error)
