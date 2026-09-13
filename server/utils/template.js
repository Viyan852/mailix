/**
 * MAILIX Safe Template Renderer
 *
 * Renders {{variable}} placeholders while preventing template injection,
 * XSS in email previews, and arbitrary code execution.
 *
 * - HTML mode: escapes variable values for safe interpolation into HTML
 * - Text mode: strips control characters
 * - Malformed placeholders (e.g. {{bad name}}, {{__proto__}}) throw
 *   ValidationError — the template is rejected rather than silently
 *   rendered with the literal placeholder.
 */

const { ValidationError } = require('./validation');

const VARIABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
const PLACEHOLDER = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]{0,63})\s*\}\}/g;
const MALFORMED_PLACEHOLDER = /\{\{[^}]*\}\}/g;

// Names that are syntactically valid JS identifiers but unsafe as template
// variables because of prototype-pollution / object-constructor concerns.
const FORBIDDEN_NAMES = new Set([
  '__proto__', 'constructor', 'prototype', 'hasOwnProperty',
  'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf',
]);

const HTML_ESCAPE = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`=\/]/g, (c) => HTML_ESCAPE[c]);
}

function escapeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
}

function validateVariables(vars) {
  if (!vars || typeof vars !== 'object') return {};
  const result = {};
  for (const [key, value] of Object.entries(vars)) {
    if (!VARIABLE_NAME.test(key)) {
      throw new ValidationError(`Invalid variable name: ${key}`, 'INVALID_VARIABLE', key);
    }
    if (typeof value === 'string' && value.length > 10000) {
      throw new ValidationError(`Variable ${key} too large`, 'TOO_LARGE', key);
    }
    result[key] = value;
  }
  return result;
}

function render(template, vars = {}, mode = 'html') {
  if (typeof template !== 'string') {
    throw new ValidationError('Template must be a string', 'INVALID_TYPE', 'template');
  }
  if (template.length > 1024 * 1024) {
    throw new ValidationError('Template too large', 'TOO_LARGE', 'template');
  }

  // First: detect malformed placeholders (anything matching {{...}} that
  // does not match the strict valid pattern). Reject these explicitly.
  const malformed = template.match(MALFORMED_PLACEHOLDER);
  if (malformed) {
    for (const m of malformed) {
      const inner = m.slice(2, -2).trim();
      if (!VARIABLE_NAME.test(inner)) {
        throw new ValidationError(`Malformed template placeholder: ${m}`, 'INVALID_VARIABLE', m);
      }
      if (FORBIDDEN_NAMES.has(inner)) {
        throw new ValidationError(`Forbidden template variable name: ${inner}`, 'FORBIDDEN_VARIABLE', m);
      }
    }
  }

  const safeVars = validateVariables(vars);
  const escaper = mode === 'html' ? escapeHtml : escapeText;
  return template.replace(PLACEHOLDER, (match, name) => {
    return escaper(safeVars[name] !== undefined ? safeVars[name] : '');
  });
}

module.exports = { render, escapeHtml, escapeText, validateVariables };
