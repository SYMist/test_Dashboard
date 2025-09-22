#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function findCsvPath(provided) {
  if (provided) {
    if (!fs.existsSync(provided) || !fs.statSync(provided).isFile()) {
      throw new Error(`지정한 CSV를 찾을 수 없습니다: ${provided}`);
    }
    return provided;
  }
  const candidates = [
    path.join('TEST', 'user_inquiry_dummy_database.csv'),
    'user_inquiry_dummy_database.csv',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  throw new Error("user_inquiry_dummy_database.csv not found in TEST/ or current directory");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { csv: null, out: null, mode: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--csv' && i + 1 < args.length) { opts.csv = args[++i]; }
    else if (a === '--out' && i + 1 < args.length) { opts.out = args[++i]; }
    else if (a === '--mode' && i + 1 < args.length) { opts.mode = args[++i]; }
  }
  return opts;
}

function readData(csvPath) {
  let content = fs.readFileSync(csvPath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return {
      perProductType: new Map(),
      perProductLang: new Map(),
      totals: new Map(),
      productOrder: [],
      types: [],
      langs: [],
      resvCodeCounts: new Map(),
    };
  }
  const header = lines[0].split(',').map(h => h.trim());

  let productIdx = header.findIndex(h => h.replace(/\u00A0/g, ' ').trim() === '상품 코드');
  if (productIdx === -1) throw new Error("CSV에 '상품 코드' 열을 찾을 수 없습니다.");
  let typeIdx = header.findIndex(h => h.replace(/\u00A0/g, ' ').trim() === '문의 유형');
  if (typeIdx === -1) throw new Error("CSV에 '문의 유형' 열을 찾을 수 없습니다.");
  let langIdx = header.findIndex(h => h.replace(/\u00A0/g, ' ').trim() === '언어');
  if (langIdx === -1) throw new Error("CSV에 '언어' 열을 찾을 수 없습니다.");
  let resvIdx = header.findIndex(h => h.replace(/\u00A0/g, ' ').trim() === '예약 상태');
  let resvCodeIdx = header.findIndex(h => h.replace(/\u00A0/g, ' ').trim() === '예약코드');
  let contentIdx = header.findIndex(h => h.replace(/\u00A0/g, ' ').trim() === '문의 내용');
  let reqIdx = header.findIndex(h => h.replace(/\u00A0/g, ' ').trim() === '요청 ID');
  let nameIdx = header.findIndex(h => h.replace(/\u00A0/g, ' ').trim() === '상품명');
  let createdIdx = header.findIndex(h => h.replace(/\u00A0/g, ' ').trim() === 'createdAt');
  let insightIdx = header.findIndex(h => h.replace(/\u00A0/g, ' ').trim() === '인사이트');

  const perProductType = new Map();
  const perProductLang = new Map();
  const perProductResv = new Map();
  const tri = new Map();
  const triTexts = new Map();
  const triReqs = new Map();
  const totals = new Map();
  const typeTotals = new Map();
  const langTotals = new Map();
  const resvTotals = new Map();
  const statusTypeCounts = new Map();
  const statusLangCounts = new Map();
  const statusTypeLang = new Map();
  const statusLangType = new Map();
  const typeSet = new Set();
  const langSet = new Set();
  const resvSet = new Set();
  const langTypeCounts = new Map();
  const resvCodeCounts = new Map();
  const codeToName = new Map();
  const dateCounts = new Map();
  const perProductDateCounts = new Map();
  const rawRows = [];
  let totalInquiriesCount = 0;
  let nullResvCodeCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length <= productIdx || row.length <= typeIdx || row.length <= langIdx) continue;
    const code = String((row[productIdx] || '').trim());
    const typ = String((row[typeIdx] || '').trim());
    const lang = String((row[langIdx] || '').trim());
    const content = (contentIdx !== -1 && row.length > contentIdx) ? String((row[contentIdx] || '').trim()) : '';
    const reqid = (reqIdx !== -1 && row.length > reqIdx) ? String((row[reqIdx] || '').trim()) : '';
    const name = (nameIdx !== -1 && row.length > nameIdx) ? String((row[nameIdx] || '').trim()) : '';
    const resvCodeHere = (resvCodeIdx !== -1 && row.length > resvCodeIdx) ? String((row[resvCodeIdx] || '').trim()) : '';
    const createdRaw = (createdIdx !== -1 && row.length > createdIdx) ? String((row[createdIdx] || '').trim()) : '';
    const insightRaw = (insightIdx !== -1 && row.length > insightIdx) ? String((row[insightIdx] || '').trim()) : '';
    if (!code || !typ || !lang) continue;
    if (name && !codeToName.has(code)) codeToName.set(code, name);
    if (createdRaw) {
      const d = createdRaw.slice(0, 10);
      if (d) {
        dateCounts.set(d, (dateCounts.get(d) || 0) + 1);
        if (!perProductDateCounts.has(code)) perProductDateCounts.set(code, new Map());
        const pm = perProductDateCounts.get(code);
        pm.set(d, (pm.get(d) || 0) + 1);
      }
    }
    typeSet.add(typ);
    langSet.add(lang);
    if (!perProductType.has(code)) perProductType.set(code, new Map());
    if (!perProductLang.has(code)) perProductLang.set(code, new Map());
    if (!perProductResv.has(code)) perProductResv.set(code, new Map());
    if (!tri.has(code)) tri.set(code, new Map());
    if (!triTexts.has(code)) triTexts.set(code, new Map());
    if (!triReqs.has(code)) triReqs.set(code, new Map());
    const mt = perProductType.get(code);
    const ml = perProductLang.get(code);
    const tmap = tri.get(code);
    const tTextMap = triTexts.get(code);
    const tReqMap = triReqs.get(code);
    if (!tmap.has(typ)) tmap.set(typ, new Map());
    if (!tTextMap.has(typ)) tTextMap.set(typ, new Map());
    if (!tReqMap.has(typ)) tReqMap.set(typ, new Map());
    const lmap = tmap.get(typ);
    const ltext = tTextMap.get(typ);
    const lreq = tReqMap.get(typ);
    mt.set(typ, (mt.get(typ) || 0) + 1);
    ml.set(lang, (ml.get(lang) || 0) + 1);
    if (!langTypeCounts.has(lang)) langTypeCounts.set(lang, new Map());
    const ltc = langTypeCounts.get(lang);
    ltc.set(typ, (ltc.get(typ) || 0) + 1);
    lmap.set(lang, (lmap.get(lang) || 0) + 1);
    if (!ltext.has(lang)) ltext.set(lang, []);
    if (!lreq.has(lang)) lreq.set(lang, []);
    if (content) {
      const arr = ltext.get(lang);
      if (arr.length < 20) arr.push(content);
    }
    if (reqid) {
      const arr = lreq.get(lang);
      if (arr.length < 20) arr.push(reqid);
    }
    totals.set(code, (totals.get(code) || 0) + 1);
    totalInquiriesCount += 1;
    typeTotals.set(typ, (typeTotals.get(typ) || 0) + 1);
    langTotals.set(lang, (langTotals.get(lang) || 0) + 1);
    if (resvCodeIdx !== -1 && row.length > resvCodeIdx) {
      const rcode = String((row[resvCodeIdx] || '').trim());
      if (!rcode) {
        nullResvCodeCount += 1;
      } else {
        resvCodeCounts.set(rcode, (resvCodeCounts.get(rcode) || 0) + 1);
      }
    }
    if (resvIdx !== -1 && row.length > resvIdx) {
      const status = String((row[resvIdx] || '').trim());
      resvSet.add(status);
      const mrs = perProductResv.get(code);
      mrs.set(status, (mrs.get(status) || 0) + 1);
      resvTotals.set(status, (resvTotals.get(status) || 0) + 1);
      if (!statusTypeCounts.has(status)) statusTypeCounts.set(status, new Map());
      const st = statusTypeCounts.get(status);
      st.set(typ, (st.get(typ) || 0) + 1);
      if (!statusLangCounts.has(status)) statusLangCounts.set(status, new Map());
      const sl = statusLangCounts.get(status);
      sl.set(lang, (sl.get(lang) || 0) + 1);
      if (!statusTypeLang.has(status)) statusTypeLang.set(status, new Map());
      if (!statusTypeLang.get(status).has(typ)) statusTypeLang.get(status).set(typ, new Map());
      statusTypeLang.get(status).get(typ).set(lang, (statusTypeLang.get(status).get(typ).get(lang) || 0) + 1);
      if (!statusLangType.has(status)) statusLangType.set(status, new Map());
      if (!statusLangType.get(status).has(lang)) statusLangType.get(status).set(lang, new Map());
      statusLangType.get(status).get(lang).set(typ, (statusLangType.get(status).get(lang).get(typ) || 0) + 1);
    }
    rawRows.push({ id: reqid, resvCode: resvCodeHere, productCode: code, productName: name, lang, type: typ, summary: content, createdAt: createdRaw, insight: /^true$/i.test(insightRaw) || insightRaw === '1' || insightRaw === 'TRUE' });
  }

  const ordersPath = 'product_order_dummy_database.csv';
  const orderCounts = new Map();
  const perProductOrderDateCounts = new Map();
  try {
    if (fs.existsSync(ordersPath)) {
      let oc = fs.readFileSync(ordersPath, 'utf8');
      if (oc.charCodeAt(0) === 0xFEFF) oc = oc.slice(1);
      const olines = oc.split(/\r?\n/).filter(Boolean);
      if (olines.length > 0) {
        const h = olines[0].split(',');
        let idxProd = h.findIndex(x => x.trim() === '상품 코드');
        if (idxProd === -1) idxProd = h.findIndex(x => x.replace(/\u00A0/g,' ').trim() === '상품 코드');
        let idxWhen = h.findIndex(x => x.replace(/\u00A0/g,' ').trim() === '주문 일시');
        for (let i = 1; i < olines.length; i++) {
          const row = olines[i].split(',');
          if (idxProd >= 0 && row.length > idxProd) {
            const code = String((row[idxProd] || '').trim());
            if (code) {
              orderCounts.set(code, (orderCounts.get(code) || 0) + 1);
              if (idxWhen >= 0 && row.length > idxWhen) {
                const when = String((row[idxWhen] || '').trim());
                const d = when ? when.slice(0, 10) : '';
                if (d) {
                  if (!perProductOrderDateCounts.has(code)) perProductOrderDateCounts.set(code, new Map());
                  const m = perProductOrderDateCounts.get(code);
                  m.set(d, (m.get(d) || 0) + 1);
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {}

  const productOrder = Array.from(totals.keys()).sort((a, b) => {
    const ca = totals.get(a) || 0;
    const cb = totals.get(b) || 0;
    if (cb !== ca) return cb - ca;
    const ai = Number(a), bi = Number(b);
    const an = Number.isInteger(ai), bn = Number.isInteger(bi);
    if (an && bn) return ai - bi;
    if (an) return -1;
    if (bn) return 1;
    return a.localeCompare(b);
  });

  const types = Array.from(typeSet.values()).sort((a, b) => {
    const ta = typeTotals.get(a) || 0;
    const tb = typeTotals.get(b) || 0;
    if (tb !== ta) return tb - ta;
    return a.localeCompare(b);
  });
  const langs = Array.from(langSet.values()).sort((a, b) => {
    const ta = langTotals.get(a) || 0;
    const tb = langTotals.get(b) || 0;
    if (tb !== ta) return tb - ta;
    return a.localeCompare(b);
  });
  const triObj = {};
  const textObj = {};
  const reqObj = {};
  for (const [prod, tMap] of tri.entries()) {
    triObj[prod] = {};
    textObj[prod] = {};
    reqObj[prod] = {};
    for (const [typ, lMap] of tMap.entries()) {
      triObj[prod][typ] = {};
      textObj[prod][typ] = {};
      reqObj[prod][typ] = {};
      for (const [lng, cnt] of lMap.entries()) triObj[prod][typ][lng] = cnt;
      const lTextMap = triTexts.get(prod)?.get(typ) || new Map();
      for (const [lng, arr] of lTextMap.entries()) textObj[prod][typ][lng] = Array.from(arr);
      const lReqMap = triReqs.get(prod)?.get(typ) || new Map();
      for (const [lng, arr] of lReqMap.entries()) reqObj[prod][typ][lng] = Array.from(arr);
    }
  }

  const resvStatuses = Array.from(resvSet.values()).sort((a, b) => {
    const ta = resvTotals.get(a) || 0;
    const tb = resvTotals.get(b) || 0;
    if (tb !== ta) return tb - ta;
    return (a || 'NULL').localeCompare(b || 'NULL');
  });

  const reservationNullPercent = totalInquiriesCount > 0 ? (nullResvCodeCount / totalInquiriesCount) * 100 : 0;
  const statusTypeLangObj = {};
  for (const [s, tMap] of statusTypeLang.entries()) {
    statusTypeLangObj[s] = {};
    for (const [t, lMap] of tMap.entries()) {
      statusTypeLangObj[s][t] = {};
      for (const [l, c] of lMap.entries()) statusTypeLangObj[s][t][l] = c;
    }
  }
  const statusLangTypeObj = {};
  for (const [s, lMap] of statusLangType.entries()) {
    statusLangTypeObj[s] = {};
    for (const [l, tMap] of lMap.entries()) {
      statusLangTypeObj[s][l] = {};
      for (const [t, c] of tMap.entries()) statusLangTypeObj[s][l][t] = c;
    }
  }
  const langTypeObj = {};
  for (const [l, tMap] of langTypeCounts.entries()) {
    langTypeObj[l] = {};
    for (const [t, c] of tMap.entries()) langTypeObj[l][t] = c;
  }
  const perProductDateCountsObj = {};
  for (const [k, m] of perProductDateCounts.entries()) {
    perProductDateCountsObj[k] = Object.fromEntries(m);
  }
  const perProductOrderDateCountsObj = {};
  for (const [k, m] of perProductOrderDateCounts.entries()) {
    perProductOrderDateCountsObj[k] = Object.fromEntries(m);
  }
  return { perProductType, perProductLang, perProductResv, totals, orderCounts, productOrder, types, langs, resvStatuses, statusTypeCounts, statusLangCounts, statusTypeLang: statusTypeLangObj, statusLangType: statusLangTypeObj, reservationNullPercent, langTypeObj, triObj, textObj, reqObj, resvCodeCounts, codeNameMap: Object.fromEntries(codeToName), dateCounts: Object.fromEntries(dateCounts), perProductDateCounts: perProductDateCountsObj, perProductOrderDateCounts: perProductOrderDateCountsObj, rawRows };
}

function generateHtml(data, opts = {}) {
  const { perProductType, perProductLang, perProductResv, totals, orderCounts, productOrder, types, langs, resvStatuses, statusTypeCounts, statusLangCounts, statusTypeLang, statusLangType, reservationNullPercent, langTypeObj, triObj, textObj, reqObj, resvCodeCounts, codeNameMap, dateCounts, perProductDateCounts, perProductOrderDateCounts, rawRows } = data;
  const labels = productOrder;
  const values = labels.map(k => totals.get(k) || 0);
  const orderVals = labels.map(k => (orderCounts.get(k) || 0));
  const maxInquiry = values.length ? Math.max(...values) : 0;
  const maxOrder = orderVals.length ? Math.max(...orderVals) : 0;
  const maxCount = Math.max(maxInquiry, maxOrder);
  const jsonMode = !!opts.jsonMode;

  const width = 1000;
  const heightBase = 200;
  const marginLeft = 100;
  const marginRight = 40;
  const marginTop = 30;
  const marginBottom = 40;
  const n = values.length;
  const barHeight = 22;
  const barGap = 10;
  const chartHeight = Math.max(0, n * barHeight + Math.max(0, n - 1) * barGap);
  const height = Math.max(heightBase, marginTop + chartHeight + marginBottom);
  const chartWidth = width - marginLeft - marginRight;

  const xScale = (v) => {
    if (maxCount === 0) return 0;
    return Math.round((v / maxCount) * chartWidth);
  };

  const tickCount = 5;
  const ticks = [];
  for (let i = 0; i <= tickCount; i++) {
    const val = Math.round((maxCount * i) / tickCount);
    const x = marginLeft + xScale(val);
    ticks.push({ val, x });
  }

  const palette = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc949','#af7aa1','#ff9da7','#9c755f','#bab0ab'];
  const colorOfType = (typ) => palette[types.indexOf(typ) % palette.length];
  const colorOfLang = (lng) => palette[langs.indexOf(lng) % palette.length];
  const colorOfResv = (s) => palette[resvStatuses.indexOf(s) % palette.length];

  const renderBars = (perMap, categories, colorOf, role) => labels.map((label, idx) => {
    const y = marginTop + idx * (barHeight + barGap);
    const segments = categories.map(t => ({ t, c: (perMap.get(label)?.get(t) || 0) }));
    let xCursor = marginLeft;
    const parts = [];
    for (const { t, c } of segments) {
      if (c <= 0) continue;
      const w = Math.max(1, xScale(c));
      const color = colorOf(t);
      const textX = xCursor + w / 2;
      const textY = y + barHeight / 2 + 3;
      parts.push(
        `<rect class="seg seg-${role}" data-role="${role}" data-prod="${label}" data-cat="${t}" x="${xCursor}" y="${y}" width="${w}" height="${barHeight}" fill="${color}" />`,
        `<text x="${textX}" y="${textY}" text-anchor="middle" font-size="10" fill="#111">${c}</text>`);
      xCursor += w;
    }
    // 오른쪽에 상품별 총 문의 수만 표기(‘상품 문의’ 라벨은 제외)
    const total = values[idx];
    const xEnd = marginLeft + xScale(total);
    parts.push(`<text x="${xEnd + 6}" y="${y + barHeight / 2 + 3}" text-anchor="start" font-size="10" fill="#333">${total}</text>`);
    return `<g>${parts.join('')}</g>`;
  }).join('');

  const barsSvgType = renderBars(perProductType, types, colorOfType, 'type');
  const barsSvgLang = renderBars(perProductLang, langs, colorOfLang, 'lang');
  const barsSvgResvProduct = renderBars(perProductResv, resvStatuses, colorOfResv, 'resv');
  const barsSvgOrders = labels.map((label, idx) => {
    const y = marginTop + idx * (barHeight + barGap);
    const order = orderCounts.get(label) || 0;
    if (!order) return '';
    const w = Math.max(1, xScale(order));
    const hb = Math.max(6, Math.round(barHeight * 0.35));
    const yo = y + (barHeight - hb); // bottom strip
    return `<rect class="orders-bar" data-prod="${label}" x="${marginLeft}" y="${yo}" width="${w}" height="${hb}" fill="#9ca3af" fill-opacity="0.6" />`;
  }).join('');
  const resvTotalsGlobal = resvStatuses.map(s => {
    const m = (typeof statusTypeCounts !== 'undefined' && statusTypeCounts && statusTypeCounts.get(s)) ? statusTypeCounts.get(s) : new Map();
    let sum = 0; for (const v of m.values()) sum += v; return sum;
  });
  const maxResv = resvTotalsGlobal.length ? Math.max(...resvTotalsGlobal) : 0;
  const xScaleResv = (v) => {
    if (maxResv === 0) return 0;
    return Math.round((v / maxResv) * chartWidth);
  };
  const barsSvgResv = resvStatuses.map((s, idx) => {
    const y = marginTop + idx * (barHeight + barGap);
    const c = resvTotalsGlobal[idx];
    const w = Math.max(1, xScaleResv(c));
    const color = colorOfResv(s);
    const textX = marginLeft + w / 2;
    const textY = y + barHeight / 2 + 3;
    const xEnd = marginLeft + w;
    return `
      <g>
        <rect class="seg seg-resv" data-role="resv" data-prod="GLOBAL" data-cat="${s || 'NULL'}" x="${marginLeft}" y="${y}" width="${w}" height="${barHeight}" fill="${color}" />
        <text x="${textX}" y="${textY}" text-anchor="middle" font-size="10" fill="#111">${c}</text>
        <text x="${xEnd + 6}" y="${textY}" text-anchor="start" font-size="10" fill="#333">${c}</text>
      </g>`;
  }).join('');

  const barsSvgResvTypes = resvStatuses.map((s, idx) => {
    const y = marginTop + idx * (barHeight + barGap);
    let xCursor = marginLeft;
    const parts = [];
    const stMap = (typeof statusTypeCounts !== 'undefined' && statusTypeCounts && statusTypeCounts.get(s)) ? statusTypeCounts.get(s) : new Map();
    for (const t of types) {
      const c = stMap.get(t) || 0;
      if (c <= 0) continue;
      const w = Math.max(1, Math.round((maxResv === 0 ? 0 : (c / maxResv) * chartWidth)));
      const color = colorOfType(t);
      const textX = xCursor + w / 2;
      const textY = y + barHeight / 2 + 3;
      parts.push(
        `<rect class="seg seg-resv" data-role="resv" data-status="${s || 'NULL'}" data-cat="${t}" x="${xCursor}" y="${y}" width="${w}" height="${barHeight}" fill="${color}" />`,
        `<text x="${textX}" y="${textY}" text-anchor="middle" font-size="10" fill="#111">${c}</text>`);
      xCursor += w;
    }
    const total = resvTotalsGlobal[idx];
    const xEnd = marginLeft + xScaleResv(total);
    parts.push(`<text x="${xEnd + 6}" y="${y + barHeight / 2 + 3}" text-anchor="start" font-size="10" fill="#333">${total}</text>`);
    return `<g>${parts.join('')}</g>`;
  }).join('');

  const barsSvgResvLangs = resvStatuses.map((s, idx) => {
    const y = marginTop + idx * (barHeight + barGap);
    let xCursor = marginLeft;
    const parts = [];
    const slMap = (typeof statusLangCounts !== 'undefined' && statusLangCounts && statusLangCounts.get(s)) ? statusLangCounts.get(s) : new Map();
    for (const l of langs) {
      const c = slMap.get(l) || 0;
      if (c <= 0) continue;
      const w = Math.max(1, Math.round((maxResv === 0 ? 0 : (c / maxResv) * chartWidth)));
      const color = colorOfLang(l);
      const textX = xCursor + w / 2;
      const textY = y + barHeight / 2 + 3;
      parts.push(
        `<rect class="seg seg-resv" data-role="resv" data-status="${s || 'NULL'}" data-cat="${l}" x="${xCursor}" y="${y}" width="${w}" height="${barHeight}" fill="${color}" />`,
        `<text x="${textX}" y="${textY}" text-anchor="middle" font-size="10" fill="#111">${c}</text>`);
      xCursor += w;
    }
    const total = resvTotalsGlobal[idx];
    const xEnd = marginLeft + xScaleResv(total);
    parts.push(`<text x="${xEnd + 6}" y="${y + barHeight / 2 + 3}" text-anchor="start" font-size="10" fill="#333">${total}</text>`);
    return `<g>${parts.join('')}</g>`;
  }).join('');

  const resvCount = resvStatuses.length;
  const chartHeightResv = Math.max(0, resvCount * barHeight + Math.max(0, resvCount - 1) * barGap);
  const heightResv = Math.max(160, marginTop + chartHeightResv + marginBottom);
  const yAxisMidResv = marginTop + chartHeightResv / 2;
  const xAxisSvgResv = (() => {
    const tickCount2 = 5;
    const ticks2 = [];
    for (let i = 0; i <= tickCount2; i++) {
      const val = Math.round((maxResv * i) / tickCount2);
      const x = marginLeft + (maxResv === 0 ? 0 : Math.round((val / maxResv) * chartWidth));
      ticks2.push({ val, x });
    }
    return ticks2.map(({ val, x }) => (
      `<line x1="${x}" y1="${marginTop}" x2="${x}" y2="${marginTop + chartHeightResv}" stroke="#eee" />\n` +
      `<text x="${x}" y="${marginTop + chartHeightResv + 14}" text-anchor="middle" font-size="10" fill="#666">${val}</text>`
    )).join('');
  })();

  const yLabelsProductsSvg = labels.map((label, idx) => {
    const y = marginTop + idx * (barHeight + barGap) + barHeight / 2 + 3;
    const display = (codeNameMap && codeNameMap[label]) ? codeNameMap[label] : label;
    return `<text class="prod-label" data-prod="${label}" x="${marginLeft - 8}" y="${y}" text-anchor="end" font-size="10" fill="#333" style="cursor:pointer;">${display}</text>`;
  }).join('');
  const yLabelsResvSvg = resvStatuses.map((s, idx) => {
    const y = marginTop + idx * (barHeight + barGap) + barHeight / 2 + 3;
    const label = s || 'NULL';
    return `<text x="${marginLeft - 8}" y="${y}" text-anchor="end" font-size="10" fill="#333">${label}</text>`;
  }).join('');

  const xAxisSvg = ticks.map(({ val, x }) => (
    `<line x1="${x}" y1="${marginTop}" x2="${x}" y2="${marginTop + chartHeight}" stroke="#eee" />\n` +
    `<text x="${x}" y="${marginTop + chartHeight + 14}" text-anchor="middle" font-size="10" fill="#666">${val}</text>`
  )).join('');

  const total = values.reduce((a, b) => a + b, 0);

  const ratiosItems = productOrder.map((prod) => {
    const inq = totals.get(prod) || 0;
    const ord = orderCounts.get(prod) || 0;
    const pct = ord > 0 ? (inq / ord) * 100 : null;
    return { prod, inq, ord, pct };
  });
  const ratiosHtml = ratiosItems.map(({ prod, inq, ord, pct }) => {
    const val = pct == null ? '-' : (Math.round(pct * 100) / 100).toFixed(2) + '%';
    const name = (codeNameMap && codeNameMap[prod]) ? codeNameMap[prod] : prod;
    return `<div class="ratio-item"><span class="ratio-code">${name}</span><span class="ratio-val">${val}</span><span class="ratio-detail">(${inq}/${ord})</span></div>`;
  }).join('');

  const legendHtmlType = types.map((t) => {
    const color = colorOfType(t);
    return `<div class="legend-item"><span class="swatch" style="background:${color}"></span><span>${t}</span></div>`;
  }).join('');
  const legendHtmlLang = langs.map((t) => {
    const color = colorOfLang(t);
    return `<div class="legend-item"><span class="swatch" style="background:${color}"></span><span>${t}</span></div>`;
  }).join('');
  const legendHtmlResv = resvStatuses.map((s) => {
    const color = colorOfResv(s);
    const label = s || 'NULL';
    return `<div class="legend-item"><span class="swatch" style="background:${color}"></span><span>${label}</span></div>`;
  }).join('');

  const langTypeCards = langs.map((l) => {
    const tMap = langTypeObj[l] || {};
    const totalL = Object.values(tMap).reduce((a,b)=>a+b, 0);
    const ranked = types
      .map(t => ({ t, c: tMap[t] || 0 }))
      .filter(x => x.c > 0)
      .sort((a,b) => b.c - a.c);
    const list = ranked.map((x, i) => {
      const pct = totalL ? Math.round((x.c / totalL) * 100) : 0;
      return `<div class="lt-item">
        ${i+1}위 - ${x.t} (${pct}%)
      </div>`;
    }).join('');
    return `<div class="lt-card"><div class="lt-card-title">${l}</div><div class="lt-list">
      ${list || '<div class="lt-item">데이터 없음</div>'}
    </div></div>`;
  }).join('');

  const html = 
`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>상품 기반 분석 대시보드</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif; margin: 20px; color: #222; }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    .muted { color: #6b7280; font-size: 12px; }
    .scroll-y { overflow-y: auto; max-height: 600px; position: relative; }
    .legend { display:flex; flex-wrap:wrap; justify-content:center; gap: 10px 18px; padding-top: 10px; }
    .legend-item { display:flex; align-items:center; gap:8px; font-size:12px; color:#444; }
    .swatch { width:12px; height:12px; border-radius:3px; display:inline-block; }
    .tabs { display:flex; gap:8px; margin: 10px 0 6px; }
    .tab { padding:6px 10px; border:1px solid #e5e7eb; border-radius:8px; background:#fff; font-size:12px; cursor:pointer; }
    .tab.active { background:#111827; color:#fff; border-color:#111827; }
    .hidden { display:none; }
    .product-tooltip { position:absolute; z-index: 1200; background:#fff; color:#111; border:1px solid #e5e7eb; border-radius:12px; padding:16px; box-shadow: 0 10px 30px rgba(15,23,42,0.18); width: 100%; max-width: 1000px; }
    .pie-tooltip { position: fixed; z-index: 1000; background:#fff; color:#111; border:1px solid #e5e7eb; border-radius:10px; padding:10px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); width: 320px; max-width: 90vw; }
    .bar-detail { position:absolute; z-index: 2; background:#fff; color:#111; border:1px solid #e5e7eb; border-radius:10px; padding:12px; box-shadow: 0 6px 24px rgba(0,0,0,0.12); width: 720px; max-width: calc(100% - 140px); }
    .bar-detail-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    .bar-detail-title { font-size:13px; font-weight:600; color:#374151; }
    .bar-detail-close { font-size:12px; color:#6b7280; background:transparent; border:none; cursor:pointer; padding:4px 6px; }
    .bar-detail-body { max-height: 380px; overflow-y: auto; padding-right: 4px; }
    .pie-title { font-size:12px; color:#374151; margin-bottom:6px; }
    .pie-legend { display:flex; flex-wrap:wrap; gap:8px 12px; margin-top:8px; }
    .pie-legend-item { display:flex; align-items:center; gap:6px; font-size:11px; color:#444; }
    .pie-contents { margin-top:10px; border-top:1px dashed #e5e7eb; padding-top:8px; }
    .pie-contents-title { font-size:12px; color:#374151; margin-bottom:6px; }
    .pie-contents-list { max-height: 140px; overflow:auto; display:block; }
    .pie-contents-list li { font-size:11px; color:#374151; line-height:1.4; margin: 0 0 4px 16px; }
    .ratios { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
    .ratios-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px 12px; max-height: 260px; overflow-y: auto; }
    .ratio-item { font-size: 12px; color:#374151; display:flex; align-items:center; gap:6px; }
    .ratio-code { font-weight:600; color:#111827; }
    .ratio-val { min-width: 64px; text-align:right; font-variant-numeric: tabular-nums; }
    .ratio-detail { color:#6b7280; font-size:11px; }
    .lang-type-section { margin-top: 14px; }
    .lang-type-title { font-size:12px; color:#374151; margin-bottom:6px; }
    .lt-cards { display:flex; gap:12px; overflow-x:auto; padding-bottom: 4px; }
    .lt-card { min-width: 200px; border:1px solid #e5e7eb; border-radius:10px; padding:10px; background:#fff; }
    .lt-card-title { font-size:12px; font-weight:600; color:#374151; margin-bottom:6px; }
    .lt-list { display:flex; flex-direction:column; gap:4px; }
    .lt-item { font-size:12px; color:#374151; }
    .line-chart-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:8px; }
    .line-chart-title { font-size:13px; font-weight:600; color:#374151; }
    .date-toolbar { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:center; margin:6px 0; font-size:12px; }
    .date-toolbar label { display:flex; align-items:center; gap:6px; color:#374151; }
    .date-toolbar .sep { color:#6b7280; }
    .date-toolbar input[type="date"], .date-toolbar input[type="text"], .date-toolbar select { font-size:12px; padding:4px 6px; border:1px solid #e5e7eb; border-radius:6px; background:#fff; color:#111; }
  </style>
  <meta name="color-scheme" content="light dark">
  <style media="(prefers-color-scheme: dark)">
    body { background: #0b0f19; color: #e5e7eb; }
    .card { background: #0d1323; border-color: #1f2937; }
    .muted { color: #9ca3af; }
    .legend-item { color:#d1d5db; }
    .tab { background:#0d1323; border-color:#1f2937; color:#d1d5db; }
    .tab.active { background:#2563eb; border-color:#2563eb; color:#fff; }
    .pie-tooltip { background:#0d1323; color:#e5e7eb; border-color:#1f2937; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
    .pie-title { color:#d1d5db; }
    .pie-legend-item { color:#d1d5db; }
    .pie-contents { border-top-color:#1f2937; }
    .pie-contents-title { color:#d1d5db; }
    .pie-contents-list li { color:#d1d5db; }
    .bar-detail { background:#0d1323; color:#e5e7eb; border-color:#1f2937; box-shadow: 0 6px 24px rgba(0,0,0,0.35); }
    .bar-detail-title { color:#e5e7eb; }
    .bar-detail-close { color:#9ca3af; }
    .pie-tooltip { background:#0d1323; color:#e5e7eb; border-color:#1f2937; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
    .pie-title { color:#d1d5db; }
    .pie-legend-item { color:#d1d5db; }
    .product-tooltip { background:#0d1323; color:#e5e7eb; border-color:#1f2937; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
    .ratios { border-top-color:#1f2937; }
    .ratio-item { color:#d1d5db; }
    .ratio-code { color:#e5e7eb; }
    .ratio-detail { color:#9ca3af; }
    .lang-type-title { color:#d1d5db; }
    .lt-card { background:#0d1323; border-color:#1f2937; }
    .lt-card-title { color:#e5e7eb; }
    .lt-item { color:#d1d5db; }
    .line-chart-title { color:#e5e7eb; }
    .date-toolbar label { color:#d1d5db; }
    .date-toolbar .sep { color:#9ca3af; }
    .date-toolbar input[type="date"], .date-toolbar input[type="text"], .date-toolbar select { background:#0d1323; color:#e5e7eb; border-color:#1f2937; }
  </style>
</head>
<body>
  <div class="container">
    <div class="date-toolbar" aria-label="기간 및 정렬 선택" role="group">
      <label for="filter-start">기간
        <input type="date" id="filter-start" name="filter-start" />
        <span class="sep">~</span>
        <input type="date" id="filter-end" name="filter-end" />
      </label>
      <label for="filter-product">상품 검색
        <input type="text" id="filter-product" name="filter-product" placeholder="상품명 또는 코드" />
      </label>
      <button id="filter-apply" class="tab" type="button" aria-label="필터 적용">적용</button>
    </div>
    <div id="date-activity-card" class="card" style="margin-bottom:12px;">
      <div class="line-chart-header">
        <div class="line-chart-title">일자 별 문의 수</div>
        <div id="tabs-date" class="tabs" role="tablist" style="margin:0; margin-left:auto;">
          <button id="tab-date-d" class="tab active" role="tab" aria-selected="true">일 기준</button>
          <button id="tab-date-m" class="tab" role="tab" aria-selected="false">월 기준</button>
          <button id="tab-date-q" class="tab" role="tab" aria-selected="false">분기 기준</button>
          <button id="tab-date-h" class="tab" role="tab" aria-selected="false">반기 기준</button>
          <button id="tab-date-y" class="tab" role="tab" aria-selected="false">연 기준</button>
        </div>
      </div>
      <div id="date-activity-meta" class="line-chart-meta" style="margin-bottom:6px;"></div>
      <svg id="chart-date-activity" class="line-chart-svg" width="1000" height="220" viewBox="0 0 1000 220"></svg>
      <div class="card" id="inquiries-table-card" style="margin-top:10px;">
        <div class="line-chart-header" style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">
          <div class="line-chart-title">최근 문의 표</div>
          <div style="margin-left:auto; display:flex; gap:8px; align-items:center;">
            <input id="inq-search" type="text" placeholder="검색 (상품/코드/내용)" style="font-size:12px; padding:4px 6px; border:1px solid #e5e7eb; border-radius:6px;" />
            <label style="font-size:12px; display:flex; align-items:center; gap:6px;">
              정렬
              <select id="inq-sort" style="font-size:12px; padding:4px 6px; border:1px solid #e5e7eb; border-radius:6px;">
                <option value="date_desc" selected>최신순</option>
                <option value="date_asc">오래된순</option>
              </select>
            </label>
          </div>
        </div>
        <div class="scroll-y" style="max-height: 320px;">
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr style="background:#f9fafb; border-bottom:1px solid #e5e7eb;">
                <th style="text-align:left; padding:6px 8px; border-right:1px solid #f1f5f9;">Created_at</th>
                <th style="text-align:left; padding:6px 8px; border-right:1px solid #f1f5f9;">요청 ID</th>
                <th style="text-align:left; padding:6px 8px; border-right:1px solid #f1f5f9;">예약코드</th>
                <th style="text-align:left; padding:6px 8px; border-right:1px solid #f1f5f9;">상품 코드</th>
                <th style="text-align:left; padding:6px 8px; border-right:1px solid #f1f5f9;">상품명</th>
                <th style="text-align:left; padding:6px 8px; border-right:1px solid #f1f5f9;">언어</th>
                <th style="text-align:left; padding:6px 8px; border-right:1px solid #f1f5f9;">문의 유형</th>
                <th style="text-align:left; padding:6px 8px;">문의 내용</th>
              </tr>
            </thead>
            <tbody id="inquiries-tbody"></tbody>
          </table>
        </div>
        <div id="inquiries-pagination" style="display:flex; gap:6px; justify-content:flex-end; padding-top:6px;"></div>
      </div>
      </div>
    <h1 id="page-title">상품 기반 분석</h1>
    <div id="chart-desc" class="muted">X축: 건수 · Y축: 상품명 (총 ${total})</div>
    <div class="tabs" role="tablist" style="margin-bottom:6px; gap:8px;">
      <button id="tab-anal-product" class="tab active" role="tab" aria-selected="true">상품 기반 분석</button>
    </div>
    <div id="resv-null-summary" class="muted hidden" style="margin: 6px 0 2px;">비예약 문의 비율: ${reservationNullPercent.toFixed(2)}%</div>
    <div id="tabs-dimension" class="tabs" role="tablist">
      <button id="tab-type" class="tab active" role="tab" aria-selected="true">문의 유형</button>
      <button id="tab-lang" class="tab" role="tab" aria-selected="false">언어</button>
    </div>
    <div class="card" style="margin-top:12px;">
      <div class="scroll-y" id="scroll-products">
      <div id="tabs-prod-dimension" class="tabs" role="tablist" style="margin: 6px 0 6px; align-items:center;">
        <button id="tab-prod-type" class="tab active" role="tab" aria-selected="true">문의 유형</button>
        <button id="tab-prod-lang" class="tab" role="tab" aria-selected="false">언어</button>
        <label id="toggle-orders-wrap" style="margin-left:auto; font-size:12px; display:flex; align-items:center; gap:6px;">
          <input type="checkbox" id="toggle-orders" /> 주문량 보기
        </label>
        <label style="font-size:12px; display:flex; align-items:center; gap:6px;">
          정렬
          <select id="sort-prod" name="sort-prod">
            <option value="desc" selected>문의 많은 순</option>
            <option value="asc">문의 적은 순</option>
          </select>
        </label>
      </div>
      <svg id="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-ml="${marginLeft}" data-barh="${barHeight}">
        <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
        <text id="y-axis-label" x="16" y="${marginTop + chartHeight / 2}" transform="rotate(-90 16,${marginTop + chartHeight / 2})" text-anchor="middle" font-size="12" fill="#666">상품명</text>
        <text x="${marginLeft + chartWidth / 2}" y="${marginTop + chartHeight + 28}" text-anchor="middle" font-size="12" fill="#666">건수</text>
        <line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${marginTop + chartHeight}" stroke="#9ca3af" stroke-width="1" />
        <line x1="${marginLeft}" y1="${marginTop + chartHeight}" x2="${marginLeft + chartWidth}" y2="${marginTop + chartHeight}" stroke="#9ca3af" stroke-width="1" />
        ${xAxisSvg}
        <g id="bars-type">${barsSvgType}</g>
        <g id="bars-lang" style="display:none">${barsSvgLang}</g>
        <g id="bars-resv" style="display:none">${typeof barsSvgResvTypes !== 'undefined' ? barsSvgResvTypes : barsSvgResv}</g>
        <g id="bars-resv-product" style="display:none">${barsSvgResvProduct}</g>
        <g id="bars-orders" style="display:none">${barsSvgOrders}</g>
        <g id="ylabels-products">${yLabelsProductsSvg}</g>
        <g id="ylabels-resv" style="display:none">${yLabelsResvSvg}</g>
      </svg>
      <div id="bar-detail" class="bar-detail hidden"></div>
      </div>
      <div class="scroll-y hidden" id="scroll-resv">
        <div id="tabs-resv-dimension" class="tabs" role="tablist" style="margin: 6px 0 6px; align-items:center;">
          <button id="tab-resv-type" class="tab active" role="tab" aria-selected="true">문의 유형</button>
          <button id="tab-resv-lang" class="tab" role="tab" aria-selected="false">언어</button>
          <label style="margin-left:auto; font-size:12px; display:flex; align-items:center; gap:6px;">
            정렬
            <select id="sort-resv" name="sort-resv">
              <option value="desc" selected>문의 많은 순</option>
              <option value="asc">문의 적은 순</option>
            </select>
          </label>
        </div>
        <svg id="chart-resv" width="${width}" height="${heightResv}" viewBox="0 0 ${width} ${heightResv}">
          <rect x="0" y="0" width="${width}" height="${heightResv}" fill="transparent" />
          <text x="16" y="${yAxisMidResv}" transform="rotate(-90 16,${yAxisMidResv})" text-anchor="middle" font-size="12" fill="#666">예약 상태</text>
          <text x="${marginLeft + chartWidth / 2}" y="${marginTop + chartHeightResv + 28}" text-anchor="middle" font-size="12" fill="#666">건수</text>
          <line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${marginTop + chartHeightResv}" stroke="#9ca3af" stroke-width="1" />
          <line x1="${marginLeft}" y1="${marginTop + chartHeightResv}" x2="${width - marginRight}" y2="${marginTop + chartHeightResv}" stroke="#9ca3af" stroke-width="1" />
          ${xAxisSvgResv}
          <g id="bars-resv-types">${barsSvgResvTypes}</g>
          <g id="bars-resv-langs" style="display:none">${barsSvgResvLangs}</g>
        ${yLabelsResvSvg}
        </svg>
      </div>
      <div id="legend-type" class="legend">${legendHtmlType}</div>
      <div id="legend-lang" class="legend hidden">${legendHtmlLang}</div>
      <div id="legend-resv" class="legend hidden">${legendHtmlResv}</div>
    </div>
    <div id="resv-ratios-card" class="card hidden" style="margin-top:12px;">
      <div class="muted" style="margin-bottom:6px; display:flex; align-items:center; gap:8px;">상품 별 주문 대비 문의 비율
        <label style="margin-left:auto; font-size:12px; display:flex; align-items:center; gap:6px;">
          정렬
          <select id="sort-ratios" name="sort-ratios">
            <option value="desc" selected>문의 많은 순</option>
            <option value="asc">문의 적은 순</option>
          </select>
        </label>
      </div>
      <div id="resv-ratios" class="ratios">
        <div class="ratios-grid">${ratiosHtml}</div>
      </div>
    </div>
    <div id="resv-langtype-card" class="card hidden" style="margin-top:12px;">
      <div class="muted" style="margin-bottom:6px;">언어별 문의 유형 분포</div>
      <div class="lang-type-section">
        <div class="lt-cards">${langTypeCards}</div>
      </div>
    </div>
    <div class="card hidden" id="resv-code-chart-card" style="margin-top:12px;">
      <div class="line-chart-header" style="display:flex; align-items:center;">
        <div class="line-chart-title">예약코드 별 문의 수</div>
        <label style="margin-left:auto; font-size:12px; display:flex; align-items:center; gap:6px;">
          정렬
          <select id="sort-resv-code" name="sort-resv-code">
            <option value="desc" selected>문의 많은 순</option>
            <option value="asc">문의 적은 순</option>
          </select>
        </label>
      </div>
      <div class="scroll-y" id="scroll-resv-code">
        <svg id="chart-resv-code" width="1000" height="400" viewBox="0 0 1000 400"></svg>
      </div>
    </div>
  </div>
  <div id="pie-tooltip" class="pie-tooltip hidden"></div>
  <div id="product-tooltip" class="product-tooltip hidden"></div>
  <script>
    (function(){
      const DATA = ${JSON.stringify({ types, langs, productOrder: labels, tri: triObj, texts: textObj, reqs: reqObj, statusTypeLang, statusLangType, resvCodeCounts: Object.fromEntries(resvCodeCounts), codeNameMap: (codeNameMap || {}), dateCounts, perProductDateCounts, orderCounts: Object.fromEntries(orderCounts), perProductOrderDateCounts, rawRows })};
      const TOTAL = ${total};

      const tabAnalProduct = document.getElementById('tab-anal-product');
      const tabAnalResv = document.getElementById('tab-anal-resv');
      const tabType = document.getElementById('tab-type');
      const tabLang = document.getElementById('tab-lang');
      const tabsDimension = document.getElementById('tabs-dimension');
      const barsType = document.getElementById('bars-type');
      const barsLang = document.getElementById('bars-lang');
      const barsResv = document.getElementById('bars-resv');
      const barsResvProduct = document.getElementById('bars-resv-product');
      const barsOrders = document.getElementById('bars-orders');
      const ylabelsProducts = document.getElementById('ylabels-products');
      const ylabelsResv = document.getElementById('ylabels-resv');
      const scrollProducts = document.getElementById('scroll-products');
      const scrollResv = document.getElementById('scroll-resv');
      const resvRatiosCard = document.getElementById('resv-ratios-card');
      const resvLangTypeCard = document.getElementById('resv-langtype-card');
      const resvCodeChartCard = document.getElementById('resv-code-chart-card');
      const tabProdType = document.getElementById('tab-prod-type');
      const tabProdLang = document.getElementById('tab-prod-lang');
      const legendType = document.getElementById('legend-type');
      const legendLang = document.getElementById('legend-lang');
      const legendResv = document.getElementById('legend-resv');
      const yAxisLabel = document.getElementById('y-axis-label');
      const pie = document.getElementById('pie-tooltip');
      const prodTip = document.getElementById('product-tooltip');
      function hideProductTip(){ if (prodTip) { prodTip.classList.add('hidden'); prodTip.innerHTML = ''; } }
      const pageTitle = document.getElementById('page-title');
      const chartDesc = document.getElementById('chart-desc');
      const detail = document.getElementById('bar-detail');
      const svg = document.getElementById('chart');
      const toggleOrders = document.getElementById('toggle-orders');

      function renderDateActivity(mode) {
        const container = document.getElementById('chart-date-activity');
        if (!container || !DATA.dateCounts) return;
        const dayEntries = Object.entries(DATA.dateCounts);
        if (!dayEntries.length) { container.innerHTML = ''; return; }

        function pad2(n){ return (n < 10 ? '0' : '') + n; }
        function groupEntries(entries, mode){
          const map = new Map();
          for (const [d, c0] of entries) {
            const c = Number(c0) || 0;
            const y = Number(d.slice(0,4));
            const m = Number(d.slice(5,7));
            let key = d;
            if (mode === 'm') key = y + '-' + pad2(m);
            else if (mode === 'q') { const q = Math.floor((m-1)/3)+1; key = y + '-Q' + q; }
            else if (mode === 'h') { const h = (m <= 6) ? 'H1' : 'H2'; key = y + '-' + h; }
            else if (mode === 'y') key = String(y);
            // default 'd' keeps YYYY-MM-DD
            map.set(key, (map.get(key) || 0) + c);
          }
          const labels = Array.from(map.keys());
          labels.sort(function(a,b){
            if (mode === 'd' || mode === 'm' || mode === 'y') return String(a).localeCompare(String(b));
            // q/h need custom within year
            const ay = Number(String(a).slice(0,4));
            const by = Number(String(b).slice(0,4));
            if (ay !== by) return ay - by;
            if (mode === 'q') {
              const aq = Number(String(a).match(/Q(\d)/)?.[1] || 0);
              const bq = Number(String(b).match(/Q(\d)/)?.[1] || 0);
              return aq - bq;
            } else {
              const ah = String(a).includes('H1') ? 1 : 2;
              const bh = String(b).includes('H1') ? 1 : 2;
              return ah - bh;
            }
          });
          const vals = labels.map(l => map.get(l) || 0);
          return { labels, values: vals };
        }

        const modeSafe = (mode === 'm' || mode === 'q' || mode === 'h' || mode === 'y') ? mode : 'd';
        const grouped = groupEntries(dayEntries, modeSafe);
        const labels = grouped.labels;
        const values = grouped.values;
        const minDate = labels[0];
        const maxDate = labels[labels.length - 1];
        const total = values.reduce(function(a,b){ return a+b; }, 0);
        const unitMap = { d: '일', m: '월', q: '분기', h: '반기', y: '연' };
        const meta = document.getElementById('date-activity-meta');
        if (meta) meta.textContent = '단위: ' + unitMap[modeSafe] + ' · 기간: ' + minDate + ' ~ ' + maxDate + ' · 총 ' + total;

        const width = 1000, height = 220;
        const marginLeft = 50, marginRight = 20, marginTop = 20, marginBottom = 28;
        const chartWidth = width - marginLeft - marginRight;
        const chartHeight = height - marginTop - marginBottom;
        const maxVal = values.length ? Math.max.apply(null, values) : 0;
        const xi = function(i){ if (labels.length <= 1) return marginLeft; return marginLeft + Math.round((i/(labels.length-1)) * chartWidth); };
        const yi = function(v){ if (maxVal === 0) return marginTop + chartHeight; return marginTop + (chartHeight - Math.round((v/maxVal) * chartHeight)); };
        let d = '';
        for (let i = 0; i < labels.length; i++) {
          const x = xi(i), y = yi(values[i]);
          d += (i === 0 ? 'M ' : ' L ') + x + ' ' + y;
        }
        const ticks = 5;
        const xTicks = [];
        for (let i = 0; i <= ticks; i++) {
          const idx = Math.round((labels.length - 1) * (i / ticks));
          xTicks.push({ x: xi(idx), label: labels[idx] });
        }
        let xAxis = '';
        for (const t of xTicks) {
          xAxis += '<line x1="' + t.x + '" y1="' + (marginTop + chartHeight) + '" x2="' + t.x + '" y2="' + (marginTop + chartHeight + 4) + '" stroke="#9ca3af" />'
                 + '<text x="' + t.x + '" y="' + (marginTop + chartHeight + 16) + '" text-anchor="middle" font-size="10" fill="#666">' + t.label + '</text>';
        }
        let yAxis = '';
        for (let i = 0; i <= ticks; i++) {
          const val = Math.round((maxVal * i) / ticks);
          const y = yi(val);
          yAxis += '<line x1="' + marginLeft + '" y1="' + y + '" x2="' + (marginLeft + chartWidth) + '" y2="' + y + '" stroke="#eee" />'
                 + '<text x="' + (marginLeft - 6) + '" y="' + (y + 3) + '" text-anchor="end" font-size="10" fill="#666">' + val + '</text>';
        }
        const content = '' +
          '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="transparent" />' +
          '<path d="' + d + '" fill="none" stroke="#2563eb" stroke-width="2" />' +
          '<line x1="' + marginLeft + '" y1="' + (marginTop + chartHeight) + '" x2="' + (marginLeft + chartWidth) + '" y2="' + (marginTop + chartHeight) + '" stroke="#9ca3af" />' +
          xAxis + yAxis;
        container.innerHTML = content;
        // render simple table under chart
        try {
          const tbody = document.getElementById('inquiries-tbody');
          if (tbody) {
            const list = (DATA.rows || []).slice(0,10);
            tbody.innerHTML = list.map(function(r){
              const cols = [r.id||'', r.resvCode||'', r.productCode||'', (DATA.codeNameMap&&DATA.codeNameMap[r.productCode])?DATA.codeNameMap[r.productCode]:(r.productName||''), r.lang||'', r.type||'', (r.summary||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')];
              return '<tr>'+cols.map((c,i)=>'<td style="padding:6px 8px; border-bottom:1px solid #f1f5f9;'+(i<6?' border-right:1px solid #f1f5f9;':'')+'">'+c+'</td>').join('')+'</tr>';
            }).join('');
          }
        } catch (e) {}

        // Hover tooltip on top date chart
        try {
          const svg = document.getElementById('chart-date-activity');
          const xs = labels.map((_, i) => xi(i));
          svg.onmousemove = function(e){
            if (!pie) return;
            const rect = svg.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            let idx = 0, best = Infinity;
            for (let i = 0; i < xs.length; i++) { const dx = Math.abs(xs[i] - cx); if (dx < best) { best = dx; idx = i; } }
            pie.innerHTML = '<div class="pie-title">' + labels[idx] + '</div><div class="pie-contents">건수: ' + values[idx] + '</div>';
            pie.style.left = (e.clientX + 12) + 'px';
            pie.style.top = (e.clientY + 12) + 'px';
            pie.classList.remove('hidden');
          };
          svg.onmouseleave = function(){ if (pie) pie.classList.add('hidden'); };
        } catch (e) {}
        // Render inquiries table under chart (client-side pagination + search/sort)
        try {
          const tbody = document.getElementById('inquiries-tbody');
          const pag = document.getElementById('inquiries-pagination');
          const q = document.getElementById('inq-search');
          const sortSel = document.getElementById('inq-sort');
          if (!tbody || !pag) return;
          let page = 1; const SIZE = 10;
          function normalize(s){ return (s||'').toString().toLowerCase(); }
          function renderTable(){
            const rows = (DATA.rawRows || []).slice();
            const term = normalize(q ? q.value : '');
            let filtered = term ? rows.filter(function(r){
              const name = (DATA.codeNameMap && DATA.codeNameMap[r.productCode]) ? DATA.codeNameMap[r.productCode] : (r.productName||'');
              return normalize(r.productCode).includes(term) || normalize(name).includes(term) || normalize(r.summary).includes(term);
            }) : rows;
            const mode = sortSel ? sortSel.value : 'date_desc';
            filtered.sort(function(a,b){
              const da = new Date(a.createdAt||''); const db = new Date(b.createdAt||'');
              if (mode==='date_asc') return da - db;
              return db - da;
            });
            const totalPages = Math.max(1, Math.ceil(filtered.length / SIZE));
            if (page > totalPages) page = totalPages;
            const slice = filtered.slice((page-1)*SIZE, page*SIZE);
            tbody.innerHTML = slice.map(function(r){
              const name = (DATA.codeNameMap&&DATA.codeNameMap[r.productCode])?DATA.codeNameMap[r.productCode]:(r.productName||'');
              const idLink = r.id ? '<a href="#" data-reqid="'+r.id+'">'+r.id+'</a>' : '';
              const resvLink = r.resvCode ? '<a href="#" data-resv="'+r.resvCode+'">'+r.resvCode+'</a>' : '';
              const created = (r.createdAt||'').slice(0,10);
              const cols = [created, idLink, resvLink, r.productCode||'', name, r.lang||'', r.type||'', (r.summary||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')];
              return '<tr>'+cols.map(function(c,i){ return '<td style="padding:6px 8px; border-bottom:1px solid #f1f5f9;'+(i<7?' border-right:1px solid #f1f5f9;':'')+'">'+c+'</td>'; }).join('')+'</tr>';
            }).join('');
            let buttons = '';
            const prevDis = (page<=1) ? 'disabled' : '';
            const nextDis = (page>=totalPages) ? 'disabled' : '';
            buttons += '<button class="tab" type="button" data-page="prev" '+prevDis+'>이전</button>';
            const win = 3;
            for (let p=1; p<=Math.min(totalPages, win); p++) {
              const cur = (p===page) ? ' aria-current="true"' : '';
              buttons += '<button class="tab" type="button" data-page="'+p+'"'+cur+'>'+p+'</button>';
            }
            buttons += '<button class="tab" type="button" data-page="next" '+nextDis+'>다음</button>';
            pag.innerHTML = buttons;
          }
          pag.onclick = function(e){
            const b = e.target.closest('button[data-page]'); if (!b) return;
            const val = b.getAttribute('data-page');
            if (val==='prev') page = Math.max(1, page-1);
            else if (val==='next') page = page+1;
            else page = Number(val)||1;
            renderTable();
          };
          if (q) q.oninput = function(){ page=1; renderTable(); };
          if (sortSel) sortSel.onchange = function(){ page=1; renderTable(); };
          renderTable();
        } catch (e) {}
      }

      function renderResvCodeChart(mode) {
        const container = document.getElementById('chart-resv-code');
        // entries: [code, count]
        const entries = Object.entries(DATA.resvCodeCounts || {});
        entries.sort(function(a,b){
          var ca = Number(a[1]) || 0;
          var cb = Number(b[1]) || 0;
          if (mode === 'asc') { if (ca !== cb) return ca - cb; }
          else { if (cb !== ca) return cb - ca; }
          return String(a[0]).localeCompare(String(b[0]));
        });
        const resvCodeLabels = entries.map(function(e){ return e[0]; });
        const resvCodeValues = entries.map(function(e){ return e[1]; });
        const maxCount = resvCodeValues.length > 0 ? Math.max.apply(null, resvCodeValues) : 0;
        const n = resvCodeLabels.length;
        const barHeight = 22;
        const barGap = 10;
        const marginLeft = 100;
        const marginRight = 40;
        const marginTop = 30;
        const marginBottom = 40;
        const width = 1000;
        const chartHeight = Math.max(0, n * barHeight + Math.max(0, n - 1) * barGap);
        const height = Math.max(200, marginTop + chartHeight + marginBottom);
        const chartWidth = width - marginLeft - marginRight;

        container.setAttribute('height', String(height));
        container.setAttribute('viewBox', '0 0 ' + width + ' ' + height);

        const xScale = function(v){ return (maxCount === 0 ? 0 : Math.round((v / maxCount) * chartWidth)); };

        const ticks = [];
        const tickCount = 5;
        for (let i = 0; i <= tickCount; i++) {
          const val = Math.round((maxCount * i) / tickCount);
          const x = marginLeft + xScale(val);
          ticks.push({ val: val, x: x });
        }

        const xAxisSvg = ticks.map(function(t){
          return '<line x1="' + t.x + '" y1="' + marginTop + '" x2="' + t.x + '" y2="' + (marginTop + chartHeight) + '" stroke="#eee" />'
               + '<text x="' + t.x + '" y="' + (marginTop + chartHeight + 14) + '" text-anchor="middle" font-size="10" fill="#666">' + t.val + '</text>';
        }).join('');

        const yLabelsSvg = resvCodeLabels.map(function(label, idx){
          const y = marginTop + idx * (barHeight + barGap) + barHeight / 2 + 3;
          return '<text x="' + (marginLeft - 8) + '" y="' + y + '" text-anchor="end" font-size="10" fill="#333">' + label + '</text>';
        }).join('');

        const barsSvg = resvCodeLabels.map(function(label, idx){
          const y = marginTop + idx * (barHeight + barGap);
          const c = DATA.resvCodeCounts[label] || 0;
          const w = Math.max(1, xScale(c));
          const color = '#4e79a7';
          const textX = marginLeft + w / 2;
          const textY = y + barHeight / 2 + 3;
          const xEnd = marginLeft + w;
          return '<g>' +
                 '<rect x="' + marginLeft + '" y="' + y + '" width="' + w + '" height="' + barHeight + '" fill="' + color + '" />' +
                 '<text x="' + textX + '" y="' + textY + '" text-anchor="middle" font-size="10" fill="#fff">' + c + '</text>' +
                 '<text x="' + (xEnd + 6) + '" y="' + textY + '" text-anchor="start" font-size="10" fill="#333">' + c + '</text>' +
                 '</g>';
        }).join('');

        container.innerHTML = '' +
          '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="transparent" />' +
          '<text x="16" y="' + (marginTop + chartHeight / 2) + '" transform="rotate(-90 16,' + (marginTop + chartHeight / 2) + ')" text-anchor="middle" font-size="12" fill="#666">예약코드</text>' +
          '<text x="' + (marginLeft + chartWidth / 2) + '" y="' + (marginTop + chartHeight + 28) + '" text-anchor="middle" font-size="12" fill="#666">건수</text>' +
          '<line x1="' + marginLeft + '" y1="' + marginTop + '" x2="' + marginLeft + '" y2="' + (marginTop + chartHeight) + '" stroke="#9ca3af" stroke-width="1" />' +
          '<line x1="' + marginLeft + '" y1="' + (marginTop + chartHeight) + '" x2="' + (marginLeft + chartWidth) + '" y2="' + (marginTop + chartHeight) + '" stroke="#9ca3af" stroke-width="1" />' +
          xAxisSvg +
          '<g>' + barsSvg + '</g>' +
          '<g>' + yLabelsSvg + '</g>';
      }

      function showAnalProduct(){
        tabAnalProduct.classList.add('active');
        if (tabAnalResv) {
          tabAnalResv.classList.remove('active');
          tabAnalResv.setAttribute('aria-selected','false');
        }
        tabAnalProduct.setAttribute('aria-selected','true');
        tabsDimension.style.display = 'none';
        if (barsResv) barsResv.style.display = 'none';
        if (barsResvProduct) barsResvProduct.style.display = 'none';
        legendResv.classList.add('hidden');
        // 예약 상태 Y축 차트 섹션은 숨김 유지
        if (scrollResv) scrollResv.classList.add('hidden');
        scrollProducts.classList.remove('hidden');
        if (resvRatiosCard) resvRatiosCard.classList.remove('hidden');
        if (resvLangTypeCard) resvLangTypeCard.classList.remove('hidden');
        if (resvCodeChartCard) resvCodeChartCard.classList.remove('hidden');
        if (tabProdType) {
          tabProdType.classList.add('active');
          tabProdType.setAttribute('aria-selected','true');
        }
        if (tabProdLang) {
          tabProdLang.classList.remove('active');
          tabProdLang.setAttribute('aria-selected','false');
        }
        barsType.style.display = '';
        barsLang.style.display = 'none';
        legendType.classList.remove('hidden');
        legendLang.classList.add('hidden');
        hidePie();
        detail.classList.add('hidden');
        if (pageTitle) pageTitle.textContent = '상품 기반 분석';
        document.title = '상품 기반 분석 대시보드';
        if (yAxisLabel) yAxisLabel.textContent = '상품명';
        if (ylabelsProducts) ylabelsProducts.style.display = '';
        if (ylabelsResv) ylabelsResv.style.display = 'none';
        if (chartDesc) chartDesc.textContent = 'X축: 건수 · Y축: 상품명 (총 ' + TOTAL + ')';
        const resvNull = document.getElementById('resv-null-summary');
        if (resvNull) resvNull.classList.add('hidden');
        if (barsOrders) barsOrders.style.display = (toggleOrders && toggleOrders.checked) ? '' : 'none';
        // 예약코드 차트 렌더
        try {
          const sortSel = document.getElementById('sort-resv-code');
          if (typeof renderResvCodeChart === 'function') {
            renderResvCodeChart(sortSel ? sortSel.value : 'desc');
          }
        } catch (e) {}
      }
      function showAnalResv(){
        tabAnalResv.classList.add('active');
        tabAnalProduct.classList.remove('active');
        tabAnalResv.setAttribute('aria-selected','true');
        tabAnalProduct.setAttribute('aria-selected','false');
        tabsDimension.style.display = 'none';
        barsType.style.display = 'none';
        barsLang.style.display = 'none';
        legendType.classList.add('hidden');
        legendLang.classList.add('hidden');
        if (barsResv) barsResv.style.display = 'none';
        if (barsResvProduct) barsResvProduct.style.display = 'none';
        scrollProducts.classList.add('hidden');
        scrollResv.classList.remove('hidden');
        legendResv.classList.add('hidden');
        legendType.classList.remove('hidden');
        if (resvRatiosCard) resvRatiosCard.classList.remove('hidden');
        if (resvLangTypeCard) resvLangTypeCard.classList.remove('hidden');
        if (resvCodeChartCard) resvCodeChartCard.classList.remove('hidden');
        hidePie();
        detail.classList.add('hidden');
        if (pageTitle) pageTitle.textContent = '예약 기반 분석';
        document.title = '예약 기반 분석 대시보드';
        if (yAxisLabel) yAxisLabel.textContent = '예약 상태';
        if (ylabelsProducts) ylabelsProducts.style.display = 'none';
        if (ylabelsResv) ylabelsResv.style.display = '';
        if (chartDesc) chartDesc.textContent = 'X축: 건수 · Y축: 예약 상태 (총 ' + TOTAL + ')';
        const resvNull = document.getElementById('resv-null-summary');
        if (resvNull) resvNull.classList.remove('hidden');
        if (barsOrders) barsOrders.style.display = 'none';
        const tabResvType = document.getElementById('tab-resv-type');
        const tabResvLang = document.getElementById('tab-resv-lang');
        const barsResvTypesG = document.getElementById('bars-resv-types');
        const barsResvLangsG = document.getElementById('bars-resv-langs');
        if (tabResvType && tabResvLang) {
          tabResvType.classList.add('active');
          tabResvType.setAttribute('aria-selected','true');
          tabResvLang.classList.remove('active');
          tabResvLang.setAttribute('aria-selected','false');
        }
        if (barsResvTypesG && barsResvLangsG) {
          barsResvTypesG.style.display = '';
          barsResvLangsG.style.display = 'none';
        }
        const sortSel = document.getElementById('sort-resv-code');
        renderResvCodeChart(sortSel ? sortSel.value : 'desc');
      }
      tabAnalProduct.addEventListener('click', showAnalProduct);
      if (tabAnalResv) tabAnalResv.addEventListener('click', showAnalResv);
      const sortResvCodeSel = document.getElementById('sort-resv-code');
      if (sortResvCodeSel) sortResvCodeSel.addEventListener('change', ()=>renderResvCodeChart(sortResvCodeSel.value));
      const sortRatiosSel = document.getElementById('sort-ratios');
      function rebuildRatios(sort){
        const tri = DATA.tri || {};
        const order = DATA.orderCounts || {};
        const items = Object.keys(tri).map(prod=>{
          let inq=0; for (const t in tri[prod]) { const m=tri[prod][t]||{}; for (const l in m) inq+=Number(m[l]||0);} 
          const ord = Number(order[prod]||0);
          const pct = ord>0 ? (inq/ord)*100 : null;
          return { prod, inq, ord, pct };
        });
        items.sort((a,b)=> sort==='asc' ? (a.inq-b.inq) : (b.inq-a.inq));
        const grid = document.querySelector('.ratios-grid');
        if (!grid) return;
        grid.innerHTML = items.map(({prod,inq,ord,pct})=>{
          const name = (DATA.codeNameMap&&DATA.codeNameMap[prod])?DATA.codeNameMap[prod]:prod;
          const val = pct==null?'-':(Math.round(pct*100)/100).toFixed(2)+'%';
          return '<div class="ratio-item"><span class="ratio-code">'+name+'</span><span class="ratio-val">'+val+'</span><span class="ratio-detail">('+inq+'/'+ord+')</span></div>';
        }).join('');
      }
      if (sortRatiosSel) sortRatiosSel.addEventListener('change', ()=>rebuildRatios(sortRatiosSel.value||'desc'));
      
      function showType(){
        tabType.classList.add('active');
        tabLang.classList.remove('active');
        tabType.setAttribute('aria-selected','true');
        tabLang.setAttribute('aria-selected','false');
        barsType.style.display = '';
        barsLang.style.display = 'none';
        legendType.classList.remove('hidden');
        legendLang.classList.add('hidden');
        hidePie();
      }
      function showLang(){
        tabLang.classList.add('active');
        tabType.classList.remove('active');
        tabLang.setAttribute('aria-selected','true');
        tabType.setAttribute('aria-selected','false');
        barsLang.style.display = '';
        barsType.style.display = 'none';
        legendLang.classList.remove('hidden');
        legendType.classList.add('hidden');
        hidePie();
      }
      tabType.addEventListener('click', showType);
      tabLang.addEventListener('click', showLang);
      function showProdType(){
        if (tabProdType && tabProdLang) {
          tabProdType.classList.add('active');
          tabProdType.setAttribute('aria-selected','true');
          tabProdLang.classList.remove('active');
          tabProdLang.setAttribute('aria-selected','false');
        }
        barsType.style.display = '';
        barsLang.style.display = 'none';
        legendType.classList.remove('hidden');
        legendLang.classList.add('hidden');
      }
      function showProdLang(){
        if (tabProdType && tabProdLang) {
          tabProdLang.classList.add('active');
          tabProdLang.setAttribute('aria-selected','true');
          tabProdType.classList.remove('active');
          tabProdType.setAttribute('aria-selected','false');
        }
        barsLang.style.display = '';
        barsType.style.display = 'none';
        legendLang.classList.remove('hidden');
        legendType.classList.add('hidden');
      }
      if (tabProdType) tabProdType.addEventListener('click', showProdType);
      if (tabProdLang) tabProdLang.addEventListener('click', showProdLang);

      // Product sorting
      function computeProdTotals(){
        const tri = DATA.tri || {};
        const totals = {};
        for (const prod in tri){
          let s=0; for (const t in tri[prod]){ const m=tri[prod][t]||{}; for (const l in m){ s+=Number(m[l]||0); } }
          totals[prod]=s;
        }
        return totals;
      }
      function applyProductSort(sort){
        const totals = computeProdTotals();
        const types = DATA.types || [];
        const langs = DATA.langs || [];
        const labels = Object.keys(totals).sort((a,b)=> sort==='asc' ? (totals[a]-totals[b]) : (totals[b]-totals[a]));
        const width = ${width}; const marginLeft=${marginLeft}; const marginTop=${marginTop}; const barHeight=${barHeight}; const barGap=${barGap}; const chartWidth=${chartWidth};
        // Scale should consider both inquiry totals and order counts to avoid clipping
        const ordersAll = DATA.orderCounts || {};
        const maxInquiry = Math.max.apply(null, labels.map(k=>Number(totals[k]||0))) || 0;
        const maxOrder = Math.max.apply(null, labels.map(k=>Number(ordersAll[k]||0))) || 0;
        const max = Math.max(maxInquiry, maxOrder);
        const xScale = (v)=> max===0?0:Math.round((v/max)*chartWidth);
        // Drawer: adjust svg height and row offsets
        const svgEl = document.getElementById('chart');
        if (svgEl) {
          const baseH = Number(svgEl.dataset.baseh || svgEl.getAttribute('height') || ${height});
          svgEl.dataset.baseh = String(baseH);
          svgEl.setAttribute('height', OPEN_PROD ? String(baseH + DRAWER_H) : String(baseH));
        }
        const openIndex = OPEN_PROD ? labels.indexOf(OPEN_PROD) : -1;
        function colorOfType(t){ const palette=['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc949','#af7aa1','#ff9da7','#9c755f','#bab0ab']; return palette[types.indexOf(t)%palette.length]; }
        function colorOfLang(l){ const palette=['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc949','#af7aa1','#ff9da7','#9c755f','#bab0ab']; return palette[langs.indexOf(l)%palette.length]; }
        // y labels
        const yHtml = labels.map(function(label, idx){
          const offset = (openIndex>=0 && idx>openIndex) ? DRAWER_H : 0;
          const yy = marginTop + idx*(barHeight+barGap) + barHeight/2 + 3 + offset;
          const name = (DATA.codeNameMap&&DATA.codeNameMap[label])?DATA.codeNameMap[label]:label;
          return '<text class="prod-label" data-prod="'+label+'" x="'+(marginLeft-8)+'" y="'+yy+'" text-anchor="end" font-size="10" fill="#333" style="cursor:pointer;">'+name+'</text>';
        }).join('');
        const yNode = document.getElementById('ylabels-products'); if (yNode) yNode.innerHTML = yHtml;
        // bars
        function buildBars(mode){
          return labels.map(function(label, idx){
            const offset = (openIndex>=0 && idx>openIndex) ? DRAWER_H : 0;
            const baseY = marginTop + idx*(barHeight+barGap) + offset;
            let parts = []; let cursor = marginLeft;
            if (mode==='type'){
              for (let ti=0; ti<types.length; ti++){
                const t = types[ti];
                const langMap = ((DATA.tri[label]||{})[t]||{}); 
                const cnt = Object.values(langMap).reduce(function(a,b){return a+Number(b||0);},0); if (cnt<=0) continue;
                const w = Math.max(1,xScale(cnt));
                parts.push('<rect class="seg seg-type" data-role="type" data-prod="'+label+'" data-cat="'+t+'" x="'+cursor+'" y="'+baseY+'" width="'+w+'" height="'+barHeight+'" fill="'+colorOfType(t)+'" />');
                cursor += w;
              }
            } else {
              for (let li=0; li<langs.length; li++){
                const l = langs[li];
                let cnt=0; const byType = DATA.tri[label]||{}; for (const t in byType){ cnt+=Number((byType[t]||{})[l]||0); }
                if (cnt<=0) continue;
                const w = Math.max(1,xScale(cnt));
                parts.push('<rect class="seg seg-lang" data-role="lang" data-prod="'+label+'" data-cat="'+l+'" x="'+cursor+'" y="'+baseY+'" width="'+w+'" height="'+barHeight+'" fill="'+colorOfLang(l)+'" />');
                cursor += w;
              }
            }
            const xEnd = marginLeft + xScale(totals[label]||0);
            parts.push('<text x="'+(xEnd+6)+'" y="'+(baseY + barHeight/2 + 3)+'" text-anchor="start" font-size="10" fill="#333">'+(totals[label]||0)+'</text>');
            return '<g>'+parts.join('')+'</g>';
          }).join('');
        }
        const bt = document.getElementById('bars-type'); if (bt) bt.innerHTML = buildBars('type');
        const bl = document.getElementById('bars-lang'); if (bl) bl.innerHTML = buildBars('lang');
        // orders overlay
        const orders = DATA.orderCounts || {};
        const bo = document.getElementById('bars-orders'); if (bo){
          bo.innerHTML = labels.map(function(label, idx){
            const offset = (openIndex>=0 && idx>openIndex) ? DRAWER_H : 0;
            const yv = marginTop + idx*(barHeight+barGap) + offset;
            const ord = Number(orders[label]||0); if (!ord) return '';
            const w = Math.max(1,xScale(ord)); const hb = Math.max(6, Math.round(barHeight*0.35)); const yo = yv + (barHeight-hb);
            return '<rect class="orders-bar" data-prod="'+label+'" x="'+marginLeft+'" y="'+yo+'" width="'+w+'" height="'+hb+'" fill="#9ca3af" fill-opacity="0.6" />';
          }).join('');
        }
        attachProductLabelClick(); attachHover();
      }
      const sortProdSel = document.getElementById('sort-prod');
      if (sortProdSel) sortProdSel.addEventListener('change', ()=>applyProductSort(sortProdSel.value||'desc'));
      if (toggleOrders) toggleOrders.addEventListener('change', function(){
        if (!barsOrders) return;
        const isProductTab = tabAnalProduct.classList.contains('active');
        barsOrders.style.display = (isProductTab && toggleOrders.checked) ? '' : 'none';
      });
      document.addEventListener('click', function(e){
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.id === 'tab-resv-type') {
          const tabResvType = document.getElementById('tab-resv-type');
          const tabResvLang = document.getElementById('tab-resv-lang');
          const barsResvTypesG = document.getElementById('bars-resv-types');
          const barsResvLangsG = document.getElementById('bars-resv-langs');
          if (tabResvType && tabResvLang) {
            tabResvType.classList.add('active');
            tabResvType.setAttribute('aria-selected','true');
            tabResvLang.classList.remove('active');
            tabResvLang.setAttribute('aria-selected','false');
          }
          if (barsResvTypesG && barsResvLangsG) {
            barsResvTypesG.style.display = '';
            barsResvLangsG.style.display = 'none';
          }
          legendType.classList.remove('hidden');
          legendLang.classList.add('hidden');
        } else if (t.id === 'tab-resv-lang') {
          const tabResvType = document.getElementById('tab-resv-type');
          const tabResvLang = document.getElementById('tab-resv-lang');
          const barsResvTypesG = document.getElementById('bars-resv-types');
          const barsResvLangsG = document.getElementById('bars-resv-langs');
          if (tabResvType && tabResvLang) {
            tabResvLang.classList.add('active');
            tabResvLang.setAttribute('aria-selected','true');
            tabResvType.classList.remove('active');
            tabResvType.setAttribute('aria-selected','false');
          }
          if (barsResvTypesG && barsResvLangsG) {
            barsResvTypesG.style.display = 'none';
            barsResvLangsG.style.display = '';
          }
          legendLang.classList.remove('hidden');
          legendType.classList.add('hidden');
        }
      });
      function hidePie(){
        pie.classList.add('hidden');
        pie.innerHTML = '';
      }
      function formatPercent(v){
        return (v*100).toFixed(1).replace(/\.0$/, '') + '%';
      }
      function drawPie(entries, colors, title){
        const total = entries.reduce((a, [,c]) => a + c, 0);
        if (!total) return '';
        const W = 240, H = 200, CX = 90, CY = 100, R = 70;
        let a0 = -Math.PI/2;
        const parts = [];
        const leg = [];
        if (entries.length === 1) {
          const label = entries[0][0];
          const c = entries[0][1];
          const color = colors(label);
          parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="' + color + '"></circle>');
          leg.push('<div class="pie-legend-item"><span class="swatch" style="background:' + color + '"></span><span>' + label + ' · ' + c + ' (100%)</span></div>');
          return '<div class="pie-title">' + title + '</div>' +
                 '<svg width="' + W + '" height="' + H + '"><g>' + parts.join('') + '</g></svg>' +
                 '<div class="pie-legend">' + leg.join('') + '</div>';
        }
        for (const [label, c] of entries){
          const frac = c / total;
          const a1 = a0 + frac * Math.PI * 2;
          const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0);
          const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
          const large = (a1 - a0) > Math.PI ? 1 : 0;
          const color = colors(label);
          const d = 'M ' + CX + ' ' + CY + ' L ' + x0 + ' ' + y0 + ' A ' + R + ' ' + R + ' 0 ' + large + ' 1 ' + x1 + ' ' + y1 + ' Z';
          parts.push('<path d="' + d + '" fill="' + color + '"></path>');
          leg.push('<div class="pie-legend-item"><span class="swatch" style="background:' + color + '"></span><span>' + label + ' · ' + c + ' (' + formatPercent(frac) + ')</span></div>');
          a0 = a1;
        }
        return '<div class="pie-title">' + title + '</div>' +
               '<svg width="' + W + '" height="' + H + '"><g>' + parts.join('') + '</g></svg>' +
               '<div class="pie-legend">' + leg.join('') + '</div>';
      }
      function onMove(e){
        pie.style.left = (e.clientX + 14) + 'px';
        pie.style.top = (e.clientY + 14) + 'px';
      }
      function attachHover(){
        const palette = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc949','#af7aa1','#ff9da7','#9c755f','#bab0ab'];
        const paletteType = (t) => palette[DATA.types.indexOf(t) % palette.length];
        const paletteLang = (l) => palette[DATA.langs.indexOf(l) % palette.length];
        const segs = document.querySelectorAll('.seg');
        function escapeHtml(s){
          return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }
        function renderGroupedContentsByLang(prod, typeOrNull, langOrNull){
          const groups = {};
          if (typeOrNull !== null) {
            const tbox = DATA.texts[prod] && DATA.texts[prod][typeOrNull];
            const ibox = DATA.reqs[prod] && DATA.reqs[prod][typeOrNull];
            if (tbox) {
              for (const L in tbox) {
                if (!Object.prototype.hasOwnProperty.call(tbox, L)) continue;
                const texts = tbox[L] || [];
                const ids = (ibox && ibox[L]) || [];
                groups[L] = [];
                for (let i = 0; i < Math.min(texts.length, 8); i++) {
                  groups[L].push({ text: texts[i], id: ids[i] || '' });
                }
              }
            }
          } else if (langOrNull !== null) {
            const L = langOrNull;
            const tset = DATA.texts[prod] || {};
            const rset = DATA.reqs[prod] || {};
            const arr = [];
            for (const T in tset) {
              if (!Object.prototype.hasOwnProperty.call(tset, T)) continue;
              const texts = (tset[T] && tset[T][L]) || [];
              const ids = (rset[T] && rset[T][L]) || [];
              for (let i = 0; i < Math.min(texts.length, 8); i++) {
                arr.push({ text: texts[i], id: ids[i] || '' });
              }
            }
            if (arr.length) groups[L] = arr.slice(0, 8);
          }
          const langsOrder = Object.keys(groups);
          if (!langsOrder.length) return '';
          let html = '<div class="pie-contents"><div class="pie-contents-title">문의 내용</div>';
          for (const L of langsOrder) {
            html += '<div style="font-size:11px;margin:6px 0 2px 0;color:#6b7280;">' + escapeHtml(L) + '</div><ul class="pie-contents-list">';
            for (const {text,id} of groups[L]) {
              const idHtml = id ? (' <span style="color:#6b7280">(요청 ID: ' + escapeHtml(id) + ')</span>') : '';
              html += '<li>' + escapeHtml(text) + idHtml + '</li>';
            }
            html += '</ul>';
          }
          html += '</div>';
          return html;
        }
        function renderGroupedContentsByType(prod, lang){
          const groups = {};
          const tset = DATA.texts[prod] || {};
          const rset = DATA.reqs[prod] || {};
          for (const T of DATA.types) {
            const texts = (tset[T] && tset[T][lang]) || [];
            const ids = (rset[T] && rset[T][lang]) || [];
            if (!texts.length) continue;
            const arr = [];
            for (let i = 0; i < Math.min(texts.length, 8); i++) {
              arr.push({ text: texts[i], id: ids[i] || '' });
            }
            if (arr.length) groups[T] = arr;
          }
          const order = Object.keys(groups);
          if (!order.length) return '';
          let html = '<div class="pie-contents"><div class="pie-contents-title">문의 내용</div>';
          for (const T of order) {
            html += '<div style="font-size:11px;margin:6px 0 2px 0;color:#6b7280;">' + escapeHtml(T) + '</div><ul class="pie-contents-list">';
            for (const {text,id} of groups[T]) {
              const idHtml = id ? (' <span style="color:#6b7280">(요청 ID: ' + escapeHtml(id) + ')</span>') : '';
              html += '<li>' + escapeHtml(text) + idHtml + '</li>';
            }
            html += '</ul>';
          }
          html += '</div>';
          return html;
        }
        segs.forEach(el => {
          el.addEventListener('mouseenter', (e) => {
            const role = el.getAttribute('data-role');
            const prod = el.getAttribute('data-prod');
            const cat = el.getAttribute('data-cat');
            let entries = [];
            if (role === 'resv') {
              const status = el.getAttribute('data-status') || '';
              const isTypeMode = !!(document.getElementById('bars-resv-types') && document.getElementById('bars-resv-types').style.display !== 'none');
              if (isTypeMode) {
                const box = (DATA.statusTypeLang && DATA.statusTypeLang[status] && DATA.statusTypeLang[status][cat]) || null;
                if (box) entries = Object.entries(box).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1]);
                pie.innerHTML = drawPie(entries, (l)=>paletteLang(l), status + ' · ' + cat + ' → 언어');
              } else {
                const L = cat;
                const types = DATA.types;
                const box = (DATA.statusLangType && DATA.statusLangType[status]) || {};
                const rows = types.map(t => [t, (box[L] && box[L][t]) ? box[L][t] : 0]).filter(([,c])=>c>0);
                entries = rows.sort((a,b)=>b[1]-a[1]);
                pie.innerHTML = drawPie(entries, (t)=>paletteType(t), status + ' · ' + cat + ' → 문의 유형');
              }
              if (entries.length){ pie.classList.remove('hidden'); }
              return;
            }
            if (role === 'type') {
              const box = DATA.tri[prod] && DATA.tri[prod][cat];
              if (box) {
                entries = Object.entries(box).filter(([,c]) => c > 0).sort((a,b)=>b[1]-a[1]);
              }
              pie.innerHTML = drawPie(entries, (l)=>paletteLang(l), prod + ' · ' + cat + ' → 언어') +
                              renderGroupedContentsByLang(prod, cat, null);
            } else {
              const L = cat;
              const types = DATA.types;
              const box = DATA.tri[prod] || {};
              const rows = types.map(t => [t, (box[t] && box[t][L]) ? box[t][L] : 0]).filter(([,c]) => c>0);
              entries = rows.sort((a,b)=>b[1]-a[1]);
              pie.innerHTML = drawPie(entries, (t)=>paletteType(t), prod + ' · ' + cat + ' → 문의 유형') +
                              renderGroupedContentsByType(prod, L);
            }
            if (entries.length){ pie.classList.remove('hidden'); }
          });
          el.addEventListener('mousemove', onMove);
          el.addEventListener('mouseleave', hidePie);
          el.addEventListener('click', (e) => {
            const role = el.getAttribute('data-role');
            const prod = el.getAttribute('data-prod');
            const cat = el.getAttribute('data-cat');
            const status = el.getAttribute('data-status') || '';
            const rectY = parseFloat(el.getAttribute('y')) || 0;
            const barH = parseFloat(svg.dataset.barh || '22');
            const ml = parseFloat(svg.dataset.ml || '100');
            let entries = [];
            let html = '';
            if (role === 'resv') {
              const isTypeMode = !!(document.getElementById('bars-resv-types') && document.getElementById('bars-resv-types').style.display !== 'none');
              if (isTypeMode) {
                const box = (DATA.statusTypeLang && DATA.statusTypeLang[status] && DATA.statusTypeLang[status][cat]) || null;
                if (box) entries = Object.entries(box).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1]);
                html = drawPie(entries, (l)=>paletteLang(l), status + ' · ' + cat + ' → 언어');
              } else {
                const L = cat;
                const types = DATA.types;
                const box = (DATA.statusLangType && DATA.statusLangType[status]) || {};
                const rows = types.map(t => [t, (box[L] && box[L][t]) ? box[L][t] : 0]).filter(([,c])=>c>0);
                entries = rows.sort((a,b)=>b[1]-a[1]);
                html = drawPie(entries, (t)=>paletteType(t), status + ' · ' + cat + ' → 문의 유형');
              }
            } else if (role === 'type') {
              const box = DATA.tri[prod] && DATA.tri[prod][cat];
              if (box) entries = Object.entries(box).filter(([,c]) => c > 0).sort((a,b)=>b[1]-a[1]);
              html = drawPie(entries, (l)=>paletteLang(l), prod + ' · ' + cat + ' → 언어') +
                     renderGroupedContentsByLang(prod, cat, null);
            } else {
              const L = cat;
              const b = DATA.tri[prod] || {};
              const rows = DATA.types.map(t => [t, (b[t] && b[t][L]) ? b[t][L] : 0]).filter(([,c])=>c>0);
              entries = rows.sort((a,b)=>b[1]-a[1]);
              html = drawPie(entries, (t)=>paletteType(t), prod + ' · ' + cat + ' → 문의 유형') +
                     renderGroupedContentsByType(prod, L);
            }
            if (!entries.length) return;
            hidePie();
            let title;
            if (role === 'type') {
              const prodLabel = (DATA.codeNameMap && DATA.codeNameMap[prod]) ? DATA.codeNameMap[prod] : prod;
              title = escapeHtml(prodLabel)+' · '+escapeHtml(cat)+' → 언어';
            }
            else if (role === 'lang') {
              const prodLabel = (DATA.codeNameMap && DATA.codeNameMap[prod]) ? DATA.codeNameMap[prod] : prod;
              title = escapeHtml(prodLabel)+' · '+escapeHtml(cat)+' → 문의 유형';
            }
            else {
              const mode = (document.getElementById('bars-resv-types') && document.getElementById('bars-resv-types').style.display !== 'none') ? '언어' : '문의 유형';
              title = escapeHtml(status)+' · '+escapeHtml(cat)+' → ' + mode;
            }
            detail.innerHTML = '<div class="bar-detail-header"><div class="bar-detail-title">' + title + '</div><button class="bar-detail-close" aria-label="닫기">닫기</button></div>' + '<div class="bar-detail-body">' + html + '</div>';
            detail.style.left = ml + 'px';
            detail.style.top = (rectY + barH + 6) + 'px';
            detail.classList.remove('hidden');
            const closeBtn = detail.querySelector('.bar-detail-close');
            closeBtn.addEventListener('click', () => { detail.classList.add('hidden'); detail.innerHTML=''; });
          });
        });
      }

      attachHover();
      attachProductLabelClick();
      function attachProductLabelClick(){
        const nodes = document.querySelectorAll('#ylabels-products .prod-label');
        nodes.forEach((el) => {
          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const prod = el.getAttribute('data-prod');
            showProductTooltip(prod, el);
          });
        });
      }

      function showProductTooltip(prod, srcEl){
        if (!prodTip) return;
        const name = (DATA.codeNameMap && DATA.codeNameMap[prod]) ? DATA.codeNameMap[prod] : prod;
        const entriesObj = (DATA.perProductDateCounts && DATA.perProductDateCounts[prod]) ? DATA.perProductDateCounts[prod] : {};
        const entriesOrdObj = (DATA.perProductOrderDateCounts && DATA.perProductOrderDateCounts[prod]) ? DATA.perProductOrderDateCounts[prod] : {};
        const chartEl = document.getElementById('chart');
        const chartRect = chartEl ? chartEl.getBoundingClientRect() : { left: 20, width: ${width} };
        const width = Math.round(chartRect.width);
        // compute totals and ratio
        const inqTotal = Object.values(entriesObj).reduce((a,b)=>a+Number(b||0),0);
        const ordTotalPref = Object.values(entriesOrdObj).reduce((a,b)=>a+Number(b||0),0);
        const ordTotal = ordTotalPref || (DATA.orderCounts && DATA.orderCounts[prod]) || 0;
        const pct = ordTotal > 0 ? (Math.round((inqTotal/ordTotal)*10000)/100) + '%' : '';
        const titleHtml = '<div class="product-tooltip-title">' + (name ? name : prod) + '<span style="margin-left:8px; font-size:12px; color:#6b7280;">· 문의 수/주문 수 = ' + inqTotal + '/' + ordTotal + (pct?(' '+pct):'') + '</span></div>';
        const tabsHtml = '<div id="tabs-date2" class="tabs" role="tablist" style="margin:0 0 6px auto;">' +
          '<button id="tab2-date-d" class="tab active" role="tab" aria-selected="true">일 기준</button>'+
          '<button id="tab2-date-m" class="tab" role="tab" aria-selected="false">월 기준</button>'+
          '<button id="tab2-date-q" class="tab" role="tab" aria-selected="false">분기 기준</button>'+
          '<button id="tab2-date-h" class="tab" role="tab" aria-selected="false">반기 기준</button>'+
          '<button id="tab2-date-y" class="tab" role="tab" aria-selected="false">연 기준</button>'+
        '</div>';
        const head = '<div class="product-tooltip-meta">상품코드: ' + prod + '</div>';
        const svgHtml = '<div class="product-tooltip-chart"><svg id="chart-date-activity2" width="'+width+'" height="220" viewBox="0 0 '+width+' 220"></svg></div>';
        const closeBtn = '<button class="bar-detail-close" style="position:absolute; top:10px; right:10px;">닫기</button>';
        prodTip.style.width = width + 'px';
        prodTip.innerHTML = titleHtml + closeBtn + tabsHtml + head + svgHtml;
        // Position near clicked label and keep within viewport (overlay)
        const vpW = window.innerWidth || document.documentElement.clientWidth || 1280;
        const vpH = window.innerHeight || document.documentElement.clientHeight || 800;
        const r = (srcEl && srcEl.getBoundingClientRect) ? srcEl.getBoundingClientRect() : { left: chartRect.left, top: 80, bottom: 120 };
        prodTip.classList.remove('hidden');
        let tipRect = prodTip.getBoundingClientRect();
        let left = Math.max(10, Math.round(chartRect.left));
        if (left + tipRect.width + 10 > vpW) left = Math.max(10, vpW - tipRect.width - 10);
        let top = Math.round(r.top - 10 - tipRect.height);
        if (top < 10) top = Math.min(vpH - tipRect.height - 10, Math.round(r.bottom + 10));
        if (top < 10) top = 10;
        prodTip.style.left = left + 'px';
        prodTip.style.top = top + 'px';
        const btnClose = prodTip.querySelector('.bar-detail-close');
        if (btnClose) btnClose.addEventListener('click', hideProductTip);
        // Outside click closes
        setTimeout(() => {
          function outside(ev){
            if (!prodTip.contains(ev.target) && !(ev.target && ev.target.closest && ev.target.closest('.prod-label'))) {
              document.removeEventListener('click', outside, true);
              hideProductTip();
            }
          }
          document.addEventListener('click', outside, true);
        }, 0);

        function group(entries, mode){
          function pad2(n){ return (n < 10 ? '0' : '') + n; }
          const map = new Map();
          for (const [d, c0] of entries) {
            const c = Number(c0) || 0;
            const y = Number(String(d).slice(0,4));
            const m = Number(String(d).slice(5,7));
            let key = d;
            if (mode === 'm') key = y + '-' + pad2(m);
            else if (mode === 'q') { const q = Math.floor((m-1)/3)+1; key = y + '-Q' + q; }
            else if (mode === 'h') { const h = (m <= 6) ? 'H1' : 'H2'; key = y + '-' + h; }
            else if (mode === 'y') key = String(y);
            map.set(key, (map.get(key) || 0) + c);
          }
          let labels = Array.from(map.keys());
          labels.sort((a,b)=>{
            if (mode === 'd' || mode === 'm' || mode === 'y') return String(a).localeCompare(String(b));
            const ay = Number(String(a).slice(0,4));
            const by = Number(String(b).slice(0,4));
            if (ay !== by) return ay - by;
            if (mode === 'q') {
              const aq = Number(String(a).match(/Q(\d)/)?.[1] || 0);
              const bq = Number(String(b).match(/Q(\d)/)?.[1] || 0);
              return aq - bq;
            } else {
              const ah = String(a).includes('H1') ? 1 : 2;
              const bh = String(b).includes('H1') ? 1 : 2;
              return ah - bh;
            }
          });
          // If daily mode, fill missing days with 0 to reflect gaps between events
          if (mode === 'd' && labels.length >= 2) {
            const start = new Date(labels[0]);
            const end = new Date(labels[labels.length - 1]);
            const full = [];
            for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
              const y = dt.getFullYear();
              const m = pad2(dt.getMonth() + 1);
              const day = pad2(dt.getDate());
              full.push(y + '-' + m + '-' + day);
            }
            labels = full;
          }
          const vals = labels.map(l => map.get(l) || 0);
          return { labels, values: vals };
        }

        function render(mode){
          const svg = document.getElementById('chart-date-activity2');
          if (!svg) return;
          const entInq = Object.entries(entriesObj);
          const entOrd = Object.entries(entriesOrdObj);
          if (entInq.length === 0 && entOrd.length === 0) { svg.innerHTML = '<text x="20" y="40" fill="#666" font-size="12">데이터 없음</text>'; return; }
          const gInq = entInq.length ? group(entInq, mode) : { labels: [], values: [] };
          const gOrd = entOrd.length ? group(entOrd, mode) : { labels: [], values: [] };
          const set = new Set([].concat(gInq.labels, gOrd.labels));
          const labels = Array.from(set.values()).sort((a,b)=>String(a).localeCompare(String(b)));
          const mapInq = new Map(gInq.labels.map((l,i)=>[l, gInq.values[i]]));
          const mapOrd = new Map(gOrd.labels.map((l,i)=>[l, gOrd.values[i]]));
          const values = labels.map(l => mapInq.get(l) || 0);
          const valuesOrd = labels.map(l => mapOrd.get(l) || 0);
          const width = Math.round(chartRect.width);
          const height = 220;
          const marginLeft = 50, marginRight = 20, marginTop = 28, marginBottom = 28;
          const chartWidth = width - marginLeft - marginRight;
          const chartHeight = height - marginTop - marginBottom;
          const maxVal = Math.max(values.length ? Math.max.apply(null, values) : 0, valuesOrd.length ? Math.max.apply(null, valuesOrd) : 0);
          const yi = function(v){ if (maxVal === 0) return marginTop + chartHeight; return marginTop + (chartHeight - Math.round((v/maxVal) * chartHeight)); };
          const groupStep = labels.length ? Math.floor(chartWidth / labels.length) : chartWidth;
          const groupWidth = Math.max(16, Math.min(48, groupStep - 6));
          const barWidth = Math.max(6, Math.floor((groupWidth - 4) / 2));
          const ticks = 5;
          let xAxis = '';
          for (let i = 0; i <= ticks; i++) { const idx = Math.round((labels.length - 1) * (i / ticks)); const gx = marginLeft + Math.round(idx * groupStep) + Math.round(groupStep/2); xAxis += '<line x1="'+gx+'" y1="'+(marginTop+chartHeight)+'" x2="'+gx+'" y2="'+(marginTop+chartHeight+4)+'" stroke="#9ca3af" />' + '<text x="'+gx+'" y="'+(marginTop+chartHeight+16)+'" text-anchor="middle" font-size="10" fill="#666">'+labels[idx]+'</text>'; }
          let yAxis = '';
          for (let i = 0; i <= ticks; i++) { const val = Math.round((maxVal * i) / ticks); const y = yi(val); yAxis += '<line x1="'+marginLeft+'" y1="'+y+'" x2="'+(marginLeft+chartWidth)+'" y2="'+y+'" stroke="#eee" />' + '<text x="'+(marginLeft-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#666">'+val+'</text>'; }
          // grouped bars
          let bars = '';
          for (let i = 0; i < labels.length; i++) {
            const gx = marginLeft + Math.round(i * groupStep) + Math.round((groupStep - groupWidth)/2);
            const vInq = values[i] || 0; const vOrd = valuesOrd[i] || 0;
            const hInq = Math.max(1, (maxVal===0?0: Math.round((vInq/maxVal)*chartHeight)));
            const hOrd = Math.max(1, (maxVal===0?0: Math.round((vOrd/maxVal)*chartHeight)));
            const xInq = gx; const xOrd = gx + barWidth + 4;
            const yInq = marginTop + chartHeight - hInq; const yOrd = marginTop + chartHeight - hOrd;
            bars += '<rect class="bar bar-inq" x="'+xInq+'" y="'+yInq+'" width="'+barWidth+'" height="'+hInq+'" fill="#2563eb" />';
            bars += '<rect class="bar bar-ord" x="'+xOrd+'" y="'+yOrd+'" width="'+barWidth+'" height="'+hOrd+'" fill="#f28e2b" />';
          }
          const legend = '<g><rect x="'+(marginLeft)+'" y="'+(marginTop-18)+'" width="10" height="10" fill="#2563eb" /><text x="'+(marginLeft+14)+'" y="'+(marginTop-10)+'" font-size="10" fill="#666">문의</text><rect x="'+(marginLeft+60)+'" y="'+(marginTop-18)+'" width="10" height="10" fill="#f28e2b" /><text x="'+(marginLeft+74)+'" y="'+(marginTop-10)+'" font-size="10" fill="#666">주문</text></g>';
          svg.innerHTML = '<rect x="0" y="0" width="'+width+'" height="'+height+'" fill="transparent" />' + legend + bars + '<line x1="'+marginLeft+'" y1="'+(marginTop+chartHeight)+'" x2="'+(marginLeft+chartWidth)+'" y2="'+(marginTop+chartHeight)+'" stroke="#9ca3af" />' + xAxis + yAxis;
          // Hover tooltip on product detail chart
          const xs = labels.map((_, i) => marginLeft + Math.round(i * groupStep) + Math.round(groupStep/2));
          svg.onmousemove = function(e){
            if (!pie) return;
            const rect = svg.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            let idx = 0, best = Infinity;
            for (let i = 0; i < xs.length; i++) { const dx = Math.abs(xs[i] - cx); if (dx < best) { best = dx; idx = i; } }
            pie.innerHTML = '<div class="pie-title">' + labels[idx] + '</div><div class="pie-contents">문의: ' + (values[idx]||0) + ' · 주문: ' + (valuesOrd[idx]||0) + '</div>';
            pie.style.left = (e.clientX + 12) + 'px';
            pie.style.top = (e.clientY + 12) + 'px';
            pie.classList.remove('hidden');
          };
          svg.onmouseleave = function(){ if (pie) pie.classList.add('hidden'); };
        }

        function setMode(mode){
          const ids = [['d','tab2-date-d'],['m','tab2-date-m'],['q','tab2-date-q'],['h','tab2-date-h'],['y','tab2-date-y']];
          ids.forEach(([k,id])=>{ const el = document.getElementById(id); if (el){ const on = (k===mode); el.classList.toggle('active', on); el.setAttribute('aria-selected', on?'true':'false'); }});
          render(mode);
        }
        const td = document.getElementById('tab2-date-d');
        const tm = document.getElementById('tab2-date-m');
        const tq = document.getElementById('tab2-date-q');
        const th = document.getElementById('tab2-date-h');
        const ty = document.getElementById('tab2-date-y');
        if (td) td.addEventListener('click', ()=>setMode('d'));
        if (tm) tm.addEventListener('click', ()=>setMode('m'));
        if (tq) tq.addEventListener('click', ()=>setMode('q'));
        if (th) th.addEventListener('click', ()=>setMode('h'));
        if (ty) ty.addEventListener('click', ()=>setMode('y'));
        setMode('d');
      }
      // Date granularity tabs
      function setDateMode(mode) {
        const tabs = [
          ['d', document.getElementById('tab-date-d')],
          ['m', document.getElementById('tab-date-m')],
          ['q', document.getElementById('tab-date-q')],
          ['h', document.getElementById('tab-date-h')],
          ['y', document.getElementById('tab-date-y')],
        ];
        tabs.forEach(([k, el]) => {
          if (!el) return;
          const on = (k === mode);
          el.classList.toggle('active', on);
          el.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        renderDateActivity(mode);
      }
      const tbD = document.getElementById('tab-date-d');
      const tbM = document.getElementById('tab-date-m');
      const tbQ = document.getElementById('tab-date-q');
      const tbH = document.getElementById('tab-date-h');
      const tbY = document.getElementById('tab-date-y');
      if (tbD) tbD.addEventListener('click', () => setDateMode('d'));
      if (tbM) tbM.addEventListener('click', () => setDateMode('m'));
      if (tbQ) tbQ.addEventListener('click', () => setDateMode('q'));
      if (tbH) tbH.addEventListener('click', () => setDateMode('h'));
      if (tbY) tbY.addEventListener('click', () => setDateMode('y'));
      setDateMode('d');
      showAnalProduct();
    })();
  </script>
</body>
</html>
`;
  return html;
}

function main() {
  const opts = parseArgs();
  const csvPath = findCsvPath(opts.csv);
  const data = readData(csvPath);
  const isJsonCsv = /user_inquiry_from_response\.csv$/.test(csvPath);
  const html = generateHtml(data, { jsonMode: isJsonCsv || opts.mode === 'json' });
  const outPath = opts.out || (isJsonCsv ? 'dashboard_product_counts_json.html' : 'dashboard_product_counts.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`생성됨: ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}
