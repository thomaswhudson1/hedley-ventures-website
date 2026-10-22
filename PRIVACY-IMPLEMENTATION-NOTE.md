# Privacy: internal implementation note (not published)

Last reviewed: October 2026. This note sits outside `dist/`, so it is not deployed to the website. If the GitHub repository is public, it is visible there once committed; keep it uncommitted or store it elsewhere if you prefer.

## 1. Contacts obtained indirectly (UK GDPR Article 14)

**What the law requires.** When you obtain someone's personal data from somewhere other than them (LinkedIn, company websites, Companies House, introducers, commercial databases, client files), you must give them privacy information:

- within a reasonable period, and no later than **one month** after obtaining it;
- if you use the data to contact them, **no later than your first communication**;
- if you plan to disclose it to someone else (for example, sending an investor's details to a client), **no later than that first disclosure**.

There is no exemption simply because the data is public or bought from a reputable provider.

**Exceptions that may apply (Article 14(5)):**

- **Already informed:** the person already has the information (for example, they were sent the policy link earlier).
- **Disproportionate effort:** providing it would be impossible or take disproportionate effort. This is a judgement you must be able to justify, taking account of the number of people, how old the data is and the safeguards you apply, and you must still make the information public (the website policy does this). It may fit research-only records you hold briefly and have not used, but not people you go on to contact.
- **Confidentiality:** the data must stay confidential under an obligation of professional secrecy. This may cover personal data about a client's shareholders or employees that you receive in confidence during an engagement.

**Proportionate approach for Hedley Ventures:**

1. **First contact:** every first outreach email (and the LinkedIn message, where practical) includes a short line giving the privacy policy link and how to opt out. This meets the "first communication" deadline and the requirement to bring the right to object to the person's attention. Simplest route: add it to the email signature, for example:
   > How we handle your information: hedleyventures.com/privacy. If you would rather not hear from us, just reply and let me know.
2. **Research records you do not contact within a month:** keep them minimal (name, role, organisation, business contact details, source) and remove them if they stop being relevant. If you hold a record for more than a month without contacting the person, you are relying on the disproportionate-effort exception. Write a short note of why it applies (one paragraph, once, covering the whole research list) and keep the public policy up to date. You do not need to notify people individually as soon as you add them.
3. **Before disclosing a contact's details to a third party** (for example, investor details to a client), make sure the person has had the policy link, unless they gave you the details for that purpose.

## 2. Business development emails (PECR, separate from UK GDPR)

- **Corporate subscribers** (email addresses at limited companies, LLPs, Scottish partnerships, public bodies): no PECR consent needed. Each email must identify Hedley Ventures and give a valid address for opting out. Honour opt-outs; the ICO expects it, and UK GDPR makes the right to object to direct marketing absolute.
- **Individual subscribers** (sole traders, other partnerships, personal email addresses): consent is needed, unless the "soft opt-in" applies (you obtained their details during an enquiry or sale, the marketing is about your similar services, and they were given an opt-out when you collected the details and in every message).
- **UK GDPR** still applies to all of these: the lawful basis is legitimate interests, as stated in the policy.
- **Calls:** check numbers against the TPS/CTPS before making unsolicited marketing calls.

## 3. Operational actions

### Legal requirements

1. **Add the privacy link and opt-out line to your email signature** (see 1 above). The policy now states that business emails identify you and give an opt-out.
2. **Keep a do-not-contact list.** When someone opts out or objects, record it in the CRM/spreadsheet so they are not contacted again, including after you buy or refresh contact lists. Do not simply delete them.
3. **Apply the 24-month enquiry retention.** The enquiries dashboard only archives records; nothing deletes them automatically. About once a year, delete enquiries more than 24 months past last contact from the Cloudflare D1 database, and delete the matching Resend notification emails in Gmail. Do the same when someone asks for their enquiry to be deleted.
4. **Complaints (Data (Use and Access) Act 2025, in force from 19 June 2026):** acknowledge any data protection complaint within 30 days, look into it without undue delay and tell the person the outcome. Your existing email address is enough as the way to complain.
5. **Data processing terms:** make sure the standard data processing terms are in place for Google Workspace, Xero, Cloudflare, Resend and any commercial contact database you use. This is usually done by accepting them in each provider's account settings. The policy's statement on international transfers relies on these terms or on the providers' Data Privacy Framework certification.
6. **ICO data protection fee:** confirm Hedley Ventures has paid it (most small firms pay the Tier 1 fee). It is required unless an exemption applies.

### Optional good practice

- Write a one-page legitimate interests assessment covering research, CRM and B2B outreach. The ICO recommends one; it is not mandatory, but it helps if you are ever challenged.
- Add a "source" column to the CRM so you can tell people where you got their details if they ask (Article 15).
- Consider aligning the Contact page form note ("used only to respond to your enquiry") with the policy, for example: "We use your details to respond to your enquiry and as described in our Privacy Policy."
- Consider whether the Money Laundering Regulations apply to any fractional CFO or accountancy-type work. If they do, they set their own five-year record-keeping requirement.
