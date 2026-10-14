import './style.css';
import { assetUrl, chapters, gameConfig } from './content';
import { advanceChapter, completeChapter, freshProgress, readProgress, SAVE_KEY } from './state';
import { mountPuzzle, tone } from './puzzles';
import { World } from './world';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="grain" aria-hidden="true"></div>
  <main id="landing">
    <header class="landing-header"><a class="brand" href="#" aria-label="去找朋友，最後錄首歌"><span class="brand-icon">♫</span><span>日常有聲<span class="brand-en">A LITTLE SOUND OF LIFE</span></span></a><span class="edition"><i></i> FIRST-PERSON PIXEL ADVENTURE <b>VOL. 01</b></span></header>
    <section class="hero-copy"><div class="eyebrow"><span></span> 一趟關於朋友與音樂的小旅行</div><h1>去找朋友，<br>最後<span class="title-accent">錄首歌</span><span class="title-dot">。</span></h1><p class="provisional">遊戲名稱與原創角色設定（暫定）</p><p class="hero-description">從你的租屋處出發，走進朋友的日常。<br>把一路上的笑聲與小事，<br>帶到新店，錄成一首屬於今天的歌。</p><div class="hero-actions"><button class="button primary start-button" id="start-game">出門，去找朋友 <span>↗</span></button><button class="button secondary" id="continue-game" hidden>繼續上次旅程 →</button></div><button class="text-button" id="how-to">第一次來？看看怎麼玩 <span>↗</span></button><div class="game-facts"><span><b>≈ 15</b> 分鐘的小旅行</span><span><b>07</b> 位朋友</span><span><b>01</b> 首歌的結尾</span></div></section>
    <aside class="scene-postcard"><span class="postcard-pin">✦</span><p>故事，從這裡開始</p><h2>你的租屋處</h2><span>窗外有光，今天有人等你。</span><div class="postcard-line"></div><small>TAIPEI · AN ORDINARY AFTERNOON</small></aside>
    <footer class="landing-footer"><div class="journey-line"><span class="route-dot active"></span><span>租屋處</span><i></i><span class="route-dot"></span><span>朋友的日常</span><i></i><span class="route-dot"></span><span>新店・王17家</span><i></i><span>♫</span></div><span class="footer-note">建議戴上耳機 <span>·</span> 電腦 / 手機橫屏</span></footer>
  </main>
  <section id="game-hud" hidden aria-label="遊戲介面">
    <div class="hud-location"><span class="eyebrow" id="chapter-number"></span><h2 id="place"></h2><p id="objective"></p></div>
    <div class="hud-top-right"><button class="friend-progress" id="journey-button" aria-label="查看旅程"><span>今天見到的朋友</span><span id="friend-dots"></span></button><button class="icon-button" id="pause-button" aria-label="暫停">Ⅱ</button></div>
    <div class="crosshair" aria-hidden="true"></div><div id="interact-prompt" hidden><kbd>E</kbd><span></span></div>
    <div class="hud-bottom"><span id="desktop-controls"><kbd>W A S D</kbd> 移動 <span>·</span> 滑鼠 / 拖曳轉視角 <span>·</span> <kbd>E</kbd> 互動</span><button class="small-button" id="hint-button">✧ 給我一點提示</button></div>
    <div id="touch-controls"><div id="look-pad" aria-label="滑動轉動視角"></div><div id="joystick" aria-label="移動搖桿"><i></i><span>移動</span></div><button id="touch-interact" aria-label="互動">互動</button><span class="look-label">滑動看四周</span></div>
  </section>
  <div id="toast" role="status" aria-live="polite"></div>
  <div id="modal-root" hidden></div>
  <div id="rotate-screen"><span class="rotate-icon">▯ ↻</span><h2>把手機轉一下吧</h2><p>橫過來，才能看見整個小世界。</p><small>旅程已暫停，進度會留在這裡。</small></div>
  <div id="loading"><span class="brand-icon">♫</span><p>正在把今天的陽光裝進房間…</p></div>
