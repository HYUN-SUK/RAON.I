import { createClient } from '../src/lib/supabase-client';
import { mapLegacyTagToId } from '../src/lib/tags';

async function migrateLegacyPersonas() {
    console.log('--- Starting Persona Migration v1.0 ---');
    const supabase = createClient();

    // 1. 기존 데이터 가져오기
    const { data: legacyUsers, error: fetchError } = await supabase
        .from('user_personas')
        .select('user_id, tags');

    if (fetchError) {
        console.error('Error fetching legacy personas:', fetchError);
        return;
    }

    console.log(`Found ${legacyUsers?.length || 0} users to migrate.`);

    for (const user of (legacyUsers || [])) {
        const userId = user.user_id;
        const tags: Record<string, number> = user.tags || {};
        const ledgerEntries = [];

        for (const [legacyTag, score] of Object.entries(tags)) {
            const tagId = mapLegacyTagToId(legacyTag);
            
            ledgerEntries.push({
                user_id: userId,
                tag_id: tagId,
                delta_score: score,
                source_type: 'LEGACY_MIGRATION',
                reason: `Initial migration from legacy tag: ${legacyTag}`
            });
        }

        if (ledgerEntries.length > 0) {
            console.log(`Migrating ${ledgerEntries.length} tags for user ${userId}...`);
            const { error: insertError } = await supabase
                .from('user_tag_ledger')
                .insert(ledgerEntries);

            if (insertError) {
                console.error(`Failed to migrate user ${userId}:`, insertError);
            }
        }
    }

    console.log('--- Migration Completed ---');
}

migrateLegacyPersonas();
