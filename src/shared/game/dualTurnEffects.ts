import { basePoseId, isMoment, isSeeding, poseMedia, pregnantPoseId, type ContentPack, type GameState, type Scene } from '../model'
import type { ChatResponse } from '../types'
import { t } from '../i18n'
import { acceptProposal, proposeMeeting } from './appointments'
import { contactsSaid, giveContact, hasContact } from './courier'
import { addEventGoers } from './events'
import { groupPose } from './groups'
import { onBirthControl, sexGate, stopBirthControl } from './intimacy'
import { conceive, pregnancyStage, wornOutfit } from './pregnancy'
import { applyComfort, applyLook, applyLooks, catchphraseAt, leaveScene, sceneCast, sexWrittenOf, validLook } from './scene'
import { findDestination, movedScene, moveState, passSceneTime, sceneDestinations } from './sceneMoves'
import { skillLevel } from './skills'
import { sharedUpcoming } from './upcoming'
import { toDate } from './calendar'
import { type DualCheck, type DualIssue, type DualNoteEntry } from './dualTurnContract'
import { validateDualManagerReply, type CheckedDualManager, type CheckedDualWriter, type DualValidationContext } from './dualTurnValidation'

export interface DualNoteChange { action: 'record' | 'supersede' | 'resolve'; targetEntryId: string | null; entry: DualNoteEntry }
export interface DualTurnEffects extends Omit<ChatResponse, 'profileRole'> {
  profileRole: 'writer' | 'nsfw'
  managerProfileId: string
  noteChanges: DualNoteChange[]
}

/** Existing detectors provide independent checks; free-text interpretation still belongs to Manager's reviewed envelope. */
export function checkDualConsistency(context: DualValidationContext, writer: CheckedDualWriter, manager: CheckedDualManager): DualIssue[] {
  const { content, state, scene } = context, cast = sceneCast(scene)
  const people = content.loveInterests.filter((person) => cast.includes(person.id))
  const shut = people.filter((person) => !sexGate(content, state, person, scene.uninhibited?.includes(person.id)).open).map((person) => person.id)
  const issues: DualIssue[] = []
  const conflict = () => { if (!issues.length) issues.push({ code: 'conflict', path: ['consistency'] }) }
  if (!scene.npc && sexWrittenOf(writer.text, people, shut, scene.loveInterestId).length) conflict()
  const operations = manager.operationCandidates
  if (scene.npc && (operations.some((operation) => operation.type !== 'endScene') || manager.envelope.comfort.length
    || manager.envelope.information.length || manager.envelope.presentation.some((item) => item.type !== 'appearance'))) conflict()
  for (const beat of writer.beats) {
    // An invitation is not a completed transition. These checks hold explicit completed narration without inventing an operation.
    if (beat.action && /\b(?:you (?:arrive|follow|enter)|(?:the two|both|all) of you (?:arrive|head|walk|enter)|(?:leads?|takes?) you (?:to|into))\b|你(?:们)?(?:来到了|抵达了|走进了)|带你(?:来到|走进)/i.test(beat.text)
      && !operations.some((operation) => operation.type === 'moveScene' || operation.type === 'walkToEvent')) conflict()
    if (beat.action) {
      const escaped = state.player.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`^(?:${escaped}|You)\\s+(?:say|says|ask|asks|think|thinks|feel|feels|decide|decides|smile|smiles|grab|grabs|kiss|kisses|touch|touches)\\b`, 'i').test(beat.text)
        || /^(?:你)(?:说|问|想|觉得|决定|微笑|抓住|吻|触摸)/.test(beat.text)) conflict()
      for (const person of people) {
        const name = person.name.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (new RegExp(`^${name}(?:\\s+(?:leaves|walks away|exits|heads out)\\b|(?:离开|走开))`, 'i').test(beat.text)
          && !operations.some((operation) => operation.type === 'leaveScene' && operation.actorIds.includes(person.id)
            || operation.type === 'moveScene' && operation.stayingIds.includes(person.id))) conflict()
      }
    }
    const clocks = [...beat.text.matchAll(/\b(\d{1,2})[:：](\d{2})\b|(\d{1,2})点(?:整|钟)?/g)]
    if (clocks.length && /\b(?:meet|meeting|see you|see him|date|appointment)\b|见面|会面|约会/i.test(beat.text)) {
      const proposals = [scene.proposal, ...operations.flatMap((operation) => operation.type === 'proposeMeeting' && operation.offerId !== null
        ? context.meetingOffers?.filter((offer) => offer.id === operation.offerId).map((offer) => offer.proposal) ?? [] : [])].filter((proposal) => proposal !== undefined)
      if (operations.some((operation) => operation.type === 'proposeMeeting' && operation.offerId === null)) conflict()
      for (const clock of clocks) {
        let hour = Number(clock[1] ?? clock[3])
        if (/\bpm\b|下午|晚上/i.test(beat.text) && hour < 12) hour += 12
        if (/\bam\b/i.test(beat.text) && hour === 12) hour = 0
        const minute = Number(clock[2] ?? 0), today = toDate(content.calendar, state.time).dayIndex
        if (minute !== 0 || !proposals.some((proposal) => {
          const date = toDate(content.calendar, proposal.time)
          return proposal.time > state.time && date.hour === hour
            && (!/\btomorrow\b|明天/i.test(beat.text) || date.dayIndex === today + 1)
            && (!/\btoday\b|今天/i.test(beat.text) || date.dayIndex === today)
        })) conflict()
      }
    }
    if (/\b(?:I(?:'ve| have)? stopped taking (?:my |the )?(?:pill|birth control)|I(?:'m| am) off (?:the pill|birth control))\b|我(?:已经)?停(?:用|服)(?:了)?避孕/i.test(beat.text)) {
      const id = beat.speakerId ?? (cast.length === 1 && !beat.speakerName ? cast[0] : undefined)
      if (id && onBirthControl(content, state, id) && !operations.some((operation) => operation.type === 'stopBirthControl' && operation.actorId === id)) conflict()
    }
    if (beat.action && /\b(?:strips? (?:naked|nude)|removes? (?:all |her )?clothes|undresses? completely)\b|脱光(?:了)?衣服/i.test(beat.text)) {
      const id = beat.speakerId ?? (cast.length === 1 ? cast[0] : undefined)
      const person = people.find((person) => person.id === id)
      const current = id === scene.loveInterestId ? scene.outfitId : id ? scene.looks?.[id]?.outfitId : undefined
      const selection = manager.envelope.presentation.find((item) => item.type === 'appearance' && item.actorId === id)
      const outfit = selection?.type === 'appearance' ? selection.outfitId ?? current : current
      if (person && !/nude/.test(wornOutfit(content, state, person, outfit)?.id ?? '')) conflict()
    }
  }
  return issues
}

