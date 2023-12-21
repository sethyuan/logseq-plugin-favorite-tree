import { cls } from "reactutils"

export default function FavArrow({
  expanded,
  onToggle,
}: {
  expanded: boolean
  onToggle: (e: MouseEvent) => void
}) {
  return (
    <span
      class={cls("kef-ft-fav-arrow", expanded && "kef-ft-fav-arrow-expanded")}
      onClick={onToggle}
    >
      <svg
        version="1.1"
        viewBox="0 0 128 128"
        fill="currentColor"
        display="inline-block"
        class="h-3 w-3"
      >
        <path d="M64.177 100.069a7.889 7.889 0 01-5.6-2.316l-55.98-55.98a7.92 7.92 0 010-11.196c3.086-3.085 8.105-3.092 11.196 0l50.382 50.382 50.382-50.382a7.92 7.92 0 0111.195 0c3.086 3.086 3.092 8.104 0 11.196l-55.98 55.98a7.892 7.892 0 01-5.595 2.316z"></path>
      </svg>
    </span>
  )
}
