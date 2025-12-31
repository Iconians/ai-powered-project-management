# AI-Powered Project Management System

A production-ready project management system built with Next.js, Neon PostgreSQL, Prisma, and AI integration. Features Kanban boards, AI task generation, real-time collaboration, and background workers.

## Features

- **Kanban Boards**: Drag-and-drop task management with optimistic UI updates
- **AI Task Generation**: Automatically break down projects into tasks using OpenAI or Anthropic
- **AI Sprint Planning**: Intelligent sprint planning based on backlog and capacity
- **Real-time Updates**: Live collaboration using Pusher
- **Multi-tenant Security**: Organization and team isolation with role-based access
- **Authentication**: NextAuth.js with email/password authentication
- **Background Workers**: Automated reminders, automation rules, and cron jobs

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Database**: Neon PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v4 with Credentials provider
- **Real-time**: Pusher (or polling fallback)
- **AI**: Demo mode (free), Google Gemini (free tier), Ollama (local/free), or OpenAI/Anthropic (paid)
- **State Management**: React Query, Zustand
- **Drag & Drop**: @dnd-kit
- **Styling**: Tailwind CSS
- **Workers**: Node.js with BullMQ and Redis

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Neon PostgreSQL database
- Redis (for workers)
- OpenAI or Anthropic API key
- Pusher account (optional, for realtime)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your environment variables:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL`: Your app URL (e.g., `http://localhost:3000`)
   - `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`: Pusher credentials (optional)
   - `AI_PROVIDER`: "demo" (free, default), "gemini" (free tier), "ollama" (local), "openai", or "anthropic"
- `GOOGLE_GEMINI_API_KEY`: Optional - for Gemini free tier (15 RPM)
- `OLLAMA_URL`: Optional - for local Ollama (default: http://localhost:11434)
- `OLLAMA_MODEL`: Optional - Ollama model name (default: llama3)
- `OPENAI_API_KEY`: Optional - for OpenAI (paid)
- `ANTHROPIC_API_KEY`: Optional - for Anthropic (paid)
   - `REDIS_URL`: Your Redis connection URL

4. Set up the database:
   ```bash
   bun run db:push
   bun run db:generate
   ```

5. Run the development server:
   ```bash
   bun run dev
   ```

6. (Optional) Run the worker service:
   ```bash
   cd workers
   bun install
   bun run dev
   ```

## Project Structure

```
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── (auth)/       # Authentication pages
│   │   ├── (dashboard)/  # Protected dashboard pages
│   │   └── api/          # API routes
│   ├── components/        # React components
│   ├── lib/              # Utility libraries
│   │   ├── prisma.ts     # Prisma client
│   │   ├── auth.ts       # Auth helpers
│   │   └── pusher.ts     # Pusher client
│   ├── hooks/            # React hooks
│   └── types/            # TypeScript types
├── workers/              # Background worker service
└── prisma/
    └── schema.prisma     # Database schema
```

## Database Schema

The system uses a multi-tenant architecture with:
- **User**: Authentication and user data
- **Organizations**: Top-level tenant isolation
- **Teams**: Groups within organizations
- **Members**: User-organization-team relationships with roles
- **Boards**: Project boards (Kanban, Scrum, etc.)
- **Sprints**: Time-boxed iterations
- **Tasks**: Individual work items
- **Comments**: Task discussions
- **Attachments**: File references
- **AutomationRules**: Trigger-action automation
- **Reminders**: Scheduled notifications

## API Routes

- `POST /api/auth/signup` - Create user account
- `POST /api/organizations` - Create organization
- `GET /api/organizations` - List user's organizations
- `POST /api/boards` - Create board
- `GET /api/boards` - List boards
- `GET /api/boards/[id]` - Get board details
- `POST /api/tasks` - Create task
- `GET /api/tasks` - List tasks
- `PATCH /api/tasks/[id]` - Update task
- `POST /api/ai/tasks` - Generate tasks with AI
- `POST /api/ai/sprint-planning` - AI sprint planning
- `POST /api/pusher/auth` - Pusher authentication

## Authentication

The system uses NextAuth.js with Credentials provider:
- Email/password authentication
- JWT-based sessions
- Protected routes via middleware
- Role-based access control (ADMIN, MEMBER, VIEWER)

## Real-time Updates

Real-time features use Pusher:
- Task updates broadcast to all connected clients
- Board changes sync in real-time
- Connection state management

Alternative: Use polling by setting `refetchInterval` in React Query.

## Background Workers

The worker service handles:
- **Reminders**: Scheduled task reminders via email
- **Automation**: Rule-based task automation
- **Cron Jobs**: Daily reports, sprint status updates, cleanup tasks

## Development

- Run Prisma Studio: `bun run db:studio`
- Generate Prisma client: `bun run db:generate`
- Run migrations: `bun run db:migrate`

## Deployment

1. Deploy Next.js app to Vercel or similar
2. Deploy worker service separately (e.g., Railway, Render)
3. Set up Redis instance (e.g., Upstash, Redis Cloud)
4. Configure environment variables in deployment platform
5. Run database migrations in production

## Migration from Supabase

This project was migrated from Supabase to Neon. Key changes:
- Database: Supabase PostgreSQL → Neon PostgreSQL
- Auth: Supabase Auth → NextAuth.js
- Realtime: Supabase Realtime → Pusher
- Storage: Removed (not implemented)

## AI Configuration (Free Options for Portfolio)

The system supports multiple AI providers, with **free options perfect for portfolio projects**:

### 1. Google Gemini (Default - Free Tier) ⭐ Recommended
- **Cost**: Free (15 requests/minute), then $0.075 per 1M tokens
- **Setup**: Get free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Best for**: Real AI with generous free tier - perfect for portfolio projects
- **Usage**: Set `AI_PROVIDER=gemini` (default) and `GOOGLE_GEMINI_API_KEY=your-key`
- **Note**: Uses `gemini-1.5-flash` model for fast, cost-effective responses

### 2. Demo Mode (Fallback - Completely Free)
- **Cost**: $0
- **Setup**: No API keys needed
- **How it works**: Rule-based task generation that simulates AI
- **Best for**: Portfolio demos when API keys aren't available
- **Usage**: Set `AI_PROVIDER=demo` (automatic fallback if Gemini fails)

### 3. Ollama (Local - Completely Free)
- **Cost**: $0 (runs on your machine)
- **Setup**: 
  ```bash
  # Install Ollama
  curl -fsSL https://ollama.ai/install.sh | sh
  
  # Pull a model (e.g., Llama 3)
  ollama pull llama3
  ```
- **Best for**: Full control, no API limits, completely free
- **Usage**: Set `AI_PROVIDER=ollama` and optionally `OLLAMA_URL` and `OLLAMA_MODEL`

### 4. Paid Options (Optional)
- **OpenAI**: GPT-3.5 Turbo (~$2 per 1000 generations)
- **Anthropic**: Claude Haiku (~$1.50 per 1000 generations)

### Recommendation for Portfolio
Use **Google Gemini** - it's free (15 requests/minute), provides real AI capabilities, and demonstrates the feature perfectly. Just get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey) and set `GOOGLE_GEMINI_API_KEY` in your `.env.local`.

The system automatically falls back to demo mode if Gemini is unavailable, so it always works!

## License

MIT