`;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const html = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
let p = freshProgress();
let saveAvailable = true;
try { const saved = readProgress(localStorage.getItem(SAVE_KEY)); if (saved && (saved.seconds > 0 || saved.chapter > 0 || saved.talked || saved.done)) { p = saved; $('#continue-game').hidden = false; } } catch { saveAvailable = false; }
let world: World;
let started = false, modalOpen = false, modalKind = '', cleanupModal: (() => void) | undefined;
let previousFocus: HTMLElement | null = null;
let hintLevel = 0, totalClock = 0;
const failures = { rhythm: 0 };
const keys = new Set<string>();
let joyX = 0, joyZ = 0;
let toastTimer: ReturnType<typeof setTimeout>;
let saveWarned = false;

function toast(text: string) { const t = $('#toast'); t.textContent = text; t.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('visible'), 4200); }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch { saveAvailable = false; if (!saveWarned) { saveWarned = true; toast('瀏覽器無法儲存進度；本次仍可繼續遊玩。'); } } }
function clearInputs() { keys.clear(); joyX = joyZ = 0; $('#joystick i').style.transform = ''; }
function portraitMode() { return matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth; }
function closeModal() {
  cleanupModal?.(); cleanupModal = undefined; modalOpen = false; modalKind = '';
  $('#modal-root').hidden = true; $('#modal-root').innerHTML = ''; clearInputs();
  previousFocus?.focus({ preventScroll: true });
}
function showModal(title: string, content: string, kind = 'dialogue', wide = false) {
  cleanupModal?.(); cleanupModal = undefined; previousFocus = document.activeElement as HTMLElement;
  modalOpen = true; modalKind = kind; clearInputs();
  if (document.pointerLockElement) document.exitPointerLock();
  const root = $('#modal-root'); root.hidden = false;
  root.innerHTML = `<section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><span class="eyebrow">${kind === 'puzzle' ? 'A LITTLE MOMENT · 小小的挑戰' : kind === 'ending' ? 'TODAY HAS A SOUND · 今天的聲音' : 'A LITTLE SOUND OF LIFE'}</span><h2 id="modal-title">${html(title)}</h2></div><button class="close-button" aria-label="關閉">×</button></header><div class="modal-body">${content}</div></section>`;
  root.querySelector('.close-button')!.addEventListener('click', closeModal);
  (root.querySelector('button, input') as HTMLElement)?.focus({ preventScroll: true });
  return root.querySelector<HTMLElement>('.modal-body')!;
}
function updateHud() {
  const c = chapters[p.chapter];
  $('#chapter-number').textContent = p.chapter === 0 ? 'PROLOGUE · 出發之前' : `CHAPTER 0${p.chapter} / 07`;
  $('#place').textContent = c.place;
  $('#objective').textContent = p.done ? (p.chapter === 7 ? '混音完成！走到藍牙喇叭旁，點開今天的歌。' : '這一站完成了。可以再聊聊，或從門口前往下一站。') : p.chapter === 1 && p.talked ? `找到耳機、車票和隨身碟（${p.collected.length} / 3）` : p.chapter === 7 && p.recorded ? '錄音收好了。到右前方工作桌完成混音。' : c.objective;
  $('#friend-dots').innerHTML = chapters.slice(1).map((c, i) => `<i title="${html(c.name)}" class="${p.visited.includes(i + 1) ? 'done' : ''} ${p.chapter === i + 1 ? 'current' : ''}">${p.visited.includes(i + 1) ? '✓' : i + 1}</i>`).join('');
  for (const id of p.collected) world.hide(id);
  if (p.chapter === 0 && p.done) world.hide('key');
}
function loadChapter() { hintLevel = 0; world.load(chapters[p.chapter], p.chapter); world.menu = false; updateHud(); save(); }
function startGame(resume: boolean) {
  closeModal();
  if (!resume) { p = freshProgress(); failures.rhythm = 0; }
  started = true; $('#landing').hidden = true; $('#game-hud').hidden = false;
  loadChapter();
  if (!saveAvailable) toast('此瀏覽器無法儲存進度，請保持頁面開啟。');
  if (p.chapter === 0 && !p.talked) showIntro();
  else toast(`回到${chapters[p.chapter].place}，旅程繼續。`);
}
function showIntro() {
  const body = showModal('今天，去找朋友吧。', `<div class="intro-note"><span class="note-date">給今天的自己</span><p>不用趕路，也不用什麼都做得完美。<br>去看看朋友，把今天的聲音帶回來。</p></div><div class="control-grid"><div><b>電腦</b><p>WASD 移動 · E 互動<br>點擊畫面鎖定滑鼠；Esc 釋放<br>也可以拖曳畫面或用方向鍵左右轉</p></div><div><b>手機橫屏</b><p>左手搖桿移動<br>右側滑動看四周<br>靠近物件，按「互動」</p></div></div><p class="fine-print">原型內容標註（暫定）。約 15 分鐘，不含歌曲播放。每站自動存檔。</p><button class="button primary full" id="intro-start">好，先看看手機訊息 →</button>`);
  body.querySelector('#intro-start')!.addEventListener('click', closeModal);
}
function talk() {
  const c = chapters[p.chapter];
  const lines = p.done ? [c.after] : c.dialogue;
  let page = 0;
  const draw = () => {
    const body = showModal(p.chapter === 0 ? '手機亮了起來' : c.name, `<div class="dialogue-layout"><div class="dialogue-avatar" style="--shirt:${c.shirt}"><div class="pixel-person"><i></i><b></b><span></span></div><small>${p.chapter === 0 ? '一則新訊息' : html(c.subtitle.split(' · ')[0])}</small></div><div class="dialogue-copy"><span class="dialogue-count">${String(page + 1).padStart(2, '0')} / ${String(lines.length).padStart(2, '0')}</span><p>${html(lines[page])}</p></div></div><button class="button primary next-dialogue">${page === lines.length - 1 ? p.done ? '把這句話放進口袋' : '好，一起來吧' : '繼續聊聊'} <span>→</span></button>`);
    body.querySelector('.next-dialogue')!.addEventListener('click', () => { if (page < lines.length - 1) { page++; draw(); } else { p.talked = true; save(); closeModal(); updateHud(); } });
  }; draw();
}
function completed(recordOnly = false) {
  if (recordOnly) p.recorded = true; else p = completeChapter(p);
  save(); updateHud();
  const c = chapters[p.chapter];
  const body = showModal(recordOnly ? '三個樂句，收好了。' : p.chapter === 7 ? '今天的聲音，準備好了。' : '把這一刻，帶著走。', `<div class="success-mark">✦</div><p class="success-quote">${html(recordOnly ? '王17：「這個感覺很好。到旁邊的工作桌，把聲音調到舒服的位置吧。」（暫定）' : c.after)}</p><p class="fine-print">${recordOnly ? '下一步：右前方工作桌，完成混音。' : p.chapter === 7 ? '下一步：靠近右邊的藍牙喇叭，播放新歌。' : '進度已記錄。門口通往下一位朋友。'}</p><button class="button primary full" id="success-close">${recordOnly ? '去混音' : p.chapter === 7 ? '去打開喇叭' : '繼續今天的旅程'} →</button>`);
  body.querySelector('#success-close')!.addEventListener('click', closeModal);
}
function openPuzzle(kind: string) {
  if (!p.talked) { toast('先和朋友聊聊，看看今天有什麼故事。'); return; }
  if (p.done) { toast(p.chapter === 7 ? '混音已完成，可以去點藍牙喇叭了。' : '這一站完成了，去門口繼續旅程吧。'); return; }
  if ([2, 4, 5].includes(p.chapter) && !p.clueRead) { toast(`先到左前方窗邊，讀讀${chapters[p.chapter].clueName}。`); return; }
  if (kind === 'mix' && !p.recorded) { toast('先到麥克風前完成三句錄音，再來混音。'); return; }
  if (kind === 'record' && p.recorded) { toast('錄音已收好。到右前方工作桌開始混音。'); return; }
  const titles: Record<string, string> = { recipe: '甜一點，剛剛好。（暫定）', memory: '你還記得嗎？（暫定）', photo: '再拍一張吧。（暫定）', timeline: '那天，後來呢？（暫定）', rhythm: '跟上我們的節拍（暫定）', record: '把今天唱進去（暫定）', mix: '找到舒服的平衡（暫定）' };
  const body = showModal(titles[kind], '<div id="puzzle-mount"></div>', 'puzzle', true);
  cleanupModal = mountPuzzle(kind, { root: body.querySelector('#puzzle-mount')!, complete: () => completed(kind === 'record'), failures });
}
function nextChapter() {
  if (!p.done) { toast(p.chapter === 0 ? '出發前先看手機訊息，再拿好窗邊的鑰匙。' : '朋友的任務還沒完成，先把這一站的故事走完吧。'); return; }
  if (p.chapter === 7) { toast('今天的終點在那顆喇叭裡。一起聽歌吧。'); return; }
  const c = chapters[p.chapter], next = chapters[p.chapter + 1];
  const body = showModal('下一站，還有人等你。', `<div class="travel-art"><span>▥</span><i></i><span>▥</span><div class="travel-bus">▰</div></div><p class="travel-copy">${html(c.transition)}${p.chapter > 0 ? '（暫定）' : ''}</p><div class="travel-destination"><small>NEXT STOP</small><strong>${html(next.place)}</strong></div><button class="button primary full" id="travel-next">${p.chapter === 6 ? '搭車前往新店' : '走，去下一站'} →</button>`, 'travel');
  body.querySelector('#travel-next')!.addEventListener('click', () => { p = advanceChapter(p); closeModal(); loadChapter(); toast(chapters[p.chapter].subtitle); });
}
function interact(id?: string) {
  if (!started || modalOpen || portraitMode()) return;
  const h = id || world.nearest()?.id; if (!h) { toast('走近金色標記，面向物件再互動。'); return; }
  if (h === 'npc' || h === 'phone') talk();
  else if (h === 'door') nextChapter();
  else if (h === 'clue') {
    p.clueRead = true; save();
    const body = showModal(chapters[p.chapter].clueName, `<div class="paper-note">${html(chapters[p.chapter].clue).replace(/\n/g, '<br>')}</div><button class="button primary full" id="note-close">記在心裡，回去試試 →</button>`);
    body.querySelector('#note-close')!.addEventListener('click', closeModal);
  } else if (h === 'key') {
    if (!p.talked) { toast('手機還亮著。先讀一下朋友傳來的訊息。'); return; }
    p.collected = ['key']; p = completeChapter(p); save(); updateHud(); tone(660); toast('鑰匙拿好了！去右側門口，開始今天的旅程。');
  } else if (['headphones', 'ticket', 'usb'].includes(h)) {
    if (!p.talked) { toast('先和阿澄聊聊，問問他在找什麼。'); return; }
    if (!p.collected.includes(h)) { p.collected.push(h); tone(520 + p.collected.length * 80); save(); updateHud(); toast(`找到了！${p.collected.length} / 3 件物品。`); }
    if (p.collected.length === 3 && !p.done) completed();
  } else if (h === 'puzzle') openPuzzle(['', '', 'recipe', 'memory', 'photo', 'timeline', 'rhythm'][p.chapter]);
  else if (h === 'record' || h === 'mix') openPuzzle(h);
  else if (h === 'speaker') { if (!p.done) toast('歌還沒準備好，先和王17完成錄音與混音。'); else showEnding(); }
}
function showEnding() {
  p.finished = true; save();
  const body = showModal('有些日子，會變成一首歌。', `<div class="ending-layout"><div class="album-art"><div class="album-sun"></div><div class="album-window"></div><div class="album-speaker"><i></i><i></i></div><span>日常有聲</span><small>A LITTLE SOUND OF LIFE</small></div><div class="song-info"><span class="song-badge">旅程完成 · 7 / 7 位朋友</span><h3>${html(gameConfig.song.title)}</h3><p>${html(gameConfig.song.artist)}</p><div class="audio-wave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="height:${12 + (i * 17) % 40}px"></i>`).join('')}</div><audio id="song-audio" controls preload="metadata" src="${assetUrl(gameConfig.song.src)}"></audio><p id="audio-status" class="fine-print" aria-live="polite">正在打開藍牙喇叭…</p><button class="small-button" id="retry-audio" hidden>再試一次播放</button></div></div><p class="ending-note">從一個人的房間，到朋友的日常。<br>謝謝你，把這一天走完。下一次見面，也帶著新的故事吧。</p><div class="puzzle-actions"><button class="button secondary" id="ending-back">留在王17家</button><button class="button primary" id="ending-home">把今天收好 →</button></div>`, 'ending', true);
  const audio = body.querySelector<HTMLAudioElement>('#song-audio')!;
  const status = body.querySelector('#audio-status')!; const retry = body.querySelector<HTMLButtonElement>('#retry-audio')!;
  let closed = false;
  const failed = () => { if (closed) return; status.textContent = '音訊暫時無法播放。可使用播放器或按下重試，通關進度已保存。'; retry.hidden = false; };
  const play = () => { retry.hidden = true; audio.play().then(() => { if (closed) audio.pause(); else status.textContent = gameConfig.prototype ? '示範音訊（暫定）· 日後替換成你的正式新歌。' : '一起聽聽，今天留下來的聲音。'; }).catch(failed); };
  audio.addEventListener('error', failed); audio.addEventListener('play', () => { retry.hidden = true; status.textContent = gameConfig.prototype ? '示範音訊（暫定）· 日後替換成你的正式新歌。' : '一起聽聽，今天留下來的聲音。'; });
  retry.addEventListener('click', () => { audio.load(); play(); });
  body.querySelector('#ending-back')!.addEventListener('click', closeModal);
  body.querySelector('#ending-home')!.addEventListener('click', returnHome);
  cleanupModal = () => { closed = true; audio.pause(); audio.removeAttribute('src'); audio.load(); };
  play();
}
function returnHome() {
  save(); closeModal(); started = false; world.menu = true; world.load(chapters[0], 0);
  $('#landing').hidden = false; $('#game-hud').hidden = true; $('#continue-game').hidden = false;
}
function pause() {
  if (!started) return;
  save();
  const body = showModal('慢慢來，朋友會等你。', `<p class="pause-description">你在${html(chapters[p.chapter].place)}。<br>目前進度已記錄；未完成的小遊戲重新開始。</p><div class="pause-menu"><button class="button primary" id="resume">繼續旅程 →</button><button class="button secondary" id="fullscreen">切換全螢幕</button><button class="button secondary" id="go-home">回到首頁</button><button class="text-button" id="restart">重新開始這一天</button></div>`, 'pause');
  body.querySelector('#resume')!.addEventListener('click', closeModal);
  body.querySelector('#go-home')!.addEventListener('click', returnHome);
  body.querySelector('#restart')!.addEventListener('click', confirmRestart);
  body.querySelector('#fullscreen')!.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await document.documentElement.requestFullscreen(); try { await (screen.orientation as ScreenOrientation & { lock?: (s: string) => Promise<void> }).lock?.('landscape'); } catch { /* Manual rotation remains available. */ } }
    } catch { toast('此瀏覽器不支援全螢幕，仍可直接橫屏遊玩。'); }
  });
}
function confirmRestart() {
  const body = showModal('重新出發？', '<p class="pause-description">這會清除這台裝置上的目前旅程，從租屋處重新開始。</p><div class="puzzle-actions"><button class="button secondary" id="keep-save">保留目前進度</button><button class="button primary" id="confirm-restart">重新開始</button></div>');
  body.querySelector('#keep-save')!.addEventListener('click', closeModal);
  body.querySelector('#confirm-restart')!.addEventListener('click', () => startGame(false));
}
$('#start-game').addEventListener('click', () => { if (p.seconds > 0 || p.chapter > 0 || p.talked) confirmRestart(); else startGame(false); });
$('#continue-game').addEventListener('click', () => startGame(true));
$('#how-to').addEventListener('click', showIntro);
$('.brand').addEventListener('click', e => e.preventDefault());
$('#pause-button').addEventListener('click', pause);
$('#hint-button').addEventListener('click', () => {
  const c = chapters[p.chapter];
  const body = showModal('卡住了？一起想想。', `<p class="hint-copy">${html(c.hints[hintLevel])}</p><div class="puzzle-actions">${hintLevel === 0 ? '<button class="button secondary" id="more-hint">再具體一點</button>' : ''}<button class="button primary" id="hint-close">我再試試 →</button></div>`);
  body.querySelector('#hint-close')!.addEventListener('click', closeModal);
  body.querySelector('#more-hint')?.addEventListener('click', () => { hintLevel = 1; $('#hint-button').click(); });
});
$('#journey-button').addEventListener('click', () => {
  showModal('今天的路線', `<p class="fine-print">固定順序的小旅行。每完成一站，就多收集一段日常。</p><ol class="route-list">${chapters.map((c, i) => `<li class="${i === p.chapter ? 'current' : ''} ${i < p.chapter || p.visited.includes(i) ? 'done' : ''}"><span>${i < p.chapter || p.visited.includes(i) ? '✓' : String(i).padStart(2, '0')}</span><div><b>${html(c.place)}</b><small>${html(c.subtitle)}</small></div><i>${i === p.chapter ? '你在這裡' : i > p.chapter ? '尚未抵達' : '已走過'}</i></li>`).join('')}</ol>`, 'journey');
});
$('#touch-interact').addEventListener('click', () => interact());

