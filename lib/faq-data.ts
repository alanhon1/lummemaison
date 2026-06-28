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
      en: 'Yes — orders with a product subtotal of **$2,500 or more** automatically unlock a **15% bulk discount** at checkout. You\'ll be offered two options:\n\n• **Pay now** — standard checkout, no discount.\n• **Get 15% off** — pay nothing today; our team emails your full total (15% off plus actual shipping) within **1–3 business days**, then you pay.\n\nFor very large or custom orders, you\'re always welcome to email **info@lumeemaison.com** for a tailored quote.',
      ru: 'Да — заказы с суммой товаров **от $2,500** автоматически получают **оптовую скидку 15%** при оформлении. Вам будут предложены два варианта:\n\n• **Оплатить сейчас** — обычное оформление, без скидки.\n• **Скидка 15%** — сегодня платить не нужно; наша команда пришлёт полную сумму (15% скидка плюс фактическая доставка) в течение **1–3 рабочих дней**, после чего вы оплачиваете.\n\nДля очень крупных или индивидуальных заказов вы всегда можете написать на **info@lumeemaison.com** для персонального расчёта.',
    },
  },
  {
    id: 9,
    q: {
      en: 'Can I modify my order after placing it?',
      ru: 'Можно ли изменить заказ после оформления?',
    },
    a: {
      en: 'Before checkout, you can freely adjust your cart. If you have already placed and paid for an order, please email **info@lumeemaison.com** as soon as possible with your order number and the changes you need. We will do our best to accommodate, but modifications may not be possible once packing has begun.',
      ru: 'До оформления заказа вы можете свободно изменять корзину. Если заказ уже оформлен и оплачен, напишите как можно скорее на **info@lumeemaison.com**, указав номер заказа и нужные изменения. Мы постараемся помочь, однако изменения могут быть невозможны, если упаковка уже началась.',
    },
  },
  {
    id: 10,
    q: {
      en: 'What if my parcel is held at customs?',
      ru: 'Что делать, если посылку задержали на таможне?',
    },
    a: {
      en: 'If a shipment is held, we have to wait for an official update from the carrier before we can act — occasionally there may be a quiet period of up to two weeks with no movement. In many cases customs simply requires the recipient to pay local import duties before the parcel is released. We\'ll help you follow up wherever we can.',
      ru: 'Если посылка задержана, мы можем действовать только после официального обновления от перевозчика — иногда возможен «тихий период» до двух недель без движения. Часто таможня просто требует от получателя оплатить местные импортные пошлины перед выдачей посылки. Мы поможем вам с уточнениями, насколько это возможно.',
    },
  },
  {
    id: 11,
    q: {
      en: 'Will I have to pay import tax or duties?',
      ru: 'Нужно ли платить импортные налоги или пошлины?',
    },
    a: {
      en: 'Any import duties or taxes are set by your destination country and are the responsibility of the recipient. Rates vary by country and product — if you\'re unsure what may apply, please check with your local customs office.',
      ru: 'Любые импортные пошлины и налоги устанавливаются страной назначения и оплачиваются получателем. Ставки зависят от страны и товара — если вы не уверены, уточните в местной таможне.',
    },
  },
  {
    id: 12,
    q: {
      en: 'My tracking says "Delivered" but nothing has arrived.',
      ru: 'В трекинге «Доставлено», но посылка не пришла.',
    },
    a: {
      en: 'This usually resolves within a day or two — couriers sometimes scan a parcel as delivered slightly early, or leave it with a neighbour, building reception, or a safe spot. Please check around your address first, then contact your local courier with your tracking number. If it\'s still missing after that, reach out to us and we\'ll help you follow up.',
      ru: 'Обычно это решается за день-два — курьеры иногда отмечают доставку чуть раньше или оставляют посылку у соседей, на ресепшене или в безопасном месте. Сначала проверьте вокруг вашего адреса, затем свяжитесь с местным курьером, указав трек-номер. Если посылка так и не найдена, напишите нам — мы поможем разобраться.',
    },
  },
  {
    id: 13,
    q: {
      en: 'My box arrived damaged.',
      ru: 'Коробка пришла повреждённой.',
    },
    a: {
      en: 'We\'re sorry if your parcel arrived in poor condition. Please photograph the outer box and the contents as soon as it arrives — ideally within **48 hours** of delivery — and send the images to **info@lumeemaison.com**. We\'ll review each case individually and advise on the best next step.',
      ru: 'Сожалеем, если посылка пришла в плохом состоянии. Сфотографируйте внешнюю коробку и содержимое сразу после получения — желательно в течение **48 часов** — и отправьте снимки на **info@lumeemaison.com**. Мы рассмотрим каждый случай индивидуально и подскажем дальнейшие шаги.',
    },
  },
  {
    id: 14,
    q: {
      en: 'Can you guarantee a specific delivery date?',
      ru: 'Можете ли вы гарантировать конкретную дату доставки?',
    },
    a: {
      en: 'We\'re not able to promise an exact delivery date. Transit times are estimates, and the final leg depends on customs and your local courier. We\'ll always give you the most accurate window we can.',
      ru: 'Мы не можем гарантировать точную дату доставки. Сроки являются ориентировочными, а последний этап зависит от таможни и местного курьера. Мы всегда сообщаем максимально точный диапазон.',
    },
  },
  {
    id: 15,
    q: {
      en: 'Do you provide medical advice?',
      ru: 'Предоставляете ли вы медицинские консультации?',
    },
    a: {
      en: 'Lumée Maison supplies professional-grade products to qualified, licensed practitioners. We can share product specifications and manufacturer information, but we cannot give clinical or medical advice. Always follow the manufacturer\'s instructions and rely on your own professional training, or consult a qualified healthcare professional.',
      ru: 'Lumée Maison поставляет продукцию профессионального уровня квалифицированным лицензированным специалистам. Мы можем предоставить характеристики продукта и информацию производителя, но не даём клинических или медицинских рекомендаций. Всегда следуйте инструкциям производителя и опирайтесь на собственную профессиональную подготовку или консультацию квалифицированного специалиста.',
    },
  },
  {
    id: 16,
    q: {
      en: 'Can I combine two different products together?',
      ru: 'Можно ли смешивать два разных продукта?',
    },
    a: {
      en: 'We don\'t recommend it. Products from different manufacturers aren\'t designed to be mixed, so we can\'t guarantee safety or results if you combine them. In our experience, visible results from a single product typically take two weeks to a month. If you\'re considering it, please proceed with caution and professional judgement.',
      ru: 'Мы не рекомендуем этого. Продукты разных производителей не предназначены для смешивания, поэтому мы не можем гарантировать безопасность или результат. По нашему опыту, заметный результат от одного продукта обычно проявляется через две недели — месяц. Если вы всё же рассматриваете это, действуйте осторожно и на основе профессионального суждения.',
    },
  },
  {
    id: 17,
    q: {
      en: 'How long do products last? What about expiry?',
      ru: 'Какой срок годности у продуктов?',
    },
    a: {
      en: 'Each product\'s shelf life and expiry date are printed on its packaging. We ship items with a reasonable remaining shelf life and store everything under proper conditions until dispatch. Please store your products as directed on the label.',
      ru: 'Срок годности и дата истечения указаны на упаковке каждого продукта. Мы отправляем товары с разумным остаточным сроком годности и храним всё в надлежащих условиях до отправки. Пожалуйста, храните продукты согласно указаниям на этикетке.',
    },
  },
];
