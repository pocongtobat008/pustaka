import { z } from 'zod';

const privacyEnum = z.enum(['public', 'private', 'department', 'specific', 'specific_users', 'dept', 'user']);

export const jobCreateSchema = z.object({
    title: z.string().min(1, 'title is required'),
    dueDate: z.string().nullable().optional(),
    assignedTo: z.any().optional(),
    privacy: privacyEnum.nullable().optional(),
    allowedUsers: z.array(z.string()).nullable().optional(),
    allowedDepts: z.array(z.string()).nullable().optional(),
    type: z.string().nullable().optional(),
    targetDept: z.string().nullable().optional(),
    owner: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    completedMonths: z.array(z.any()).nullable().optional(),
    completed_months: z.union([z.string(), z.array(z.any())]).nullable().optional(),
    issues: z.array(z.any()).nullable().optional(),
    kendala: z.string().nullable().optional()
}).passthrough();

export const jobUpdateSchema = jobCreateSchema.partial();

export const monitoredPicUpsertSchema = z.object({
    username: z.string().min(1, 'username is required'),
    privacy: privacyEnum.optional(),
    allowedUsers: z.array(z.string()).optional(),
    allowedDepts: z.array(z.string()).optional()
}).passthrough();

export const independentIssueCreateSchema = z.object({
    note: z.string().min(1, 'note is required'),
    detail: z.string().optional(),
    status: z.string().optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
    history: z.array(z.any()).optional(),
    assignedTo: z.array(z.string()).optional(),
    owner: z.string().optional(),
    resolvedAt: z.string().optional()
}).passthrough();

export const independentIssueUpdateSchema = independentIssueCreateSchema.partial();

export const sopFlowCreateSchema = z.object({
    title: z.string().min(1, 'title is required'),
    description: z.string().optional(),
    category: z.string().optional(),
    steps: z.array(z.any()).optional(),
    visual_config: z.record(z.string(), z.any()).optional(),
    privacy_type: privacyEnum.optional(),
    allowed_departments: z.array(z.string()).optional(),
    allowed_users: z.array(z.string()).optional()
}).passthrough();

export const sopFlowUpdateSchema = sopFlowCreateSchema.partial();

export const loginSchema = z.object({
    username: z.string().min(1, 'username is required'),
    password: z.string().min(1, 'password is required')
});

export const userCreateSchema = z.object({
    username: z.string().min(1, 'username is required'),
    password: z.string().min(1, 'password is required'),
    name: z.string().min(1, 'name is required'),
    role: z.string().min(1, 'role is required'),
    department: z.string().optional()
}).passthrough();

export const userUpdateSchema = z.object({
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    department: z.string().optional()
}).passthrough();

export const profileUpdateSchema = z.object({
    name: z.string().min(1, 'name is required').optional(),
    password: z.string().min(1, 'password cannot be empty').optional(),
    currentPassword: z.string().min(1, 'currentPassword cannot be empty').optional()
}).refine((data) => !(data.password && !data.currentPassword), {
    message: 'currentPassword is required when changing password',
    path: ['currentPassword']
}).passthrough();

const approverStepSchema = z.object({
    username: z.string().min(1, 'step username is required'),
    name: z.string().min(1).optional(),
    nodeId: z.any().optional()
}).passthrough();

export const approvalFlowCreateSchema = z.object({
    name: z.string().min(1, 'name is required'),
    description: z.string().optional(),
    steps: z.array(approverStepSchema).optional(),
    visual_config: z.record(z.string(), z.any()).optional(),
    privacy: z.string().optional(),
    allowed_departments: z.array(z.string()).optional(),
    allowed_users: z.array(z.string()).optional()
}).passthrough();

export const approvalFlowUpdateSchema = approvalFlowCreateSchema.partial();

export const approvalInitiateSchema = z.object({
    title: z.string().min(1, 'title is required'),
    description: z.string().optional(),
    division: z.string().optional(),
    requester_name: z.string().optional(),
    requester_username: z.string().min(1, 'requester_username is required'),
    attachment_url: z.string().optional(),
    attachment_name: z.string().optional(),
    flow_id: z.union([z.string(), z.number()]).optional(),
    steps: z.array(approverStepSchema).min(1, 'at least one step is required')
}).passthrough();

export const approvalActionSchema = z.object({
    username: z.string().min(1, 'username is required'),
    action: z.enum(['Approve', 'Reject'], { message: 'action must be Approve or Reject' }),
    note: z.string().optional(),
    file: z.any().optional()
}).passthrough();

