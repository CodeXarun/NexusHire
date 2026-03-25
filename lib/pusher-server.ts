import Pusher from 'pusher'

let pusherServer: Pusher | null = null

function getPusherClient(): Pusher {
  if (!pusherServer) {
    const appId = process.env.PUSHER_APP_ID
    const key = process.env.PUSHER_KEY
    const secret = process.env.PUSHER_SECRET
    if (!appId || !key || !secret) {
      throw new Error('Pusher credentials not configured')
    }
    pusherServer = new Pusher({
      appId,
      key,
      secret,
      cluster: process.env.PUSHER_CLUSTER ?? 'ap2',
      useTLS: true,
    })
  }
  return pusherServer
}

export function triggerStageUpdate(jobId: string, applicationId: string, stage: string) {
  return Promise.all([
    getPusherClient().trigger(`job-${jobId}`, 'stage-updated', { applicationId, stage }),
    getPusherClient().trigger(`application-${applicationId}`, 'stage-updated', { stage }),
  ])
}
