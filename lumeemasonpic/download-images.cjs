const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'catalogue', 'categories');
const JDB  = 'https://jdbioshop.com/cdn/shop/files/';
const CDNS = 'https://cdn.shopify.com/s/files/1/0776/5452/4225/files/'; // jdbioshop CDN
const CELA = 'https://cdn.shopify.com/s/files/1/0666/6761/0337/files/'; // celmade.co CDN
const CELB = 'https://cdn.shopify.com/s/files/1/0763/1601/6989/files/'; // premiumdermalmart CDN
const KORA = 'https://cdn.shopify.com/s/files/1/0748/5053/3658/files/'; // koreanaesthetic CDN
const KF   = 'https://koreanfillers.com/wp-content/uploads/';
const SLMD = 'https://cdn.shopify.com/s/files/1/0567/9903/5556/'; // slmedibeauty CDN
const GTMS = 'https://cdn.shopify.com/s/files/1/0756/3768/6565/files/'; // gtm.sg CDN
const KORP = 'https://cdn.shopify.com/s/files/1/0672/1424/6137/files/'; // korepharm CDN
const WCOS = 'https://cdn.shopify.com/s/files/1/0745/0941/8809/files/'; // westcoastpartners CDN
const CELB2 = 'https://cdn.shopify.com/s/files/1/0763/1601/6989/products/'; // premiumdermalmart products CDN

