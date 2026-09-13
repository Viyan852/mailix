/**
 * DNS Verification Routes
 *
 * Verifies domain ownership, SPF, DKIM, DMARC records.
 * Only marks a domain as verified when the required DNS records exist.
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, ROLES } = require('../utils/auth');
const { validateId, validateDomain } = require('../utils/validation');
const db = require('../db');
const logger = require('../utils/logger');
const dns = require('dns').promises;

async function queryTxt(hostname) {
  try {
    const records = await dns.resolveTxt(hostname);
    return records.flat();
  } catch (err) {
    return [];
  }
}

async function verifyDomainRecords(domain) {
  const result = {
    spf: false,
    dkim: false,
    dmarc: false,
    ownership: false,
    details: {},
  };

  // Ownership: check for a Mailix verification TXT record
  const ownershipRecords = await queryTxt(`_mailix-verify.${domain}`);
  result.ownership = ownershipRecords.some(r => r.includes('mailix-verify='));
  result.details.ownership = ownershipRecords;

  // SPF: TXT record at the root
  const spfRecords = await queryTxt(domain);
  result.spf = spfRecords.some(r => r.toLowerCase().includes('v=spf1'));
  result.details.spf = spfRecords;

  // DKIM: TXT record at default selector
  const dkimRecords = await queryTxt(`mailix._domainkey.${domain}`);
  result.dkim = dkimRecords.some(r => r.toLowerCase().includes('v=dkim1'));
  result.details.dkim = dkimRecords;

  // DMARC: TXT record at _dmarc
  const dmarcRecords = await queryTxt(`_dmarc.${domain}`);
  result.dmarc = dmarcRecords.some(r => r.toLowerCase().includes('v=dmarc1'));
  result.details.dmarc = dmarcRecords;

  return result;
}

router.post('/:id/verify', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const record = await db.findById('domains', id);
    if (!record) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Domain not found' } });
    }

    const verification = await verifyDomainRecords(record.domain);
    const allOk = verification.ownership && verification.spf && verification.dkim && verification.dmarc;
    const status = allOk ? 'verified' : (verification.ownership ? 'partial' : 'pending');

    const updates = {
      spf_status: verification.spf,
      dkim_status: verification.dkim,
      dmarc_status: verification.dmarc,
      ownership_status: verification.ownership,
      status,
      last_checked: new Date().toISOString(),
      verification_details: verification.details,
    };
    await db.update('domains', id, updates);
    res.json({ domain: { ...record, ...updates } });
  } catch (err) {
    logger.error('DNS verification failed', { error: err.message });
    next(err);
  }
});

module.exports = router;
