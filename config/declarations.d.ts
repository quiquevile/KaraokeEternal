declare module '*.css' {
  const classes: { [key: string]: string }
  export = classes
}

declare module '*.json' {
  const data: Record<string, string>
  export default data
}

interface Window {
  webkitAudioContext: typeof AudioContext
}

declare const module: {
  hot?: {
    accept(path: string, callback: () => Promise<void> | void): void
  }
}
