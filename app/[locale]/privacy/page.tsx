import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Locale = 'en' | 'ru' | 'fr' | 'es';

const toLocale = (l: string): Locale =>
  l === 'ru' || l === 'fr' || l === 'es' ? l : 'en';

type Section = {
  n: string;
  title: string;
  body?: string | null;
  list?: string[];
  note?: string;
  bullets?: { head: string; items: string[] }[];
};

const SECTIONS_EN: Section[] = [
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

const SECTIONS_RU: Section[] = [
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

const SECTIONS_FR: Section[] = [
  {
    n: '1', title: 'Qui sommes-nous',
    body: 'Lumée Maison est un fournisseur interentreprises de produits esthétiques professionnels, au service des professionnels de l’esthétique agréés et des cliniques du monde entier. Nous expédions à l’international depuis la Corée du Sud. Notre site n’est pas destiné au grand public ni aux consommateurs en Corée du Sud.',
  },
  {
    n: '2', title: 'Informations que nous collectons', body: null,
    bullets: [
      { head: 'Informations que vous nous communiquez :', items: ['Nom et nom de l’entreprise/de la clinique', 'Adresse e-mail et numéro de téléphone', 'Adresse de livraison', 'Détails de la commande (produits, quantités)', 'Les messages que vous nous envoyez, y compris les questions posées à l’assistant de chat de notre site'] },
      { head: 'Informations de paiement :', items: ['Les paiements sont effectués par virement bancaire Wise ou en USDT (cryptomonnaie). Nous ne collectons ni ne conservons les coordonnées complètes de votre carte bancaire sur notre site.'] },
      { head: 'Informations collectées automatiquement :', items: ['Données de base sur l’appareil et l’utilisation (type de navigateur, pages visitées)', 'Cookies et technologies similaires (voir la Section 8)'] },
    ],
  },
  {
    n: '3', title: 'Comment nous utilisons vos informations',
    body: 'Nous utilisons vos informations pour :',
    list: ['Traiter, exécuter et expédier vos commandes', 'Communiquer avec vous au sujet de votre commande et fournir une assistance client', 'Répondre à vos questions', 'Améliorer notre site, nos produits et notre service client', 'Respecter les obligations légales, fiscales et douanières'],
    note: 'Nous ne vendons pas vos informations personnelles.',
  },
  {
    n: '4', title: 'Partage de vos informations',
    body: 'Nous ne partageons vos informations que dans la mesure nécessaire au fonctionnement de notre activité :',
    bullets: [
      { head: 'Transporteurs', items: ['(FedEx, DHL, EMS, UPS) pour livrer votre commande'] },
      { head: 'Prestataires de services', items: ['qui nous aident à exploiter le site'] },
      { head: 'Autorités', items: ['lorsque la loi ou les douanes l’exigent, ou pour protéger nos droits'] },
    ],
  },
  {
    n: '5', title: 'Transferts internationaux',
    body: 'Nous opérons depuis la Corée du Sud, et vos informations peuvent être traitées et stockées dans ce pays ou dans d’autres pays où nos prestataires de services exercent leurs activités. Les lois sur la protection des données dans ces pays peuvent différer de celles de votre propre pays.',
  },
  {
    n: '6', title: 'Conservation des données',
    body: 'Nous ne conservons vos informations que le temps nécessaire pour exécuter les commandes, fournir une assistance et respecter nos obligations légales et comptables. Ensuite, nous les supprimons ou les anonymisons.',
  },
  {
    n: '7', title: 'Vos droits',
    body: 'Selon votre lieu de résidence, vous pouvez avoir le droit de :',
    list: ['Accéder aux informations personnelles que nous détenons à votre sujet', 'Corriger des informations inexactes', 'Demander la suppression de vos informations', 'Vous opposer à certains traitements ou les limiter'],
    note: 'Pour exercer l’un de ces droits, écrivez à info@lumeemaison.com.',
  },
  {
    n: '8', title: 'Cookies',
    body: 'Notre site utilise des cookies pour assurer le fonctionnement de votre panier, mémoriser vos préférences et comprendre comment le site est utilisé. Vous pouvez contrôler ou désactiver les cookies dans les paramètres de votre navigateur, mais certaines fonctionnalités risquent de ne pas fonctionner correctement sans eux.',
  },
  {
    n: '9', title: 'Mineurs',
    body: 'Notre site et nos produits sont destinés aux professionnels agréés et ne s’adressent à personne de moins de 18 ans. Nous ne collectons pas sciemment d’informations auprès de mineurs.',
  },
  {
    n: '10', title: 'Sécurité',
    body: 'Nous prenons des mesures raisonnables pour protéger vos informations. Toutefois, aucune méthode de transmission ou de stockage n’est totalement sécurisée, et nous ne pouvons garantir une sécurité absolue.',
  },
  {
    n: '11', title: 'Modifications de la présente politique',
    body: 'Nous pouvons mettre à jour la présente politique de temps à autre. La date de « Dernière mise à jour » en haut de la page indique la version la plus récente. Les modifications importantes seront publiées sur cette page.',
  },
  {
    n: '12', title: 'Contact',
    body: 'Des questions sur la présente politique ou vos informations ? Écrivez-nous à info@lumeemaison.com.',
  },
];

const SECTIONS_ES: Section[] = [
  {
    n: '1', title: 'Quiénes somos',
    body: 'Lumée Maison es un proveedor entre empresas de productos estéticos profesionales, al servicio de profesionales de la estética autorizados y clínicas de todo el mundo. Realizamos envíos internacionales desde Corea del Sur. Nuestro sitio web no está dirigido al público general ni a los consumidores de Corea del Sur.',
  },
  {
    n: '2', title: 'Información que recopilamos', body: null,
    bullets: [
      { head: 'Información que usted nos proporciona:', items: ['Nombre y nombre de la empresa/clínica', 'Dirección de correo electrónico y número de teléfono', 'Dirección de envío', 'Detalles del pedido (productos, cantidades)', 'Los mensajes que nos envía, incluidas las preguntas que formula al asistente de chat de nuestro sitio web'] },
      { head: 'Información de pago:', items: ['Los pagos se realizan mediante transferencia bancaria Wise o USDT (criptomoneda). No recopilamos ni almacenamos los datos completos de su tarjeta bancaria en nuestro sitio.'] },
      { head: 'Información recopilada automáticamente:', items: ['Datos básicos del dispositivo y de uso (como el tipo de navegador y las páginas visitadas)', 'Cookies y tecnologías similares (véase la Sección 8)'] },
    ],
  },
  {
    n: '3', title: 'Cómo utilizamos su información',
    body: 'Utilizamos su información para:',
    list: ['Procesar, gestionar y enviar sus pedidos', 'Comunicarnos con usted sobre su pedido y brindar atención al cliente', 'Responder a sus preguntas', 'Mejorar nuestro sitio web, productos y servicio al cliente', 'Cumplir con los requisitos legales, fiscales y aduaneros'],
    note: 'No vendemos su información personal.',
  },
  {
    n: '4', title: 'Cómo compartimos su información',
    body: 'Solo compartimos información en la medida necesaria para gestionar nuestro negocio:',
    bullets: [
      { head: 'Empresas de transporte', items: ['(FedEx, DHL, EMS, UPS) para entregar su pedido'] },
      { head: 'Proveedores de servicios', items: ['que nos ayudan a operar el sitio web'] },
      { head: 'Autoridades', items: ['cuando lo exija la ley, las aduanas o para proteger nuestros derechos'] },
    ],
  },
  {
    n: '5', title: 'Transferencias internacionales',
    body: 'Operamos desde Corea del Sur, y su información puede procesarse y almacenarse allí o en otros países donde operan nuestros proveedores de servicios. Las leyes de protección de datos de estos países pueden diferir de las de su propio país.',
  },
  {
    n: '6', title: 'Conservación de datos',
    body: 'Conservamos su información solo durante el tiempo necesario para gestionar pedidos, brindar asistencia y cumplir con las obligaciones legales y contables. Después, la eliminamos o la anonimizamos.',
  },
  {
    n: '7', title: 'Sus derechos',
    body: 'Según su lugar de residencia, usted puede tener derecho a:',
    list: ['Acceder a la información personal que tenemos sobre usted', 'Corregir información inexacta', 'Solicitar la eliminación de su información', 'Oponerse a determinados tratamientos o restringirlos'],
    note: 'Para ejercer cualquiera de estos derechos, escriba a info@lumeemaison.com.',
  },
  {
    n: '8', title: 'Cookies',
    body: 'Nuestro sitio web utiliza cookies para mantener el funcionamiento de su carrito, recordar sus preferencias y comprender cómo se utiliza el sitio. Puede controlar o desactivar las cookies en la configuración de su navegador, aunque es posible que algunas funciones no funcionen correctamente sin ellas.',
  },
  {
    n: '9', title: 'Menores',
    body: 'Nuestro sitio web y nuestros productos están destinados a profesionales autorizados y no están dirigidos a menores de 18 años. No recopilamos conscientemente información de menores.',
  },
  {
    n: '10', title: 'Seguridad',
    body: 'Adoptamos medidas razonables para proteger su información. No obstante, ningún método de transmisión o almacenamiento es completamente seguro, y no podemos garantizar una seguridad absoluta.',
  },
  {
    n: '11', title: 'Cambios en esta política',
    body: 'Podemos actualizar esta política de vez en cuando. La fecha de «Última actualización» en la parte superior muestra la versión más reciente. Los cambios significativos se publicarán en esta página.',
  },
  {
    n: '12', title: 'Contacto',
    body: '¿Tiene preguntas sobre esta política o su información? Escríbanos a info@lumeemaison.com.',
  },
];

const SECTIONS_BY_LOCALE: Record<Locale, Section[]> = {
  en: SECTIONS_EN,
  ru: SECTIONS_RU,
  fr: SECTIONS_FR,
  es: SECTIONS_ES,
};

// Page chrome copy per locale. Keep keys in sync across all four locales.
// `introLead` is the text shown before the contact email link; the email link
// and trailing period are appended identically in every locale.
const CHROME: Record<Locale, {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heading: string;
  lastUpdated: string;
  introLead: string;
  disclaimer: string;
}> = {
  en: {
    metaTitle: 'Privacy Policy | Lumée Maison',
    metaDescription: 'Privacy policy for Lumée Maison — how we collect, use, and protect your information.',
    eyebrow: 'Legal',
    heading: 'Privacy Policy',
    lastUpdated: 'Last updated: June 7, 2026',
    introLead: 'Lumée Maison respects your privacy. This policy explains what information we collect when you use our website, how we use it, and the choices you have. By using our site, you agree to this policy. If you have any questions, contact us at',
    disclaimer: 'This policy is provided for informational purposes. For full compliance with laws such as the EU GDPR, consider review by a qualified professional.',
  },
  ru: {
    metaTitle: 'Политика конфиденциальности | Lumée Maison',
    metaDescription: 'Политика конфиденциальности Lumée Maison — как мы собираем, используем и защищаем ваши данные.',
    eyebrow: 'Юридическая информация',
    heading: 'Политика конфиденциальности',
    lastUpdated: 'Последнее обновление: 7 июня 2026 г.',
    introLead: 'Lumée Maison уважает вашу конфиденциальность. Настоящая политика объясняет, какую информацию мы собираем, когда вы используете наш сайт, как мы её используем и какой выбор у вас есть. Используя наш сайт, вы соглашаетесь с настоящей политикой. Если у вас есть вопросы, свяжитесь с нами по адресу',
    disclaimer: 'Настоящая политика предоставлена в информационных целях. Для полного соответствия таким законам, как GDPR ЕС, рекомендуется консультация квалифицированного специалиста.',
  },
  fr: {
    metaTitle: 'Politique de confidentialité | Lumée Maison',
    metaDescription: 'Politique de confidentialité de Lumée Maison — comment nous collectons, utilisons et protégeons vos informations.',
    eyebrow: 'Mentions légales',
    heading: 'Politique de confidentialité',
    lastUpdated: 'Dernière mise à jour : 7 juin 2026',
    introLead: 'Lumée Maison respecte votre vie privée. La présente politique explique quelles informations nous collectons lorsque vous utilisez notre site, comment nous les utilisons et les choix qui s’offrent à vous. En utilisant notre site, vous acceptez la présente politique. Si vous avez des questions, contactez-nous à l’adresse',
    disclaimer: 'La présente politique est fournie à titre informatif. Pour une conformité totale avec des lois telles que le RGPD de l’UE, envisagez un examen par un professionnel qualifié.',
  },
  es: {
    metaTitle: 'Política de privacidad | Lumée Maison',
    metaDescription: 'Política de privacidad de Lumée Maison — cómo recopilamos, utilizamos y protegemos su información.',
    eyebrow: 'Aviso legal',
    heading: 'Política de privacidad',
    lastUpdated: 'Última actualización: 7 de junio de 2026',
    introLead: 'Lumée Maison respeta su privacidad. Esta política explica qué información recopilamos cuando usted utiliza nuestro sitio web, cómo la utilizamos y las opciones que tiene. Al utilizar nuestro sitio, usted acepta esta política. Si tiene alguna pregunta, contáctenos en',
    disclaimer: 'Esta política se proporciona con fines informativos. Para un cumplimiento total de leyes como el RGPD de la UE, considere la revisión por parte de un profesional cualificado.',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ui = CHROME[toLocale(locale)];
  return {
    title: ui.metaTitle,
    description: ui.metaDescription,
  };
}

function PolicyContent({ sections, disclaimer }: { sections: Section[]; disclaimer: string }) {
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
        {disclaimer}
      </p>
    </div>
  );
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = toLocale(locale);
  const ui = CHROME[l];
  const sections = SECTIONS_BY_LOCALE[l];

  const intro: ReactNode = (
    <>
      {ui.introLead}{' '}
      <a href="mailto:info@lumeemaison.com" className="text-gold hover:underline">info@lumeemaison.com</a>.
    </>
  );

  return (
    <div className="pt-24 min-h-screen luxe-bg">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">
            {ui.eyebrow}
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-charcoal mb-4">
            {ui.heading}
          </h1>
          <div className="w-16 h-px bg-gold mx-auto mb-4" />
          <p className="text-xs text-mist">
            Lumée Maison · {ui.lastUpdated}
          </p>
        </div>

        <p className="text-sm text-mist leading-relaxed mb-10 border-l-2 border-gold/40 pl-4">
          {intro}
        </p>

        <PolicyContent sections={sections} disclaimer={ui.disclaimer} />
      </div>
    </div>
  );
}
