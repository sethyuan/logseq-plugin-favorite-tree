import { createPortal } from "preact/compat"
import { useEffect, useRef, useState } from "preact/hooks"
import { cls } from "reactutils"
import {
  readExpansionState,
  readRootExpansionState,
  writeExpansionState,
  writeRootExpansionState,
} from "../libs/storage"
import { queryForSubItems } from "../libs/utils"
import FavArrow from "./FavArrow"

export default function FavList({
  items,
  arrowContainer,
  name,
  readKeys,
}: {
  items: any[]
  arrowContainer: HTMLElement
  name: string
  readKeys?: Set<string>
}) {
  const [expanded, setExpanded] = useState(false)
  const [allExpansionState, setAllExpansionState] = useState<
    boolean | undefined
  >()

  useEffect(() => {
    ;(async () => {
      setExpanded(await readRootExpansionState(name, readKeys))
    })()
  }, [name])

  useEffect(() => {
    if (items.length === 0) {
      const arrows = arrowContainer.querySelectorAll(".kef-ft-fav-arrow")
      for (const arrow of arrows) {
        arrow.remove()
      }
    }
  }, [items.length])

  function toggleList(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    setExpanded((v) => !v)
    if (e.altKey) {
      setAllExpansionState(!expanded)
    } else {
      setAllExpansionState(undefined)
    }
    writeRootExpansionState(name, !expanded)
  }

  return (
    <>
      {items.length > 0 &&
        createPortal(
          <FavArrow expanded={expanded} onToggle={toggleList} />,
          arrowContainer,
        )}
      <SubList
        items={items}
        shown={expanded}
        storageKey={name}
        readKeys={readKeys}
        allExpansionState={allExpansionState}
      />
    </>
  )
}

function SubList({
  items,
  shown,
  storageKey,
  readKeys,
  allExpansionState,
}: {
  items: any[]
  shown: boolean
  storageKey: string
  readKeys?: Set<string>
  allExpansionState?: boolean
}) {
  const [childrenData, setChildrenData] = useState<any>(null)
  const expansionState = useRef<Record<string, boolean>>()

  useEffect(() => {
    setChildrenData(null)
  }, [items])

  useEffect(() => {
    if (shown && childrenData == null) {
      ;(async () => {
        expansionState.current = await readExpansionState(storageKey, readKeys)
        const data: any = {}
        for (const item of items) {
          if (item.filters) {
            if (item.subitems) {
              data[item.displayName] = {
                expanded: !!expansionState.current[item.displayName],
                items: Object.values(item.subitems),
              }
            }
          } else {
            const subitems = await queryForSubItems(item["original-name"])
            if (subitems?.length > 0) {
              data[item.name] = {
                expanded: !!expansionState.current[item.name],
                items: subitems,
              }
            }
          }
        }
        updateChildrenData(data)
        setChildrenData(data)
      })()
    }
  }, [shown, childrenData, items])

  useEffect(() => {
    if (childrenData != null) {
      const newData = { ...childrenData }
      updateChildrenData(newData)
      setChildrenData(newData)
    }
  }, [allExpansionState])

  function updateChildrenData(data: any) {
    for (const item of items) {
      const name = item.filters ? item.displayName : item.name
      const itemData = data[name]
      if (itemData) {
        if (allExpansionState != null) {
          itemData.expanded = allExpansionState
        }
        itemData.allExpansionState = allExpansionState
      }
      if (allExpansionState != null && expansionState.current != null) {
        expansionState.current[name] = allExpansionState
      }
    }
    if (expansionState.current != null) {
      writeExpansionState(storageKey, expansionState.current)
    }
  }

  async function openPage(e: MouseEvent, item: any) {
    e.preventDefault()
    e.stopPropagation()

    if (item.filters) {
      let content = (await logseq.Editor.getBlock(
        item.blockUUID,
      ))!.content.replace(/\n*^filters:: .*\n*/m, "")
      content += `\nfilters:: ${`{${item.filters
        .map((filter: string) => `"${filter.toLowerCase()}" true`)
        .join(", ")}}`}`
      await logseq.Editor.updateBlock(item.blockUUID, content)
    }

    const url = new URL(`http://localhost${parent.location.hash.substring(6)}`)
    const isAlreadyOnPage =
      decodeURIComponent(url.pathname.substring(1)) === item.name
    if (!isAlreadyOnPage) {
      if (e.shiftKey) {
        logseq.Editor.openInRightSidebar(item.uuid ?? item.pageUUID)
      } else {
        ;(logseq.Editor.scrollToBlockInPage as any)(item.name)
      }
    } else if (item.filters) {
      if (e.shiftKey) {
        // NOTE: right sidebar refreshing is not possible yet.
        logseq.Editor.openInRightSidebar(item.uuid ?? item.pageUUID)
      } else {
        // HACK: remove this hack later when Logseq's responsive refresh is fixed.
        ;(logseq.Editor.scrollToBlockInPage as any)(item.blockUUID)
        setTimeout(() => {
          ;(logseq.Editor.scrollToBlockInPage as any)(item.name)
        }, 50)
      }
    }
  }

  function toggleChild(e: MouseEvent, itemName: string) {
    e.preventDefault()
    e.stopPropagation()

    const altKey = e.altKey
    const newData = { ...childrenData }
    const expanded = !newData[itemName].expanded
    newData[itemName].expanded = expanded
    if (altKey) {
      newData[itemName].allExpansionState = expanded
    } else {
      newData[itemName].allExpansionState = undefined
    }
    setChildrenData(newData)

    if (expansionState.current) {
      expansionState.current[itemName] = expanded
      writeExpansionState(storageKey, expansionState.current)
    }
  }

  function preventSideEffect(e: Event) {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      class={cls("kef-ft-fav-list", shown && "kef-ft-fav-expanded")}
      onMouseDown={preventSideEffect}
    >
      {items.map((item) => {
        const displayName = item.displayName ?? item["original-name"]
        const data = item.filters
          ? childrenData?.[item.displayName]
          : childrenData?.[item.name]

        return (
          <div key={item.name}>
            <div class="kef-ft-fav-item" onClick={(e) => openPage(e, item)}>
              {item.filters ? (
                <div class="kef-ft-fav-item-icon">
                  {logseq.settings?.filterIcon ?? "🔎"}
                </div>
              ) : item.properties?.icon ? (
                <div class="kef-ft-fav-item-icon">{item.properties?.icon}</div>
              ) : (
                <span class="ui__icon tie tie-page kef-ft-fav-item-icon"></span>
              )}
              <div class="kef-ft-fav-item-name" title={displayName}>
                {item.filters &&
                displayName.toLowerCase().startsWith(`${item.name}/`)
                  ? displayName.substring(item.name.length + 1)
                  : displayName}
              </div>
              {data && (
                <FavArrow
                  expanded={data.expanded}
                  onToggle={(e: MouseEvent) =>
                    item.filters
                      ? toggleChild(e, item.displayName)
                      : toggleChild(e, item.name)
                  }
                />
              )}
            </div>
            {data?.items?.length > 0 && (
              <SubList
                items={data.items}
                shown={data.expanded}
                storageKey={`${storageKey}-${displayName}`}
                readKeys={readKeys}
                allExpansionState={data.allExpansionState}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
