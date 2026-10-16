import React, { useRef } from 'react'
import Icon from 'components/Icon/Icon'
import styles from './RecentSearches.css'

// drag distance that dismisses the dropdown when swiped past a scroll edge
const DISMISS_THRESHOLD_PX = 10

interface RecentSearchesProps {
  items: string[]
  label: string
  onSelect(term: string): void
  onClose(): void
}

// Dropdown with the recent searches matching the current input.
//
// Dismissal is deliberately generous: besides onClose from the outside
// (blur, outside scroll, Escape, selection), dragging or wheeling on the
// list itself closes it once the inner scroll can't go further that way,
// so the results underneath are always one gesture away.
const RecentSearches = ({ items, label, onSelect, onClose }: RecentSearchesProps) => {
  const listRef = useRef<HTMLDivElement>(null)
  const touchRef = useRef<{ y: number, scrollTop: number } | null>(null)

  if (items.length === 0) return null

  const atEdge = (element: HTMLElement, direction: number) => {
    const { scrollTop, scrollHeight, clientHeight } = element

    if (scrollHeight <= clientHeight + 1) return true

    return (direction < 0 && scrollTop <= 0) || (direction > 0 && scrollTop + clientHeight >= scrollHeight - 1)
  }

  const handleTouchStart = (event: React.TouchEvent) => {
    touchRef.current = {
      y: event.touches[0].clientY,
      scrollTop: listRef.current?.scrollTop ?? 0,
    }
  }

  const handleTouchMove = (event: React.TouchEvent) => {
    const start = touchRef.current
    const element = listRef.current

    if (!start || !element) return

    const deltaY = event.touches[0].clientY - start.y

    if (Math.abs(deltaY) >= DISMISS_THRESHOLD_PX && atEdge(element, deltaY)) {
      touchRef.current = null
      onClose()
    }
  }

  const handleWheel = (event: React.WheelEvent) => {
    const element = listRef.current

    if (element && Math.abs(event.deltaY) > 0 && atEdge(element, event.deltaY)) {
      onClose()
    }
  }

  return (
    <div className={styles.container} role='listbox' aria-label={label}>
      <div
        className={styles.list}
        ref={listRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onWheel={handleWheel}
      >
        {items.map(term => (
          <button
            key={term}
            type='button'
            role='option'
            aria-selected='false'
            className={styles.item}
            onMouseDown={() => onSelect(term)}
          >
            <Icon icon='HISTORY' size={20} className={styles.itemIcon} />
            <span className={styles.itemText} translate='no'>{term}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default RecentSearches
