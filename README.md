# Gestão de Faturas - Construção

Sistema de gestão de faturas e custos de obra para empresas de construção.

## Funcionalidades

- **Upload de faturas** — PDF ou fotografia (câmara do telemóvel)
- **OCR automático** — Extração de dados via DocuPipe
- **Revisão e edição** — Correção de campos extraídos, linhas da fatura
- **Workflow de aprovação** — Upload → OCR → Revisão → Aprovação
- **Deteção de duplicados** — Aviso por fornecedor + nº fatura
- **Dashboard** — Custos por projeto, fornecedor e mês
- **Exportação CSV** — Global ou por projeto
- **3 perfis** — Admin, Contabilidade, Gestor

## Stack Tecnológica

- **Frontend/Backend:** Next.js 16 (App Router)
- **Base de dados:** Supabase (PostgreSQL)
- **Armazenamento:** Supabase Storage
- **Gráficos:** Recharts
- **CSS:** Tailwind CSS
- **OCR:** DocuPipe API

## Pré-requisitos

- Node.js 18+
- Conta Supabase (gratuita em [supabase.com](https://supabase.com))
- Chave API DocuPipe (opcional — o sistema funciona sem OCR)

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha o ficheiro `.env.local` com os valores do seu projeto Supabase:

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anónima (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role secreta do Supabase (para webhooks) |
| `NEXT_PUBLIC_SITE_URL` | URL pública da app (ex: `https://ocr-ynrd.vercel.app`) |
| `DOCUPIPE_API_KEY` | Chave API do DocuPipe |
| `DOCUPIPE_API_URL` | URL base da API DocuPipe (ex: `https://app.docupipe.ai`) |
| `DOCUPIPE_WEBHOOK_SECRET` | Secret para validar webhooks |
| `DOCUPIPE_WEBHOOK_URL` | URL completa do webhook (opcional, tem prioridade) |
| `NEXT_PUBLIC_INVOICES_BUCKET` | Nome do bucket de faturas (opcional, default: `invoices`) |

Notas:
- Em produção, configure `NEXT_PUBLIC_SITE_URL` ou `DOCUPIPE_WEBHOOK_URL` para evitar callbacks para `localhost`.
- `SUPABASE_SERVICE_ROLE_KEY` não pode ser chave `anon`/`publishable`.
- Com a API atual do DocuPipe, use endpoint `/document` com header `X-API-Key`.

### 3. Configurar base de dados

1. Aceda ao **SQL Editor** no dashboard do Supabase
2. Cole e execute o conteúdo de `supabase/schema.sql`

### 4. Configurar armazenamento

No dashboard do Supabase:

1. Vá a **Storage** → **New Bucket**
2. Crie um bucket chamado `invoices` (privado)
3. Adicione políticas de acesso:
   - **INSERT**: Utilizadores autenticados podem fazer upload
   - **SELECT**: Utilizadores autenticados podem ver ficheiros
4. Se aparecer o erro **"Bucket not found"**, confirme que o nome do bucket corresponde ao valor de `NEXT_PUBLIC_INVOICES_BUCKET` (ou `invoices` por defeito)

### 5. Criar primeiro utilizador admin

1. Inicie a aplicação com `npm run dev`
2. Aceda a `http://localhost:3000/login` e crie uma conta
3. No SQL Editor do Supabase, altere o role do utilizador:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'seu-email@empresa.pt';
```

### 6. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`

## Estrutura do Projeto

```
src/
├── app/
│   ├── (app)/              # Rotas autenticadas
│   │   ├── dashboard/      # Dashboard com gráficos
│   │   ├── invoices/       # Listagem, upload e detalhe
│   │   └── projects/       # Gestão de projetos
│   ├── api/
│   │   ├── docupipe/       # Upload OCR + Webhook
│   │   └── export/         # Exportação CSV
│   └── login/              # Autenticação
├── components/             # Componentes React
├── lib/
│   ├── supabase/           # Clientes Supabase (browser + server)
│   ├── docupipe.ts         # Integração DocuPipe
│   ├── types.ts            # Tipos TypeScript
│   └── utils.ts            # Utilitários
└── middleware.ts            # Auth middleware
```

## Workflow de Faturas

```
Upload → Processing (OCR) → Pendente Revisão → Pendente Aprovação → Aprovada/Rejeitada
```

1. Utilizador carrega PDF/foto
2. Sistema envia para OCR (DocuPipe)
3. Dados extraídos preenchem formulário
4. Utilizador revê, corrige e atribui projeto
5. Submete para aprovação
6. Contabilidade/Admin aprova ou rejeita

## Perfis e Permissões

| Ação | Admin | Contabilidade | Gestor |
|---|:---:|:---:|:---:|
| Ver todas as faturas | ✅ | ✅ | ❌ |
| Ver faturas próprias | ✅ | ✅ | ✅ |
| Carregar faturas | ✅ | ✅ | ✅ |
| Rever/editar faturas | ✅ | ✅ | ✅* |
| Aprovar/rejeitar | ✅ | ✅ | ❌ |
| Criar projetos | ✅ | ❌ | ❌ |
| Ver dashboard | ✅ | ✅ | ✅ |

*Apenas faturas próprias

## Produção

```bash
npm run build
npm start
```

Para deploy no Vercel, basta ligar o repositório e configurar as variáveis de ambiente.
