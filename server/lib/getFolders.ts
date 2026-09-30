import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
const readdir = promisify(fs.readdir)

const getFolders = (dir: string): Promise<string[]> => readdir(dir, { withFileTypes: true })
  .then(list => list.map(ent => ent.isDirectory() ? path.resolve(dir, ent.name) : null))
  .then(list => list.filter((f): f is string => !!f).sort())

export default getFolders
