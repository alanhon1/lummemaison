import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ru' ? 'Политика конфиденциальности | Lumée Maison' : 'Privacy Policy | Lumée Maison',
    description: locale === 'ru'
      ? 'Политика конфиденциальности Lumée Maison — как мы собираем, используем и защищаем ваши данные.'
      : 'Privacy policy for Lumée Maison — how we collect, use, and protect your information.',
  };
}

const SECTIONS_EN = [
  {
    n: '1', title: 'Who We Are',
    body: 'Lumée Maison is a business-to-business supplier of professional aesthetic products, serving licensed aesthetic professionals and clinics worldwide. We ship internationally from South Korea. Our website is not directed to the general public or to consumers in South Korea.',
  },
  {
    n: '2', title: 'Information We Collect', body: null,
    bullets: [
      { head: 'Information you give us:', items: ['Name and business/clinic name', 'Email address and phone number', 'Shipping address', 'Order details (products, quantities)', 'Messages you send us, including questions you ask our website chat assistant'] },
      { head: 'Payment information:', items: ['Payments are made via Wise bank transfer or USDT (cryptocurrency). We do not collect or store your full bank card details on our site.'] },
      { head: 'Information collected automatically:', items: ['Basic device and usage data (such as browser type and pages visited)', 'Cookies and similar technologies (see Section 8)'] },
    ],
  },
  {
    n: '3', title: 'How We Use Your Information',
    body: 'We use your information to:',
    list: ['Process, fulfill, and ship your orders', 'Communicate with you about your order and provide customer support', 'Respond to your questions', 'Improve our website, products, and customer service', 'Meet legal, tax, and customs requirements'],
    note: 'We do not sell your personal information.',
  },
  {
    n: '4', title: 'Sharing Your Information',
    body: 'We share information only as needed to run our business:',
    bullets: [
      { head: 'Shipping carriers', items: ['(FedEx, DHL, EMS, UPS) to deliver your order'] },
      { head: 'Service providers', items: ['who help us operate the website'] },
      { head: 'Authorities', items: ['where required by law, customs, or to protect our rights'] },
    ],
  },
  {
    n: '5', title: 'International Transfers',
    body: 'We operate from South Korea, and your information may be processed and stored there or in other countries where our service providers operate. Data protection laws in these countries may differ from those in your own.',
  },
  {
    n: '6', title: 'Data Retention',
    body: 'We keep your information only as long as needed to fulfill orders, provide support, and meet legal and accounting obligations. After that, we delete or anonymize it.',
  },
  {
    n: '7', title: 'Your Rights',
    body: 'Depending on where you live, you may have the right to:',
    list: ['Access the personal information we hold about you', 'Correct inaccurate information', 'Request deletion of your information', 'Object to or restrict certain processing'],
    note: 'To exercise any of these rights, email info@lumeemaison.com.',
  },
  {
    n: '8', title: 'Cookies',
    body: 'Our website uses cookies to keep your cart working, remember preferences, and understand how the site is used. You can control or disable cookies in your browser settings, though some features may not work properly without them.',
  },
  {
    n: '9', title: 'Children',
    body: 'Our website and products are intended for licensed professionals and are not directed to anyone under 18. We do not knowingly collect information from minors.',
  },
  {
    n: '10', title: 'Security',
    body: 'We take reasonable measures to protect your information. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
  },
  {
    n: '11', title: 'Changes to This Policy',
    body: 'We may update this policy from time to time. The "Last updated" date at the top shows the latest version. Significant changes will be posted on this page.',
  },
  {
    n: '12', title: 'Contact',
    body: 'Questions about this policy or your information? Email us at info@lumeemaison.com.',
  },
];

