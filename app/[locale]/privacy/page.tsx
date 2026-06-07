import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Lumée Maison',
  description: 'Privacy policy for Lumée Maison — how we collect, use, and protect your information.',
};

const SECTIONS = [
  {
    n: '1',
    title: 'Who We Are',
    body: 'Lumée Maison is a business-to-business supplier of professional aesthetic products, serving licensed aesthetic professionals and clinics worldwide. We ship internationally from South Korea. Our website is not directed to the general public or to consumers in South Korea.',
  },
  {
    n: '2',
    title: 'Information We Collect',
    body: null,
    bullets: [
      { head: 'Information you give us:', items: ['Name and business/clinic name', 'Email address and phone number', 'Shipping address', 'Order details (products, quantities)', 'Messages you send us, including questions you ask our website chat assistant'] },
      { head: 'Payment information:', items: ['Payments are made via Wise bank transfer or USDT (cryptocurrency). We do not collect or store your full bank card details on our site. Payment is completed through these external methods.'] },
      { head: 'Information collected automatically:', items: ['Basic device and usage data (such as browser type and pages visited)', 'Cookies and similar technologies (see Section 8)'] },
    ],
  },
  {
    n: '3',
    title: 'How We Use Your Information',
    body: 'We use your information to:',
    list: [
      'Process, fulfill, and ship your orders',
      'Communicate with you about your order and provide customer support',
      'Respond to your questions',
      'Improve our website, products, and customer service (including reviewing questions asked to our chat assistant)',
      'Meet legal, tax, and customs requirements',
    ],
    note: 'We do not sell your personal information.',
  },
  {
    n: '4',
    title: 'Sharing Your Information',
    body: 'We share information only as needed to run our business:',
    bullets: [
      { head: 'Shipping carriers', items: ['(such as FedEx, DHL, EMS, UPS) to deliver your order'] },
      { head: 'Service providers', items: ['who help us operate the website'] },
      { head: 'Authorities', items: ['where required by law, customs, or to protect our rights'] },
    ],
  },
  {
    n: '5',
    title: 'International Transfers',
    body: 'We operate from South Korea, and your information may be processed and stored there or in other countries where our service providers operate. Data protection laws in these countries may differ from those in your own.',
  },
  {
    n: '6',
    title: 'Data Retention',
    body: 'We keep your information only as long as needed to fulfill orders, provide support, and meet legal and accounting obligations. After that, we delete or anonymize it.',
  },
  {
    n: '7',
    title: 'Your Rights',
    body: 'Depending on where you live, you may have the right to:',
    list: [
      'Access the personal information we hold about you',
      'Correct inaccurate information',
      'Request deletion of your information',
      'Object to or restrict certain processing',
    ],
    note: 'To exercise any of these rights, email info@lumeemaison.com. We will respond within a reasonable time.',
  },
  {
    n: '8',
    title: 'Cookies',
    body: 'Our website uses cookies to keep your cart working, remember preferences, and understand how the site is used. You can control or disable cookies in your browser settings, though some features may not work properly without them.',
  },
  {
    n: '9',
    title: 'Children',
    body: 'Our website and products are intended for licensed professionals and are not directed to anyone under 18. We do not knowingly collect information from minors.',
  },
  {
    n: '10',
    title: 'Security',
    body: 'We take reasonable measures to protect your information. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
  },
  {
    n: '11',
    title: 'Changes to This Policy',
    body: 'We may update this policy from time to time. The "Last updated" date at the top shows the latest version. Significant changes will be posted on this page.',
  },
  {
    n: '12',
    title: 'Contact',
    body: 'Questions about this policy or your information? Email us at info@lumeemaison.com.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="pt-24 min-h-screen luxe-bg">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">Legal</p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-charcoal mb-4">
            Privacy Policy
          </h1>
          <div className="w-16 h-px bg-gold mx-auto mb-4" />
          <p className="text-xs text-mist">Lumée Maison · Last updated: June 7, 2026</p>
        </div>

        {/* Intro */}
        <p className="text-sm text-mist leading-relaxed mb-10 border-l-2 border-gold/40 pl-4">
          Lumée Maison respects your privacy. This policy explains what information we collect when you use our website, how we use it, and the choices you have. By using our site, you agree to this policy. If you have any questions, contact us at{' '}
          <a href="mailto:info@lumeemaison.com" className="text-gold hover:underline">info@lumeemaison.com</a>.
        </p>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map(s => (
            <section key={s.n} className="border border-bone rounded-2xl p-6 bg-white/60">
              <h2 className="font-display text-lg font-light text-charcoal mb-3">
                <span className="text-gold/60 mr-2 text-base">{s.n}.</span>
                {s.title}
              </h2>

              {s.body && (
                <p className="text-sm text-mist leading-relaxed mb-3">{s.body}</p>
              )}

              {'list' in s && s.list && (
                <ul className="space-y-1.5 mb-3">
                  {s.list.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-mist">
                      <span className="text-gold/50 mt-1 shrink-0">–</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {'bullets' in s && s.bullets && (
                <div className="space-y-3">
                  {s.bullets.map((b, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/70 mb-1">{b.head}</p>
                      <ul className="space-y-1">
                        {b.items.map((item, j) => (
                          <li key={j} className="flex gap-2 text-sm text-mist">
                            <span className="text-gold/50 mt-1 shrink-0">–</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {'note' in s && s.note && (
                <p className="text-sm text-mist leading-relaxed mt-3 italic">{s.note}</p>
              )}
            </section>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-mist/60 text-center mt-12 leading-relaxed">
          This policy is provided for informational purposes. For full compliance with laws such as the EU GDPR, consider review by a qualified professional.
        </p>

      </div>
    </div>
  );
}