window.addEventListener('keydown', e => {
  if (e.code === 'Tab' && modalOpen) {
    const elements = [...$('#modal-root').querySelectorAll<HTMLElement>('button:not(:disabled):not([hidden]), input, audio[controls]')];
    const first = elements[0], last = elements.at(-1);
    if (e.shiftKey && document.activeElement === first) { last?.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first?.focus(); e.preventDefault(); } return;
  }
  if (e.code === 'Escape') { e.preventDefault(); if (modalOpen) closeModal(); else if (started) pause(); return; }
  if (!started || modalOpen || portraitMode()) return;
  if (['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','Space'].includes(e.code)) { e.preventDefault(); keys.add(e.code); }
  if (e.code === 'KeyE' && !e.repeat) interact();
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { clearInputs(); if (started && modalKind !== 'pause') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && started) pause(); });
window.addEventListener('resize', () => { if (started && portraitMode() && modalKind !== 'pause') pause(); });
window.addEventListener('pagehide', () => { if (started) save(); });

let lookPointer: number | null = null, lastX = 0, lastY = 0;
function setupLook(element: HTMLElement, mouse: boolean) {
  element.addEventListener('pointerdown', e => {
    if (!started || modalOpen) return;
    if (mouse && e.pointerType === 'mouse' && !document.pointerLockElement) {
      try { const request = world.renderer.domElement.requestPointerLock() as Promise<void> | undefined; request?.catch(() => {}); } catch { /* Dragging is a fallback. */ }
    }
    lookPointer = e.pointerId; lastX = e.clientX; lastY = e.clientY; element.setPointerCapture(e.pointerId);
  });
  element.addEventListener('pointermove', e => { if (lookPointer === e.pointerId && !document.pointerLockElement && !modalOpen) { world.look(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; } });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(name, () => { lookPointer = null; });
}
document.addEventListener('mousemove', e => { if (document.pointerLockElement && started && !modalOpen) world.look(e.movementX, e.movementY); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && started && !modalOpen) pause(); });
const joystick = $('#joystick'); let joyPointer: number | null = null;
const updateJoy = (e: PointerEvent) => {
  const r = joystick.getBoundingClientRect(); const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
  const length = Math.max(36, Math.hypot(dx, dy)); joyX = dx / length; joyZ = dy / length;
  $('#joystick i').style.transform = `translate(${joyX * 30}px, ${joyZ * 30}px)`;
};
joystick.addEventListener('pointerdown', e => { if (joyPointer !== null) return; e.preventDefault(); joyPointer = e.pointerId; joystick.setPointerCapture(e.pointerId); updateJoy(e); });
joystick.addEventListener('pointermove', e => { if (e.pointerId === joyPointer) updateJoy(e); });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(event, () => { joyPointer = null; joyX = joyZ = 0; $('#joystick i').style.transform = ''; });
setupLook($('#look-pad'), false);

