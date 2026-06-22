// poro-search-utils.js  v1.8.2
;(function (root) {
  'use strict';

  // ---------- config ----------
  let MAP_URL = 'https://raw.githubusercontent.com/gagihal/poroscripts-data/main/utils/mcmsetmap.json';
  const LS_KEY = 'poro_mcm_setabbr_map_v1';
  const LS_TS  = 'poro_mcm_setabbr_map_ts_v1';
  const CACHE_MS = 1 * 3600 * 1000; // 1h

  // Product ID mapping (v5 includes improved TCGplayer matching from CardKaikki sheet)
  let IDMAP_URL = 'https://raw.githubusercontent.com/gagihal/poroscripts-data/main/utils/product-id-map-v2.json';
  const IDMAP_LS_KEY = 'poro_product_id_map_v5';
  const IDMAP_LS_TS  = 'poro_product_id_map_ts_v5';
  const IDMAP_CACHE_MS = 1 * 3600 * 1000; // 1h (hourly updates)

  // ---------- small helpers ----------
  const IGNORE = new Set(['full','art','secret','rare','hyper','alternative','alternate','reverse','holo','bs']);
  const PREF_RE = /^(tg|gg|rc|sv|h|sl|sh)\d+/i;

  function sanitize(s) {
    return String(s || '')
      .split(/\s+/)
      .filter(w => !IGNORE.has(w.toLowerCase()))
      .join(' ')
      .trim();
  }

  function firstNum(str) {
    if (!str) return '';
    const first = String(str).split('/')[0].toUpperCase();
    const m = first.match(PREF_RE);
    if (m) return m[0].toLowerCase();
    const d = first.match(/\d+/);
    return d ? d[0] : '';
  }

  function splitNameNum(txt) {
    const out = { name: [], num: '' };
    const parts = String(txt || '').trim().split(/\s+/);
    for (const w of parts) {
      if (!out.num && /\d/.test(w)) {
        if (/^lv\.\d+$/i.test(w)) { out.name.push(w); continue; }
        out.num = w.toUpperCase();
        break;
      }
      out.name.push(w);
    }
    return { name: out.name.join(' '), num: out.num };
  }

  function normalizeSetKey(s) {
    return String(s || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function fixDelta(q) {
    return String(q || '').replace(/\u03b4\s*Delta\s*Species/gi, 'delta');
  }

  function openNamed(url, name) {
    let w = window.open('', name);
    if (!w || w.closed) w = window.open('about:blank', name);
    if (!w) return; // popup blocked
    try { w.location.replace(url); w.focus(); }
    catch { window.open(url, name); }
  }

  // ---------- set-abbreviation map cache ----------
  let _abbrMap = null;
  let _abbrTs = 0;

  function _readLS() {
    try {
      const ts = parseInt(localStorage.getItem(LS_TS) || '0', 10);
      if (!ts || Date.now() - ts > CACHE_MS) return null;
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    return null;
  }

  function _writeLS(map) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(map || {}));
      localStorage.setItem(LS_TS, String(Date.now()));
    } catch {}
  }

  async function _fetchMap() {
    const r = await fetch(MAP_URL, { mode: 'cors' });
    if (!r.ok) throw new Error(`map fetch ${r.status}`);
    const js = await r.json();
    const lower = {};
    Object.entries(js).forEach(([k, v]) => { lower[String(k).toLowerCase()] = v; });
    return lower;
  }

  async function getAbbrMap() {
    // memory cache valid?
    if (_abbrMap && (Date.now() - _abbrTs) < CACHE_MS) return _abbrMap;

    // try localStorage cache
    const cached = _readLS();
    if (cached) {
      _abbrMap = cached; _abbrTs = Date.now();
      return _abbrMap;
    }

    // fetch fresh
    try {
      const fresh = await _fetchMap();
      _abbrMap = fresh; _abbrTs = Date.now();
      _writeLS(fresh);
      return _abbrMap;
    } catch (e) {
      // on failure, keep whatever we have or fall back to empty
      console.error('[PoroSearch] set-map load failed:', e);
      _abbrMap = _abbrMap || {};
      return _abbrMap;
    }
  }

  // ---------- public builders ----------
  /**
   * Build Cardmarket search queries.
   * @param {{name:string,setFull:string,number?:string}} p
   * @returns {Promise<{primary:string, backup:string}>}
   */
  async function buildMcmQuery(p) {
    const name = sanitize(p?.name);
    const pn = firstNum(p?.number || '');
    const map = await getAbbrMap();

    const key = normalizeSetKey(p?.setFull);
    let abbr = map[key] || '';
    if (!abbr) {
      const keyNoAdd = key
        .replace(/\s*[:\-–—]\s*additionals?$/i, '')
        .replace(/\s+additionals?$/i, '');
      abbr = map[keyNoAdd] || '';
    }

    let primary = name;
    if (abbr && /^\d+$/.test(pn)) primary = `${name} ${abbr}${pn}`;
    else if (abbr && pn)          primary = `${name} ${pn}`;
    else if (pn)                  primary = /^\d+$/.test(pn) ? `${name} ${pn.padStart(3, '0')}` : `${name} ${pn}`;

    let backup = name;
    if (pn) backup = /^\d+$/.test(pn) ? `${name} ${pn.padStart(3, '0')}` : `${name} ${pn}`;

    return { primary, backup };
  }

  /**
   * Build TCGplayer search query: name + last word of set (Expedition special-case) with delta fix.
   * @param {{name:string,setFull:string}} p
   * @returns {string}
   */
  function buildTcgQuery(p) {
    const clean = sanitize(splitNameNum(p?.name).name || p?.name);
    const setFull = String(p?.setFull || '');
    const last = /^expedition base set$/i.test(setFull)
      ? 'Expedition'
      : (setFull.split(/\s+/).pop() || '');
    return fixDelta(sanitize(`${clean} ${last}`));
  }

  // ---------- admin/override hooks ----------
  function setMapUrl(url) { if (url) MAP_URL = String(url); }
  function setAbbrMap(obj) {
    if (obj && typeof obj === 'object') {
      const lower = {};
      Object.entries(obj).forEach(([k, v]) => { lower[String(k).toLowerCase()] = v; });
      _abbrMap = lower; _abbrTs = Date.now();
      _writeLS(lower);
    }
  }
  async function preloadAbbrMap() { await getAbbrMap(); }

  // ---------- product ID mapping cache ----------
  let _idMap = null;
  let _idMapTs = 0;

  function _readIdMapLS() {
    try {
      const ts = parseInt(localStorage.getItem(IDMAP_LS_TS) || '0', 10);
      if (!ts || Date.now() - ts > IDMAP_CACHE_MS) return null;
      const raw = localStorage.getItem(IDMAP_LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    return null;
  }

  function _writeIdMapLS(map) {
    try {
      localStorage.setItem(IDMAP_LS_KEY, JSON.stringify(map || {}));
      localStorage.setItem(IDMAP_LS_TS, String(Date.now()));
    } catch {}
  }

  async function _fetchIdMap() {
    const r = await fetch(IDMAP_URL, { mode: 'cors' });
    if (!r.ok) throw new Error(`ID map fetch ${r.status}`);
    return await r.json();
  }

  async function getIdMap() {
    // memory cache valid?
    if (_idMap && (Date.now() - _idMapTs) < IDMAP_CACHE_MS) return _idMap;

    // try localStorage cache
    const cached = _readIdMapLS();
    if (cached) {
      _idMap = cached; _idMapTs = Date.now();
      return _idMap;
    }

    // fetch fresh
    try {
      const fresh = await _fetchIdMap();
      _idMap = fresh; _idMapTs = Date.now();
      _writeIdMapLS(fresh);
      return _idMap;
    } catch (e) {
      console.error('[PoroSearch] ID map load failed:', e);
      _idMap = _idMap || {};
      return _idMap;
    }
  }

  /**
   * Get MCM product ID from PoroId.
   * @param {string|number} poroId
   * @returns {Promise<string|null>} MCM product ID or null if not found
   */
  async function getMcmId(poroId) {
    const map = await getIdMap();
    const entry = map[String(poroId)];
    const result = entry?.mcmId || null;
    console.log('[PoroSearch] getMcmId lookup:', { poroId, mapSize: Object.keys(map).length, result });
    return result;
  }

  /**
   * Get TCGplayer product ID from PoroId.
   * @param {string|number} poroId
   * @returns {Promise<string|null>} TCGplayer product ID or null if not found
   */
  async function getTcgId(poroId) {
    const map = await getIdMap();
    const entry = map[String(poroId)];
    const result = entry?.tcgId || null;
    return result;
  }

  /**
   * Build direct MCM product URL from PoroId, or null if not in mapping.
   * @param {string|number} poroId
   * @returns {Promise<string|null>}
   */
  async function buildMcmDirectUrl(poroId) {
    const mcmId = await getMcmId(poroId);
    // Treat "0" or 0 as invalid ID
    if (!mcmId || mcmId === '0' || mcmId === 0) return null;
    return `https://www.cardmarket.com/Pokemon/Products?idProduct=${mcmId}`;
  }

  /**
   * Build direct TCGplayer product URL from PoroId, or null if not in mapping.
   * @param {string|number} poroId
   * @returns {Promise<string|null>}
   */
  async function buildTcgDirectUrl(poroId) {
    const tcgId = await getTcgId(poroId);
    // Treat "0" or 0 as invalid ID
    if (!tcgId || tcgId === '0' || tcgId === 0) return null;
    return `https://www.tcgplayer.com/product/${tcgId}`;
  }

  /**
   * Get Poro card ID from MCM product ID (reverse lookup).
   * @param {string|number} mcmId
   * @returns {Promise<string|null>} Poro card ID or null if not found
   */
  async function getPoroIdFromMcm(mcmId) {
    const map = await getIdMap();
    const mcmIdStr = String(mcmId);
    // Search through all entries to find matching MCM ID
    for (const [poroId, entry] of Object.entries(map)) {
      if (entry.mcmId === mcmIdStr) {
        console.log('[PoroSearch] getPoroIdFromMcm lookup:', { mcmId, result: poroId });
        return poroId;
      }
    }
    console.log('[PoroSearch] getPoroIdFromMcm lookup:', { mcmId, result: null });
    return null;
  }

  /**
   * Get TCG product ID from MCM product ID (reverse lookup via Poro ID).
   * @param {string|number} mcmId
   * @returns {Promise<string|null>} TCG product ID or null if not found
   */
  async function getTcgIdFromMcm(mcmId) {
    const poroId = await getPoroIdFromMcm(mcmId);
    if (!poroId) return null;
    return await getTcgId(poroId);
  }

  /**
   * Get Poro card ID from TCG product ID (reverse lookup).
   * @param {string|number} tcgId
   * @returns {Promise<string|null>} Poro card ID or null if not found
   */
  async function getPoroIdFromTcg(tcgId) {
    const map = await getIdMap();
    const tcgIdStr = String(tcgId);
    // Search through all entries to find matching TCG ID
    for (const [poroId, entry] of Object.entries(map)) {
      if (entry.tcgId === tcgIdStr) {
        console.log('[PoroSearch] getPoroIdFromTcg lookup:', { tcgId, result: poroId });
        return poroId;
      }
    }
    console.log('[PoroSearch] getPoroIdFromTcg lookup:', { tcgId, result: null });
    return null;
  }

  /**
   * Get MCM product ID from TCG product ID (reverse lookup via Poro ID).
   * @param {string|number} tcgId
   * @returns {Promise<string|null>} MCM product ID or null if not found
   */
  async function getMcmIdFromTcg(tcgId) {
    const poroId = await getPoroIdFromTcg(tcgId);
    if (!poroId) return null;
    return await getMcmId(poroId);
  }

  async function preloadIdMap() { await getIdMap(); }
  function setIdMapUrl(url) { if (url) IDMAP_URL = String(url); }

  // ---------- URL builders ----------
  /**
   * Build complete TCGplayer search URL.
   * @param {string} query - The search query
   * @returns {string} Full TCGplayer URL
   */
  function buildTcgUrl(query) {
    return 'https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q='
      + encodeURIComponent(query) + '&view=grid';
  }

  /**
   * Build complete Cardmarket search URL.
   * @param {string} query - The search query
   * @returns {string} Full Cardmarket URL
   */
  function buildMcmSearchUrl(query) {
    return 'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=' + encodeURIComponent(query);
  }

  /**
   * Build Poromagia store manager search URL.
   * @param {{name:string, setFull:string}} params - Card name and set
   * @returns {string} Full Poromagia store manager URL
   */
  function buildPmUrl(params) {
    const name = encodeURIComponent(params.name || '');
    const set = encodeURIComponent(params.setFull || '');
    return `https://poromagia.com/store_manager/pokemon/?name=${name}&set=${set}`;
  }

  // ---------- button creation utilities ----------
  /**
   * Create a TCGplayer search button with ID-based direct link support.
   * @param {{name:string, setFull:string, cardId?:string}} cardData - Card name, set information, and optional card ID
   * @param {object} options - Optional styling and behavior
   * @param {string} options.text - Button text (default: 'T')
   * @param {string} options.className - CSS class name
   * @param {string} options.style - CSS style string
   * @param {string} options.elementType - Element type: 'button' or 'a' (default: 'button')
   * @param {boolean} options.showDirectIndicator - Show visual indicator for direct links (default: true)
   * @returns {Promise<HTMLElement>} The created button or link
   */
  async function createTcgButton(cardData, options = {}) {
    const { text = 'T', className = '', style = '', showDirectIndicator = true, elementType = 'button' } = options;

    // Try to get direct TCGplayer URL from ID mapping (skip if ID is 0 or "0")
    const hasValidId = cardData.cardId && cardData.cardId !== '0' && cardData.cardId !== 0;
    const tcgDirectUrl = hasValidId ? await buildTcgDirectUrl(cardData.cardId) : null;
    const usingFallback = !tcgDirectUrl;

    // Build search query as fallback
    const query = buildTcgQuery(cardData);
    const searchUrl = buildTcgUrl(query);

    const btn = document.createElement(elementType);
    btn.textContent = text;
    btn.title = tcgDirectUrl ? 'Direct TCGplayer link' : 'Search on TCGplayer';
    if (elementType === 'button') {
      btn.type = 'button';
    } else {
      btn.href = '#';
    }
    if (className) btn.className = className;
    if (style) btn.style.cssText = style;

    // Visual indicator for direct link
    if (showDirectIndicator && tcgDirectUrl) {
      btn.style.borderLeft = '3px solid #2196F3'; // Blue for TCGplayer
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = tcgDirectUrl || searchUrl;
      // Silently fall back to search if no direct link available
      openNamed(url, 'TCGWindow');
    });

    return btn;
  }

  /**
   * Create a Cardmarket (MCM) search button with ID-based direct link support.
   * @param {{name:string, setFull:string, number?:string, cardId?:string}} cardData - Card information
   * @param {object} options - Optional styling and behavior
   * @param {string} options.text - Button text (default: 'M')
   * @param {string} options.className - CSS class name
   * @param {string} options.style - CSS style string
   * @param {string} options.elementType - Element type: 'button' or 'a' (default: 'button')
   * @param {boolean} options.showDirectIndicator - Show green border for direct links (default: true)
   * @returns {Promise<HTMLElement>} The created button or link
   */
  async function createMcmButton(cardData, options = {}) {
    const { text = 'M', className = '', style = '', showDirectIndicator = true, elementType = 'button' } = options;

    // Try to get direct MCM URL from ID mapping (skip if ID is 0 or "0")
    const hasValidId = cardData.cardId && cardData.cardId !== '0' && cardData.cardId !== 0;
    const mcmDirectUrl = hasValidId ? await buildMcmDirectUrl(cardData.cardId) : null;

    // Build search query fallbacks
    const { primary: mcmQ, backup: mcmBackupQ } = await buildMcmQuery({
      name: cardData.name,
      setFull: cardData.setFull,
      number: cardData.number
    });

    const mcmSearchUrl = buildMcmSearchUrl(mcmQ);
    const mcmBackupSearchUrl = buildMcmSearchUrl(mcmBackupQ);
    const usingFallback = !mcmDirectUrl;

    const btn = document.createElement(elementType);
    btn.textContent = text;
    btn.title = mcmDirectUrl ? 'Direct MCM link' : 'Search on Cardmarket (Alt = backup)';
    if (elementType === 'button') {
      btn.type = 'button';
    } else {
      btn.href = '#';
    }
    if (className) btn.className = className;
    if (style) btn.style.cssText = style;

    // Visual indicator for direct link
    if (showDirectIndicator && mcmDirectUrl) {
      btn.style.borderLeft = '3px solid #4CAF50';
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      let url;
      if (mcmDirectUrl && !e.altKey) {
        url = mcmDirectUrl;
      } else if (e.altKey && mcmBackupSearchUrl) {
        url = mcmBackupSearchUrl;
      } else if (mcmSearchUrl) {
        url = mcmSearchUrl;
      } else {
        return;
      }
      openNamed(url, 'MCMWindow');
    });

    return btn;
  }

  /**
   * Create a TCGplayer Seller Admin button with ID-based direct link support.
   * @param {{name:string, setFull:string, number?:string, cardId?:string}} cardData - Card information
   * @param {object} options - Optional styling and behavior
   * @param {string} options.text - Button text (default: 'TCGA')
   * @param {string} options.className - CSS class name
   * @param {string} options.style - CSS style string
   * @param {string} options.elementType - Element type: 'button' or 'a' (default: 'button')
   * @param {boolean} options.showDirectIndicator - Show orange border for direct links (default: true)
   * @returns {Promise<HTMLElement>} The created button or link
   */
  async function createTcgSellerButton(cardData, options = {}) {
    const { text = 'TCGA', className = '', style = '', showDirectIndicator = true, elementType = 'button' } = options;

    // Try to get TCG product ID from ID mapping (skip if ID is 0 or "0")
    const hasValidId = cardData.cardId && cardData.cardId !== '0' && cardData.cardId !== 0;
    const tcgId = hasValidId ? await getTcgId(cardData.cardId) : null;

    // Build direct admin URL if we have a valid TCG ID
    const directUrl = (tcgId && tcgId !== '0' && tcgId !== 0)
      ? `https://store.tcgplayer.com/admin/product/manage/${tcgId}`
      : null;

    // Build search query as fallback using same cleaning as TCG search
    const query = buildTcgQuery(cardData);
    const searchUrl = `https://store.tcgplayer.com/admin/product/catalog?SearchValue=${encodeURIComponent(query)}`;

    const btn = document.createElement(elementType);
    btn.textContent = text;
    btn.title = directUrl ? 'Direct TCGplayer Seller link' : 'Search in TCGplayer Seller catalog';
    if (elementType === 'button') {
      btn.type = 'button';
    } else {
      btn.href = '#';
    }
    if (className) btn.className = className;
    if (style) btn.style.cssText = style;

    // Visual indicator for direct link (orange to distinguish from regular TCG)
    if (showDirectIndicator && directUrl) {
      btn.style.borderLeft = '3px solid #FF9800'; // Orange for TCG Seller
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = directUrl || searchUrl;
      openNamed(url, 'TCGSellerWindow');
    });

    return btn;
  }

  /**
   * Create a Poromagia store manager search button.
   * @param {{name:string, setFull:string}} cardData - Card name and set information
   * @param {object} options - Optional styling and behavior
   * @param {string} options.text - Button text (default: 'PM')
   * @param {string} options.className - CSS class name
   * @param {string} options.style - CSS style string
   * @param {string} options.elementType - Element type: 'button' or 'a' (default: 'button')
   * @returns {HTMLElement} The created button or link
   */
  function createPmButton(cardData, options = {}) {
    const { text = 'PM', className = '', style = '', elementType = 'button' } = options;
    const url = buildPmUrl(cardData);

    const btn = document.createElement(elementType);
    btn.textContent = text;
    btn.title = 'Search on Poromagia store manager';
    if (elementType === 'button') {
      btn.type = 'button';
    } else {
      btn.href = '#';
    }
    if (className) btn.className = className;
    if (style) btn.style.cssText = style;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openNamed(url, 'PMWindow');
    });

    return btn;
  }

  /**
   * Create both TCG and MCM buttons together.
   * @param {{name:string, setFull:string, number?:string, cardId?:string}} cardData - Card information
   * @param {object} options - Optional styling and behavior
   * @param {string} options.tcgText - TCG button text (default: 'T')
   * @param {string} options.mcmText - MCM button text (default: 'M')
   * @param {string} options.tcgClassName - TCG button CSS class
   * @param {string} options.mcmClassName - MCM button CSS class
   * @param {string} options.tcgStyle - TCG button CSS style
   * @param {string} options.mcmStyle - MCM button CSS style
   * @param {boolean} options.showDirectIndicator - Show visual indicators for direct links (default: true)
   * @returns {Promise<{tcgButton:HTMLButtonElement, mcmButton:HTMLButtonElement}>} Both buttons
   */
  async function createSearchButtons(cardData, options = {}) {
    const tcgButton = await createTcgButton(cardData, {
      text: options.tcgText,
      className: options.tcgClassName,
      style: options.tcgStyle,
      showDirectIndicator: options.showDirectIndicator
    });

    const mcmButton = await createMcmButton(cardData, {
      text: options.mcmText,
      className: options.mcmClassName,
      style: options.mcmStyle,
      showDirectIndicator: options.showDirectIndicator
    });

    return { tcgButton, mcmButton };
  }

  // ============================================================
  // PoroIds — id resolution behind one interface (swappable backend)
  // ============================================================
  // Today: static id map + cached reverse indexes (no per-row O(n) scan).
  // Later: same interface can be backed by the live card-ids API.
  let _revTs = -1, _mcmRev = null, _tcgRev = null;
  async function _ensureRev() {
    const map = await getIdMap();
    if (_mcmRev && _revTs === _idMapTs) return;
    _mcmRev = Object.create(null);
    _tcgRev = Object.create(null);
    for (const [poro, e] of Object.entries(map)) {
      if (e.mcmId && !(e.mcmId in _mcmRev)) _mcmRev[e.mcmId] = poro;
      if (e.tcgId && e.tcgId !== '0' && !(e.tcgId in _tcgRev)) _tcgRev[e.tcgId] = poro;
    }
    _revTs = _idMapTs;
  }

  let PARENTMAP_URL = 'https://raw.githubusercontent.com/gagihal/poroscripts-data/main/utils/parent-product-to-card.json';
  const PARENT_LS_KEY = 'poro_parent_card_map';
  const PARENT_LS_TS = 'poro_parent_card_map_ts';
  const PARENT_CACHE_MS = 7 * 24 * 3600 * 1000;
  let _parentMap = null, _parentTs = 0;
  async function _getParentMap() {
    if (_parentMap && Date.now() - _parentTs < PARENT_CACHE_MS) return _parentMap;
    try {
      const ts = parseInt(localStorage.getItem(PARENT_LS_TS) || '0', 10);
      if (ts && Date.now() - ts < PARENT_CACHE_MS) {
        const raw = localStorage.getItem(PARENT_LS_KEY);
        if (raw) { _parentMap = JSON.parse(raw); _parentTs = Date.now(); return _parentMap; }
      }
    } catch {}
    try {
      const r = await fetch(PARENTMAP_URL, { mode: 'cors' });
      if (r.ok) {
        _parentMap = await r.json(); _parentTs = Date.now();
        try {
          localStorage.setItem(PARENT_LS_KEY, JSON.stringify(_parentMap));
          localStorage.setItem(PARENT_LS_TS, String(Date.now()));
        } catch {}
      }
    } catch (e) { console.warn('[PoroIds] parent map load failed:', e); }
    return _parentMap || (_parentMap = {});
  }

  // kind: 'poro' (identity) | 'mcm' | 'tcg' | 'parent' -> Poro card id (string) or null
  async function toPoro(kind, value) {
    if (value == null || value === '') return null;
    const v = String(value).trim();
    if (kind === 'poro') return v;
    if (kind === 'mcm') { await _ensureRev(); return _mcmRev[v] || null; }
    if (kind === 'tcg') { await _ensureRev(); return _tcgRev[v] || null; }
    if (kind === 'parent') { const m = await _getParentMap(); return m[v] || null; }
    return null;
  }
  async function toPoroBatch(kind, values) {
    const out = new Map();
    if (kind === 'mcm' || kind === 'tcg') await _ensureRev();
    else if (kind === 'parent') await _getParentMap();
    for (const val of values) out.set(val, await toPoro(kind, val));
    return out;
  }

  const PoroIds = {
    toPoro, toPoroBatch,
    setParentMapUrl(url) { if (url) PARENTMAP_URL = String(url); },
  };

  // ============================================================
  // PoroButtons — declarative row-enhancer engine
  // ============================================================
  // A new spot = one enhance({items, card, buttons, place}) call.
  const STYLES = {
    inline: 'display:inline-block;margin:0 0 0 4px;padding:0 5px;font-size:10px;line-height:1.4;vertical-align:middle;',
    pill:   'display:inline-block;font-size:10px;line-height:1.2;padding:2px 4px;margin-left:4px;border-radius:4px;border:1px solid #888;background:#1a1a1a;color:#fff;cursor:pointer;text-decoration:none;font-family:sans-serif;white-space:nowrap;',
    block:  'display:block;margin:5px auto 0;padding:2px 7px;font-size:10px;line-height:1.35;',
  };

  // registry: kind -> {default label, factory returning Promise<HTMLElement>}
  const LINKS = {
    MCM:  { text: 'MCM',  make: (cd, o) => createMcmButton(cd, o) },
    TCG:  { text: 'TCG',  make: (cd, o) => createTcgButton(cd, o) },
    TCGA: { text: 'TCGA', make: (cd, o) => createTcgSellerButton(cd, o) },
    PM:   { text: 'PM',   make: (cd, o) => Promise.resolve(createPmButton(cd, o)) },
  };

  function _normButtons(buttons) {
    return (buttons || []).map((b) => {
      if (typeof b === 'string') return { kind: b, text: (LINKS[b] || {}).text };
      if (b && b.kind) return { kind: b.kind, text: b.text || (LINKS[b.kind] || {}).text, card: b.card };
      const k = Object.keys(b)[0]; // shorthand {KIND:'text'}
      return { kind: k, text: b[k] };
    }).filter((d) => LINKS[d.kind]);
  }

  async function enhance(spec) {
    const {
      items, card, buttons, style = 'inline', place = {},
      observe = true, spa = false, elementType = 'a',
      once = 'poroBtns', bar: barOpts = {},
    } = spec;
    const single = items === 'self';
    const styleCss = STYLES[style] || style || '';
    const defs = _normButtons(buttons);

    function getItems() {
      if (single) return [document.body];
      if (typeof items === 'function') return items() || [];
      return Array.prototype.slice.call(document.querySelectorAll(items));
    }

    async function build(baseCd) {
      const out = [];
      for (const d of defs) {
        const cd = d.card ? d.card(baseCd) : baseCd; // optional per-button cardData transform
        const el = await LINKS[d.kind].make(cd, { text: d.text, style: styleCss, elementType });
        out.push({ kind: d.kind, el });
      }
      return out;
    }

    function makeBar(built) {
      const bar = document.createElement('span');
      bar.className = 'poro-btn-bar';
      bar.style.cssText = 'display:inline-flex;flex-wrap:wrap;align-items:center;gap:' +
        (barOpts.gap || '4px') + ';' + (barOpts.style || '');
      built.forEach((b) => bar.appendChild(b.el));
      return bar;
    }

    function floatingBox() {
      let box = document.getElementById('poro-floating-btns');
      if (!box) {
        box = document.createElement('div');
        box.id = 'poro-floating-btns';
        const side = place.floating === 'bottom-left' ? 'left:16px' : 'right:16px';
        box.style.cssText = 'position:fixed;bottom:16px;' + side + ';z-index:999999;' +
          'background:rgba(20,22,28,0.96);border:1px solid #3a3f4b;border-radius:8px;' +
          'padding:8px 10px;box-shadow:0 2px 10px rgba(0,0,0,.5);';
        document.body.appendChild(box);
      } else {
        box.innerHTML = ''; // refresh on re-scan (single-item / SPA nav)
      }
      return box;
    }

    function placeButtons(item, built) {
      if (typeof place === 'function') { place(item, makeBar(built), built); return; }
      if (place.distribute) {
        for (const { kind, el } of built) {
          const sel = place.distribute[kind];
          const target = sel && item.querySelector ? item.querySelector(sel) : null;
          (target || item).appendChild(el);
        }
        return;
      }
      const bar = makeBar(built);
      if (place.floating) { floatingBox().appendChild(bar); return; }
      if (place.after && item.querySelector) {
        const ref = item.querySelector(place.after);
        if (ref && ref.parentNode) { ref.insertAdjacentElement('afterend', bar); return; }
      }
      const tgt = place.append && item.querySelector ? item.querySelector(place.append) : null;
      (tgt || item).appendChild(bar);
    }

    async function enhanceItem(item) {
      if (!single && item.dataset && item.dataset[once] === '1') return;
      let info = null;
      try { info = card(item); } catch (e) { info = null; }
      if (!single && item.dataset) item.dataset[once] = '1';
      if (!info) return;
      const poroId = info.id ? await PoroIds.toPoro(info.id.kind, info.id.value) : null;
      const cd = Object.assign({}, info, { cardId: poroId }); // keep name/setFull/number + any extras
      delete cd.id;
      placeButtons(item, await build(cd));
    }

    async function scan() {
      for (const el of getItems()) {
        try { await enhanceItem(el); } catch (e) { console.warn('[PoroButtons]', e); }
      }
    }

    scan();

    if (observe) {
      let t = null;
      const target = (typeof observe === 'string') ? document.querySelector(observe) : document.body;
      if (target) {
        new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 250); })
          .observe(target, { childList: true, subtree: true });
      }
    }
    if (spa) {
      const fire = () => setTimeout(scan, 400);
      ['pushState', 'replaceState'].forEach((m) => {
        const o = history[m];
        history[m] = function () { const r = o.apply(this, arguments); window.dispatchEvent(new Event('poro-loc')); return r; };
      });
      window.addEventListener('popstate', () => window.dispatchEvent(new Event('poro-loc')));
      window.addEventListener('poro-loc', fire);
      let last = location.href;
      setInterval(() => { if (location.href !== last) { last = location.href; fire(); } }, 1000);
    }
  }

  const PoroButtons = { enhance, LINKS, STYLES };

  // ---------- export ----------
  const api = {
    // utils
    sanitize, splitNameNum, firstNum, normalizeSetKey, fixDelta, openNamed,
    // builders
    buildMcmQuery, buildTcgQuery,
    // URL builders
    buildTcgUrl, buildMcmSearchUrl, buildPmUrl,
    // ID mapping (v1.3.0: MCM IDs, v1.5.0: TCG IDs, v1.6.0: reverse lookups, v1.6.2: TCG reverse lookups, v1.7.0: improved TCG coverage, v1.7.1: corrected TCG matching, v1.7.2: handle ID 0 as fallback, v1.7.4: treat "0" as invalid in buildDirectUrl)
    getMcmId, getTcgId, buildMcmDirectUrl, buildTcgDirectUrl,
    getPoroIdFromMcm, getTcgIdFromMcm, getPoroIdFromTcg, getMcmIdFromTcg,
    preloadIdMap, setIdMapUrl,
    // button creation (v1.4.0: initial, v1.5.0: TCG direct links, v1.6.0: PM button, v1.7.2: removed fallback alert, v1.7.3: elementType support, v1.8.0: TCG Seller button)
    createTcgButton, createMcmButton, createTcgSellerButton, createPmButton, createSearchButtons,
    // cache/admin
    preloadAbbrMap, setAbbrMap, setMapUrl,
    // meta
    version: '2.0.1'
  };

  root.PoroSearch = api;
  root.PoroIds = PoroIds;
  root.PoroButtons = PoroButtons;

})(typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
