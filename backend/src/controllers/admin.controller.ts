import type { FastifyRequest, FastifyReply } from 'fastify'
import * as userRepo from '../repositories/user.repository.js'
import { toPublicUser } from '../types/user.js'
import { updateRoleSchema } from '../validators/auth.validator.js'
import { ok, fail } from '../types/api.js'

export async function handleGetUsers(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const users = userRepo.findAll()
    reply.status(200).send(ok(users.map(toPublicUser)))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('ADMIN_ERROR', message))
  }
}

export async function handleDeleteUser(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const targetId = Number(request.params.id)
    if (isNaN(targetId) || targetId <= 0) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid user ID'))
      return
    }

    const target = userRepo.findById(targetId)
    if (!target) {
      reply.status(404).send(fail('NOT_FOUND', 'User not found'))
      return
    }

    // Cannot delete yourself
    if (target.id === request.userId) {
      reply.status(403).send(fail('FORBIDDEN', 'Cannot delete your own account'))
      return
    }

    // Cannot delete the last admin
    if (target.role === 'admin' && userRepo.countAdmins() <= 1) {
      reply.status(403).send(fail('FORBIDDEN', 'Cannot delete the last admin'))
      return
    }

    userRepo.remove(targetId)
    reply.status(200).send(ok({ removed: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('ADMIN_ERROR', message))
  }
}

export async function handleUpdateRole(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const parsed = updateRoleSchema.safeParse(request.body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      reply.status(400).send(fail('VALIDATION_ERROR', messages.join('; ')))
      return
    }

    const targetId = Number(request.params.id)
    if (isNaN(targetId) || targetId <= 0) {
      reply.status(400).send(fail('VALIDATION_ERROR', 'Invalid user ID'))
      return
    }

    const target = userRepo.findById(targetId)
    if (!target) {
      reply.status(404).send(fail('NOT_FOUND', 'User not found'))
      return
    }

    // Cannot change own role
    if (target.id === request.userId) {
      reply.status(403).send(fail('FORBIDDEN', 'Cannot change your own role'))
      return
    }

    // Prevent removing the last admin
    const isCurrentlyAdmin = target.role === 'admin'
    const willBeAdmin = parsed.data.role === 'admin'
    if (isCurrentlyAdmin && !willBeAdmin && userRepo.countAdmins() <= 1) {
      reply.status(403).send(fail('FORBIDDEN', 'Cannot remove the last admin'))
      return
    }

    userRepo.updateRole(targetId, parsed.data.role)
    const updated = userRepo.findById(targetId)!
    reply.status(200).send(ok(toPublicUser(updated)))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    reply.status(500).send(fail('ADMIN_ERROR', message))
  }
}