try {
  world = new World(app); world.load(chapters[0], 0); world.menu = true;
  setupLook(world.renderer.domElement, true);
  $('#loading').hidden = true;
  let previous = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(.05, (now - previous) / 1000); previous = now;
    if (started && !document.hidden && !portraitMode()) {
      if (!['pause', 'journey'].includes(modalKind)) { p.seconds += dt; totalClock += dt; if (totalClock > 15) { save(); totalClock = 0; } }
      if (!modalOpen) {
        const x = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + joyX;
        const z = Number(keys.has('KeyS')) - Number(keys.has('KeyW')) + joyZ;
        world.yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.6;
        world.move(x, z, dt);
        const target = world.nearest(); const prompt = $('#interact-prompt'); prompt.hidden = !target;
        if (target) prompt.querySelector('span')!.textContent = target.label;
        $('#touch-interact').classList.toggle('available', !!target);
      } else $('#interact-prompt').hidden = true;
    }
    if (!document.hidden) world.render(dt);
    requestAnimationFrame(frame);
  }; requestAnimationFrame(frame);
} catch (error) {
  $('#loading').innerHTML = '<h2>這個小世界需要 WebGL 2</h2><p>請用新版 Chrome、Edge 或 Safari，並開啟瀏覽器硬體加速後再試一次。</p><button class="button primary" onclick="location.reload()">重新載入</button>';
  console.error('Unable to initialize the 3D world', error);
}
