export interface FaqItem {
  id: number;
  q: { en: string; ru: string };
  a: { en: string; ru: string };
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 1,
    q: {
      en: 'How much is shipping?',
      ru: 'Сколько стоит доставка?',
    },
    a: {
      en: 'Shipping is $35 flat rate from South Korea to anywhere in the world. We ship via FedEx, DHL, EMS, or UPS — whichever is fastest and most reliable for your destination.\n\nUSA note: A free FedEx account number is required for standard $35 shipping. Without one, FedEx Priority is available at $65.',
      ru: 'Доставка стоит $35 фиксированно из Южной Кореи в любую точку мира. Мы отправляем через FedEx, DHL, EMS или UPS — в зависимости от вашей страны.\n\nДля клиентов из США: требуется бесплатный номер аккаунта FedEx. Без него доступна доставка FedEx Priority за $65.',
    },
  },
  {
    id: 2,
    q: {
      en: 'What payment methods do you accept?',
      ru: 'Какие способы оплаты вы принимаете?',
    },
    a: {
      en: 'We accept two payment methods:\n\n• **Wise bank transfer** — fast and low-fee international transfer.\n• **USDT** — ERC-20 is our main network; TRC-20 is also accepted.\n\nPayment details are shown directly on the site during checkout. Once you send payment and upload your proof, we confirm the order from our side.',
      ru: 'Мы принимаем два способа оплаты:\n\n• **Wise банковский перевод** — быстрый и недорогой международный перевод.\n• **USDT** — основная сеть ERC-20, также принимается TRC-20.\n\nРеквизиты для оплаты отображаются прямо на сайте в процессе оформления заказа. После отправки платежа и загрузки подтверждения мы подтвердим заказ с нашей стороны.',
    },
  },
  {
    id: 3,
    q: {
      en: 'How do I place an order?',
      ru: 'Как оформить заказ?',
    },
    a: {
      en: 'Ordering is straightforward:\n\n1. Browse our catalogue and add items to your cart.\n2. Proceed to checkout and fill in your shipping details.\n3. Review our policies and confirm.\n4. You\'ll receive payment instructions — send payment and upload your proof.\n5. We confirm, pack, and ship. You\'ll get tracking once dispatched.',
      ru: 'Оформление заказа очень простое:\n\n1. Просмотрите каталог и добавьте товары в корзину.\n2. Перейдите к оформлению и укажите адрес доставки.\n3. Ознакомьтесь с нашей политикой и подтвердите заказ.\n4. Получите инструкции по оплате — оплатите и загрузите подтверждение.\n5. Мы подтвердим, упакуем и отправим. Трек-номер придёт после отправки.',
    },
  },
  {
    id: 4,
    q: {
      en: 'How can I track my order?',
      ru: 'Как отследить мой заказ?',
    },
    a: {
      en: 'Once your order ships, your tracking number will appear in your account under Order History. You can track via the carrier\'s website directly, or use the **17Track** app — it works for every carrier we use (FedEx, DHL, EMS, UPS).',
      ru: 'Как только заказ будет отправлен, трек-номер появится в вашем аккаунте в разделе «История заказов». Вы можете отслеживать посылку на сайте перевозчика или через приложение **17Track** — оно поддерживает все наши службы доставки (FedEx, DHL, EMS, UPS).',
    },
  },
  {
    id: 5,
    q: {
      en: 'Do you ship worldwide?',
      ru: 'Вы доставляете по всему миру?',
    },
    a: {
      en: 'Yes — we ship to most countries worldwide via trusted international carriers. The one exception is **South Korea**: we are an export-only business and do not ship domestically.\n\nIf you have questions about shipping to a specific country, email us at info@lumeemaison.com.',
      ru: 'Да — мы доставляем в большинство стран мира через надёжных международных перевозчиков. Единственное исключение — **Южная Корея**: мы работаем только на экспорт и не осуществляем внутренние поставки.\n\nЕсли у вас есть вопросы по доставке в конкретную страну, напишите нам на info@lumeemaison.com.',
    },
  },
  {
    id: 6,
    q: {
      en: 'What if my package is seized or lost?',
      ru: 'Что если мою посылку задержали или потеряли?',
    },
    a: {
      en: 'We offer **one complimentary reship** for first shipments if a delivery issue occurs (e.g. lost in transit or seized at customs).\n\nPlease note: reship is available for first orders only and is not available on repeat orders. If your package appears stuck, it may be in customs clearance — this usually resolves within a few days.',
      ru: 'Для первых заказов мы предлагаем **одну бесплатную повторную отправку** в случае проблем с доставкой (потеря или задержание на таможне).\n\nОбратите внимание: повторная отправка доступна только для первых заказов и не распространяется на повторные. Если посылка «застряла», она, скорее всего, проходит таможню — обычно это решается в течение нескольких дней.',
    },
  },
  {
    id: 7,
    q: {
      en: 'How long does delivery take?',
      ru: 'Сколько времени занимает доставка?',
    },
    a: {
      en: 'Once shipped, most deliveries arrive within **3–5 business days**, depending on your destination and customs clearance time. Some made-to-order products require 1–4 business days to prepare before shipping.\n\nYou will be notified by email if your order contains made-to-order items.',
      ru: 'После отправки большинство заказов доставляется в течение **3–5 рабочих дней**, в зависимости от страны назначения и таможенного оформления. Некоторые товары под заказ требуют 1–4 рабочих дня на подготовку перед отправкой.\n\nВы получите уведомление по электронной почте, если ваш заказ содержит такие товары.',
    },
  },
  {
    id: 8,
    q: {
      en: 'Do you offer bulk or wholesale discounts?',
      ru: 'Есть ли оптовые скидки?',
    },
    a: {
      en: 'Yes! We are happy to offer discounts on larger orders. Email us at **info@lumeemaison.com** with the products and quantities you are interested in, and we will prepare a custom quote.\n\nNote: shipping for bulk orders is calculated based on actual volume and weight.',
      ru: 'Да! Мы рады предложить скидки на крупные заказы. Напишите нам на **info@lumeemaison.com** с указанием нужных товаров и количества, и мы подготовим индивидуальное предложение.\n\nОбратите внимание: доставка для оптовых заказов рассчитывается на основе фактического объёма и веса.',
    },
  },
  {
    id: 9,
    q: {
      en: 'Who is "Korestetics Global" on my Wise transfer?',
      ru: 'Кто такой «Korestetics Global» в моём переводе Wise?',
    },
    a: {
      en: 'That is us — **Korestetics Global** is the registered company name behind Lumée Maison. If you see this name as the recipient in your Wise transfer, you are sending to the right place. ✓',
      ru: 'Это мы — **Korestetics Global** является официальным зарегистрированным названием компании Lumée Maison. Если вы видите это имя в качестве получателя в переводе Wise, значит вы отправляете деньги по нужному адресу. ✓',
    },
  },
  {
    id: 10,
    q: {
      en: 'Can I modify my order after placing it?',
      ru: 'Можно ли изменить заказ после оформления?',
    },
    a: {
      en: 'Before checkout, you can freely adjust your cart. If you have already placed and paid for an order, please email **info@lumeemaison.com** as soon as possible with your order number and the changes you need. We will do our best to accommodate, but modifications may not be possible once packing has begun.',
      ru: 'До оформления заказа вы можете свободно изменять корзину. Если заказ уже оформлен и оплачен, напишите как можно скорее на **info@lumeemaison.com**, указав номер заказа и нужные изменения. Мы постараемся помочь, однако изменения могут быть невозможны, если упаковка уже началась.',
    },
  },
];
