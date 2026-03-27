import { parseJsonObjectSafe } from '../utils/jsonSafe.js';

export const up = async (knex) => {
    const boxCount = await knex('boxes').count('id as count').first();
    if (boxCount.count > 0) return; // Already populated

    console.log("Migrating legacy inventory data to relational tables...");
    const inventoryRows = await knex('inventory').whereNot('status', 'EMPTY').select('id', 'box_data');

    for (const row of inventoryRows) {
        if (!row.box_data) continue;
        const data = parseJsonObjectSafe(row.box_data, null);

        if (!data || !data.id) continue;

        const [resBox] = await knex('boxes').insert({
            inventory_id: row.id,
            box_id: data.id
        }).returning('id');
        const boxRefId = typeof resBox === 'object' ? resBox.id : resBox;

        if (data.ordners && Array.isArray(data.ordners)) {
            for (const ord of data.ordners) {
                const [resOrd] = await knex('ordners').insert({
                    box_ref_id: boxRefId,
                    no_ordner: ord.noOrdner || '',
                    period: ord.period || ''
                }).returning('id');
                const ordnerRefId = typeof resOrd === 'object' ? resOrd.id : resOrd;

                if (ord.invoices && Array.isArray(ord.invoices)) {
                    const invoicesToInsert = ord.invoices.map(inv => ({
                        ordner_ref_id: ordnerRefId,
                        invoice_no: inv.invoiceNo || '',
                        vendor: inv.vendor || '',
                        payment_date: inv.paymentDate || null,
                        file_url: inv.file || '',
                        file_name: inv.fileName || '',
                        ocr_content: inv.ocrContent || ''
                    }));

                    if (invoicesToInsert.length > 0) {
                        await knex('invoices').insert(invoicesToInsert);
                    }
                }
            }
        }
    }
    console.log("Legacy data migration complete.");
};

export const down = async (knex) => {
    // We don't necessarily want to delete migrated data on rollback
    // unless we're strictly reverting the whole relational schema.
};
