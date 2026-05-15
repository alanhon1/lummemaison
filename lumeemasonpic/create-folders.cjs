const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, 'catalogue', 'categories');

const structure = {
  'catalogue-categories-fillers': [
    'barbie-slim', 'misadi-beso', 'regenovue', 'sosum', 'elasty', 'vom',
    'neuramis', 'revolax', 'dermalax', 'tesoro', 'youthfill', 'soonsu-fill',
    'celosome', 'bonetta', 'the-chaeum', 'voluderm', 'ultrafill', 'line-body',
    'beads-max', 'misadi-hard', 'adimis', 'sedy-fill', 'maxy-fill', 'wanna-fill'
  ],
  'catalogue-categories-mesotherapy-biorevitalization': [
    'p198-filcore', 'lexyal-reju', 'bellona', 'dermagen-plus-nad',
    'tesoro-collagen', 'ultrahilo', 'evehilo', 'hyalace', 'revs-pro', 'aior',
    'ultra-gen', 'hyalmass', 'hyaron', 'powerhealer', 'true-bella',
    'youthfill-pn', 'regenovue-pn', 'regenovue-aquashine', 'celosome-aqua',
    'rejeunesse-sparkle', 'oasis-repair-pn', 'cindella-healer-pn', 'kiara-reju',
    'gemvous-pn', 'misfill-pdrn', 'hanheal', 'elaxen-plla', 'misadi-co2-mask',
    'soonsu-ultra-reju', 'soonsu-shining-peel', 'cindella-i', 'clair-eyes',
    'ultra-eye', 'ami-eyes', 'juvelook-i', 'eve-eyes', 'spider-aqua-eye',
    'eyebella', 'juve-eyes', 'snow-flower-bloom', 'misadi-white', 'eve-white',
    'ultra-white', 'miracle-x', 'miracle-h', 'miracle-l', 'touch-up-pcl',
    'touch-br', 'pcl-power-booster', 'rejuran-skin-booster', 'selatox',
    'lapuroon-aurora', 'nmn-bottle-nad', '2xsome', 'exogen', 'exoxe',
    'exoboom-skin', 'botanic-exo', 'asce', 'ammi-capture-time',
    'ultra-ca', 'volassom', 'gouri', 'dermaheal-hsr', 'dermaheal-sr'
  ],
  'catalogue-categories-acne-treatment': [
    'esrella-tea-tree', 'repida-clearnest', 'acon-deep-cleansing',
    'aclean-gel', 'aclean-body-spray', 'acnon-cream', 'azalea-cream',
    'dermagen-acssak'
  ],
  'catalogue-categories-hair-treatment': [
    'p198-filcore-hb', 'dr-h-rich', 'hairna-exosome', 'asce-hrlv',
    'exoboom-hair', 'hair-luma', 'ultra-hair', 'dermaheal-hl', 'finasteride',
    'dermagen-many-shoot', 'dermagen-trimo90', 'dermagen-mohealer'
  ],
  'catalogue-categories-pharmacy-favourites': [
    'melanosa-cream', 'albendazole', 'dpanseptic-cream', 'scarderm-gel',
    'reclan-pdrn', 'eyeocool-renew-pdrn', 'madecassol-gel', 'melatoning-cream',
    'egf-active-vital-cream', 'easyef', 'd-panthenol-cream', 'rejuvenex-pdrn',
    'noscarna', 'bentpla-gel'
  ],
  'catalogue-categories-topical-cosmetics': [
    'rejunera-exo-pdrn', 'asceplus-cushion', 'cellexo-mask', 'crebeau-mask',
    'spider-toxin-program', 'rejuran-lip-balm', 'vanhalla', 'soonsu-aqua-cream',
    'opacious-collagen-mask', 'invu-reparative-bb', 'repida-body-serum',
    'repida-azulene', 'g2-oil-lifting', 'wheat-germ-ampoule', 'eu-mei-sun',
    'eu-mei-eye-cream', 'wheat-germ-collagen-set'
  ],
  'catalogue-categories-intimate-care': [
    'klargen-lactobath', 'klargen-soln', 'asce-irlv', 'p198-recore-inner-gel'
  ],
  'catalogue-categories-growth-factor-exosome': [
    'velatox-gf11', 'velash-shgf11', 'camellex', 'lxc-lacto-exo-colla',
    'rxc-red-exo-colla', 'selastin-tox-gf11', 'selastin-exo-plus'
  ],
  'catalogue-categories-curenex': [
    'curenex-sculp', 'curenex-pdrn', 'curenex-daily-care-serum',
    'curenex-rejuvenating-cream', 'curenex-hydrating-cleanser', 'curenex-lipo',
    'curenex-rejuvenating-mask', 'curenex-exo-brightening-cream', 'curenex-eye',
    'curenex-snow-peel', 'curenex-sheer-sunscreen'
  ],
  'catalogue-categories-dermagen': [
    'dermagen-egensia', 'dr-picos-egencica', 'dr-picos-rmv-repair',
    'dr-picos-ureanol', 'cindelria-tone-up-sun', 'dermagen-soothing-mask',
    'dermagen-well-spot', 'dermagen-white-sun-cream', 'dermagen-urea-cream',
    'dermagen-rm-repair-cream', 'dermagen-scargel', 'dermagen-centellase',
    'dermagen-lunatox', 'dermagen-cicarown', 'dermagen-cindelria-tone-up',
    'dermagen-bichaeahn', 'dermagen-cellsia', 'dermagen-ez-cera', 'exosia'
  ],
  'catalogue-categories-gtm': [
    'gtm-exomela', 'gtm-pdrn-mask', 'gtm-gold-cell-plus',
    'gtm-gold-cell-premium', 'melacell-premium', 'melacell-plus',
    'gtm-balance-cleansing-gel', 'pdrenza-serum', 'pdrenza-cream',
    'gtm-mela-dual', 'vita-k-repair-cream', 'collagen-serum', 't-tox-peel',
    't-tox-peel-mini', 'pepticule-cream', 'pepticule-serum',
    'gtm-active-protect-sun', 'aloe-soothing-gel', 'rose-herb-toner',
    'beauty-monster-black'
  ],
  'catalogue-categories-equipment': [
    'o2toderm-led-plus', 'uldm', 'o2toderm-uldm-set', 'omega-pdt', 'diasono-310',
    'hiffect-plus', 'willcam-plus', 'dn64-needle', 'dn16-needle', 'i-cool-plus',
    'ultra-skin-master', 'hysonic-three-way', 'hera-point', 'accutoning',
    'hera-vacuum', 'ultratoning', 'auto-dn-mts-pen', 'auto-dn-smart',
    '12pin-42pin-needle', 'nano-needle'
  ],
  'catalogue-categories-salon-grade': [
    'jolla-cleansing-lotion', 'jolla-green-tea-mask', 'jolla-peppermint-mask',
    'jolla-high-frequency-cream', 'jolla-olive-massage-cream'
  ],
  'catalogue-categories-lipolytics': [
    'misadi-lipo', 'barbie-slim', 'dr-lipo-plus', 'dr-lipo-v', 'lipolab',
    'lipolab-v-line', 'super-v-line', 'yellow-bottle', 'pine-bottle',
    'ultra-light', 'f-and-b', 'dr-lipo-prime', 'kabelline', 'vns',
    'slim-point', 'lipo-shrinker'
  ],
  'catalogue-categories-botulinum-therapy': [
    'botulax', 'metox', 'innotox', 'nabota', 'liztox', 'hutox', 'meditoxin',
    're-n-tox', 'toxsta', 'kaimax', 'wondertox', 'linetox', 'zerotox',
    'coretox', 'rosetox', 'hitox', 'saline'
  ],
  'catalogue-categories-injections': [
    'masi-injection', 'revitalex', 'hidr-inj', 'placentex', 'ferex',
    'liporase', 'bm-hylunidase', 'misadi-pdlla', 'belissima', 'etrebelle',
    'mennus-pla', 'mennus-plla', 'ravello', 'power-coltra', 'polyboost',
    'pdlla-ravenna', 'juvelook', 'juvelook-volume', 'cindella-set', 'cindella-inj',
    'chioctocin', 'lipotocin', 'glutaone', 'glutatine', 'dermagen-glutathione-film',
    'vitamin-c-inj', 'acogen', 'ascorbic-inj', 'ascorbic-huons', 'atp-s',
    'arginine-inj', 'acepain-inj', 'multivita', 'vita-d-bone', 'vita-d-200k',
    'vita-d-300k', 'bm-hid', 'doxy-tab', 'mesocartin', 'lipotocin-300',
    'hycobal', 'b-colamin', 'beecom', 'zinc-inj', 'zinc-s', 'maxyblue',
    'hishiphagen', 'cartin', 'gitaco'
  ],
  'catalogue-categories-anesthetics': [
    'wellscaine-plus-cream', 'lidcain-cream', 'wellscaine-cream',
    'beracaine-spray', 'neo-cain-cream', 'neo-pro-cream', 'j-cain',
    'sm-cream', 'muchcaine', 'lidocaine-hci-inj'
  ],
  'catalogue-categories-placental-therapy': [
    'laennec', 'melsmon', 'curacen-jbp-plamon', 'melamin', 'rejuve'
  ],
  'catalogue-categories-nano-needle-cannula': [
    'elasty-meso-needle', 'rejubeau-meso-needle', 'everline-mezo-needle',
    'jbp-nano-cannula', 'sungshim-meso-needles', 'sungshim-syringes',
    'sungshim-pen-needles', 'dk-filler-cannula', 'dk-ultra-thin-meso-needles',
    'neo-cannula', 'syringe-mixing-tube'
  ],
  'catalogue-categories-imported-products': [
    'restylane', 'dysport', 'xeomin', 'botox-allergan', 'juvederm'
  ]
};

let folderCount = 0;
for (const [category, brands] of Object.entries(structure)) {
  for (const brand of brands) {
    const dir = path.join(base, category, brand);
    fs.mkdirSync(dir, { recursive: true });
    folderCount++;
  }
}

console.log(`Created ${folderCount} brand folders across ${Object.keys(structure).length} categories`);
console.log('Folder structure:');
for (const [cat, brands] of Object.entries(structure)) {
  console.log(`  ${cat}/ (${brands.length} brands)`);
}
