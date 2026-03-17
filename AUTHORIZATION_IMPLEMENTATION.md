# Authorization & Access Control Implementation

## Overview
Implemented role-based access control for all sensitive operations on folders, SOPs (approval flows), jobs, and OCR queue items. Only owners and admins can now manage these resources.

## Changes Made

### 1. **Database Migrations**

#### Migration: `20260317000000_add_privacy_to_approval_flows.js`
Added privacy and ownership fields to `approval_flows` table:
- `owner` (string) - Username of workflow creator
- `privacy` (string) - 'private' or 'public' (default: 'private')
- `allowed_departments` (text) - JSON list of departments with access
- `allowed_users` (text) - JSON list of users with access

#### Migration: `20260317000001_add_privacy_to_job_queue.js`
Added privacy and ownership fields to `job_queue` table:
- `owner` (string) - Username of job creator
- `privacy` (string) - 'private' or 'public' (default: 'private')
- `allowed_departments` (text) - JSON list of departments with access
- `allowed_users` (text) - JSON list of users with access

---

### 2. **Workflow/SOP Authorization** (`workflowController.js`)

#### `createApprovalFlow()`
- ✅ **NEW**: Sets `owner` to current user
- ✅ **NEW**: Accepts `privacy`, `allowed_departments`, `allowed_users` parameters
- ✅ **CHANGE**: Logs action with actual username instead of 'Admin'

#### `updateApprovalFlow()`
- ✅ **NEW**: Checks if user is owner or admin before allowing updates
- ✅ **NEW**: Validates privacy settings changes
- ✅ Returns 403 error with message: "Hanya owner SOP atau admin yang dapat mengubah SOP ini"

#### `deleteApprovalFlow()`
- ✅ **NEW**: Checks if user is owner or admin before allowing deletion
- ✅ Returns 403 error with message: "Hanya owner SOP atau admin yang dapat menghapus SOP ini"

#### `updateApproval()`
- ✅ **NEW**: Checks if user is requester or admin before allowing resubmission
- ✅ Returns 403 error with message: "Hanya pembuat persetujuan atau admin yang dapat mengubah persetujuan ini"

#### `deleteApproval()`
- ✅ **NEW**: Checks if user is requester or admin before deletion
- ✅ Returns 403 error with message: "Hanya pembuat persetujuan atau admin yang dapat menghapus persetujuan ini"

---

### 3. **Folder Authorization** (`systemController.js`)

#### `updateFolder()`
- ✅ EXISTING: Already had authorization checks for privacy changes
- ✅ EXISTING: Message: "Hanya owner folder atau admin yang dapat mengubah pengaturan privasi"

#### `deleteFolder()`
- ✅ **NEW**: Checks if user is owner or admin before deletion
- ✅ Returns 403 error with message: "Hanya owner folder atau admin yang dapat menghapus folder ini"

#### `moveFolder()`
- ✅ **NEW**: Checks if user is owner or admin before moving
- ✅ Returns 403 error with message: "Hanya owner folder atau admin yang dapat memindahkan folder ini"

#### `copyFolder()`
- ✅ **NEW**: Checks if user is owner or admin of source folder
- ✅ **NEW**: New copy is owned by current user (not copied from source)
- ✅ Returns 403 error with message: "Hanya owner folder atau admin yang dapat menyalin folder ini"

---

### 4. **Job Due Dates Authorization** (`server/index.js`)

#### `PUT /api/jobs/:id`
- ✅ **CHANGE**: Authorization check now applies to ALL updates (not just privacy changes)
- ✅ **NEW**: Checks if user is owner or admin before ANY modification
- ✅ Returns 403 error with message: "Hanya owner My Job atau admin yang dapat mengubah jadwal ini"

#### `DELETE /api/jobs/:id`
- ✅ **NEW**: Added authorization check for deletion
- ✅ **NEW**: Checks if user is owner or admin before deletion
- ✅ **NEW**: Validates job exists before checking permissions
- ✅ Returns 403 error with message: "Hanya owner My Job atau admin yang dapat menghapus jadwal ini"

---

### 5. **OCR Queue Authorization** (`ocrController.js`)

