/**
 * ruleEngine.js
 * Halleyx Workflow Engine — Rule Evaluation Service
 *
 * Exports:
 *   evaluateCondition(condition, inputData)  → boolean
 *   getNextStep(rules, inputData)            → rule | null
 *   validateInputSchema(inputSchema, inputData) → { valid, errors? }
 *   validateRuleSyntax(condition_expr)       → { valid, error? }
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. evaluateCondition
//    Safely evaluates a condition string against a flat inputData object.
//    Supports: ==, !=, <, >, <=, >=, &&, ||
//              contains(field, "value")
//              startsWith(field, "prefix")
//              endsWith(field, "suffix")
//              DEFAULT  → always true
// ─────────────────────────────────────────────────────────────────────────────
function evaluateCondition(condition, inputData, alreadyMatched = false) {
  try {
    if (!condition || typeof condition !== 'string') return false;

    // ── SAFETY: Ensure inputData is a parsed object, not a JSON string ──
    let data = inputData;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = {}; }
    }
    if (!data || typeof data !== 'object') data = {};

    const trimmed = condition.trim();

    // DEFAULT rule only matches if no previous rule has matched
    if (trimmed.toUpperCase() === 'DEFAULT') {
      return !alreadyMatched;
    }

    let expr = trimmed;

    // ── Replace contains(field, "value") / contains(field, 'value') ──
    expr = expr.replace(
      /contains\(\s*(\w+)\s*,\s*(['"])(.*?)\2\s*\)/g,
      (_, field, __, value) => {
        const actual = data[field];
        if (actual === undefined || actual === null) return 'false';
        return String(actual).includes(value) ? 'true' : 'false';
      }
    );

    // ── Replace startsWith(field, "prefix") ──
    expr = expr.replace(
      /startsWith\(\s*(\w+)\s*,\s*(['"])(.*?)\2\s*\)/g,
      (_, field, __, value) => {
        const actual = data[field];
        if (actual === undefined || actual === null) return 'false';
        return String(actual).startsWith(value) ? 'true' : 'false';
      }
    );

    // ── Replace endsWith(field, "suffix") ──
    expr = expr.replace(
      /endsWith\(\s*(\w+)\s*,\s*(['"])(.*?)\2\s*\)/g,
      (_, field, __, value) => {
        const actual = data[field];
        if (actual === undefined || actual === null) return 'false';
        return String(actual).endsWith(value) ? 'true' : 'false';
      }
    );

    // ── Replace bare field names with their values ──
    // IMPORTANT: First, strip out quoted string literals so we don't
    // accidentally replace words inside them (e.g., 'Director' in
    // role_level == 'Director' is NOT a field name).
    const JS_KEYWORDS = new Set([
      'true', 'false', 'null', 'undefined', 'AND', 'OR',
      'if', 'else', 'return', 'var', 'let', 'const',
    ]);

    // Step A: Extract all quoted strings and replace with placeholders
    const stringLiterals = [];
    expr = expr.replace(/(['"])((?:(?!\1).)*)\1/g, (match) => {
      stringLiterals.push(match);
      return `__STR_${stringLiterals.length - 1}__`;
    });

    // Step B: Now safely replace bare field names (no quoted strings left)
    expr = expr.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match) => {
      if (JS_KEYWORDS.has(match)) return match;
      if (match in data) {
        const val = data[match];
        if (typeof val === 'string') return JSON.stringify(val); // wrap in quotes
        if (val === null || val === undefined) return 'null';
        return String(val); // number / boolean
      }
      return match; // unknown field → leave as-is
    });

    // Step C: Restore the original quoted strings
    expr = expr.replace(/__STR_(\d+)__/g, (_, idx) => stringLiterals[parseInt(idx)]);

    // ── Safety check: block dangerous patterns ──
    const DANGEROUS = /\b(eval|Function|require|process|global|__dirname|__filename|import|export|fetch|XMLHttpRequest|setTimeout|setInterval|constructor|prototype|__proto__)\b|\[[\s]*['"`]/;
    if (DANGEROUS.test(expr)) {
      console.warn('[ruleEngine] Blocked dangerous expression:', expr);
      return false;
    }

    // Block any remaining bracket notation access
    if (/\[.*\]/.test(expr.replace(/__STR_\d+__/g, ''))) {
      console.warn('[ruleEngine] Blocked bracket notation access:', expr);
      return false;
    }

    // ── Safe evaluation via new Function ──
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expr});`)();
    return Boolean(result);
  } catch (err) {
    console.warn('[ruleEngine] evaluateCondition error:', err.message, '| expr:', condition);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. getNextStep
//    Sorts rules by priority ASC, evaluates each one,
//    logs every result, and returns the first matched rule.
// ─────────────────────────────────────────────────────────────────────────────
function getNextStep(rules, inputData) {
  if (!Array.isArray(rules) || rules.length === 0) return null;

  // Sort by priority ascending (lowest number = evaluated first)
  const sorted = [...rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  let matched = null;

  for (const rule of sorted) {
    const result = evaluateCondition(rule.condition_expr, inputData, matched !== null);

    console.log(
      `[ruleEngine] Rule "${rule.condition_expr}" (priority ${rule.priority}) → ${result}`
    );

    if (result && !matched) {
      matched = rule;
      // Don't break — continue logging all remaining rules
    }
  }

  return matched || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. validateInputSchema
//    Validates user-supplied inputData against the workflow's input_schema.
//    Schema format (JSON):
//      {
//        "fields": [
//          { "name": "amount",  "type": "number",  "required": true },
//          { "name": "country", "type": "string",  "required": true,
//            "allowed_values": ["US", "UK", "IN"] }
//        ]
//      }
// ─────────────────────────────────────────────────────────────────────────────
function validateInputSchema(inputSchema, inputData) {
  const errors = [];

  if (!inputSchema || !Array.isArray(inputSchema.fields)) {
    // No schema defined → pass everything
    return { valid: true };
  }

  for (const field of inputSchema.fields) {
    const { name, type, required, allowed_values } = field;
    const value = inputData[name];

    // ── Required check ──
    if (required && (value === undefined || value === null || value === '')) {
      errors.push(`Field "${name}" is required but missing.`);
      continue; // skip further checks for this field
    }

    if (value === undefined || value === null) continue; // optional field absent → ok

    // ── Type check ──
    if (type) {
      const actualType = typeof value;
      if (type === 'number' && actualType !== 'number') {
        errors.push(`Field "${name}" must be a number, got ${actualType}.`);
      } else if (type === 'string' && actualType !== 'string') {
        errors.push(`Field "${name}" must be a string, got ${actualType}.`);
      } else if (type === 'boolean' && actualType !== 'boolean') {
        errors.push(`Field "${name}" must be a boolean, got ${actualType}.`);
      }
    }

    // ── Allowed values check ──
    if (Array.isArray(allowed_values) && allowed_values.length > 0) {
      if (!allowed_values.includes(value)) {
        errors.push(
          `Field "${name}" value "${value}" is not in allowed values: [${allowed_values.join(', ')}].`
        );
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. validateRuleSyntax
//    Quick static validation of a condition_expr before it's saved to DB.
//    Checks for clearly invalid operator patterns and empty expressions.
// ─────────────────────────────────────────────────────────────────────────────
function validateRuleSyntax(condition_expr) {
  if (!condition_expr || typeof condition_expr !== 'string') {
    return { valid: false, error: 'condition_expr must be a non-empty string.' };
  }

  const trimmed = condition_expr.trim();

  if (trimmed === '') {
    return { valid: false, error: 'condition_expr cannot be blank.' };
  }

  // DEFAULT is always valid
  if (trimmed.toUpperCase() === 'DEFAULT') {
    return { valid: true };
  }

  // ── Block invalid operators ──
  const INVALID_OPERATORS = [
    { pattern: />>(?!=)/, label: '>>' },
    { pattern: /<<(?!=)/, label: '<<' },
    { pattern: /={3}/, label: '===' },   // strict equality not supported
    { pattern: /!={2}/, label: '!==' },  // strict inequality not supported
    { pattern: /\*\*/, label: '**' },
    { pattern: /^\s*=(?!=)/, label: 'bare assignment =' },
  ];

  for (const { pattern, label } of INVALID_OPERATORS) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: `Invalid operator "${label}" in condition.` };
    }
  }

  // ── Block dangerous keywords ──
  const DANGEROUS = /\b(eval|Function|require|process|global|fetch|import|export)\b/;
  if (DANGEROUS.test(trimmed)) {
    return { valid: false, error: 'condition_expr contains forbidden keywords.' };
  }

  // ── Try a dry-run parse with dummy data to catch syntax errors ──
  try {
    // Replace all identifiers with 1 (numeric dummy)
    let dummyExpr = trimmed
      .replace(/contains\s*\([^)]+\)/g, 'true')
      .replace(/startsWith\s*\([^)]+\)/g, 'true')
      .replace(/endsWith\s*\([^)]+\)/g, 'true')
      .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (m) => {
        const KEEP = new Set(['true', 'false', 'null', 'AND', 'OR']);
        return KEEP.has(m) ? m : '1';
      });

    // Replace string literals with empty string placeholders
    dummyExpr = dummyExpr.replace(/(['"])[^'"]*\1/g, '""');

    // eslint-disable-next-line no-new-func
    new Function(`"use strict"; return (${dummyExpr});`);
  } catch (parseErr) {
    return { valid: false, error: `Syntax error in condition: ${parseErr.message}` };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  evaluateCondition,
  getNextStep,
  validateInputSchema,
  validateRuleSyntax,
};
