import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)

export interface FileSystemEntry {
  path: string
  name: string
  isDir: boolean
}

const getEntries = (dir: string): Promise<FileSystemEntry[]> => readdir(dir, { withFileTypes: true })
  .then(list => Promise.all(list.map(async (ent) => {
    try {
      const st = await stat(path.resolve(dir, ent.name))

      if (!st.isDirectory() && !st.isFile()) return null

      return {
        path: path.resolve(dir, ent.name),
        name: ent.name,
        isDir: st.isDirectory(),
      }
    } catch {
      return null
    }
  })))
  .then(list => list.filter((entry): entry is FileSystemEntry => !!entry))
  .then(list => list.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name)))

export default getEntries
