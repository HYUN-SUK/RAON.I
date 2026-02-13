const fs = require('fs');
const path = require('path');

const migrationsDir = 'supabase/migrations';
// Scan all SQL files
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

function fixContent(content, fileName) {
    let newContent = content;

    // 1. Fix Policies (Existing logic + improvements)
    // DROP POLICY IF EXISTS "Name" ON table;
    const policyRegex = /CREATE POLICY\s+"([^"]+)"\s+ON\s+(["\w\.]+)/gi;
    newContent = newContent.replace(policyRegex, (match, policyName, tableName) => {
        // Avoid double dropping if already present
        if (newContent.includes(`DROP POLICY IF EXISTS "${policyName}" ON ${tableName}`)) return match;
        return `DROP POLICY IF EXISTS "${policyName}" ON ${tableName};\n${match}`;
    });

    // 2. Fix Tables
    // CREATE TABLE IF NOT EXISTS
    const tableRegex = /CREATE TABLE\s+(?!IF NOT EXISTS)(["\w\.]+)/gi;
    newContent = newContent.replace(tableRegex, (match, tableName) => {
        return `CREATE TABLE IF NOT EXISTS ${tableName}`;
    });

    // 3. Fix Triggers
    // DROP TRIGGER IF EXISTS name ON table;
    // Pattern: CREATE TRIGGER name [BEFORE|AFTER] [INSERT|UPDATE|DELETE] ON table
    // We need to capture trigger name and table name
    const triggerRegex = /CREATE TRIGGER\s+([\w_]+)\s+(?:BEFORE|AFTER|INSTEAD OF)\s+.*?\s+ON\s+(["\w\.]+)/gi;
    newContent = newContent.replace(triggerRegex, (match, triggerName, tableName) => {
        if (newContent.includes(`DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName}`)) return match;
        return `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\n${match}`;
    });

    // 4. Fix Add Columns
    // ALTER TABLE table ADD COLUMN (without IF NOT EXISTS)
    // This is tricky because "ADD COLUMN" might be followed by many things.
    // Regex: ALTER TABLE table ADD COLUMN name type ...
    // Note: Some migrations use "ADD COLUMN IF NOT EXISTS", we skip those.
    // 4. Fix Add Columns (Enhanced)
    // Matches "ADD COLUMN name" or ", ADD COLUMN name" (chained)
    // Regex: (ADD COLUMN\s+)(?!IF NOT EXISTS)(["\w\.]+)
    // We replace with "ADD COLUMN IF NOT EXISTS name"
    // Note: This is safer than finding just "ADD COLUMN" because we check for negative lookahead.
    const addColumnRegex = /(ADD COLUMN\s+)(?!IF NOT EXISTS)(["\w\.]+)/gi;
    newContent = newContent.replace(addColumnRegex, (match, prefix, colName) => {
        return `${prefix}IF NOT EXISTS ${colName}`;
    });

    // 5. Fix Types (Enums) - Basic wrapper
    // CREATE TYPE name AS ENUM ...
    // Regex needs to handle multiline.
    // We'll wrap the whole statement in a DO block.
    // Challenge: Finding the end of the statement (;).
    // Simplifying assumption: CREATE TYPE ... ;
    const typeRegex = /(CREATE TYPE\s+([\w_]+)\s+AS\s+ENUM\s*\([^;]+\);)/gsi; // s flag for dotAll not supported in some older nodes, but usually ok. trying [\s\S]
    // fallback regex for multiline
    const typeRegexSafe = /(CREATE TYPE\s+([\w_]+)\s+AS\s+ENUM\s*\([\s\S]*?\);)/gi;

    newContent = newContent.replace(typeRegexSafe, (match, fullStatement, typeName) => {
        if (newContent.includes(`DO $$ BEGIN\n    CREATE TYPE ${typeName}`)) return match; // Already wrapped check (rough)

        return `DO $$ BEGIN
    ${fullStatement}
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;`;
    });

    // 6. Fix Constraints (ADD CONSTRAINT)
    // ALTER TABLE table ADD CONSTRAINT name ...
    // Regex: ALTER TABLE table ADD CONSTRAINT name ... ;
    // We wrap this in DO block.
    // Note: This regex assumes the constraint addition ends with ;
    const constraintRegex = /ALTER TABLE\s+["\w\.]+\s+ADD CONSTRAINT\s+["\w\.]+\s+[^;]+;/gi;
    newContent = newContent.replace(constraintRegex, (match) => {
        if (newContent.includes(`DO $$ BEGIN\n    ${match}`)) return match;

        return `DO $$ BEGIN
    ${match}
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;`;
    });

    // 7. Upgrade Exception Handling (Global)
    // Some constraints throw 'duplicate_table' (42P07) instead of 'duplicate_object' (42710)
    // We update the exception block to catch both.
    const exceptionRegex = /WHEN duplicate_object THEN null;\s*END \$\$;/gi;
    newContent = newContent.replace(exceptionRegex, `WHEN duplicate_object THEN null;
    WHEN duplicate_table THEN null;
END $$;`);

    // 8. Fix Indexes (CREATE INDEX)
    // CREATE [UNIQUE] INDEX [name] ON table ...
    // Regex: CREATE (UNIQUE )?INDEX\s+(?!IF NOT EXISTS)([\w_]+)\s+ON
    // We add IF NOT EXISTS
    const indexRegex = /(CREATE\s+(?:UNIQUE\s+)?INDEX\s+)(?!IF NOT EXISTS)([\w_]+)(\s+ON)/gi;
    newContent = newContent.replace(indexRegex, (match, prefix, indexName, suffix) => {
        return `${prefix}IF NOT EXISTS ${indexName}${suffix}`;
    });

    // 9. Fix Functions (CREATE OR REPLACE FUNCTION)
    // Postgres cannot change return type with CREATE OR REPLACE.
    // We prepend DROP FUNCTION IF EXISTS funcname(arg_types) before each.
    // Regex: CREATE OR REPLACE FUNCTION funcname(args...)
    // We need to extract function name and argument types only (no param names).
    const funcRegex = /CREATE OR REPLACE FUNCTION\s+([\w_\.]+)\s*\(([^)]*)\)/gi;
    newContent = newContent.replace(funcRegex, (match, funcName, argsStr) => {
        // Extract just the types from args (e.g., "p_post_id UUID, p_user_id UUID" -> "UUID, UUID")
        const argTypes = argsStr
            .split(',')
            .map(a => a.trim())
            .filter(a => a.length > 0)
            .map(a => {
                // Each arg is like "p_name TYPE" or "p_name TYPE DEFAULT val" or just "TYPE"
                const parts = a.split(/\s+/);
                if (parts.length >= 2) {
                    // Could be "name TYPE ..." -> take second part
                    // Or "INOUT name TYPE" -> take third part
                    const upperFirst = parts[0].toUpperCase();
                    if (['IN', 'OUT', 'INOUT', 'VARIADIC'].includes(upperFirst)) {
                        return parts.length >= 3 ? parts[2] : parts[1];
                    }
                    return parts[1];
                }
                return parts[0]; // Just a type name
            })
            .join(', ');

        const dropStmt = `DROP FUNCTION IF EXISTS ${funcName}(${argTypes}) CASCADE;`;

        // Avoid double-dropping
        if (newContent.includes(dropStmt) || newContent.includes(`DROP FUNCTION IF EXISTS ${funcName}(`)) {
            return match;
        }

        return `${dropStmt}\n${match}`;
    });

    return newContent;
}


files.forEach(file => {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    try {
        const fixed = fixContent(content, file);
        if (fixed !== content) {
            fs.writeFileSync(filePath, fixed, 'utf8');
            console.log(`Fixed ${file}`);
        }
    } catch (e) {
        console.error(`Error processing ${file}:`, e);
    }
});
