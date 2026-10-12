// Hedley Ventures — transaction data.
// Each entry becomes one transaction card. The homepage shows entries with `featured: true` (up to four);
// the Deals page can show every entry using the same card component (see renderTransactionCard in site.js).
//
// Fields
//   company            Company name (also used as the logo's alt text)
//   companyLogo        { src, width, height, displayHeight } — displayHeight is the logo's height on the card, in px
//   amount             Large figure on the card, e.g. "£3.5m" or "Acquired"
//   type               Transaction type, e.g. "Growth capital investment"
//   counterpartyLabel  Text above the investor/acquirer logo, e.g. "Investment from" or "Acquired by"
//   counterparty       Investor or acquirer name (also the logo's alt text)
//   counterpartyLogo   { src, width, height, displayHeight }
//   sector             Optional, e.g. "Software" (null if not used)
//   year               Optional, e.g. 2022 (null if not used)
//   description        Optional short description; replaces `type` on the card when provided
//   link               Optional URL; makes the whole card clickable
//   featured           true = eligible for the homepage
//
// Only add details that are confirmed and approved for publication.

window.HEDLEY_TRANSACTIONS = [
  {
    company: 'Quality Clouds',
    companyLogo: { src: '/assets/proof/quality-clouds.png', width: 612, height: 93, displayHeight: 28 },
    amount: '£3.5m',
    type: 'Growth capital investment',
    counterpartyLabel: 'Investment from',
    counterparty: 'YFM Equity Partners',
    counterpartyLogo: { src: '/assets/proof/yfm.png', width: 348, height: 176, displayHeight: 46 },
    sector: null,
    year: null,
    description: null,
    link: null,
    featured: true
  },
  {
    company: 'Secretarium',
    companyLogo: { src: '/assets/proof/secretarium.png', width: 646, height: 92, displayHeight: 27 },
    amount: '£5m',
    type: 'Growth capital investment',
    counterpartyLabel: 'Investment from',
    counterparty: 'IQ Capital',
    counterpartyLogo: { src: '/assets/proof/iq-capital.png', width: 459, height: 84, displayHeight: 25 },
    sector: null,
    year: null,
    description: null,
    link: null,
    featured: true
  },
  {
    company: 'Plumm',
    companyLogo: { src: '/assets/proof/plumm.png', width: 375, height: 103, displayHeight: 34 },
    amount: '£2.2m',
    type: 'Growth capital investment',
    counterpartyLabel: 'Investment from',
    counterparty: 'IW Capital',
    counterpartyLogo: { src: '/assets/proof/iw-capital.png', width: 462, height: 65, displayHeight: 21 },
    sector: null,
    year: null,
    description: null,
    link: null,
    featured: true
  },
  {
    company: 'WalkUp',
    companyLogo: { src: '/assets/proof/walkup.png', width: 106, height: 129, displayHeight: 48 },
    amount: 'Acquired',
    type: 'Strategic acquisition',
    counterpartyLabel: 'Acquired by',
    counterparty: 'Paymentsense',
    counterpartyLogo: { src: '/assets/proof/paymentsense.png', width: 578, height: 110, displayHeight: 31 },
    sector: null,
    year: null,
    description: null,
    link: null,
    featured: true
  }
];
