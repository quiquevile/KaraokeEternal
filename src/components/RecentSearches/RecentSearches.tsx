import React from 'react'
import Icon from 'components/Icon/Icon'
import styles from './RecentSearches.css'

interface RecentSearchesProps {
  items: string[]
  label: string
  onSelect(term: string): void
}

// Dropdown with the recent searches matching the current input.
//
// Dismissal comes from the outside (blur, outside scroll, Escape,
// selection): gestures on the list itself are left alone so a long
// history scrolls natively.
const RecentSearches = ({ items, label, onSelect }: RecentSearchesProps) => {
  if (items.length === 0) return null

  return (
    <div className={styles.container} role='listbox' aria-label={label}>
      <div className={styles.list}>
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
