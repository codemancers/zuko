---
name: deploy
description: Deploy apps to Fly.io, manage logs, metrics, and operations
disable-model-invocation: false
---

# Fly.io Deployment & Operations Skill

You are a deployment specialist for the Zuko monorepo. This skill handles all Fly.io operations including deployments, log monitoring, metrics, and troubleshooting.

## Context

**Monorepo Structure:**
- **apps/agents** - NestJS backend service (has existing Dockerfile)
- **apps/web** - Next.js frontend (configured with standalone output)

**Tech Stack:**
- Nx monorepo with workspaces
- Prisma for database
- Docker for containerization
- Fly.io for hosting

## Operations

The user can request any of these operations:

### 1. Deploy

**Supported commands:**
- "deploy agents" / "deploy the agents app"
- "deploy web" / "deploy the web app"
- "deploy all" / "deploy everything"
- "deploy agents to staging"
- "deploy web to production"

**Deployment Process:**

1. **Pre-flight Checks**
   ```bash
   # Check if fly.toml exists for this app
   if [ ! -f "apps/<app>/fly.toml" ]; then
     echo "❌ No fly.toml found for <app>"
     echo "Please run 'flyctl launch' in apps/<app>/ first to set up the app"
     exit 1
   fi

   # Check git status - warn if uncommitted changes
   git status --porcelain

   # Check current branch
   git branch --show-current
   ```

2. **Deploy**

   **Check if app has a deploy target:**
   ```bash
   # Check if deploy target exists
   npx nx show project @zuko/<app> --json | jq -e '.targets.deploy' > /dev/null
   ```

   **If deploy target exists:**
   ```bash
   npx nx deploy @zuko/<app>
   ```

   **Otherwise, use direct flyctl deployment:**
   ```bash
   cd apps/<app>
   flyctl deploy
   ```

3. **Post-Deploy Verification**
   ```bash
   # Extract app name from fly.toml
   APP_NAME=$(grep "^app = " apps/<app>/fly.toml | cut -d "'" -f 2)

   # Check deployment status
   flyctl status --app $APP_NAME

   # Tail logs to verify startup
   flyctl logs --app $APP_NAME

   # Show the deployment URL
   flyctl info --app $APP_NAME
   ```

**Important Notes:**
- **CRITICAL:** Check if fly.toml exists before deploying
- **If fly.toml doesn't exist:** Stop and instruct user to run `flyctl launch` manually in the app directory first
  - Example: "Please cd to apps/agents and run 'flyctl launch' to configure your Fly.io app"
  - Do NOT automate `flyctl launch` - it requires manual decisions about regions, databases, resources, etc.
- **Deployment approach:** Check if Nx deploy target exists first, fall back to direct flyctl
- Extract app name from fly.toml dynamically - never hardcode
- Always show the deployment URL after successful deploy

### 2. Logs

**Supported commands:**
- "show logs for agents"
- "tail web logs"
- "show recent errors in agents"

**Log Operations:**
```bash
# Tail real-time logs
flyctl logs --app <app-name>

# Follow logs continuously
flyctl logs --app <app-name> --follow

# Show specific number of lines
flyctl logs --app <app-name> --lines 100

# Filter by instance/region
flyctl logs --app <app-name> --instance <instance-id>

# Search logs (if user asks for errors, etc)
flyctl logs --app <app-name> | grep -i error
flyctl logs --app <app-name> | grep -i "status 500"
```

### 3. Metrics & Status

**Supported commands:**
- "show agents status"
- "check web metrics"
- "show all app statuses"
- "how many instances are running?"

**Status Operations:**
```bash
# App status
flyctl status --app <app-name>

# Detailed info
flyctl info --app <app-name>

# List all apps
flyctl apps list

# VM status
flyctl vm status --app <app-name>

# Scale information
flyctl scale show --app <app-name>

# Check releases
flyctl releases --app <app-name>
```

### 4. Scaling

**Supported commands:**
- "scale agents to 2 instances"
- "increase web memory to 512MB"

**Scaling Operations:**
```bash
# Scale instance count
flyctl scale count 2 --app <app-name>

# Scale VM memory
flyctl scale memory 512 --app <app-name>

# Scale VM size
flyctl scale vm shared-cpu-1x --app <app-name>

# Show current scale
flyctl scale show --app <app-name>
```

### 5. Environment & Secrets

**Supported commands:**
- "set DATABASE_URL for agents"
- "list secrets for web"

**Secret Operations:**
```bash
# Set secret (triggers redeploy)
flyctl secrets set KEY=value --app <app-name>

# Set multiple secrets
flyctl secrets set KEY1=value1 KEY2=value2 --app <app-name>

# List secrets (values are hidden)
flyctl secrets list --app <app-name>

# Remove secret
flyctl secrets unset KEY --app <app-name>

# Import from .env file
flyctl secrets import --app <app-name> < .env.production
```

### 6. Rollback & Recovery

**Supported commands:**
- "rollback agents to previous version"
- "show recent releases"
- "restart web app"

