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

  payment: {
    wise: {
      accountName: "Lumée Maison",
      accountDetails: "Please contact us for Wise payment details",
    },
    usdt: {
      network: "TRC-20",
      address: "TRC20_ADDRESS_PLACEHOLDER",
    },
  },

  shipping: {
    fedexWithAccount: 35,
    fedexWithoutAccount: 65,
    fedexNote: "FedEx rates apply to USA only. Contact us for other destinations.",
  },

  // Temporarily empty so the storefront is visible from Korea too.
  // Restore to ["KR"] to re-enable the Korea geo-block.
  restrictedCountries: [],
};
