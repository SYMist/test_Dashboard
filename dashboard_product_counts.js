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
    if (!code || !typ || !lang) continue;
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
      if (!statusLangType.get(status).has(lang)) statusLangType.set(status, new Map());
      statusLangType.get(status).get(lang).set(typ, (statusLangType.get(status).get(lang).get(typ) || 0) + 1);
    }
  }

  const ordersPath = 'product_order_dummy_database.csv';
  const orderCounts = new Map();
  try {
    if (fs.existsSync(ordersPath)) {
      let oc = fs.readFileSync(ordersPath, 'utf8');
      if (oc.charCodeAt(0) === 0xFEFF) oc = oc.slice(1);
      const olines = oc.split(/\r?\n/).filter(Boolean);
      if (olines.length > 0) {
        const h = olines[0].split(',');
        let idxProd = h.findIndex(x => x.trim() === '상품 코드');
        if (idxProd === -1) idxProd = h.findIndex(x => x.replace(/\u00A0/g,' ').trim() === '상품 코드');
        for (let i = 1; i < olines.length; i++) {
          const row = olines[i].split(',');
          if (idxProd >= 0 && row.length > idxProd) {
            const code = String((row[idxProd] || '').trim());
            if (code) orderCounts.set(code, (orderCounts.get(code) || 0) + 1);
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
  return { perProductType, perProductLang, perProductResv, totals, orderCounts, productOrder, types, langs, resvStatuses, statusTypeCounts, statusLangCounts, statusTypeLang: statusTypeLangObj, statusLangType: statusLangTypeObj, reservationNullPercent, langTypeObj, triObj, textObj, reqObj, resvCodeCounts };
}

function generateHtml(data, opts = {}) {
  const { perProductType, perProductLang, perProductResv, totals, orderCounts, productOrder, types, langs, resvStatuses, statusTypeCounts, statusLangCounts, statusTypeLang, statusLangType, reservationNullPercent, langTypeObj, triObj, textObj, reqObj, resvCodeCounts } = data;
  const labels = productOrder;
  const values = labels.map(k => totals.get(k) || 0);
  const maxCount = values.length ? Math.max(...values) : 0;
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
    const total = values[idx];
    const xEnd = marginLeft + xScale(total);
    let rightText = String(total);
    if (role === 'type' || role === 'lang') {
      const prodTypeMap = perProductType.get(label);
      const prodQna = prodTypeMap ? (prodTypeMap.get('상품 문의') || 0) : 0;
      rightText = `${total} · 상품 문의 ${prodQna}`;
    }
    parts.push(`<text x="${xEnd + 6}" y="${y + barHeight / 2 + 3}" text-anchor="start" font-size="10" fill="#333">${rightText}</text>`);
    return `<g>${parts.join('')}</g>`;
  }).join('');

  const barsSvgType = renderBars(perProductType, types, colorOfType, 'type');
  const barsSvgLang = renderBars(perProductLang, langs, colorOfLang, 'lang');
  const barsSvgResvProduct = renderBars(perProductResv, resvStatuses, colorOfResv, 'resv');
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
    return `<text x="${marginLeft - 8}" y="${y}" text-anchor="end" font-size="10" fill="#333">${label}</text>`;
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
    return `<div class="ratio-item"><span class="ratio-code">${prod}</span><span class="ratio-val">${val}</span><span class="ratio-detail">(${inq}/${ord})</span></div>`;
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
    .ratios { border-top-color:#1f2937; }
    .ratio-item { color:#d1d5db; }
    .ratio-code { color:#e5e7eb; }
    .ratio-detail { color:#9ca3af; }
    .lang-type-title { color:#d1d5db; }
    .lt-card { background:#0d1323; border-color:#1f2937; }
    .lt-card-title { color:#e5e7eb; }
    .lt-item { color:#d1d5db; }
    .line-chart-title { color:#e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <h1 id="page-title">상품 기반 분석</h1>
    <div id="chart-desc" class="muted">X축: 건수 · Y축: 상품 코드 (총 ${total})</div>
    <div class="tabs" role="tablist" style="margin-bottom:6px; gap:8px;">
      <button id="tab-anal-product" class="tab active" role="tab" aria-selected="true">상품 기반 분석</button>
      <button id="tab-anal-resv" class="tab" role="tab" aria-selected="false">예약 기반 분석</button>
      ${jsonMode ? '' : '<a id="btn-anal-json" class="tab" role="button" href="dashboard_product_counts_json.html" title="user_inquiry_from_response.csv 기반">상품 기반 분석(json)</a>'}
    </div>
    <div id="resv-null-summary" class="muted hidden" style="margin: 6px 0 2px;">비예약 문의 비율: ${reservationNullPercent.toFixed(2)}%</div>
    <div id="tabs-dimension" class="tabs" role="tablist">
      <button id="tab-type" class="tab active" role="tab" aria-selected="true">문의 유형</button>
      <button id="tab-lang" class="tab" role="tab" aria-selected="false">언어</button>
    </div>
    <div class="card" style="margin-top:12px;">
      <div class="scroll-y" id="scroll-products">
      <div id="tabs-prod-dimension" class="tabs" role="tablist" style="margin: 6px 0 6px;">
        <button id="tab-prod-type" class="tab active" role="tab" aria-selected="true">문의 유형</button>
        <button id="tab-prod-lang" class="tab" role="tab" aria-selected="false">언어</button>
      </div>
      <svg id="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-ml="${marginLeft}" data-barh="${barHeight}">
        <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
        <text id="y-axis-label" x="16" y="${marginTop + chartHeight / 2}" transform="rotate(-90 16,${marginTop + chartHeight / 2})" text-anchor="middle" font-size="12" fill="#666">상품 코드</text>
        <text x="${marginLeft + chartWidth / 2}" y="${marginTop + chartHeight + 28}" text-anchor="middle" font-size="12" fill="#666">건수</text>
        <line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${marginTop + chartHeight}" stroke="#9ca3af" stroke-width="1" />
        <line x1="${marginLeft}" y1="${marginTop + chartHeight}" x2="${marginLeft + chartWidth}" y2="${marginTop + chartHeight}" stroke="#9ca3af" stroke-width="1" />
        ${xAxisSvg}
        <g id="bars-type">${barsSvgType}</g>
        <g id="bars-lang" style="display:none">${barsSvgLang}</g>
        <g id="bars-resv" style="display:none">${typeof barsSvgResvTypes !== 'undefined' ? barsSvgResvTypes : barsSvgResv}</g>
        <g id="bars-resv-product" style="display:none">${barsSvgResvProduct}</g>
        <g id="ylabels-products">${yLabelsProductsSvg}</g>
        <g id="ylabels-resv" style="display:none">${yLabelsResvSvg}</g>
      </svg>
      <div id="bar-detail" class="bar-detail hidden"></div>
      </div>
      <div class="scroll-y hidden" id="scroll-resv">
        <div id="tabs-resv-dimension" class="tabs" role="tablist" style="margin: 6px 0 6px;">
          <button id="tab-resv-type" class="tab active" role="tab" aria-selected="true">문의 유형</button>
          <button id="tab-resv-lang" class="tab" role="tab" aria-selected="false">언어</button>
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
      <div class="muted" style="margin-bottom:6px;">상품 별 주문 대비 문의 비율</div>
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
      <div class="line-chart-header">
        <div class="line-chart-title">예약코드 별 문의 수</div>
      </div>
      <div class="scroll-y" id="scroll-resv-code">
        <svg id="chart-resv-code" width="1000" height="400" viewBox="0 0 1000 400"></svg>
      </div>
    </div>
  </div>
  <div id="pie-tooltip" class="pie-tooltip hidden"></div>
  <script>
    (function(){
      const DATA = ${JSON.stringify({ types, langs, productOrder: labels, tri: triObj, texts: textObj, reqs: reqObj, statusTypeLang, statusLangType, resvCodeCounts: Object.fromEntries(resvCodeCounts) })};
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
      const pageTitle = document.getElementById('page-title');
      const chartDesc = document.getElementById('chart-desc');
      const detail = document.getElementById('bar-detail');
      const svg = document.getElementById('chart');

      function renderResvCodeChart() {
        const container = document.getElementById('chart-resv-code');
        const resvCodeLabels = Object.keys(DATA.resvCodeCounts);
        const resvCodeValues = Object.values(DATA.resvCodeCounts);
        const maxCount = resvCodeValues.length > 0 ? Math.max(...resvCodeValues) : 0;
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

        container.setAttribute('height', height);
        container.setAttribute('viewBox', '0 0 ' + width + ' ' + height);

        const xScale = (v) => (maxCount === 0 ? 0 : Math.round((v / maxCount) * chartWidth));

        const ticks = [];
        const tickCount = 5;
        for (let i = 0; i <= tickCount; i++) {
          const val = Math.round((maxCount * i) / tickCount);
          const x = marginLeft + xScale(val);
          ticks.push({ val, x });
        }

        const xAxisSvg = ticks.map(({ val, x }) =>
          `<line x1="${x}" y1="${marginTop}" x2="${x}" y2="${marginTop + chartHeight}" stroke="#eee" /><text x="${x}" y="${marginTop + chartHeight + 14}" text-anchor="middle" font-size="10" fill="#666">${val}</text>`
        ).join('');

        const yLabelsSvg = resvCodeLabels.map((label, idx) => {
          const y = marginTop + idx * (barHeight + barGap) + barHeight / 2 + 3;
          return `<text x="${marginLeft - 8}" y="${y}" text-anchor="end" font-size="10" fill="#333">${label}</text>`;
        }).join('');

        const barsSvg = resvCodeLabels.map((label, idx) => {
          const y = marginTop + idx * (barHeight + barGap);
          const c = DATA.resvCodeCounts[label] || 0;
          const w = Math.max(1, xScale(c));
          const color = '#4e79a7';
          const textX = marginLeft + w / 2;
          const textY = y + barHeight / 2 + 3;
          const xEnd = marginLeft + w;
          return `
            <g>
              <rect x="${marginLeft}" y="${y}" width="${w}" height="${barHeight}" fill="${color}" />
              <text x="${textX}" y="${textY}" text-anchor="middle" font-size="10" fill="#fff">${c}</text>
              <text x="${xEnd + 6}" y="${textY}" text-anchor="start" font-size="10" fill="#333">${c}</text>
            </g>`;
        }).join('');

        container.innerHTML = `
          <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
          <text x="16" y="${marginTop + chartHeight / 2}" transform="rotate(-90 16,${marginTop + chartHeight / 2})" text-anchor="middle" font-size="12" fill="#666">예약코드</text>
          <text x="${marginLeft + chartWidth / 2}" y="${marginTop + chartHeight + 28}" text-anchor="middle" font-size="12" fill="#666">건수</text>
          <line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${marginTop + chartHeight}" stroke="#9ca3af" stroke-width="1" />
          <line x1="${marginLeft}" y1="${marginTop + chartHeight}" x2="${marginLeft + chartWidth}" y2="${marginTop + chartHeight}" stroke="#9ca3af" stroke-width="1" />
          ${xAxisSvg}
          <g>${barsSvg}</g>
          <g>${yLabelsSvg}</g>
        `;
      }

      function showAnalProduct(){
        tabAnalProduct.classList.add('active');
        tabAnalResv.classList.remove('active');
        tabAnalProduct.setAttribute('aria-selected','true');
        tabAnalResv.setAttribute('aria-selected','false');
        tabsDimension.style.display = 'none';
        if (barsResv) barsResv.style.display = 'none';
        if (barsResvProduct) barsResvProduct.style.display = 'none';
        legendResv.classList.add('hidden');
        scrollResv.classList.add('hidden');
        scrollProducts.classList.remove('hidden');
        if (resvRatiosCard) resvRatiosCard.classList.add('hidden');
        if (resvLangTypeCard) resvLangTypeCard.classList.add('hidden');
        if (resvCodeChartCard) resvCodeChartCard.classList.add('hidden');
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
        if (yAxisLabel) yAxisLabel.textContent = '상품 코드';
        if (ylabelsProducts) ylabelsProducts.style.display = '';
        if (ylabelsResv) ylabelsResv.style.display = 'none';
        if (chartDesc) chartDesc.textContent = 'X축: 건수 · Y축: 상품 코드 (총 ' + TOTAL + ')';
        const resvNull = document.getElementById('resv-null-summary');
        if (resvNull) resvNull.classList.add('hidden');
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
        renderResvCodeChart();
      }
      tabAnalProduct.addEventListener('click', showAnalProduct);
      tabAnalResv.addEventListener('click', showAnalResv);
      
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
            if (role === 'type') title = escapeHtml(prod)+' · '+escapeHtml(cat)+' → 언어';
            else if (role === 'lang') title = escapeHtml(prod)+' · '+escapeHtml(cat)+' → 문의 유형';
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