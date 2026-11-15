// Playzone game 1: Pizza & Cake Designer (creative, no score). Everything is drawn as local SVG; "Save Image"
// turns the finished artwork (only the creation, no buttons) into a PNG with a canvas. No server, no libraries.
// Tap a decoration to add it, or drag it onto the canvas. Drag a placed decoration to move it; tap it, then Remove.
(() => {
  'use strict';

  const root = window;
  const S = 400;                                    // artwork is a 400x400 SVG space
  const clamp = (n) => Math.max(30, Math.min(S - 30, n));
  const rand = (min, max) => min + Math.random() * (max - min);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // ---------- artwork ----------
  const SHAPES = [
    { id: 'round', label: '⚪ Round', cy: 200, draw: (a) => `<circle cx="200" cy="200" r="165" ${a}/>` },
    { id: 'square', label: '⬜ Square', cy: 200, draw: (a) => `<rect x="44" y="44" width="312" height="312" rx="34" ${a}/>` },
    { id: 'heart', label: '❤️ Heart', cy: 205, draw: (a) => `<path d="M200 345 C30 235 40 95 130 78 C170 72 195 95 200 122 C205 95 230 72 270 78 C360 95 370 235 200 345Z" ${a}/>` },
    { id: 'oval', label: '🥚 Oval', cy: 200, draw: (a) => `<ellipse cx="200" cy="200" rx="172" ry="132" ${a}/>` }
  ];
  const KINDS = {
    pizza: {
      title: 'Pizza', file: 'my-pizza.png', icon: '🍕', innerScale: 0.86, outerLabel: 'Crust', innerLabel: 'Sauce',
      outer: [['Golden', '#e9b872'], ['Light', '#f6d9a0'], ['Wholemeal', '#c58a4d']],
      inner: [['Tomato', '#e5483b'], ['Cream', '#f7ecd3'], ['Pesto', '#8fbf4d']],
      decos: [
        ['cheese', 'Cheese', '<path d="M-26 8Q-30-14-8-22Q14-30 26-8Q32 14 8 22Q-14 28-26 8Z" fill="#ffd54a" stroke="#f0b400" stroke-width="3"/><circle cx="-8" cy="-2" r="4" fill="#f7c600"/><circle cx="10" cy="6" r="3" fill="#f7c600"/>'],
        ['pepperoni', 'Pepperoni', '<circle r="24" fill="#c62828" stroke="#8e1b1b" stroke-width="3"/><circle cx="-8" cy="-6" r="3.5" fill="#e57373"/><circle cx="9" cy="-9" r="3" fill="#e57373"/><circle cx="4" cy="9" r="3.5" fill="#e57373"/>'],
        ['mushroom', 'Mushroom', '<rect x="-9" y="2" width="18" height="22" rx="6" fill="#f5e6d3" stroke="#8d6e63" stroke-width="3"/><path d="M-26 6A26 24 0 0 1 26 6Z" fill="#d7b899" stroke="#8d6e63" stroke-width="3"/>'],
        ['olive', 'Olive', '<circle r="17" fill="#2b2b2b"/><circle r="7" fill="#e8f5c8"/>'],
        ['tomato', 'Tomato', '<circle r="23" fill="#e53935" stroke="#b71c1c" stroke-width="3"/><path d="M0-16V16M-14-8L14 8M14-8L-14 8" stroke="#ff8a80" stroke-width="2.5" stroke-linecap="round"/>'],
        ['pepper', 'Pepper', '<circle r="19" fill="none" stroke="#43a047" stroke-width="9"/>'],
        ['pineapple', 'Pineapple', '<path d="M-24 14L0-22L24 14Z" fill="#ffd740" stroke="#f9a825" stroke-width="3" stroke-linejoin="round"/><circle cx="-4" cy="4" r="3" fill="#f9a825"/><circle cx="7" cy="8" r="3" fill="#f9a825"/>'],
        ['basil', 'Basil', '<path d="M0 22C-30 4-20-22 0-26C20-22 30 4 0 22Z" fill="#388e3c" stroke="#1b5e20" stroke-width="3"/><path d="M0 20V-18" stroke="#a5d6a7" stroke-width="2.5"/>']
      ]
    },
    cake: {
      title: 'Cake', file: 'my-cake.png', icon: '🎂', innerScale: 0.9, outerLabel: 'Sponge', innerLabel: 'Icing',
      outer: [['Vanilla', '#f3d9a4'], ['Chocolate', '#7a4a2b'], ['Strawberry', '#f4a6b8']],
      inner: [['Pink', '#ffb3d1'], ['White', '#fff7ee'], ['Blue', '#9fd3ff'], ['Yellow', '#ffe27a'], ['Purple', '#cdb4ff'], ['Green', '#b8e6b0'], ['Chocolate', '#8a5a3c']],
      decos: [
        ['cream', 'Cream', '<path d="M-26 14Q-30-4-12-8Q-16-26 4-24Q22-26 18-8Q32-4 26 14Z" fill="#fffdf7" stroke="#e0d3bd" stroke-width="3" stroke-linejoin="round"/>'],
        ['strawberry', 'Strawberry', '<path d="M0 24C-28 8-26-16-10-18C-4-20 4-20 10-18C26-16 28 8 0 24Z" fill="#e53935" stroke="#b71c1c" stroke-width="3"/><path d="M-10-20L0-28L10-20L0-14Z" fill="#43a047"/><circle cx="-8" cy="-4" r="2" fill="#ffe0b2"/><circle cx="6" cy="0" r="2" fill="#ffe0b2"/><circle cx="-2" cy="10" r="2" fill="#ffe0b2"/>'],
        ['cherry', 'Cherry', '<path d="M-8-2Q-6-18 6-26M14 0Q12-16 6-26" stroke="#2e7d32" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="-8" cy="10" r="14" fill="#c2185b"/><circle cx="14" cy="12" r="12" fill="#d81b60"/><circle cx="-12" cy="6" r="3" fill="#f48fb1"/>'],
        ['blueberry', 'Blueberry', '<circle r="16" fill="#3f51b5" stroke="#283593" stroke-width="3"/><circle cx="-5" cy="-5" r="4" fill="#7986cb"/><path d="M0 0L3 4L0 8L-3 4Z" fill="#1a237e"/>'],
        ['candle', 'Candle', '<rect x="-6" y="-8" width="12" height="34" rx="3" fill="#4fc3f7" stroke="#0288d1" stroke-width="2.5"/><path d="M-6 4L6-2M-6 16L6 10" stroke="#fff" stroke-width="3"/><path d="M0-32C-10-20-6-12 0-10C6-12 10-20 0-32Z" fill="#ffb300"/><path d="M0-24C-4-18-2-14 0-13C2-14 4-18 0-24Z" fill="#fff59d"/>'],
        ['sprinkles', 'Sprinkles', '<g stroke-width="5" stroke-linecap="round"><path d="M-20-10l8-4" stroke="#ef5350"/><path d="M0-20l2 8" stroke="#42a5f5"/><path d="M14-6l8 3" stroke="#ffee58"/><path d="M-14 8l7 5" stroke="#66bb6a"/><path d="M6 10l8-3" stroke="#ab47bc"/><path d="M-2-4l5 5" stroke="#ff9800"/><path d="M18 18l-3 7" stroke="#ec407a"/><path d="M-24 22l6-2" stroke="#26c6da"/></g>'],
        ['star', 'Star', '<path d="M0-26L7-8L26-8L11 4L17 23L0 12L-17 23L-11 4L-26-8L-7-8Z" fill="#ffd600" stroke="#f9a825" stroke-width="3" stroke-linejoin="round"/>'],
        ['flower', 'Flower', '<g fill="#f48fb1" stroke="#ec407a" stroke-width="2"><circle cx="0" cy="-15" r="11"/><circle cx="14" cy="-5" r="11"/><circle cx="9" cy="13" r="11"/><circle cx="-9" cy="13" r="11"/><circle cx="-14" cy="-5" r="11"/></g><circle r="8" fill="#ffd54f" stroke="#f9a825" stroke-width="2"/>']
      ]
    }
  };

  function baseMarkup(kind, shape, outer, inner) {
    const k = KINDS[kind];
    const sh = SHAPES.find(s => s.id === shape) || SHAPES[0];
    const scale = `translate(200 ${sh.cy}) scale(${k.innerScale}) translate(-200 -${sh.cy})`;
    return sh.draw(`fill="${outer}" stroke="rgba(0,0,0,.22)" stroke-width="6"`)
      + `<g transform="${scale}">${sh.draw(`fill="${inner}" stroke="rgba(0,0,0,.12)" stroke-width="3"`)}</g>`;
  }

  const decoSvg = (kind, type) => (KINDS[kind].decos.find(d => d[0] === type) || [0, 0, ''])[2];
  const itemTransform = (it) => `translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${it.rot})`;

  // The finished creation only: background, base, decorations. No selection ring, no hit areas, no interface.
  function artworkSvg(state, size) {
    const items = state.items.map(it => `<g transform="${itemTransform(it)}">${decoSvg(state.kind, it.type)}</g>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${S} ${S}">`
      + `<rect width="${S}" height="${S}" fill="#fff4e0"/>${baseMarkup(state.kind, state.shape, state.outer, state.inner)}${items}</svg>`;
  }

  // SVG -> PNG blob through a canvas. A data: URL keeps the canvas untainted (works in Safari on iPad).
  function svgToPng(svgText, size) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          canvas.getContext('2d').drawImage(img, 0, 0, size, size);
          if (canvas.toBlob) { canvas.toBlob(b => (b ? resolve(b) : reject(new Error('png'))), 'image/png'); return; }
          const bin = atob(canvas.toDataURL('image/png').split(',')[1]);
          resolve(new Blob([Uint8Array.from(bin, c => c.charCodeAt(0))], { type: 'image/png' }));
        } catch (error) { reject(error); }
      };
      img.onerror = () => reject(new Error('image'));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    });
  }

  // ---------- game ----------
  function mount(host) {
    let state = null;                        // { kind, shape, outer, inner, items[], selected }
    let nextId = 1;
    let drag = null;
    let svg = null;
    let saveUrl = null;
    let alive = true;

    function stopDragListeners() {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
    }
    function freeSaveUrl() {
      if (saveUrl) { try { URL.revokeObjectURL(saveUrl); } catch (error) { /* ignore */ } saveUrl = null; }
    }

    // ----- choose pizza or cake -----
    function showChoose() {
      stopDragListeners();
      freeSaveUrl();
      drag = null;
      state = null;
      host.innerHTML = '';
      const box = el('div', 'pz-choose');
      box.append(el('h3', '', 'What will you make?'));
      const row = el('div', 'pz-choose-row');
      Object.keys(KINDS).forEach(kind => {
        const b = el('button', `pz-card pz-big pz-pick-${kind}`);
        b.type = 'button';
        b.dataset.kind = kind;
        b.append(el('span', 'pz-icon', KINDS[kind].icon), el('strong', 'pz-title', KINDS[kind].title));
        b.addEventListener('click', () => startDesign(kind));
        row.append(b);
      });
      box.append(row);
      host.append(box);
    }

    function startDesign(kind) {
      const k = KINDS[kind];
      state = { kind, shape: 'round', outer: k.outer[0][1], inner: k.inner[0][1], items: [], selected: null };
      buildDesigner();
      redraw();
    }

    // ----- designer screen -----
    const panelParts = {};
    function swatchRow(title, list, key) {
      const wrap = el('div', 'pz-group');
      wrap.append(el('p', 'pz-group-title', title));
      const row = el('div', 'pz-swatches');
      list.forEach(([name, colour]) => {
        const b = el('button', 'pz-swatch');
        b.type = 'button';
        b.style.background = colour;
        b.dataset.colour = colour;
        b.setAttribute('aria-label', `${title}: ${name}`);
        b.title = name;
        b.addEventListener('click', () => { state[key] = colour; redraw(); });
        row.append(b);
      });
      wrap.append(row);
      panelParts[key] = row;
      return wrap;
    }

    function buildDesigner() {
      host.innerHTML = '';
      const k = KINDS[state.kind];
      const layout = el('div', 'pz-designer');
      const stage = el('div', 'pz-canvas-wrap');
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
      svg.setAttribute('class', 'pz-canvas');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', `Your ${k.title.toLowerCase()}`);
      svg.addEventListener('pointerdown', onCanvasDown);
      stage.append(svg);

      const panel = el('div', 'pz-panel');
      const shapes = el('div', 'pz-group');
      shapes.append(el('p', 'pz-group-title', 'Shape'));
      const shapeRow = el('div', 'pz-shapes');
      SHAPES.forEach(s => {
        const b = el('button', 'secondary-button small', s.label);
        b.type = 'button';
        b.dataset.shape = s.id;
        b.addEventListener('click', () => { state.shape = s.id; redraw(); });
        shapeRow.append(b);
      });
      shapes.append(shapeRow);
      panelParts.shape = shapeRow;

      const decos = el('div', 'pz-group');
      decos.append(el('p', 'pz-group-title', 'Decorations — tap or drag'));
      const grid = el('div', 'pz-decos');
      k.decos.forEach(([type, name]) => {
        const b = el('button', 'pz-deco');
        b.type = 'button';
        b.dataset.deco = type;
        b.setAttribute('aria-label', `Add ${name}`);
        b.innerHTML = `<svg viewBox="-34 -34 68 68" aria-hidden="true">${decoSvg(state.kind, type)}</svg><span>${name}</span>`;
        b.addEventListener('pointerdown', (event) => onPanelDown(event, type));
        b.addEventListener('click', (event) => { if (event.detail === 0) addItem(type); });   // keyboard
        grid.append(b);
      });
      decos.append(grid);

      const actions = el('div', 'pz-tools');
      const mk = (id, text, cls, fn) => {
        const b = el('button', cls, text);
        b.type = 'button';
        b.id = id;
        b.addEventListener('click', fn);
        actions.append(b);
        return b;
      };
      panelParts.remove = mk('pzRemove', '🗑 Remove', 'secondary-button small', removeSelected);
      mk('pzClear', 'Clear', 'secondary-button small', () => { state.items = []; state.selected = null; redraw(); });
      mk('pzAgain', 'Start again', 'secondary-button small', showChoose);
      mk('pzSave', '💾 Save Image', 'primary-button compact', saveImage);

      panel.append(shapes, swatchRow(k.outerLabel, k.outer, 'outer'), swatchRow(k.innerLabel, k.inner, 'inner'), decos, actions);
      layout.append(stage, panel);
      host.append(layout);
    }

    function redraw() {
      if (!svg || !state) return;
      const items = state.items.map(it =>
        `<g class="pz-item${state.selected === it.id ? ' selected' : ''}" data-id="${it.id}" transform="${itemTransform(it)}">`
        + `<circle r="36" fill="#000" fill-opacity="0"/>${decoSvg(state.kind, it.type)}`
        + (state.selected === it.id ? '<circle r="36" fill="none" stroke="#2563eb" stroke-width="3" stroke-dasharray="7 5"/>' : '') + '</g>').join('');
      svg.innerHTML = baseMarkup(state.kind, state.shape, state.outer, state.inner) + items;
      ['outer', 'inner'].forEach(key => panelParts[key].querySelectorAll('.pz-swatch').forEach(b => {
        const on = b.dataset.colour === state[key];
        b.classList.toggle('on', on);
        b.textContent = on ? '✓' : '';
      }));
      panelParts.shape.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.shape === state.shape));
      panelParts.remove.disabled = state.selected == null;
    }

    // ----- items -----
    const find = (id) => state.items.find(it => it.id === id);
    function addItem(type) {
      const it = { id: nextId++, type, x: S / 2 + rand(-70, 70), y: S / 2 + rand(-70, 70), rot: type === 'candle' ? 0 : Math.round(rand(-25, 25)) };
      state.items.push(it);
      state.selected = it.id;
      redraw();
      return it;
    }
    function removeSelected() {
      if (state.selected == null) return;
      state.items = state.items.filter(it => it.id !== state.selected);
      state.selected = null;
      redraw();
    }
    function toSvg(event) {
      const r = svg.getBoundingClientRect();
      if (!r.width) return { x: S / 2, y: S / 2, inside: true };     // no layout (tests): treat as the middle
      return {
        x: ((event.clientX - r.left) / r.width) * S, y: ((event.clientY - r.top) / r.height) * S,
        inside: event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom
      };
    }

    // ----- dragging (placed items and new ones from the panel) -----
    function beginDrag(item, event, fromPanel) {
      const p = toSvg(event);
      drag = { id: item.id, pid: event.pointerId, fromPanel, sx: event.clientX, sy: event.clientY, moved: false, ox: item.x - p.x, oy: item.y - p.y };
      root.addEventListener('pointermove', onMove);
      root.addEventListener('pointerup', onUp);
      root.addEventListener('pointercancel', onUp);
    }
    function onPanelDown(event, type) {
      event.preventDefault();
      if (drag) return;
      beginDrag(addItem(type), event, true);
    }
    function onCanvasDown(event) {
      event.preventDefault();
      if (drag) return;
      const node = event.target.closest ? event.target.closest('.pz-item') : null;
      const item = node ? find(Number(node.dataset.id)) : null;
      if (!item) { state.selected = null; redraw(); return; }
      state.items.push(state.items.splice(state.items.indexOf(item), 1)[0]);   // bring to front
      state.selected = item.id;
      redraw();
      beginDrag(item, event, false);
    }
    function onMove(event) {
      if (!drag || event.pointerId !== drag.pid) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) < 6) return;   // still a tap
      drag.moved = true;
      const item = find(drag.id);
      const p = toSvg(event);
      item.x = clamp(p.x + (drag.fromPanel ? 0 : drag.ox));
      item.y = clamp(p.y + (drag.fromPanel ? 0 : drag.oy));
      const node = svg.querySelector(`.pz-item[data-id="${item.id}"]`);
      if (node) node.setAttribute('transform', itemTransform(item));
    }
    function onUp(event) {
      if (!drag || event.pointerId !== drag.pid) return;
      stopDragListeners();
      const { id, fromPanel, moved } = drag;
      drag = null;
      // A new decoration dragged off the canvas and dropped there is cancelled.
      if (fromPanel && moved && event.type === 'pointerup' && !toSvg(event).inside) {
        state.items = state.items.filter(it => it.id !== id);
        state.selected = null;
      }
      redraw();
    }

    // ----- save image -----
    function closeSave() {
      freeSaveUrl();
      const box = host.querySelector('.pz-save');
      if (box) box.remove();
    }
    async function saveImage() {
      if (!state || host.querySelector('.pz-save')) return;
      const k = KINDS[state.kind];
      const note = el('div', 'pz-save');
      note.append(el('p', 'pz-save-text', 'Making your picture…'));
      host.append(note);
      try {
        const blob = await svgToPng(artworkSvg(state, 1024), 1024);
        if (!alive) return;
        freeSaveUrl();
        saveUrl = URL.createObjectURL(blob);
        note.innerHTML = '';
        const img = el('img', 'pz-save-img');
        img.alt = `Your ${k.title.toLowerCase()}`;
        img.src = saveUrl;
        note.append(el('p', 'pz-save-text', 'Your picture is ready! Tap Save, or press and hold the picture.'), img);
        const row = el('div', 'pz-actions');
        const link = el('a', 'primary-button compact pz-save-link', '⬇ Save picture');
        link.href = saveUrl;
        link.download = k.file;
        row.append(link);
        const file = (root.File ? new root.File([blob], k.file, { type: 'image/png' }) : null);
        if (file && root.navigator.canShare && root.navigator.share && root.navigator.canShare({ files: [file] })) {
          const share = el('button', 'secondary-button', 'Share / Save to Photos');
          share.type = 'button';
          share.addEventListener('click', () => { root.navigator.share({ files: [file], title: k.file }).catch(() => {}); });
          row.append(share);
        }
        const close = el('button', 'secondary-button', 'Close');
        close.type = 'button';
        close.addEventListener('click', closeSave);
        row.append(close);
        note.append(row);
      } catch (error) {
        note.innerHTML = '';
        note.append(el('p', 'pz-save-text', 'Sorry, the picture could not be made.'));
        const close = el('button', 'secondary-button', 'Close');
        close.type = 'button';
        close.addEventListener('click', closeSave);
        note.append(close);
      }
    }

    showChoose();

    return {
      destroy() { alive = false; stopDragListeners(); freeSaveUrl(); },
      // Read-only helpers for the automated tests.
      _artwork: () => (state ? artworkSvg(state, 1024) : ''),
      _items: () => (state ? state.items.map(it => ({ ...it })) : [])
    };
  }

  root.MQPlayzone.register({
    id: 'designer',
    title: 'Pizza & Cake Designer',
    icon: '🍕🎂',
    desc: 'Design your own pizza or cake and save the picture!',
    cost: 2,
    players: 1,
    mount
  });
})();
