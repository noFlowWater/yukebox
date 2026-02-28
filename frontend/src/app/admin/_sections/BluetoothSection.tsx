'use client'

import { Loader2, Speaker, Wifi, WifiOff, Plus, MoreVertical, Bluetooth, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { useAdminBluetooth } from '../_hooks/useAdminBluetooth'

interface BluetoothSectionProps {
  bluetooth: ReturnType<typeof useAdminBluetooth>
}

export function BluetoothSection({ bluetooth }: BluetoothSectionProps) {
  const {
    btAvailable, btDevices, btScanning, scanResults,
    connectingAddress, disconnectingAddress, btError,
    handleScan, handleBtConnect, handleBtDisconnect,
  } = bluetooth

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bluetooth className="h-5 w-5" />
          Bluetooth Devices
          {btAvailable && <span>({btDevices.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {btAvailable === null ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : btAvailable === false ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <WifiOff className="h-8 w-8" />
            <p className="text-sm text-center">
              Bluetooth adapter not available.
            </p>
            {btError && (
              <pre className="text-xs bg-muted rounded px-3 py-2 max-w-full overflow-x-auto whitespace-pre-wrap break-all">
                {btError}
              </pre>
            )}
          </div>
        ) : (
          <>
            {btDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">
                No paired BT audio devices
              </p>
            ) : (
              btDevices.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{d.alias || d.name || d.address}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={d.is_connected ? 'default' : 'secondary'}>
                        {d.is_connected ? (
                          <><Wifi className="h-3 w-3 mr-1" />Connected</>
                        ) : (
                          <><WifiOff className="h-3 w-3 mr-1" />Disconnected</>
                        )}
                      </Badge>
                      {d.speaker_name && (
                        <Badge variant="outline">
                          <Speaker className="h-3 w-3 mr-1" />{d.speaker_name}
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {d.is_connected ? (
                            <DropdownMenuItem
                              onClick={() => handleBtDisconnect(d.address)}
                              disabled={disconnectingAddress === d.address}
                            >
                              {disconnectingAddress === d.address ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <WifiOff className="h-4 w-4 mr-2" />
                              )}
                              Disconnect
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleBtConnect(d.address)}
                              disabled={connectingAddress === d.address}
                            >
                              {connectingAddress === d.address ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Wifi className="h-4 w-4 mr-2" />
                              )}
                              Connect
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground truncate">{d.address}</span>
                </div>
              ))
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Scan for New Devices</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleScan}
                  disabled={btScanning}
                >
                  {btScanning ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Search className="h-3 w-3 mr-1" />
                  )}
                  {btScanning ? 'Scanning...' : 'Scan'}
                </Button>
              </div>

              {scanResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  {scanResults.map((d) => (
                    <div
                      key={d.address}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{d.name || d.address}</span>
                        <span className="text-xs text-muted-foreground">{d.address}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBtConnect(d.address)}
                        disabled={connectingAddress === d.address}
                        className="shrink-0"
                      >
                        {connectingAddress === d.address ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Plus className="h-3 w-3 mr-1" />
                        )}
                        Pair & Connect
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
