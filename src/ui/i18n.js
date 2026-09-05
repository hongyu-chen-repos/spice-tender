// Interface copy, in two languages. Spice, blend and dish names come from the
// data files, which carry both. The free-text notes on those records are
// English only for now; the generated method steps are localized below.

import { fmtTime } from '../engine/plan.js';

export const STRINGS = {
  en: {
    // tabs
    cook: 'Cook', pantry: 'Pantry', blends: 'Blends', build: 'Build', settings: 'Settings',

    // screens
    startTitleA: "Start with what's",
    startTitleB: 'already in your kitchen.',
    startIntro: 'Fifty spice blends, weighed out in grams.',
    startLede: 'Tick what you have. Then cook from them.',
    startPrompt: 'What you have', selected: 'selected',
    startMore: 'The other spices are in Pantry, whenever you want them.',
    startSave: 'Save my spices', startSkip: 'Skip for now',

    cookTitle: 'What are you cooking?',
    pantryTitle: 'Your spices',
    pantryLede: 'Tick what you have.',
    blendsTitle: 'Blends',
    buildTitle: 'Build a blend',
    buildLede: 'Pick a spice to lead it.',
    listTitle: 'Lists',
    listLede: 'Blends you saved.',
    settingsTitle: 'Settings',
    buildEntry: 'Build a blend',

    // you
    spicesOwned: 'owned', toGo: 'to go', blendsReady: 'ready',
    common: 'Common', allSpices: 'All', addBasics: (n) => `Add ${n} basics`, basicsAdded: (n) => `${n} basics added`,
    searchSpices: 'Search spices',
    settings: 'Settings', language: 'Language', langName: 'English',
    yourLists: 'Lists', clearSpices: 'Clear my spices', resetAll: 'Reset everything',
    confirm: 'Tap again to confirm', about: 'Open source.',
    brokeTitle: 'Something went wrong here.',

    // shared controls
    search: 'Search', servings: 'Servings', clear: 'Clear', all: 'All',
    nothingFound: 'Nothing matches that.',

    // pantry
    youHave: 'You have', of: 'of', spices: 'spices', dishesWord: 'dishes',
    canMakeNow: 'Ready to make', ready: 'Ready', withSwaps: 'With swaps',
    bestBuy: 'Buy this next', unlocks: 'in', blendsWord: 'blends',
    starter: 'Add the basics', emptyPantry: 'Nothing ticked yet.',
    missing: 'missing', coverage: 'covered',

    // blend
    makes: 'Makes', batch: 'Batch', byServings: 'By servings', byWeight: 'By weight',
    make: 'Make', whatYouNeed: 'What you need', inThePan: 'In the pan', details: 'Details',
    missingWord: 'missing',
    coveredAnd: (pct, n) => `${pct} covered · ${n} missing`,
    missingNamed: (names) => `Missing ${names}`,
    perServing: 'per serving', addedAt: 'Add it', heat: 'Heat', keeps: 'Keeps',
    region: 'From', goesWith: 'Good on',
    printCard: 'Print a card', addToList: 'Save', inList: 'Saved', remove: 'Remove',
    signature: "Without this it's a different blend",
    approxNote: 'Spoons are rough. Weigh it if you can.',
    driftNote: 'Rounded for a kitchen scale.',
    tooSmall: 'Too small to weigh. Smallest useful batch:',

    // substitutions
    dontHave: "You don't have this", useInstead: 'Use',
    alternatives: 'Alternatives', hideAlts: 'Hide',
    missingCount: (n, total) => `You're missing ${n} of ${total}.`,
    noSub: 'Nothing here works instead.',
    noAltAnywhere: 'Nothing here works instead.',
    nearestLine: (spice) => `Nothing you have is close. ${spice} is the nearest.`,
    betterLine: (spice, grams) => `Better, if you can buy it: ${spice}, ${grams} g.`,
    substitutesFor: 'Instead of',

    // build
    leadSpice: 'Lead spice', cuisine: 'Cuisine', anyCuisine: 'Any', stage: 'Add it',
    heatLevel: 'Heat', why: 'Why these', openAsBlend: 'Open it', notes: 'Notes',
    reset: 'Reset',
    tunedUp: (spice) => `More ${spice} than the composed balance.`,
    tunedDown: (spice) => `Less ${spice} than the composed balance.`,
    roles: { lead: 'lead', support: 'support', accent: 'accent', heat: 'heat', acid: 'acid', salt: 'salt' },

    // lists
    savedBlends: 'Saved', newList: 'New list', listName: 'Name', create: 'Create',
    rename: 'Rename', deleteList: 'Delete', defaultListName: 'My blends',
    saveTo: 'Save to', savedIn: 'In', done: 'Done',
    listEmptyOne: 'Nothing here yet.', emptyList: 'Nothing saved yet.',
    toBuy: 'To buy', alreadyHave: 'You have', buyAbout: 'buy about', total: 'Total',

    // spice sheet
    scoville: 'Scoville', potency: 'Strength', shelfLife: 'Keeps',
    whole: 'whole', ground: 'ground', dried: 'dried',
    partners: 'Often with', appearsIn: 'In', months: 'months',

    // vocabularies that appear as filter chips, group headings and tags
    cuisines: {},
    kinds: {},
    groups: { seed: 'Seeds & fruits', bark: 'Barks', root: 'Roots', flower: 'Flowers & buds',
      pepper: 'Peppers', chili: 'Chillies', herb: 'Dried herbs', allium: 'Alliums', other: 'Other' },
    qualities: { close: 'close', workable: 'works', rough: 'rough', poor: 'poor' },
    families: { warm: 'warmth', earthy: 'earth', anise: 'anise', citrus: 'citrus', floral: 'floral',
      pungent: 'bite', sour: 'sourness', green: 'green', resinous: 'pine', smoky: 'smoke',
      nutty: 'nuttiness', allium: 'onion', bitter: 'bitterness' },
    amountHints: { 'lots-more': 'Use a lot more.', twice: 'Use about twice as much.',
      'much-less': 'Use much less.', half: 'Use about half.', unsure: 'Not a close match, taste as you go.' },
    lessMore: (less, more) => {
      const line = [less && `less ${less}`, more && `more ${more}`].filter(Boolean).join(', ');
      return line.charAt(0).toUpperCase() + line.slice(1) + '.';
    },
    closeMatch: 'Close match.',
    regions: {},

    // generated labels
    stages: {
      bloom: 'in the fat, at the start', rub: 'rubbed on before cooking',
      marinade: 'in the marinade', braise: 'in the liquid',
      finish: 'at the end', table: 'at the table', steep: 'steep it, then take it out',
      any: 'whenever you like',
    },
    heatLabels: ['no chilli heat', 'barely warm', 'mild', 'medium', 'hot', 'fierce'],
    heatOther: (share, sources) => `no chilli heat, but ${share}% is ${sources}`,
    missingTag: (n) => `${n} missing`,

    // method steps, generated by the engine and worded here per language
    plan: {
      pan: 'Dry pan, no oil, medium heat. Keep it moving.',
      toast: (time, names) => `${time} — add ${names}.`,
      pull: (time) => `${time} — pull it off when it smells nutty. Tip it onto a cold plate.`,
      coolGrind: 'Let it cool for a few minutes before grinding.',
      coolJar: 'Let it cool completely before it goes in the jar.',
      grind: (target) => `Grind ${target}.`,
      grindTarget: { fine: 'fine', coarse: 'coarse', medium: 'medium' },
      stubborn: (names) => ` Break up the ${names} first.`,
      texture: (names, plural) => `Leave the ${names} coarse and stir ${plural ? 'them' : 'it'} back in at the end.`,
      prep: (names) => `Grate the ${names} separately.`,
      mixJar: 'Shake it all together in a jar.',
      mixBowl: 'Mix everything in a bowl.',
      mixStir: (names) => `Stir in the ${names} off the heat.`,
      store: (months) => `Keep it in an airtight jar somewhere dark. Use it within ${months} month${months === 1 ? '' : 's'}.`,
    },
  },

  zh: {
    cook: '做菜', pantry: '香料', blends: '配方', build: '自建', settings: '设置',

    startTitleA: '从你厨房里',
    startTitleB: '已经有的开始。',
    startIntro: '五十个香料配方，都按克配好。',
    startLede: '勾上你有的，然后照着做菜。',
    startPrompt: '你有什么', selected: '已选',
    startMore: '其余的都在香料页，什么时候加都行。',
    startSave: '存好了', startSkip: '先跳过',

    cookTitle: '你要做什么菜',
    pantryTitle: '我的香料',
    pantryLede: '勾上你有的。',
    blendsTitle: '配方',
    buildTitle: '自己配一个',
    buildLede: '选一味主香料。',
    listTitle: '清单',
    listLede: '你存下的配方。',
    settingsTitle: '设置',
    buildEntry: '自己配一个',

    spicesOwned: '已有', toGo: '还差', blendsReady: '料齐',
    common: '常用', allSpices: '全部', addBasics: (n) => `加 ${n} 味常用`, basicsAdded: (n) => `已加 ${n} 味`,
    searchSpices: '搜香料',
    settings: '设置', language: '语言', langName: '中文',
    yourLists: '清单', clearSpices: '清空香料', resetAll: '全部重置',
    confirm: '再点一次确认', about: '开源。',
    brokeTitle: '这个页面出问题了。',

    search: '搜索', servings: '人数', clear: '清空', all: '全部',
    nothingFound: '没有匹配的。',

    youHave: '已有', of: '/', spices: '种', dishesWord: '道菜',
    canMakeNow: '现在就能做', ready: '齐了', withSwaps: '可替换',
    bestBuy: '下一样买这个', unlocks: '用在', blendsWord: '个配方',
    starter: '加入常用香料', emptyPantry: '还没勾任何东西。',
    missing: '缺', coverage: '已有',

    makes: '做出', batch: '批量', byServings: '按人数', byWeight: '按重量',
    make: '做', whatYouNeed: '要准备', inThePan: '下锅', details: '细节',
    missingWord: '缺',
    coveredAnd: (pct, n) => `已有 ${pct} · 缺 ${n} 样`,
    missingNamed: (names) => `缺${names}`,
    perServing: '每人份', addedAt: '什么时候放', heat: '辣度', keeps: '保质',
    region: '来自', goesWith: '适合',
    printCard: '打印卡片', addToList: '收藏', inList: '已收藏', remove: '移除',
    signature: '少了它就不是这个味了',
    approxNote: '茶匙只是估算，能称就称。',
    driftNote: '已按厨房秤取整。',
    tooSmall: '太少了称不准，最小批量：',

    dontHave: '你没有这一味', useInstead: '换成',
    alternatives: '替代方案', hideAlts: '收起',
    missingCount: (n, total) => `${total} 味里缺 ${n} 味。`,
    noSub: '没有能替代它的。',
    noAltAnywhere: '没有能替代它的。',
    nearestLine: (spice) => `你手上没有接近的，${spice}最接近。`,
    betterLine: (spice, grams) => `要买的话，${spice}更合适，${grams} 克。`,
    substitutesFor: '替代',

    leadSpice: '主香料', cuisine: '菜系', anyCuisine: '不限', stage: '什么时候放',
    heatLevel: '辣度', why: '为什么是这几味', openAsBlend: '打开', notes: '说明',
    reset: '还原',
    tunedUp: (spice) => `${spice}比生成的比例多。`,
    tunedDown: (spice) => `${spice}比生成的比例少。`,
    roles: { lead: '主', support: '辅', accent: '点睛', heat: '辣', acid: '酸', salt: '咸' },

    savedBlends: '已存', newList: '新建清单', listName: '名称', create: '创建',
    rename: '改名', deleteList: '删除', defaultListName: '我的配方',
    saveTo: '存到', savedIn: '在', done: '完成',
    listEmptyOne: '这里还是空的。', emptyList: '还没存任何配方。',
    toBuy: '要买', alreadyHave: '你有', buyAbout: '建议买', total: '合计',

    scoville: '史高维尔', potency: '强度', shelfLife: '保质',
    whole: '整粒', ground: '粉状', dried: '干制',
    partners: '常跟它一起', appearsIn: '用在', months: '个月',

    cuisines: { american: '美式', basque: '巴斯克', caribbean: '加勒比', chinese: '中式', ethiopian: '埃塞',
      european: '欧陆', french: '法式', georgian: '格鲁吉亚', indian: '印度', italian: '意式', japanese: '日式',
      korean: '韩式', latin: '拉美', mexican: '墨西哥', 'middle-eastern': '中东', 'north-african': '北非',
      persian: '波斯', scandinavian: '北欧', spanish: '西班牙', thai: '泰式', turkish: '土耳其',
      vietnamese: '越南', 'western-china': '西北',
      african: '非洲', 'west-african': '西非', all: '通用', filipino: '菲律宾', greek: '希腊',
      hungarian: '匈牙利', indonesian: '印尼', malay: '马来', moroccan: '摩洛哥',
      polish: '波兰', 'sri-lankan': '斯里兰卡' },
    kinds: { meat: '肉', fish: '海鲜', veg: '蔬菜', legume: '豆类', grain: '主食', egg: '蛋', bread: '面点', drink: '饮品' },
    groups: { seed: '籽实类', bark: '树皮类', root: '根茎类', flower: '花蕾类',
      pepper: '胡椒类', chili: '辣椒类', herb: '干香草', allium: '葱蒜类', other: '其他' },
    qualities: { close: '很接近', workable: '能用', rough: '勉强', poor: '不合适' },
    families: { warm: '暖香', earthy: '土气', anise: '茴香', citrus: '柑橘', floral: '花香',
      pungent: '辛辣', sour: '酸', green: '青草', resinous: '松脂', smoky: '烟熏',
      nutty: '坚果', allium: '葱蒜', bitter: '苦' },
    amountHints: { 'lots-more': '用量要大得多。', twice: '用大约两倍。',
      'much-less': '用量要少得多。', half: '用一半左右。', unsure: '不太接近，边尝边加。' },
    lessMore: (less, more) => [less && `少了${less}`, more && `多了${more}`].filter(Boolean).join('，') + '。',
    closeMatch: '很接近。',
    regions: { Alsace: '阿尔萨斯', Anatolia: '安纳托利亚', 'Basque Country': '巴斯克', Bengal: '孟加拉',
      China: '中国', Egypt: '埃及', Ethiopia: '埃塞俄比亚', France: '法国', Georgia: '格鲁吉亚', Iran: '伊朗',
      Italy: '意大利', Jamaica: '牙买加', Japan: '日本', 'Kansas City': '堪萨斯城', Korea: '韩国',
      Levant: '黎凡特', Louisiana: '路易斯安那', Maryland: '马里兰', 'Modern European': '现代欧陆',
      Morocco: '摩洛哥', 'North America': '北美', 'North India': '北印度', 'Northern Europe': '北欧',
      Provence: '普罗旺斯', Puebla: '普埃布拉', Punjab: '旁遮普', Scandinavia: '斯堪的纳维亚',
      Sichuan: '四川', 'South India': '南印度', 'Southwest US': '美国西南', Spain: '西班牙',
      'Tamil Nadu': '泰米尔纳德', 'Tex-Mex': '德州墨西哥', Texas: '德州', Thailand: '泰国',
      Tunisia: '突尼斯', Vietnam: '越南', Xinjiang: '新疆', Yemen: '也门', 'Yucatán': '尤卡坦' },

    stages: {
      bloom: '开锅用油炒香', rub: '烹前干抹',
      marinade: '拌进腌料', braise: '下到汤汁里',
      finish: '起锅前放', table: '上桌蘸', steep: '泡出味后捞出来',
      any: '随时',
    },
    heatLabels: ['不辣', '微温', '微辣', '中辣', '辣', '很辣'],
    heatOther: (share, sources) => `辣椒不辣，但有 ${share}% 是${sources}`,
    missingTag: (n) => `缺 ${n} 种`,

    plan: {
      pan: '干锅不放油，中火，别停手地翻炒。',
      toast: (time, names) => `${time} — 下${names}。`,
      pull: (time) => `${time} — 闻到坚果香就出锅，倒在冷盘子里晾。`,
      coolGrind: '晾几分钟再磨。',
      coolJar: '完全晾凉后再装罐。',
      grind: (target) => `磨${target}。`,
      grindTarget: { fine: '细', coarse: '粗', medium: '中等粗细' },
      stubborn: (names) => `先把${names}敲碎。`,
      texture: (names) => `${names}留粗粒，起锅前再拌回去。`,
      prep: (names) => `${names}分开擦碎。`,
      mixJar: '都倒进罐子里摇匀。',
      mixBowl: '所有材料倒进碗里拌匀。',
      mixStir: (names) => `关火后拌入${names}。`,
      store: (months) => `装进密封罐，放在阴凉避光处，${months} 个月内用完。`,
    },
  },
};

