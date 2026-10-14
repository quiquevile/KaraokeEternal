import type { MessageDescriptor } from 'react-intl'

export const playerRouteMessages: Record<string, MessageDescriptor> = {
  moreSongs: { id: 'player.overlay.moreSongs', defaultMessage: 'CAN HAZ MOAR SONGZ?' },
  next: { id: 'player.nextUp.next', defaultMessage: 'Next: {name}' },
  oops: { id: 'player.overlay.oops', defaultMessage: 'OOPS...' },
  seeQueue: { id: 'player.overlay.seeQueue', defaultMessage: 'SEE QUEUE FOR DETAILS' },
}
