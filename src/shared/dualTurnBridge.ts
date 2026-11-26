import { z } from 'zod'
import { SceneRequestSchema } from './types'
import type { DualIssue } from './game/dualTurnContract'
import type { DualReady } from './game/dualSession'

export const DualBeginSchema = SceneRequestSchema.extend({ sessionId: z.uuid(), turnId: z.uuid(),
  revision: z.number().int().nonnegative(), contentRevision: z.string().min(1).max(128) }).strict()
export type DualBeginRequest = z.infer<typeof DualBeginSchema>
export const DualControlSchema = z.object({ sessionId: z.uuid(), turnId: z.uuid(), token: z.uuid() }).strict()
export type DualControlRequest = z.infer<typeof DualControlSchema>
export const DualCancelSchema = DualControlSchema.omit({ token: true }).strict()
export const DualInvalidateSchema = z.object({ sessionId: z.uuid() }).strict()
export const DualRegenerateSchema = DualBeginSchema.extend({ previousTurnId: z.uuid(), previousToken: z.uuid() }).strict()
export type DualRegenerateRequest = z.infer<typeof DualRegenerateSchema>
export type DualBridgeResult =
  | { status: 'ready'; token: string; ready: DualReady }
  | { status: 'discarded'; token?: string }
  | { status: 'held'; token: string; turnId: string; role: 'writer' | 'manager'; actions: ('retryManager' | 'regenerate' | 'cancel')[]; issues: DualIssue[]; failure?: string }
  | { status: 'failed'; code: 'forbidden' | 'invalid-request' | 'unavailable' | 'stale' | 'request-failed' }
export interface DualTurnApi {
  info(): Promise<{ contentRevision: string; available: boolean }>
  begin(request: DualBeginRequest): Promise<DualBridgeResult>
  retry(request: DualControlRequest): Promise<DualBridgeResult>
  regenerate(request: DualRegenerateRequest): Promise<DualBridgeResult>
  cancel(request: Omit<DualControlRequest, 'token'>): Promise<boolean>
  invalidate(request: { sessionId: string }): Promise<boolean>
  acknowledge(request: DualControlRequest): Promise<boolean>
}
