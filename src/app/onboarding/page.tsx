'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Palette, Building2, CheckCircle } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ColorPicker from '@/components/onboarding/ColorPicker'
import LogoUploader from '@/components/tenant/LogoUploader'

const STEPS = [
  { id: 1, name: 'Bem-vindo', icon: Building2 },
  { id: 2, name: 'Personalização', icon: Palette },
  { id: 3, name: 'Concluído', icon: CheckCircle },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    companyName: userProfile?.tenant?.name || '',
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    logo: null as string | null,
  })

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    if (!formData.companyName) {
      alert('Por favor, preencha o nome da empresa')
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch('/api/tenant/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao completar onboarding')
      }

      // Redirecionar para dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Erro ao completar onboarding:', err)
      alert(err instanceof Error ? err.message : 'Erro ao completar onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Steps Indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                    currentStep === step.id
                      ? 'bg-primary text-primary-foreground'
                      : currentStep > step.id
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <step.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{step.name}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="h-px w-8 mx-2 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {currentStep === 1 && 'Bem-vindo à Prizely!'}
              {currentStep === 2 && 'Personalize sua experiência'}
              {currentStep === 3 && 'Tudo pronto!'}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Vamos configurar seu espaço em alguns passos simples'}
              {currentStep === 2 && 'Escolha as cores e logo da sua empresa'}
              {currentStep === 3 && 'Sua conta está configurada e pronta para uso'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Step 1: Welcome */}
            {currentStep === 1 && (
              <div className="space-y-6 py-4">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Configure sua conta
                    </h3>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                      A Prizely é um sistema completo de CRM e gestão. Vamos personalizar 
                      a plataforma com as cores e identidade visual da sua empresa.
                    </p>
                  </div>
                </div>

                <div className="max-w-md mx-auto">
                  <Label htmlFor="companyName">Nome da sua empresa</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Sua Empresa Ltda"
                    className="mt-2"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Customization */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <ColorPicker
                      label="Cor Primária"
                      value={formData.primaryColor}
                      onChange={(color) => setFormData({ ...formData, primaryColor: color })}
                      id="primaryColor"
                    />
                  </div>
                  <div>
                    <ColorPicker
                      label="Cor Secundária"
                      value={formData.secondaryColor}
                      onChange={(color) => setFormData({ ...formData, secondaryColor: color })}
                      id="secondaryColor"
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-4 block">Logo da Empresa (Opcional)</Label>
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
                    <div className="flex items-center gap-4">
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
                    <Button 
                      className="mt-4" 
                      style={{ 
                        backgroundColor: formData.primaryColor,
                        color: 'white'
                      }}
                    >
                      Botão de Exemplo
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Complete */}
            {currentStep === 3 && (
              <div className="text-center space-y-6 py-8">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-green-500" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">
                    Configuração Concluída!
                  </h3>
                  <p className="text-muted-foreground max-w-lg mx-auto">
                    Sua conta está pronta para uso. Você já pode começar a gerenciar seus 
                    clientes e aproveitar todos os recursos da Prizely.
                  </p>
                </div>

                <div className="max-w-md mx-auto p-6 rounded-lg bg-muted">
                  <div className="space-y-2 text-sm text-left">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Nome da empresa configurado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Cores personalizadas aplicadas</span>
                    </div>
                    {formData.logo && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Logo configurado</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || submitting}
              >
                Voltar
              </Button>

              {currentStep < 3 ? (
                <Button onClick={handleNext}>
                  Próximo
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={submitting}>
                  {submitting ? 'Finalizando...' : 'Ir para Dashboard'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Você poderá alterar essas configurações a qualquer momento nas configurações
        </p>
      </div>
    </div>
  )
}


