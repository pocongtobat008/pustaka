
export const up = async (knex) => {
    // Add visual_config to approval_flows to store React Flow data
    if (await knex.schema.hasTable('approval_flows')) {
        const hasVisualConfig = await knex.schema.hasColumn('approval_flows', 'visual_config');
        if (!hasVisualConfig) {
            await knex.schema.table('approval_flows', (table) => {
                table.text('visual_config', 'longtext');
            });
        }
    }

    // Add flow_id to document_approvals to link with the template
    if (await knex.schema.hasTable('document_approvals')) {
        const hasFlowId = await knex.schema.hasColumn('document_approvals', 'flow_id');
        if (!hasFlowId) {
            await knex.schema.table('document_approvals', (table) => {
                table.integer('flow_id').unsigned();
            });
        }
    }

    // Add node_id to approval_steps to track position in the graph
    if (await knex.schema.hasTable('approval_steps')) {
        const hasNodeId = await knex.schema.hasColumn('approval_steps', 'node_id');
        if (!hasNodeId) {
            await knex.schema.table('approval_steps', (table) => {
                table.string('node_id', 100);
            });
        }
    }
};

export const down = async (knex) => {
    console.warn('⚠️  [MIGRATION DOWN] add_visual_workflow: Removing visual workflow columns');

    if (await knex.schema.hasTable('approval_flows')) {
        if (await knex.schema.hasColumn('approval_flows', 'visual_config')) {
            await knex.schema.table('approval_flows', (table) => {
                table.dropColumn('visual_config');
            });
        }
    }

    if (await knex.schema.hasTable('document_approvals')) {
        if (await knex.schema.hasColumn('document_approvals', 'flow_id')) {
            await knex.schema.table('document_approvals', (table) => {
                table.dropColumn('flow_id');
            });
        }
    }

    if (await knex.schema.hasTable('approval_steps')) {
        if (await knex.schema.hasColumn('approval_steps', 'node_id')) {
            await knex.schema.table('approval_steps', (table) => {
                table.dropColumn('node_id');
            });
        }
    }
};
