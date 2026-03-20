import { parseJsonObjectSafe } from '../utils/jsonSafe.js';

export const up = async (knex) => {
    // 1. Add 'attachment' column if it doesn't exist
    const hasAttachment = await knex.schema.hasColumn('comments', 'attachment');
    if (!hasAttachment) {
        await knex.schema.table('comments', (table) => {
            table.text('attachment').nullable();
        });
    }

    // 2. Migrate existing data from separate columns to JSON string in 'attachment'
    // check if old columns exist before trying to read them
    const hasOldUrl = await knex.schema.hasColumn('comments', 'attachmentUrl');
    if (hasOldUrl) {
        const rows = await knex('comments').select('*');
        for (const row of rows) {
            // Only migrate if attachment is empty and we have old data
            if (!row.attachment && row.attachmentUrl) {
                const attachment = JSON.stringify({
                    name: row.attachmentName || 'Attachment',
                    url: row.attachmentUrl,
                    type: row.attachmentType || 'application/octet-stream',
                    size: row.attachmentSize || ''
                });
                await knex('comments')
                    .where('id', row.id)
                    .update({ attachment });
            }
        }
    }

    // 3. Fix ID type
    const columnInfo = await knex('comments').columnInfo('id');
    if (columnInfo.type !== 'varchar' && columnInfo.type !== 'string' && columnInfo.type !== 'character varying') {
        console.log('Converting ID to VARCHAR(50)...');
        if (knex.client.config.client === 'pg') {
            await knex.raw('ALTER TABLE comments ALTER COLUMN id DROP DEFAULT');
            await knex.raw('ALTER TABLE comments ALTER COLUMN id TYPE VARCHAR(50) USING id::VARCHAR');
        } else {
            await knex.schema.alterTable('comments', table => {
                table.string('id', 50).notNullable().alter();
            });
        }
    }

    // 4. Drop old columns if they exist
    await knex.schema.table('comments', (table) => {
        if (hasOldUrl) table.dropColumn('attachmentUrl');
    });
    const hasOldName = await knex.schema.hasColumn('comments', 'attachmentName');
    if (hasOldName) {
        await knex.schema.table('comments', (table) => {
            table.dropColumn('attachmentName');
        });
    }
    const hasOldType = await knex.schema.hasColumn('comments', 'attachmentType');
    if (hasOldType) {
        await knex.schema.table('comments', (table) => {
            table.dropColumn('attachmentType');
        });
    }
    const hasOldSize = await knex.schema.hasColumn('comments', 'attachmentSize');
    if (hasOldSize) {
        await knex.schema.table('comments', (table) => {
            table.dropColumn('attachmentSize');
        });
    }
};

export const down = async (knex) => {
    console.warn('⚠️  [MIGRATION DOWN] fix_comments_table_schema: Restoring old comment attachment columns');

    if (!(await knex.schema.hasTable('comments'))) return;

    // Restore old columns if they don't already exist
    const colsToAdd = {
        attachmentUrl: 'text',
        attachmentName: 'text',
        attachmentType: 'string',
        attachmentSize: 'string'
    };
    for (const [col, type] of Object.entries(colsToAdd)) {
        if (!(await knex.schema.hasColumn('comments', col))) {
            await knex.schema.table('comments', (table) => {
                if (type === 'text') table.text(col).nullable();
                else table.string(col, col === 'attachmentType' ? 100 : 50).nullable();
            });
        }
    }

    // Migrate data back from JSON 'attachment' to individual columns
    if (await knex.schema.hasColumn('comments', 'attachment')) {
        const rows = await knex('comments').select('*');
        for (const row of rows) {
            if (row.attachment) {
                const data = parseJsonObjectSafe(row.attachment, null);
                if (data) {
                    await knex('comments').where('id', row.id).update({
                        attachmentUrl: data.url,
                        attachmentName: data.name,
                        attachmentType: data.type,
                        attachmentSize: data.size
                    });
                }
            }
        }

        await knex.schema.table('comments', (table) => {
            table.dropColumn('attachment');
        });
    }
};
