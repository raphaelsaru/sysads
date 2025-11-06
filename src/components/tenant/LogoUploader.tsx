'use client'

import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LogoUploaderProps {
  currentLogo?: string | null
  onLogoChange: (logoUrl: string | null) => void
  className?: string
}

export default function LogoUploader({ currentLogo, onLogoChange, className }: LogoUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentLogo || null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem')
      return
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 2MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      // Criar preview local
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setPreview(result)
      }
      reader.readAsDataURL(file)

      // Converter para base64 para enviar ao backend
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      // Enviar para o backend
      const response = await fetch('/api/tenant/branding/logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logoUrl: base64 }),
      })

      if (!response.ok) {
        throw new Error('Erro ao fazer upload da logo')
      }

      const data = await response.json()
      onLogoChange(data.logoUrl)
      
      console.log('✅ Logo uploaded successfully')
    } catch (err) {
      console.error('Erro ao fazer upload:', err)
      setError('Erro ao fazer upload da logo. Tente novamente.')
      setPreview(currentLogo || null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = () => {
    setPreview(null)
    onLogoChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={cn('space-y-4', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {preview ? (
        <div className="relative">
          <div className="flex items-center justify-center w-full h-48 bg-muted rounded-lg overflow-hidden border-2 border-border">
            <img
              src={preview}
              alt="Logo preview"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemoveLogo}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className={cn(
            'flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg',
            'border-border hover:border-primary hover:bg-muted/50 transition-colors',
            'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
              <p className="text-sm text-muted-foreground">Fazendo upload...</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                <ImageIcon className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium mb-1">Clique para fazer upload</p>
              <p className="text-xs text-muted-foreground">PNG, JPG ou GIF (max. 2MB)</p>
            </>
          )}
        </button>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <X className="h-4 w-4" />
          {error}
        </div>
      )}

      {!preview && (
        <Button
          type="button"
          variant="outline"
          onClick={handleClick}
          disabled={uploading}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          Selecionar Logo
        </Button>
      )}
    </div>
  )
}



