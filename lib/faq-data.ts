export interface FaqItem {
  id: number;
  q: { en: string; ru: string; fr: string; es: string };
  a: { en: string; ru: string; fr: string; es: string };
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 1,
    q: {
      en: 'How much is shipping?',
      ru: 'Сколько стоит доставка?',
      fr: 'Combien coûte la livraison ?',
      es: '¿Cuánto cuesta el envío?',
    },
    a: {
      en: 'Shipping is $35 flat rate from South Korea to anywhere in the world. We ship via FedEx, DHL, EMS, or UPS — whichever is fastest and most reliable for your destination.\n\nUSA note: A free FedEx account number is required for standard $35 shipping. Without one, FedEx Priority is available at $65.',
      ru: 'Доставка стоит $35 фиксированно из Южной Кореи в любую точку мира. Мы отправляем через FedEx, DHL, EMS или UPS — в зависимости от вашей страны.\n\nДля клиентов из США: требуется бесплатный номер аккаунта FedEx. Без него доступна доставка FedEx Priority за $65.',
      fr: `La livraison est à un tarif unique de $35 depuis la Corée du Sud vers le monde entier. Nous expédions via FedEx, DHL, EMS ou UPS — selon l'option la plus rapide et la plus fiable pour votre destination.\n\nNote pour les États-Unis : un numéro de compte FedEx gratuit est requis pour la livraison standard à $35. À défaut, FedEx Priority est disponible à $65.`,
      es: `El envío tiene una tarifa única de $35 desde Corea del Sur a cualquier parte del mundo. Enviamos mediante FedEx, DHL, EMS o UPS, según la opción más rápida y fiable para su destino.\n\nNota para EE. UU.: se requiere un número de cuenta FedEx gratuito para el envío estándar de $35. Sin él, FedEx Priority está disponible por $65.`,
    },
  },
  {
    id: 2,
    q: {
      en: 'What payment methods do you accept?',
      ru: 'Какие способы оплаты вы принимаете?',
      fr: 'Quels moyens de paiement acceptez-vous ?',
      es: '¿Qué métodos de pago aceptan?',
    },
    a: {
      en: 'We accept two payment methods:\n\n• **Wise bank transfer** — fast and low-fee international transfer.\n• **USDT** — ERC-20 is our main network; TRC-20 is also accepted.\n\nPayment details are shown directly on the site during checkout. Once you send payment and upload your proof, we confirm the order from our side.',
      ru: 'Мы принимаем два способа оплаты:\n\n• **Wise банковский перевод** — быстрый и недорогой международный перевод.\n• **USDT** — основная сеть ERC-20, также принимается TRC-20.\n\nРеквизиты для оплаты отображаются прямо на сайте в процессе оформления заказа. После отправки платежа и загрузки подтверждения мы подтвердим заказ с нашей стороны.',
      fr: `Nous acceptons deux moyens de paiement :\n\n• **Virement bancaire Wise** — un virement international rapide et à faibles frais.\n• **USDT** — le réseau ERC-20 est notre réseau principal ; le TRC-20 est également accepté.\n\nLes coordonnées de paiement s'affichent directement sur le site lors du paiement. Une fois le paiement envoyé et votre justificatif téléversé, nous confirmons la commande de notre côté.`,
      es: `Aceptamos dos métodos de pago:\n\n• **Transferencia bancaria Wise** — una transferencia internacional rápida y con comisiones bajas.\n• **USDT** — la red ERC-20 es nuestra red principal; también se acepta TRC-20.\n\nLos datos de pago se muestran directamente en el sitio durante el proceso de compra. Una vez que envíe el pago y suba su comprobante, confirmamos el pedido por nuestra parte.`,
    },
  },
  {
    id: 3,
    q: {
      en: 'How do I place an order?',
      ru: 'Как оформить заказ?',
      fr: 'Comment passer une commande ?',
      es: '¿Cómo realizo un pedido?',
    },
    a: {
      en: 'Ordering is straightforward:\n\n1. Browse our catalogue and add items to your cart.\n2. Proceed to checkout and fill in your shipping details.\n3. Review our policies and confirm.\n4. You\'ll receive payment instructions — send payment and upload your proof.\n5. We confirm, pack, and ship. You\'ll get tracking once dispatched.',
      ru: 'Оформление заказа очень простое:\n\n1. Просмотрите каталог и добавьте товары в корзину.\n2. Перейдите к оформлению и укажите адрес доставки.\n3. Ознакомьтесь с нашей политикой и подтвердите заказ.\n4. Получите инструкции по оплате — оплатите и загрузите подтверждение.\n5. Мы подтвердим, упакуем и отправим. Трек-номер придёт после отправки.',
      fr: `Passer commande est simple :\n\n1. Parcourez notre catalogue et ajoutez des articles à votre panier.\n2. Passez au paiement et renseignez vos informations de livraison.\n3. Consultez nos conditions et confirmez.\n4. Vous recevrez les instructions de paiement — effectuez le paiement et téléversez votre justificatif.\n5. Nous confirmons, emballons et expédions. Vous recevrez le suivi dès l'expédition.`,
      es: `Realizar un pedido es sencillo:\n\n1. Explore nuestro catálogo y añada artículos al carrito.\n2. Vaya al pago e introduzca sus datos de envío.\n3. Revise nuestras políticas y confirme.\n4. Recibirá las instrucciones de pago: realice el pago y suba su comprobante.\n5. Confirmamos, embalamos y enviamos. Recibirá el seguimiento una vez despachado.`,
    },
  },
  {
    id: 4,
    q: {
      en: 'How can I track my order?',
      ru: 'Как отследить мой заказ?',
      fr: 'Comment puis-je suivre ma commande ?',
      es: '¿Cómo puedo seguir mi pedido?',
    },
    a: {
      en: 'Once your order ships, your tracking number will appear in your account under Order History. You can track via the carrier\'s website directly, or use the **17Track** app — it works for every carrier we use (FedEx, DHL, EMS, UPS).',
      ru: 'Как только заказ будет отправлен, трек-номер появится в вашем аккаунте в разделе «История заказов». Вы можете отслеживать посылку на сайте перевозчика или через приложение **17Track** — оно поддерживает все наши службы доставки (FedEx, DHL, EMS, UPS).',
      fr: `Dès l'expédition de votre commande, votre numéro de suivi apparaît dans votre compte, sous Historique des commandes. Vous pouvez suivre votre colis directement sur le site du transporteur ou via l'application **17Track** — elle fonctionne avec tous les transporteurs que nous utilisons (FedEx, DHL, EMS, UPS).`,
      es: `Una vez que su pedido se envíe, su número de seguimiento aparecerá en su cuenta, en Historial de pedidos. Puede hacer el seguimiento directamente en el sitio del transportista o mediante la aplicación **17Track**, que funciona con todos los transportistas que usamos (FedEx, DHL, EMS, UPS).`,
    },
  },
  {
    id: 5,
    q: {
      en: 'Do you ship worldwide?',
      ru: 'Вы доставляете по всему миру?',
      fr: 'Livrez-vous dans le monde entier ?',
      es: '¿Hacen envíos a todo el mundo?',
    },
    a: {
      en: 'Yes — we ship to most countries worldwide via trusted international carriers. The one exception is **South Korea**: we are an export-only business and do not ship domestically.\n\nIf you have questions about shipping to a specific country, email us at info@lumeemaison.com.',
      ru: 'Да — мы доставляем в большинство стран мира через надёжных международных перевозчиков. Единственное исключение — **Южная Корея**: мы работаем только на экспорт и не осуществляем внутренние поставки.\n\nЕсли у вас есть вопросы по доставке в конкретную страну, напишите нам на info@lumeemaison.com.',
      fr: `Oui — nous livrons dans la plupart des pays du monde via des transporteurs internationaux de confiance. La seule exception est la **Corée du Sud** : nous sommes une entreprise dédiée à l'export et ne livrons pas sur le marché intérieur.\n\nPour toute question sur la livraison vers un pays précis, écrivez-nous à info@lumeemaison.com.`,
      es: `Sí — enviamos a la mayoría de los países del mundo mediante transportistas internacionales de confianza. La única excepción es **Corea del Sur**: somos una empresa exclusivamente de exportación y no realizamos envíos nacionales.\n\nSi tiene preguntas sobre el envío a un país concreto, escríbanos a info@lumeemaison.com.`,
    },
  },
  {
    id: 6,
    q: {
      en: 'What if my package is seized or lost?',
      ru: 'Что если мою посылку задержали или потеряли?',
      fr: 'Que se passe-t-il si mon colis est saisi ou perdu ?',
      es: '¿Qué ocurre si mi paquete es retenido o se pierde?',
    },
    a: {
      en: 'We offer **one complimentary reship** for first shipments if a delivery issue occurs (e.g. lost in transit or seized at customs).\n\nPlease note: reship is available for first orders only and is not available on repeat orders. If your package appears stuck, it may be in customs clearance — this usually resolves within a few days.',
      ru: 'Для первых заказов мы предлагаем **одну бесплатную повторную отправку** в случае проблем с доставкой (потеря или задержание на таможне).\n\nОбратите внимание: повторная отправка доступна только для первых заказов и не распространяется на повторные. Если посылка «застряла», она, скорее всего, проходит таможню — обычно это решается в течение нескольких дней.',
      fr: `Nous offrons **une réexpédition gratuite** pour les premières commandes en cas de problème de livraison (par exemple perte en transit ou saisie en douane).\n\nÀ noter : la réexpédition est réservée aux premières commandes et n'est pas disponible pour les commandes suivantes. Si votre colis semble bloqué, il est probablement en cours de dédouanement — ce qui se résout généralement en quelques jours.`,
      es: `Ofrecemos **un reenvío gratuito** para los primeros pedidos si surge un problema de entrega (por ejemplo, pérdida en tránsito o retención en aduana).\n\nTenga en cuenta: el reenvío solo está disponible para los primeros pedidos, no para pedidos posteriores. Si su paquete parece detenido, es probable que esté en proceso de despacho aduanero, lo que suele resolverse en pocos días.`,
    },
  },
  {
    id: 7,
    q: {
      en: 'How long does delivery take?',
      ru: 'Сколько времени занимает доставка?',
      fr: 'Combien de temps prend la livraison ?',
      es: '¿Cuánto tarda la entrega?',
    },
    a: {
      en: 'Once shipped, most deliveries arrive within **3–5 business days**, depending on your destination and customs clearance time. Some made-to-order products require 1–4 business days to prepare before shipping.\n\nYou will be notified by email if your order contains made-to-order items.',
      ru: 'После отправки большинство заказов доставляется в течение **3–5 рабочих дней**, в зависимости от страны назначения и таможенного оформления. Некоторые товары под заказ требуют 1–4 рабочих дня на подготовку перед отправкой.\n\nВы получите уведомление по электронной почте, если ваш заказ содержит такие товары.',
      fr: `Une fois expédiée, la plupart des commandes arrivent sous **3 à 5 jours ouvrés**, selon votre destination et le délai de dédouanement. Certains produits fabriqués à la commande nécessitent 1 à 4 jours ouvrés de préparation avant l'expédition.\n\nVous serez informé par e-mail si votre commande contient des articles fabriqués à la commande.`,
      es: `Una vez enviada, la mayoría de las entregas llegan en **3 a 5 días hábiles**, según su destino y el tiempo de despacho en aduana. Algunos productos fabricados por encargo requieren de 1 a 4 días hábiles de preparación antes del envío.\n\nSe le notificará por correo electrónico si su pedido incluye artículos fabricados por encargo.`,
    },
  },
  {
    id: 8,
    q: {
      en: 'Do you offer bulk or wholesale discounts?',
      ru: 'Есть ли оптовые скидки?',
      fr: 'Proposez-vous des remises pour les commandes en gros ?',
      es: '¿Ofrecen descuentos por volumen o al por mayor?',
    },
    a: {
      en: 'Yes — orders with a product subtotal of **$2,500 or more** automatically unlock a **15% bulk discount** at checkout. You\'ll be offered two options:\n\n• **Pay now** — standard checkout, no discount.\n• **Get 15% off** — pay nothing today; our team emails your full total (15% off plus actual shipping) within **1–3 business days**, then you pay.\n\nFor very large or custom orders, you\'re always welcome to email **info@lumeemaison.com** for a tailored quote.',
      ru: 'Да — заказы с суммой товаров **от $2,500** автоматически получают **оптовую скидку 15%** при оформлении. Вам будут предложены два варианта:\n\n• **Оплатить сейчас** — обычное оформление, без скидки.\n• **Скидка 15%** — сегодня платить не нужно; наша команда пришлёт полную сумму (15% скидка плюс фактическая доставка) в течение **1–3 рабочих дней**, после чего вы оплачиваете.\n\nДля очень крупных или индивидуальных заказов вы всегда можете написать на **info@lumeemaison.com** для персонального расчёта.',
      fr: `Oui — les commandes dont le sous-total produits atteint **$2,500 ou plus** débloquent automatiquement une **remise de 15 % sur volume** au paiement. Deux options vous sont alors proposées :\n\n• **Payer maintenant** — paiement standard, sans remise.\n• **Bénéficier de 15 % de remise** — vous ne payez rien aujourd'hui ; notre équipe vous envoie le total complet (15 % de remise plus les frais de livraison réels) sous **1 à 3 jours ouvrés**, puis vous réglez.\n\nPour les très grandes commandes ou les demandes sur mesure, vous pouvez toujours écrire à **info@lumeemaison.com** pour un devis personnalisé.`,
      es: `Sí — los pedidos con un subtotal de productos de **$2,500 o más** activan automáticamente un **15 % de descuento por volumen** al finalizar la compra. Se le ofrecerán dos opciones:\n\n• **Pagar ahora** — compra estándar, sin descuento.\n• **Obtener un 15 % de descuento** — no paga nada hoy; nuestro equipo le envía el total completo (15 % de descuento más el envío real) en **1 a 3 días hábiles**, y luego paga.\n\nPara pedidos muy grandes o personalizados, siempre puede escribir a **info@lumeemaison.com** para un presupuesto a medida.`,
    },
  },
  {
    id: 9,
    q: {
      en: 'Can I modify my order after placing it?',
      ru: 'Можно ли изменить заказ после оформления?',
      fr: 'Puis-je modifier ma commande après l\'avoir passée ?',
      es: '¿Puedo modificar mi pedido después de realizarlo?',
    },
    a: {
      en: 'Before checkout, you can freely adjust your cart. If you have already placed and paid for an order, please email **info@lumeemaison.com** as soon as possible with your order number and the changes you need. We will do our best to accommodate, but modifications may not be possible once packing has begun.',
      ru: 'До оформления заказа вы можете свободно изменять корзину. Если заказ уже оформлен и оплачен, напишите как можно скорее на **info@lumeemaison.com**, указав номер заказа и нужные изменения. Мы постараемся помочь, однако изменения могут быть невозможны, если упаковка уже началась.',
      fr: `Avant le paiement, vous pouvez modifier librement votre panier. Si vous avez déjà passé et payé une commande, écrivez dès que possible à **info@lumeemaison.com** en indiquant votre numéro de commande et les modifications souhaitées. Nous ferons de notre mieux pour vous aider, mais les modifications peuvent ne plus être possibles une fois l'emballage commencé.`,
      es: `Antes de finalizar la compra, puede ajustar libremente su carrito. Si ya ha realizado y pagado un pedido, escriba lo antes posible a **info@lumeemaison.com** con su número de pedido y los cambios que necesita. Haremos todo lo posible por ayudar, pero es posible que las modificaciones ya no se puedan hacer una vez iniciado el embalaje.`,
    },
  },
  {
    id: 10,
    q: {
      en: 'What if my parcel is held at customs?',
      ru: 'Что делать, если посылку задержали на таможне?',
      fr: 'Que faire si mon colis est retenu en douane ?',
      es: '¿Qué hago si mi paquete queda retenido en aduana?',
    },
    a: {
      en: 'If a shipment is held, we have to wait for an official update from the carrier before we can act — occasionally there may be a quiet period of up to two weeks with no movement. In many cases customs simply requires the recipient to pay local import duties before the parcel is released. We\'ll help you follow up wherever we can.',
      ru: 'Если посылка задержана, мы можем действовать только после официального обновления от перевозчика — иногда возможен «тихий период» до двух недель без движения. Часто таможня просто требует от получателя оплатить местные импортные пошлины перед выдачей посылки. Мы поможем вам с уточнениями, насколько это возможно.',
      fr: `Si un envoi est retenu, nous devons attendre une mise à jour officielle du transporteur avant de pouvoir agir — il peut occasionnellement y avoir une période sans mouvement allant jusqu'à deux semaines. Dans bien des cas, la douane demande simplement au destinataire de régler les droits d'importation locaux avant de libérer le colis. Nous vous aiderons dans le suivi autant que possible.`,
      es: `Si un envío queda retenido, debemos esperar una actualización oficial del transportista antes de poder actuar; en ocasiones puede haber un periodo sin movimiento de hasta dos semanas. En muchos casos, la aduana simplemente exige que el destinatario pague los aranceles de importación locales antes de liberar el paquete. Le ayudaremos con el seguimiento en todo lo que podamos.`,
    },
  },
  {
    id: 11,
    q: {
      en: 'Will I have to pay import tax or duties?',
      ru: 'Нужно ли платить импортные налоги или пошлины?',
      fr: 'Devrai-je payer des taxes ou des droits d\'importation ?',
      es: '¿Tendré que pagar impuestos o aranceles de importación?',
    },
    a: {
      en: 'Any import duties or taxes are set by your destination country and are the responsibility of the recipient. Rates vary by country and product — if you\'re unsure what may apply, please check with your local customs office.',
      ru: 'Любые импортные пошлины и налоги устанавливаются страной назначения и оплачиваются получателем. Ставки зависят от страны и товара — если вы не уверены, уточните в местной таможне.',
      fr: `Les droits et taxes d'importation sont fixés par votre pays de destination et sont à la charge du destinataire. Les taux varient selon le pays et le produit — en cas de doute sur ce qui s'applique, veuillez vous renseigner auprès de votre bureau de douane local.`,
      es: `Cualquier arancel o impuesto de importación lo establece su país de destino y corre a cargo del destinatario. Las tarifas varían según el país y el producto; si no está seguro de lo que puede aplicarse, consulte con su oficina de aduanas local.`,
    },
  },
  {
    id: 12,
    q: {
      en: 'My tracking says "Delivered" but nothing has arrived.',
      ru: 'В трекинге «Доставлено», но посылка не пришла.',
      fr: 'Mon suivi indique « Livré », mais rien n\'est arrivé.',
      es: 'Mi seguimiento dice «Entregado», pero no ha llegado nada.',
    },
    a: {
      en: 'This usually resolves within a day or two — couriers sometimes scan a parcel as delivered slightly early, or leave it with a neighbour, building reception, or a safe spot. Please check around your address first, then contact your local courier with your tracking number. If it\'s still missing after that, reach out to us and we\'ll help you follow up.',
      ru: 'Обычно это решается за день-два — курьеры иногда отмечают доставку чуть раньше или оставляют посылку у соседей, на ресепшене или в безопасном месте. Сначала проверьте вокруг вашего адреса, затем свяжитесь с местным курьером, указав трек-номер. Если посылка так и не найдена, напишите нам — мы поможем разобраться.',
      fr: `Cela se résout généralement en un jour ou deux — il arrive que les transporteurs scannent un colis comme livré un peu en avance, ou le laissent chez un voisin, à l'accueil de l'immeuble ou dans un endroit sûr. Vérifiez d'abord autour de votre adresse, puis contactez votre transporteur local avec votre numéro de suivi. Si le colis reste introuvable, contactez-nous et nous vous aiderons dans le suivi.`,
      es: `Esto suele resolverse en uno o dos días: a veces los transportistas escanean un paquete como entregado un poco antes, o lo dejan con un vecino, en la recepción del edificio o en un lugar seguro. Compruebe primero los alrededores de su dirección y luego contacte a su transportista local con su número de seguimiento. Si aún así no aparece, escríbanos y le ayudaremos a gestionarlo.`,
    },
  },
  {
    id: 13,
    q: {
      en: 'My box arrived damaged.',
      ru: 'Коробка пришла повреждённой.',
      fr: 'Ma boîte est arrivée endommagée.',
      es: 'Mi caja llegó dañada.',
    },
    a: {
      en: 'We\'re sorry if your parcel arrived in poor condition. Please photograph the outer box and the contents as soon as it arrives — ideally within **48 hours** of delivery — and send the images to **info@lumeemaison.com**. We\'ll review each case individually and advise on the best next step.',
      ru: 'Сожалеем, если посылка пришла в плохом состоянии. Сфотографируйте внешнюю коробку и содержимое сразу после получения — желательно в течение **48 часов** — и отправьте снимки на **info@lumeemaison.com**. Мы рассмотрим каждый случай индивидуально и подскажем дальнейшие шаги.',
      fr: `Nous sommes désolés si votre colis est arrivé en mauvais état. Photographiez la boîte extérieure et le contenu dès la réception — idéalement dans les **48 heures** suivant la livraison — et envoyez les images à **info@lumeemaison.com**. Nous examinerons chaque cas individuellement et vous indiquerons la meilleure marche à suivre.`,
      es: `Lamentamos que su paquete haya llegado en mal estado. Fotografíe la caja exterior y el contenido en cuanto lo reciba —idealmente dentro de las **48 horas** posteriores a la entrega— y envíe las imágenes a **info@lumeemaison.com**. Revisaremos cada caso de forma individual y le indicaremos el mejor paso a seguir.`,
    },
  },
  {
    id: 14,
    q: {
      en: 'Can you guarantee a specific delivery date?',
      ru: 'Можете ли вы гарантировать конкретную дату доставки?',
      fr: 'Pouvez-vous garantir une date de livraison précise ?',
      es: '¿Pueden garantizar una fecha de entrega concreta?',
    },
    a: {
      en: 'We\'re not able to promise an exact delivery date. Transit times are estimates, and the final leg depends on customs and your local courier. We\'ll always give you the most accurate window we can.',
      ru: 'Мы не можем гарантировать точную дату доставки. Сроки являются ориентировочными, а последний этап зависит от таможни и местного курьера. Мы всегда сообщаем максимально точный диапазон.',
      fr: `Nous ne pouvons pas promettre une date de livraison exacte. Les délais de transit sont des estimations, et la dernière étape dépend de la douane et de votre transporteur local. Nous vous communiquerons toujours la fourchette la plus précise possible.`,
      es: `No podemos prometer una fecha de entrega exacta. Los tiempos de tránsito son estimaciones, y el tramo final depende de la aduana y de su transportista local. Siempre le daremos el plazo más preciso posible.`,
    },
  },
  {
    id: 15,
    q: {
      en: 'Do you provide medical advice?',
      ru: 'Предоставляете ли вы медицинские консультации?',
      fr: 'Fournissez-vous des conseils médicaux ?',
      es: '¿Ofrecen asesoramiento médico?',
    },
    a: {
      en: 'Lumée Maison supplies professional-grade products to qualified, licensed practitioners. We can share product specifications and manufacturer information, but we cannot give clinical or medical advice. Always follow the manufacturer\'s instructions and rely on your own professional training, or consult a qualified healthcare professional.',
      ru: 'Lumée Maison поставляет продукцию профессионального уровня квалифицированным лицензированным специалистам. Мы можем предоставить характеристики продукта и информацию производителя, но не даём клинических или медицинских рекомендаций. Всегда следуйте инструкциям производителя и опирайтесь на собственную профессиональную подготовку или консультацию квалифицированного специалиста.',
      fr: `Lumée Maison fournit des produits de qualité professionnelle à des praticiens qualifiés et agréés. Nous pouvons communiquer les spécifications des produits et les informations du fabricant, mais nous ne pouvons pas donner de conseils cliniques ou médicaux. Suivez toujours les instructions du fabricant et fiez-vous à votre propre formation professionnelle, ou consultez un professionnel de santé qualifié.`,
      es: `Lumée Maison suministra productos de nivel profesional a profesionales cualificados y con licencia. Podemos compartir las especificaciones del producto y la información del fabricante, pero no podemos dar consejos clínicos ni médicos. Siga siempre las instrucciones del fabricante y confíe en su propia formación profesional, o consulte a un profesional sanitario cualificado.`,
    },
  },
  {
    id: 16,
    q: {
      en: 'Can I combine two different products together?',
      ru: 'Можно ли смешивать два разных продукта?',
      fr: 'Puis-je combiner deux produits différents ?',
      es: '¿Puedo combinar dos productos diferentes?',
    },
    a: {
      en: 'We don\'t recommend it. Products from different manufacturers aren\'t designed to be mixed, so we can\'t guarantee safety or results if you combine them. In our experience, visible results from a single product typically take two weeks to a month. If you\'re considering it, please proceed with caution and professional judgement.',
      ru: 'Мы не рекомендуем этого. Продукты разных производителей не предназначены для смешивания, поэтому мы не можем гарантировать безопасность или результат. По нашему опыту, заметный результат от одного продукта обычно проявляется через две недели — месяц. Если вы всё же рассматриваете это, действуйте осторожно и на основе профессионального суждения.',
      fr: `Nous ne le recommandons pas. Les produits de fabricants différents ne sont pas conçus pour être mélangés ; nous ne pouvons donc garantir ni la sécurité ni les résultats en cas de combinaison. D'après notre expérience, les résultats visibles d'un seul produit apparaissent généralement en deux semaines à un mois. Si vous l'envisagez, procédez avec prudence et selon votre jugement professionnel.`,
      es: `No lo recomendamos. Los productos de distintos fabricantes no están diseñados para mezclarse, por lo que no podemos garantizar la seguridad ni los resultados si los combina. Según nuestra experiencia, los resultados visibles de un solo producto suelen tardar de dos semanas a un mes. Si está considerándolo, proceda con precaución y criterio profesional.`,
    },
  },
  {
    id: 17,
    q: {
      en: 'How long do products last? What about expiry?',
      ru: 'Какой срок годности у продуктов?',
      fr: 'Quelle est la durée de conservation des produits ? Qu\'en est-il de la péremption ?',
      es: '¿Cuánto duran los productos? ¿Y la caducidad?',
    },
    a: {
      en: 'Each product\'s shelf life and expiry date are printed on its packaging. We ship items with a reasonable remaining shelf life and store everything under proper conditions until dispatch. Please store your products as directed on the label.',
      ru: 'Срок годности и дата истечения указаны на упаковке каждого продукта. Мы отправляем товары с разумным остаточным сроком годности и храним всё в надлежащих условиях до отправки. Пожалуйста, храните продукты согласно указаниям на этикетке.',
      fr: `La durée de conservation et la date de péremption de chaque produit sont imprimées sur son emballage. Nous expédions des articles disposant d'une durée de conservation restante raisonnable et conservons tout dans des conditions appropriées jusqu'à l'expédition. Veuillez conserver vos produits conformément aux indications de l'étiquette.`,
      es: `La vida útil y la fecha de caducidad de cada producto están impresas en su envase. Enviamos artículos con una vida útil restante razonable y almacenamos todo en condiciones adecuadas hasta el despacho. Conserve sus productos según las indicaciones de la etiqueta.`,
    },
  },
];
