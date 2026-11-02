// Random encounter tables by environment and level band (Portuguese only; English falls back to it).
// Format per table: "range|text" lines. Loaded by dmscreen.html (Light Screen) as WILD_ENC.
const WILD_ENC = (() => {
const parse = s => s.trim().split("\n").map(l => { const i = l.indexOf("|"); return [l.slice(0,i).trim(), {pt:l.slice(i+1).trim()}]; });
const ENVS = [
 ["arctic","Árticos","Arctic"], ["coast","Costeiros","Coastal"], ["desert","Desérticos","Desert"], ["forest","Florestais","Forest"],
 ["grass","Planícies","Grassland"], ["hill","Colinas","Hill"], ["mountain","Montanhas","Mountain"], ["swamp","Pântanos","Swamp"], ["under","Subterrâneos","Underdark"],
 ["water","Subaquáticos","Underwater"], ["urban","Urbanos","Urban"],
];
const T = {};
const add = (env, band, text) => {
  const e = ENVS.find(x => x[0] === env), id = `enc_${env}_${band.replace(/\W/g,"")}`;
  T[id] = {id, env, band, die:"d100", title:{pt:`Encontros ${e[1]} (Níveis ${band})`, en:`${e[2]} Encounters (Levels ${band})`},
    cols:["d100",{pt:"Encontro",en:"Encounter"}], rows:parse(text)};
};

add("arctic","1–4",`
01|1 coruja gigante
02-05|1d6 + 3 kobolds
06-08|1d4 + 3 armadilheiros (plebeus)
09-10|1 coruja
11-12|2d4 falcões de sangue
13-17|1d6 bandidos
18-20|1d3 kobolds alados com 1d6 kobolds
21-25|Uma carcaça de mamute parcialmente comida, da qual dá para aproveitar 1d4 semanas de ração
26-29|2d8 caçadores (guerreiros tribais)
30-35|1 meio-ogro
36-40|Pegadas em fila única na neve que acabam abruptamente
41-45|1d3 mephits do gelo
46-50|1 urso marrom
51-53|1d6 + 1 orcs
54-55|1 urso polar
56-57|1d6 batedores
58-60|1 tigre dente-de-sabre
61-65|Uma lagoa congelada, com um buraco irregular no gelo que parece ter sido feito recentemente
66-68|1 furioso
69-70|1 ogro
71-72|1 grifo
73-75|1 druida
76-80|3d4 refugiados (plebeus) fugindo de orcs
81|1d3 veteranos
82|1d4 orogs
83|2 ursos marrons
84|1 orc Olho de Gruumsh com 2d8 orcs
85|1d3 lobos invernais
86-87|1d4 yetis
88|1 meio-ogro
89|1d3 mantícoras
90|1 capitão dos bandidos com 2d6 bandidos
91|1 ressurgido
92|1 troll
93-95|1 homem-urso
96-97|1 remorhaz jovem
98|1 mamute
99|1 dragão branco jovem
00|1 gigante do gelo`);
add("arctic","5–10",`
01-05|2 tigres dente-de-sabre
06-07|1d4 meio-ogros
08-10|1d3 + 1 ursos marrons
11-15|1d3 ursos polares
16-20|2d4 furiosos
21-25|Uma druida meio-orc que parece ter sido ferida por um urso polar. Se os personagens a ajudarem, ela lhes dá um frasco de antitoxina
26-30|2d8 batedores
31-35|2d4 mephits do gelo
36-40|2d6 + 1 zumbis a bordo de um galeão preso no gelo. Revistando o navio, encontram 2d20 dias de ração
41-45|1 mantícora
46-50|2d6 + 3 orcs
51-53|1d6 + 2 ogros
54-55|2d4 grifos
56-57|1d4 veteranos
58-60|1 capitão dos bandidos com 1 druida, 1d3 furiosos e 2d10 + 5 bandidos
61-65|1d4 horas de frio extremo (veja o capítulo 5 do Guia do Mestre)
66-68|1 remorhaz jovem
69-72|1 orc Olho de Gruumsh com 1d6 orogs e 2d8 + 6 orcs
73-75|1 ressurgido
76-80|Um uivo que ecoa pela região por 1d3 minutos
81-82|1d3 mamutes
83-84|1 dragão branco jovem
85-86|2d4 lobos invernais
87-88|1d6 + 2 yetis
89-90|1d2 gigantes do gelo
91-92|1d3 homens-urso
93-94|1d4 trolls
95-96|1 yeti abominável
97-98|1 remorhaz
99|1 roca
00|2d4 remorhazes jovens`);
add("arctic","11–16",`
01|1 yeti abominável
02-04|1d6 ressurgidos
05-10|1d4 + 1 homens-urso
11-20|1d3 dragões brancos jovens
21-25|Uma nevasca que reduz a visibilidade para 1,5 m por 1d6 horas
26-35|1 roca
36-40|Uma manada de 3d20 + 60 renas (veados) atravessando a neve
41-50|1d4 mamutes
51-60|1d8 + 1 trolls
61-65|Um lago congelado de um quilômetro e meio de largura, onde se veem corpos preservados de criaturas estranhas
66-75|2d4 remorhazes jovens
76-80|Um castelo de gelo desmoronando, com vários corpos congelados de humanoides de pele azul espalhados ao redor
81-90|1 dragão branco adulto
91-96|1d8 + 1 gigantes do gelo
97-99|1d4 remorhazes
00|1 dragão branco ancião`);
add("arctic","17–20",`
01-02|2d10 ressurgidos
03-04|2d8 trolls
05-06|2d10 homens-urso
07-08|1 gigante do gelo
09-10|2d4 remorhazes jovens
11-20|1d4 gigantes do gelo
21-25|Um trecho circular de gelo negro no chão. O ar sobre ele é mais quente que ao redor, e quem inspecionar o gelo encontra pedaços de maquinaria congelada dentro
26-35|1 dragão branco ancião
36-40|Um aventureiro congelado 2 m abaixo do gelo; 50% de chance de o corpo ter um item mágico raro à escolha do Mestre
41-50|1d3 yetis abomináveis
51-60|1d4 remorhazes
61-65|Uma muralha de gelo de 150 m de altura e 90 m de espessura, que se estende por 1d6 quilômetros
66-75|1d4 rocas
76-80|A imagem de uma mulher austera de longos cabelos esvoaçantes, esculpida na encosta da montanha
81-90|1d10 gigantes do gelo com 2d4 ursos polares
91-96|1d3 dragões brancos adultos
97-99|2d4 yetis abomináveis
00|1 dragão branco ancião com 1d3 dragões brancos jovens`);

add("coast","1–4",`
01|1 pseudodragão
02-05|2d8 caranguejos
06-10|2d6 pescadores (plebeus)
11|1d3 cobras venenosas
12-13|1d6 guardas protegendo um nobre encalhado
14-15|2d4 batedores
16-18|2d10 membros do povo do mar
19-20|1d6 + 2 sahuagins
21-25|1d4 carniçais se alimentando de corpos nos destroços de um navio mercante. Uma busca revela 2d6 rolos de seda arruinada, uma corda de 15 m e 1 barril de arenque salgado
26-27|1d4 kobolds alados com 1d6 + 1 kobolds
28-29|2d6 guerreiros tribais
30-31|3d4 kobolds
32-33|2d4 + 5 falcões de sangue
34-35|1d8 + 1 pteranodontes
36-40|Algumas dúzias de tartarugas recém-nascidas lutando para chegar ao mar
41-42|1d6 + 2 lagartos gigantes
43-44|1d6 + 4 caranguejos gigantes
45-46|2d4 stirges
47-48|2d6 + 3 bandidos
49-53|2d4 sahuagins
54-55|1d6 + 2 batedores
56-60|1 bruxa do mar
61-65|Uma formação momentânea nas ondas que lembra o rosto enorme de um humanoide
66-70|1 druida
71-75|1d4 harpias
76-80|Um eremita solitário (acólito) sentado na praia, contemplando o sentido do multiverso
81|1d4 furiosos
82|1d6 águias gigantes
83|2d4 sapos gigantes
84|1d4 ogros ou 1d4 sireníedeos
85|1d4 sahuagins
86|1d4 veteranos
87|1d2 plesiossauros
88|1 capitão dos bandidos com 2d6 bandidos
89|1d3 mantícoras
90|1 banshee
91-92|1d4 + 3 grifos
93-94|1 sacerdotisa sahuagin com 1d3 sireníedeos e 2d6 sahuagins
95-96|1 barão sahuagin
97-98|1 elemental da água
99|1 ciclope
00|1 dragão de bronze jovem`);
add("coast","5–10",`
01|2d6 aranhas-lobo gigantes
02-03|3d6 pteranodontes
04-05|2d4 batedores
06-07|1d6 + 1 sahuagins
08|1 bruxa do mar
09-10|1d4 + 1 sapos gigantes
11-15|3d6 sahuagins
16-20|2d6 águias gigantes
21-25|Um pseudodragão perseguindo gaivotas no ar
26-29|1d2 druidas
30-32|2d4 + 1 sapos gigantes
33-35|1 plebeu cantando uma canção triste (só de dia) ou 1 banshee (só à noite)
36-40|Uma garrafa tampada com um bilhete ilegível, parcialmente enterrada na areia
41-43|3 bruxas do mar
44-46|1d8 + 1 harpias
47-50|1d4 plesiossauros
51-53|1d4 mantícoras
54-56|2d4 ogros
57-60|1d10 grifos
61-65|Uma batalha no mar entre dois galeões
66-70|1d4 + 3 sireníedeos
71-75|Uma tripulação pirata com 1 capitão dos bandidos, 1 druida, 2 furiosos e 2d12 bandidos, todos procurando um tesouro enterrado
76-80|Uma mão humanoide cortada, presa numa rede
81-82|1 elemental da água
83-84|1 ciclope
85-86|1d4 banshees (só à noite)
87-88|2d4 veteranos
89-90|1 dragão de bronze jovem
91-93|1d3 ciclopes
94-95|1 dragão azul jovem
96|1 barão sahuagin com 1d3 sacerdotisas sahuagin e 2d8 sahuagins
97|1 djinni
98|1 roca
99|1 marid
00|1 gigante da tempestade`);
add("coast","11–16",`
01|1d4 banshees (só à noite)
02-04|1 ciclope
05-08|1d6 + 2 mantícoras
09-10|1d8 + 2 veteranos
11-20|1 dragão azul jovem
21-25|Um ninho com 1d6 ovos de tartaruga-dragão
26-35|1d4 barões sahuagin
36-40|Um tridente parcialmente enterrado na areia
41-50|1 dragão de bronze jovem
51-55|1 marid
56-60|1d6 elementais da água
61-65|2d6 lívidos rastejando por 1d6 navios naufragados, se alimentando dos mortos
66-70|1 djinni
71-75|1d3 dragões de bronze jovens
76-80|Uma baleia encalhada, morta e inchada. Se sofrer qualquer dano, explode: cada criatura a até 12 m faz um teste de resistência de Destreza CD 15, sofrendo 5d6 de dano de concussão numa falha, ou metade num sucesso
81-82|2d4 ciclopes
83-84|1 gigante da tempestade
85-86|1d3 dragões azuis jovens
87-88|1 dragão de bronze adulto
89-90|1 dragão azul adulto
91-93|1d3 rocas
94-97|1 tartaruga-dragão
98-99|1 dragão de bronze ancião
00|1 dragão azul ancião`);
add("coast","17–20",`
01-10|1 roca
11-20|1 gigante da tempestade
21-25|Um dragão de bronze adulto lutando com um dragão azul adulto até a morte
26-40|2d6 ciclopes
41-50|1 dragão de bronze adulto ou 1 dragão azul adulto
51-60|1d3 djinnis ou 1d3 marids
61-70|1 tartaruga-dragão
71-75|1d3 rocas
76-80|1d6 + 2 trombas d'água que dançam sobre o mar antes de pararem abruptamente
81-90|1d6 dragões azuis jovens
91-96|1 dragão de bronze ancião
97-99|1 dragão azul ancião
00|1d3 + 1 gigantes da tempestade`);

add("desert","1–4",`
01|3d8 escorpiões
02|2d4 abutres
03|1 mula abandonada
04|2d6 plebeus com 2d4 camelos a caminho de uma cidade distante
05|1d6 cobras voadoras
06|2d6 hienas ou 2d6 chacais
07|1d6 guardas escoltando um nobre até a beira do deserto, todos montados em camelos
08|1d6 gatos
09|1 pseudodragão
10|1d4 cobras venenosas
11-13|2d6 stirges
14-15|1d6 + 2 aranhas-lobo gigantes
16-17|1 batedor
18-20|2d4 serpentes venenosas gigantes
21-25|Pegadas em fila única seguindo para dentro do deserto
26-27|4d4 kobolds
28-29|1 homem-chacal
30-31|3d6 guerreiros tribais
32-33|1d6 lagartos gigantes
34-35|1 enxame de insetos
36-40|Um oásis rodeado de palmeiras, com os restos de um velho acampamento
41-44|3d6 bandidos
45-46|1d4 cobras constritoras
47-48|2d4 kobolds alados
49-50|1 mephit da poeira
51-52|1d3 + 1 sapos gigantes
53-54|1d4 aranhas gigantes
55|1 druida
56-57|2d4 hobgoblins
58|1 inumano
59-60|1 ogro
61-65|Uma lâmpada de latão caída no chão
66-67|1d4 abutres gigantes
68|1 aranha interplanar
69|1 cobra constritora gigante
70-71|1 gnoll líder de matilha com 1d3 hienas gigantes
72|1d6 + 2 gnolls
73-74|1 múmia
75|1d3 meio-ogros
76-80|Uma pilha de ossos humanoides envoltos em panos apodrecidos
81-82|1 lâmia
83|1 hobgoblin capitão com 2d6 hobgoblins
84|2d4 cães da morte
85-86|1d4 escorpiões gigantes
87|1 yuan-ti mestiço com 1d4 + 1 yuan-tis puro-sangue
88-89|1 capitão dos bandidos com 1 druida e 3d6 bandidos
90|2d4 thri-kreen
91|1 elemental do ar
92|1d3 couatls
93|1 elemental do fogo
94|1d4 gnolls presa de Yeenoghu
95|1 ressurgido
96|1d4 homens-tigre
97|1 ciclope
98|1 dragão de latão jovem
99|1 medusa
00|1 yuan-ti abominação`);
add("desert","5–10",`
01|1d6 batedores
02|2d4 homens-chacal
03|2d6 hobgoblins
04|1d4 + 3 mephits da poeira
05|1d6 enxames de insetos
06|1 cobra constritora gigante
07-08|1 leão
09-10|2d4 gnolls
11-12|3d6 sapos gigantes
13-17|1 múmia
18-20|1d8 + 1 abutres gigantes
21-25|Um obelisco de pedra parcialmente enterrado na areia
26-28|1 ogro com 1d3 meio-ogros
29-35|1d10 hienas gigantes
36-40|1d6 + 1 tendas vazias
41-43|1d6 + 2 thri-kreen
44-46|2d4 yuan-tis puro-sangue
47-50|1d6 + 3 cães da morte
51-52|1d4 escorpiões gigantes
53|1 elemental do fogo
54-55|1 hobgoblin capitão com 3d4 hobgoblins
56|1d6 + 2 ogros
57-58|1d4 lâmias
59-60|1 elemental do ar
61-65|Um meteorito no fundo de uma cratera vitrificada
66|1d4 + 1 inumanos
67-68|1 dragão de latão jovem
69-70|1 capitão dos bandidos com 1d3 furiosos e 3d6 bandidos
71-72|1 ciclope
73|1d4 couatls
74-75|1d4 yuan-tis mestiços
76-80|Ventos fortes que levantam areia e reduzem a visibilidade para 1d3 m por 1d4 horas
81-83|1 ressurgido com 1d3 inumanos
84-85|1d8 + 1 aranhas interplanares
86-87|1d6 + 2 homens-tigre
88-90|2d4 gnolls presa de Yeenoghu
91|1 dragão azul jovem
92|1d4 ciclopes
93|1d3 yuan-tis abominação
94|1d4 medusas
95|1 naga guardiã
96|1d3 dragões de latão jovens
97|1 efreeti
98|1 roca
99|1 ginoesfinge
00|1 dragão de latão adulto`);
add("desert","11–16",`
01|1 dragão de latão jovem
02-05|4d6 gnolls
06-10|3d10 hienas gigantes
11-12|1d8 + 1 lâmias
13-14|2d4 gnolls presa de Yeenoghu
15-17|1d6 + 2 escorpiões gigantes
18-20|2d4 aranhas interplanares
21-25|Uma caravana no deserto com 1d6 mercadores (nobres) e 2d6 guardas
26-27|1d6 + 1 couatls
28-30|1d4 elementais do fogo
31-32|1 hobgoblin capitão com 3d10 + 10 hobgoblins
33-35|2d4 inumanos
36-40|1d10 quilômetros quadrados de vidro do deserto
41-42|1 dragão azul jovem
43-45|1d6 + 2 homens-tigre
46-48|1d4 elementais do ar
49-50|1d6 + 1 yuan-tis mestiços
51-55|1d4 medusas
56-60|1d4 ressurgidos com 3d12 esqueletos
61-65|Uma pirâmide saqueada
66-70|1d4 dragões de latão jovens
71-75|1d3 yuan-tis abominação
76-78|1d6 + 2 ciclopes
79-82|1 dragão de latão adulto
83-85|1 verme púrpura
86|1d2 dragões azuis jovens
87-88|1 senhor das múmias
89|1d3 nagas guardiãs
90|1 dragão azul adulto
91|1d2 esfinges
92-93|1d3 efreetis
94|1 androesfinge
95|1d4 rocas
96-97|1 dracolich azul adulto
98-99|1 dragão de latão ancião
00|1 dragão azul ancião`);
add("desert","17–20",`
01-05|1 dragão de latão adulto
06-10|1d2 yuan-tis abominação com 2d10 + 5 yuan-tis mestiços e 4d6 + 6 yuan-tis puro-sangue
11-14|1d6 + 2 medusas
15-18|1d2 vermes púrpura
19-22|2d4 ciclopes
23-25|Uma cidade abandonada de mármore branco, vazia durante o dia. À noite, aparições inofensivas vagam pelas ruas, revivendo os momentos finais de suas vidas
26-30|1d3 dragões azuis jovens
31-35|1 senhor das múmias
36-40|1d4 horas de calor extremo (veja o capítulo 5 do Guia do Mestre)
41-50|1d3 nagas guardiãs
51-60|1d4 efreetis
61-63|Uma placa antiga apontando um único destino, chamado Pazar
64-72|1d4 rocas
73-80|1d3 ginoesfinges
81-85|1 dracolich azul adulto
86-90|1 androesfinge
91-96|1 dragão de latão ancião
97-99|1 dragão azul ancião
00|1d4 dragões de latão adultos`);

add("forest","1–4",`
01|1 coruja gigante
02|1d4 gatos
03|2d4 lenhadores (plebeus)
04|1 texugo ou 1d4 serpentes venenosas
05|2d8 babuínos
06|1d6 + 3 hienas
07|1 coruja
08|1 pseudodragão
09|1 pantera
10|1 serpente venenosa gigante
11|1d6 + 2 javalis
12|1d4 + 1 lagartos gigantes
13|1 gorila ou 1 tigre
14|2d6 guerreiros tribais com 1d6 mastins
15|1d6 + 2 morcegos gigantes ou 3d6 cobras voadoras
16|1 batedor ou 2d4 guardas com 1d8 mastins
17|1d8 + 1 kobolds alados
18|1d3 cobras constritoras
19|1d10 + 5 ratos gigantes ou 2d6 + 3 doninhas gigantes
20|1d4 + 1 espinheiros infectados com 1d6 + 3 galhos infectados
21-25|Uma criança perdida, chorando. Se os personagens a levarem para casa, os pais os recompensam com 1d3 poções de cura
26|1d8 + 1 sapos gigantes
27|4d4 kobolds
28|1d3 ursos negros
29|3d6 stirges
30|1 sátiro
31|2d4 kenku
32|1d3 vinhas infectadas com 1d12 arbustos despertos
33|1d4 enxames de corvos
34|1 dragão-fada (amarelo ou mais jovem)
35|1d4 + 2 texugos gigantes
36-40|Um jovem lenhador (batedor) correndo pela floresta para resgatar um amigo perdido
41|2d4 cães teleportadores
42|1d8 + 1 sprites
43|1d6 + 2 alces
44|1d4 homens-lagarto ou 3d6 bandidos
45|1d4 + 4 lobos
46|2d4 aranhas-lobo gigantes
47|1 enxame de insetos
48|1d6 + 2 pixies
49|1 urso marrom
50|1d4 + 3 goblins
51|1d3 dríades
52|1 árvore desperta
53|1 aranha interplanar
54|1d6 harpias
55|1 ettercap ou 1d8 + 1 orcs
56|1 goblin chefe com 2d6 + 1 goblins
57|1 ankheg
58|1 cobra constritora gigante
59|1d4 bugbears ou 2d4 hobgoblins
60|1 pégaso
61-65|Um riacho de água limpa e fria correndo entre as árvores
66|1d4 meio-ogros ou 1 ogro
67|1 dragão-fada (verde ou mais velho)
68|1 lobisomem ou 1d8 + 1 worgs
69|1 druida colhendo visco
70|1 fogo-fátuo
71|1d4 lobos atrozes ou 1 javali gigante
72|1d10 vespas gigantes
73|1 urso-coruja ou 1 alce gigante
74|2d6 gnolls
75|1d6 sapos gigantes
76-80|1d6 casulos de teia pendurados nos galhos, com carcaças esbranquiçadas dentro
81|1 homem-javali ou 1d4 javalis gigantes
82|1d6 + 2 aranhas gigantes
83|1d4 centauros ou 1d4 alces gigantes
84|1 orc Olho de Gruumsh com 2d4 + 2 orcs
85|1 gnoll presa de Yeenoghu
86|1d4 gricks
87|1 capitão dos bandidos com 2d6 + 3 bandidos
88|1d4 homens-rato
89|1 couatl (de dia) ou 1 banshee (à noite)
90|1 gnoll líder de matilha com 1d4 hienas gigantes
91|2d4 furiosos ou 1d4 veteranos
92|1 xamã homem-lagarto com 1d3 enxames de serpentes venenosas e 1d10 + 2 homens-lagarto
93|1d4 panteras deslocadoras
94|1d3 bruxas verdes
95|1 hobgoblin capitão com 2d6 hobgoblins e 1d4 javalis gigantes
96|1 yuan-ti mestiço com 1d6 + 1 yuan-tis puro-sangue
97|1d3 homens-tigre
98|1 gorgon ou 1 unicórnio
99|1 arbusto errante
00|1 yuan-ti abominação`);
add("forest","5–10",`
01|2d4 vinhas infectadas
02|2d6 hobgoblins ou 2d6 orcs
03|2d4 gorilas ou 2d4 sátiros
04|1d3 fogos-fátuos
05|1d4 enxames de serpentes venenosas
06|1 orc Olho de Gruumsh com 1d3 orogs e 1d8 + 2 orcs
07|1d3 cobras constritoras ou 1d4 tigres
08|1 goblin chefe com 3d6 goblins
09|1 dragão-fada (de qualquer idade)
10|1 urso marrom ou 1d6 + 2 ursos negros
11-13|1d4 javalis gigantes
14-15|1d8 + 1 aranhas gigantes
16-17|1 xamã homem-lagarto com 2d4 homens-lagarto
18|1d10 sapos gigantes
19|1d4 ankhegs
20|1d3 árvores despertas (de dia) ou 1 banshee (à noite)
21-25|Uma pequena cabana quase escondida pela floresta densa. O interior está vazio, exceto por um grande forno de ferro fundido
26|1 couatl
27-28|1d4 ogros ou 1d6 + 2 meio-ogros
29-30|1 gnoll líder de matilha com 1d4 + 1 hienas gigantes
31-32|1d6 homens-rato
33|1d4 gricks
34|1d8 + 1 yuan-tis puro-sangue
35|1d6 pégasos
36-40|Um velho arco de pedra de óbvio trabalho élfico. Quem passar sob ele faz testes de Sabedoria (Percepção) com vantagem por 1 hora
41-42|1d6 + 2 dríades
43|1 alce gigante
44|1d8 + 1 harpias
45-46|1 capitão dos bandidos com 1 druida e 1d6 + 5 bandidos
47-48|2d4 lobos atrozes
49-50|2d4 bugbears
51-52|2d4 centauros
53-54|3d10 cães teleportadores
55-56|1d4 ursos-coruja
57-58|1d8 + 1 furiosos
59-60|1d3 bruxas verdes
61-65|Um lago transparente com 1d6 animais dormindo deitados em sua margem
66-67|1d4 lobisomens
68-69|1 homem-urso
70-71|1d8 + 1 ettercaps
72-73|2d10 alces
74-75|1d4 veteranos
76-80|Uma árvore velha com um rosto enrugado esculpido no tronco
81|1 homem-javali
82|2d4 panteras deslocadoras
83|1d4 arbustos errantes
84|1 hobgoblin capitão com 3d10 hobgoblins e 4d12 goblins
85|1 yuan-ti abominação
86|1d8 + 1 aranhas interplanares
87|1d4 trolls
88|2d4 yuan-tis mestiços
89|1 oni
90|1d4 unicórnios
91|1d6 + 2 homens-tigre
92|1 dragão verde jovem
93|1d4 gorgons
94|1d6 + 2 gnolls presa de Yeenoghu
95|1 ente
96|1d4 ressurgidos
97|1 grick alfa com 1d6 + 1 gricks
98|1d4 gorilas gigantes
99|1 naga guardiã
00|1 dragão de ouro adulto`);
add("forest","11–16",`
01-03|1 homem-urso
04-05|1d4 druidas fazendo um ritual sobre um morto (só de dia) ou 1d4 banshees (só à noite)
06-07|1d3 couatls
08-10|1d3 gnolls presa de Yeenoghu com 3d6 + 3 gnolls
11-15|2d4 panteras deslocadoras
16-20|1d6 + 2 veteranos
21-25|Uma poça de água parada e limpa. Moedas de ouro brilham no fundo, mas desaparecem se forem tiradas da poça
26-30|1d4 + 1 bruxas verdes com 1d3 ursos-coruja
31-35|1d6 + 2 lobisomens
36-40|Um pequeno santuário de madeira dedicado a um culto misterioso chamado Siswa
41-45|1d6 + 2 aranhas interplanares
46-50|2d4 yuan-tis mestiços
51-52|1d3 homens-urso
53-54|1d4 ressurgidos
55-56|1 dragão verde jovem
57-58|1d4 trolls
59-60|1d6 + 2 homens-javali
61-65|Um grupo de sete pessoas (plebeus) usando máscaras de animais e andando lentamente pela mata
66-67|1d4 gorgons
68-69|1d3 arbustos errantes
70-71|1 ente
72-73|1d4 unicórnios
74-75|1d6 + 2 homens-tigre
76-80|O som de uma gargalhada que ecoa à distância
81-82|1 naga guardiã
83-84|1 dragão de ouro jovem
85-86|1 grick alfa com 2d4 gricks
87-88|1d3 yuan-tis abominação
89-90|1 dragão verde adulto
91-93|1d8 + 1 gorilas gigantes
94-96|2d4 onis
97-99|1d3 entes
00|1 dragão verde ancião`);
add("forest","17–20",`
01-05|1 dragão verde jovem
06-10|1 ente
11-13|1 naga guardiã
14-16|1d10 ressurgidos
17-19|1d8 + 1 unicórnios
20-22|1d3 gricks alfa
23-25|Por alguns metros, onde quer que os personagens pisem, flores desabrocham e emitem uma luz suave
26-28|1 dragão de ouro jovem
29-31|1d6 + 2 arbustos errantes
32-34|2d4 homens-urso
35-37|1d4 onis
38-40|2d6 + 10 elfos vivendo numa pequena comunidade nas copas das árvores
41-43|1d6 + 2 gorgons
44-46|2d4 trolls
47-49|1d4 gorilas gigantes
50-52|1d3 yuan-tis abominação
53-62|1d3 dragões verdes jovens
63-65|Uma estátua de pedra de 15 m de um guerreiro elfo com uma mão erguida e a palma para fora, como se proibisse os viajantes de seguir naquela direção
66-75|1d4 entes
76-80|Um monte de pedras empilhadas no topo de uma colina baixa
81-90|1 dragão de ouro adulto
91-96|1 dragão verde ancião
97-99|2d4 + 1 entes
00|1 dragão de ouro ancião`);

add("grass","1–4",`
01|1 hobgoblin capitão com 1d4 + 1 hobgoblins
02|1 quimera
03|1 gorgon
04|1d2 couatls
05|1 anquilossauro
06|1 homem-tigre
07|1d3 alossauros
08-09|1d3 elefantes
10-14|Um círculo de pedras erguidas dentro do qual o ar fica completamente parado, por mais forte que sopre o vento lá fora
15-16|1 aranha interplanar
17-18|1 gnoll líder de matilha com 1d4 hienas gigantes
19-20|1 orog ou 1 pégaso
21-22|1 ankheg
23-24|1d3 rinocerontes
25-28|1d3 cocatrizes
29-32|1d6 + 2 vespas gigantes ou 1d4 + 3 enxames de insetos
33-36|1d4 homens-chacal ou 1d4 batedores
37-40|1d8 bodes gigantes ou 1d8 lobos
41-44|2d4 hobgoblins, 2d4 orcs ou 2d4 gnolls
45-46|1d2 serpentes venenosas gigantes
47-48|1d6 + 2 alces ou 1d6 + 2 cavalos de montaria
49-50|2d4 goblins
51-52|1d3 javalis
53-54|1 leopardo (pantera) ou 1 leão
55-58|1d6 + 3 goblins montados em lobos
59-62|2d6 aranhas-lobo gigantes ou 1 águia gigante
63-65|1d8 + 4 pteranodontes
66-69|3d6 lobos
70-74|2d4 + 2 bicos-de-machado
75-76|1 javali gigante ou 1d2 tigres
77-78|1 ogro ou 1d3 bugbears
79-80|1 alce gigante, ou 1 gnoll líder de matilha com 1d3 hienas gigantes
81-82|1d3 abutres gigantes ou 1d3 hipogrifos
83-84|1 goblin chefe com 1d6 + 2 goblins e 1d4 + 3 lobos, ou 1d3 thri-kreen
85-89|1d3 druidas patrulhando os campos
90-91|1d6 espantalhos ou 1 homem-javali
92-93|1d3 centauros ou 1d3 grifos
94|1d3 gnolls presa de Yeenoghu, ou 1 orc Olho de Gruumsh com 2d4 + 1 orcs
95-96|1 tricerátops
97|1 ciclope ou 1 bulette
98-99|1d4 mantícoras
00|1 tiranossauro`);
add("grass","5–10",`
01|1d3 gorgons
02|1d4 ciclopes
03-04|1d3 gnolls presa de Yeenoghu
05-06|1 quimera
07-09|1d4 + 1 veteranos em cavalos de montaria
10-11|Um tornado toca o chão a 1d10 quilômetros e rasga a terra por um quilômetro e meio antes de se dissipar
12-13|1d3 mantícoras
14-15|2d4 ankhegs
16-17|1d8 + 1 centauros
18-19|1d6 + 2 grifos
20-21|1d6 elefantes
22-24|Um trecho de terra repleto de máquinas de guerra apodrecidas, ossos e estandartes de exércitos esquecidos
25-28|1d8 + 1 bugbears
29-32|1 gnoll líder de matilha com 1d4 + 1 hienas gigantes
33-36|2d4 espantalhos
37-40|1d12 leões
41-44|1d10 thri-kreen
45-46|1 alossauro
47-48|1 tigre
49-50|1d2 águias gigantes ou 1d2 abutres gigantes
51-52|1 goblin chefe com 2d4 goblins
53-54|1d2 pégasos
55-58|1 anquilossauro
59-62|1d2 couatls
63-66|1 orc Olho de Gruumsh com 1d8 + 1 orcs
67-70|2d4 hipogrifos
71-74|1d4 + 1 rinocerontes
75-76|1 hobgoblin capitão com 2d6 hobgoblins
77-78|1d3 aranhas interplanares
79-80|1d6 + 2 javalis gigantes
81-82|2d4 alces gigantes
83-84|1d4 ogros e 1d4 orogs
85-87|Um vento quente que carrega cheiro de podridão
88-90|1d3 homens-tigre
91-92|1 bulette
93-94|Uma tribo de 2d20 + 20 nômades (guerreiros tribais) em cavalos de montaria, seguindo um rebanho de antílopes (alces). Eles aceitam trocar comida, couro e informações por armas
95-96|1d6 + 2 homens-javali
97|1 dragão de ouro jovem
98-99|1d4 tricerátops
00|1d3 tiranossauros`);
add("grass","11–16",`
01-05|3d6 homens-javali
06-10|2d10 gnolls presa de Yeenoghu
11-15|1d4 bulettes
16-17|Uma antiga estrada de pedra, parcialmente tomada pela vegetação, que segue por 2d6 quilômetros em cada direção antes de sumir
18-27|1d12 couatls
28-30|Uma bruxa (mago) morando numa cabana rústica. Ela vende poções de cura, antitoxinas e outros consumíveis em troca de comida e notícias
31-40|2d10 elefantes
41-46|2d4 homens-tigre
47-56|1d8 + 1 ciclopes
57-61|1d3 quimeras
62-66|5 tricerátops
67-69|Um buraco gigante de 15 m de diâmetro que desce quase 150 m antes de se abrir numa caverna ampla
70-79|1d4 + 3 gorgons
80-88|1d3 dragões de ouro jovens
89-90|Um círculo de grama amassada com quase 400 m de diâmetro; do alto, veem-se 1d4 outros círculos ligados por linhas
91-96|2d4 tiranossauros
97-99|1 dragão de ouro adulto
00|1 dragão de ouro ancião`);
add("grass","17–20",`
01-10|2d6 tricerátops
11-20|1d10 gorgons
21-25|2d6 hienas se alimentando da carcaça de um dinossauro morto
26-35|3d6 bulettes
36-40|Uma carruagem flamejante cruzando o céu no horizonte
41-50|1d3 dragões de ouro jovens
51-60|2d4 ciclopes
61-65|Um vale onde toda a grama está morta e o chão está coberto de tocos e troncos caídos, todos petrificados
66-75|2d10 bugbears com 4d6 goblins e 2d10 lobos
76-80|Um grupo amigável de 1d6 + 1 aventureiros de raças, classes e níveis variados (nível médio 1d6 + 2). Eles compartilham informações sobre suas viagens recentes
81-90|1d12 quimeras
91-96|1d6 + 2 tiranossauros
97-99|1 dragão de ouro adulto
00|1 dragão de ouro ancião`);

add("hill","1–4",`
01|1 águia
02-03|2d4 babuínos
04-06|1d6 bandidos
07|1d4 abutres
08|1d10 plebeus
09|1 corvo
10|1 serpente venenosa
11-13|2d6 bandidos ou 2d6 guerreiros tribais
14|2d8 bodes
15|1d6 + 4 falcões de sangue
16|1d4 + 3 texugos gigantes
17-18|1d3 guardas com 1d2 mastins e 1 mula
19-20|1d6 + 5 hienas
21-22|2d4 stirges
23-25|Uma caverna vazia cheia de ossos
26|1 pseudodragão ou 1d3 corujas gigantes
27|1 leão ou 1 puma (pantera)
28-30|2d8 kobolds
31|1 hipogrifo
32-34|2d4 goblins
35|1 worg
36|1d3 enxames de morcegos ou 1d3 enxames de corvos
37|1 águia gigante
38-40|Um anão idoso sentado num toco, entalhando um pedaço de madeira
41|1d4 alces
42|1d4 kobolds alados com 1d6 kobolds
43|1d6 + 2 aranhas-lobo gigantes
44-45|2d4 lobos
46|1 enxame de insetos
47|1d8 + 1 bicos-de-machado
48-49|1 urso marrom ou 1d3 javalis
50|1 batedor
51|1 ogro
52-53|2d4 gnolls
54|1 alce gigante
55|1d3 + 1 harpias
56|1 lobisomem
57-58|2d4 orcs
59|1d4 meio-ogros
60|1 druida ou 1 veterano
61-63|O cadáver de um aventureiro com um pacote de explorador intacto, caído sobre uma espada longa
64|1 bruxa verde
65-66|1d3 lobos atrozes
67-68|Um pequeno cemitério com 2d6 túmulos
69-70|1 hobgoblin capitão com 2d4 hobgoblins
71|2d4 bodes gigantes
72|1 mantícora
73-74|1d6 + 2 hobgoblins
75|1 aranha interplanar
76-78|Uma pilha de excremento de um pássaro muito grande
79|1 gnoll presa de Yeenoghu
80|1d3 javalis gigantes
81|1 gnoll líder de matilha com 1d3 hienas gigantes
82|1 capitão dos bandidos com 2d4 bandidos
83|1 orc Olho de Gruumsh com 1d8 + 2 orcs
84|1d3 orogs ou 1d4 furiosos
85-86|1 ettin ou 1 homem-javali
87-88|1 goblin chefe com 2d6 goblins
89|1d3 grifos
90|1d3 perytons ou 1d4 pégasos
91-96|1d3 trolls
97-99|1 ciclope
00|1 gigante de pedra`);
add("hill","5–10",`
01|1d4 pégasos ou 1d3 perytons
02|1d6 + 2 bodes gigantes
03|1 mantícora
04|1d8 + 1 gnolls ou 1d8 + 1 hobgoblins
05|1d4 leões
06|1d6 + 2 lobos
07|1d4 ursos marrons
08|3d6 bicos-de-machado
09|1 meio-ogro com 2d6 orcs
10|2d10 kobolds alados
11-12|1 goblin chefe com 1d4 lobos atrozes e 2d6 goblins
13|1d6 alces gigantes
14-15|1d8 + 1 águias gigantes
16-17|1d4 aranhas interplanares
18-19|1 gnoll líder de matilha com 2d4 hienas gigantes
20|2d4 hipogrifos
21-25|Uma estátua de pedra de um anão, com 4,5 m de altura, tombada de lado
26-27|2d4 orogs
28-29|1d4 + 1 grifos
30-31|1d6 + 2 harpias
32-33|1 orc Olho de Gruumsh com 2d6 + 3 orcs
34-35|1d4 + 3 javalis gigantes
36-40|Uma porta de pedra na encosta de uma colina íngreme, que se abre para uma escada de 4,5 m descendo até uma caverna
41-42|1d3 bruxas verdes
43-44|1d4 lobisomens
45-46|1d6 + 2 ogros
47-48|1 hobgoblin capitão com 2d8 hobgoblins
49-50|1 capitão dos bandidos com 3d6 bandidos
51-54|1 quimera
55-58|1d4 ettins
59-62|1d6 + 2 veteranos com 2d6 furiosos
63-65|Uma cabana de madeira abandonada
66-69|1 galeb duhr
70-73|1 bulette
74-77|1 wyvern
78-80|2d6 + 10 bodes com 1 pastor (guerreiro tribal)
81-82|1d3 gigantes da colina
83-84|2d4 homens-javali
85-86|1d4 ressurgidos
87-88|1d2 gorgons
89-90|1d8 + 1 gnolls presa de Yeenoghu
91-93|1d4 ciclopes
94-96|1 dragão vermelho jovem
97-98|1d4 gigantes de pedra
99|1d3 dragões de cobre jovens
00|1 roca`);
add("hill","11–16",`
01|2d8 mantícoras ou 2d8 aranhas interplanares
02-04|1d6 bruxas verdes com 1d6 wyverns
05-07|1 hobgoblin capitão com 1 gigante da colina e 4d10 hobgoblins
08-10|2d6 + 3 lobisomens
11-14|1d6 + 2 ettins
15-18|1d3 bulettes
19-22|1d4 homens-urso
23-24|Um fio de fumaça saindo de uma pequena chaminé na encosta
25-28|1d4 wyverns
29-32|1d8 + 1 homens-javali
33-36|1d3 ressurgidos
37-38|Um tremor leve que sacode a região por 1d20 segundos
39-42|1d3 quimeras
43-46|1d4 gorgons
47-50|1d6 + 2 gnolls presa de Yeenoghu
51-54|1d4 gigantes da colina
55-58|1 dragão vermelho jovem
59-62|1d3 + 1 galebs duhr
63-65|2d10 mineiros anões (plebeus), assobiando enquanto marcham para a mina
66-69|1d3 dragões de cobre jovens
70-73|1d4 trolls
74-77|1d3 ciclopes
78-80|1d3 nobres com 1d4 batedores à procura de ouro
81-85|1 dragão de cobre adulto
86-90|2d4 gigantes de pedra
91-96|1d4 rocas
97-99|1 dragão vermelho adulto
00|1 dragão de cobre ancião`);
add("hill","17–20",`
01|1d2 rocas
02-05|1 dragão vermelho jovem
06-10|2d6 ettins
11-15|1d4 bulettes
16-20|1d10 ressurgidos
21-25|O contorno branco de um cavalo enorme esculpido na encosta de uma colina alta
26-30|1d6 + 1 gorgons
31-35|2d4 + 1 trolls
36-40|Os restos queimados de 2d10 humanoides espalhados numa encosta
41-45|2d4 gigantes da colina
46-50|1d6 + 2 homens-urso
51-55|2d4 galebs duhr
56-60|1d4 + 2 wyverns
61-65|Uma rocha enorme parcialmente enterrada, como se tivesse caído ou sido jogada do alto
66-70|1 dragão de cobre adulto
71-75|1d6 + 3 ciclopes
76-80|O topo de uma antiga torre de pedra erguendo-se no alto de uma colina
81-85|2d4 gigantes de pedra
86-90|1 dragão vermelho adulto
91-96|1 dragão de cobre ancião
97-99|1 dragão vermelho ancião
00|1d2 dragões vermelhos adultos com 1d3 dragões vermelhos jovens`);

add("mountain","1–4",`
01-02|1 águia
03-05|1d3 enxames de morcegos
06-08|1d6 bodes
09-11|1d10 + 5 guerreiros tribais
12-14|1d6 + 3 pteranodontes
15-17|1d8 + 1 kobolds alados
18-20|1 leão
21-24|Degraus talhados na encosta que sobem por 1d20 + 12 m e terminam de repente
25-27|2d10 stirges
28-30|2d4 aarakocras
31-33|2d6 soldados anões (guardas) com 1d6 mulas carregando minério de ferro
34-36|1 águia gigante
37-38|Um santuário a um deus leal e neutro, empoleirado num afloramento de rocha
39-41|2d8 + 1 falcões de sangue
42-44|1 bode gigante
45-47|3d4 kobolds
48-50|1 meio-ogro
51-53|1 furioso
54-55|1 orog
56|1 cão infernal
57|1 druida
58-59|1 peryton
60-61|1d2 hipogrifos
62|1 mantícora
63-64|1d6 + 2 batedores
65-67|Pegadas enormes de um gigante que levam até os picos
68-73|2d4 orcs
74-75|1 alce gigante
76-77|1 veterano
78-79|1 orc Olho de Gruumsh
80|1d4 harpias
81|1 ogro
82|1 grifo
83|1 basilisco
84-85|1 tigre dente-de-sabre
86-90|Um jato de vapor brilhante saindo de uma fenda
91|1d2 ettins
92|1 ciclope
93|1 troll
94|1 galeb duhr
95|1 elemental do ar
96|1 bulette
97|1 quimera
98|1 wyvern
99|1 gigante de pedra
00|1 gigante do gelo`);
add("mountain","5–10",`
01-02|2d8 + 1 aarakocras
03-04|1 leão ou 1 tigre dente-de-sabre
05-06|1d8 + 1 bodes gigantes
07-08|1d4 + 3 desbravadores anões (batedores)
09-10|1d6 + 2 orcs
11-15|1d10 águias gigantes
16-20|1d8 + 1 hipogrifos
21-25|1d8 fissuras fumegantes, cada uma obscurecendo parcialmente um cubo de 6 m acima dela
26-30|1 basilisco
31-35|1d12 meio-ogros
36-40|Um desfiladeiro bloqueado por uma muralha de 30 m, com uma abertura no meio onde antes havia um portão
41-45|1 mantícora
46-50|2d4 harpias
51-52|1 galeb duhr
53-54|1 bulette
55-56|1d10 furiosos
57-58|1d3 cães infernais
59-60|1d8 + 1 veteranos
61-65|Uma montanha distante cujo pico parece um dente
66-69|1d4 ettins
70-73|1 wyvern
74-75|1 orc Olho de Gruumsh com 1d6 orogs e 3d6 + 10 orcs
76-80|Uma fileira de 1d10 + 40 estacas com corpos empalados de kobolds, anões e orcs
81-83|1 gigante do fogo
84-85|1 dragão de prata jovem
86-87|1d4 elementais do ar
88-90|1d4 trolls
91-92|1d3 + 1 ciclopes
93-94|1d4 quimeras
95-96|1 gigante das nuvens
97|1 roca
98|1d4 gigantes de pedra
99|1 dragão vermelho jovem
00|1d4 gigantes do gelo`);
add("mountain","11–16",`
01-02|1d8 + 1 basiliscos
03-04|2d4 cães infernais
05-06|1d3 quimeras
07-08|1 galeb duhr
09-10|2d6 veteranos
11-15|1 dragão de prata jovem
16-20|2d4 trolls
21-25|1 dragão vermelho voando no céu, acima dos cumes mais altos
26-30|1d8 + 1 mantícoras
31-35|1d4 ciclopes
36-40|Uma nevasca forte que dura 1d6 horas
41-45|1d10 elementais do ar
46-50|1d6 + 1 bulettes
51-55|1d4 gigantes de pedra
56-60|1 gigante do fogo
61-65|2 gigantes de pedra arremessando uma rocha um para o outro, a alguns metros de distância
66-70|1d8 + 1 ettins
71-75|1d3 gigantes do gelo
76-80|Uma fenda grande, coberta de névoa
81-85|1d4 gigantes das nuvens
86-90|1 dragão de prata adulto
91-96|1 dragão vermelho adulto
97-98|1d4 rocas
99|1 dragão de prata ancião
00|1 dragão vermelho ancião`);
add("mountain","17–20",`
01-05|1d10 bulettes
06-10|1d8 + 1 quimeras
11-15|1 dragão de prata adulto
16-20|1d8 + 1 wyverns
21-25|Um barco enorme ancorado no topo da montanha
26-30|2d4 galebs duhr
31-35|1d4 gigantes do gelo
36-40|Um vale arborizado habitado por elfos reclusos e reservados, que falam com cautela de seu senhor: um feiticeiro louco que vive no coração do vale
41-45|1d10 elementais do ar
46-50|1d6 + 3 trolls
51-55|1 dragão vermelho adulto
56-60|1d4 gigantes das nuvens
61-65|Uma cachoeira de mais de 30 m que cai numa piscina límpida
66-70|1d3 gigantes do fogo
71-75|2d4 gigantes de pedra
76-80|Uma força de 100 anões veteranos guardando o desfiladeiro; ninguém passa sem pagar 100 po a pé, ou 200 po montado
81-85|1d4 rocas
86-90|1d4 dragões vermelhos jovens
91-96|1 dragão de prata ancião
97-00|1 dragão vermelho ancião`);

add("swamp","1–4",`
01|1d4 cobras venenosas
02-05|3d6 ratos
06-10|2d8 corvos
11-12|3d6 ratos gigantes
13|1d10 + 5 guerreiros tribais
14-15|1d8 + 1 lagartos gigantes
16-17|1 crocodilo
18-19|1 enxame de insetos
20|1 aranha gigante
21-22|1d4 + 1 cabanas de barro parcialmente cobertas por águas escuras
23-25|2d8 + 1 kobolds
26|2d4 mephits da lama
27-29|1d6 + 2 serpentes venenosas gigantes
30|2d4 kobolds alados
31-32|1 batedor
33-34|O corpo de um aventureiro preso nos arbustos. Revistando, encontra-se um pacote de explorador e talvez (50%) um item mágico comum aleatório
35-38|1 sapo gigante
39-41|1d6 + 2 cobras constritoras
42-44|2d4 rãs gigantes
45|1d8 + 1 enxames de ratos ou 1d6 + 2 enxames de corvos
46-48|2d10 stirges
49-52|2d6 + 3 bullywugs
53-54|1d8 + 1 orcs
55-56|1d4 yuan-tis puro-sangue
57|1 druida
58-59|1 yuan-ti mestiço
60-62|1 cobra constritora gigante
63-64|Um grito muito alto que dura 1d4 minutos
65-67|2d4 homens-lagarto
68-69|1d4 carniçais
70-71|1 fogo-fátuo
72|1 inumano
73|1 lívido
74-75|1 enxame de cobras venenosas
76-77|Um fedor subindo das águas repugnantes
78-80|1d4 + 2 ogros
81-83|1 arbusto errante
84-86|1 xamã homem-lagarto com 1d6 lagartos gigantes e 2d10 homens-lagarto
87|1 troll
88-89|1d4 bruxas verdes
90-91|1 ressurgido
92-93|1 crocodilo gigante
94-95|1 orc Olho de Gruumsh com 1d3 orogs e 2d6 + 3 orcs
96-97|1 dragão negro jovem
98|1 yuan-ti abominação
99|1d4 elementais da água
00|1 hidra`);
add("swamp","5–10",`
01|1 bruxa verde
02-03|2d4 lagartos gigantes ou 2d4 serpentes venenosas gigantes
04-05|2d8 kobolds alados
06-07|1d10 + 1 bullywugs com 1d8 + 1 rãs gigantes
08-09|1 druida
10|1d8 + 1 enxames de insetos
11-13|1d12 carniçais
14-16|2d8 batedores
17-19|2d10 orcs
20-22|2d4 aranhas gigantes
23-24|Água manchada que expõe quem se move por ela à ferrugem dos olhos (doença do capítulo 8 do Guia do Mestre)
25-27|1d6 + 2 sapos gigantes
28-30|3d6 homens-lagarto
31-33|1d8 + 1 yuan-tis puro-sangue
34-36|1d4 + 1 enxames de cobras venenosas
37-38|Um cadáver humanoide inchado boiando de bruços na água
39-41|1 arbusto errante
42-44|1d4 + 1 fogos-fátuos
45-47|2d6 crocodilos
48-50|1d4 + 1 cobras constritoras gigantes
51-54|1 xamã homem-lagarto com 1d3 enxames de cobras venenosas e 1d8 + 2 homens-lagarto
55-58|1d8 ogros
59-62|2d4 lívidos
63-65|Um altar meio afundado na lama, dedicado a um deus parte humano, parte sapo
66-69|1 crocodilo gigante
70-73|1 arbusto errante
74-77|1 orc Olho de Gruumsh com 1d3 ogros e 2d10 + 5 orcs
78-80|Uma chuva torrencial que dura 1d6 minutos e apaga todas as chamas desprotegidas num raio de 1,5 km
81-82|1 dragão negro jovem
83-84|1d4 bruxas verdes com 1d6 + 1 ogros
85-86|1 yuan-ti abominação
87-88|1d4 + 1 inumanos
89-90|1d6 + 1 yuan-tis mestiços
91-93|1d4 + 1 trolls
94-96|1d10 ressurgidos
97-99|1d8 + 1 elementais da água
00|1d3 hidras`);
add("swamp","11–20",`
01-10|1d4 crocodilos gigantes
11-15|1d3 yuan-tis abominação
16-20|1d6 + 1 bruxas verdes
21-25|Uma árvore grande com 2d6 cavaleiros de armadura enforcados nos galhos
26-30|2d4 inumanos
31-35|1d8 + 1 yuan-tis mestiços
36-40|Uma névoa baixa que deixa uma área de 1d6 quilômetros em escuridão densa por 1d4 horas
41-45|1d4 ressurgidos
46-50|1d6 arbustos errantes
51-55|1d10 elementais da água
56-60|1d4 dragões negros jovens
61-65|Um ídolo com cabeça de morcego quase todo coberto por vinhas
66-70|1d8 + 2 trolls
71-75|1d3 hidras
76-80|O som de tambores a vários quilômetros de distância
81-96|1 dragão negro adulto
97-00|1 dragão negro ancião`);

add("under","1–4",`
01|1 devorador de mentes arcanista
02|1d3 + 1 serpentes venenosas gigantes
03|1d3 lagartos gigantes
04|2d4 besouros-de-fogo gigantes
05|1d8 + 1 flumphs
06|1 espreitador
07|1d12 ratos gigantes
08|2d4 kobolds
09|1d8 + 1 stirges
10|2d4 humanos (guerreiros tribais) procurando o caminho para a superfície, fugindo dos tiranos do Subterrâneo
11-12|1d10 trogloditas
13-14|1d2 limos cinzentos
15-16|3d6 stirges
17-18|1d3 mephits do magma
19-20|1d10 goblins
21-22|Grafites de orcs nas paredes, insinuando algo grosseiro sobre a mãe de alguém chamado Krusk
23-24|1 enxame de insetos
25|1 gnomo das profundezas (svirfneblin)
26-28|1d8 + 1 drows
29-30|1d4 fungos violetas
31-32|1d12 kuo-toas
33|1 monstro da ferrugem
34-35|Uma passagem com escombros espalhados, que parece ter sido desobstruída recentemente após um desmoronamento
36-37|1d8 + 1 morcegos gigantes
38-39|3d6 kobolds
40-41|2d4 grimlocks
42-43|1d4 + 3 enxames de morcegos
44|1 garimpeiro anão (batedor) procurando ouro
45|1 verme da carniça ou 1 cubo gelatinoso
46|1d8 mantos negros ou 2d4 perfuradores
47|1 cão infernal
48|1d3 espectros
49|1d4 bugbears
50|1d10 + 5 kobolds alados
51|1d4 serpentes de fogo
52|2d8 + 1 trogloditas
53|1d6 aranhas gigantes
54|3d6 kuo-toas
55|1 goblin chefe com 2d4 goblins
56|4d4 grimlocks
57|1 gosma ocre
58|2d10 centopeias gigantes
59|1 nótico ou 1 sapo gigante
60|1d4 miconides adultos com 5d4 brotos de miconide
61|1 esqueleto de minotauro ou 1 minotauro
62|3d6 drows
63|1 mímico ou 1 duplo
64|1d6 + 3 hobgoblins
65|1 devorador de intelecto ou 1 espectador
66|1d8 + 1 orcs
67-68|Batidas fracas vindas de dentro de uma parede próxima
69|1 abocanhador matraqueante ou 1 anomalia da água
70|1d12 esporos de gás
71|1 cobra constritora gigante
72|1d10 sombras
73|1d3 grells
74|1d4 inumanos
75|1d8 + 1 quaggoths servos dos esporos
76|1d2 gárgulas
77|1d4 ogros ou 1d3 ettins
78|1d4 exploradores anões (veteranos)
79-80|Uma mina abandonada, com sangue espalhado, contendo 1d3 pacotes de explorador
81|1 chuul ou 1 salamandra
82|1d4 aranhas interplanares ou 1d3 horrores de gancho
83|5d4 duergar
84|1 fantasma, 1 caveira flamejante ou 1 inumano
85|1 druida com 1 urso polar (urso das cavernas)
86|1 hobgoblin capitão com 1d4 meio-ogros e 2d10 hobgoblins
87|1 elemental da terra ou 1 pudim negro
88|1 monitor kuo-toa com 1d8 + 1 açoitadores kuo-toa
89|1 quaggoth thonot com 1d3 quaggoths
90|1 observador zumbi ou 1 naga dos ossos
91|1 orc Olho de Gruumsh com 1d4 orogs e 2d8 orcs
92|1d4 lívidos com 1d10 carniçais
93-95|Uma poça fétida onde água viscosa pinga do teto
96|1 otyugh ou 1 espreitador
97|1 cria vampírica
98|1 quimera
99|1 devorador de mentes
00|1 naga espiritual`);
add("under","5–10",`
01|3d6 enxames de morcegos
02|1d4 aranhas gigantes ou 1d4 sapos gigantes
03|1 mímico
04|2d4 limos cinzentos
05|2d10 orcs ou 3d6 trogloditas
06|3d6 grimlocks
07|1d6 + 2 mephits do magma
08|1 goblin chefe com 2d4 goblins
09|2d4 mantos negros
10|2d8 + 1 drows
11|2d10 perfuradores
12|1d4 esqueletos de minotauro
13-14|3d6 gnomos das profundezas (svirfneblin)
15|1 druida com 1 urso polar (urso das cavernas)
16-17|3d6 orcs
18|1 naga dos ossos
19-20|2d6 bugbears
21-25|Fungos fosforescentes cobrindo as paredes de uma caverna úmida, enchendo-a de luz fraca
26|2d4 espectros
27|1d12 + 4 sombras
28|1d3 abocanhadores matraqueantes
29-30|4d4 hobgoblins
31-32|1d4 vermes da carniça
33-34|1 pudim negro
35|1d4 gosmas ocres
36-40|Uma camada de mofo que ganha tons amarelados quando a luz incide sobre ela
41|1d4 nóticos
42-43|2d8 + 1 esporos de gás
44-45|1d3 cubos gelatinosos
46|1 fantasma
47-48|1 caveira flamejante
49-50|2d8 gnomos das profundezas (svirfneblin)
51|1 aparição
52|1 tribulo brutal
53|1 xorn
54|1d6 + 2 caçadores anões (veteranos) procurando trolls
55|1 hobgoblin capitão com 3d10 hobgoblins
56|1 espreitador
57|1 monitor kuo-toa com 1d4 açoitadores kuo-toa e 1d8 + 1 kuo-toas
58|1d3 anomalias da água
59|1d4 lívidos com 1d10 carniçais
60|1 otyugh
61-62|Uma caravana mercante com 1 drow arcano, 2 drows guerreiros de elite e 2d10 quaggoths
63|1d4 inumanos
64|1d4 duplos
65|2d8 serpentes de fogo
66|1d4 espectadores
67|1 orc Olho de Gruumsh com 1d4 orogs e 2d10 + 3 orcs
68|1d3 crias vampíricas
69|1d4 horrores de gancho ou 1d4 minotauros
70|3d6 quaggoths servos dos esporos
71-72|1d3 grells
73|1d6 + 1 devoradores de intelecto
74|1d10 gárgulas
75|1 observador zumbi
76-77|1 quaggoth thonot com 2d4 quaggoths
78|1d6 ettins ou 1d4 trolls
79|1d8 + 1 aranhas interplanares
80|1 fomori ou 1d3 ciclopes
81|1d4 elementais da terra
82|3d6 ogros
83|1d4 + 1 chuuls
84|1d10 cães infernais
85|1d3 drows guerreiros de elite
86|1d4 quimeras
87|1d4 salamandras
88|1 mantor
89|2d4 inumanos
90|1d4 driders
91|1 gigante do fogo
92|1 grick alfa com 2d4 gricks
93|1 devorador de mentes arcanista
94|1d4 drows arcanos
95|1 naga espiritual
96|1d4 devoradores de mentes
97|1 behir
98|1 abolete
99|1 dao ou 1 gigante de pedra
00|1 observador`);
add("under","11–16",`
01-02|3d6 vermes da carniça
03-04|1d6 + 1 cubos gelatinosos
05-06|1d8 + 2 abocanhadores matraqueantes
07-08|2d8 esqueletos de minotauro
09-10|2d6 gosmas ocres
11-12|2d4 duplos
13-14|1d4 quaggoths thonots com 1d10 + 2 quaggoths
15-16|1d3 espreitadores
17-18|3d6 gárgulas
19-20|1d10 mímicos
21-25|Uma ravina de 30 m de comprimento, 1d12 m de largura e 3d10 + 60 m de profundidade
26-27|1 hobgoblin capitão com 3d10 hobgoblins
28-29|2d4 espectadores
30-31|3d6 lívidos
32-33|2d8 devoradores de intelecto
34-35|1d3 orcs Olho de Gruumsh com 2d4 orogs e 2d10 orcs
36-40|Uma grande caverna com 2d10 estátuas extraordinariamente detalhadas de várias criaturas
41-42|1d8 + 1 monitores kuo-toa
43-44|2d4 anomalias da água
45-46|2d10 gricks
47-48|3d6 nóticos
49-50|2d8 + 1 ogros
51-52|1d6 + 2 chuuls
53-54|1d8 + 1 ettins
55|3d6 grells
56|2d4 caveiras flamejantes
57|2d12 soldados anões (veteranos) em patrulha
58|2d8 cães infernais
59|1d10 carniçais
60|3d4 inumanos
61|3d6 aranhas interplanares
62|1d8 + 1 nagas dos ossos
63-65|Um grito estridente seguido de uma risada sombria
66|1d4 quimeras
67|1d10 pudins negros
68|3d6 minotauros
69|2d4 otyughs
70|1d6 + 1 observadores zumbis
71|4d4 horrores de gancho
72|1d8 + 1 tribulos brutais
73|2d4 salamandras
74|1d3 gricks alfa
75|1d6 + 2 xorns
76-80|Uma aldeia em ruínas que pertenceu a gnomos das profundezas. Revistando, há 50% de chance de achar 1d3 poções de cura e 25% de chance de um item mágico comum aleatório
81|2d4 elementais da terra
82|1d3 nagas espirituais
83|1d3 + 1 ciclopes
84|1d6 + 2 trolls
85|2d4 gigantes de pedra
86|2d4 aparições
87|1d4 fomori
88|1d3 drows arcanos com 1d4 drows guerreiros de elite
89|1d10 crias vampíricas
90|1d3 mantores
91|1d4 gigantes do fogo
92|1 devorador de mentes arcanista com 1d6 + 1 devoradores de mentes
93|1d4 daos
94|1d8 + 1 driders
95|1d3 behirs
96|1d4 aboletes
97|1 observador
98|1 dragão vermelho das sombras jovem
99|1 tirano da morte
00|1 verme púrpura`);
add("under","17–20",`
01|1d4 gricks alfa
02|2d8 espectadores
03-04|3d6 minotauros ou 2d8 monitores kuo-toa
05-06|2d3 grells
07-08|2d10 aranhas interplanares
09-10|4d4 cães infernais
11-12|1d6 + 2 espreitadores
13-14|2d10 inumanos
15-16|3d6 duplos
17-18|1d8 + 1 quimeras
19-20|1d4 mantores
21|1d4 hobgoblins capitães com 5d10 hobgoblins
22-23|1d8 + 1 elementais da terra
24-25|2d4 crias vampíricas
26-27|3d6 minotauros
28-30|Uma pirâmide negra invertida de 9 m de altura, flutuando 30 cm acima do chão de uma grande caverna
31-32|1d10 observadores zumbis
33-34|1d4 devoradores de mentes arcanistas
35-36|1d6 + 2 otyughs
37-38|1d12 trolls
39-40|1d10 aparições
41-43|Uma bela escultura de obsidiana de uma pantera deitada no chão
44-45|1d4 drows arcanos com 1d6 drows guerreiros de elite
46-47|1d4 nagas espirituais
48-49|1d8 + 1 salamandras
50-51|2d4 tribulos brutais
52-53|1d10 xorns
54-56|1 dragão vermelho das sombras jovem
57-59|2d4 fomori
60-62|1d8 + 1 driders
63-65|1d20 + 20 aranhas rastejando pelas paredes de uma caverna cheia de teias
66-68|1d4 gigantes do fogo
69-70|1d10 devoradores de mentes
71-73|2d4 gigantes de pedra
74-76|1d12 ciclopes
77-80|A grande caverna onde fica um ídolo de Blibdoolpoolp com 15 m de altura
81-85|1d3 daos
86-90|1d4 observadores
91-93|1d4 behirs
94-96|1 tirano da morte
97-99|1d3 vermes púrpura
00|2d4 aboletes`);

add("water","1–4",`
01-10|3d6 piranhas
11-14|2d4 mephits do vapor
15-18|1d4 sahuagins
19-22|2d6 membros do povo do mar
23-25|2d4 cadáveres de marinheiros afogados, enrolados em algas marinhas
26-29|2d4 cobras constritoras
30-33|1d4 tubarões dos arrecifes
34-37|1 enxame de piranhas
38-40|Um leito de moluscos enormes
41-45|1d10 membros do povo do mar com 1d3 cavalos-marinhos gigantes
46-50|1 polvo gigante
51-55|1 sireníedeo
56-60|1 plesiossauro
61-65|2d10 talheres de bronze oxidado espalhados pelo fundo do mar
66-70|1 cobra constritora gigante
71-75|1 bruxa do mar
76-80|Um cardume adestrado de peixes prateados que atravessa a água
81-85|1d4 tubarões caçadores
86-90|1 sacerdotisa sahuagin com 2d4 sahuagins
91-96|1d4 baleias assassinas
97-98|1 tubarão gigante
99|1 elemental da água
00|1 barão sahuagin`);
add("water","5–10",`
01-02|3d6 mephits do vapor
03-04|1d10 sahuagins
05-06|1 polvo gigante
07-08|3d6 cobras constritoras
09-10|2d10 membros do povo do mar com 1d4 cavalos-marinhos gigantes
11-15|1d4 bruxas do mar
16-20|2d4 enxames de piranhas
21-25|Um galeão afundado com 50% de chance de ter um tesouro aleatório (role em Pilha de Tesouro: Desafio 5–10, capítulo 7 do Guia do Mestre)
26-30|1d4 plesiossauros
31-35|3d6 tubarões dos arrecifes
36-40|Uma batisfera abandonada
41-50|1d4 cobras constritoras gigantes
51-55|2d4 tubarões caçadores
56-60|1d3 sacerdotisas sahuagin com 2d10 sahuagins
61-65|Um castelo desocupado feito de coral
66-70|1d4 baleias assassinas
71-75|1d10 sireníedeos
76-80|Uma estátua estranha de um humanoide agachado, com asas de morcego nas costas e tentáculos saindo do rosto
81-85|1d4 elementais da água
86-90|1 barão sahuagin com 2d8 sahuagins
91-96|1d4 tubarões gigantes
97-99|1 marid
00|1 gigante da tempestade`);
add("water","11–20",`
01-10|1 barão sahuagin com 1d4 sacerdotisas sahuagin e 2d10 sahuagins
11-35|1d10 baleias assassinas
36-40|Um navio fantasma passando acima de vocês, com 2d6 + 10 fantasmas a bordo
41-60|1d6 tubarões gigantes
61-65|Uma esfera de 1,5 km de raio de água efervescente que permite a criaturas que respiram ar respirarem água enquanto estiverem dentro dela
66-75|1d10 elementais da água
76-80|Um portal cintilante verde-azulado para o Plano Elemental da Água
81-90|1d4 marids
91-96|1d3 gigantes da tempestade
97-99|1 tartaruga-dragão
00|1 kraken`);

add("urban","1–4",`
01|1d6 gatos
02-03|1 plebeu com 1d6 bodes
04-05|2d10 ratos
06|1 corvo empoleirado numa placa
07|1 plebeu num cavalo de montaria
08|2d4 mastins
09|1d2 plebeus conduzindo 1d4 mulas ou 1d4 pôneis
10|1 pseudodragão
11|1 espião
12-13|1d8 + 1 acólitos
14|1d6 + 6 cobras voadoras
15|3d6 kobolds
16|2d4 centopeias gigantes
17|1d8 + 1 esqueletos
18-19|1d6 + 2 enxames de ratos
20|1d12 zumbis
21-25|Um vendedor ambulante sobrecarregado com tachos, panelas e outros suprimentos básicos
26|1 vespa gigante
27-28|1 cavalo de guerra
29|2d8 cultistas
30-31|3d4 ratos gigantes
32|2d8 stirges
33|1d3 + 2 serpentes venenosas gigantes
34|1d4 + 2 enxames de morcegos
35|2d4 kobolds alados
36-40|Uma carroça de maçãs com uma roda quebrada atrapalhando o trânsito
41|1 crocodilo
42-43|1 enxame de insetos
44-45|3d6 bandidos
46-47|1d3 + 2 nobres a cavalo com uma escolta de 1d10 guardas
48|2d4 kenkus
49|1d6 + 2 mephits da fumaça
50|1d8 + 1 enxames de corvos
51-52|1 homem-rato
53-54|1d3 meio-ogros
55-56|1 mímico
57-58|1d4 carniçais
59-60|1d4 espectros
61-62|1d10 sombras
63-65|Alguém esvazia um penico na rua de uma janela do segundo andar
66-67|1 lívido
68-69|1 sacerdote
70-71|1 fogo-fátuo
72-73|1d3 aranhas gigantes
74-75|1d4 yuan-tis puro-sangue
76-77|2d4 rufiões
78-80|Um profeta do apocalipse pregando o fim do mundo numa esquina
81|1 cambion
82|1 cria vampírica
83|1 couatl
84|1 fantasma
85|1 súcubo ou 1 íncubo
86|1 capitão dos bandidos com 3d6 bandidos
87|1d4 + 1 fanáticos do culto
88|1 cavaleiro ou 1 veterano
89|1 anomalia da água
90|1 inumano
91|1 mago
92|1 guardião do escudo
93|1 gladiador
94|1 ressurgido
95|2d4 gárgulas
96|1d4 duplos
97|1 oni
98|1 caçador invisível
99|1d3 + 1 aranhas interplanares
00|1 assassino`);
add("urban","5–10",`
01-02|1d10 kenkus
03-04|2d6 centopeias gigantes
05-06|2d8 esqueletos
07-08|1d6 enxames de morcegos e 1d6 enxames de ratos
09-10|3d6 kobolds alados
11-13|2d4 espectros
14-16|1d4 inumanos
17-19|4d4 acólitos em cavalos de montaria
20-22|3d6 centopeias gigantes
23-25|Um diabrete tagarela, enganando os transeuntes para servir de guia na comunidade em troca de algumas pp
26-28|1d10 espiões
29-31|3d6 crocodilos
32-34|1d6 + 2 enxames de insetos
35-37|2d4 mephits da fumaça
38-40|Um nobre grita "Pega, ladrão!" para um canalha em fuga (bandido)
41-43|1 súcubo ou 1 íncubo
44-46|1d10 meio-ogros
47-49|2d10 vespas gigantes
50-51|4d10 zumbis
52-53|1d4 cavaleiros em cavalos de guerra
54-55|1d4 + 1 anomalias da água
56-57|1d8 + 1 mímicos
58-59|2d8 aranhas gigantes
60-61|3d6 sombras
62-65|Um ator se debruça numa sacada do segundo andar para chamar os transeuntes, anunciando um espetáculo
66-67|1 capitão dos bandidos com 3d8 bandidos
68-69|1d10 fogos-fátuos
70-71|2d4 sacerdotes
72-74|3d6 yuan-tis puro-sangue
75-76|2d10 rufiões
77-80|Uma vidente lê as cartas para quem pagar 1 pp
81|1d3 gladiadores
82|1d4 + 1 couatls
83|1d8 fantasmas
84|2d4 duplos
85|1d6 + 2 aranhas interplanares
86|2d4 veteranos
87|1d8 lívidos com 2d6 carniçais
88|3d6 gárgulas
89|2d10 fanáticos do culto
90|3d6 homens-rato
91|1 assassino
92|1d3 caçadores invisíveis
93|1 slaad cinza
94|1 dragão de prata jovem
95|1d4 cambions ou 1d4 ressurgidos
96|3d6 inumanos
97|1 arquimago
98|2d4 crias vampíricas ou 1d4 onis
99|1 mago com 1 guardião do escudo
00|1 rakshasa ou 1 vampiro`);
add("urban","11–16",`
01|1 mímico
02-05|1 capitão dos bandidos com 5d10 bandidos, todos em cavalos de montaria
06-10|1d10 cavaleiros em cavalos de guerra (um deles é um duplo)
11-13|1d8 súcubos ou 1d8 íncubos
14-16|3d6 fanáticos do culto
17-19|1d10 inumanos
20-22|3d6 homens-rato
23-25|Um estrondo distante seguido de uma nuvem de fumaça subindo do outro lado da comunidade
26-28|1d8 + 1 fantasmas
29-31|2d10 gárgulas
32-34|1d6 + 2 anomalias da água
35-37|1d4 + 4 fogos-fátuos
38-40|Artistas de rua num espetáculo de marionetes em que dois bonecos se batem com bastões, para diversão da multidão
41-43|2d4 couatls
44-46|2d8 lívidos
47-51|1d8 + 1 veteranos
52-55|3d4 sacerdotes
56-58|2d4 cambions
59-61|1d10 ressurgidos
62-65|2d4 aranhas interplanares
66-69|Um plebeu malvestido que mergulha num beco para comprar algo de uma figura suspeita
70-72|1d8 caçadores invisíveis
73-75|1d8 + 1 gladiadores
76-80|Dois fazendeiros brigando pelo preço das batatas (50% de chance de um deles ser um assassino aposentado)
81-82|1d4 dragões de prata jovens
83-84|1d4 assassinos
85-86|1d8 onis
87-88|1d4 magos com 1d4 guardiões do escudo
89-90|1d10 crias vampíricas
91-92|1 dragão de prata adulto
93-94|1d4 slaadi cinza
95-96|1 vampiro conjurador ou 1 vampiro guerreiro
97|1 arquimago a toda velocidade num cavalo de montaria, explodindo 1d4 guardas com magias
98|1 rakshasa
99|1 vampiro
00|1 dragão de prata ancião`);
add("urban","17–20",`
01-05|1d10 caçadores invisíveis
06-10|1d10 ressurgidos
11-14|1d6 + 2 gladiadores
15-18|2d4 cambions
19-22|2d6 súcubos ou 2d6 íncubos
23-25|Uma bruxa (arquimago) passa zunindo sobre suas cabeças numa vassoura voadora
26-30|1d4 slaadi cinza
31-35|2d8 couatls
36-40|Um pai desesperado corre até as pessoas implorando ajuda para uma criança que caiu no esgoto
41-45|1d3 dragões de prata jovens
46-50|3d6 fantasmas
51-55|1 dragão de prata adulto
56-60|1d4 magos com 1d4 guardiões do escudo
61-65|Um comerciante agressivo vende mercadorias aos transeuntes, dizendo ser o fornecedor das melhores sedas de toda a terra
66-70|1 dragão de prata ancião
71-75|3d6 crias vampíricas
76-80|Uma patrulha de 2d10 guardas marchando pela rua, procurando alguém ou alguma coisa
81-85|1d10 assassinos
86-90|1d4 + 1 slaadi cinza
91-93|1d10 onis
94-96|1 vampiro conjurador ou 1 vampiro guerreiro
97|1d4 arquimagos
98|1d3 rakshasas
99|1d4 vampiros
00|1 tarrasque`);

// Monster personality and relationships (any encounter).
T.monsterPersonality = {id:"monsterPersonality", die:"d8", title:{pt:"Personalidade dos Monstros",en:"Monster Personality"}, cols:["d8",{pt:"Personalidade",en:"Personality"}], rows:parse(`
1|Covarde; procurando se render
2|Ávido; quer tesouro
3|Frouxo; faz uma demonstração de bravura, mas corre do perigo
4|Fanático; pronto para morrer lutando
5|Receoso; mal treinado e facilmente abalado
6|Bravo; mantém a posição
7|Palhaço; irrita os inimigos
8|Valentão; se recusa a acreditar que pode perder`)};
T.monsterRelation = {id:"monsterRelation", die:"d6", title:{pt:"Relações dos Monstros",en:"Monster Relationships"}, cols:["d6",{pt:"Relacionamento",en:"Relationship"}], rows:parse(`
1|Tem um rival; quer que um aliado aleatório sofra
2|É abusado pelos outros; quer vingança e trai na primeira oportunidade
3|É adorado; os aliados morreriam por ele
4|É marginalizado pelo grupo; os aliados o ignoram
5|É marginalizado por escolha; só se preocupa consigo mesmo
6|É visto como um valentão; os aliados querem vê-lo derrotado`)};

return {ENVS, TABLES:T};
})();
