export const emitQueueUpdated = () => window.dispatchEvent(new Event('queue-updated'))
export const emitScheduleUpdated = () => window.dispatchEvent(new Event('schedule-updated'))
export const emitFavoritesUpdated = () => window.dispatchEvent(new Event('favorites-updated'))
