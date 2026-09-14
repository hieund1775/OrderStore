/**
 * Removes SQL regions that cannot execute statements before checking a
 * read-only contract. The helper is deliberately test-only: migration SQL is
 * never rewritten or executed through it.
 */
export function stripSqlCommentsAndLiterals(sql) {
  return String(sql)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\$[A-Za-z_][A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z_][A-Za-z0-9_]*\$/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, "''");
}

export function hasExecutableMutationStatement(sql) {
  const executable = stripSqlCommentsAndLiterals(sql);
  return /(?:^|;)\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/im.test(executable);
}
