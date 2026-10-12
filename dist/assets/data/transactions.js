// Hedley Ventures — transaction data (one entry per deal).
// Used by the Deals page (every entry, as tombstones) and the homepage (entries with `featured: true`, up to four).
//
// HOW TO ADD A DEAL
//   1. Save the company logo (and investor/acquirer logo) as transparent PNGs in /assets/proof/.
//   2. Copy one of the entries below, paste it at the end of the list and change the details.
//   3. Give it a unique `id` and an `order` number (lower numbers appear first).
//   That's it — the Deals page builds the new tombstone automatically. Leave any optional field as null.
//
// REQUIRED
//   id                 Unique identifier, lower-case with hyphens, e.g. 'quality-clouds'
//   order              Display order (1 = first)
//   company            Company name (also the logo's alt text)
//   companyLogo        { src, width, height, displayHeight } — width/height are the file's pixel size;
//                      displayHeight is how tall the logo appears on the card, in px
//   kind               'investment' or 'acquisition' — sets the wording, e.g. "Investment from" / "Acquired by"
//   type               Transaction type shown on the card, e.g. 'Growth capital investment', 'Strategic acquisition'
//
// OPTIONAL (use null when not available — nothing empty is shown)
//   amount             Publicly disclosed value as shown, e.g. '£3.5m'. null if undisclosed
//   currency           e.g. 'GBP' (for reference / future filtering)
//   showCompanyName    true = print the company name under its logo (use when the logo is a symbol without the name)
//   counterparties     List of investors or the acquirer: [{ name, logo }] — logo is { src, width, height, displayHeight }
//                      or null to show the name as text. Add several entries for a syndicate.
//   counterpartyLabel  Override the label above the investor/acquirer, e.g. 'Led by'
//   year, sector       e.g. 2022, 'Software'
//   description        One short sentence about the deal (shown on the Deals page only)
//   testimonial        Founder testimonial: the `id` of an entry in testimonials.js (e.g. 'albert-franquesa'),
//                      or a full object { quote, name, title, organisation, headshot, logo }. null = no testimonial link.
//   announcement       Public announcement URL (adds a small "Announcement" link). null = no link
//   advisedBy          Advisory firm at the time, e.g. 'PwC Raise | Ventures' (for reference; the Deals page shows the
//                      PwC attribution above the tombstones — update that line in /deals/index.html if this changes)
//   featured           true = eligible for the homepage "Selected transactions" section
//
// Only add details that are confirmed and approved for publication.

window.HEDLEY_TRANSACTIONS = [
  {
    id: 'quality-clouds',
    order: 1,
    company: 'Quality Clouds',
    companyLogo: { src: '/assets/proof/quality-clouds.png', width: 612, height: 93, displayHeight: 28 },
    kind: 'investment',
    type: 'Growth capital investment',
    amount: '£3.5m',
    currency: 'GBP',
    counterparties: [
      { name: 'YFM Equity Partners', logo: { src: '/assets/proof/yfm.png', width: 348, height: 176, displayHeight: 46 } }
    ],
    counterpartyLabel: null,
    year: null,
    sector: null,
    description: null,
    testimonial: 'albert-franquesa',
    announcement: null,
    advisedBy: 'PwC Raise | Ventures',
    featured: true
  },
  {
    id: 'secretarium',
    order: 2,
    company: 'Secretarium',
    companyLogo: { src: '/assets/proof/secretarium.png', width: 646, height: 92, displayHeight: 27 },
    kind: 'investment',
    type: 'Growth capital investment',
    amount: '£5m',
    currency: 'GBP',
    counterparties: [
      { name: 'IQ Capital', logo: { src: '/assets/proof/iq-capital.png', width: 459, height: 84, displayHeight: 25 } }
    ],
    counterpartyLabel: null,
    year: null,
    sector: null,
    description: null,
    testimonial: 'bertrand-foing',
    announcement: null,
    advisedBy: 'PwC Raise | Ventures',
    featured: true
  },
  {
    id: 'plumm',
    order: 3,
    company: 'Plumm',
    companyLogo: { src: '/assets/proof/plumm.png', width: 375, height: 103, displayHeight: 34 },
    kind: 'investment',
    type: 'Growth capital investment',
    amount: '£2.2m',
    currency: 'GBP',
    counterparties: [
      { name: 'IW Capital', logo: { src: '/assets/proof/iw-capital.png', width: 462, height: 65, displayHeight: 21 } }
    ],
    counterpartyLabel: null,
    year: null,
    sector: null,
    description: null,
    testimonial: 'asif-amin',
    announcement: null,
    advisedBy: 'PwC Raise | Ventures',
    featured: true
  },
  {
    id: 'walkup',
    order: 4,
    company: 'WalkUp',
    companyLogo: { src: '/assets/proof/walkup.png', width: 106, height: 129, displayHeight: 48 },
    showCompanyName: true,
    kind: 'acquisition',
    type: 'Strategic acquisition',
    amount: null,
    currency: null,
    counterparties: [
      { name: 'Paymentsense', logo: { src: '/assets/proof/paymentsense.png', width: 578, height: 110, displayHeight: 31 } }
    ],
    counterpartyLabel: null,
    year: null,
    sector: null,
    description: null,
    testimonial: 'amos-teshuva',
    announcement: null,
    advisedBy: 'PwC Raise | Ventures',
    featured: true
  }
];
