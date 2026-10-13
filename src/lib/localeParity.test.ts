import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// source files already migrated to react-intl: every literal `id` used
// must exist in es.json, and es.json must not carry dead keys.
// Extend this list as each area migrates.
const MIGRATED_FILES = [
  'src/routes/Account/views/SignedOutView/SignIn/SignIn.tsx',
  'src/routes/Account/views/SignedOutView/Create/Create.tsx',
  'src/routes/Account/views/SignedOutView/SelectRoom/SelectRoom.tsx',
  'src/routes/Account/views/SignedOutView/SignedOutView.tsx',
  'src/routes/Account/views/FirstRun/FirstRun.tsx',
  'src/routes/Account/components/Account/Account.tsx',
  'src/routes/Account/components/AccountForm/AccountForm.tsx',
  'src/routes/Account/components/AccountForm/permissions.ts',
  'src/routes/Account/components/Users/Users.tsx',
  'src/routes/Account/components/Users/EditUser/EditUser.tsx',
  'src/routes/Account/components/Rooms/Rooms.tsx',
  'src/routes/Account/components/Rooms/EditRoom/EditRoom.tsx',
  'src/routes/Account/components/Rooms/EditRoom/UserPrefs/UserPrefs.tsx',
  'src/routes/Account/components/Prefs/Prefs.tsx',
  'src/routes/Account/components/Prefs/PathPrefs/PathPrefs.tsx',
  'src/routes/Account/components/Prefs/PathPrefs/PathInfo/PathInfo.tsx',
  'src/routes/Account/components/Prefs/PathPrefs/PathChooser/PathChooser.tsx',
  'src/routes/Account/components/Prefs/PlayerPrefs/PlayerPrefs.tsx',
  'src/routes/Account/components/Prefs/YouTubePrefs/YouTubePrefs.tsx',
  'src/routes/Account/components/Prefs/YouTubePrefs/YtDlpChooser/YtDlpChooser.tsx',
  'src/routes/Account/components/Prefs/YouTubePrefs/YtdlUpdater/YtdlUpdater.tsx',
  'src/routes/Account/components/LanguagePrefs/LanguagePrefs.tsx',
  'src/routes/Account/components/About/About.tsx',
  'src/routes/Library/components/LibraryHeader/LibraryHeader.tsx',
  'src/routes/Library/components/SearchResults/SearchResults.tsx',
  'src/routes/Library/components/SongItem/SongItem.tsx',
  'src/routes/Library/views/LibraryView.tsx',
  'src/components/SongInfo/SongInfo.tsx',
  'src/components/EditSongDialog/EditSongDialog.tsx',
  'src/components/MetadataFields/MetadataFields.tsx',
  'src/components/DeleteSongDialog/DeleteSongDialog.tsx',
  'src/components/MoveVersionDialog/MoveVersionDialog.tsx',
  'src/routes/Queue/views/QueueView.tsx',
  'src/routes/Queue/components/QueueItem/QueueItem.tsx',
  'src/routes/Player/components/PlayerTextOverlay/PlayerTextOverlay.tsx',
  'src/routes/Player/components/PlayerTextOverlay/NextUp/NextUp.tsx',
  'src/routes/Youtube/components/YouTubeSearchHeader/YouTubeSearchHeader.tsx',
  'src/routes/Youtube/components/YouTubeSearch/YouTubeSearch.tsx',
  'src/routes/Youtube/components/YouTubeSearchResult/YouTubeSearchResult.tsx',
  'src/routes/Youtube/components/YouTubeDownloads/YouTubeDownloads.tsx',
  'src/routes/Youtube/components/YouTubePreviewDialog/YouTubePreviewDialog.tsx',
  'src/routes/Youtube/components/YouTubeMetadataDialog/YouTubeMetadataDialog.tsx',
]

const collectIds = (source: string): string[] => {
  const ids: string[] = []
  // `id` props/params and `labelId` data fields; message IDs are always
  // namespaced (dotted), which also skips SVG ids like play-icon-gradient
  const pattern = /\b(?:id|labelId)\s*[:=]\s*['"]([^'"]*\.[^'"]*)['"]/g

  let match: RegExpExecArray | null

  while ((match = pattern.exec(source)) !== null) {
    ids.push(match[1])
  }

  return ids
}

describe('locale parity', () => {
  it('es.json matches exactly the IDs used by migrated files', () => {
    const root = path.resolve(__dirname, '../..')
    const used = new Set<string>()

    for (const file of MIGRATED_FILES) {
      const source = fs.readFileSync(path.join(root, file), 'utf8')

      for (const id of collectIds(source)) used.add(id)
    }

    const es = JSON.parse(fs.readFileSync(path.join(root, 'shared/locales/es.json'), 'utf8')) as Record<string, string>
    const keys = new Set(Object.keys(es))

    expect([...used].filter(id => !keys.has(id))).toEqual([])
    expect([...keys].filter(key => !used.has(key))).toEqual([])
  })
})