export function buildDualTurnEffects(context: DualValidationContext, writer: CheckedDualWriter, manager: CheckedDualManager,
  profiles: { writerProfileId: string; managerProfileId: string; writerUsedNsfw: boolean }): DualCheck<DualTurnEffects> {
  const checked = validateDualManagerReply(JSON.stringify(manager.envelope), context)
  if (!checked.ok) return checked
  const issues = checkDualConsistency(context, writer, checked.value)
  if (issues.length) return { ok: false, issues }
  const { content, state, scene } = context, operations = checked.value.operationCandidates
  const present = sceneCast(scene), who = (id: string) => content.loveInterests.find((person) => person.id === id)
  const willing = (id: string) => { const person = who(id); return !!person && sexGate(content, state, person, scene.uninhibited?.includes(id)).open }
  const result: DualTurnEffects = { message: { role: 'assistant', content: writer.text }, systemPrompt: '',
    profileId: profiles.writerProfileId, profileRole: profiles.writerUsedNsfw ? 'nsfw' : 'writer', managerProfileId: profiles.managerProfileId,
    sceneEnded: false, look: {}, looks: {}, contacts: scene.npc ? [] : contactsSaid(content, state, present, writer.text),
    comfort: {}, seededIds: [], offControlIds: [], rolls: [], voices: [], noteChanges: [],
    phrase: scene.npc ? undefined : catchphraseAt(writer.text, present.flatMap((id) => who(id) ?? []), scene.loveInterestId) }
  for (const operation of operations) switch (operation.type) {
    case 'moveScene':
      result.moveTo = operation.destinationId; result.hours = operation.hours || undefined
      if (operation.stayingIds.length) result.left = { ids: operation.stayingIds, feeling: 'content', reason: t('llm.main.stayedBehind') }
      break
    case 'walkToEvent': result.walkTo = { withIds: sharedUpcoming(content, state, present)!.sharedBy }; break
    case 'proposeMeeting': {
      const request = operation.request
      result.proposal = proposeMeeting(content, state, request.actorId, { activity: request.activity, place: request.placeId,
        earliest: request.earliest ?? undefined, weekday: request.weekday ?? undefined, timeOfDay: request.timeOfDay ?? undefined,
        with: request.companionIds, named: present.length > 1 }).proposal
      break
    }
    case 'acceptMeeting': result.proposalAccepted = true; break
    case 'proposeBond': result.bondProposal = { statusId: operation.statusId, memberIds: operation.memberIds }; break
    case 'leaveScene': result.left = { ids: operation.actorIds, feeling: operation.feeling, reason: operation.reason }; break
    case 'attendEvent': (result.attending ??= []).push({ eventId: operation.eventId, ids: operation.actorIds }); break
    case 'sleepOver': result.sleptOver = true; break
    case 'endScene': result.sceneEnded = true; break
    case 'stopBirthControl': result.offControlIds.push(operation.actorId); break
    case 'potentialConception': result.seededIds.push(operation.actorId); break
  }
  const behind = operations.find((operation) => operation.type === 'moveScene' && operation.stayingIds.length > 0)
  if (behind?.type === 'moveScene') result.left = { ids: behind.stayingIds, feeling: 'content', reason: t('llm.main.stayedBehind') }
  const move = result.moveTo && findDestination(sceneDestinations(content, state, scene), result.moveTo)
  if (result.proposal?.locationId === (move && move.locationId)) result.proposal = undefined
  if (result.proposalAccepted && result.proposal?.locationId === scene.proposal?.locationId) result.proposal = undefined
  if (result.proposal) result.proposalAccepted = undefined
  result.sceneEnded ||= !!result.walkTo || !!result.sleptOver
  for (const reading of checked.value.envelope.comfort) result.comfort[reading.actorId] = { level: reading.level, reason: reading.reason }
  for (const item of checked.value.envelope.presentation) {
    const person = who(item.actorId)!
    if (item.type === 'appearance') {
      const before = item.actorId === scene.loveInterestId ? scene : scene.looks?.[item.actorId] ?? {}
      const valid = validLook({ outfitId: item.outfitId ?? undefined, expression: item.expression ?? undefined }, person, before)
      if (valid.outfitId && !scene.npc) valid.outfitId = wornOutfit(content, state, person, valid.outfitId)?.id
      if (item.actorId === scene.loveInterestId) result.look = { ...result.look, ...valid }
      else result.looks[item.actorId] = valid
    } else if (item.type === 'reaction') result.voices = [person.reactions[item.reactionId]]
    else if (item.animationId === null) result.look.animationId = null
    else {
      const pose = person.animations.find((pose) => pose.id === item.animationId && poseMedia(pose).length)
      const group = groupPose(content, state, scene, item.animationId, willing)
      const shown = (pose && pregnancyStage(content, state, person.id)?.showing
        && person.animations.find((candidate) => candidate.id === pregnantPoseId(pose.id) && poseMedia(candidate).length)) || pose
      const again = !!pose && !!shown && isMoment(basePoseId(pose.id), content.looks.acts) && scene.animationId === shown.id
        && (scene.animationOf ?? scene.loveInterestId) === person.id && scene.animationGroup === undefined
      const againGroup = !!group && isMoment(group.pose.id, content.looks.acts) && scene.animationGroup === group.group.id && scene.animationId === group.pose.id
      if (group && !againGroup) Object.assign(result.look, { animationId: group.pose.id, animationOf: person.id, animationGroup: group.group.id })
      else if (pose && shown && !again) Object.assign(result.look, { animationId: shown.id, animationOf: person.id })
      if (pose && isSeeding(basePoseId(pose.id), content.looks.acts) || group && isSeeding(group.pose.id, content.looks.acts)) result.seededIds.push(person.id)
    }
  }
  result.seededIds = [...new Set(result.seededIds)]
  const evidence = new Map(checked.value.envelope.evidence.map((span) => [span.id, span]))
  checked.value.envelope.information.forEach((information, index) => {
    const receiptIds = [...information.evidenceIds].sort((one, two) => Number(context.sources.find((source) => source.id === evidence.get(one)!.sourceId)!.kind === 'history')
      - Number(context.sources.find((source) => source.id === evidence.get(two)!.sourceId)!.kind === 'history'))
    const receipts = receiptIds.flatMap((id) => {
      const span = evidence.get(id)!, source = context.sources.find((source) => source.id === span.sourceId)!
      if (source.kind === 'context' || source.kind === 'history' && source.messageIndex === undefined) return []
      const messageIndex = source.kind === 'writer' ? scene.messages.length : source.messageIndex ?? scene.messages.length - 1
      const offset = source.replyRange?.start ?? source.messageRange?.start ?? 0
      return [{ turnId: source.turnId ?? context.turnId, messageIndex, role: source.kind === 'player' || source.speaker?.kind === 'player' ? 'user' as const : 'assistant' as const,
        start: offset + span.start, end: offset + span.end, quote: span.quote, speaker: source.speaker,
        witnessIds: checked.value.informationWitnessIds[index] }]
    }).slice(0, 2)
    if (!receipts.length) return
    result.noteChanges.push({ action: information.action, targetEntryId: information.targetEntryId,
      entry: { id: `note:${context.turnId}:${index}`, createdTurnId: context.turnId, updatedTurnId: context.turnId,
        category: information.category, status: information.status, subjects: information.subjects, factId: information.factId,
        content: information.content, receipts, supersedesId: information.action === 'record' ? null : information.targetEntryId,
        turnOrdinal: scene.generation?.mode === 'dual' ? scene.generation.nextTurnOrdinal : undefined, gameTime: state.time } })
  })
  return { ok: true, value: result }
}

