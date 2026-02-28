'use client'

import { Trash2, Shield, User as UserIcon, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { User } from '@/types'
import type { useAdminUsers } from '../_hooks/useAdminUsers'

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

interface UsersSectionProps {
  userState: ReturnType<typeof useAdminUsers>
  currentUserId: number
}

export function UsersSection({ userState, currentUserId }: UsersSectionProps) {
  const { users, handleDelete, handleRoleChange, ROLE_LABELS } = userState

  return (
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
            className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              {getRoleIcon(u.role)}
              <span className="text-sm font-medium truncate">{u.username}</span>
              <Badge variant={getRoleBadgeVariant(u.role)} className="shrink-0">
                {ROLE_LABELS[u.role]}
              </Badge>
            </div>
            {u.id !== currentUserId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleRoleChange(u.id, u.role === 'admin' ? 'user' : 'admin')}
                  >
                    {u.role === 'admin' ? (
                      <><UserIcon className="h-4 w-4 mr-2" />Demote to User</>
                    ) : (
                      <><Shield className="h-4 w-4 mr-2" />Promote to Admin</>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleDelete(u.id, u.username)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
