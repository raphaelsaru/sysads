'use client'

import { useState, useCallback } from 'react'
import { Upload, X, Check, AlertCircle, Loader2, Instagram } from 'lucide-react'
import { useInstagramOCR } from '@/hooks/useInstagramOCR'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

interface InstagramOCRImportProps {
  onImportComplete?: (imported: number) => void
  onClose?: () => void
}

export default function InstagramOCRImport({ onImportComplete, onClose }: InstagramOCRImportProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null)

  const { processImage, importUsers, processing, progress, error, detectedUsers, rawText } = useInstagramOCR()
  const [showRawText, setShowRawText] = useState(false)

  // Handler para drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0])
    }
  }, [])

  const handleFile = async (file: File) => {
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem')
      return
    }

    setSelectedFile(file)
    setImportResult(null)

    // Criar preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Processar com OCR
    await processImage(file)
  }

  const handleToggleUser = (username: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(username)) {
      newSelected.delete(username)
    } else {
      newSelected.add(username)
    }
    setSelectedUsers(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedUsers.size === detectedUsers.filter(u => !u.isDuplicate).length) {
      // Desmarcar todos
      setSelectedUsers(new Set())
    } else {
      // Marcar todos os não duplicados
      const allNewUsers = detectedUsers
        .filter(u => !u.isDuplicate)
        .map(u => u.username)
      setSelectedUsers(new Set(allNewUsers))
    }
  }

  const handleImport = async () => {
    if (selectedUsers.size === 0) {
      alert('Selecione ao menos um usuário para importar')
      return
    }

    try {
      setImporting(true)
      const result = await importUsers(Array.from(selectedUsers))
      setImportResult(result)
      
      if (result.success > 0) {
        // Limpar seleção após importação
        setSelectedUsers(new Set())
        
        // Notificar componente pai
        if (onImportComplete) {
          onImportComplete(result.success)
        }
      }
    } catch (err) {
      console.error('Erro ao importar:', err)
      alert(err instanceof Error ? err.message : 'Erro ao importar usuários')
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setSelectedUsers(new Set())
    setImportResult(null)
  }

  const newUsersCount = detectedUsers.filter(u => !u.isDuplicate).length
  const duplicatesCount = detectedUsers.filter(u => u.isDuplicate).length

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Instagram className="h-5 w-5" />
          Importar do Instagram
        </CardTitle>
        <CardDescription>
          Faça upload de uma captura de tela do Instagram Direct e importe os contatos automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        {!selectedFile && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-2">
              Arraste uma imagem ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              PNG, JPG ou JPEG (Máximo 10MB)
            </p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept="image/*"
              onChange={handleFileInput}
            />
            <Button asChild variant="outline">
              <label htmlFor="file-upload" className="cursor-pointer">
                Selecionar Arquivo
              </label>
            </Button>
          </div>
        )}

        {/* Preview e Processamento */}
        {selectedFile && (
          <div className="space-y-4">
            {/* Preview da imagem */}
            <div className="relative">
              {previewUrl && (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full max-h-64 object-contain"
                  />
                  {!processing && detectedUsers.length === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={handleReset}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {processing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Processando imagem...</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            {/* Erro */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Debug: Texto Bruto do OCR */}
            {rawText && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRawText(!showRawText)}
                  className="text-xs text-muted-foreground"
                >
                  {showRawText ? 'Ocultar' : 'Mostrar'} texto bruto do OCR (debug)
                </Button>
                {showRawText && (
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                    {rawText}
                  </pre>
                )}
              </div>
            )}

            {/* Resultado do OCR */}
            {!processing && detectedUsers.length > 0 && (
              <div className="space-y-4">
                {/* Estatísticas */}
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex-1 text-center">
                    <div className="text-2xl font-bold text-primary">{detectedUsers.length}</div>
                    <div className="text-xs text-muted-foreground">Detectados</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-2xl font-bold text-green-600">{newUsersCount}</div>
                    <div className="text-xs text-muted-foreground">Novos</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-2xl font-bold text-orange-600">{duplicatesCount}</div>
                    <div className="text-xs text-muted-foreground">Duplicados</div>
                  </div>
                </div>

                {/* Controles de seleção */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedUsers.size === newUsersCount ? 'Desmarcar Todos' : 'Marcar Todos'}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedUsers.size} selecionado{selectedUsers.size !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Lista de usuários */}
                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
                  {detectedUsers.map((user, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
                        user.isDuplicate
                          ? 'bg-orange-50 dark:bg-orange-950/20'
                          : 'bg-background hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedUsers.has(user.username)}
                        onCheckedChange={() => handleToggleUser(user.username)}
                        disabled={user.isDuplicate}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{user.username}</span>
                          {user.isDuplicate && (
                            <Badge variant="outline" className="text-xs">
                              Já existe
                            </Badge>
                          )}
                        </div>
                      </div>
                      {user.isDuplicate ? (
                        <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                      ) : (
                        selectedUsers.has(user.username) && (
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )
                      )}
                    </div>
                  ))}
                </div>

                {/* Resultado da importação */}
                {importResult && (
                  <Alert>
                    <Check className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Importação concluída!</strong>
                      <br />
                      {importResult.success} lead{importResult.success !== 1 ? 's' : ''} importado{importResult.success !== 1 ? 's' : ''} com sucesso
                      {importResult.failed > 0 && ` • ${importResult.failed} falhou`}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Botões de ação */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    Nova Imagem
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={selectedUsers.size === 0 || importing}
                    className="flex-1"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      `Importar ${selectedUsers.size} Lead${selectedUsers.size !== 1 ? 's' : ''}`
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botão de fechar */}
        {onClose && (
          <Button variant="ghost" onClick={onClose} className="w-full">
            Fechar
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