// [relative-folder, image-url]
const downloads = [
  // ─── FILLERS ──────────────────────────────────────────────────────────────
  ['catalogue-categories-fillers/regenovue',      CDNS+'Regenovue_PLUS_3type22.png'],
  ['catalogue-categories-fillers/neuramis',       CDNS+'Neuramis-Lido_3type6.png'],
  ['catalogue-categories-fillers/revolax',        CDNS+'Revolax-Fine.jpg'],
  ['catalogue-categories-fillers/sosum',          CDNS+'Sosum-Soft.jpg'],
  ['catalogue-categories-fillers/celosome',       CDNS+'Celosome_4types_2.png'],
  ['catalogue-categories-fillers/elasty',         CDNS+'ELASTY_3type_33.png'],
  ['catalogue-categories-fillers/vom',            CDNS+'VOM_3type.png'],
  ['catalogue-categories-fillers/dermalax',       KF+'2024/08/Dermalax-Plus.png'],
  ['catalogue-categories-fillers/tesoro',         CDNS+'tesoro_3type2.png'],
  ['catalogue-categories-fillers/youthfill',      CELA+'Youthfill_Fine.png'],
  ['catalogue-categories-fillers/soonsu-fill',    CDNS+'eptq_3type_11_2aac5d83-c7e5-46db-a247-492cd05797bb.png'],
  ['catalogue-categories-fillers/bonetta',        CDNS+'Bonetta_3type_11.png'],
  ['catalogue-categories-fillers/the-chaeum',     CDNS+'chaeum_4type66.png'],
  ['catalogue-categories-fillers/voluderm',       'https://celmade.co/cdn/shop/files/Voluderm_Sub_Q.png'],
  ['catalogue-categories-fillers/ultrafill',      KORA+'UltraFillDeep.jpg'],
  ['catalogue-categories-fillers/barbie-slim',    'https://premiumdermalmart.com/cdn/shop/files/Barbie-Slim.jpg'],
  ['catalogue-categories-fillers/sedy-fill',      CELA+'Sedyfill_10ml.png'],
  ['catalogue-categories-fillers/beads-max',      CDNS+'Beadsmax-Body.jpg'],
  ['catalogue-categories-fillers/maxy-fill',      CELA+'Maxyfill_Hard_Pre-filled_20mg__50cc_Syringe.png'],

  // ─── MESOTHERAPY / BIOREVITALIZATION ──────────────────────────────────────
  ['catalogue-categories-mesotherapy-biorevitalization/hyaron',               CDNS+'Hyaron-Prefilled-Inj.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/rejuran-skin-booster', CDNS+'rejuran-skinbooster-1.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/cindella-i',           CDNS+'rejuran-i-1.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/asce',                 CDNS+'Exo-One-1.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/rejeunesse-sparkle',   CDNS+'Rejeunesse-3.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/lapuroon-aurora',      CDNS+'Lapuroon-Aurora-Super-PDRN.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/gouri',                CELA+'Gouri.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/hanheal',              CDNS+'Hanheal-PDRN-Booster.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/kiara-reju',           CDNS+'Kiara-Reju-PDRN.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/celosome-aqua',        CDNS+'Celosome-aqua.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/revs-pro',             CDNS+'Revs-RMT-140-HPn.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/regenovue-aquashine',  CDNS+'Regenovue-Aqua-Shine-Plus.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/regenovue-pn',         CDNS+'Regenovue-Aqua-Shine.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/misfill-pdrn',         CDNS+'missfill_3type_jdbio.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/elaxen-plla',          CDNS+'elaxen_pn.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/soonsu-ultra-reju',    CELA+'SoonsuUltraReju.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/dermaheal-hsr',        CDNS+'Dermaheal-HSR.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/dermaheal-sr',         CDNS+'Dermaheal-SR.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/juve-eyes',            CELA+'juveeyes_2.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/exoxe',                CELA+'EXOXE_2_a178a68e-1052-4a76-82bd-dc959bfe2398.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/p198-filcore',         'https://cdn.shopify.com/s/files/1/0714/6723/7689/products/filcore_SB1.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/hyalace',              CELB+'Hyalace.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/2xsome',              CELA+'2XSOMESkinBooster.png'],

  // ─── ACNE TREATMENT ───────────────────────────────────────────────────────
  ['catalogue-categories-acne-treatment/dermagen-acssak',    CELB+'Dermagen-Acssak-Acne-Clear-Facial-Foam-120mL.jpg'],
  ['catalogue-categories-acne-treatment/acnon-cream',        KORP+'941398cbd1c2654eac2e2937f62b74b0.png'],
  ['catalogue-categories-acne-treatment/aclean-gel',         KORP+'fc5518c66c14aca0e31091c513e01b90.png'],

  // ─── HAIR TREATMENT ───────────────────────────────────────────────────────
  ['catalogue-categories-hair-treatment/dermaheal-hl',       CDNS+'Dermaheal-HL.jpg'],
  ['catalogue-categories-hair-treatment/ultra-hair',         CDNS+'Hanheal-Hair.jpg'],
  ['catalogue-categories-hair-treatment/hairna-exosome',     WCOS+'HairnaFillermiddle.webp'],
  ['catalogue-categories-hair-treatment/dermagen-trimo90',   SLMD+'products/TRIMO90TONIC.jpg'],

  // ─── PHARMACY FAVOURITES ──────────────────────────────────────────────────
  ['catalogue-categories-pharmacy-favourites/laennec',       CDNS+'Laennec-50-Ampules.jpg'],
  ['catalogue-categories-pharmacy-favourites/bentpla-gel',   CELB+'BentPLA-Gel.jpg'],
  ['catalogue-categories-pharmacy-favourites/noscarna',      KORP+'noscarnagel20g.png'],
  ['catalogue-categories-pharmacy-favourites/melatoning-cream', KORP+'a0dc31b7ce911aed89dc1cb1d7cbb8d8.png'],
  ['catalogue-categories-pharmacy-favourites/madecassol-gel',   KORP+'Madecassol2_Gel_613f72d8-2839-462a-abd9-7bbba18614be.jpg'],

  // ─── TOPICAL COSMETICS ────────────────────────────────────────────────────
  ['catalogue-categories-topical-cosmetics/rejuran-lip-balm', CDNS+'Rejuran_Healer_2.jpg'],

  // ─── CURENEX ──────────────────────────────────────────────────────────────
  ['catalogue-categories-curenex/curenex-pdrn',                   CELA+'CurenexDailyCareSkinbooster30ml.png'],
  ['catalogue-categories-curenex/curenex-sculp',                  CELA+'CURENEX_LIPO.png'],
  ['catalogue-categories-curenex/curenex-daily-care-serum',       CELA+'CurenexDailyCareSkinbooster30ml.png'],
  ['catalogue-categories-curenex/curenex-rejuvenating-cream',     CELA+'Curenex_Rejuvenating_Cream.png'],
  ['catalogue-categories-curenex/curenex-lipo',                   CELA+'CURENEX_LIPO.png'],
  ['catalogue-categories-curenex/curenex-snow-peel',              'https://celmade.net/wp-content/uploads/2024/10/products-curenex-snow-peel-getglowing-skincare__28803-removebg-preview.png'],
  ['catalogue-categories-curenex/curenex-eye',                    'https://www.curenex.us/wp-content/uploads/2024/10/CURENEX-EYE-300x300.png'],
  ['catalogue-categories-curenex/curenex-rejuvenating-mask',      'https://www.curenex.us/wp-content/uploads/2024/10/CURENEX-MASK-300x300.jpg'],
  ['catalogue-categories-curenex/curenex-sheer-sunscreen',        'https://www.curenex.us/wp-content/uploads/2024/10/CURENEX-SUNSCREEN-300x300.png'],

  // ─── BOTULINUM THERAPY ────────────────────────────────────────────────────
  ['catalogue-categories-botulinum-therapy/botulax',     CDNS+'Botulax_2type.png'],
  ['catalogue-categories-botulinum-therapy/metox',       CELA+'METOX_100.png'],
  ['catalogue-categories-botulinum-therapy/innotox',     CDNS+'INNOTOX.jpg'],
  ['catalogue-categories-botulinum-therapy/nabota',      CDNS+'Nabota-100u.jpg'],
  ['catalogue-categories-botulinum-therapy/liztox',      CDNS+'Liztox-100u.jpg'],
  ['catalogue-categories-botulinum-therapy/hutox',       CDNS+'Hutox.jpg'],
  ['catalogue-categories-botulinum-therapy/meditoxin',   CDNS+'meditox_100u_2_912b22d2-8252-42a3-a13e-4353a1fbe0e0.jpg'],
  ['catalogue-categories-botulinum-therapy/re-n-tox',   CDNS+'Rentox100u.webp'],
  ['catalogue-categories-botulinum-therapy/wondertox',  CDNS+'Wondertox-100u.jpg'],
  ['catalogue-categories-botulinum-therapy/linetox',    CELA+'LINETOX_100_715ac648-7a8b-4fbe-a78a-9c59db4f8c40.png'],
  ['catalogue-categories-botulinum-therapy/zerotox',    'https://d26hl16wewjnds.cloudfront.net/product-images/galleries/1698359930.png'],
  ['catalogue-categories-botulinum-therapy/coretox',    CDNS+'Coretox-100u.jpg'],
  ['catalogue-categories-botulinum-therapy/toxsta',     CELA+'Toxta_100.png'],
  ['catalogue-categories-botulinum-therapy/kaimax',     CELB+'Kaimax-100-Units.webp'],
  ['catalogue-categories-botulinum-therapy/hitox',      CELA+'Hitox.png'],

  // ─── LIPOLYTICS ───────────────────────────────────────────────────────────
  ['catalogue-categories-lipolytics/kabelline',         CDNS+'Kabelline.jpg'],
  ['catalogue-categories-lipolytics/dr-lipo-plus',      CDNS+'Dr.Lipo.jpg'],
  ['catalogue-categories-lipolytics/dr-lipo-v',         CDNS+'Dr.Lipo_V.jpg'],
  ['catalogue-categories-lipolytics/lipolab-v-line',    CDNS+'LipoLabV-Line.jpg'],
  ['catalogue-categories-lipolytics/lipolab',           CDNS+'LipoLabBody-CS.jpg'],
  ['catalogue-categories-lipolytics/barbie-slim',       'https://premiumdermalmart.com/cdn/shop/files/Barbie-Slim.jpg'],
  ['catalogue-categories-lipolytics/yellow-bottle',     'https://remediumkorea.com/wp-content/uploads/2024/12/yellcopy-scaled-e1735625333247.jpg'],
  ['catalogue-categories-lipolytics/pine-bottle',       CELA+'Pine_bottle_34d35223-00e3-4dce-9b46-02856d908b20.png'],
  ['catalogue-categories-lipolytics/super-v-line',      CDNS+'Super-V-LINE-Sol.jpg'],
  ['catalogue-categories-lipolytics/ultra-light',       CELA+'ULTRA_LIGHT.png'],
  ['catalogue-categories-lipolytics/vns',               CELA+'VNS.png'],
  ['catalogue-categories-lipolytics/slim-point',        CELB2+'SLIM-POINT-BODY.jpg'],
  ['catalogue-categories-lipolytics/lipo-shrinker',     CELB+'Lipo-Shrinker.png'],

  // ─── INJECTIONS ───────────────────────────────────────────────────────────
  ['catalogue-categories-injections/liporase',          CDNS+'Liporase.jpg'],
  ['catalogue-categories-injections/laennec',           CDNS+'Laennec-50-Ampules.jpg'],
  ['catalogue-categories-injections/cindella-set',      CDNS+'CinderellaSet-1_549a99ba-884e-43e6-81f5-f89a3a5a9348.png'],
  ['catalogue-categories-injections/juvelook',          'https://cdn.shopify.com/s/files/1/0763/1601/6989/products/JUVELOOK.webp'],
  ['catalogue-categories-injections/juvelook-volume',   'https://skin-reboot.com/wp-content/uploads/2024/09/juvelook-volume-1-1000x1024.jpg'],
  ['catalogue-categories-injections/belissima',         CELB+'Belissima.jpg'],
  ['catalogue-categories-injections/glutaone',          CELA+'Glutaone_1200mg.png'],
  ['catalogue-categories-injections/misadi-pdlla',      CELB+'MisAdi-Pdlla.jpg'],

  // ─── ANESTHETICS ──────────────────────────────────────────────────────────
  ['catalogue-categories-anesthetics/wellscaine-plus-cream', CELB+'Wellscain-Plus-Cream-Lidocaine-2_5-Prilocaine-2_5.jpg'],
  ['catalogue-categories-anesthetics/lidcain-cream',         CELB+'Lidcaine-10_56.webp'],
  ['catalogue-categories-anesthetics/wellscaine-cream',      CELB+'Wellscaine-Cream-500g.jpg'],
  ['catalogue-categories-anesthetics/neo-cain-cream',        CELA+'Neo_Cain_500g.png'],
  ['catalogue-categories-anesthetics/j-cain',                CELA+'J_Cain_1.png'],
  ['catalogue-categories-anesthetics/muchcaine',             CELA+'Muchcaine_30g.png'],

  // ─── ANESTHETICS (additional) ─────────────────────────────────────────────

  // ─── PLACENTAL THERAPY ────────────────────────────────────────────────────
  ['catalogue-categories-placental-therapy/laennec',          CDNS+'Laennec-50-Ampules.jpg'],
  ['catalogue-categories-placental-therapy/melsmon',          KORA+'Melsmon.png'],
  ['catalogue-categories-placental-therapy/curacen-jbp-plamon', CELA+'JBP_Plamon_Inj.png'],

  // ─── NANO NEEDLE & CANNULA ────────────────────────────────────────────────
  // Images not found on accessible sources

  // ─── IMPORTED PRODUCTS ────────────────────────────────────────────────────
  ['catalogue-categories-imported-products/dysport',    CDNS+'Dysport500u.jpg'],
  ['catalogue-categories-imported-products/restylane',  CDNS+'Restylane_2type_11.png'],
  ['catalogue-categories-imported-products/juvederm',   CDNS+'Juvederm_4type_11.png'],
  ['catalogue-categories-imported-products/xeomin',     CDNS+'xeomin-00.png'],

  // ─── GTM ──────────────────────────────────────────────────────────────────
  ['catalogue-categories-gtm/gtm-gold-cell-plus',       KORA+'GTMGoldCell5.jpg'],
  ['catalogue-categories-gtm/gtm-gold-cell-premium',    KORA+'GTMGoldCell8.jpg'],
  ['catalogue-categories-gtm/gtm-pdrn-mask',            GTMS+'PDRNMASK.jpg'],
  ['catalogue-categories-gtm/gtm-exomela',              'https://dermalfillersonline.com/wp-content/uploads/2025/11/exomela-1-600x600-1-510x510.jpg'],
  ['catalogue-categories-gtm/melacell-plus',            GTMS+'Metacellpremium.jpg'],
  ['catalogue-categories-gtm/melacell-premium',         GTMS+'Goldcellpremium.jpg'],
  ['catalogue-categories-gtm/gtm-active-protect-sun',   GTMS+'GTMUVBLOCKER.jpg'],

  // ─── GROWTH FACTOR / EXOSOME ──────────────────────────────────────────────
  ['catalogue-categories-growth-factor-exosome/selastin-exo-plus', CELB+'Selastin-Exo-Plus.webp'],
  ['catalogue-categories-growth-factor-exosome/velatox-gf11',      'https://cdn11.bigcommerce.com/s-41bfam661h/images/stencil/original/products/723/7023/velatox-gf11-getglowing-skincare__63829.1760325789.jpg'],
  ['catalogue-categories-growth-factor-exosome/rxc-red-exo-colla', CELB+'RXC_Red_Exo_Colla.jpg'],

  // ─── DERMAGEN ─────────────────────────────────────────────────────────────
  ['catalogue-categories-dermagen/dermagen-egensia',          CELB+'Dermagen-Egensia-Cream-Post-Laser-Post-treatment-cream-50g.jpg'],
  ['catalogue-categories-dermagen/dermagen-well-spot',         CELB+'Dermagen-Wellspot.jpg'],
  ['catalogue-categories-dermagen/dermagen-cellsia',          CELB+'Dermagen-Cellsia-Cream.jpg'],
  ['catalogue-categories-dermagen/dermagen-urea-cream',       CELB+'Dermagen-Urea-Cream.png'],
  ['catalogue-categories-dermagen/dermagen-rm-repair-cream',  CELB+'Dermagen-RM-Repair-Cream.jpg'],
  ['catalogue-categories-dermagen/dermagen-centellase',       SLMD+'products/42214995498b6ba80fc1806d87a7be90.jpg'],
  ['catalogue-categories-dermagen/dermagen-cindelria-tone-up', CELB+'Dermagen-Cindelria-Tone-Up-Cream.jpg'],
  ['catalogue-categories-dermagen/dermagen-soothing-mask',    'https://www.glowup.supply/wp-content/uploads/2022/03/Dermagen-Mask-Front-GUS.png'],

  // ─── MESOTHERAPY (additional) ─────────────────────────────────────────────
  ['catalogue-categories-mesotherapy-biorevitalization/lexyal-reju',        CELB+'Lexyal-Reju.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/cindella-healer-pn', CELB+'Cindella-Healer.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/eve-eyes',            CELB+'Eve-Eyes.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/exogen',              CELB+'Exogen_7f28a720.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/ultrahilo',           'https://cdn.shopify.com/s/files/1/0604/4309/9343/products/UltraHilo.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/evehilo',             CELB+'Evehilo.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/hyalmass',            CELB+'Hyalmass-50-HA-Skin-Booster-1-x-2ml.webp'],
  ['catalogue-categories-mesotherapy-biorevitalization/youthfill-pn',        CELB+'Youthfill-PN.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/ultra-eye',           CELB+'Ultra-Eye.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/touch-br',            CELB2+'TOUCH-BR.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/pcl-power-booster',   CELB2+'PCL-POWER-BOOSTER.webp'],
  ['catalogue-categories-mesotherapy-biorevitalization/volassom',            CELB+'Volassom.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/ultra-ca',            CELB+'Ultra-CA.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/snow-flower-bloom',   CELB+'Snow-Flower-Bloom.webp'],
  ['catalogue-categories-mesotherapy-biorevitalization/misadi-white',        CELB+'MisAdi-White.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/eve-white',           CELB+'Eve-White.webp'],
  ['catalogue-categories-mesotherapy-biorevitalization/ultra-white',         CELB+'Ultra-White.webp'],
  ['catalogue-categories-mesotherapy-biorevitalization/miracle-x',           CELB+'Miracle_X.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/miracle-h',           CELB2+'MIRACLE-H.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/miracle-l',           CELB2+'MIRACLE-L.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/aior',                CELB2+'AIOR-50.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/ami-eyes',            CELB2+'AMI-Eyes.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/ammi-capture-time',   CELB+'Ammi-Capture-Time.webp'],
  ['catalogue-categories-mesotherapy-biorevitalization/bellona',             CELB+'Bellona.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/botanic-exo',         CELB+'Botanic-Exo-Plant.jpg'],

  // ─── FILLERS (additional) ─────────────────────────────────────────────────
  ['catalogue-categories-fillers/misadi-hard',   CELB+'MisAdi-Hard.jpg'],
  ['catalogue-categories-fillers/wanna-fill',    CELB2+'WANNA-FILL-S.webp'],
  ['catalogue-categories-fillers/adimis',        CELB+'Adimis-Body-Filler.jpg'],

  // ─── BOTULINUM (additional) ───────────────────────────────────────────────
  ['catalogue-categories-botulinum-therapy/saline', CELB+'Saline-for-Botox-Injection.jpg'],

  // ─── HAIR (additional) ────────────────────────────────────────────────────
  ['catalogue-categories-hair-treatment/asce-hrlv', CELB+'ASCE-HRLV.jpg'],

  // ─── INTIMATE CARE ────────────────────────────────────────────────────────
  ['catalogue-categories-intimate-care/asce-irlv', CELB+'ASCE-IRLV.webp'],

  // ─── INJECTIONS (additional) ──────────────────────────────────────────────
  ['catalogue-categories-injections/revitalex',      CELB+'Revitalex-Prefilled-Injection.jpg'],
  ['catalogue-categories-injections/masi-injection', CELB+'Masi-Injection-Magnesium-Sulphate-Hydrate.jpg'],
  ['catalogue-categories-injections/hycobal',        CELB+'Vitamin-B12-Hycobal-Inj.png'],
  ['catalogue-categories-injections/vitamin-c-inj',  CELB2+'VITAMIN-C-ASCORBIC-ACID-INJ.jpg'],
  ['catalogue-categories-injections/mennus-pla',     CELB+'Mennus-PLA-Filler-Plus-360mg.jpg'],
  ['catalogue-categories-injections/etrebelle',      CELB2+'ETREBELLE-200mg.jpg'],
  ['catalogue-categories-injections/lipotocin',      CELB+'Lipotocin-injection.jpg'],
  ['catalogue-categories-injections/multivita',      CELB+'Multivita-Inj.jpg'],
  ['catalogue-categories-injections/bm-hid',         CELB+'BM-Hi-D.png'],
  ['catalogue-categories-injections/bm-hylunidase',  CELB+'BM-Hyrunidase.jpg'],

  // ─── ANESTHETICS (additional) ─────────────────────────────────────────────
  ['catalogue-categories-anesthetics/beracaine-spray', CELB+'Bercaine_Spray.jpg'],

  // ─── DERMAGEN (additional) ────────────────────────────────────────────────
  ['catalogue-categories-dermagen/dermagen-bichaeahn', CELB+'Bichaeahn-Pore-Lifting.jpg'],

  // ─── GTM (additional) ─────────────────────────────────────────────────────
  ['catalogue-categories-gtm/vita-k-repair-cream',       'https://cdn-optimized.imweb.me/thumbnail/20260130/ef251c0b6c044.jpg?w=750'],
  ['catalogue-categories-gtm/gtm-balance-cleansing-gel', 'https://cdn-optimized.imweb.me/upload/S20210929830f678ab3e67/aefdfb2a5e887.jpg'],
  ['catalogue-categories-gtm/pdrenza-serum',             'https://cdn-optimized.imweb.me/thumbnail/20260331/69a26aede5628.jpg?w=750'],
  ['catalogue-categories-gtm/pdrenza-cream',             'https://cdn-optimized.imweb.me/thumbnail/20260331/1947a8eb5fc67.jpg?w=750'],
  ['catalogue-categories-gtm/gtm-mela-dual',             'https://cdn-optimized.imweb.me/thumbnail/20260331/3fc58d7141bff.jpg?w=750'],
  ['catalogue-categories-gtm/collagen-serum',            'https://cdn-optimized.imweb.me/thumbnail/20260331/3c82da5727d91.jpg?w=750'],
  ['catalogue-categories-gtm/t-tox-peel',                'https://cdn-optimized.imweb.me/upload/S20210929830f678ab3e67/bffefb845d5a5.jpg'],
  ['catalogue-categories-gtm/t-tox-peel-mini',           'https://cdn-optimized.imweb.me/upload/S20210929830f678ab3e67/4f704dffa1b61.jpg'],
  ['catalogue-categories-gtm/pepticule-cream',           'https://cdn-optimized.imweb.me/thumbnail/20260130/197b04bbf2109.jpg?w=750'],
  ['catalogue-categories-gtm/pepticule-serum',           'https://cdn-optimized.imweb.me/thumbnail/20260304/f26cffeb7e290.jpg?w=750'],
  ['catalogue-categories-gtm/aloe-soothing-gel',         'https://cdn-optimized.imweb.me/upload/S20210929830f678ab3e67/627dabbada505.jpg'],
  ['catalogue-categories-gtm/rose-herb-toner',           'https://cdn-optimized.imweb.me/upload/S20210929830f678ab3e67/29c092a2d9bae.jpg'],
  ['catalogue-categories-gtm/beauty-monster-black',      'https://bbglowsupplies.com/848-large_default/beauty-monster-black-plasma-pen.jpg'],

  // ─── GROWTH FACTOR / EXOSOME (additional) ────────────────────────────────
  ['catalogue-categories-growth-factor-exosome/velash-shgf11',      'https://cdn11.bigcommerce.com/s-41bfam661h/images/stencil/1280x1280/products/713/6884/velash-shgf11-hair-growth-getglowing-skincare__67134.1753492207.jpg?c=1'],
  ['catalogue-categories-growth-factor-exosome/lxc-lacto-exo-colla', CELB+'Lacto-Exo-Colla.jpg'],
  ['catalogue-categories-growth-factor-exosome/selastin-tox-gf11',  'https://realgreatskin.com/wp-content/uploads/2024/09/Selastin-Tox.png'],

  // ─── CURENEX (additional) ─────────────────────────────────────────────────
  ['catalogue-categories-curenex/curenex-hydrating-cleanser',   'https://cdn11.bigcommerce.com/s-41bfam661h/images/stencil/original/products/718/6937/curenex-hydrating-cleanser-5.07-fl-oz-getglowing-skincare__84540.1756346648.jpg?c=1'],
  ['catalogue-categories-curenex/curenex-exo-brightening-cream', 'https://cdn11.bigcommerce.com/s-41bfam661h/images/stencil/original/products/725/7050/curenex-exo-brightening-cream-getglowing-skincare__21021.1761882789.jpg?c=1'],

  // ─── DERMAGEN (additional) ────────────────────────────────────────────────
  ['catalogue-categories-dermagen/dr-picos-egencica',         'https://xq-vip.com/wp-content/uploads/2026/04/DrPicos-Egencica-Cream.png'],
  ['catalogue-categories-dermagen/dr-picos-rmv-repair',       CELB+'Dermagen-RM-Repair-Cream.jpg'],
  ['catalogue-categories-dermagen/dr-picos-ureanol',          'https://xq-vip.com/wp-content/uploads/2026/04/DrPicos-Ureanol-Cream.png'],
  ['catalogue-categories-dermagen/cindelria-tone-up-sun',     'https://dermagen.kr/web/product/medium/202501/dea562aaa7e33eb4071cbeaee3ae3ec4.jpg'],
  ['catalogue-categories-dermagen/dermagen-white-sun-cream',  'https://dermagen.kr/web/product/medium/202110/e95f114688bc9b8b86d2a4b59228cc00.jpg'],
  ['catalogue-categories-dermagen/dermagen-lunatox',          'https://dermagen.kr/web/product/medium/202507/dc0f4c2b3d03691ea1be73e6e425c43f.jpg'],
  ['catalogue-categories-dermagen/dermagen-cicarown',         'https://dermagen.kr/web/product/medium/202601/480554110aa742e82162da6adf7cc62a.jpg'],
  ['catalogue-categories-dermagen/exosia',                    'https://static5.dermafiller.shop/hpeciai/882f8710a7dec12e46f77c6771bd327a/eng_pm_Dermagen-Plus-Exosia-1076_1.jpg'],

  // ─── MESOTHERAPY (more additional) ───────────────────────────────────────
  ['catalogue-categories-mesotherapy-biorevitalization/gemvous-pn',       CELB+'Gemvous-Skinbooster.webp'],
  ['catalogue-categories-mesotherapy-biorevitalization/misadi-co2-mask',  'https://aesthetic-essentials.com/cdn/shop/files/MisAdi_Co2_Carboxy_Therapy_Mask_-_5_sets_1024x1024@2x.png?v=1760603733'],
  ['catalogue-categories-mesotherapy-biorevitalization/soonsu-shining-peel', CELB+'Soonsu-Shining-Peel.webp'],
  ['catalogue-categories-mesotherapy-biorevitalization/clair-eyes',       'https://brunodermalfiller.com/cdn/shop/files/clair-eyes-brunodermalfillercom-110499.jpg?v=1721176207'],
  ['catalogue-categories-mesotherapy-biorevitalization/spider-aqua-eye',  CELB+'Spider-Aqua-Eye-Booster.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/eyebella',         WCOS+'Eyebellamiddle.webp'],
  ['catalogue-categories-mesotherapy-biorevitalization/nmn-bottle-nad',   CELA+'NMNBottle_2.png'],
  ['catalogue-categories-mesotherapy-biorevitalization/oasis-repair-pn',  CELB+'Oasis_Repair.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/selatox',          CELB+'Sela-Tox-10.jpg'],
  ['catalogue-categories-mesotherapy-biorevitalization/exoboom-skin',     WCOS+'EXOBOOM_SKIN_CENTRE.webp'],

  // ─── ACNE TREATMENT (additional) ─────────────────────────────────────────
  ['catalogue-categories-acne-treatment/azalea-cream', KORP+'azalea.png'],

  // ─── PHARMACY FAVOURITES (additional) ────────────────────────────────────
  ['catalogue-categories-pharmacy-favourites/melanosa-cream',      'https://cdn.shopify.com/s/files/1/0667/7980/7813/files/Melanosa_Cream_Korean_Hyperpigmentation_Treatment.png?v=1777270987'],
  ['catalogue-categories-pharmacy-favourites/albendazole',         KORP+'image1.jpg'],
  ['catalogue-categories-pharmacy-favourites/dpanseptic-cream',    'https://cdn.shopify.com/s/files/1/0717/0103/7372/files/news-p.v1.20250828.77e35b2fc8644421a71f5c2f3f863041_P1.jpg?v=1777202065'],
  ['catalogue-categories-pharmacy-favourites/scarderm-gel',        'https://beautyboxkorea.com/web/product/big/202603/798d181d665f0cb28606ed8f4d21198a.jpg'],
  ['catalogue-categories-pharmacy-favourites/egf-active-vital-cream', 'https://beautyboxkorea.com/web/product/big/202503/ebf91363a4520fb2992f184dc298af01.jpg'],
  ['catalogue-categories-pharmacy-favourites/easyef',              'https://cdn.shopify.com/s/files/1/0667/7980/7813/files/easyef_ointment.png?v=1776316284'],
  ['catalogue-categories-pharmacy-favourites/d-panthenol-cream',   'https://cdn.shopify.com/s/files/1/0717/0103/7372/files/638986031678800000.png?v=1764319942'],
  ['catalogue-categories-pharmacy-favourites/rejuvenex-pdrn',      'https://cdn.shopify.com/s/files/1/0699/1727/8453/files/1_54d62398-9bc8-440e-a1a6-b32e92c7a4eb.webp?v=1776140435'],

  // ─── TOPICAL COSMETICS (additional) ──────────────────────────────────────
  ['catalogue-categories-topical-cosmetics/asceplus-cushion',       'https://cdn.shopify.com/s/files/1/0684/2862/8200/files/nicolascaresunshinecushion.png?v=1761304071'],
  ['catalogue-categories-topical-cosmetics/cellexo-mask',           CELB+'CellExosome-HE.jpg'],
  ['catalogue-categories-topical-cosmetics/crebeau-mask',           'https://afroglamourcosmetics.com/wp-content/uploads/2021/01/26-1.jpg'],
  ['catalogue-categories-topical-cosmetics/vanhalla',               'https://d2c3d01lcpw2ui.cloudfront.net/gl/data/item/1726102029/KakaoTalk_20240712_165505300.jpg'],
  ['catalogue-categories-topical-cosmetics/soonsu-aqua-cream',      CELB+'Soonsu-Aqua-Cream-50ml.webp'],
  ['catalogue-categories-topical-cosmetics/wheat-germ-collagen-set', 'https://image.makewebeasy.net/makeweb/r_400x400/yqMOL6qJb/Products/COLLAGEN_SET.jpg?v=202405291424'],

  // ─── INTIMATE CARE (additional) ───────────────────────────────────────────
  ['catalogue-categories-intimate-care/klargen-lactobath',    CELB+'LactoBath.jpg'],
  ['catalogue-categories-intimate-care/klargen-soln',         CELB+'Klargen-Soln.jpg'],
  ['catalogue-categories-intimate-care/p198-recore-inner-gel', 'https://aesthetic-essentials.com/cdn/shop/files/B8CB742B-9597-4EBB-A104-A52C6A382D4F_1024x1024@2x.jpg?v=1773174091'],

  // ─── INJECTIONS (more additional) ────────────────────────────────────────
  ['catalogue-categories-injections/hidr-inj',         'https://rejupharma.com/wp-content/uploads/2025/11/HIDR-INJ.-10V.jpg'],
  ['catalogue-categories-injections/chioctocin',        'https://k-cosmoprof.com/image/cache/catalog/MIX/Injection/Chioctocin%20Thioctic%20acid%2025mg-300x300.jpg'],
  ['catalogue-categories-injections/glutatine',         'https://k-cosmoprof.com/image/cache/catalog/Filler/Injections/gluthion600-300x300w.png'],
  ['catalogue-categories-injections/ascorbic-huons',    CELB+'Huons-VC-Ascorbic-Acid.webp'],
  ['catalogue-categories-injections/acogen',            'https://filleroutlet.com/wp-content/uploads/2025/06/Acojeninj.jpg'],
  ['catalogue-categories-injections/arginine-inj',      'https://static.wixstatic.com/media/35b3ec_612695907f114b50b487be91e9ad836c~mv2.jpg'],
  ['catalogue-categories-injections/vita-d-bone',       'https://derma-solution.com/wp-content/uploads/2026/04/vitamin-d-1-600x600.jpg'],
  ['catalogue-categories-injections/vita-d-300k',       WCOS+'Vita-D_Middle.webp'],
  ['catalogue-categories-injections/doxy-tab',          'https://static.wixstatic.com/media/734546_141d73f9b555492e9f25a0ca876f78ab~mv2.png/v1/fill/w_567,h_611,al_c/734546_141d73f9b555492e9f25a0ca876f78ab~mv2.png'],
  ['catalogue-categories-injections/mesocartin',        'https://filleroutlet.com/wp-content/uploads/2025/06/Mesocartin_INJ.png'],
  ['catalogue-categories-injections/lipotocin-300',     WCOS+'Lipotocin_Middle.webp'],
  ['catalogue-categories-injections/zinc-s',            CELB+'Zinc-S.png'],
  ['catalogue-categories-injections/hishiphagen',       'https://static.wixstatic.com/media/734546_5383d8214f1040b9ac2aa1975675ec18~mv2.jpg/v1/fill/w_659,h_667,al_c,q_85/734546_5383d8214f1040b9ac2aa1975675ec18~mv2.jpg'],
  ['catalogue-categories-injections/cartin',            WCOS+'Cartin_-_L-Carnitine_1g.png'],
  ['catalogue-categories-injections/gitaco',            'https://vera-dermis.com/wp-content/uploads/2024/03/Gitaco-500x500.jpg'],
  ['catalogue-categories-injections/polyboost',         'https://index-marketplace.s3.eu-west-1.amazonaws.com/products/16880025610.png'],
  ['catalogue-categories-injections/pdlla-ravenna',     'https://celmade.net/wp-content/uploads/2024/12/KakaoTalk_Photo_2024-12-16-17-07-07.jpeg'],
  ['catalogue-categories-injections/power-coltra',      'https://myskinkorea.com/cdn/shop/files/power-col-tra-plla-783543.jpg?v=1732812132'],
  ['catalogue-categories-injections/ravello',           WCOS+'RAVELLO_CENTRE.webp'],
  ['catalogue-categories-injections/mennus-plla',       WCOS+'meNnus_Fill_Centre.webp'],

  // ─── ANESTHETICS (additional) ─────────────────────────────────────────────
  ['catalogue-categories-anesthetics/neo-pro-cream',    CELB+'Neo-Pro-Cream-30g.jpg'],
  ['catalogue-categories-anesthetics/sm-cream',         CELB2+'SM-LIDO-CREAM-30g.jpg'],
  ['catalogue-categories-anesthetics/lidocaine-hci-inj', 'https://derma-solution.com/wp-content/uploads/2024/08/lidocaine-huons-4-600x600.jpg'],

  // ─── FILLERS (more additional) ────────────────────────────────────────────
  ['catalogue-categories-fillers/misadi-beso',  CELB+'MisAdi-Beso.webp'],
  ['catalogue-categories-fillers/line-body',    CELA+'LineBody55mlSoft.png'],

  // ─── LIPOLYTICS (additional) ──────────────────────────────────────────────
  ['catalogue-categories-lipolytics/f-and-b',      CELB+'FB-Premium-V-Line-For-Face.png'],
  ['catalogue-categories-lipolytics/misadi-lipo',  CELB+'MisAdi-Lipo.webp'],
  ['catalogue-categories-lipolytics/dr-lipo-prime', CELB2+'DR_-LIPO.jpg'],

  // ─── BOTULINUM (more) ─────────────────────────────────────────────────────
  ['catalogue-categories-botulinum-therapy/rosetox', 'https://kcon.biz/wp-content/uploads/2025/04/rosetox-200.png'],

  // ─── PLACENTAL THERAPY (additional) ──────────────────────────────────────
  ['catalogue-categories-placental-therapy/rejuve', CELB+'Cellofill-Rejuve.webp'],

  // ─── IMPORTED PRODUCTS (additional) ──────────────────────────────────────
  ['catalogue-categories-imported-products/botox-allergan', CDNS+'Allerganbotox.jpg'],

  // ─── HAIR (more additional) ───────────────────────────────────────────────
  ['catalogue-categories-hair-treatment/p198-filcore-hb',   'https://myskinkorea.com/cdn/shop/files/p198-exohealer-filcore-hb-plus-679092.png?v=1732812017&width=1080'],
  ['catalogue-categories-hair-treatment/finasteride',       'https://static.wixstatic.com/media/734546_e368d3d3fc5b4fe898ecbc1bedd2afc4~mv2.png'],
  ['catalogue-categories-hair-treatment/dr-h-rich',         CELB+'DR_H_RICH-Active-complex-for-scalp-revitalising-2-x-1-ml.webp'],
  ['catalogue-categories-hair-treatment/exoboom-hair',      WCOS+'EXOBOOM_HAIR_CENTRE.webp'],
  ['catalogue-categories-hair-treatment/hair-luma',         'https://kstations.com/cdn/shop/files/Hair_Luma.jpg?v=1766031720'],
  ['catalogue-categories-hair-treatment/dermagen-many-shoot', 'https://wellsglobal.kr/wp-content/uploads/2025/12/%EB%8C%80%EC%A7%80-1-scaled.jpg'],
  ['catalogue-categories-hair-treatment/dermagen-mohealer',   'https://wellsglobal.kr/wp-content/uploads/2026/05/%EB%8C%80%EC%A7%80-2.jpg'],

  // ─── NANO NEEDLE & CANNULA ────────────────────────────────────────────────
  ['catalogue-categories-nano-needle-cannula/elasty-meso-needle',     CELB+'Elasty-Needles.jpg'],
  ['catalogue-categories-nano-needle-cannula/rejubeau-meso-needle',   'https://koreamippeuda.co.kr/wp-content/uploads/2024/07/REJUBEAU-FINE-MESO-NEEDLE.jpg'],
  ['catalogue-categories-nano-needle-cannula/jbp-nano-cannula',       CELA+'JBPNanoCannula_30f4d65b-05ca-4c7c-939a-a089ba113a8f.png'],
  ['catalogue-categories-nano-needle-cannula/sungshim-meso-needles',  CELA+'Sungshimsterileneedles17g.png'],
  ['catalogue-categories-nano-needle-cannula/sungshim-syringes',      CELA+'Sungshiminsulinsyringe_3_a626dc7a-d959-4a09-9d0a-57396b54a929.png'],
  ['catalogue-categories-nano-needle-cannula/sungshim-pen-needles',   CELA+'SungshimInsulinPenNeedle32g4mm_b2fbca5a-19be-499f-b35b-eddf091d0774.png'],
  ['catalogue-categories-nano-needle-cannula/dk-filler-cannula',      'https://aesthetics-shop.com/wp-content/uploads/2024/02/DK-Filler-Cannula2-900x900.jpg'],
  ['catalogue-categories-nano-needle-cannula/dk-ultra-thin-meso-needles', 'https://cdn-optimized.imweb.me/thumbnail/20250910/411c97e01e3f2.png?w=750'],
  ['catalogue-categories-nano-needle-cannula/neo-cannula',             CELB+'Neo-Cannula.png'],
  ['catalogue-categories-nano-needle-cannula/syringe-mixing-tube',    CELA+'SyringeMixingTube_Connector___100ae.png'],

  // ─── TOPICAL COSMETICS (more additional) ─────────────────────────────────
  ['catalogue-categories-topical-cosmetics/eu-mei-sun', 'https://product.hstatic.net/200000560121/product/z4470376384933_c086dfa9580521e275cce0fd652a596a_0d06fd6c6e1b43c2ab568aa643a7cf7b_master.jpg'],

  // ─── PHARMACY FAVOURITES (more additional) ───────────────────────────────
  ['catalogue-categories-pharmacy-favourites/reclan-pdrn', CELB+'Recell-PDRN-Sodium-DANN.webp'],

  // ─── INJECTIONS (even more additional) ───────────────────────────────────
  ['catalogue-categories-injections/placentex',              'https://mirpharma.net/cdn/shop/files/001_25_9a06c101-8002-4be3-9b1d-448e5f504833.png?v=1719561472&width=1946'],
  ['catalogue-categories-injections/cindella-inj',           WCOS+'Cindella.png'],
  ['catalogue-categories-injections/dermagen-glutathione-film', 'https://cdn11.bigcommerce.com/s-k42q3y0s6l/images/stencil/1280x1280/products/125/848/Frame%5F1010106989%5F%5F70237.1767150199.jpg?c=1'],
  ['catalogue-categories-injections/ascorbic-inj',           WCOS+'Huons_Ascorbic_Acid_Final.png'],
  ['catalogue-categories-injections/vita-d-200k',            WCOS+'Vita-D_Middle.webp'],
  ['catalogue-categories-injections/b-colamin',              'https://web.tradekorea.com/product/373/2071373/B-Colamin__(Vitamin_B12)_2.png'],
  ['catalogue-categories-injections/beecom',                 'https://shopbotoxonline.com/wp-content/uploads/2024/05/Beecom-Hexa-Inj-600x600.jpg'],

  // ─── ACNE TREATMENT (more additional) ────────────────────────────────────
  ['catalogue-categories-acne-treatment/repida-clearnest', 'https://web.tradekorea.com/product/432/2296432/Repida_Clearnest_Intensive_Foam_Cleanser_2.jpg'],
  ['catalogue-categories-acne-treatment/aclean-body-spray', 'https://sthkbeauty.com/cdn/shop/files/original_30_a79e215c-b258-4952-9506-3442d39c85aa.webp?v=1776849892&width=3840'],

  // ─── EQUIPMENT ────────────────────────────────────────────────────────────
  ['catalogue-categories-equipment/o2toderm-led-plus', 'https://o2toderm.co.kr/web/product/big/202303/7ca05214086842d1ab300987a651c1e9.png'],
  ['catalogue-categories-equipment/hera-point',        'https://web.tradekorea.com/product/702/2008702/Hera_Point_2.jpg'],
  ['catalogue-categories-equipment/willcam-plus',      'https://web.tradekorea.com/product/748/1915748/Skin_diagnosis_WillCam_2.jpg'],
  ['catalogue-categories-equipment/omega-pdt',         'https://cdn.shopify.com/s/files/1/0324/7302/2601/files/OMEGALight.png?v=1762922438'],
  ['catalogue-categories-equipment/diasono-310',       'https://cdn.shopify.com/s/files/1/0324/7302/2601/products/WholeBody.png?v=1762922402'],
  ['catalogue-categories-equipment/dn64-needle',       'https://cdn.shopify.com/s/files/1/2353/4265/products/DN64_5EA.722.png?v=1681120250'],
  ['catalogue-categories-equipment/dn16-needle',       'https://cdn.shopify.com/s/files/1/2353/4265/products/ScreenShot2020-05-29at12.05.22AM.png?v=1590737062'],
  ['catalogue-categories-equipment/i-cool-plus',       'https://medifoyou.com/web/product/big/201905/427f5357dbbaf05727b56c1bb17b358d.png'],
  ['catalogue-categories-equipment/hysonic-three-way', 'https://www.jlu.kr/data_page/attach/20230602/d5c8ee195915c897e946d210910c1dea.jpg'],
  ['catalogue-categories-equipment/accutoning',        'https://web.tradekorea.com/product/1/1915001/Acne_treatment_with_a_1450nm_wavelength_laser_Accu_TONING_2.jpg'],
  ['catalogue-categories-equipment/hera-vacuum',       'https://web.tradekorea.com/product/503/2007503/Hera_Vacuum_2.jpg'],
  ['catalogue-categories-equipment/uldm',              'https://o2toderm.co.kr/web/product/medium/202405/279a4fc6ce7f5fcd68177bf0dcfdae10.png'],
  ['catalogue-categories-equipment/12pin-42pin-needle', 'https://nasvita.com/cdn/shop/files/M8S18pin.jpg?v=1724144721&width=1500'],
  ['catalogue-categories-equipment/nano-needle',       'https://premiumdermalmart.com/cdn/shop/files/Feel-Soft-Nano-Needles.jpg?v=1749009985'],
];

