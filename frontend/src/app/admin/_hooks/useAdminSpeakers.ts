'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils'
import * as api from '@/lib/api'
import type { Speaker, AvailableSink } from '@/types'

interface UseAdminSpeakersParams {
  globalVolumeSaved: number
  onSpeakersChanged: () => Promise<void>
}

export function useAdminSpeakers({ globalVolumeSaved, onSpeakersChanged }: UseAdminSpeakersParams) {
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [availableSinks, setAvailableSinks] = useState<AvailableSink[]>([])
  const [speakersLoading, setSpeakersLoading] = useState(true)
  const [newSpeakerSink, setNewSpeakerSink] = useState('')
  const [newSpeakerName, setNewSpeakerName] = useState('')

  // Rename dialog
  const [renameOpen, setRenameOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Volume dialog
  const [volumeOpen, setVolumeOpen] = useState(false)
  const [volumeSpeakerId, setVolumeSpeakerId] = useState<number | null>(null)
  const [volumeSpeakerName, setVolumeSpeakerName] = useState('')
  const [volumeValue, setVolumeValue] = useState(60)
  const [volumeUseGlobal, setVolumeUseGlobal] = useState(true)

  const fetchSpeakers = useCallback(async () => {
    try {
      const [speakerList, sinks] = await Promise.all([
        api.getSpeakers(),
        api.getAvailableSinks(),
      ])
      setSpeakers(speakerList)
      setAvailableSinks(sinks)
    } catch (err) {
      handleApiError(err, 'Failed to load speakers')
    } finally {
      setSpeakersLoading(false)
    }
  }, [])

  async function handleAddSpeaker() {
    if (!newSpeakerSink || !newSpeakerName.trim()) return
    try {
      await api.registerSpeaker(newSpeakerSink, newSpeakerName.trim())
      setNewSpeakerSink('')
      setNewSpeakerName('')
      toast.success('Speaker registered')
      await onSpeakersChanged()
    } catch (err) {
      handleApiError(err, 'Failed to register speaker')
    }
  }

  async function handleRemoveSpeaker(id: number, name: string) {
    if (!confirm(`Remove speaker "${name}"?`)) return
    try {
      await api.removeSpeaker(id)
      toast.success(`Removed: ${name}`)
      await onSpeakersChanged()
    } catch (err) {
      handleApiError(err, 'Failed to remove speaker')
    }
  }

  async function handleSetDefault(id: number) {
    try {
      await api.setSpeakerDefault(id)
      toast.success('Default speaker updated')
      await onSpeakersChanged()
    } catch (err) {
      handleApiError(err, 'Failed to set default')
    }
  }

  function startRename(speaker: Speaker) {
    setRenamingId(speaker.id)
    setRenameValue(speaker.display_name)
    setRenameOpen(true)
  }

  async function submitRename() {
    if (renamingId === null) return
    const trimmed = renameValue.trim()
    if (!trimmed) return
    try {
      await api.renameSpeaker(renamingId, trimmed)
      toast.success('Speaker renamed')
      setRenameOpen(false)
      await onSpeakersChanged()
    } catch (err) {
      handleApiError(err, 'Failed to rename speaker')
    }
  }

  function startVolumeEdit(speaker: Speaker) {
    setVolumeSpeakerId(speaker.id)
    setVolumeSpeakerName(speaker.display_name)
    const useGlobal = speaker.default_volume === null
    setVolumeUseGlobal(useGlobal)
    setVolumeValue(speaker.default_volume ?? globalVolumeSaved)
    setVolumeOpen(true)
  }

  async function submitVolume() {
    if (volumeSpeakerId === null) return
    try {
      const newVolume = volumeUseGlobal ? null : volumeValue
      await api.updateSpeakerVolume(volumeSpeakerId, newVolume)
      toast.success('Speaker volume updated')
      setVolumeOpen(false)
      await onSpeakersChanged()
    } catch (err) {
      handleApiError(err, 'Failed to update speaker volume')
    }
  }

  return {
    speakers, speakersLoading, availableSinks,
    newSpeakerSink, setNewSpeakerSink,
    newSpeakerName, setNewSpeakerName,
    renameOpen, setRenameOpen, renameValue, setRenameValue,
    volumeOpen, setVolumeOpen,
    volumeSpeakerName, volumeValue, setVolumeValue,
    volumeUseGlobal, setVolumeUseGlobal,
    globalVolumeSaved,
    fetchSpeakers,
    handleAddSpeaker, handleRemoveSpeaker, handleSetDefault,
    startRename, submitRename,
    startVolumeEdit, submitVolume,
  }
}
