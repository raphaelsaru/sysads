'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Palette, Save } from 'lucide-react'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ColorPicker from '@/components/onboarding/ColorPicker'
import LogoUploader from '@/components/tenant/LogoUploader'

function BrandingPageContent() {
  const router = useRouter()
  const { userProfile } = useAuth()

  // Verificar permissão
  useEffect(() => {
    if (userProfile && userProfile.role !== 'tenant_admin' && userProfile.role !== 'admin_global') {
      router.push('/dashboard')
    }
  }, [userProfile, router])

  if (userProfile?.role !== 'tenant_admin' && userProfile?.role !== 'admin_global') {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <h1 className="mb-2 text-xl font-semibold">Acesso Negado</h1>
              <p className="text-sm text-muted-foreground">
                Apenas admins podem acessar esta área.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <BrandingPageInner />
    </MainLayout>
  )
}

function BrandingPageInner() {
  const router = useRouter()
  const { branding, updateBranding, refreshTenant } = useTenant()
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    companyName: '',
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    logo: null as string | null,
  })

  // Carregar branding atual
  useEffect(() => {
    if (branding) {
      setFormData({
        companyName: branding.companyName || '',
        primaryColor: branding.primaryColor || '#3b82f6',
        secondaryColor: branding.secondaryColor || '#8b5cf6',
        logo: branding.logo || null,
      })
    }
  }, [branding])

  const handleSave = async () => {
    try {
      setSaving(true)

      const response = await fetch('/api/tenant/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar branding')
      }

      // Atualizar context
      updateBranding(formData)
      
      // Atualizar tenant completo
      await refreshTenant()

      alert('Branding atualizado com sucesso!')
    } catch (err) {
      console.error('Erro ao atualizar branding:', err)
      alert(err instanceof Error ? err.message : 'Erro ao atualizar branding')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Branding e Aparência</h1>
          <p className="text-muted-foreground mt-1">
            Personalize as cores e logo da sua empresa
          </p>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Personalização Visual
            </CardTitle>
            <CardDescription>
              As alterações serão aplicadas imediatamente no sistema
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Company Name */}
            <div>
              <Label htmlFor="companyName">Nome da Empresa</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Sua Empresa Ltda"
                className="mt-2"
              />
            </div>

            {/* Colors */}
            <div className="grid md:grid-cols-2 gap-6">
              <ColorPicker
                label="Cor Primária"
                value={formData.primaryColor}
                onChange={(color) => setFormData({ ...formData, primaryColor: color })}
                id="primaryColor"
              />
              <ColorPicker
                label="Cor Secundária"
                value={formData.secondaryColor}
                onChange={(color) => setFormData({ ...formData, secondaryColor: color })}
                id="secondaryColor"
              />
            </div>

            {/* Logo */}
            <div>
              <Label className="mb-4 block">Logo da Empresa</Label>
              <LogoUploader
                currentLogo={formData.logo}
                onLogoChange={(logo) => setFormData({ ...formData, logo })}
              />
            </div>

            {/* Preview */}
            <div className="border-t pt-6">
              <Label className="mb-3 block">Preview</Label>
              <div className="p-6 rounded-lg border-2" style={{ 
                borderColor: formData.primaryColor,
                background: `linear-gradient(135deg, ${formData.primaryColor}10, ${formData.secondaryColor}10)`
              }}>
                <div className="flex items-center gap-4 mb-4">
                  {formData.logo ? (
                    <img src={formData.logo} alt="Logo" className="h-12 w-12 object-contain" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg" style={{ backgroundColor: formData.primaryColor }} />
                  )}
                  <div>
                    <h4 className="font-semibold text-lg">{formData.companyName || 'Sua Empresa'}</h4>
                    <p className="text-sm text-muted-foreground">Dashboard personalizado</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    style={{ 
                      backgroundColor: formData.primaryColor,
                      color: 'white'
                    }}
                  >
                    Botão Primário
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    style={{ 
                      borderColor: formData.secondaryColor,
                      color: formData.secondaryColor
                    }}
                  >
                    Botão Secundário
                  </Button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
  )
}

export default function BrandingPage() {
  return (
    <ProtectedRoute>
      <BrandingPageContent />
    </ProtectedRoute>
  )
}


