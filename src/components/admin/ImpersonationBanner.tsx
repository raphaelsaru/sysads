'use client'

import { AlertTriangle, User, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAdmin } from '@/contexts/AdminContext'

export default function ImpersonationBanner() {
  const { impersonation, stopImpersonation } = useAdmin()

  if (!impersonation.isImpersonating || !impersonation.impersonatedUser || !impersonation.originalUser) {
    return null
  }

  return (
    <Card className="border-warning/40 bg-warning/10 shadow-lg">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-warning/60 bg-warning/20 text-warning">
                Modo Admin
              </Badge>
              <span className="text-sm font-semibold text-foreground">
                Visualizando como usuário
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>
                <strong>{impersonation.impersonatedUser.company_name}</strong> ({impersonation.impersonatedUser.email})
              </span>
              <span className="text-muted-foreground/60">•</span>
              <span>
                Admin: <strong>{impersonation.originalUser.email}</strong>
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={stopImpersonation}
          variant="outline"
          size="sm"
          className="gap-2 border-warning/40 text-warning hover:bg-warning/10"
        >
          <X className="h-4 w-4" />
          Sair da visualização
        </Button>
      </CardContent>
    </Card>
  )
}