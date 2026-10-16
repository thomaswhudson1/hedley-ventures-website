// Unit tests for enquiry source classification. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyChannel, readSource } from '../src/source.js';

test('referring sites map to channels', () => {
  assert.equal(classifyChannel({ referrer: 'www.linkedin.com' }), 'LinkedIn');
  assert.equal(classifyChannel({ referrer: 'lnkd.in' }), 'LinkedIn');
  assert.equal(classifyChannel({ referrer: 'com.linkedin.android' }), 'LinkedIn');
  assert.equal(classifyChannel({ referrer: 'www.google.co.uk' }), 'Google search');
  assert.equal(classifyChannel({ referrer: 'com.google.android.googlequicksearchbox' }), 'Google search');
  assert.equal(classifyChannel({ referrer: 'www.bing.com' }), 'Other search');
  assert.equal(classifyChannel({ referrer: 'duckduckgo.com' }), 'Other search');
  assert.equal(classifyChannel({ referrer: 'l.facebook.com' }), 'Other social');
  assert.equal(classifyChannel({ referrer: 't.co' }), 'Other social');
  assert.equal(classifyChannel({ referrer: 'outlook.live.com' }), 'Email');
  assert.equal(classifyChannel({ referrer: 'www.pwc.co.uk' }), 'Referral');
  assert.equal(classifyChannel({}), 'Direct / unknown');
});

test('campaign tags take priority over the referrer', () => {
  assert.equal(classifyChannel({ referrer: '', utmSource: 'linkedin', utmMedium: 'social' }), 'LinkedIn');
  assert.equal(classifyChannel({ referrer: 'www.google.com', utmSource: 'google', utmMedium: 'cpc' }), 'Google Ads');
  assert.equal(classifyChannel({ utmSource: 'newsletter', utmMedium: 'email' }), 'Email');
  assert.equal(classifyChannel({ utmSource: 'eisa-seminar' }), 'Campaign');
});

test('untrusted source data is cleaned, never rejected', () => {
  assert.deepEqual(readSource(null), { channel: 'Direct / unknown', referrer: null, landing: null, utmSource: null, utmMedium: null, utmCampaign: null });
  const s = readSource({ referrer: 'evil<script>.com', landing: 'javascript:alert(1)', utmSource: 'x'.repeat(500), utmCampaign: 'oct-post' });
  assert.equal(s.referrer, null);
  assert.equal(s.landing, null);
  assert.equal(s.utmSource.length, 100);
  assert.equal(s.utmCampaign, 'oct-post');
  assert.equal(readSource({ referrer: 'hedleyventures.com' }).referrer, null, 'own site is not a referrer');
  assert.equal(readSource({ referrer: 'www.linkedin.com', landing: '/services/' }).landing, '/services/');
});
