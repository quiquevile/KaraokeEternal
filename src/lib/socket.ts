import io from 'socket.io-client'

const socket = io({
  autoConnect: false,
  // document is only missing outside the browser (unit tests)
  path: typeof document !== 'undefined'
    ? new URL(document.baseURI).pathname + 'socket.io'
    : '/socket.io',
})

export default socket
