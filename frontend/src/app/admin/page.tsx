'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Shield, User as UserIcon, ArrowLeft, Loader2, Speaker, Wifi, WifiOff, Star, Plus, MoreVertical, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { useSpeaker } from '@/contexts/SpeakerContext'
import * as api from '@/lib/api'
import type { User, Speaker as SpeakerType, AvailableSink } from '@/types'

const ROLE_LABELS: Record<User['role'], string> = {
  admin: 'Admin',
  user: 'User',
}

function getRoleIcon(role: User['role']) {
  switch (role) {
    case 'admin':
      return <Shield className="h-4 w-4 text-primary" />
    default:
      return <UserIcon className="h-4 w-4 text-muted-foreground" />
  }
}

function getRoleBadgeVariant(role: User['role']): 'default' | 'secondary' {
  switch (role) {
    case 'admin':
      return 'default'
    default:
      return 'secondary'
  }
}

export default function AdminPage() {
  const router = useRouter()
  const { user: currentUser, loading: authLoading } = useAuth()
  const { refreshSpeakers } = useSpeaker()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Speaker management state
  const [speakers, setSpeakers] = useState<SpeakerType[]>([])
  const [availableSinks, setAvailableSinks] = useState<AvailableSink[]>([])
  const [speakersLoading, setSpeakersLoading] = useState(true)
  const [newSpeakerSink, setNewSpeakerSink] = useState('')
  const [newSpeakerName, setNewSpeakerName] = useState('')
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (err) {
      handleApiError(err, 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

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

  useEffect(() => {
    if (authLoading) return
    if (!currentUser || currentUser.role !== 'admin') {
      router.push('/')
      return
    }
    fetchUsers()
    fetchSpeakers()
  }, [authLoading, currentUser, router, fetchUsers, fetchSpeakers])

  async function handleDelete(userId: number, username: string) {
    if (!confirm(`Delete user "${username}"?`)) return
    try {
      await api.deleteUser(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      toast.success(`Deleted user: ${username}`)
    } catch (err) {
      handleApiError(err, 'Failed to delete user')
    }
  }

  async function handleRoleChange(userId: number, newRole: User['role']) {
    try {
      const updated = await api.updateUserRole(userId, newRole)
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
      toast.success(`Role updated to ${ROLE_LABELS[newRole]}`)
    } catch (err) {
      handleApiError(err, 'Failed to update role')
    }
  }

  async function handleAddSpeaker() {
    if (!newSpeakerSink || !newSpeakerName.trim()) return
    try {
      await api.registerSpeaker(newSpeakerSink, newSpeakerName.trim())
      setNewSpeakerSink('')
      setNewSpeakerName('')
      toast.success('Speaker registered')
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to register speaker')
    }
  }

  async function handleRemoveSpeaker(id: number, name: string) {
    if (!confirm(`Remove speaker "${name}"?`)) return
    try {
      await api.removeSpeaker(id)
      toast.success(`Removed: ${name}`)
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to remove speaker')
    }
  }

  async function handleSetDefault(id: number) {
    try {
      await api.setSpeakerDefault(id)
      toast.success('Default speaker updated')
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to set default')
    }
  }

  function startRename(speaker: SpeakerType) {
    setRenamingId(speaker.id)
    setRenameValue(speaker.display_name)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function submitRename(id: number) {
    const trimmed = renameValue.trim()
    if (!trimmed) return
    try {
      await api.renameSpeaker(id, trimmed)
      toast.success('Speaker renamed')
      cancelRename()
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to rename speaker')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hasUserCapability = true

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          {hasUserCapability && (
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-2xl font-semibold">Administration</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Users ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getRoleIcon(u.role)}
                  <span className="text-sm font-medium truncate">{u.username}</span>
                  <Badge variant={getRoleBadgeVariant(u.role)} className="shrink-0">
                    {ROLE_LABELS[u.role]}
                  </Badge>
                </div>
                {u.id !== currentUser?.id && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={u.role}
                      onValueChange={(v) => handleRoleChange(u.id, v as User['role'])}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(u.id, u.username)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Speaker Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Speaker className="h-5 w-5" />
              Speakers ({speakers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {speakersLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : speakers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No speakers registered
              </p>
            ) : (
              speakers.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {renamingId === s.id ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitRename(s.id)
                              if (e.key === 'Escape') cancelRename()
                            }}
                            className="h-7 text-sm w-40"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary"
                            onClick={() => submitRename(s.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={cancelRename}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium truncate">{s.display_name}</span>
                          {s.active && (
                            <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={s.online ? 'default' : 'secondary'}>
                        {s.online ? (
                          <><Wifi className="h-3 w-3 mr-1" />Online</>
                        ) : (
                          <><WifiOff className="h-3 w-3 mr-1" />Offline</>
                        )}
                      </Badge>
                      {s.is_default && (
                        <Badge variant="outline">
                          <Star className="h-3 w-3 mr-1" />Default
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startRename(s)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          {!s.is_default && (
                            <DropdownMenuItem onClick={() => handleSetDefault(s.id)}>
                              <Star className="h-4 w-4 mr-2" />
                              Set Default
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleRemoveSpeaker(s.id, s.display_name)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground truncate">{s.sink_name}</span>
                </div>
              ))
            )}

            {/* Add Speaker */}
            <Separator />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Add Speaker</p>
              {availableSinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No available PulseAudio sinks found.
                </p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Select
                    value={newSpeakerSink}
                    onValueChange={setNewSpeakerSink}
                  >
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue placeholder="Select sink" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSinks.map((sink) => (
                        <SelectItem key={sink.sink_name} value={sink.sink_name}>
                          {sink.description} ({sink.sink_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    placeholder="Display name"
                    value={newSpeakerName}
                    onChange={(e) => setNewSpeakerName(e.target.value)}
                    className="sm:w-40"
                  />
                  <Button
                    onClick={handleAddSpeaker}
                    disabled={!newSpeakerSink || !newSpeakerName.trim()}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
