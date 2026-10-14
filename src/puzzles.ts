import { assetUrl, gameConfig } from './content';
import { matchOrder, rhythmWindow, validMix } from './state';

export interface PuzzleHost { root: HTMLElement; complete: () => void; failures: { rhythm: number }; }
let audioContext: AudioContext | undefined;
export function tone(frequency: number, duration = .12, volume = .04) {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Visual cues remain sufficient when audio is unavailable. */ }
}

export function mountPuzzle(kind: string, host: PuzzleHost): () => void {
  const { root } = host;
  const abort = new AbortController();
  const cleanups: (() => void)[] = [];
  let stopped = false, completed = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => { timers.push(setTimeout(() => { if (!stopped) fn(); }, ms)); };
  const on = (selector: string, fn: (e: Event) => void, event = 'click') => root.querySelectorAll(selector).forEach(el => el.addEventListener(event, fn, { signal: abort.signal }));
  const status = (text: string, success = false) => { const e = root.querySelector<HTMLElement>('.puzzle-status'); if (e) { e.textContent = text; e.classList.toggle('good', success); } };
  const finish = () => { if (!completed && !stopped) { completed = true; tone(659, .3); host.complete(); } };
  const keyboard = (fn: (event: KeyboardEvent) => void) => window.addEventListener('keydown', fn, { signal: abort.signal });
  const choices = (items: string[]) => items.map((label, i) => `<button class="choice" data-value="${i}"><span class="keycap">${i + 1}</span>${label}</button>`).join('');
  const selectWithNumber = () => keyboard(e => { if (e.repeat) return; const n = Number(e.key) - 1; if (n >= 0 && n <= 8) root.querySelector<HTMLButtonElement>(`[data-value="${n}"]`)?.click(); });
  if (kind === 'recipe') {
    let order: string[] = [];
    const ingredients = ['香蕉', '牛奶', '吐司', '草莓', '蜂蜜'];
    root.innerHTML = `<div class="recipe-art"><span>▱</span><span>✦</span><span>◡</span></div><p class="puzzle-lead">把三樣食材依序放到盤子上。</p><div class="slots" aria-live="polite"></div><div class="choices">${choices(ingredients)}</div><p class="puzzle-status">想一想食譜上寫的三句話。</p><div class="puzzle-actions"><button class="button secondary" id="reset-recipe">清空盤子</button><button class="button primary" id="check-recipe">一起開動</button></div>`;
    const draw = () => { root.querySelector('.slots')!.innerHTML = [0, 1, 2].map(i => `<span>${order[i] || `0${i + 1}`}</span>`).join(''); };
    draw(); on('[data-value]', e => { if (order.length < 3) { order.push(ingredients[Number((e.currentTarget as HTMLElement).dataset.value)]); draw(); tone(400 + order.length * 90); } });
    on('#reset-recipe', () => { order = []; draw(); status('盤子清空了，再試一次。'); });
    on('#check-recipe', () => { if (matchOrder(order, gameConfig.recipe)) finish(); else status(order.length < 3 ? '還差幾樣食材，先放滿三格吧。' : '好像和便條不太一樣。清空盤子，換個順序看看。'); });
    selectWithNumber();
  } else if (kind === 'memory') {
    let round = 0, input: number[] = [], showing = false, ready = false;
    root.innerHTML = `<p class="puzzle-lead">先看亮燈，等它停下，再重複同樣的順序。</p><div class="round-label">ROUND <b id="memory-round">01</b> / 02</div><div class="memory-grid">${choices(['☀ 太陽', '♧ 葉子', '◇ 水滴', '☾ 月亮'])}</div><p class="puzzle-status">準備好了，就讓玩具亮起來。</p><button class="button primary" id="show-memory">播放亮燈順序</button>`;
    const flash = (n: number) => { const b = root.querySelector<HTMLElement>(`[data-value="${n}"]`)!; b.classList.add('lit'); tone([330, 440, 550, 660][n], .2); later(() => b.classList.remove('lit'), 430); };
    const show = () => {
      if (showing || completed) return; showing = true; ready = false; input = [];
      const button = root.querySelector<HTMLButtonElement>('#show-memory')!; button.disabled = true;
      root.querySelectorAll<HTMLButtonElement>('[data-value]').forEach(b => b.disabled = true);
      status('看仔細，現在先不要按。');
      gameConfig.memorySequences[round].forEach((n, i) => later(() => flash(n), 550 + i * 750));
      later(() => { showing = false; ready = true; button.disabled = false; root.querySelectorAll<HTMLButtonElement>('[data-value]').forEach(b => b.disabled = false); status('換你了，照剛才的順序按。'); }, 600 + gameConfig.memorySequences[round].length * 750);
    };
    on('#show-memory', show);
    on('[data-value]', e => {
      if (!ready || showing || completed) return;
      const n = Number((e.currentTarget as HTMLElement).dataset.value); flash(n); input.push(n);
      if (gameConfig.memorySequences[round][input.length - 1] !== n) { ready = false; status('沒關係，再播放一次就好。'); return; }
      status(`記對了 ${input.length} / ${gameConfig.memorySequences[round].length} 個。`, true);
      if (input.length === gameConfig.memorySequences[round].length) {
        ready = false;
        if (round === 1) later(finish, 450);
        else { round = 1; root.querySelector('#memory-round')!.textContent = '02'; status('第一輪完成！準備好再播放第二輪。', true); }
      }
    }); selectWithNumber();
  } else if (kind === 'photo') {
    const positions = [0, 1, 2]; const labels = ['盆栽', '檯燈', '相框']; const icons = ['♧', '⌁', '▣'];
    root.innerHTML = `<p class="puzzle-lead">重現舊照片裡的擺設。點物件切換左、中、右。</p><div class="photo-scene"><div class="photo-window"></div><div class="photo-table"></div><div id="photo-items"></div></div><div class="photo-controls">${labels.map((l, i) => `<button class="choice" data-value="${i}">${l}<b></b></button>`).join('')}</div><p class="puzzle-status">記得嗎？那張舊照片裡，誰在最右邊？</p><button class="button primary" id="take-photo">▣ 拍下這一刻</button>`;
    const draw = () => {
      root.querySelector('#photo-items')!.innerHTML = positions.map((p, i) => `<span class="prop prop-${i}" style="left:${18 + p * 30}%">${icons[i]}</span>`).join('');
      root.querySelectorAll('[data-value]').forEach((b, i) => b.querySelector('b')!.textContent = ['左', '中', '右'][positions[i]]);
    }; draw();
    on('[data-value]', e => { const n = Number((e.currentTarget as HTMLElement).dataset.value); positions[n] = (positions[n] + 1) % 3; draw(); tone(420); });
    on('#take-photo', () => { if (matchOrder(positions, gameConfig.photo)) { root.classList.add('flash-photo'); later(finish, 300); } else status('還差一點。重新想想檯燈、相框和盆栽的位置。'); }); selectWithNumber();
  } else if (kind === 'timeline') {
    let order: number[] = [];
    const labels = ['海邊的夕陽', '車站的早晨', '午後咖啡店'];
    root.innerHTML = `<p class="puzzle-lead">依照那天發生的順序，選出三張照片。</p><div class="timeline-cards">${labels.map((l, i) => `<button class="polaroid" data-value="${i}"><span class="tiny-landscape landscape-${i}"><i></i></span><span>${l}</span><b class="order-number"></b></button>`).join('')}</div><p class="puzzle-status">票根和訊息，都藏著時間的線索。</p><div class="puzzle-actions"><button class="button secondary" id="reset-order">重新排列</button><button class="button primary" id="check-order">收進回憶盒</button></div>`;
    on('[data-value]', e => { const b = e.currentTarget as HTMLButtonElement; const n = Number(b.dataset.value); if (order.includes(n)) return; order.push(n); b.classList.add('selected'); b.querySelector('b')!.textContent = String(order.length); tone(360 + order.length * 100); });
    on('#reset-order', () => { order = []; root.querySelectorAll('[data-value]').forEach(b => { b.classList.remove('selected'); b.querySelector('b')!.textContent = ''; }); status('照片排好了，再試一次。'); });
    on('#check-order', () => { if (matchOrder(order, gameConfig.timeline)) finish(); else status('時間好像接不上。想想早上集合、午后休息、傍晚看海。'); }); selectWithNumber();
  } else if (kind === 'rhythm') {
    let frame = 0, start = 0, running = false, hits = 0, lastBeat = -1;
    const pattern = [0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0];
    let hit: boolean[] = []; let missed: boolean[] = [];
    root.innerHTML = `<div class="rhythm-meta"><span>F 左手 · J 右手</span><span id="rhythm-score">0 / 16</span></div><div class="rhythm-track"><div class="lane-divider"></div><div class="hit-line"><span>在這裡按</span></div><div id="notes"></div></div><div class="rhythm-keys"><button class="beat-button" data-lane="0">F · 左</button><button class="beat-button" data-lane="1">J · 右</button></div><p class="puzzle-status">跟上 8 個節拍就過關。準備好了再開始。</p><button class="button primary" id="start-rhythm">開始練習</button>`;
    const press = (lane: number) => {
      if (!running) return; const time = (performance.now() - start) / 1000;
      const n = pattern.findIndex((l, i) => l === lane && !hit[i] && !missed[i] && Math.abs(time - (2 + i * .65)) <= rhythmWindow(host.failures.rhythm));
      const b = root.querySelector<HTMLElement>(`[data-lane="${lane}"]`)!; b.classList.add('lit'); later(() => b.classList.remove('lit'), 100);
      if (n >= 0) { hit[n] = true; hits++; tone(lane ? 660 : 440); status('很好，就是這個拍子！', true); root.querySelector('#rhythm-score')!.textContent = `${hits} / 16`; }
      else status('再等一下，音符碰到金線時按。');
    };
    const tick = () => {
      if (!running || stopped) return; const time = (performance.now() - start) / 1000;
      const beat = Math.floor((time - 2) / .65); if (beat >= 0 && beat !== lastBeat && beat < 16) { lastBeat = beat; tone(220, .05, .015); }
      const track = root.querySelector<HTMLElement>('.rhythm-track')!; const height = track.clientHeight; const line = height - 37;
      root.querySelector('#notes')!.innerHTML = pattern.map((l, i) => {
        const delta = 2 + i * .65 - time;
        if (delta < -rhythmWindow(host.failures.rhythm) && !hit[i]) missed[i] = true;
        if (hit[i] || delta > 2 || delta < -.4) return '';
        return `<i class="note lane-${l}" style="top:${line - delta * (line / 1.8)}px"></i>`;
      }).join('');
      if (time > 2 + 16 * .65 + .3) {
        running = false; const needed = host.failures.rhythm >= 2 ? 6 : 8;
        if (hits >= needed) finish();
        else { host.failures.rhythm++; status(`接到 ${hits} 個，差一點！重試時判定會更寬鬆${host.failures.rhythm >= 2 ? '，只需 6 個節拍' : ''}。`); const b = root.querySelector<HTMLButtonElement>('#start-rhythm')!; b.disabled = false; b.textContent = '再一起試一次'; }
        return;
      } frame = requestAnimationFrame(tick);
    };
    on('#start-rhythm', () => { if (running) return; tone(440); hit = Array(16).fill(false); missed = Array(16).fill(false); hits = 0; lastBeat = -1; start = performance.now(); running = true; root.querySelector<HTMLButtonElement>('#start-rhythm')!.disabled = true; root.querySelector('#rhythm-score')!.textContent = '0 / 16'; status('看金色判定線，左右交替。'); tick(); });
    on('[data-lane]', e => { e.preventDefault(); press(Number((e.currentTarget as HTMLElement).dataset.lane)); }, 'pointerdown');
    keyboard(e => { if (!e.repeat && ['f', 'j'].includes(e.key.toLowerCase())) { e.preventDefault(); press(e.key.toLowerCase() === 'f' ? 0 : 1); } });
    cleanups.push(() => { running = false; cancelAnimationFrame(frame); });
  } else if (kind === 'record') {
    let frame = 0, holding = false, phrase = 0, progress = 0, prev = performance.now();
    root.innerHTML = `<div class="record-visual"><span class="record-light"></span><div class="wave-bars">${Array.from({ length: 28 }, (_, i) => `<i style="--h:${20 + (i * 37) % 80}%;--delay:${i * .07}s"></i>`).join('')}</div></div><div class="round-label">TAKE <b id="phrase">01</b> / 03</div><p id="record-line" class="puzzle-lead">「把門帶上，走進今天的光裡。」（暫定）</p><div class="progress-track"><i id="record-progress"></i></div><p class="puzzle-status">按住錄音鍵直到一個樂句完成。這是模擬錄音。</p><button class="button primary hold-button" id="hold-record">● 按住錄音 · 空白鍵</button>`;
    const lines = ['「把門帶上，走進今天的光裡。」（暫定）', '「走過幾個街口，有人留了一盞燈。」（暫定）', '「所有普通的今天，都想唱給你聽。」（暫定）'];
    const button = root.querySelector<HTMLButtonElement>('#hold-record')!;
    const hold = (value: boolean) => { holding = value; root.classList.toggle('recording', value); button.classList.toggle('lit', value); };
    on('#hold-record', e => { e.preventDefault(); button.setPointerCapture((e as PointerEvent).pointerId); tone(440, .08); hold(true); }, 'pointerdown');
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) on('#hold-record', () => hold(false), event);
    keyboard(e => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) hold(true); } });
    window.addEventListener('keyup', e => { if (e.code === 'Space') { e.preventDefault(); hold(false); } }, { signal: abort.signal });
    const tick = (now: number) => {
      const dt = Math.min(.05, (now - prev) / 1000); prev = now;
      if (holding && !completed) { progress += dt / 3; root.querySelector<HTMLElement>('#record-progress')!.style.width = `${Math.min(100, progress * 100)}%`; }
      if (progress >= 1 && !completed) {
        phrase++; hold(false); progress = 0;
        if (phrase === 3) { finish(); return; }
        root.querySelector('#phrase')!.textContent = `0${phrase + 1}`; root.querySelector('#record-line')!.textContent = lines[phrase]; status('這句收好了。放開後，再按住錄下一句。', true); tone(550); root.querySelector<HTMLElement>('#record-progress')!.style.width = '0%';
      }
      if (!stopped) frame = requestAnimationFrame(tick);
    }; frame = requestAnimationFrame(tick); cleanups.push(() => cancelAnimationFrame(frame));
  } else if (kind === 'mix') {
    const levels = [30, 70, 25]; const names = ['和聲 · 房間裡的光', '旋律 · 留一點呼吸', '鼓點 · 走路的腳步'];
    const tracks = gameConfig.stems.map(src => { const a = new Audio(assetUrl(src)); a.loop = true; a.preload = 'auto'; return a; });
    let playing = false;
    root.innerHTML = `<p class="puzzle-lead">調整三條音軌，找到工作筆記裡的平衡。</p><div class="mix-channels">${names.map((n, i) => `<label class="mix-channel"><span>${n}</span><div class="vu-meter">${'<i></i>'.repeat(12)}</div><input aria-label="${n}" type="range" min="0" max="100" value="${levels[i]}" data-track="${i}"><output>${levels[i]}%</output></label>`).join('')}</div><p class="puzzle-status">可以先試聽，再依工作筆記調整音量。</p><div class="puzzle-actions"><button class="button secondary" id="preview-mix">▷ 試聽音軌</button><button class="button primary" id="finish-mix">完成混音</button></div>`;
    const draw = () => { tracks.forEach((a, i) => { a.volume = levels[i] / 100 * .65; }); root.querySelectorAll('.mix-channel').forEach((c, i) => { c.querySelector('output')!.textContent = `${levels[i]}%`; c.querySelectorAll('.vu-meter i').forEach((b, j) => b.classList.toggle('active', j < levels[i] / 9)); }); }; draw();
    on('[data-track]', e => { const input = e.currentTarget as HTMLInputElement; levels[Number(input.dataset.track)] = Number(input.value); draw(); }, 'input');
    on('#preview-mix', async () => {
      const b = root.querySelector<HTMLButtonElement>('#preview-mix')!;
      if (playing) { tracks.forEach(a => a.pause()); playing = false; b.textContent = '▷ 試聽音軌'; return; }
      b.disabled = true;
      try { tracks.forEach(a => { a.currentTime = 0; }); await Promise.all(tracks.map(a => a.play())); if (stopped) { tracks.forEach(a => a.pause()); return; } playing = true; b.textContent = 'Ⅱ 暫停試聽'; status('正在播放示範音軌（暫定）。'); }
      catch { tracks.forEach(a => a.pause()); status('音軌暫時無法播放，可再試一次；仍可完成混音。'); }
      finally { b.disabled = false; }
    });
    on('#finish-mix', () => { if (validMix(levels, gameConfig.mixTarget)) finish(); else status('再微調一下。可先關閉面板，到窗邊看看混音工作筆記。'); });
    cleanups.push(() => tracks.forEach(a => { a.pause(); a.removeAttribute('src'); a.load(); }));
  }
  return () => { stopped = true; abort.abort(); timers.forEach(clearTimeout); cleanups.forEach(fn => fn()); };
}
