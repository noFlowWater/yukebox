import type { FastifyInstance } from 'fastify'
import {
  handleGetSchedules,
  handleCreateSchedule,
  handleDeleteSchedule,
  handleDeleteAllSchedules,
} from '../controllers/schedule.controller.js'

export default async function scheduleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/schedules', handleGetSchedules)
  app.post('/api/schedules', handleCreateSchedule)
  app.delete('/api/schedules', handleDeleteAllSchedules)
  app.delete('/api/schedules/:id', handleDeleteSchedule)
}