#### `retryOCRJob()`
- ✅ **NEW**: Checks if user is owner or admin before allowing retry
- ✅ **NEW**: Validates job exists before checking permissions
- ✅ Returns 403 error with message: "Hanya owner job atau admin yang dapat mengulang job ini"

#### `clearCompletedJobs()`
- ✅ **NEW**: Restricted to admin users only (maintenance operation)
- ✅ Returns 403 error with message: "Hanya admin yang dapat menghapus jobs yang sudah selesai"

---

## Authorization Logic

### Helper Functions Added

```javascript
const isAdmin = (req) => String(req.user?.role || '').toLowerCase() === 'admin';
const isOwnerOrAdmin = (req, owner) => isAdmin(req) || (owner && req.user?.username === owner);
```

### Authorization Rules

| Operation | Allowed User | Description |
|-----------|--------------|-------------|
| Create | Any authenticated user | Creator becomes owner |
| Read | Any authenticated user | Can view all items (privacy filtering on frontend) |
| Update | Owner or Admin | Only owner/admin can modify |
| Update Privacy | Owner or Admin | Only owner/admin can change privacy settings |
| Delete | Owner or Admin | Only owner/admin can delete |
| Move | Owner or Admin | Only owner/admin can move/reorder |
| Copy | Owner or Admin | Only owner/admin can copy; new copy owned by executor |
| Retry Job | Owner or Admin | Only owner/admin can retry their jobs |
| Clear Completed Jobs | Admin only | System maintenance operation |

---

## Frontend Considerations

The frontend should:

1. **Display ownership info** - Show who owns each resource
2. **Hide unauthorized actions** - Don't show Delete/Edit buttons for non-owners
3. **Handle 403 responses** - Display friendly error messages for permission denied
4. **Persist user context** - Maintain current user info for authorization logic

### Error Responses

All authorization failures return `403 Forbidden` with descriptive messages in Indonesian:

```json
{
  "error": "Hanya owner [resource] atau admin yang dapat [action] [resource]"
}
```

---

## Migration Steps

To apply these changes to an existing database:

1. Run the new migrations:
   ```bash
   npx knex migrate:latest
   ```

2. Migrations will:
   - Add new columns if they don't exist
   - Set default ownership for existing items (admin)
   - Set default privacy to 'private' for new items

3. For existing data, set owner and privacy:
   ```javascript
   // Run once to backfill existing data
   await knex('approval_flows').whereNull('owner').update({ owner: 'System', privacy: 'private' });
   await knex('job_queue').whereNull('owner').update({ owner: 'System', privacy: 'private' });
   await knex('folders').whereNull('owner').update({ owner: 'System', privacy: 'private' });
   ```

---

## Testing Checklist

- [ ] Non-owner cannot update SOP
- [ ] Non-owner cannot delete SOP
- [ ] Non-owner cannot delete folder
- [ ] Non-owner cannot move folder
- [ ] Non-owner cannot copy folder (as owner)
- [ ] Non-owner cannot update job
- [ ] Non-owner cannot delete job
- [ ] Non-owner cannot retry OCR job
- [ ] Non-admin cannot clear completed jobs
- [ ] Owner CAN perform all operations on their items
- [ ] Admin CAN perform all operations on any item
- [ ] Proper 403 error messages returned
- [ ] Audit logs properly track who performed actions

---

## Security Notes

1. **No Permission Bypass** - All operations validate ownership/admin status server-side
2. **Consistent Error Messages** - Indonesian language error messages for consistency
3. **Audit Trail** - All actions logged with actual username (not "Admin" fallback)
4. **Admin Escalation Path** - Admin can manage any resource
5. **Privacy by Default** - New items created with 'private' privacy setting

---

## Related Files Modified

- `/workspaces/pustaka/server/controllers/workflowController.js` - 5 functions updated
- `/workspaces/pustaka/server/controllers/systemController.js` - 4 functions updated
- `/workspaces/pustaka/server/controllers/ocrController.js` - 3 functions updated
- `/workspaces/pustaka/server/index.js` - 2 endpoints updated
- `/workspaces/pustaka/server/migrations/20260317000000_add_privacy_to_approval_flows.js` - NEW
- `/workspaces/pustaka/server/migrations/20260317000001_add_privacy_to_job_queue.js` - NEW
