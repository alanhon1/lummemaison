export const siteConfig = {
  name: "Lumière",
  companyName: "Lumée Maison",
  tagline: "Premium Korean Aesthetic Cosmetics",
  description: "B2B wholesale supplier of premium Korean medical-grade aesthetic products. Serving professionals worldwide.",

  contact: {
    email: "info@lumeemaison.com",
    phone: "+82-10-2598-0210",
    whatsapp: "+82-10-2598-0210",
    telegram: "@lumiere_aesthetic",
    address: "Seoul, South Korea",

    // Extended lists shown on the /contact page only. The single-value
    // `whatsapp` / `telegram` / `social.whatsapp` fields above remain the
    // MAIN number — they back the footer mailto, floating WhatsApp bubble,
    // product-detail "ask about" link, home CTAs, and the contact-form
    // submit button.
    whatsappNumbers: [
      { display: "+82-10-2598-0210", url: "https://wa.me/821025980210", main: true },
      { display: "+82-10-7383-8710", url: "https://wa.me/821073838710", main: false },
      { display: "+82-10-2942-7225", url: "https://wa.me/821029427225", main: false },
    ],
    telegramExtraNumbers: ["+82-10-7383-8710", "+82-10-2942-7225"],
  },

  social: {
    instagram: "https://instagram.com/lumiere_aesthetic",
    facebook: "https://facebook.com/lumiere_aesthetic",
    whatsapp: "https://wa.me/821025980210",
    telegram: "https://t.me/lumiere_aesthetic",
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

  restrictedCountries: ["KR"],
};