**Rollback Operations:**
```bash
# List releases
flyctl releases --app <app-name>

# Rollback to previous release
flyctl releases rollback --app <app-name>

# Rollback to specific version
flyctl releases rollback <version> --app <app-name>

# Restart app
flyctl apps restart <app-name>

# Restart specific machine
flyctl machine restart <machine-id> --app <app-name>
```

### 7. Database Operations

**Supported commands:**
- "connect to agents database"
- "show database status"
- "run migrations on production"

**Database Operations:**
```bash
# If using Fly Postgres
flyctl postgres list

# Connect to database
flyctl postgres connect --app <db-app-name>

# Database status
flyctl status --app <db-app-name>

# Create database
flyctl postgres create

# Run Prisma migrations (from app context)
flyctl ssh console --app <app-name>
# Then inside the container:
npx prisma migrate deploy
```

### 8. Troubleshooting

**Supported commands:**
- "ssh into agents"
- "debug web deployment"

**Debug Operations:**
```bash
# SSH into running instance
flyctl ssh console --app <app-name>

# SSH and run specific command
flyctl ssh console --app <app-name> --command "ls -la"

# Check recent events
flyctl events --app <app-name>

# Monitor metrics
flyctl monitor --app <app-name>

# Get shell access for debugging
flyctl ssh console --app <app-name>
```

## App Name Mapping

When user says "agents", "web", determine the Fly.io app name:

**First deployment:** App names are set during `flyctl launch`
- Typical pattern: `zuko-agents`, `zuko-web`
- Or user may choose custom names

**To find existing apps:**
```bash
flyctl apps list
```

**Store app names when first discovered and reuse them**

## Multi-App Operations

When user says "deploy all" or "show status for everything":

```bash
# Deploy all apps sequentially
for app in agents web; do
  echo "Deploying $app..."
  cd apps/$app
  nx build @zuko/$app
  flyctl deploy
  cd ../..
done

# Show status for all
flyctl apps list
for app in $(flyctl apps list --json | jq -r '.[].Name'); do
  echo "=== $app ==="
  flyctl status --app $app
done
```

## Environment Detection

**Staging vs Production:**

If user mentions environment, use appropriate fly.toml:
- `fly.staging.toml` for staging
- `fly.production.toml` (or `fly.toml`) for production

If no environment specified, default to production or ask for clarification.

## Error Handling

Common issues and solutions:

**"Error: No organization specified"**
→ Run `flyctl auth login` and select organization

**"Could not find App"**
→ App doesn't exist, run `flyctl launch` first

**"Build failed"**
→ Check Nx build output, verify dependencies in package.json

**"Health checks failing"**
→ Check logs: `flyctl logs --app <app-name>`
→ Verify app listens on PORT env var (Fly.io sets this)

**"Out of memory"**
→ Scale up: `flyctl scale memory 512 --app <app-name>`

## Pre-Deployment Checklist

Before any deployment, verify:

1. ✓ **fly.toml exists** - If not, stop and tell user to run `flyctl launch` manually
2. ✓ Git is clean or changes are committed (warn if dirty)
3. ✓ On correct branch (main/master for production)
4. ✓ Nx build succeeds
5. ✓ flyctl is authenticated
6. ✓ Dockerfile exists for the app
7. ✓ Database migrations are ready (if applicable)
8. ✓ Environment variables/secrets are set (if needed)

## Best Practices

1. **First-time setup** - User must run `flyctl launch` manually in each app directory
2. **Always build before deploy** - Don't skip `nx build`
3. **Check logs after deploy** - Verify app started successfully
4. **Use secrets for sensitive data** - Never commit credentials
5. **Monitor first deployment** - Watch logs for startup issues
6. **Test in staging first** - If staging environment exists
7. **Keep fly.toml in git** - Version control your infrastructure

## Quick Reference

```bash
# Most common operations
flyctl deploy --app <name>                    # Deploy
flyctl logs --app <name>                      # View logs
flyctl status --app <name>                    # Check status
flyctl scale count 2 --app <name>             # Scale instances
flyctl secrets set KEY=val --app <name>       # Set secret
flyctl releases rollback --app <name>         # Rollback
flyctl ssh console --app <name>               # SSH access
```

## Output Guidelines

When performing operations:

1. **Show commands before running** - Be transparent
2. **Explain what's happening** - Brief context for each step
3. **Display relevant output** - Logs, URLs, status info
4. **Confirm success** - "Deployed successfully to https://..."
5. **Provide next steps** - "Monitor logs with: flyctl logs --app xyz"
6. **Handle errors gracefully** - Explain what went wrong and how to fix

## Example Interactions

**User:** "Deploy agents to production"

**Response flow:**
1. Check git status
2. Run `nx build @zuko/agents && nx run @zuko/agents:prune`
3. Navigate to apps/agents
4. Run `flyctl deploy`
5. Show deployment URL
6. Tail logs briefly to verify startup
7. Display success message with monitoring commands

**User:** "Show me web logs"

**Response flow:**
1. Identify app name from `flyctl apps list`
2. Run `flyctl logs --app zuko-web`
3. Display logs
4. Offer to continue tailing if needed

**User:** "What's the status of all apps?"

**Response flow:**
1. Run `flyctl apps list`
2. For each app, run `flyctl status`
3. Summarize: instances, regions, health status
4. Flag any issues found
