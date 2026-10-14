import React, { useEffect, useState, useRef } from 'react'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { setFilterStr, resetFilterStr, toggleFilterDownloaded, toggleFilterStarred } from '../../modules/library'
import { fetchPrefs } from 'store/modules/prefs'
import { setYoutubeQuery, searchYoutubeVideos } from 'store/modules/youtube'
import { hasPermission } from 'store/modules/user'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import styles from './LibraryHeader.css'
import { commonMessages } from '../../../../lib/messages'
import { libraryMessages } from '../../messages'

const LibraryHeader = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const intl = useIntl()
  const { filterStr, filterStarred, filterDownloaded } = useAppSelector(state => state.library)
  const user = useAppSelector(state => state.user)
  const canDownload = hasPermission(user, 'youtubeDownload')
  const hasDownloadPath = useAppSelector(state => state.prefs.youtubeDownloadPathId != null)
  const showDownloadFilter = useAppSelector(state =>
    state.user.isAdmin && state.prefs.youtubeDownloadPathId != null,
  )

  // the download-folder filter needs global prefs, which are only fetched
  // at login: re-fetch on mount when missing so the button self-heals
  useEffect(() => {
    if (user.userId !== null && !hasDownloadPath) {
      dispatch(fetchPrefs())
    }
  }, [dispatch, user.userId, hasDownloadPath])

  const searchInput = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(filterStr)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value)
    dispatch(setFilterStr(event.target.value))
  }

  const clearSearch = () => {
    setValue('')
    dispatch(resetFilterStr())
  }

  const handleMagnifierClick = () => {
    const text = value.trim()

    if (!text) {
      searchInput.current?.focus()
      return
    }

    if (!canDownload) {
      clearSearch()
      return
    }

    // jump to the YouTube tab searching for the same text
    dispatch(setYoutubeQuery(text))
    void dispatch(searchYoutubeVideos(text))
    navigate('/youtube')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleMagnifierClick()
  }

  return (
    <div className={styles.container}>
      <Button
        className={clsx(styles.btnMagnifier, filterStr && styles.active)}
        icon='MAGNIFIER'
        onClick={handleMagnifierClick}
        aria-label={filterStr
          ? intl.formatMessage(libraryMessages.searchYoutube)
          : intl.formatMessage(libraryMessages.searchLibrary)}
      >
        {filterStr && <Icon icon='NAV_YOUTUBE' className={styles.ytBadge} />}
      </Button>
      <input
        type='search'
        className={styles.searchInput}
        placeholder={intl.formatMessage(libraryMessages.search)}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        ref={searchInput}
      />
      {filterStr && (
        <Button
          icon='CLEAR'
          onClick={clearSearch}
          className={clsx(styles.btnClear, styles.active)}
          aria-label={intl.formatMessage(commonMessages.clearSearch)}
        />
      )}
      {showDownloadFilter && (
        <Button
          className={clsx(styles.btnDownload, filterDownloaded && styles.active)}
          icon='DOWNLOAD'
          onClick={() => dispatch(toggleFilterDownloaded())}
          aria-label={intl.formatMessage(libraryMessages.downloadedOnly)}
          aria-pressed={filterDownloaded}
        />
      )}
      <Button
        className={clsx(styles.btnStar, filterStarred && styles.active)}
        icon='STAR_FULL'
        onClick={() => dispatch(toggleFilterStarred())}
        aria-label={intl.formatMessage(libraryMessages.starredOnly)}
        aria-pressed={filterStarred}
      />
    </div>
  )
}

export default LibraryHeader
