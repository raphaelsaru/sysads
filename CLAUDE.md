# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is "Prizely", a CRM system for customer management specifically built for "Charbelle". It's a Next.js 15 application using React 19, TypeScript, and TailwindCSS with a custom design system.

## Development Commands
- **Development server**: `npm run dev` or `pnpm dev` (opens on http://localhost:3000)
- **Build**: `npm run build`
- **Production**: `npm start`
- **Lint**: `npm run lint`

## Architecture & Structure

### Core Architecture
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode enabled
- **Styling**: TailwindCSS with extensive custom theme and dark mode support
- **Layout**: Dashboard-style layout with sidebar navigation and header

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── layout/            # Layout components (MainLayout, Header, Sidebar)
│   ├── cliente/           # Client-specific components
│   ├── ClienteForm.tsx    # Client form component
│   └── ClienteTable.tsx   # Client table component
└── types/                 # TypeScript type definitions
    ├── cliente.ts         # Client data types
    └── crm.ts            # CRM-related types
```

### Key Components
- **MainLayout**: Main application layout with responsive sidebar and header
- **Sidebar**: Navigation sidebar with mobile responsiveness
- **Header**: Top navigation header with mobile sidebar toggle
- **ClienteForm**: Form for creating/editing clients
- **ClienteTable**: Table component for displaying client data

### Type System
The application uses a well-defined TypeScript type system:
- `Cliente`: Main client interface with properties like nome, telefone, email, status, etc.
- `NovoCliente`: Type for creating new clients (omits auto-generated fields)

### Styling System
- **Custom theme**: Extensive color palette with light/dark mode variants
- **Typography**: Custom font sizes (f-h1 through f-h6)
- **Spacing**: Custom spacing values for layout components (sidebar-width, header-height, etc.)
- **Dark mode**: Class-based dark mode with `[data-pc-theme="dark"]` support

### Design Patterns
- Uses `'use client'` directive for interactive components
- Portuguese language interface (lang="pt-BR")
- Responsive design with mobile-first approach
- Component-based architecture with clear separation of concerns

## Path Aliases
- `@/*` maps to `./src/*` for clean imports

## Important Notes
- The application is in Portuguese and specifically designed for "Charbelle" company
- Uses a professional color scheme with primary blue (#04A9F5) and comprehensive theme colors
- Built with accessibility and responsiveness in mind
- No existing test framework detected - check README or ask user for testing approach when implementing tests

## Banco de Dados Local (Desenvolvimento)

- **SGBD**: PostgreSQL 17 (via Homebrew)
- **Host**: `localhost`
- **Porta**: `5432`
- **Database**: `app_dev`
- **Usuário**: `dev`
- **Senha**: `dev`
- **Extensões**: `uuid-ossp`, `pgcrypto`
