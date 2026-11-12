import React from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { useIntl } from 'react-intl'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import { Path } from 'shared/types'
import { commonMessages } from 'lib/messages'
import styles from './PathItem.css'
import { accountMessages } from '../../../../messages'

interface PathItemProps {
  index: number
  isScanDisabled?: boolean
  onInfo: (pathId: number) => void
  onRefresh: (pathId: number) => void
  path: Path
}

const PathItem = ({ index, isScanDisabled, onInfo, onRefresh, path }: PathItemProps) => {
  const intl = useIntl()
  const handleInfo = (e: React.SyntheticEvent<HTMLElement>) => onInfo(parseInt(e.currentTarget.dataset.pathId))
  const handleRefresh = (e: React.SyntheticEvent<HTMLElement>) => onRefresh(parseInt(e.currentTarget.dataset.pathId))

  return (
    <Draggable draggableId={`path-${path.pathId}`} index={index}>
      {provided => (
        <div
          className={styles.pathItem}
          key={path.pathId}
          ref={provided.innerRef}
          style={provided.draggableProps.style}
          {...provided.draggableProps}
        >
          <div {...provided.dragHandleProps} tabIndex={-1} aria-label={intl.formatMessage(commonMessages.dragToReorder)}>
            <Icon icon='DRAG_INDICATOR' className={styles.btnDrag} />
          </div>
          <div className={styles.pathName}>
            {path.path}
          </div>
          <Button
            className={styles.btnRefresh}
            data-path-id={path.pathId}
            disabled={isScanDisabled}
            icon='REFRESH'
            onClick={handleRefresh}
            aria-label={intl.formatMessage(accountMessages.pathInfoRescan)}
          />
          <Button
            className={styles.btnInfo}
            data-path-id={path.pathId}
            icon='INFO_OUTLINE'
            onClick={handleInfo}
            aria-label={intl.formatMessage(accountMessages.pathInfoFolderInfo)}
          />
        </div>
      )}
    </Draggable>
  )
}

export default PathItem
