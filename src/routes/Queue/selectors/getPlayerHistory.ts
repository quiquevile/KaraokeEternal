import { RootState } from 'store/store'
import { createSelector } from '@reduxjs/toolkit'
import { parseNumberArray } from 'lib/util'

const getPlayerHistoryJSON = (state: RootState) => state.status.historyJSON

const getPlayerHistory = createSelector(
  [getPlayerHistoryJSON],
  history => parseNumberArray(history),
)

export default getPlayerHistory
