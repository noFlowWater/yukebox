'use client'

import { Trash2, Loader2, Speaker, Wifi, WifiOff, Star, Plus, MoreVertical, Pencil, Volume2 } from 'lucide-react'
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
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { useAdminSpeakers } from '../_hooks/useAdminSpeakers'

interface SpeakersSectionProps {
  speakerState: ReturnType<typeof useAdminSpeakers>
}

export function SpeakersSection({ speakerState }: SpeakersSectionProps) {
  const {
    speakers, speakersLoading, availableSinks,
    newSpeakerSink, setNewSpeakerSink,
    newSpeakerName, setNewSpeakerName,
    renameOpen, setRenameOpen, renameValue, setRenameValue,
    volumeOpen, setVolumeOpen,
    volumeSpeakerName, volumeValue, setVolumeValue,
    volumeUseGlobal, setVolumeUseGlobal,
    globalVolumeSaved,
    handleAddSpeaker, handleRemoveSpeaker, handleSetDefault,
    startRename, submitRename,
    startVolumeEdit, submitVolume,
  } = speakerState

  return (
    <>
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
                    <span className="text-sm font-medium truncate">{s.display_name}</span>
                    {s.active && (
                      <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
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
                        <DropdownMenuItem onClick={() => startVolumeEdit(s)}>
                          <Volume2 className="h-4 w-4 mr-2" />
                          Set Volume
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

      {/* Rename Speaker Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Speaker</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename()
            }}
            placeholder="Display name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Speaker Volume Dialog */}
      <Dialog open={volumeOpen} onOpenChange={setVolumeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Volume — {volumeSpeakerName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="use-global"
                checked={volumeUseGlobal}
                onCheckedChange={(checked) => {
                  setVolumeUseGlobal(checked === true)
                  if (checked) setVolumeValue(globalVolumeSaved)
                }}
              />
              <label htmlFor="use-global" className="text-sm cursor-pointer">
                Use global default ({globalVolumeSaved})
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Volume</span>
                <span className="text-sm text-muted-foreground">{volumeUseGlobal ? globalVolumeSaved : volumeValue}</span>
              </div>
              <Slider
                value={[volumeUseGlobal ? globalVolumeSaved : volumeValue]}
                onValueChange={([v]) => {
                  if (!volumeUseGlobal) setVolumeValue(v)
                }}
                min={0}
                max={100}
                step={1}
                disabled={volumeUseGlobal}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVolumeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitVolume}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
