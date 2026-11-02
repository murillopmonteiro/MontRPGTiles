// Light Screen core: dice, the table roller, treasure tables and dungeon-encounter tables.
// Shared by dmscreen.html (Light Screen) and flagstone.html, so both roll from the same data.
// Everything lives under LS. Text can be a string or {pt, en}; LS.lang picks the language.
const LS = (() => {
const S0 = {lang:"pt"};
const L = x => x && typeof x === "object" ? (x[S0.lang] ?? x.pt ?? x.en) : x;
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const rnd = n => 1 + Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 2**32 * n);

// "01-05" / "96-00" / "7" → [lo,hi]; 00 means 100 on a d100.
function range(s, sides){
  const [a,b=a] = String(s).split(/[-–]/).map(x => x.trim());
  const n = x => (x === "00" || x === "0") && sides === 100 ? 100 : +x;
  return [n(a), n(b)];
}
// "2d6+1d4-2" → {total, detail}; rng(n) returns 1..n (seedable).
function rollExpr(e, rng=rnd){
  const terms = e.replace(/\s/g,"").replace(/−/g,"-").toLowerCase().match(/[+-]?[^+-]+/g);
  if(!terms) return null;
  let total = 0, parts = [];
  for(const t of terms){
    const sign = t[0] === "-" ? -1 : 1, body = t.replace(/^[+-]/,"");
    const m = body.match(/^(\d*)d(\d+)$/);
    if(m){
      const k = +(m[1] || 1), s = +m[2];
      if(k > 100 || s < 1) return null;
      const r = Array.from({length:k}, () => rng(s));
      total += sign * r.reduce((x,y) => x+y, 0);
      parts.push((sign < 0 ? "−" : "") + "[" + r.join(",") + "]");
    } else if(/^\d+$/.test(body)){ total += sign * +body; parts.push((sign < 0 ? "−" : "+") + body); }
    else return null;
  }
  return {total, detail: parts.join(" ")};
}

// Row builders: R([[range, pt, en]]), S(range, pt, en, subrows), list(ptArray, enArray) numbers rows 1..n.
const R = a => a.map(([r,pt,en]) => [r,{pt,en}]);
const S = (r, pt, en, sub) => [r, {pt,en}, R(sub)];
const list = (pt, en) => pt.map((x,i) => [String(i+1), x, en[i]]);
const subOf = row => Array.isArray(row?.[2]) ? row[2] : null;
// Sub-table die = highest range end ("6-7" rows mean the die is bigger than the row count).
const subDie = sub => Math.max(...sub.map(r => range(r[0], 100)[1]));
const plain = html => String(html).replace(/<div[^>]*>/g," — ").replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();

// Every rollable table by id (pages add their own), and named functions a link can call ("@tavernName").
const TABLES = {}, LINK_FN = {};

// Rolls a table → {val, text (html), picks (rows), keys (row keys hit)}.
// Handles `twice` (that row = roll two more, ignoring it), `link` (that row also rolls other tables)
// and sub-tables (a row whose 3rd element is an array of rows: roll again on it).
// opts: rng (seedable), onRoll(table, keys) after each table rolled (for highlighting), links:false to skip links.
function resolveRoll(t, opts={}){
  const rng = opts.rng || rnd, sides = +t.die.replace(/\D/g,"");
  const find = (rows, n, v) => rows.findIndex(r => { const [lo,hi] = range(r[0], n); return v >= lo && v <= hi; });
  // "d20" rolls one die; anything else ("d12+d8") goes through the expression roller.
  const pick = () => { const v = /^d\d+$/.test(t.die) ? rng(sides) : rollExpr(t.die, rng).total; return {v, i: find(t.rows, sides, v)}; };
  let first = pick(), picks = [first];
  if(t.twice && t.rows[first.i]?.[0] === t.twice){
    const again = () => { let p; do p = pick(); while(t.rows[p.i]?.[0] === t.twice); return p; };
    picks = [again(), again()];
  }
  for(const p of picks){ const sub = subOf(t.rows[p.i]);
    if(sub){ p.sv = rng(subDie(sub)); p.j = find(sub, subDie(sub), p.sv); } }
  const keys = picks.flatMap(p => p.j != null ? [`${p.i}`, `${p.i}.${p.j}`] : [`${p.i}`]);
  opts.onRoll?.(t, keys);
  const lines = picks.map(p => {
    if(p.i < 0) return `<i>${L({pt:"nenhuma linha corresponde",en:"no matching row"})}</i>`;
    const row = t.rows[p.i];
    let s = row.slice(1, t.cols.length).map(L).join(" — ");
    if(p.j != null) s += ` — ${L(subOf(row)[p.j][1])}`;
    if(t.desc?.[row[0]]) s += `<div class="desc">${L(t.desc[row[0]])}</div>`;
    if(opts.links !== false) for(const id of [].concat(t.link?.[row[0]] ?? [])){
      if(LINK_FN[id]){ const r = LINK_FN[id](); s += `<div class="nest"><h4>↳ ${esc(L(r.title))}</h4>${r.text}</div>`; continue; }
      const lt = TABLES[id], r = resolveRoll(lt, opts);
      s += `<div class="nest"><h4>↳ ${esc(L(lt.title))} (${r.val})</h4>${r.text}</div>`; }
    return s;
  });
  const v = p => p.v + (p.sv ? "/" + p.sv : "");
  return {val: (picks.length > 1 ? first.v + " → " : "") + picks.map(v).join(", "), text: lines.join("<br>"), keys,
    picks: picks.map(p => p.j != null ? subOf(t.rows[p.i])[p.j] : t.rows[p.i])};
}

// ── Treasure ──
const tbl = (id, die, pt, en, colPt, colEn, rows, extra={}) => ({id, die, title:{pt,en}, cols:[die,{pt:colPt,en:colEn}], rows, ...extra});
const gem = (v, die, rows) => tbl("gem"+v, die, `Gemas de ${v.toLocaleString("pt-BR")} po`, `${v.toLocaleString("en")} gp Gemstones`, "Descrição da Pedra", "Stone Description", R(rows), {value:v});
const art = (v, die, rows) => tbl("art"+v, die, `Objetos de Arte de ${v.toLocaleString("pt-BR")} po`, `${v.toLocaleString("en")} gp Art Objects`, "Objeto", "Object", R(rows), {value:v});
const TREASURE = {
 gem10:gem(10,"d12",list(["Azurita (azul escuro mosqueado opaco)","Ágata malhada (marrom, azul, branca ou vermelha translúcida e listrada)","Quartzo azul (azul claro transparente)",
  "Ágata ocular (círculos translúcidos de cinza, branco, marrom, azul ou verde)","Hematita (cinza escuro opaco)","Lápis-lazúli (azul claro e escuro opaco com manchas amarelas)",
  "Malaquita (opaco estriado com verde claro e escuro)","Ágata musgo (rosa translúcido ou amarelo claro com marcas cinza ou verdes como musgo)","Obsidiana (preto opaco)",
  "Rodocrosita (rosa claro opaco)","Olho de tigre (marrom translúcido com centro dourado)","Turquesa (azul esverdeado claro opaco)"],
  ["Azurite (opaque mottled deep blue)","Banded agate (translucent striped brown, blue, white, or red)","Blue quartz (transparent pale blue)",
  "Eye agate (translucent circles of gray, white, brown, blue, or green)","Hematite (opaque gray-black)","Lapis lazuli (opaque light and dark blue with yellow flecks)",
  "Malachite (opaque striated light and dark green)","Moss agate (translucent pink or yellow-white with mossy gray or green markings)","Obsidian (opaque black)",
  "Rhodochrosite (opaque light pink)","Tiger eye (translucent brown with golden center)","Turquoise (opaque light blue-green)"])),
 gem50:gem(50,"d12",list(["Pedra de sangue (cinza escuro opaco com manchas vermelhas)","Cornalina (de laranja a vermelho amarronzado opaco)","Calcedônia (branco opaco)",
  "Crisoprásio (verde translúcido)","Citrino (amarelo claro amarronzado transparente)","Jaspe (azul, preto ou marrom opaco)","Pedra da lua (branco translúcido com brilho azul claro)",
  "Ônix (faixas opacas de preto e branco, ou preto ou branco puro)","Quartzo (branco transparente, cinza ou amarelo esfumaçado)","Sardônica (faixas opacas de vermelho e branco)",
  "Quartzo rosa estrela (pedra rosa translúcida com centro branco em forma de estrela)","Zircão (azul esverdeado claro transparente)"],
  ["Bloodstone (opaque dark gray with red flecks)","Carnelian (opaque orange to red-brown)","Chalcedony (opaque white)","Chrysoprase (translucent green)",
  "Citrine (transparent pale yellow-brown)","Jasper (opaque blue, black, or brown)","Moonstone (translucent white with pale blue glow)",
  "Onyx (opaque bands of black and white, or pure black or white)","Quartz (transparent white, smoky gray, or yellow)","Sardonyx (opaque bands of red and white)",
  "Star rose quartz (translucent rosy stone with white star-shaped center)","Zircon (transparent pale blue-green)"])),
 gem100:gem(100,"d10",list(["Âmbar (transparente, de ouro aquoso a ouro vívido)","Ametista (púrpura profundo transparente)","Crisoberilo (transparente, de amarelo esverdeado a verde claro)",
  "Coral (carmesim opaco)","Granada (vermelho, marrom esverdeado ou violeta transparente)","Jade (verde claro, verde escuro ou branco translúcido)","Azeviche (preto profundo opaco)",
  "Pérola (branco, amarelo ou rosa opaco e lustroso)","Espinela (vermelho, vermelho amarronzado ou verde escuro transparente)","Turmalina (verde, azul, marrom ou vermelho transparente)"],
  ["Amber (transparent watery gold to rich gold)","Amethyst (transparent deep purple)","Chrysoberyl (transparent yellow-green to pale green)","Coral (opaque crimson)",
  "Garnet (transparent red, brown-green, or violet)","Jade (translucent light green, deep green, or white)","Jet (opaque deep black)","Pearl (opaque lustrous white, yellow, or pink)",
  "Spinel (transparent red, red-brown, or deep green)","Tourmaline (transparent pale green, blue, brown, or red)"])),
 gem500:gem(500,"d6",list(["Alexandrita (verde escuro transparente)","Água-marinha (azul esverdeado claro transparente)","Pérola negra (preto puro opaco)",
  "Espinela azul (azul escuro transparente)","Peridoto (verde oliva vívido transparente)","Topázio (amarelo-ouro transparente)"],
  ["Alexandrite (transparent dark green)","Aquamarine (transparent pale blue-green)","Black pearl (opaque pure black)","Blue spinel (transparent deep blue)",
  "Peridot (transparent rich olive green)","Topaz (transparent golden yellow)"])),
 gem1000:gem(1000,"d8",list(["Opala negra (verde escuro translúcido com preto mosqueado e manchas douradas)","Safira azul (de azul claro a azul médio transparente)",
  "Esmeralda (verde escuro brilhante transparente)","Opala de fogo (vermelho fogo translúcido)","Opala (azul claro translúcido mosqueado de verde e dourado)",
  "Rubi estrela (rubi translúcido com centro branco em forma de estrela)","Safira estrela (safira azul translúcida com centro branco em forma de estrela)",
  "Safira amarela (amarelo fogo ou amarelo esverdeado transparente)"],
  ["Black opal (translucent dark green with black mottling and golden flecks)","Blue sapphire (transparent blue-white to medium blue)","Emerald (transparent deep bright green)",
  "Fire opal (translucent fiery red)","Opal (translucent pale blue with green and golden mottling)","Star ruby (translucent ruby with white star-shaped center)",
  "Star sapphire (translucent blue sapphire with white star-shaped center)","Yellow sapphire (transparent fiery yellow or yellow-green)"])),
 gem5000:gem(5000,"d4",list(["Safira negra (preto lustroso translúcido com reflexos brilhantes)","Diamante (azul claro, canário, rosa, marrom ou azul transparente)",
  "Jacinto (laranja fogo transparente)","Rubi (de vermelho claro a carmesim escuro transparente)"],
  ["Black sapphire (translucent lustrous black with glowing highlights)","Diamond (transparent blue-white, canary, pink, brown, or blue)",
  "Jacinth (transparent fiery orange)","Ruby (transparent clear red to deep crimson)"])),
 art25:art(25,"d10",list(["Jarro de prata","Estatueta esculpida em osso","Bracelete de ouro pequeno","Vestimenta de tecido dourado","Máscara de veludo negro costurada com fios de prata",
  "Cálice de cobre com filigrana prateada","Par de dados de osso com gravuras","Pequeno espelho numa moldura de madeira pintada","Lenço de seda bordado","Medalhão de ouro com um retrato pintado dentro"],
  ["Silver ewer","Carved bone statuette","Small gold bracelet","Cloth-of-gold vestments","Black velvet mask stitched with silver thread","Copper chalice with silver filigree",
  "Pair of engraved bone dice","Small mirror set in a painted wooden frame","Embroidered silk handkerchief","Gold locket with a painted portrait inside"])),
 art250:art(250,"d10",list(["Anel de ouro cravejado com pedras de sangue","Estatueta esculpida em marfim","Bracelete de ouro largo","Colar de prata com um pingente de pedra preciosa","Coroa de bronze",
  "Robe de seda com bordados de ouro","Grande tapeçaria elegante","Caneca de latão com jade incrustado","Caixa de miniaturas de animais em turquesa","Gaiola de pássaro de ouro com filigrana de electro"],
  ["Gold ring set with bloodstones","Carved ivory statuette","Large gold bracelet","Silver necklace with a gemstone pendant","Bronze crown","Silk robe with gold embroidery",
  "Large well-made tapestry","Brass mug with jade inlay","Box of turquoise animal figurines","Gold bird cage with electrum filigree"])),
 art750:art(750,"d10",list(["Cálice de prata cravejado com pedras da lua","Espada longa de lâmina prateada com azeviche no cabo","Harpa de madeira exótica com marfim incrustado e gemas de zircão",
  "Pequeno ídolo de ouro","Pente de ouro em forma de dragão com granadas vermelhas nos olhos","Rolha de garrafa gravada com folhas de ouro e cravejada com ametistas",
  "Adaga cerimonial de electro com uma pérola negra no pomo","Broche de prata e ouro","Estatueta de obsidiana com detalhes e incrustações de ouro","Máscara de guerra de ouro pintada"],
  ["Silver chalice set with moonstones","Silver-plated longsword with jet set in the hilt","Carved harp of exotic wood with ivory inlay and zircon gems","Small gold idol",
  "Gold dragon comb set with red garnets as eyes","Bottle stopper embossed with gold leaf and set with amethysts","Ceremonial electrum dagger with a black pearl in the pommel",
  "Silver and gold brooch","Obsidian statuette with gold fittings and inlay","Painted gold war mask"])),
 art2500:art(2500,"d10",list(["Corrente de ouro fina cravejada com uma opala de fogo","Pintura antiga, obra-prima","Manto de seda e veludo bordado com diversas pedras da lua",
  "Bracelete de platina cravejado com uma safira","Luva bordada com lascas de joias","Tornozeleira cheia de joias","Caixa de música de ouro","Diadema de ouro cravejado com quatro águas-marinhas",
  "Tapa-olho com um olho falso de safira azul e pedra da lua","Um colar de pequenas pérolas rosas"],
  ["Fine gold chain set with a fire opal","Old masterpiece painting","Embroidered silk and velvet mantle set with numerous moonstones","Platinum bracelet set with a sapphire",
  "Embroidered glove set with jewel chips","Jeweled anklet","Gold music box","Gold circlet set with four aquamarines","Eye patch with a mock eye of blue sapphire and moonstone",
  "A necklace string of small pink pearls"])),
 art7500:art(7500,"d8",list(["Coroa de ouro cheia de joias","Anel de platina cheio de joias","Pequena estatueta de ouro cravejada com rubis","Taça de ouro cravejada com esmeraldas",
  "Caixa de joias de ouro com filigrana de platina","Sarcófago infantil de ouro pintado","Tabuleiro de jade com peças de ouro maciço","Chifre de beber de marfim adornado com filigrana de ouro"],
  ["Jeweled gold crown","Jeweled platinum ring","Small gold statuette set with rubies","Gold cup set with emeralds","Gold jewelry box with platinum filigree",
  "Painted gold child's sarcophagus","Jade game board with solid gold playing pieces","Bejeweled ivory drinking horn with gold filigree"])),
};
const mi = (L1, rows) => tbl("mi"+L1, "d100", `Tabela de Item Mágico ${L1}`, `Magic Item Table ${L1}`, "Item Mágico", "Magic Item", rows);
const SC = n => ({pt:`Pergaminho de magia (${n === 0 ? "truque" : n+"º nível"})`, en:`Spell scroll (${n === 0 ? "cantrip" : ["","1st","2nd","3rd"][n] || n+"th"}${n ? " level" : ""})`});
const I = (r, pt, en) => [r, typeof pt === "object" ? pt : {pt, en}];
Object.assign(TREASURE, {
 miA:mi("A",[I("01-50","Poção de cura","Potion of healing"),I("51-60",SC(0)),I("61-70","Poção de escalar","Potion of climbing"),I("71-90",SC(1)),I("91-94",SC(2)),
  I("95-98","Poção de cura maior","Potion of greater healing"),I("99","Mochila de carga","Bag of holding"),I("00","Globo de fluxo","Driftglobe")]),
 miB:mi("B",[I("01-15","Poção de cura maior","Potion of greater healing"),I("16-22","Poção de sopro de fogo","Potion of fire breath"),I("23-29","Poção de resistência","Potion of resistance"),
  I("30-34","Munição +1","Ammunition, +1"),I("35-39","Poção de amizade animal","Potion of animal friendship"),I("40-44","Poção de força do gigante da colina","Potion of hill giant strength"),
  I("45-49","Poção de aumentar","Potion of growth"),I("50-54","Poção de respirar na água","Potion of water breathing"),I("55-59",SC(2)),I("60-64",SC(3)),
  I("65-67","Mochila de carga","Bag of holding"),I("68-70","Unguento de Keoghtom","Keoghtom's ointment"),I("71-73","Óleo escorregadio","Oil of slipperiness"),
  I("74-75","Pó do desaparecimento","Dust of disappearance"),I("76-77","Pó da secura","Dust of dryness"),I("78-79","Pó de espirrar e tossir","Dust of sneezing and choking"),
  I("80-81","Gema elemental","Elemental gem"),I("82-83","Filtro do amor","Philter of love"),I("84","Jarro de alquimia","Alchemy jug"),I("85","Capuz de respirar na água","Cap of water breathing"),
  I("86","Manto da arraia","Cloak of the manta ray"),I("87","Globo de fluxo","Driftglobe"),I("88","Óculos noturnos","Goggles of night"),I("89","Elmo de compreensão de idiomas","Helm of comprehending languages"),
  I("90","Bastão imóvel","Immovable rod"),I("91","Lanterna de revelação","Lantern of revealing"),I("92","Armadura do marinheiro","Mariner's armor"),I("93","Armadura de mitral","Mithral armor"),
  I("94","Poção de envenenamento","Potion of poison"),I("95","Anel de natação","Ring of swimming"),I("96","Robe dos itens úteis","Robe of useful items"),I("97","Corda de escalada","Rope of climbing"),
  I("98","Sela do cavaleiro","Saddle of the cavalier"),I("99","Varinha de detectar magia","Wand of magic detection"),I("00","Varinha de segredos","Wand of secrets")]),
 miC:mi("C",[I("01-15","Poção de cura superior","Potion of superior healing"),I("16-22",SC(4)),I("23-27","Munição +2","Ammunition, +2"),I("28-32","Poção de clarividência","Potion of clairvoyance"),
  I("33-37","Poção de encolher","Potion of diminution"),I("38-42","Poção de forma gasosa","Potion of gaseous form"),I("43-47","Poção de força do gigante do gelo","Potion of frost giant strength"),
  I("48-52","Poção de força do gigante de pedra","Potion of stone giant strength"),I("53-57","Poção de heroísmo","Potion of heroism"),I("58-62","Poção de invulnerabilidade","Potion of invulnerability"),
  I("63-67","Poção de ler mentes","Potion of mind reading"),I("68-72",SC(5)),I("73-75","Elixir de saúde","Elixir of health"),I("76-78","Óleo de forma etérea","Oil of etherealness"),
  I("79-81","Poção de força do gigante do fogo","Potion of fire giant strength"),I("82-84","Pena de Quaal","Quaal's feather token"),I("85-87","Pergaminho de proteção","Scroll of protection"),
  I("88-89","Saco de feijões","Bag of beans"),I("90-91","Contas de força","Bead of force"),I("92","Carrilhão de abertura","Chime of opening"),I("93","Decantador de água infinita","Decanter of endless water"),
  I("94","Olhos de visão minuciosa","Eyes of minute seeing"),I("95","Barco dobrável","Folding boat"),I("96","Sacola prestativa de Heward","Heward's handy haversack"),
  I("97","Ferraduras da velocidade","Horseshoes of speed"),I("98","Colar de bolas de fogo","Necklace of fireballs"),I("99","Periapto de saúde","Periapt of health"),I("00","Pedras de mensagem","Sending stones")]),
 miD:mi("D",[I("01-20","Poção de cura suprema","Potion of supreme healing"),I("21-30","Poção de invisibilidade","Potion of invisibility"),I("31-40","Poção de velocidade","Potion of speed"),
  I("41-50",SC(6)),I("51-57",SC(7)),I("58-62","Munição +3","Ammunition, +3"),I("63-67","Óleo de precisão","Oil of sharpness"),I("68-72","Poção de voo","Potion of flying"),
  I("73-77","Poção de força do gigante das nuvens","Potion of cloud giant strength"),I("78-82","Poção de longevidade","Potion of longevity"),I("83-87","Poção de vitalidade","Potion of vitality"),
  I("88-92",SC(8)),I("93-95","Ferraduras de zéfiro","Horseshoes of a zephyr"),I("96-98","Pigmentos maravilhosos de Nolzur","Nolzur's marvelous pigments"),I("99","Bolsa devoradora","Bag of devouring"),
  I("00","Buraco portátil","Portable hole")]),
 miE:mi("E",[I("01-30",SC(8)),I("31-55","Poção de força do gigante da tempestade","Potion of storm giant strength"),I("56-70","Poção de cura suprema","Potion of supreme healing"),
  I("71-85",SC(9)),I("86-93","Solvente universal","Universal solvent"),I("94-98","Flecha assassina","Arrow of slaying"),I("99-00","Cola soberana","Sovereign glue")]),
 miF:mi("F",[I("01-15","Arma +1","Weapon, +1"),I("16-18","Escudo +1","Shield, +1"),I("19-21","Escudo sentinela","Sentinel shield"),
  I("22-23","Amuleto de proteção contra detecção e localização","Amulet of proof against detection and location"),I("24-25","Botas élficas","Boots of elvenkind"),
  I("26-27","Botas de caminhar e saltar","Boots of striding and springing"),I("28-29","Braçadeiras de arquearia","Bracers of archery"),I("30-31","Broche do escudo","Brooch of shielding"),
  I("32-33","Vassoura voadora","Broom of flying"),I("34-35","Manto élfico","Cloak of elvenkind"),I("36-37","Manto de proteção","Cloak of protection"),I("38-39","Manoplas de força do ogro","Gauntlets of ogre power"),
  I("40-41","Chapéu de disfarce","Hat of disguise"),I("42-43","Azagaia de relâmpago","Javelin of lightning"),I("44-45","Pérola do poder","Pearl of power"),I("46-47","Bastão guardião de pactos +1","Rod of the pact keeper, +1"),
  I("48-49","Sandálias de patas de aranha","Slippers of spider climbing"),I("50-51","Cajado da víbora","Staff of the adder"),I("52-53","Cajado da píton","Staff of the python"),
  I("54-55","Espada da vingança","Sword of vengeance"),I("56-57","Tridente de comandar peixes","Trident of fish command"),I("58-59","Varinha de mísseis mágicos","Wand of magic missiles"),
  I("60-61","Varinha do arcano de guerra +1","Wand of the war mage, +1"),I("62-63","Varinha de teia","Wand of web"),I("64-65","Arma de alerta","Weapon of warning"),
  I("66","Armadura de adamante (cota de malha)","Adamantine armor (chain mail)"),I("67","Armadura de adamante (camisão de malha)","Adamantine armor (chain shirt)"),
  I("68","Armadura de adamante (brunea)","Adamantine armor (scale mail)"),I("69","Bolsa de truques (cinza)","Bag of tricks (gray)"),I("70","Bolsa de truques (ferrugem)","Bag of tricks (rust)"),
  I("71","Bolsa de truques (bronze)","Bag of tricks (tan)"),I("72","Botas do inverno","Boots of the winterlands"),I("73","Diadema da destruição","Circlet of blasting"),I("74","Baralho das ilusões","Deck of illusions"),
  I("75","Garrafa da fumaça eterna","Eversmoking bottle"),I("76","Olhos do encantamento","Eyes of charming"),I("77","Olhos de águia","Eyes of the eagle"),
  I("78","Estátua de poderes incríveis (corvo de prata)","Figurine of wondrous power (silver raven)"),I("79","Gema da luminosidade","Gem of brightness"),
  I("80","Luvas de apanhar projéteis","Gloves of missile snaring"),I("81","Luvas de nadar e escalar","Gloves of swimming and climbing"),I("82","Luvas do ladrão","Gloves of thievery"),
  I("83","Tiara do intelecto","Headband of intellect"),I("84","Elmo de telepatia","Helm of telepathy"),I("85","Instrumento dos bardos (alaúde de Doss)","Instrument of the bards (Doss lute)"),
  I("86","Instrumento dos bardos (bandolim de Fochlucan)","Instrument of the bards (Fochlucan bandore)"),I("87","Instrumento dos bardos (cítara de Mac-Fuirmidh)","Instrument of the bards (Mac-Fuirmidh cittern)"),
  I("88","Medalhão de pensamentos","Medallion of thoughts"),I("89","Colar de adaptação","Necklace of adaptation"),I("90","Periapto da cicatrização","Periapt of wound closure"),
  I("91","Flauta assombrada","Pipes of haunting"),I("92","Flauta dos esgotos","Pipes of the sewers"),I("93","Anel de saltar","Ring of jumping"),I("94","Anel de escudo mental","Ring of mind shielding"),
  I("95","Anel de calor","Ring of warmth"),I("96","Anel de andar na água","Ring of water walking"),I("97","Aljava de Ehlonna","Quiver of Ehlonna"),I("98","Pedra da boa sorte","Stone of good luck"),
  I("99","Leque do vento","Wind fan"),I("00","Botas aladas","Winged boots")]),
 miG:mi("G",[I("01-11","Arma +2","Weapon, +2"),
  S("12-14","Estátua de poderes incríveis","Figurine of wondrous power",[["1","Grifo de bronze","Bronze griffon"],["2","Mosca de ébano","Ebony fly"],["3","Leões dourados","Golden lions"],
   ["4","Bodes de marfim","Ivory goats"],["5","Elefante de mármore","Marble elephant"],["6-7","Cão de ônix","Onyx dog"],["8","Coruja de serpentina","Serpentine owl"]]),
  I("15","Armadura de adamante (peitoral)","Adamantine armor (breastplate)"),I("16","Armadura de adamante (cota de talas)","Adamantine armor (splint)"),I("17","Amuleto de saúde","Amulet of health"),
  I("18","Armadura de vulnerabilidade","Armor of vulnerability"),I("19","Escudo apanhador de flechas","Arrow-catching shield"),I("20","Cinto dos anões","Belt of dwarvenkind"),
  I("21","Cinturão de força do gigante da colina","Belt of hill giant strength"),I("22","Machado furioso","Berserker axe"),I("23","Botas de levitação","Boots of levitation"),
  I("24","Botas de velocidade","Boots of speed"),I("25","Bacia de comandar elementais da água","Bowl of commanding water elementals"),I("26","Braçadeiras de defesa","Bracers of defense"),
  I("27","Braseiro de comandar elementais do fogo","Brazier of commanding fire elementals"),I("28","Capa do saltimbanco","Cape of the mountebank"),
  I("29","Incensório de comandar elementais do ar","Censer of controlling air elementals"),I("30","Cota de malha +1","Armor, +1 chain mail"),I("31","Armadura de resistência (cota de malha)","Armor of resistance (chain mail)"),
  I("32","Camisão de malha +1","Armor, +1 chain shirt"),I("33","Armadura de resistência (camisão de malha)","Armor of resistance (chain shirt)"),I("34","Manto de deslocamento","Cloak of displacement"),
  I("35","Manto do morcego","Cloak of the bat"),I("36","Cubo de força","Cube of force"),I("37","Fortaleza instantânea de Daern","Daern's instant fortress"),I("38","Adaga de envenenamento","Dagger of venom"),
  I("39","Algemas dimensionais","Dimensional shackles"),I("40","Matadora de dragões","Dragon slayer"),I("41","Malha élfica","Elven chain"),I("42","Língua flamejante","Flame tongue"),
  I("43","Gema de visão","Gem of seeing"),I("44","Matador de gigantes","Giant slayer"),I("45","Couro batido encantador","Glamoured studded leather"),I("46","Elmo de teletransporte","Helm of teleportation"),
  I("47","Trombeta da destruição","Horn of blasting"),I("48","Trombeta do Valhalla (prata ou latão)","Horn of Valhalla (silver or brass)"),
  I("49","Instrumento dos bardos (bandolim de Canaith)","Instrument of the bards (Canaith mandolin)"),I("50","Instrumento dos bardos (lira de Cli)","Instrument of the bards (Cli lyre)"),
  I("51","Pedra iônica (prontidão)","Ioun stone (awareness)"),I("52","Pedra iônica (proteção)","Ioun stone (protection)"),I("53","Pedra iônica (armazenamento)","Ioun stone (reserve)"),
  I("54","Pedra iônica (sustento)","Ioun stone (sustenance)"),I("55","Faixas de ferro de Bilarro","Iron bands of Bilarro"),I("56","Armadura de couro +1","Armor, +1 leather"),
  I("57","Armadura de resistência (couro)","Armor of resistance (leather)"),I("58","Maça do rompimento","Mace of disruption"),I("59","Maça da destruição","Mace of smiting"),I("60","Maça do terror","Mace of terror"),
  I("61","Manto de resistência à magia","Mantle of spell resistance"),I("62","Colar de contas de oração","Necklace of prayer beads"),I("63","Periapto de proteção contra veneno","Periapt of proof against poison"),
  I("64","Anel de cativar animais","Ring of animal influence"),I("65","Anel de evasão","Ring of evasion"),I("66","Anel de queda suave","Ring of feather falling"),I("67","Anel de ação livre","Ring of free action"),
  I("68","Anel de proteção","Ring of protection"),I("69","Anel de resistência","Ring of resistance"),I("70","Anel de armazenar magia","Ring of spell storing"),I("71","Anel do aríete","Ring of the ram"),
  I("72","Anel de visão de raio-X","Ring of X-ray vision"),I("73","Robe dos olhos","Robe of eyes"),I("74","Bastão da obediência","Rod of rulership"),I("75","Bastão guardião de pactos +2","Rod of the pact keeper, +2"),
  I("76","Corda de estrangulamento","Rope of entanglement"),I("77","Brunea +1","Armor, +1 scale mail"),I("78","Armadura de resistência (brunea)","Armor of resistance (scale mail)"),I("79","Escudo +2","Shield, +2"),
  I("80","Escudo de atração de projéteis","Shield of missile attraction"),I("81","Cajado de enfeitiçar","Staff of charming"),I("82","Cajado de cura","Staff of healing"),
  I("83","Cajado de enxame de insetos","Staff of swarming insects"),I("84","Cajado das florestas","Staff of the woodlands"),I("85","Cajado do definhamento","Staff of withering"),
  I("86","Pedra de comandar elementais da terra","Stone of controlling earth elementals"),I("87","Lâmina do sol","Sun blade"),I("88","Espada do furto de vidas","Sword of life stealing"),
  I("89","Espada do sangramento","Sword of wounding"),I("90","Bastão do tentáculo","Tentacle rod"),I("91","Arma viciosa","Vicious weapon"),I("92","Varinha de obrigação","Wand of binding"),
  I("93","Varinha de detecção de inimigos","Wand of enemy detection"),I("94","Varinha de medo","Wand of fear"),I("95","Varinha de bolas de fogo","Wand of fireballs"),
  I("96","Varinha de relâmpagos","Wand of lightning bolts"),I("97","Varinha de paralisia","Wand of paralysis"),I("98","Varinha do arcano de guerra +2","Wand of the war mage, +2"),
  I("99","Varinha das maravilhas","Wand of wonder"),I("00","Asas voadoras","Wings of flying")]),
 miH:mi("H",[I("01-10","Arma +3","Weapon, +3"),I("11-12","Amuleto dos planos","Amulet of the planes"),I("13-14","Tapete voador","Carpet of flying"),
  I("15-16","Bola de cristal (versão muito rara)","Crystal ball (very rare version)"),I("17-18","Anel de regeneração","Ring of regeneration"),I("19-20","Anel de estrelas cadentes","Ring of shooting stars"),
  I("21-22","Anel de telecinésia","Ring of telekinesis"),I("23-24","Robe das cores cintilantes","Robe of scintillating colors"),I("25-26","Robe das estrelas","Robe of stars"),
  I("27-28","Bastão de absorção","Rod of absorption"),I("29-30","Bastão de prontidão","Rod of alertness"),I("31-32","Bastão de segurança","Rod of security"),
  I("33-34","Bastão guardião de pactos +3","Rod of the pact keeper, +3"),I("35-36","Cimitarra da velocidade","Scimitar of speed"),I("37-38","Escudo +3","Shield, +3"),
  I("39-40","Cajado do fogo","Staff of fire"),I("41-42","Cajado do gelo","Staff of frost"),I("43-44","Cajado do poder","Staff of power"),I("45-46","Cajado de ataque","Staff of striking"),
  I("47-48","Cajado de trovão e relâmpago","Staff of thunder and lightning"),I("49-50","Espada decepadora","Sword of sharpness"),I("51-52","Varinha de metamorfose","Wand of polymorph"),
  I("53-54","Varinha do arcano de guerra +3","Wand of the war mage, +3"),I("55","Armadura de adamante (meia-armadura)","Adamantine armor (half plate)"),
  I("56","Armadura de adamante (placas)","Adamantine armor (plate)"),I("57","Escudo animado","Animated shield"),I("58","Cinturão de força do gigante do fogo","Belt of fire giant strength"),
  I("59","Cinturão de força do gigante do gelo (ou de pedra)","Belt of frost (or stone) giant strength"),I("60","Peitoral +1","Armor, +1 breastplate"),
  I("61","Armadura de resistência (peitoral)","Armor of resistance (breastplate)"),I("62","Vela da invocação","Candle of invocation"),I("63","Cota de malha +2","Armor, +2 chain mail"),
  I("64","Camisão de malha +2","Armor, +2 chain shirt"),I("65","Manto da aranha","Cloak of arachnida"),I("66","Espada dançarina","Dancing sword"),I("67","Armadura demoníaca","Demon armor"),
  I("68","Brunea de escamas de dragão","Dragon scale mail"),I("69","Armadura anã","Dwarven plate"),I("70","Arremessador anão","Dwarven thrower"),I("71","Garrafa do efreeti","Efreeti bottle"),
  I("72","Estátua de poderes incríveis (corcel de obsidiana)","Figurine of wondrous power (obsidian steed)"),I("73","Marca congelante","Frost brand"),I("74","Elmo brilhante","Helm of brilliance"),
  I("75","Trombeta do Valhalla (bronze)","Horn of Valhalla (bronze)"),I("76","Instrumento dos bardos (harpa de Anstruth)","Instrument of the bards (Anstruth harp)"),
  I("77","Pedra iônica (absorção)","Ioun stone (absorption)"),I("78","Pedra iônica (agilidade)","Ioun stone (agility)"),I("79","Pedra iônica (fortitude)","Ioun stone (fortitude)"),
  I("80","Pedra iônica (intuição)","Ioun stone (insight)"),I("81","Pedra iônica (intelecto)","Ioun stone (intellect)"),I("82","Pedra iônica (liderança)","Ioun stone (leadership)"),
  I("83","Pedra iônica (força)","Ioun stone (strength)"),I("84","Armadura de couro +2","Armor, +2 leather"),I("85","Manual da saúde corporal","Manual of bodily health"),
  I("86","Manual do bom exercício","Manual of gainful exercise"),I("87","Manual dos golens","Manual of golems"),I("88","Manual da rapidez de movimentos","Manual of quickness of action"),
  I("89","Espelho do aprisionamento","Mirror of life trapping"),I("90","Ladra das nove vidas","Nine lives stealer"),I("91","Arco do juramento","Oathbow"),I("92","Brunea +2","Armor, +2 scale mail"),
  I("93","Escudo de proteção contra magia","Spellguard shield"),I("94","Cota de talas +1","Armor, +1 splint"),I("95","Armadura de resistência (cota de talas)","Armor of resistance (splint)"),
  I("96","Armadura de couro batido +1","Armor, +1 studded leather"),I("97","Armadura de resistência (couro batido)","Armor of resistance (studded leather)"),
  I("98","Tomo dos grandes pensamentos","Tome of clear thought"),I("99","Tomo de liderança e influência","Tome of leadership and influence"),I("00","Tomo da compreensão","Tome of understanding")]),
 miI:mi("I",[I("01-05","Defensora","Defender"),I("06-10","Martelo dos trovões","Hammer of thunderbolts"),I("11-15","Lâmina da sorte","Luck blade"),I("16-20","Espada de retaliação","Sword of answering"),
  I("21-23","Vingadora sagrada","Holy avenger"),I("24-26","Anel de invocação de djinni","Ring of djinni summoning"),I("27-29","Anel de invisibilidade","Ring of invisibility"),
  I("30-32","Anel de refletir magias","Ring of spell turning"),I("33-35","Bastão do grande poder","Rod of lordly might"),I("36-38","Cajado do arcano","Staff of the magi"),
  I("39-41","Espada vorpal","Vorpal sword"),I("42-43","Cinturão de força do gigante das nuvens","Belt of cloud giant strength"),I("44-45","Peitoral +2","Armor, +2 breastplate"),
  I("46-47","Cota de malha +3","Armor, +3 chain mail"),I("48-49","Camisão de malha +3","Armor, +3 chain shirt"),I("50-51","Manto de invisibilidade","Cloak of invisibility"),
  I("52-53","Bola de cristal (versão lendária)","Crystal ball (legendary version)"),I("54-55","Meia-armadura +1","Armor, +1 half plate"),I("56-57","Frasco de ferro","Iron flask"),
  I("58-59","Armadura de couro +3","Armor, +3 leather"),I("60-61","Armadura de placas +1","Armor, +1 plate"),I("62-63","Robe do arquimago","Robe of the archmagi"),
  I("64-65","Bastão de ressurreição","Rod of resurrection"),I("66-67","Brunea +1","Armor, +1 scale mail"),I("68-69","Escaravelho da proteção","Scarab of protection"),
  I("70-71","Cota de talas +2","Armor, +2 splint"),I("72-73","Armadura de couro batido +2","Armor, +2 studded leather"),I("74-75","Poço dos muitos mundos","Well of many worlds"),
  S("76","Armadura mágica","Magic armor",[["1-2","Meia-armadura +2","Armor, +2 half plate"],["3-4","Armadura de placas +2","Armor, +2 plate"],["5-6","Armadura de couro batido +3","Armor, +3 studded leather"],
   ["7-8","Peitoral +3","Armor, +3 breastplate"],["9-10","Cota de talas +3","Armor, +3 splint"],["11","Meia-armadura +3","Armor, +3 half plate"],["12","Armadura de placas +3","Armor, +3 plate"]]),
  I("77","Dispositivo de Kwalish","Apparatus of Kwalish"),I("78","Armadura de invulnerabilidade","Armor of invulnerability"),I("79","Cinturão de força do gigante da tempestade","Belt of storm giant strength"),
  I("80","Cubo do portal","Cubic gate"),I("81","Baralho das surpresas","Deck of many things"),I("82","Malha do efreeti","Efreeti chain"),I("83","Armadura de resistência (meia-armadura)","Armor of resistance (half plate)"),
  I("84","Trombeta do Valhalla (ferro)","Horn of Valhalla (iron)"),I("85","Instrumento dos bardos (harpa de Ollamh)","Instrument of the bards (Ollamh harp)"),
  I("86","Pedra iônica (absorção maior)","Ioun stone (greater absorption)"),I("87","Pedra iônica (maestria)","Ioun stone (mastery)"),I("88","Pedra iônica (regeneração)","Ioun stone (regeneration)"),
  I("89","Armadura de placas da forma etérea","Plate armor of etherealness"),I("90","Armadura de placas da resistência","Plate armor of resistance"),
  I("91","Anel de comandar elementais do ar","Ring of air elemental command"),I("92","Anel de comandar elementais da terra","Ring of earth elemental command"),
  I("93","Anel de comandar elementais do fogo","Ring of fire elemental command"),I("94","Anel dos três desejos","Ring of three wishes"),I("95","Anel de comandar elementais da água","Ring of water elemental command"),
  I("96","Esfera da aniquilação","Sphere of annihilation"),I("97","Talismã da bondade pura","Talisman of pure good"),I("98","Talismã da esfera","Talisman of the sphere"),
  I("99","Talismã do mal absoluto","Talisman of ultimate evil"),I("00","Tomo da língua quieta","Tome of the stilled tongue")]),
});

// Coins: "4d6×100" expressions; the book shows the average next to each.
const COINS = [{pt:"PC",en:"CP"},{pt:"PP",en:"SP"},{pt:"PE",en:"EP"},{pt:"PO",en:"GP"},{pt:"PL",en:"PP"}];
const fmt = n => n.toLocaleString(S0.lang === "pt" ? "pt-BR" : "en");
const avgOf = e => { const [b,m] = e.split("×"), [n,d] = b.split("d").map(Number); return Math.floor(n*(d+1)/2 * (+m||1)); };
const rollOf = (e, rng=rnd) => { const [b,m] = e.split("×"); return rollExpr(b, rng).total * (+m||1); };
const coinCell = e => e === "–" ? "–" : {pt:`${e.replace("×"," × ")} (${avgOf(e).toLocaleString("pt-BR")})`, en:`${e.replace("×"," × ")} (${avgOf(e).toLocaleString("en")})`};
const indiv = (cr, rows) => ({id:"ind"+cr.replace(/\W/g,""), die:"d100", title:{pt:`Tesouro Individual: Desafio ${cr}`,en:`Individual Treasure: Challenge ${cr}`},
  cols:["d100", ...COINS], coins:Object.fromEntries(rows.map(r => [r[0], r.slice(1)])), rows:rows.map(([r,...c]) => [r, ...c.map(coinCell)])});
Object.assign(TREASURE, {
 ind04:indiv("0–4",[["01-30","5d6","–","–","–","–"],["31-60","–","4d6","–","–","–"],["61-70","–","–","3d6","–","–"],["71-95","–","–","–","3d6","–"],["96-00","–","–","–","–","1d6"]]),
 ind510:indiv("5–10",[["01-30","4d6×100","–","1d6×10","–","–"],["31-60","–","6d6×10","–","2d6×10","–"],["61-70","–","–","3d6×10","2d6×10","–"],["71-95","–","–","–","4d6×10","–"],["96-00","–","–","–","2d6×10","3d6"]]),
 ind1116:indiv("11–16",[["01-20","–","4d6×100","–","1d6×100","–"],["21-35","–","–","1d6×100","1d6×100","–"],["36-75","–","–","–","2d6×100","1d6×10"],["76-00","–","–","–","2d6×100","2d6×10"]]),
 ind17:indiv("17+",[["01-15","–","–","2d6×1000","8d6×100","–"],["16-55","–","–","–","1d6×1000","1d6×100"],["56-00","–","–","–","1d6×1000","2d6×100"]]),
});
// Hoards: rows [range, gems/art spec, magic spec]. "2d6:gem10", "1d4:A+1d6:B", "1:G".
function hoard(cr, coins, rows){
  const loot = s => { if(!s) return "–"; const [n,id] = s.split(":"), t = TREASURE[id];
    const what = id.startsWith("gem") ? {pt:`gemas de ${t.value.toLocaleString("pt-BR")} po`, en:`${t.value.toLocaleString("en")} gp gems`}
      : {pt:`objetos de arte de ${t.value.toLocaleString("pt-BR")} po`, en:`${t.value.toLocaleString("en")} gp art objects`};
    return {pt:`${n} (${avgOf(n)}) ${what.pt}`, en:`${n} (${avgOf(n)}) ${what.en}`}; };
  const magic = s => { if(!s) return "–"; const parts = s.split("+").map(p => p.split(":"));
    return {pt:"Role " + parts.map(([n,t]) => `${n === "1" ? "uma vez" : n + " vezes"} na Tabela de Item Mágico ${t}`).join(" e ") + ".",
            en:"Roll " + parts.map(([n,t]) => `${n === "1" ? "once" : n + " times"} on Magic Item Table ${t}`).join(" and ") + "."}; };
  const coinTxt = l => COINS.map((c,i) => `${c[l]} ${coins[i] === "–" ? "–" : coinCell(coins[i])[l]}`).join(" · ");
  return {id:"hoard"+cr.replace(/\W/g,""), die:"d100", title:{pt:`Pilha de Tesouro: Desafio ${cr}`,en:`Treasure Hoard: Challenge ${cr}`},
    cols:["d100",{pt:"Gemas ou Objetos de Arte",en:"Gems or Art Objects"},{pt:"Itens Mágicos",en:"Magic Items"}],
    note:{pt:`<b>Moedas:</b> ${coinTxt("pt")}`, en:`<b>Coins:</b> ${coinTxt("en")}`}, coinList:coins,
    spec:Object.fromEntries(rows.map(([r,g,m]) => [r,{g,m}])), rows:rows.map(([r,g,m]) => [r, loot(g), magic(m)])};
}
const H04 = [["01-06"],["07-16","2d6:gem10"],["17-26","2d4:art25"],["27-36","2d6:gem50"],["37-44","2d6:gem10","1d6:A"],["45-52","2d4:art25","1d6:A"],["53-60","2d6:gem50","1d6:A"],
 ["61-65","2d6:gem10","1d4:B"],["66-70","2d4:art25","1d4:B"],["71-75","2d6:gem50","1d4:B"],["76-78","2d6:gem10","1d4:C"],["79-80","2d4:art25","1d4:C"],["81-85","2d6:gem50","1d4:C"],
 ["86-92","2d4:art25","1d4:F"],["93-97","2d6:gem50","1d4:F"],["98-99","2d4:art25","1:G"],["00","2d6:gem50","1:G"]];
const H510 = [["01-04"],["05-10","2d4:art25"],["11-16","3d6:gem50"],["17-22","3d6:gem100"],["23-28","2d4:art250"],["29-32","2d4:art25","1d6:A"],["33-36","3d6:gem50","1d6:A"],
 ["37-40","3d6:gem100","1d6:A"],["41-44","2d4:art250","1d6:A"],["45-49","2d4:art25","1d4:B"],["50-54","3d6:gem50","1d4:B"],["55-59","3d6:gem100","1d4:B"],["60-63","2d4:art250","1d4:B"],
 ["64-66","2d4:art25","1d4:C"],["67-69","3d6:gem50","1d4:C"],["70-72","3d6:gem100","1d4:C"],["73-74","2d4:art250","1d4:C"],["75-76","2d4:art25","1:D"],["77-78","3d6:gem50","1:D"],
 ["79","3d6:gem100","1:D"],["80","2d4:art250","1:D"],["81-84","2d4:art25","1d4:F"],["85-88","3d6:gem50","1d4:F"],["89-91","3d6:gem100","1d4:F"],["92-94","2d4:art250","1d4:F"],
 ["95-96","3d6:gem100","1d4:G"],["97-98","2d4:art250","1d4:G"],["99","3d6:gem100","1:H"],["00","2d4:art250","1:H"]];
// Rows in CR 11–16 and 17+ cycle through the same four gem/art kinds with one magic spec per block.
const cycle = (ranges, kinds, m) => ranges.map((r,i) => [r, kinds[i], m]);
const K1116 = ["2d4:art250","2d4:art750","3d6:gem500","3d6:gem1000"], K17 = ["3d6:gem1000","1d10:art2500","1d4:art7500","1d8:gem5000"];
const H1116rows = [["01-03"],["04-06","2d4:art250"],["07-09","2d4:art750"],["10-12","3d6:gem500"],["13-15","3d6:gem1000"],
 ...cycle(["16-19","20-23","24-26","27-29"],K1116,"1d4:A+1d6:B"), ...cycle(["30-35","36-40","41-45","46-50"],K1116,"1d6:C"),
 ...cycle(["51-54","55-58","59-62","63-66"],K1116,"1d4:D"), ...cycle(["67-68","69-70","71-72","73-74"],K1116,"1:E"),
 ...cycle(["75-76","77-78","79-80","81-82"],K1116,"1d4:F+1d4:G"), ...cycle(["83-85","86-88","89-90","91-92"],K1116,"1d4:H"),
 ...cycle(["93-94","95-96","97-98","99-00"],K1116,"1:I")];
const H17rows = [["01-02"], ...cycle(["03-05","06-08","09-11","12-14"],K17,"1d8:C"), ...cycle(["15-22","23-30","31-38","39-46"],K17,"1d6:D"),
 ...cycle(["47-52","53-58","59-63","64-68"],K17,"1d6:E"), ...cycle(["69","70","71","72"],K17,"1d4:G"),
 ...cycle(["73-74","75-76","77-78","79-80"],K17,"1d4:H"), ...cycle(["81-85","86-90","91-95","96-00"],K17,"1d4:I")];
Object.assign(TREASURE, {
 hoard04:hoard("0–4",["6d6×100","3d6×100","–","2d6×10","–"],H04),
 hoard510:hoard("5–10",["2d6×100","2d6×1000","–","6d6×100","3d6×10"],H510),
 hoard1116:hoard("11–16",["–","–","–","4d6×1000","5d6×100"],H1116rows),
 hoard17:hoard("17+",["–","–","–","12d6×1000","8d6×1000"],H17rows),
});
const CRS = [["04","0–4"],["510","5–10"],["1116","11–16"],["17","17+"]];

// Treasure: rolls the individual or hoard table for a challenge band ("04","510","1116","17")
// and resolves coins, gems/art and magic items. Returns data; pages format it.
function treasure(cr, kind, opts={}){
  const rng = opts.rng || rnd;
  const t = TREASURE[(kind === "hoard" ? "hoard" : "ind") + cr], r = resolveRoll(t, opts), row = r.picks[0];
  const coinsE = kind === "hoard" ? t.coinList : t.coins[row[0]];
  const res = {table:t, kind, val:r.val, coins:coinsE.map((e,i) => e === "–" ? null : [rollOf(e, rng), i]).filter(Boolean), loot:[]};
  if(kind !== "hoard") return res;
  const {g, m} = t.spec[row[0]];
  if(g){ const [n,id] = g.split(":"), gt = TREASURE[id], count = rollExpr(n, rng).total, tally = {};
    for(let k = 0; k < count; k++){ const name = L(resolveRoll(gt, opts).picks[0][1]); tally[name] = (tally[name]||0) + 1; }
    res.loot.push({table:gt, expr:n, count, value:count * gt.value, tally}); }
  if(m) for(const [n,letter] of m.split("+").map(p => p.split(":"))){
    const mt = TREASURE["mi"+letter], count = n === "1" ? 1 : rollExpr(n, rng).total, tally = {};
    for(let k = 0; k < count; k++){ const txt = plain(resolveRoll(mt, opts).text); tally[txt] = (tally[txt]||0) + 1; }
    res.loot.push({table:mt, expr:n === "1" ? null : n, count, tally}); }
  return res;
}
const tallyText = tally => Object.entries(tally).map(([k,v]) => (v > 1 ? v + "× " : "") + k).join("; ");
// Plain-text lines for a treasure result (room keys, notes).
function treasureLines(res){
  const out = [L({pt:"Moedas",en:"Coins"}) + ": " + (res.coins.map(([n,i]) => `${fmt(n)} ${L(COINS[i])}`).join(" · ") || "–")];
  for(const l of res.loot) out.push(`${l.count}× ${L(l.table.title)}${l.value ? ` (${fmt(l.value)} ${L(COINS[3])})` : ""}: ${tallyText(l.tally)}`);
  return out;
}

// ── Dungeon encounters ──
const T = (id, die, pt, en, colPt, colEn, rows, extra={}) => ({id, die, title:{pt,en}, cols:[die,{pt:colPt,en:colEn}], rows, ...extra});
// What each chamber row brings: m monster (+motivation), h hazard, o obstacle, a trap, q trick, t treasure ("hoard"/"ind").
const CH_SPEC = {"01-08":{m:1},"09-15":{m:1,t:"hoard"},"16-27":{m:1},"28-33":{m:1,t:"ind"},"34-42":{m:1},"43-50":{m:1,t:"ind"},
  "51-58":{h:1,t:"ind"},"59-63":{o:1},"64-73":{a:1,t:"hoard"},"74-76":{a:1},"77-80":{q:1},"81-88":{},"89-94":{h:1},"95-00":{t:"hoard"}};
const CH_LINKS = {m:"motivation", h:"hazard", o:"obstacle", a:["trapTrigger","trapSeverity","trapEffect"], q:["trickObject","trickEffect"]};
const DENC = {
 chamber:T("chamber","d100","Conteúdo da Câmara da Masmorra","Dungeon Chamber Contents","Conteúdo","Contents", R([
  ["01-08","Monstro (habitante dominante)","Monster (dominant inhabitant)"],["09-15","Monstro (habitante dominante) com tesouro","Monster (dominant inhabitant) with treasure"],
  ["16-27","Monstro (animal de estimação ou criatura aliada)","Monster (pet or allied creature)"],
  ["28-33","Monstro (animal de estimação ou criatura aliada) guardando tesouro","Monster (pet or allied creature) guarding treasure"],
  ["34-42","Monstro (criatura aleatória)","Monster (random creature)"],["43-50","Monstro (criatura aleatória) com tesouro","Monster (random creature) with treasure"],
  ["51-58","Perigo de masmorra com tesouro casual","Dungeon hazard with incidental treasure"],["59-63","Obstáculo","Obstacle"],
  ["64-73","Armadilha protegendo tesouro","Trap guarding treasure"],["74-76","Armadilha","Trap"],["77-80","Arapuca","Trick"],["81-88","Sala vazia","Empty room"],
  ["89-94","Sala vazia com perigo de masmorra","Empty room with dungeon hazard"],["95-00","Sala vazia com tesouro","Empty room with treasure"]]),
  {spec:CH_SPEC, link:Object.fromEntries(Object.entries(CH_SPEC).map(([r,s]) => [r, Object.keys(s).filter(k => CH_LINKS[k]).flatMap(k => [].concat(CH_LINKS[k]))]))}),
 motivation:T("motivation","d20","Motivação do Monstro","Monster Motivation","Objetivo","Goal", R([
  ["1-2","Encontrar um santuário","Find a sanctuary"],["3-5","Conquistar a masmorra","Conquer the dungeon"],["6-8","Buscar um item na masmorra","Seek an item within the dungeon"],
  ["9-11","Matar um rival","Slay a rival"],["12-13","Esconder-se de inimigos","Hide from enemies"],["14-15","Recuperar-se de batalha","Recover from a battle"],
  ["16-17","Evitar perigo","Avoid danger"],["18-20","Buscar riqueza","Seek wealth"]])),
 hazard:T("hazard","d20","Perigos na Masmorra","Dungeon Hazards","Perigo","Hazard", R([
  ["1-3","Bolor marrom","Brown mold"],["4-8","Limo verde","Green slime"],["9-10","Guinchador","Shrieker"],["11-15","Teias de aranha","Spiderwebs"],
  ["16-17","Fungo violeta","Violet fungus"],["18-20","Bolor amarelo","Yellow mold"]])),
 obstacle:T("obstacle","d20","Obstáculos","Obstacles","Obstáculo","Obstacle", R([
  ["1","Aura antivida com raio de 1d10 × 3 m; enquanto estiverem na aura, criaturas vivas não podem recuperar pontos de vida","Antilife aura with a radius of 1d10 × 10 ft; while in the aura, living creatures can't regain hit points"],
  ["2","Ventos fortes reduzem o deslocamento à metade e impõem desvantagem nas jogadas de ataque à distância","Battering winds reduce speed by half and impose disadvantage on ranged attack rolls"],
  ["3","<i>Barreira de lâminas</i> bloqueia a passagem","<i>Blade barrier</i> blocks passage"],["4-8","Desmoronamento","Cave-in"],
  ["9-12","Abismo de 1d4 × 3 m de largura e 2d6 × 3 m de profundidade, possivelmente conectado a outros níveis da masmorra","Chasm 1d4 × 10 ft wide and 2d6 × 10 ft deep, possibly connected to other levels of the dungeon"],
  ["13-14","Inundação deixa 2d10 × 30 cm de água na área; crie passagens inclinadas para cima, chão elevado ou escadas subindo próximas para conter a água","Flooding leaves 2d10 ft of water in the area; create nearby upward-sloping passages, raised floors, or rising stairs to contain the water"],
  ["15","Rio de lava pela área (50% de chance de ter uma ponte de pedra atravessando)","Lava flows through the area (50% chance of a stone bridge crossing it)"],
  ["16","Cogumelos gigantes bloqueiam o caminho e devem ser derrubados (25% de chance de um bolor ou fungo perigoso escondido entre eles)","Overgrown mushrooms block progress and must be hacked down (25% chance of a mold or fungus hazard hidden among them)"],
  ["17","Gás venenoso (1d6 de dano de veneno por minuto de exposição)","Poisonous gas (1d6 poison damage per minute of exposure)"],
  ["18","Efeito de <i>inverter gravidade</i> faz criaturas caírem para o teto","<i>Reverse gravity</i> effect makes creatures fall toward the ceiling"],
  ["19","<i>Muralha de fogo</i> bloqueia a passagem","<i>Wall of fire</i> blocks passage"],["20","<i>Muralha de energia</i> bloqueia a passagem","<i>Wall of force</i> blocks passage"]])),
 trapTrigger:T("trapTrigger","d6","Gatilho da Armadilha","Trap Trigger","Gatilho","Trigger", R(list(
  ["Pisar em cima (chão, escadas)","Passar por (entrada, corredor)","Tocar (maçaneta, estátua)","Abrir (porta, baú de tesouro)","Olhar para (mural, símbolo arcano)","Mover (carrinho, bloco de pedra)"],
  ["Stepped on (floor, stairs)","Moved through (doorway, hallway)","Touched (doorknob, statue)","Opened (door, treasure chest)","Looked at (mural, arcane symbol)","Moved (cart, stone block)"]))),
 trapSeverity:T("trapSeverity","d6","Gravidade do Dano da Armadilha","Trap Damage Severity","Gravidade","Severity", R([
  ["1-2","Inconveniente","Setback"],["3-5","Perigoso","Dangerous"],["6","Mortal","Deadly"]])),
 trapEffect:T("trapEffect","d100","Efeitos da Armadilha","Trap Effects","Efeito","Effect", R([
  ["01-04","Mísseis mágicos disparados de estátua ou objeto","Magic missiles shoot from a statue or object"],
  ["05-07","Escadaria desmorona e vira uma rampa que joga os personagens num fosso na parte de baixo","Collapsing staircase becomes a ramp that drops characters into a pit at its lower end"],
  ["08-10","Blocos caem do teto, ou o teto inteiro desmorona","Ceiling block falls, or the entire ceiling collapses"],["11-12","O teto desce lentamente em uma sala trancada","Ceiling lowers slowly in a locked room"],
  ["13-14","Rampa se abre no chão","Chute opens in the floor"],["15-16","Barulho ressonante atrai monstros próximos","Clanging noise attracts nearby monsters"],
  ["17-19","Tocar um objeto ativa uma magia <i>desintegrar</i>","Touching an object triggers a <i>disintegrate</i> spell"],
  ["20-23","Porta ou outro objeto está coberto com veneno de contato","Door or other object is coated with contact poison"],["24-27","Fogo é disparado de parede, chão ou objeto","Fire shoots out from a wall, floor, or object"],
  ["28-30","Tocar um objeto ativa uma magia <i>carne para pedra</i>","Touching an object triggers a <i>flesh to stone</i> spell"],["31-33","Chão desmorona ou é uma ilusão","Floor collapses or is an illusion"],
  ["34-36","Abertura libera gás: cegante, ácido, obscurecente, paralisante, venenoso ou adormecente","Vent releases gas: blinding, acidic, obscuring, paralyzing, poisonous, or sleep-inducing"],
  ["37-39","Ladrilhos do chão estão eletrificados","Floor tiles are electrified"],["40-43","<i>Glifo de vigilância</i>","<i>Glyph of warding</i>"],
  ["44-46","Estátua enorme sobre rodas desce pelo corredor","Huge wheeled statue rolls down a corridor"],["47-49","<i>Relâmpago</i> é disparado de parede ou objeto","<i>Lightning bolt</i> shoots from a wall or object"],
  ["50-52","Sala trancada inunda-se de água ou ácido","Locked room floods with water or acid"],["53-56","Dardos são disparados de um baú aberto","Darts shoot out of an opened chest"],
  ["57-59","Uma arma, armadura ou tapete se anima e ataca quando tocado (veja \"Objetos Animados\" no <i>Manual dos Monstros</i>)","A weapon, suit of armor, or rug animates and attacks when touched (see \"Animated Objects\" in the <i>Monster Manual</i>)"],
  ["60-62","Pêndulo, com lâmina ou pesado como uma marreta, balança pela sala ou corredor","Pendulum, bladed or weighted like a maul, swings across the room or hall"],
  ["63-67","Fosso escondido se abre sob os personagens (25% de chance de um pudim negro ou cubo gelatinoso no fundo)","Hidden pit opens beneath the characters (25% chance a black pudding or gelatinous cube fills the bottom)"],
  ["68-70","Fosso escondido inunda com ácido ou fogo","Hidden pit floods with acid or fire"],["71-73","Fosso que se tranca inunda com água","Locking pit floods with water"],
  ["74-77","Lâmina ceifadora surge de parede ou objeto","Scything blade emerges from a wall or object"],["78-81","Lanças (possivelmente envenenadas) se projetam","Spears (possibly poisoned) spring out"],
  ["82-84","Escadas frágeis desmoronam sobre estacas","Brittle stairs collapse over spikes"],["85-88","<i>Onda trovejante</i> derruba personagens num fosso ou em estacas","<i>Thunderwave</i> knocks characters into a pit or spikes"],
  ["89-91","Mandíbulas de aço ou pedra prendem um personagem","Steel or stone jaws restrain a character"],["92-94","Bloco de pedra atravessa um corredor","Stone block smashes across a hallway"],
  ["95-97","<i>Símbolo</i>","<i>Symbol</i>"],["98-00","Paredes deslizam uma contra a outra","Walls slide together"]])),
 trickObject:T("trickObject","d20","Objetos com Arapuca","Trick Objects","Objeto","Object", R(list(
  ["Livro","Cérebro preservado em jarro","Fogo crepitante","Gema rachada","Porta","Afresco","Mobília","Escultura de vidro","Campo de cogumelos","Pintura",
   "Planta ou árvore","Poça de água","Runas gravadas em parede ou piso","Crânio","Esfera de energia mágica","Estátua","Obelisco de pedra","Armadura","Tapeçaria ou carpete","Boneco de tiro"],
  ["Book","Brain preserved in a jar","Burning fire","Cracked gem","Door","Fresco","Furniture","Glass sculpture","Mushroom field","Painting",
   "Plant or tree","Pool of water","Runes engraved on a wall or floor","Skull","Sphere of magical energy","Statue","Stone obelisk","Suit of armor","Tapestry or rug","Target dummy"]))),
 trickEffect:T("trickEffect","d100","Arapuca","Trick","Efeito da Arapuca","Trick Effect", R([
  ["01-03","Envelhece a primeira pessoa que tocar o objeto","Ages the first person to touch the object"],["04-06","O objeto tocado se anima, ou anima outros objetos próximos","The touched object animates, or animates other objects nearby"],
  ["07-10","Faz três perguntas de teste de perícia (se as três forem respondidas corretamente, uma recompensa aparece)","Asks three skill-testing questions (if all three are answered correctly, a reward appears)"],
  ["11-13","Impõe resistência ou vulnerabilidade","Bestows resistance or vulnerability"],
  ["14-16","Muda a tendência, personalidade, tamanho, aparência ou sexo de quem o tocar","Changes the alignment, personality, size, appearance, or sex of whoever touches it"],
  ["17-19","Transforma uma substância em outra, como ouro em chumbo ou metal em cristal frágil","Changes one substance to another, such as gold to lead or metal to brittle crystal"],
  ["20-22","Cria um campo de força","Creates a force field"],["23-26","Cria uma ilusão","Creates an illusion"],["27-29","Suprime itens mágicos por um tempo","Suppresses magic items for a time"],
  ["30-32","Aumenta ou reduz os personagens","Enlarges or reduces characters"],["33-35","<i>Boca encantada</i> fala uma charada","<i>Magic mouth</i> speaks a riddle"],
  ["36-38","<i>Confusão</i> (afeta todas as criaturas a até 3 m)","<i>Confusion</i> (targets all creatures within 10 ft)"],["39-41","Dá instruções (verdadeiras ou falsas)","Gives directions (true or false)"],
  ["42-44","Concede um desejo","Grants a wish"],["45-47","Voa para evitar ser tocado","Flies about to avoid being touched"],["48-50","Conjura <i>missão</i> nos personagens","Casts <i>geas</i> on the characters"],
  ["51-53","Aumenta, reduz, anula ou inverte a gravidade","Increases, reduces, negates, or reverses gravity"],["54-56","Induz a ganância","Induces greed"],
  ["57-59","Mantém uma criatura aprisionada","Contains an imprisoned creature"],["60-62","Tranca ou destranca saídas","Locks or unlocks exits"],
  ["63-65","Oferece um jogo de azar, com a promessa de uma recompensa ou informação valiosa","Offers a game of chance, with the promise of a reward or valuable information"],
  ["66-68","Ajuda ou prejudica certos tipos de criaturas","Helps or harms certain types of creatures"],["69-71","Conjura <i>metamorfose</i> nos personagens (dura 1 hora)","Casts <i>polymorph</i> on the characters (lasts 1 hour)"],
  ["72-75","Apresenta um enigma ou charada","Presents a puzzle or riddle"],["76-78","Impede o movimento","Prevents movement"],
  ["79-81","Libera moedas, moedas falsas, gemas, gemas falsas, um item mágico ou um mapa","Releases coins, false coins, gems, false gems, a magic item, or a map"],
  ["82-84","Liberta, invoca ou se transforma em um monstro","Releases, summons, or turns into a monster"],["85-87","Conjura <i>sugestão</i> nos personagens","Casts <i>suggestion</i> on the characters"],
  ["88-90","Grita alto quando tocado","Wails loudly when touched"],["91-93","Fala (normalmente, sem sentido, em poesia e rimas, cantando, conjurando ou gritando)","Talks (normal speech, nonsense, poetry and rhymes, singing, spellcasting, or screaming)"],
  ["94-97","Teletransporta os personagens para outro lugar","Teleports the characters to another place"],["98-00","Troca a mente de dois ou mais personagens","Swaps two or more characters' minds"]])),
};
// Map markers per kind of content (MonTT Maker draws these in GM view only).
const CHAMBER_CODES = {m:"M", h:"P", o:"O", a:"A", q:"?", t:"$"};

// A chamber's contents: the chamber roll plus its follow-up rolls and treasure for a challenge band.
function chamber(cr, opts={}){
  const r = resolveRoll(DENC.chamber, {...opts, links:false}), row = r.picks[0], sp = CH_SPEC[row[0]];
  const lines = [], codes = [];
  const add = (label, id) => { const x = resolveRoll(DENC[id], {...opts, links:false}); lines.push({label:L(label), text:plain(x.text)}); };
  if(sp.m){ codes.push("M"); add({pt:"Motivação",en:"Motivation"}, "motivation"); }
  if(sp.h){ codes.push("P"); add({pt:"Perigo",en:"Hazard"}, "hazard"); }
  if(sp.o){ codes.push("O"); add({pt:"Obstáculo",en:"Obstacle"}, "obstacle"); }
  if(sp.a){ codes.push("A"); add({pt:"Gatilho",en:"Trigger"}, "trapTrigger"); add({pt:"Gravidade",en:"Severity"}, "trapSeverity"); add({pt:"Efeito",en:"Effect"}, "trapEffect"); }
  if(sp.q){ codes.push("?"); add({pt:"Objeto",en:"Object"}, "trickObject"); add({pt:"Arapuca",en:"Trick"}, "trickEffect"); }
  let loot = null;
  if(sp.t){ codes.push("$"); loot = treasure(cr, sp.t, opts);
    lines.push({label:L(sp.t === "hoard" ? {pt:"Tesouro (pilha)",en:"Treasure (hoard)"} : {pt:"Tesouro (individual)",en:"Treasure (individual)"}), text:treasureLines(loot).join(" / ")}); }
  return {val:r.val, content:L(row[1]), lines, codes, treasure:loot};
}

Object.assign(TABLES, TREASURE, DENC);
return {
  get lang(){ return S0.lang; }, set lang(v){ S0.lang = v; },
  L, esc, rnd, range, rollExpr, R, S, list, subOf, subDie, plain, TABLES, LINK_FN, resolveRoll,
  TREASURE, COINS, CRS, avgOf, rollOf, fmt, treasure, treasureLines, tallyText, DENC, CHAMBER_CODES, chamber,
};
})();
