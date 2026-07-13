export const siteConfig = {
  name: "Lumière",
  companyName: "Lumée Maison",
  tagline: "Premium Korean Aesthetic Cosmetics",
  description: "B2B wholesale supplier of premium Korean medical-grade aesthetic products. Serving professionals worldwide.",

  contact: {
    email: "info@lumeemaison.com",
    phone: "+82-10-2598-0210",
    whatsapp: "+82-10-2598-0210",
    telegram: "+82-10-2942-7225",
    address: "Incheon, South Korea",

    // Extended lists shown on the /contact page only. The single-value
    // `whatsapp` / `telegram` / `social.whatsapp` / `social.telegram` fields
    // above remain the MAIN number — they back the footer, the floating
    // WhatsApp bubble, the product-detail "ask about" link, home CTAs, and
    // the contact-form submit button.
    whatsappNumbers: [
      "+82-10-2598-0210",
      "+82-10-7383-8710",
      "+82-10-2942-7225",
    ],
    telegramNumbers: [
      "+82-10-2942-7225",
      "+82-10-7383-8710",
    ],
  },

  social: {
    instagram: "https://instagram.com/lumiere_aesthetic",
    whatsapp: "https://wa.me/821025980210",
    telegram: "https://t.me/+821029427225",
  },

  // Which contact channels are SHOWN to customers right now. The numbers above
  // are kept on purpose — to bring a channel back later, just flip its flag to
  // `true` and it reappears everywhere (footer, contact page, home CTAs,
  // floating bubble, product page, payment page). Currently only email (info@)
  // is exposed; WhatsApp / Telegram / phone are hidden.
  contactChannels: {
    email: true,
    whatsapp: false,
    telegram: false,
    phone: false,
  },

  payment: {
    wise: {
      accountName: "Lumée Maison",
      accountDetails: "Please contact us for Wise payment details",
    },
    // AUTHORITATIVE crypto deposit addresses (checkout page + payment emails
    // read these — the old USDT_*_ADDRESS env vars are no longer consulted).
    // Owner-verified against Binance deposit QR screenshots on 2026-07-13;
    // the QR images in public/payment/ picture these exact addresses, so
    // change the image whenever an address changes.
    usdt: {
      erc20: "0xd14fc0aab6118775f2647cbd1ee94bbaaa908095",
      trc20: "TGgjd3PpdUFFSg2xjagtdRbQ5ErfitaESf",
    },
  },

  shipping: {
    fedexWithAccount: 35,
    fedexWithoutAccount: 65,
    fedexNote: "FedEx rates apply to USA only. Contact us for other destinations.",
  },

  // Korea geo-block ON: visitors from KR get a bare 502 on customer-facing
  // pages (admin /manzura and /api/admin bypass). Set to [] to disable.
  restrictedCountries: ["KR"],
};
