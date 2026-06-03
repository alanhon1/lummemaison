// Manual alias map for the May stock seed.
//
// Maps xlsx product name (post-normalize: UPPER + trim + whitespace collapsed
// to single space) → catalogue product id from data/products.json. The seed
// script consults this BEFORE the strict catalogue-name match, so each entry
// here moves an xlsx row out of the 999-default bucket and into real-qty.
//
// Curated by hand for high-confidence pairs only — same product, just a
// formatting or sub-name difference (package size in brackets, "100U" vs
// "100 units", typo'd catalogue name, etc.). When in doubt: leave it out and
// let the row fall through to the 999 default. Wrong mapping = wrong product
// sold out / oversold.
//
// At startup the seed script validates: every key here normalizes to itself,
// and every target id exists in data/products.json. Edit freely.

export const STOCK_ALIASES: Record<string, number> = {
  // Toxins — xlsx uses "100U" / "100 UNIT", catalogue uses "100 units".
  'BOTULAX 100U': 296,
  'BOTULAX 200U': 297,
  'BOTULAX 300U': 298,
  'CORETOX 100 UNIT': 320,
  'INNOTOX 50U': 301,
  'INNOTOX 100U': 302,
  'METOX 100U': 299,
  'NABOTA 100U': 303,
  'NABOTA 200U': 304,
  'RENTOX 100U': 312,
  'RENTOX 200U': 311,
  'ZEROTOX 100 UNIT': 319,
  'SELATOX 10': 116,

  // xlsx carries package size in brackets, catalogue omits it.
  'ACLEAN GEL [20G]': 135,
  'ACNON CREAM [13G]': 137,
  'AZALEA CREAM [30G]': 138,
  'BELISSIMA CE [365MG]': 330,
  'CURENEX EXO BRIGHTENING CREAM [50ML]': 211,
  'D PANSEPTIC CREAM [30G]': 155,
  'D-PANTHENOL CREAM [50G]': 165,
  'DERMAGEN CICAROWN CREAM [50G]': 228,
  'DOXY TAB [30]': 359,
  'DR.PICOS RMV REPAIR CREAM [200G]': 217,
  'DR.PICOS UREANOL CREAM [200G]': 218,
  'EASYEF [5G]': 164,
  'EXOSIA SKIN BOOSTER [#1]': 234,
  'EXOSIA SKIN BOOSTER [#2]': 235,
  'GLUTAONE INJ. [1200MG]': 344,
  'LIDCAIN CREAM [500G]': 372,
  'MELANOSA CREAM 4% [30G]': 153,
  'MELATONING CREAM [30G]': 162,
  'REJUVENEX PDRN CREAM [10G]': 166,

  // xlsx appends size/quantity as trailing tokens.
  'ACEPAIN INJ 100ML': 352,
  'ACLEAN 2% BODY ACNE TREATMENT SPRAY 100ML': 136,
  'ASCORBIC INJ (HUONS)': 350,
  'BERACAINE SPRAY 50ML': 374,
  'BM HID INJ 200,000 IU / 1 ML VIAL 1 ML × 10 VIALS': 357,
  'CAMELLEX CAMELLIA EXO NO5': 199,
  'CARTIN INJ (L-CARNITINE) 1000MG 5ML X 10 AMP': 369,
  'CELLEXO BIO-CELLULOSE EXOSOME MASK 30 ML X 5 MASKS': 171,
  'DERMAGEN BICHAEAHN PORE TONING CREAM 80G': 230,
  'DERMAGEN EGENSIA CREAM 50G': 215,
  'DERMAGEN KLARGEN SOLUTION 50ML': 194,
  'DERMAGEN RM REPAIR CREAM 200GR': 224,
  'DERMAGEN SCARGEL+ 15G': 225,
  'DOXY TAB 300': 358,
  'DR. PICOS EGENCICA CREAM 60G': 216,
  'EU.MEI SUN ESSENCE 50G': 190,
  'G2 OIL LIFTING PACK (WRINKLE MASK PACK CREAM) 50ML': 188,
  'GLUTATINE TAB 100G': 345,
  'GTM BALANCE CLEANSING GEL 150ML': 242,
  'GTM MELA DUAL DAY & NIGHT CREAM 75 ML': 245,
  'GTM PDRENZA CREAM 50ML': 244,
  'GTM PDRENZA SERUM 50ML': 243,
  'INVU REPARATIVE BB 30ML': 185,
  'NEO PRO CREAM 450G': 377,
  'NOSCARNA GEL 20G': 167,
  'REJURAN CALMING LIP BALM 3.7G': 174,
  'REPIDA AZULENE H9 DERMA PLUS BOOSTER CREAM 50 ML': 187,
  'REPIDA BODY TONE-UP RADIANCE SERUM 200 ML': 186,
  'REPIDA CLEARNEST INTENSIVE FOAM CLEANSER 150 ML': 133,
  'SALINE 20 ML': 323,
  'WELLSCAINE CREAM 500G': 373,
  'WELLSCAINE PLUS 500G': 371,
  'WHEAT GERM AMPOULE 50G': 189,

  // Punctuation / abbreviation differences.
  'CHIOCTOCIN INJ': 370,
  'DR.LIPO PRIME': 291,
  'HIDR INJ': 326,
  'LIDOCAINE HCI INJ 2%': 384,
  'MASI INJ 10%': 324,
  'MASK SHEETS FOR FACE': 183,
  'MULTI VITA INJ': 353,
  'PLACENTEX INJ': 327,
  'POWER HEALER': 79,
  'REVITALEX INJ': 325,
  'VITA D BONE': 356,

  // Short form / sub-brand carried only on one side.
  'ASCE SUNSHINE CUSHION PRO SPF50+ PA++++': 170,
  'BEADSMAX CLASSIC S': 56,
  'CURENEX DAILY CARE SKINBOOSTER PDRN (SERUM)': 206,
  'CURENEX SHEER SUNSCREEN SPF50+ PA+++': 214,
  'DERMAGEN ACSSAK ACNE': 139,
  'DERMAGEN KLARGEN LACTOBATH CLEANSER': 193,
  'DERMAGEN TRIMO90 SHAMPOO': 149,
  'DERMAGEN TRIMO90 TONIC': 150,
  'DERMAGEN WELLSPOT': 221,
  'DERMAGEN WHITE SUNSCREEN': 222,
  'ELASTY D PLUS': 14,
  'ELASTY F PLUS': 13,
  'ELASTY G PLUS': 15,
  'ELASTY MESO NEEDLE 32G 4MM': 390,
  'EXONATURE(™) RECORE INNER GEL P198': 196,
  'EYEBELLA': 103,
  'GTM MELACEL THE PREMIUM (5ML X 10V) BLACK': 240,
  'GTM MELACEL+ (3.5ML X 10V) WHITE': 241,
  'GTM PDRN MASK': 237,
  'GTM PEPTICULE REJUVENATION CREAM': 250,
  'GTM ROSE HERB TONER': 254,
  'GTM T-TOX PEEL MINI': 249,
  'GTM T-TOX-PEEL SET LARGE (6VIAL + 6 VIAL)': 248,
  'HAIR LUMA - EXOSOME HAIR GROWTH SOLUTION': 145,
  'JOLLA GREENTEA 1 KG MASK': 277,
  'JUVE EYES': 104,
  'JUVELOOK I': 100,
  'LACTO EXO COLLA': 200,
  'LIPOLAB': 284, // LIPOLAB GMS — only catalogue non-V-LINE LIPOLAB; xlsx has bare "LIPOLAB" qty=0
  'LIPOLAB V LINE': 285,
  'P198 FILCORE ACTIVATING SOLUTION': 64,
  'RAVELLO PLLA 200 MG': 334,
  'RED EXO COLLA': 201,
  'REJUBEAU MESO NEEDLE 33G 4MM': 393,
  'REJUBEAU MESO NEEDLE 34G 4MM': 394,
  'SUNGSHIM NEEDLES 30/4': 399,
  'VANHALLA BLEMISH': 175,
  'VANHALLA CERAMIDE MOISTURISING SERUM IN CREAM': 179,
  'VANHALLA NIACINAMIDE': 176,
  'VANHALLA RETINOL 3R SERUM': 177, // catalogue has typo "ETINOL"

  // —— disambiguated catalogue groups (after products.json rename) ——
  // SCARDERM GEL [10G/20G] and MADECASSOL GEL [10G/20G] now match catalogue
  // directly via the renamed unique names, so no alias is needed for them.
  'VITA-D 300,000': 355,                                // Vita-D (300,000 IU)
  'NEO-CAIN 30GR': 375,                                 // NEO-CAIN CREAM (30G)
  'SM LIDO CREAM [30G] 10.56%': 380,                    // SM CREAM (30G)
  'SM LIDO CREAM [500G] 10.56%': 379,                   // SM CREAM (500G)
  'LAENNEC 10 AMPOULE (2ML X 10)': 386,                 // LAENNEC (10 ampoules)
  'LAENNEC 50 AMPOULE (2ML X 50)': 385,                 // LAENNEC (50 ampoules)
  'MUCHCAIN 100 G TUBE': 381,                           // Muchcaine (100G, Lidocaine+Prilocaine) — note xlsx "MUCHCAIN" (no E)
  'MUCHCAINE 30G': 383,                                 // MUCHCAINE (30G)
  'MUCHCAINE 500G': 382,                                // MUCHCAINE (500G)
  'DERMAGEN CELLSIA [60G]': 231,                        // DERMAGEN Cellsia Post-laser regenerating cream (60g)
  'DERMAGEN CELLSIA [500G]': 232,                       // DERMAGEN Cellsia Post-laser regenerating cream (500g)
  // xlsx "DERMAGEN CELLSIA [35G]" has no catalogue counterpart (only 60g/500g exist) — left unmatched.
};
