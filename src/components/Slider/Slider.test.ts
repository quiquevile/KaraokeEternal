import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.join(__dirname, 'Slider.css'), 'utf8')

describe('Slider.css', () => {
  it('keeps the browser from panning touches that start on the slider', () => {
    expect(css).toContain('touch-action: none')
    expect(css).not.toContain('pan-x')
  })
})
