import { clone, persistedStore, uid } from '@/lib/persist';
import { SEED } from '@/lib/seed';
import { arrayCollection } from '@/lib/sync';
import { log } from './activity';
import { household, myId } from './household';

/** Aisles in the order most shops are walked; frozen comes last among food so it stays cold. */
export const CATEGORIES = [
  { id: 'produce', emoji: '🥦' },
  { id: 'bakery', emoji: '🥖' },
  { id: 'deli', emoji: '🥪' },
  { id: 'meat', emoji: '🥩' },
  { id: 'seafood', emoji: '🐟' },
  { id: 'dairy', emoji: '🧀' },
  { id: 'breakfast', emoji: '☕' },
  { id: 'pantry', emoji: '🥫' },
  { id: 'condiments', emoji: '🧂' },
  { id: 'snacks', emoji: '🍿' },
  { id: 'drinks', emoji: '🧃' },
  { id: 'alcohol', emoji: '🍷' },
  { id: 'frozen', emoji: '🧊' },
  { id: 'household', emoji: '🧻' },
  { id: 'personal', emoji: '🧴' },
  { id: 'health', emoji: '💊' },
  { id: 'baby', emoji: '🍼' },
  { id: 'pets', emoji: '🐾' },
  { id: 'other', emoji: '🛒' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const categoryEmoji = (id: string) => CATEGORIES.find((c) => c.id === id)?.emoji ?? '🛒';

export interface ShoppingItem {
  id: string;
  householdId: string;
  name: string;
  qty: string;
  note: string;
  category: CategoryId;
  checked: boolean;
  checkedBy?: string;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** What the household has bought before: drives autocomplete and remembers each item's aisle (B3, B4). */
export interface CatalogEntry {
  id: string;
  householdId: string;
  name: string;
  category: CategoryId;
  timesAdded: number;
  lastAddedAt: string;
}

export const normalize = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');

/* ── Item library ───────────────────────────────────────────────────── */

/**
 * Everyday items in English + Spanish: gives each row its own icon and guesses its aisle the first time
 * (remembered per name once the user corrects it). Each line is "emoji word|word|…". Words match whole
 * words, plurals included ("apple" hits "apples", "limon" hits "limones"); a trailing * matches any
 * ending ("berr*" hits "berries"). Accents don't matter.
 */
const LIBRARY: Record<CategoryId, string[]> = {
  produce: [
    '🍎 apple|manzana|fruit|fruta',
    '🍏 green apple|manzana verde',
    '🍐 pear|pera',
    '🍊 orange|naranja|mandarin|mandarina|tangerine|clementine|clementina',
    '🍋 lemon|limon|lime|lima',
    '🍌 banana|platano|banano|guineo',
    '🍉 watermelon|sandia',
    '🍈 melon|cantaloupe|honeydew',
    '🍇 grape|uva',
    '🍓 strawberr*|fresa|frutilla',
    '🫐 blueberr*|arandano|raspberr*|frambuesa|blackberr*|mora|berr*',
    '🍒 cherr*|cereza',
    '🍑 peach|melocoton|durazno|nectarine|nectarina|apricot|albaricoque|damasco|plum|ciruela',
    '🥭 mango|papaya|passion fruit|maracuya|guava|guayaba',
    '🍍 pineapple|pina|anana',
    '🥥 coconut|coco',
    '🥝 kiwi',
    '🍅 tomato|tomate|jitomate|cherry tomato',
    '🍆 eggplant|aubergine|berenjena',
    '🥑 avocado|palta|aguacate',
    '🥦 broccoli|brocoli|cauliflower|coliflor',
    '🥬 lettuce|lechuga|spinach|espinaca|kale|cabbage|repollo|col|chard|acelga|arugula|rucula|rocket|bok choy|celery|apio',
    '🥗 salad|ensalada|mixed greens',
    '🥒 cucumber|pepino|zucchini|courgette|calabacin|zapallito',
    '🫑 bell pepper|pepper|pimiento|morron|capsicum',
    '🌶️ chili|chilli|chile|aji|jalapeno|habanero|locoto',
    '🌽 corn|maiz|choclo|elote|sweetcorn',
    '🥕 carrot|zanahoria|beet|beetroot|remolacha|betarraga|betabel|radish|rabano|turnip|nabo|vegetable|veggie|veg|verdura|vegetal',
    '🥔 potato|papa|patata',
    '🍠 sweet potato|batata|camote|boniato|yam|yuca|cassava|mandioca',
    '🧅 onion|cebolla|shallot|chalota|leek|puerro|scallion|spring onion|green onion|cebollin|cebolleta|cebollino',
    '🧄 garlic|ajo',
    '🫚 ginger|jengibre|kion',
    '🍄 mushroom|champinon|champignon|hongo|seta|portobello',
    '🫛 pea|arveja|guisante|green bean|ejote|vainita|chaucha|judia verde|edamame|snow pea',
    '🌿 herb|hierba|parsley|perejil|cilantro|coriander|basil|albahaca|mint|menta|hierbabuena|rosemary|romero|dill|eneldo|thyme|tomillo',
    '🎃 pumpkin|squash|zapallo|calabaza|auyama|butternut',
    '🌱 asparagus|esparrago|sprout|brote|alfalfa|artichoke|alcachofa',
  ],
  bakery: [
    '🍞 bread|pan|loaf|sliced bread|pan de molde|pan lactal|toast|tostada|sourdough|pan integral',
    '🥖 baguette|french bread|pan frances|marraqueta|barra de pan',
    '🥐 croissant|medialuna|cuerno|cachito',
    '🥯 bagel',
    '🫓 tortilla|pita|wrap|flatbread|naan|arepa',
    '🍔 bun|burger bun|hot dog bun|pan de hamburguesa|pan de pancho|roll|bollo|bolillo|panecillo',
    '🍩 donut|doughnut|dona|rosquilla|berlin',
    '🧁 muffin|cupcake|magdalena|madalena|panque|queque',
    '🎂 cake|torta|pastel|tarta|bizcocho|birthday cake',
    '🥧 pie|pay|empanada|saltena|quiche|tart',
    '🍰 pastry|pastries|factura|bolleria|danish|brownie|cinnamon roll|alfajor',
  ],
  deli: [
    '🍖 ham|jamon|cold cuts|fiambre|mortadela|bologna|lunch meat|turkey breast|pechuga de pavo|salami|salame|pepperoni|prosciutto',
    '🥪 sandwich|sanduche|sandwiches|sub',
    '🧆 hummus|falafel|dip|guacamole|tzatziki',
    '🍱 ready meal|prepared meal|comida preparada|plato preparado|meal prep|tofu|tempeh|seitan',
    '🍣 sushi|poke',
    '🍗 rotisserie chicken|roast chicken|pollo asado|pollo al spiedo|pollo rostizado|pollo a la brasa|broaster',
    '🥗 coleslaw|potato salad|ensalada rusa|pasta salad',
  ],
  meat: [
    '🍗 chicken|pollo|wing|alita|drumstick|thigh|muslo|pechuga|gallina',
    '🥩 beef|carne|steak|filete|bistec|bife|res|ternera|veal|sirloin|lomo|ribeye|roast beef|churrasco|asado|milanesa|picana',
    '🍔 ground beef|minced meat|mince|carne molida|carne picada|hamburger|burger|hamburguesa|patty|meatball|albondiga',
    '🐷 pork|cerdo|chancho|puerco|pork chop|chuleta|costilla|rib|spare rib|lechon',
    '🥓 bacon|tocino|panceta|beicon|tocineta',
    '🌭 sausage|salchicha|hot dog|chorizo|frankfurter|bratwurst|longaniza|vienna|pancho|morcilla',
    '🐑 lamb|cordero|borrego|mutton|goat|cabrito|chivo',
    '🦃 turkey|pavo',
    '🦆 duck|pato',
    '🍖 meat|liver|higado|charque|jerky',
  ],
  seafood: [
    '🐟 fish|pescado|cod|bacalao|tilapia|hake|merluza|trout|trucha|sea bass|corvina|reineta|sole|lenguado|basa|swordfish|pez espada|surubi|pacu|salmon|tuna steak|atun fresco|mackerel|caballa|seafood',
    '🦐 shrimp|prawn|camaron|gamba|langostino',
    '🦑 squid|calamar|calamari',
    '🐙 octopus|pulpo',
    '🦀 crab|cangrejo|jaiba|surimi|kanikama',
    '🦞 lobster|langosta',
    '🦪 mussel|mejillon|choro|clam|almeja|oyster|ostra|ostion|scallop|vieira|marisco',
  ],
  dairy: [
    '🥛 milk|leche|lactose free|deslactosada|cream|crema|nata|sour cream|heavy cream|whipping cream|crema de leche|whipped cream|chantilly|half and half',
    '🥛 oat milk|almond milk|soy milk|rice milk|plant milk|leche de avena|leche de almendra|leche de soya|leche de soja|leche vegetal',
    '🥛 chocolate milk|leche chocolatada|chocolatada|evaporated milk|condensed milk|leche condensada|leche evaporada',
    '🧀 cheese|queso|cheddar|mozzarella|parmesan|parmesano|gouda|brie|feta|ricotta|cottage|cream cheese|queso crema|halloumi|manchego|requeson|quesillo',
    '🥚 egg|huevo',
    '🧈 butter|mantequilla|manteca|margarine|margarina|ghee',
    '🥣 yogurt|yoghurt|yogur*|kefir|skyr',
    '🍮 pudding|flan|custard|natilla|postre',
  ],
  breakfast: [
    '☕ coffee|cafe|espresso|capsule|capsula|nespresso|instant coffee|nescafe|coffee bean|cafe en grano|ground coffee|cafe molido',
    '🍵 tea|te|green tea|te verde|chamomile|manzanilla|yerba|yerba mate|mate|infusion|herbal tea|matcha|coca tea|mate de coca',
    '🥣 cereal|cornflakes|corn flakes|granola|muesli',
    '🌾 oat|oatmeal|avena|porridge|hojuela',
    '🍯 honey|miel',
    '🍓 jam|jelly|mermelada|preserves|confitura',
    '🥜 peanut butter|mantequilla de mani|mantequilla de cacahuate|crema de cacahuate|nut butter|almond butter',
    '🍫 nutella|chocolate spread|nocilla|hot chocolate|chocolate caliente|cocoa|cacao|chocolate en polvo|nesquik|toddy|milo|ovaltine',
    '🥞 pancake|panqueque|waffle|hotcake|pancake mix|crepe|crepa',
    '🍁 maple syrup|syrup|sirope|miel de maple',
    '🍮 dulce de leche|manjar|cajeta',
    '🥄 creamer|coffee creamer|coffee mate|sweetener|endulzante|edulcorante|stevia|sacarina|splenda',
  ],
  pantry: [
    '🍚 rice|arroz',
    '🍝 pasta|spaghetti|espagueti|fideo|tallarin|macaroni|macarron|penne|lasagna|lasana|noodle|tagliatelle|fusilli|codito|ravioli|gnocchi|noqui',
    '🍜 instant noodle|ramen|cup noodle|maruchan|sopa instantanea',
    '🌾 flour|harina|cornmeal|maicena|cornstarch|polenta|semolina|quinoa|quinua|couscous|cuscus|bulgur|amaranto|chuno',
    '🍬 sugar|azucar|brown sugar|icing sugar|azucar impalpable|chancaca|panela',
    '🫗 oil|aceite|vegetable oil|sunflower oil|aceite de girasol|canola|cooking spray|lard',
    '🫒 olive oil|aceite de oliva',
    '🫘 bean|frijol|poroto|alubia|chickpea|garbanzo|lentil|lenteja|haba|black bean|kidney bean',
    '🥫 tuna|atun|sardine|sardina|anchov*|anchoa|canned|tin|lata|conserva|enlatado|corned beef|spam',
    '🍲 soup|sopa|broth|caldo|stock|bouillon|cubito|consome|knorr|maggi',
    '🍞 breadcrumb|pan rallado|panko',
    '🧁 baking powder|polvo de hornear|polvo para hornear|baking soda|bicarbonato|yeast|levadura|vanilla|vainilla|cake mix|chocolate chips|chispas de chocolate|sprinkles|gelatin|gelatina|jello|food coloring|colorante',
    '🥥 coconut milk|leche de coco|coconut cream',
    '🥔 mashed potato|pure de papa|instant potato',
  ],
  condiments: [
    '🧂 salt|sal|sea salt|black pepper|pimienta|spice|especia|seasoning|condimento|sazonador|oregano|cumin|comino|paprika|pimenton|cinnamon|canela|curry|turmeric|curcuma|nutmeg|nuez moscada|bay leaf|laurel|chili powder|aji molido|garlic powder|ajo en polvo|adobo|sazon|clove|clavo de olor',
    '🍅 ketchup|catsup|tomato sauce|salsa de tomate|tomato paste|tomato puree|pure de tomate|passata|crushed tomato|tomate triturado',
    '🫙 mayo|mayonnaise|mayonesa|aioli|alioli',
    '🌭 mustard|mostaza',
    '🌶️ hot sauce|salsa picante|tabasco|sriracha|llajua|salsa',
    '🥢 soy sauce|salsa de soya|salsa de soja|teriyaki|oyster sauce|sesame oil|aceite de sesamo|fish sauce',
    '🍶 vinegar|vinagre|balsamic|balsamico',
    '🍖 bbq sauce|barbecue sauce|salsa barbacoa|worcestershire|salsa inglesa',
    '🥗 dressing|aderezo|vinaigrette|vinagreta|ranch',
    '🌿 pesto',
    '🥫 sauce|gravy|pasta sauce|marinara|bolognese|salsa bolognesa|salsa para pasta',
    '🫒 olive|aceituna',
    '🥒 pickle|pepinillo|encurtido|gherkin|alcaparra|caper',
  ],
  snacks: [
    '🥔 chips|crisps|papas fritas|papitas|pringles|tortilla chips|nachos|totopos|doritos|plantain chips|chifle',
    '🍿 popcorn|palomitas|pipocas|pororo|pochoclo|cabritas|canchita|snack|botana|picada',
    '🥨 pretzel|cracker|galleta salada|saltine|rice cake|galleta de arroz',
    '🍪 cookie|biscuit|galleta|galletita|oreo',
    '🍫 chocolate|chocolatina|candy bar|cereal bar|bombon|granola bar|barra de cereal|protein bar|barrita',
    '🍭 candy|candies|sweets|caramelo|golosina|dulce|gummies|gummy|gomita|chicle|gum|chewing gum|marshmallow|malvavisco|lollipop|chupetin|paleta',
    '🥜 peanut|mani|cacahuate|cacahuete|almond|almendra|cashew|anacardo|castana|pistachio|pistacho|mixed nuts|trail mix|frutos secos|nut',
    '🌰 walnut|nuez|nueces|chestnut|hazelnut|avellana|pecan',
    '🍇 raisin|pasa|dried fruit|fruta seca|date|datil|prune|ciruela pasa|dried apricot|orejones',
    '🌻 seed|semilla|pipas|sunflower seed|pumpkin seed|chia|linaza|flax',
  ],
  drinks: [
    '💧 water|agua|sparkling water|mineral water|agua mineral|agua con gas|agua sin gas|coconut water|agua de coco',
    '🧃 juice|jugo|zumo|nectar|refresco de sobre|tang',
    '🥤 soda|refresco|gaseosa|coke|coca|cola|pepsi|sprite|fanta|soft drink|tonic|tonica|ginger ale|7up',
    '⚡ energy drink|bebida energetica|red bull|monster|gatorade|powerade|sports drink|isotonic|electrolyte',
    '🧋 iced tea|ice tea|te helado|kombucha|bubble tea|cold brew',
  ],
  alcohol: [
    '🍺 beer|cerveza|lager|ipa|ale|stout|chela|birra|pilsner',
    '🍷 wine|vino|red wine|vino tinto|tinto|rose|merlot|malbec|cabernet|tannat|white wine|vino blanco',
    '🥂 champagne|champan|prosecco|cava|sparkling wine|espumante|espumoso|cider|sidra',
    '🥃 whisky|whiskey|rum|ron|vodka|gin|tequila|mezcal|brandy|cognac|singani|pisco|fernet|liqueur|licor|aguardiente|bourbon',
    '🍹 cocktail|coctel|mixer|vermouth|vermut|aperol|campari|sangria',
  ],
  frozen: [
    '🍦 ice cream|helado|gelato|sorbet|sorbete|popsicle|paleta helada|ice pop|ice lolly|frozen yogurt',
    '🍕 pizza',
    '🍟 fries|french fries|papas prefritas|hash brown|tater tot',
    '🧊 ice|hielo|ice cube|cubito de hielo',
    '🥟 dumpling|gyoza|empanadilla|potsticker|wonton|pierogi|spring roll|rollito primavera',
    '🍗 nugget|chicken nugget|fish finger|fish stick|croquette|croqueta',
    '🥦 frozen veg|frozen vegetable|mixed veg|mixed vegetable|verduras congeladas|stir fry mix',
  ],
  household: [
    '🧻 toilet paper|papel higienico|loo roll|toilet roll|paper|papel|paper towel|toalla de papel|papel de cocina|kitchen roll|rollo de cocina|servilleta|napkin|tissue|panuelo|kleenex|carilina',
    '🧽 sponge|esponja|scrubber|scourer|estropajo|virulana|steel wool|cloth|trapo|pano|rag|microfiber|bayeta',
    '🧼 dish soap|dishwashing liquid|washing up liquid|lavavajillas|detergente para platos|lavaplatos|lava loza|jabon de platos|dish detergent|dishwasher tablet|pastillas lavavajillas|rinse aid',
    '🫧 detergent|detergente|laundry|laundry detergent|fabric softener|suavizante|stain remover|quitamanchas|jabon en polvo|jabon de ropa|vanish|dryer sheet',
    '🧪 bleach|lavandina|lejia|cloro|cleaner|limpiador|multipurpose|multiuso|disinfectant|desinfectante|lysol|windex|glass cleaner|limpiavidrios|floor cleaner|limpiapisos|ajax|cif|toilet cleaner|harpic|degreaser|desengrasante|clorox',
    '🗑️ trash bag|bin bag|garbage bag|bolsa de basura|trash|basura|bin liner|garbage',
    '🧹 broom|escoba|dustpan|recogedor|mop|trapeador|fregona|mopa|bucket|balde|cubeta',
    '🥡 aluminum foil|aluminium foil|foil|papel aluminio|plastic wrap|cling film|cling wrap|papel film|parchment|papel manteca|papel de horno|baking paper|ziploc|zip bag|freezer bag|sandwich bag|tupper|tupperware|coffee filter|filtro de cafe',
    '💡 light bulb|lightbulb|bombilla|foco|bombillo|ampolleta',
    '🔋 battery|batteries|pila|bateria',
    '🕯️ candle|vela',
    '🔥 match|fosforo|cerillo|cerilla|lighter|encendedor|charcoal|carbon|firelighter|gas',
    '🦟 insecticide|bug spray|repellent|repelente|raid|baygon|mosquito|roach|cucaracha|ant trap|fly spray|matamoscas',
    '🌸 air freshener|ambientador|aromatizante|desodorante ambiental|glade|incense|incienso',
    '🧤 glove|guante|rubber gloves|guantes de goma',
    '🧺 clothespin|clothes peg|hanger|percha|gancho de ropa|colgador|laundry basket',
    '🪴 plant|planta|potting soil|tierra|fertilizer|fertilizante|abono',
  ],
  personal: [
    '🧴 shampoo|champu|conditioner|acondicionador|body wash|shower gel|gel de ducha|lotion|locion|body cream|crema corporal|moisturizer|hidratante|deodorant|desodorante|antiperspirant|antitranspirante',
    '🦷 toothpaste|pasta dental|pasta de dientes|crema dental|dentifrico|colgate',
    '🪥 toothbrush|cepillo de dientes|cepillo dental|floss|hilo dental|mouthwash|enjuague bucal|listerine',
    '🧼 soap|jabon|hand soap|jabon de manos|hand wash|bar soap|hand sanitizer|sanitizer|alcohol en gel|alcohol gel',
    '🪒 razor|rasuradora|afeitadora|maquinilla|gillette|shaving cream|shaving foam|espuma de afeitar|blade|cuchilla|hojas de afeitar',
    '✨ perfume|cologne|colonia|fragrance',
    '💄 makeup|maquillaje|lipstick|labial|pintalabios|mascara|rimel|nail polish|esmalte|makeup remover|desmaquillante|cotton pad|discos de algodon|concealer|corrector',
    '☀️ sunscreen|sunblock|protector solar|bloqueador|bloqueador solar|sun cream|spf|after sun',
    '🌸 pads|tampon|sanitary pad|toalla higienica|toallas femeninas|toallitas femeninas|panty liner|protector diario|menstrual|copa menstrual',
    '💇 hair gel|gel para el pelo|hairspray|hair spray|laca|hair dye|tinte|hair tie|colet|bobby pin|comb|peine|hairbrush|cepillo de pelo|cepillo',
    '☁️ cotton|algodon|cotton swab|q-tip|hisopo|cotonete|cotton ball',
    '💅 nail clipper|cortaunas|nail file|lima de unas',
    '🛁 bath salts|bubble bath|sales de bano|bath bomb|loofah',
    '🧖 face mask|mascarilla facial|face wash|cleanser|serum|skincare|crema facial|face cream|lip balm|protector labial|vaseline|vaselina',
  ],
  health: [
    '💊 medicine|medicina|medicamento|remedio|pill|pastilla|tablet|vitamin|vitamina|supplement|suplemento|paracetamol|ibuprofen|ibuprofeno|aspirin|aspirina|tylenol|advil|antacid|antiacido|antihistamine|antialergico|allergy|omeprazol|melatonin|melatonina|probiotic|probiotico|zinc|magnesium|magnesio|omega|painkiller|analgesico',
    '🩹 band-aid|bandaid|plaster|curita|tirita|bandage|venda|gauze|gasa|first aid|botiquin|alcohol|rubbing alcohol|agua oxigenada|hydrogen peroxide|iodine|yodo|betadine|ointment|pomada|unguento',
    '🌡️ thermometer|termometro',
    '😷 mask|mascarilla|barbijo|cubrebocas|tapabocas',
    '🍯 cough syrup|jarabe|jarabe para la tos|cough drop|pastillas para la tos|throat lozenge|strepsils|halls',
    '👁️ eye drops|gotas|gotas para los ojos|saline|suero|suero oral|nasal spray|contact lens solution|lens solution|contact lens|lentes de contacto',
    '❤️ condom|condon|preservativo|lube|lubricante|pregnancy test|prueba de embarazo',
    '💉 insulin|insulina|syringe|jeringa|test strip|tiras reactivas|glucose',
  ],
  baby: [
    '👶 diaper|nappy|nappies|panal|pull-ups|pacifier|chupete|chupon|binky|dummy|teether|mordedor',
    '🍼 formula|baby formula|leche de formula|leche para bebe|baby milk|formula infantil|baby bottle|biberon|mamadera|mamila|tetero|teat',
    '🧻 wipes|baby wipes|wet wipes|toallitas|toallitas humedas',
    '🥣 baby food|papilla|compota|baby cereal|cerelac|gerber|puree para bebe',
    '🧴 diaper cream|rash cream|crema para panal|crema para la cola|bepanthen|hipoglos|desitin|baby powder|talco|baby shampoo|shampoo para bebe|baby oil|aceite para bebe|baby lotion',
    '🧸 toy|juguete|stuffed animal|peluche',
  ],
  pets: [
    '🐶 dog food|comida para perro|alimento para perro|dog|perro|puppy|cachorro|kibble|dog treat',
    '🐱 cat food|comida para gato|alimento para gato|cat|gato|gatito|kitten|whiskas|cat treat',
    '🐾 cat litter|litter|arena para gato|arena sanitaria|arena|piedras sanitarias|pet|mascota|flea|pulga|antipulgas|garrapata|leash|correa|poop bag|bolsas para caca|pet shampoo|collar',
    '🦴 treat|chew|bone|hueso|premio|rawhide|dentastix',
    '🐠 fish food|alimento para peces|aquarium|pecera',
    '🐦 bird seed|bird food|alpiste|alimento para aves|pajaro',
    '🐹 hamster|rabbit|conejo|guinea pig|cuy|hay|heno|sawdust|viruta',
  ],
  other: [
    '🎁 gift|regalo|present|wrapping paper|papel de regalo|card|tarjeta|gift card',
    '🎈 balloon|globo|party|fiesta|birthday|cumpleanos|decoration|decoracion|party hat',
    '💐 flower|flor|bouquet|ramo de flores',
    '🔌 charger|cargador|cable|adapter|adaptador|extension cord|alargador',
    '👕 clothes|ropa|sock|calcetin|underwear|ropa interior|t-shirt|camiseta|polera',
    '📝 pen|lapicero|boligrafo|pencil|lapiz|lapices|notebook|cuaderno|tape|cinta adhesiva|scotch|glue|pegamento|marker|marcador|school supplies|utiles escolares|printer paper|papel bond',
    '🛍️ bag|bolsa|reusable bag|bolsa reutilizable|tote',
    '📰 newspaper|periodico|diario|magazine|revista',
  ],
};

/** "Frozen peas" and "canned peaches" keep their icon but go to the frozen/tinned aisle. */
const MODIFIERS: [CategoryId, RegExp][] = [
  ['frozen', /(?:^| )(?:frozen|congelad[oa]s?)(?= |$)/],
  ['pantry', /(?:^| )(?:canned|tinned|enlatad[oa]s?|en lata|de lata)(?= |$)/],
];
const FRESH = new Set<CategoryId>(['produce', 'bakery', 'deli', 'meat', 'seafood', 'dairy']);

interface Keyword {
  re: RegExp;
  phrase: boolean;
  length: number;
  emoji: string;
  category: CategoryId;
}

const keyword = (raw: string, emoji: string, category: CategoryId): Keyword => {
  const stem = raw.endsWith('*');
  const word = normalize(stem ? raw.slice(0, -1) : raw);
  const body = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    re: new RegExp(`(?:^| )${body}${stem ? '' : '(?:e?s)?(?= |$)'}`),
    phrase: word.includes(' '),
    length: word.length,
    emoji,
    category,
  };
};

const KEYWORDS: Keyword[] = (Object.entries(LIBRARY) as [CategoryId, string[]][]).flatMap(([category, lines]) =>
  lines.flatMap((line) => {
    const space = line.indexOf(' ');
    const emoji = line.slice(0, space);
    return line
      .slice(space + 1)
      .split('|')
      .map((w) => keyword(w, emoji, category));
  }),
);

/** Phrases win by length ("peanut butter" over "butter"); single words by position, the noun comes last ("orange juice"). */
function bestMatch(text: string, phrase: boolean): Keyword | undefined {
  let best: Keyword | undefined;
  let score = -1;
  for (const k of KEYWORDS) {
    if (k.phrase !== phrase) continue;
    const m = k.re.exec(text);
    if (!m) continue;
    const s = phrase ? k.length : m.index + m[0].length;
    if (s > score) {
      best = k;
      score = s;
    }
  }
  return best;
}

// Spanish puts the noun first ("jugo de naranja"), so single words are looked for before the preposition first.
const PREPOSITION = / (?:de|del|con|para|sin|en|al|a la) /;
const lookups = new Map<string, { emoji: string; category: CategoryId } | null>();

function lookup(name: string) {
  const text = normalize(name)
    .replace(/[^\p{L}\p{N}-]+/gu, ' ')
    .trim();
  let hit = lookups.get(text);
  if (hit === undefined) {
    const k = bestMatch(text, true) ?? bestMatch(text.split(PREPOSITION)[0], false) ?? bestMatch(text, false);
    const mod = MODIFIERS.find(([, re]) => re.test(text))?.[0];
    if (k) hit = { emoji: k.emoji, category: mod && FRESH.has(k.category) ? mod : k.category };
    else hit = mod ? { emoji: categoryEmoji(mod), category: mod } : null;
    lookups.set(text, hit);
  }
  return hit ?? undefined;
}

/** First-time guess of an item's aisle; remembered per name once the user corrects it. */
export const guessCategory = (name: string): CategoryId => lookup(name)?.category ?? 'other';

/** The item's own icon ("Avocados" → 🥑), falling back to its aisle's. */
export const itemEmoji = (name: string, category: string) => lookup(name)?.emoji ?? categoryEmoji(category);

/** "2 milk", "milk x2", "milk 2kg" → name + quantity. */
export function parseQuickAdd(input: string): { name: string; qty: string } {
  const text = input.trim().replace(/\s+/g, ' ');
  const lead = text.match(/^(\d+(?:[.,]\d+)?\s?(?:x|kg|g|l|ml|lb|oz|pcs?)?)\s+(.+)$/i);
  if (lead) return { name: lead[2], qty: lead[1].replace(/\s?x$/i, '') };
  const tail = text.match(/^(.+?)\s+(?:x\s?)?(\d+(?:[.,]\d+)?\s?(?:kg|g|l|ml|lb|oz|pcs?)?)$/i);
  if (tail) return { name: tail[1], qty: tail[2] };
  return { name: text, qty: '' };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const seed = () => {
  const now = new Date();
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
  const hid = SEED.household;
  const raw: [string, string, CategoryId, string, boolean, string][] = [
    ['Avocados', '3', 'produce', '', false, SEED.sam],
    ['Bananas', '', 'produce', 'Not too ripe', false, SEED.me],
    ['Sourdough bread', '', 'bakery', '', false, SEED.noa],
    ['Oat milk', '2', 'dairy', 'Barista edition', false, SEED.me],
    ['Eggs', '12', 'dairy', '', true, SEED.sam],
    ['Coffee beans', '', 'pantry', '', false, SEED.noa],
    ['Pasta', '2', 'pantry', '', true, SEED.me],
    ['Dish soap', '', 'household', '', false, SEED.sam],
  ];
  const items: ShoppingItem[] = raw.map(([name, qty, category, note, checked, by], i) => ({
    id: uid(),
    householdId: hid,
    name,
    qty,
    note,
    category,
    checked,
    checkedBy: checked ? SEED.me : undefined,
    addedBy: by,
    createdAt: ago(200 - i * 10),
    updatedAt: ago(200 - i * 10),
  }));
  const extra: [string, CategoryId, number][] = [
    ['Tomatoes', 'produce', 9],
    ['Greek yogurt', 'dairy', 7],
    ['Chicken breast', 'meat', 6],
    ['Toilet paper', 'household', 5],
    ['Sparkling water', 'drinks', 5],
    ['Rice', 'pantry', 4],
    ['Frozen berries', 'frozen', 3],
    ['Shampoo', 'personal', 2],
  ];
  const catalog: CatalogEntry[] = [
    ...items.map((it, i) => ({ name: it.name, category: it.category, times: 10 - i })),
    ...extra.map(([name, category, times]) => ({ name, category, times })),
  ].map((e) => ({
    id: `${hid}:${normalize(e.name)}`,
    householdId: hid,
    name: e.name,
    category: e.category,
    timesAdded: e.times,
    lastAddedAt: ago(60 * 24 * 3),
  }));
  return { items, catalog };
};

const store = persistedStore('shopping', seed);
const { state, update } = store;

arrayCollection(store, 'shopping', 'items', (s) => s.items);
arrayCollection(store, 'shopping', 'catalog', (s) => s.catalog);

export const items = () => state.items.filter((i) => i.householdId === household().id);

const catalogFor = (hid: string) => state.catalog.filter((c) => c.householdId === hid);

/** Top suggestions ranked by how often they've been added (B3), skipping what's already on the list. */
export function suggest(query: string, limit = 8): CatalogEntry[] {
  const q = normalize(query);
  const onList = new Set(items().filter((i) => !i.checked).map((i) => normalize(i.name)));
  return catalogFor(household().id)
    .filter((c) => !onList.has(normalize(c.name)) && (!q || normalize(c.name).includes(q)))
    .sort((a, b) => {
      // Prefix matches first, then frequency, then recency.
      const ap = q && normalize(a.name).startsWith(q) ? 1 : 0;
      const bp = q && normalize(b.name).startsWith(q) ? 1 : 0;
      return bp - ap || b.timesAdded - a.timesAdded || b.lastAddedAt.localeCompare(a.lastAddedAt);
    })
    .slice(0, limit);
}

function remember(hid: string, name: string, category: CategoryId, bump: boolean) {
  update((s) => {
    const id = `${hid}:${normalize(name)}`;
    const entry = s.catalog.find((c) => c.id === id);
    const now = new Date().toISOString();
    if (entry) {
      entry.category = category;
      if (bump) {
        entry.timesAdded += 1;
        entry.lastAddedAt = now;
        entry.name = name;
      }
    } else {
      s.catalog.push({ id, householdId: hid, name, category, timesAdded: bump ? 1 : 0, lastAddedAt: now });
    }
  });
}

export type AddResult = { status: 'added'; item: ShoppingItem } | { status: 'exists'; item: ShoppingItem };

/** Adds an item, or reports the existing unticked one so nothing gets bought twice. */
export function addItem(input: { name: string; qty?: string; note?: string; category?: CategoryId }): AddResult {
  const hid = household().id;
  const name = capitalize(input.name.trim());
  const existing = items().find((i) => !i.checked && normalize(i.name) === normalize(name));
  if (existing) return { status: 'exists', item: existing };

  const known = state.catalog.find((c) => c.id === `${hid}:${normalize(name)}`);
  const now = new Date().toISOString();
  const item: ShoppingItem = {
    id: uid(),
    householdId: hid,
    name,
    qty: input.qty?.trim() ?? '',
    note: input.note?.trim() ?? '',
    category: input.category ?? known?.category ?? guessCategory(name),
    checked: false,
    addedBy: myId(),
    createdAt: now,
    updatedAt: now,
  };
  // Re-adding something that's ticked replaces the ticked copy.
  update((s) => {
    s.items = s.items.filter((i) => !(i.householdId === hid && i.checked && normalize(i.name) === normalize(name)));
    s.items.push(item);
  });
  remember(hid, name, item.category, true);
  log('item.added', { name });
  return { status: 'added', item };
}

export function toggleItem(id: string) {
  update((s) => {
    const it = s.items.find((i) => i.id === id);
    if (!it) return;
    it.checked = !it.checked;
    it.checkedBy = it.checked ? myId() : undefined;
    it.updatedAt = new Date().toISOString();
  });
}

export function updateItem(id: string, patch: Partial<Pick<ShoppingItem, 'name' | 'qty' | 'note' | 'category'>>) {
  const current = state.items.find((i) => i.id === id);
  if (!current) return;
  update((s) => {
    const it = s.items.find((i) => i.id === id);
    if (!it) return;
    Object.assign(it, patch, { updatedAt: new Date().toISOString() });
    if (patch.name) it.name = capitalize(patch.name.trim());
  });
  // Category is remembered per item name (B4).
  const after = state.items.find((i) => i.id === id);
  if (!after) return;
  remember(after.householdId, after.name, after.category, false);
}

/** Removes an item and returns a function that puts it back. */
export function removeItem(id: string): () => void {
  const index = state.items.findIndex((i) => i.id === id);
  if (index < 0) return () => {};
  const copy = clone(state.items[index]);
  update((s) => {
    s.items.splice(index, 1);
  });
  return () =>
    update((s) => {
      if (!s.items.some((i) => i.id === copy.id)) s.items.splice(Math.min(index, s.items.length), 0, copy);
    });
}

/** "Clear ticked" (B2); returns an undo. */
export function clearChecked(): () => void {
  const hid = household().id;
  const removed = state.items.filter((i) => i.householdId === hid && i.checked).map(clone);
  if (!removed.length) return () => {};
  update((s) => {
    s.items = s.items.filter((i) => !(i.householdId === hid && i.checked));
  });
  log('item.cleared', { count: removed.length });
  return () =>
    update((s) => {
      const ids = new Set(s.items.map((i) => i.id));
      s.items.push(...removed.filter((r) => !ids.has(r.id)));
    });
}

export function forgetSuggestion(id: string) {
  update((s) => {
    s.catalog = s.catalog.filter((c) => c.id !== id);
  });
}
