import Pusher from 'pusher'

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER ?? 'ap2',
  useTLS: true,
})

export function triggerStageUpdate(jobId: string, applicationId: string, stage: string) {
  return Promise.all([
    pusherServer.trigger(`job-${jobId}`, 'stage-updated', { applicationId, stage }),
    pusherServer.trigger(`application-${applicationId}`, 'stage-updated', { stage }),
  ])
}