export const approvalUpdateSchema = z.object({
    title: z.string().min(1, 'title is required'),
    description: z.string().optional(),
    division: z.string().optional(),
    requester_name: z.string().optional(),
    requester_username: z.string().optional(),
    attachment_url: z.string().optional(),
    attachment_name: z.string().optional(),
    flow_id: z.union([z.string(), z.number()]).optional(),
    steps: z.array(approverStepSchema).min(1, 'at least one step is required')
}).passthrough();

export const approvalResetStepSchema = z.object({
    stepIndex: z.coerce.number().int().min(0, 'stepIndex must be >= 0'),
    username: z.string().optional()
}).passthrough();

export const createBoxSchema = z.object({
    box_id: z.string().min(1, 'box_id is required'),
    description: z.string().optional(),
    location: z.string().optional()
}).passthrough();

export const updateInventoryItemSchema = z.object({
    status: z.string().optional(),
    box_data: z.union([z.string(), z.record(z.string(), z.any()), z.array(z.any()), z.null()]).optional(),
    box_id: z.string().nullable().optional(),
    boxId: z.string().nullable().optional(),
    history: z.union([z.string(), z.array(z.any()), z.null()]).optional(),
    lastUpdated: z.string().optional()
}).passthrough();

export const createExternalItemSchema = z.object({
    boxId: z.string().min(1, 'boxId is required'),
    destination: z.string().min(1, 'destination is required'),
    sentDate: z.string().optional(),
    sender: z.string().optional(),
    boxData: z.union([z.string(), z.record(z.string(), z.any()), z.array(z.any())]).optional(),
    history: z.union([z.string(), z.array(z.any())]).optional()
}).passthrough();

export const moveInventoryItemSchema = z.object({
    sourceId: z.union([z.string(), z.number()]),
    targetId: z.union([z.string(), z.number()]),
    user: z.string().optional()
}).passthrough();

export const pustakaGuideCreateSchema = z.object({
    title: z.string().min(1, 'title is required'),
    content: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    privacy: privacyEnum.nullable().optional(),
    allowed_depts: z.array(z.string()).nullable().optional(),
    allowed_users: z.array(z.string()).nullable().optional()
}).passthrough();

export const pustakaGuideUpdateSchema = pustakaGuideCreateSchema.partial();

export const pustakaSlideCreateSchema = z.object({
    guide_id: z.union([z.string(), z.number()]),
    title: z.string().min(1, 'title is required'),
    content: z.string().optional(),
    image_url: z.string().optional(),
    image: z.string().optional(),
    order_index: z.coerce.number().int().min(0).optional()
}).passthrough();

export const taxObjectUpsertSchema = z.object({
    code: z.string().min(1, 'code is required'),
    name: z.string().min(1, 'name is required'),
    tax_type: z.string().optional(),
    rate: z.coerce.number().optional(),
    note: z.string().optional(),
    is_pph21_bukan_pegawai: z.union([z.boolean(), z.number()]).optional(),
    use_ppn: z.union([z.boolean(), z.number()]).optional(),
    markup_mode: z.string().optional()
}).passthrough();

export const taxAuditUpsertSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    title: z.string().optional(),
    type: z.string().optional(),
    month: z.string().optional(),
    year: z.union([z.string(), z.number()]).optional(),
    startDate: z.string().optional(),
    steps: z.union([z.string(), z.array(z.any())]).optional(),
    status: z.string().optional()
}).passthrough();

export const taxAuditStatusSchema = z.object({
    status: z.string().min(1, 'status is required'),
    remarks: z.string().optional()
}).passthrough();

export const taxSummaryUpsertSchema = z.object({
    id: z.string().optional(),
    type: z.string().min(1, 'type is required'),
    month: z.string().min(1, 'month is required'),
    year: z.union([z.string(), z.number()]),
    pembetulan: z.coerce.number().optional(),
    data: z.union([z.string(), z.record(z.string(), z.any())]).optional()
}).passthrough();

export const taxWpUpsertSchema = z.object({
    name: z.string().min(1, 'name is required').optional()
}).passthrough();

export const taxAuditNoteSchema = z.object({
    user: z.string().optional(),
    text: z.string().min(1, 'text is required')
}).passthrough();

export function validateRequestBody(schema, req, res) {
    try {
        if (!schema || typeof schema.safeParse !== 'function') {
            res.status(500).json({ error: 'Internal validation error: invalid schema' });
            return null;
        }

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: parsed.error.issues.map((issue) => ({
                    path: issue.path.join('.') || '(root)',
                    message: issue.message
                }))
            });
            return null;
        }
        return parsed.data;
    } catch (err) {
        console.error('[validateRequestBody] Error:', err.message);
        res.status(500).json({
            error: 'Validation error',
            message: err.message
        });
        return null;
    }
}

export function validateBodyMiddleware(schema) {
    return (req, res, next) => {
        const data = validateRequestBody(schema, req, res);
        if (!data) return;
        req.body = data;
        next();
    };
}