const nameFor = (id, byId, lang) => {
  const s = byId[id];
  if (!s) return id;
  if (lang === 'zh') return s.zh || s.name;
  return s.name.toLowerCase();
};

const joinNames = (ids, byId, lang) => {
  const names = ids.map((id) => nameFor(id, byId, lang));
  if (lang === 'zh') return names.join('、');
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] || '';
};

/** The sentence for one method step, in whichever language is being read. */
export function planStepText(step, byId, lang = 'en') {
  const P = (STRINGS[lang] ?? STRINGS.en).plan;
  const names = (ids) => joinNames(ids, byId, lang);
  switch (step.kind) {
    case 'pan': return P.pan;
    case 'toast': return P.toast(fmtTime(step.at), names(step.items));
    case 'pull': return P.pull(fmtTime(step.at));
    case 'cool': return step.grinds ? P.coolGrind : P.coolJar;
    case 'grind': {
      let text = P.grind(P.grindTarget[step.target] || step.target);
      if (step.stubborn.length) text += P.stubborn(names(step.stubborn));
      return text;
    }
    case 'texture': return P.texture(names(step.items), step.items.length > 1);
    case 'prep': return P.prep(names(step.items));
    case 'mix':
      if (!step.active) return step.method === 'mix-whole' ? P.mixJar : P.mixBowl;
      return P.mixStir(names(step.items));
    case 'store': return P.store(step.months);
    default: return '';
  }
}
