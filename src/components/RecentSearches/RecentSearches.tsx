import React from 'react'
import Icon from 'components/Icon/Icon'
import type icons from 'components/Icon/icons'
import styles from './RecentSearches.css'

export interface DropdownItem {
  value: string
  label: string
}

interface RecentSearchesProps {
  items: DropdownItem[]
  label: string
  icon?: keyof typeof icons
  onSelect(value: string): void
}

// Dropdown with matching entries under an input (recent searches, users).
//
// Dismissal comes from the outside (blur, outside scroll, Escape,
// selection): gestures on the list itself are left alone so a long
// list scrolls natively.
const RecentSearches = ({ items, label, icon = 'HISTORY', onSelect }: RecentSearchesProps) => {
  if (items.length === 0) return null

  return (
    <div className={styles.container} role='listbox' aria-label={label}>
      <div className={styles.list}>
        {items.map(item => (
          <button
            key={item.value}
            type='button'
            role='option'
            aria-selected='false'
            className={styles.item}
            onMouseDown={() => onSelect(item.value)}
          >
            <Icon icon={icon} size={20} className={styles.itemIcon} />
            <span className={styles.itemText} translate='no'>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default RecentSearches
