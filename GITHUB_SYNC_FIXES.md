# GitHub Sync Fixes & Assignee Syncing Guide

## Issues Fixed

### 1. ✅ Task Creation → GitHub Issue Creation
**Problem**: Tasks created in the app weren't creating GitHub issues.

**Fix**: 
- Added proper error logging with ✅/❌ emojis for easier debugging
- Added status labels when creating issues
- Improved error handling to show detailed error information

**Location**: `src/app/api/tasks/route.ts` (lines 105-130)

### 2. ✅ Task Status Changes → GitHub Label Updates
**Problem**: Moving tasks between columns wasn't updating GitHub issue labels.

**Fix**:
- Fixed Prisma query conflict (removed conflicting `select` clause)
- Added logic to create GitHub issue if it doesn't exist when updating
- Ensured `githubIssueNumber` is included in task queries
- Added logging for sync operations

**Location**: `src/app/api/tasks/[id]/route.ts` (lines 193-230)

### 3. ✅ Title/Description Updates → GitHub Issue Updates
**Problem**: Editing task title/description wasn't syncing to GitHub.

**Fix**:
- Updated sync logic to handle all task updates (not just status changes)
- Added proper field updates in the sync function
- Ensured title and description are always synced

**Location**: `src/lib/github-sync.ts` (lines 46-54)

## Assignee Syncing - What's Needed

To enable assignee syncing between your app and GitHub, you need to:

### Step 1: Add GitHub Username to User Model

Add a `githubUsername` field to the `User` model in `prisma/schema.prisma`:

```prisma
model User {
  id                            String    @id @default(cuid())
  email                         String    @unique
  password                      String
  name                          String?
  githubUsername                String?   // Add this field
  // ... rest of fields
}
```

Then run:
```bash
bunx prisma db push
```

### Step 2: Update GitHub OAuth Callback

When a user connects their GitHub account, store their GitHub username:

**File**: `src/app/api/github/callback/route.ts`

After getting the GitHub user info, update the user:
```typescript
// Get user's GitHub info
const userResponse = await fetch("https://api.github.com/user", {
  headers: {
    Authorization: `token ${accessToken}`,
  },
});
const githubUser = await userResponse.json();

// Update the current user's GitHub username
const session = await getServerSession(authOptions);
if (session?.user?.email) {
  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      githubUsername: githubUser.login,
    },
  });
}
```

### Step 3: Implement Assignee Syncing

Update `src/lib/github-sync.ts` to sync assignees:

```typescript
// In syncTaskToGitHub function, after line 54:

// Update assignee if task has one
if (task.assignee?.user?.githubUsername) {
  try {
    // Assign the GitHub user to the issue
    await githubClient.rest.issues.addAssignees({
      owner,
      repo,
      issue_number: task.githubIssueNumber,
      assignees: [task.assignee.user.githubUsername],
    });
  } catch (error) {
    console.error("Failed to assign GitHub user:", error);
    // Continue even if assignee sync fails
  }
} else if (task.assignee) {
  // Task has assignee but no GitHub username - log warning
  console.warn(`Task ${task.id} has assignee ${task.assignee.user.email} but no GitHub username`);
}
```

### Step 4: Handle Assignee Removal

When a task is unassigned, remove the assignee from GitHub:

```typescript
// Check if assignee was removed
const previousTask = await prisma.task.findUnique({
  where: { id: taskId },
  include: { assignee: { include: { user: true } } },
});

if (previousTask?.assignee && !task.assignee) {
  // Assignee was removed
  try {
    await githubClient.rest.issues.removeAssignees({
      owner,
      repo,
      issue_number: task.githubIssueNumber,
      assignees: [previousTask.assignee.user.githubUsername!],
    });
  } catch (error) {
    console.error("Failed to remove GitHub assignee:", error);
  }
}
```

### Step 5: Sync Assignees from GitHub → App

When a GitHub issue assignee changes, update the task:

**File**: `src/app/api/github/webhook/route.ts`

In the `issues` event handler, after syncing the issue:

```typescript
// Sync assignees from GitHub
if (issue.assignees && issue.assignees.length > 0) {
  const githubUsername = issue.assignees[0].login;
  
  // Find user by GitHub username
  const user = await prisma.user.findFirst({
    where: { githubUsername },
  });
  
  if (user) {
    // Find member for this user in the board's organization
    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        organizationId: board.organizationId,
      },
    });
    
    if (member) {
      // Update task assignee
      await prisma.task.update({
        where: { id: task.id },
        data: { assigneeId: member.id },
      });
    }
  }
}
```

## Testing the Fixes

1. **Test Task Creation**:
   - Create a new task in your app
   - Check server logs for: `✅ Created GitHub issue #X for task Y`
   - Verify the issue appears on GitHub

2. **Test Status Changes**:
   - Move a task to a different column
   - Check server logs for: `✅ Synced task X to GitHub issue #Y`
   - Verify the GitHub issue label changed

3. **Test Title/Description Updates**:
   - Edit a task's title or description
   - Verify the GitHub issue is updated

4. **Test Assignee Syncing** (after implementing):
   - Assign a task to a user with a GitHub username
   - Verify the GitHub issue is assigned
   - Unassign the task
   - Verify the GitHub issue assignee is removed

## Current Status

- ✅ Task creation → GitHub issue creation
- ✅ Task status changes → GitHub label updates  
- ✅ Title/description updates → GitHub issue updates
- ⏳ Assignee syncing (requires implementation above)