/** Effects run in the established order against a private prepared state, never against live renderer state. */
export function applyDualTurnEffects(content: ContentPack, state: GameState, scene: Scene, response: DualTurnEffects, offered?: Scene['proposal']) {
  const stopped = [...new Set(response.offControlIds)].filter((id) => onBirthControl(content, state, id))
  let nextState = stopped.reduce((next, id) => stopBirthControl(content, next, id), state)
  const conceived: string[] = []
  for (const id of new Set(response.seededIds)) {
    const next = conceive(content, nextState, id)
    if (next !== nextState) conceived.push(id)
    nextState = next
  }
  const destination = response.moveTo ? findDestination(sceneDestinations(content, state, scene), response.moveTo) : undefined
  if (destination) nextState = moveState(nextState, destination)
  if (response.hours) nextState = passSceneTime(content, nextState, response.hours)
  if (response.proposalAccepted && scene.proposal) nextState = acceptProposal(nextState, scene.proposal)
  for (const attendance of response.attending ?? []) nextState = addEventGoers(nextState, attendance.eventId, attendance.ids)
  const given = response.contacts.filter((id) => !hasContact(state, id))
  nextState = given.reduce(giveContact, nextState)
  let nextScene = applyComfort(applyLooks(applyLook({ ...(destination ? movedScene(scene, destination) : scene),
    messages: [...scene.messages, response.message], nsfw: scene.nsfw || response.profileRole === 'nsfw',
    proposal: offered ?? response.proposal ?? (response.proposalAccepted || scene.proposal && scene.proposal.time <= state.time ? undefined : scene.proposal),
    bondProposal: response.bondProposal, conceived: [...new Set([...scene.conceived, ...conceived])] }, response.look), response.looks),
  response.comfort, skillLevel(content, state, 'comfort') === 2 ? 2 : 1)
  if (response.left) {
    const left = response.left
    nextScene = leaveScene(nextScene, left.ids, left.feeling, left.reason)
    if (destination) nextScene = { ...nextScene, departed: nextScene.departed.map((departure) => left.ids.includes(departure.id)
      && departure.at === nextScene.messages.length ? { ...departure, behind: true } : departure) }
  }
  return { state: nextState, scene: nextScene, stopped, conceived, given }
}
