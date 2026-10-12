// Hedley Ventures — testimonial data.
// One entry per testimonial. Sections pick entries by `category` and `homepage`, sorted by `order`.
//
// Fields
//   name, title, organisation   Shown under the quote
//   category                    'founder' | 'investor' | 'ecosystem'
//   quote                       Approved wording only (no quotation marks; they are added by the design)
//   headshot                    Image path, or null to show initials
//   logo                        { src, width, height, displayHeight } or null
//   order                       Display order within its category
//   homepage                    true = eligible for the homepage
//   approved                    false = draft awaiting the person's sign-off. Drafts are shown ONLY in the
//                               local preview (marked "Draft"), never on the live website.
//
// Founder testimonials are also shown in the "Experience that delivers" carousel and on the Track Record page.

window.HEDLEY_TESTIMONIALS = [
  {
    name: 'Albert Franquesa', title: 'Co-founder', organisation: 'Quality Clouds', category: 'founder',
    quote: 'I have known Tom since he advised us on our raise at Quality Clouds. He gave us the version of the truth we needed, stayed close throughout the process and never made it about the fee. That is rare.',
    headshot: '/assets/albert-franquesa.webp',
    logo: { src: '/assets/proof/quality-clouds.png', width: 612, height: 93, displayHeight: 26 },
    order: 1, homepage: true, approved: true
  },
  {
    name: 'Bertrand Foing', title: 'Founder & CEO', organisation: 'Secretarium', category: 'founder',
    quote: 'Tom provided great guidance throughout our fundraising, helping us become investor-ready in just a few weeks and advising us through to Secretarium’s £5m raise from IQ Capital.',
    headshot: '/assets/bertrand-foing.webp',
    logo: { src: '/assets/proof/secretarium.png', width: 646, height: 92, displayHeight: 26 },
    order: 2, homepage: true, approved: true
  },
  {
    name: 'Asif Amin', title: 'Founder & CEO', organisation: 'Plumm', category: 'founder',
    quote: 'Tom was a great support throughout our fundraise with IW Capital. He was pragmatic, responsive and understood how to navigate the process from both the company and investor side. He played an important role in helping us complete the raise successfully.',
    headshot: '/assets/asif-amin.webp',
    logo: { src: '/assets/proof/plumm.png', width: 375, height: 103, displayHeight: 30 },
    order: 3, homepage: true, approved: true
  },
  {
    name: 'Amos Teshuva', title: 'Founder & CEO', organisation: 'WalkUp', category: 'founder',
    quote: 'Thomas was instrumental in guiding us through our acquisition. His advice helped us tremendously throughout the process. If we were ever being acquired again, I’d love to have Tom in our corner.',
    headshot: '/assets/amos-teshuva.webp',
    logo: { src: '/assets/proof/walkup.png', width: 106, height: 129, displayHeight: 40 },
    order: 4, homepage: true, approved: true
  },
  {
    name: 'Spencer Lake', title: 'Partner', organisation: '13Books Capital', category: 'investor',
    quote: 'Tom is clearly passionate about venture capital and has been active in the ecosystem for many years, including having hosted me on his podcast some time ago and attending various FinTech scouting events. He understands our mandate well and consistently brings us credible, relevant opportunities.',
    headshot: '/assets/spencer-lake.webp',
    logo: { src: '/assets/network/13books.png', width: 696, height: 172, displayHeight: 30 },
    order: 1, homepage: true, approved: true
  },
  {
    name: 'Fred Ursell', title: 'Head of Investments', organisation: 'Pembroke VCT', category: 'investor',
    quote: 'I’ve sat across the table from Tom on live processes and always found him straight, commercial and properly prepared — making him unusually easy to deal with from the investor side. Any founder thinking about raising should be speaking to Hedley Ventures.',
    headshot: '/assets/fred-ursell.webp',
    logo: { src: '/assets/network/pembroke.png', width: 1008, height: 188, displayHeight: 26, blend: true },
    order: 2, homepage: true, approved: true
  },
  {
    name: 'Huw Sparkes', title: 'Investment Manager', organisation: 'Future Planet Capital', category: 'investor',
    quote: 'Tom has always been very good at keeping in touch and making the effort to understand how our investment mandate is evolving. He is proactive in checking what has changed and uses that understanding to make sure the opportunities he brings to us are relevant and well aligned.',
    headshot: '/assets/huw-sparkes.webp', logo: null,
    order: 3, homepage: false, approved: true
  },
  {
    name: 'Sam Taylor', title: 'Investment Manager', organisation: 'British Business Bank', category: 'investor',
    quote: 'Tom has a strong understanding of what investors look for in growth companies and how to communicate an investment case clearly. He combines a commercial mindset with a unique understanding of the fundraising landscape.',
    headshot: '/assets/sam-taylor.webp', logo: null,
    order: 4, homepage: false, approved: true
  },
  {
    name: 'Henry Whorwood', title: 'Managing Director', organisation: 'Beauhurst', category: 'ecosystem',
    quote: 'Having spoken alongside Tom on multiple panels and presentations over the years, he’s always been right at the heart of the UK growth capital ecosystem, usually with some Beauhurst data to back up his insights! He’s a well-respected voice on fundraising and someone who understands the market thanks to his years of experience.',
    headshot: '/assets/network/henry-whorwood.png',
    logo: { src: '/assets/network/beauhurst.png', width: 1708, height: 252, displayHeight: 24, mono: true },
    order: 1, homepage: true, approved: true
  },
  {
    // DRAFT: wording drafted by Thomas on 12 Oct 2026 and sent to Christiana for amendment. Replace with her
    // approved wording, then set approved: true.
    name: 'Christiana Stewart-Lockhart', title: 'Director General', organisation: 'EISA', category: 'ecosystem',
    quote: 'I’ve worked with Thomas for many years through his involvement with EISA, where he has been a longstanding supporter of the UK’s early-stage investment ecosystem. From championing our work to hosting our Spring Technical Seminar whilst at PwC, Thomas has consistently demonstrated a genuine commitment to supporting entrepreneurs and investors. He brings a rare combination of technical expertise, strong relationships and a collaborative approach.',
    headshot: '/assets/network/christiana-stewart-lockhart.jpg', logo: null,
    order: 2, homepage: true, approved: false
  }
];