function downloadFile(fileUrl, destFolder) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(fileUrl);
    const ext = path.extname(parsedUrl.pathname) || '.jpg';
    const basename = path.basename(parsedUrl.pathname, ext).replace(/[^a-zA-Z0-9._-]/g, '-');
    const filename = basename + ext;
    const destDir = path.join(BASE, destFolder);
    const destPath = path.join(destDir, filename);

    fs.mkdirSync(destDir, { recursive: true });

    if (fs.existsSync(destPath)) {
      return resolve({ ok: true, skipped: true });
    }

    const protocol = fileUrl.startsWith('https') ? https : http;
    const req = protocol.get(fileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*'
      },
      timeout: 20000
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        return downloadFile(res.headers.location, destFolder).then(resolve);
      }
      if (res.statusCode !== 200) {
        res.resume();
        console.error(`  FAIL ${res.statusCode}: ${fileUrl}`);
        return resolve({ ok: false, status: res.statusCode, url: fileUrl });
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`  OK: ${destFolder.split('/').pop()}/${filename}`);
        resolve({ ok: true });
      });
      file.on('error', (e) => {
        fs.unlink(destPath, () => {});
        console.error(`  ERR write: ${e.message}`);
        resolve({ ok: false, error: e.message });
      });
    });
    req.on('error', (err) => {
      console.error(`  ERR net: ${err.message.substring(0,60)} | ${fileUrl.substring(0,60)}`);
      resolve({ ok: false, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      console.error(`  TIMEOUT: ${fileUrl.substring(0,60)}`);
      resolve({ ok: false, error: 'timeout' });
    });
  });
}

async function main() {
  console.log(`Downloading ${downloads.length} images...\n`);
  let ok = 0, skipped = 0, fail = 0, failed = [];
  for (const [folder, imgUrl] of downloads) {
    const result = await downloadFile(imgUrl, folder);
    if (result.skipped) skipped++;
    else if (result.ok) ok++;
    else { fail++; failed.push({ folder, url: result.url || imgUrl }); }
  }
  console.log(`\n=== Done: ${ok} downloaded, ${skipped} skipped, ${fail} failed ===`);
  if (failed.length) {
    console.log('\nFailed:');
    failed.forEach(f => console.log(`  ${f.folder}`));
  }
}

main();
