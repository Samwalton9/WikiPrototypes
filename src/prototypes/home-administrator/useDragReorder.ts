import { ref, type Ref } from 'vue'

/**
 * Drag to reorder a list's rows, with pointer events (mouse, pen and touch),
 * and the keyboard way: Up and Down on a row's handle move it one place. The
 * handle holds the pointer; the list reorders as the pointer passes each row's
 * middle, so the row is always where it will land.
 *
 * `list` is the element whose children are the rows, in the items' order.
 * `move(from, to)` puts the item at `from` at `to`.
 */
export function useDragReorder(
  list: Ref<HTMLElement | null>,
  items: () => readonly { id: string }[],
  move: (from: number, to: number) => void,
) {
  const draggingId = ref<string | null>(null)

  function moveIfValid(from: number, to: number): void {
    if (from < 0 || to < 0 || to >= items().length || to === from) return
    move(from, to)
  }

  function onHandlePointerDown(event: PointerEvent, id: string): void {
    if (event.button !== 0) return
    event.preventDefault()
    draggingId.value = id
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onHandlePointerMove(event: PointerEvent): void {
    if (!draggingId.value || !list.value) return
    const from = items().findIndex((item) => item.id === draggingId.value)
    // The new place: how many of the other rows have their middle above the pointer.
    let to = 0
    Array.from(list.value.children).forEach((row, index) => {
      if (index === from) return
      const box = row.getBoundingClientRect()
      if (event.clientY > box.top + box.height / 2) to++
    })
    moveIfValid(from, to)
  }

  function endDrag(): void {
    draggingId.value = null
  }

  function onHandleKeydown(event: KeyboardEvent, index: number): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    moveIfValid(index, index + (event.key === 'ArrowUp' ? -1 : 1))
  }

  /** The handle's listeners, for `v-on`. */
  function handleListeners(id: string, index: number) {
    return {
      pointerdown: (event: PointerEvent) => onHandlePointerDown(event, id),
      pointermove: onHandlePointerMove,
      pointerup: endDrag,
      pointercancel: endDrag,
      keydown: (event: KeyboardEvent) => onHandleKeydown(event, index),
    }
  }

  return { draggingId, handleListeners }
}
