/**
 * MAILIX Input Validation
 *
 * Centralized, strict input validation with consistent error responses.
 */

const SAFE_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const SAFE_DOMAIN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
const SAFE_NAME = /^[a-zA-Z0-9 _.'-]{1,100}$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_PREFIX = /^[a-zA-Z0-9_-]{1,32}$/;

const MAX_LENGTHS = {
  email: 254,
  name: 100,
  subject: 998, // RFC 5322 limit
  html: 1024 * 1024, // 1MB
  text: 1024 * 1024,
  projectId: 64,
  domain: 253,
  apiKey: 256,
  campaignName: 200,
  fromName: 100,
  fromEmail: 254,
  replyTo: 254,
};

class ValidationError extends Error {
  constructor(message, code = 'INVALID_REQUEST', field) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = field;
    this.statusCode = 400;
  }
}

function checkString(value, field, max) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string`, 'INVALID_TYPE', field);
  }
  if (value.length === 0) {
    throw new ValidationError(`${field} is required`, 'REQUIRED', field);
  }
  if (max && value.length > max) {
    throw new ValidationError(`${field} exceeds maximum length of ${max}`, 'TOO_LONG', field);
  }
  return value;
}

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= MAX_LENGTHS.email && SAFE_EMAIL.test(email);
}

function isValidDomain(domain) {
  return typeof domain === 'string' && domain.length <= MAX_LENGTHS.domain && SAFE_DOMAIN.test(domain);
}

function isValidName(name) {
  return typeof name === 'string' && name.length <= MAX_LENGTHS.name && SAFE_NAME.test(name);
}

function isValidId(id) {
  return typeof id === 'string' && SAFE_ID.test(id);
}

function validateEmail(email, field = 'email') {
  checkString(email, field, MAX_LENGTHS.email);
  if (!isValidEmail(email)) {
    throw new ValidationError(`Invalid ${field} address`, 'INVALID_EMAIL', field);
  }
  return email.toLowerCase();
}

function validateDomain(domain, field = 'domain') {
  checkString(domain, field, MAX_LENGTHS.domain);
  if (!isValidDomain(domain)) {
    throw new ValidationError(`Invalid ${field}`, 'INVALID_DOMAIN', field);
  }
  return domain.toLowerCase();
}

function validateName(name, field = 'name') {
  checkString(name, field, MAX_LENGTHS.name);
  if (!isValidName(name)) {
    throw new ValidationError(`Invalid ${field}`, 'INVALID_NAME', field);
  }
  return name;
}

function validateId(id, field = 'id') {
  checkString(id, field, MAX_LENGTHS.projectId);
  if (!isValidId(id)) {
    throw new ValidationError(`Invalid ${field}`, 'INVALID_ID', field);
  }
  return id;
}

function validateSubject(subject) {
  return checkString(subject, 'subject', MAX_LENGTHS.subject);
}

function validateHtml(html) {
  if (html === undefined || html === null) return null;
  if (typeof html !== 'string') {
    throw new ValidationError('html must be a string', 'INVALID_TYPE', 'html');
  }
  if (html.length > MAX_LENGTHS.html) {
    throw new ValidationError('html exceeds maximum size', 'TOO_LARGE', 'html');
  }
  return html;
}

function validateScopes(scopes) {
  if (!scopes) return [];
  if (!Array.isArray(scopes)) {
    throw new ValidationError('scopes must be an array', 'INVALID_TYPE', 'scopes');
  }
  const allowed = [
    'email:send', 'email:read',
    'templates:read', 'templates:write',
    'analytics:read',
    'subscribers:read', 'subscribers:write',
    'newsletters:send', 'newsletters:read',
    'projects:read', 'projects:write',
  ];
  for (const s of scopes) {
    if (!allowed.includes(s)) {
      throw new ValidationError(`Unknown scope: ${s}`, 'INVALID_SCOPE', 'scopes');
    }
  }
  return scopes;
}

function validatePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

function validateSort(query, allowedFields) {
  const sort = query.sort || 'created_at';
  if (!allowedFields.includes(sort)) {
    throw new ValidationError(`Cannot sort by ${sort}`, 'INVALID_SORT', 'sort');
  }
  const order = (query.order || 'desc').toLowerCase();
  if (order !== 'asc' && order !== 'desc') {
    throw new ValidationError('order must be asc or desc', 'INVALID_ORDER', 'order');
  }
  return { sort, order };
}

module.exports = {
  ValidationError,
  isValidEmail,
  isValidDomain,
  isValidName,
  isValidId,
  validateEmail,
  validateDomain,
  validateName,
  validateId,
  validateSubject,
  validateHtml,
  validateScopes,
  validatePagination,
  validateSort,
  checkString,
  MAX_LENGTHS,
};
