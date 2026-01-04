# GitHub Projects Sync Implementation

## ✅ What's Been Implemented

### 1. Assignee Syncing
- **User Model**: Added `githubUsername` field to store GitHub usernames
- **OAuth Callback**: Automatically stores GitHub username when users connect via OAuth
- **Task Assignment**: When you assign a task to a user with a GitHub username, it automatically assigns them to the GitHub issue
- **Task Unassignment**: When you remove an assignee, it removes them from the GitHub issue

### 2. GitHub Projects Integration
- **Project Sync**: Tasks are now synced to GitHub Projects (not just issues with labels)
- **Status Mapping**: Task status changes update the project item's status field
- **Automatic Addition**: New tasks are automatically added to the project when created

## How to Set Up GitHub Projects Sync

### Step 0: Reconnect GitHub Account (Required for Projects)

**Important**: GitHub Projects require additional OAuth scopes (`read:project` and `project`). The `project` scope is required for write access (updating project items). If you connected GitHub before this update, you need to reconnect:

1. Go to your board
2. Click "Connect GitHub" again
3. Authorize the new scopes when prompted
4. This will update your token with the required permissions

### Step 1: Get Your GitHub Project ID

1. Go to your GitHub repository
2. Click on the **Projects** tab
3. Open your project board
4. The project ID is in the URL: `https://github.com/orgs/YOUR_ORG/projects/PROJECT_NUMBER`
   - The `PROJECT_NUMBER` is the numeric ID you need
5. Alternatively, you can get it from the project settings URL

### Step 2: Set the Project ID for Your Board

You can set the project ID via the API:

```bash
PATCH /api/boards/[boardId]/github
{
  "githubProjectId": 123  // Your GitHub project number
}
```

Or update it directly in the database:

```sql
UPDATE "Board" 
SET "githubProjectId" = 123 
WHERE id = 'your-board-id';
```

### Step 3: Ensure Project Status Field Exists

Your GitHub Project needs a **Status** field with these options:
- Todo
- In Progress
- In Review
- Done
- Blocked

If these don't exist, GitHub will create them automatically, or you can add them manually in your project settings.

## How It Works

### Task Creation
1. When you create a task in the app → Creates a GitHub issue
2. If `githubProjectId` is set → Adds the issue to the GitHub Project
3. Sets the project item status based on task status

### Task Updates
1. When you move a task to a different column → Updates GitHub issue labels
2. If `githubProjectId` is set → Updates the project item status
3. When you assign/unassign → Updates GitHub issue assignees

### Status Mapping

| App Status | GitHub Project Status | GitHub Issue Label |
|------------|----------------------|-------------------|
| TODO | Todo | todo |
| IN_PROGRESS | In Progress | in-progress |
| IN_REVIEW | In Review | in-review |
| DONE | Done | done |
| BLOCKED | Blocked | blocked |

## Assignee Syncing

### How It Works
1. User connects GitHub via OAuth → GitHub username is stored in `User.githubUsername`
2. Task is assigned to user → If user has `githubUsername`, assigns them to GitHub issue
3. Task is unassigned → Removes assignee from GitHub issue

### Requirements
- Users must connect their GitHub account via OAuth (the "Connect GitHub" button)
- The GitHub username is automatically stored when they connect
- Only users with a stored `githubUsername` can be synced as assignees

## Troubleshooting

### Project Sync Not Working

1. **Check Project ID Format**: 
   - The project ID should be the numeric ID from the GitHub project URL
   - If sync fails, you may need to use the full node ID format (e.g., `PVT_kwDO...`)

2. **Check Project Permissions**:
   - The GitHub token needs access to the project
   - Make sure the OAuth app has the `project` scope

3. **Check Status Field**:
   - The project must have a "Status" field
   - The status options must match: Todo, In Progress, In Review, Done, Blocked

4. **Check Logs**:
   - Look for `✅ Added issue #X to project` messages
   - Look for `❌ Failed to sync to GitHub Project` errors

### Assignee Sync Not Working

1. **Check GitHub Username**:
   - User must have connected GitHub via OAuth
   - Check `User.githubUsername` in the database

2. **Check Permissions**:
   - The GitHub token needs `repo` scope
   - The user must have write access to the repository

## API Endpoints

### Set GitHub Project ID
```typescript
PATCH /api/boards/[boardId]/github
{
  "githubProjectId": 123
}
```

### Get Board Info (includes project ID)
```typescript
GET /api/boards/[boardId]
// Returns: { ..., githubProjectId: 123, ... }
```

## Notes

- **Project Node IDs**: GitHub Projects use node IDs in GraphQL (e.g., `PVT_kwDO...`). The code tries to construct this from the numeric ID, but if it fails, you may need to provide the full node ID.
- **Status Field**: The project must have a "Status" field. If it doesn't exist, the sync will skip status updates but still add issues to the project.
- **Error Handling**: Project sync failures don't break task creation/updates. Check server logs for details.