const SECTIONS_RU = [
  {
    n: '1', title: 'О нас',
    body: 'Lumée Maison — поставщик профессиональных эстетических продуктов для бизнеса, обслуживающий лицензированных специалистов в области эстетики и клиники по всему миру. Мы осуществляем международную доставку из Южной Кореи. Наш сайт не предназначен для широкой публики или потребителей в Южной Корее.',
  },
  {
    n: '2', title: 'Информация, которую мы собираем', body: null,
    bullets: [
      { head: 'Информация, которую вы предоставляете:', items: ['Имя и название компании/клиники', 'Адрес электронной почты и номер телефона', 'Адрес доставки', 'Детали заказа (товары, количество)', 'Сообщения, которые вы нам отправляете, включая вопросы к чат-ассистенту сайта'] },
      { head: 'Платёжная информация:', items: ['Платежи осуществляются через банковский перевод Wise или USDT (криптовалюта). Мы не собираем и не храним полные данные банковских карт на нашем сайте.'] },
      { head: 'Информация, собираемая автоматически:', items: ['Базовые данные об устройстве и использовании (тип браузера, посещённые страницы)', 'Файлы cookie и аналогичные технологии (см. Раздел 8)'] },
    ],
  },
  {
    n: '3', title: 'Как мы используем вашу информацию',
    body: 'Мы используем вашу информацию для:',
    list: ['Обработки, выполнения и доставки ваших заказов', 'Общения с вами по вопросам заказа и оказания поддержки клиентам', 'Ответов на ваши вопросы', 'Улучшения нашего сайта, продуктов и клиентского сервиса', 'Соблюдения юридических, налоговых и таможенных требований'],
    note: 'Мы не продаём вашу личную информацию.',
  },
  {
    n: '4', title: 'Передача информации третьим лицам',
    body: 'Мы передаём информацию только в той мере, которая необходима для ведения бизнеса:',
    bullets: [
      { head: 'Транспортные компании', items: ['(FedEx, DHL, EMS, UPS) для доставки вашего заказа'] },
      { head: 'Поставщики услуг', items: ['помогающие нам управлять сайтом'] },
      { head: 'Органы власти', items: ['в случаях, предусмотренных законом, таможенными требованиями или для защиты наших прав'] },
    ],
  },
  {
    n: '5', title: 'Международная передача данных',
    body: 'Мы работаем из Южной Кореи, и ваша информация может обрабатываться и храниться там или в других странах, где работают наши поставщики услуг. Законы о защите данных в этих странах могут отличаться от законов вашей страны.',
  },
  {
    n: '6', title: 'Хранение данных',
    body: 'Мы храним вашу информацию только столько, сколько необходимо для выполнения заказов, оказания поддержки и соблюдения юридических и бухгалтерских обязательств. После этого мы удаляем или обезличиваем её.',
  },
  {
    n: '7', title: 'Ваши права',
    body: 'В зависимости от вашего места проживания вы можете иметь право на:',
    list: ['Доступ к личной информации, которую мы о вас храним', 'Исправление неточной информации', 'Запрос на удаление вашей информации', 'Возражение против определённой обработки или её ограничение'],
    note: 'Для реализации любого из этих прав напишите нам на info@lumeemaison.com.',
  },
  {
    n: '8', title: 'Файлы cookie',
    body: 'Наш сайт использует файлы cookie для работы корзины, запоминания настроек и понимания того, как используется сайт. Вы можете управлять файлами cookie или отключить их в настройках браузера, однако некоторые функции могут работать некорректно без них.',
  },
  {
    n: '9', title: 'Дети',
    body: 'Наш сайт и продукты предназначены для лицензированных специалистов и не направлены на лиц младше 18 лет. Мы намеренно не собираем информацию о несовершеннолетних.',
  },
  {
    n: '10', title: 'Безопасность',
    body: 'Мы принимаем разумные меры для защиты вашей информации. Однако ни один метод передачи или хранения данных не является полностью безопасным, и мы не можем гарантировать абсолютную безопасность.',
  },
  {
    n: '11', title: 'Изменения в настоящей политике',
    body: 'Мы можем периодически обновлять настоящую политику. Дата «Последнего обновления» в верхней части страницы показывает актуальную версию. Существенные изменения будут опубликованы на этой странице.',
  },
  {
    n: '12', title: 'Контакты',
    body: 'Вопросы по настоящей политике или вашим данным? Напишите нам на info@lumeemaison.com.',
  },
];

type Section = {
  n: string;
  title: string;
  body?: string | null;
  list?: string[];
  note?: string;
  bullets?: { head: string; items: string[] }[];
};

function PolicyContent({ sections, locale }: { sections: Section[]; locale: string }) {
  const isRu = locale === 'ru';
  return (
    <div className="space-y-8">
      {sections.map(s => (
        <section key={s.n} className="border border-bone rounded-2xl p-6 bg-white/60">
          <h2 className="font-display text-lg font-light text-charcoal mb-3">
            <span className="text-gold/60 mr-2 text-base">{s.n}.</span>
            {s.title}
          </h2>
          {s.body && <p className="text-sm text-mist leading-relaxed mb-3">{s.body}</p>}
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
      <p className="text-xs text-mist/60 text-center mt-4 leading-relaxed">
        {isRu
          ? 'Настоящая политика предоставлена в информационных целях. Для полного соответствия таким законам, как GDPR ЕС, рекомендуется консультация квалифицированного специалиста.'
          : 'This policy is provided for informational purposes. For full compliance with laws such as the EU GDPR, consider review by a qualified professional.'}
      </p>
    </div>
  );
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isRu = locale === 'ru';
  const sections = isRu ? SECTIONS_RU : SECTIONS_EN;

  return (
    <div className="pt-24 min-h-screen luxe-bg">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">
            {isRu ? 'Юридическая информация' : 'Legal'}
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-charcoal mb-4">
            {isRu ? 'Политика конфиденциальности' : 'Privacy Policy'}
          </h1>
          <div className="w-16 h-px bg-gold mx-auto mb-4" />
          <p className="text-xs text-mist">
            Lumée Maison · {isRu ? 'Последнее обновление: 7 июня 2026 г.' : 'Last updated: June 7, 2026'}
          </p>
        </div>

        <p className="text-sm text-mist leading-relaxed mb-10 border-l-2 border-gold/40 pl-4">
          {isRu
            ? <>Lumée Maison уважает вашу конфиденциальность. Настоящая политика объясняет, какую информацию мы собираем, когда вы используете наш сайт, как мы её используем и какой выбор у вас есть. Используя наш сайт, вы соглашаетесь с настоящей политикой. Если у вас есть вопросы, свяжитесь с нами по адресу{' '}<a href="mailto:info@lumeemaison.com" className="text-gold hover:underline">info@lumeemaison.com</a>.</>
            : <>Lumée Maison respects your privacy. This policy explains what information we collect when you use our website, how we use it, and the choices you have. By using our site, you agree to this policy. If you have any questions, contact us at{' '}<a href="mailto:info@lumeemaison.com" className="text-gold hover:underline">info@lumeemaison.com</a>.</>
          }
        </p>

        <PolicyContent sections={sections as Section[]} locale={locale} />
      </div>
    </div>
  );
}
