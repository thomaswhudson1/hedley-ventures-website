// Allowed answers for the enquiry form. These must match the options in /dist/contact/index.html
// and the CHECK constraints in migrations/0001_init.sql.

export const SERVICES = ['Fundraising Advisory', 'Fractional CFO Support', 'Both', 'Something else'];
export const FUNDRAISING_SERVICES = ['Fundraising Advisory', 'Both'];
export const RAISE_AMOUNTS = ['Under £2m', '£2m–£5m', '£5m–£10m', '£10m+', 'Not yet decided'];
export const RAISE_TIMINGS = ['Immediately / Already fundraising', 'Within the next 3 months', 'In 3–6 months', 'In 6+ months / Just exploring'];
export const TRACTION = ['Pre-revenue', 'Under £50k per month', '£50k–£150k per month', '£150k–£300k per month', '£300k–£500k per month', 'Over £500k per month'];

export const STATUSES = ['New', 'Contacted', 'Meeting arranged', 'Proposal sent', 'Won', 'Not proceeding'];
export const ACTIVE_STATUSES = ['Contacted', 'Meeting arranged', 'Proposal sent'];
export const CLOSED_STATUSES = ['Won', 'Not proceeding'];
export const PRIORITIES = ['High', 'Medium', 'Low'];

export const LIMITS = { name: 120, email: 254, company: 160, message: 3000, notes: 10000 };
