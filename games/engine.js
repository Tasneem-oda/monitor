/**
 * games/engine.js — v33: ألعاب الحصة (خفيفة: من غير مكتبات، بتتحمّل بس لما المدرس يفتح لعبة)
 *
 * القوالب: quiz (اختيار من متعدد) · truefalse (صح ولا غلط) · match (وصّل) · order (رتّب) · sort (صنّف)
 *          memory (بطاقات الذاكرة) · fill (أكمل الفراغ) · wheel (العجلة) · flash (بطاقات التسميع) · letters (كوّن الكلمة)
 * كل لعبة: { title, template, content, subject }
 * وضع الفريقين للمجموعات + صوت بسيط (WebAudio) + نجوم في الآخر.
 */

export const TEMPLATES = [
    { id: 'quiz', name: 'اختيار من متعدد', desc: 'سؤال و٢-٤ اختيارات' },
    { id: 'truefalse', name: 'صح ولا غلط', desc: 'جمل والطالب يقول صح أو غلط' },
    { id: 'match', name: 'وصّل', desc: 'وصّل كل كلمة باللي يناسبها' },
    { id: 'order', name: 'رتّب', desc: 'رتّب الكلمات أو الآيات أو الحروف' },
    { id: 'sort', name: 'صنّف', desc: 'حط كل كلمة في مجموعتها' },
    { id: 'memory', name: 'بطاقات الذاكرة', desc: 'اقلب كارتين ودوّر على الأزواج' },
    { id: 'fill', name: 'أكمل الفراغ', desc: 'نص فيه كلمات مخفية' },
    { id: 'flash', name: 'بطاقات التسميع', desc: 'وش وضهر: سؤال وإجابة' },
    { id: 'letters', name: 'كوّن الكلمة', desc: 'حروف متلخبطة يكوّن منها الكلمة' },
    { id: 'wheel', name: 'العجلة', desc: 'لف واختار طالب أو سؤال عشوائي' }
];
import { gi } from './gicons.js';
export { gi };
export const templateOf = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// مقارنة من غير تشكيل (عشان "رتّب" و"كوّن الكلمة" مايفشلوش بسبب حركة)
export const plain = (s) => String(s || '').replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/[إأآٱ]/g, 'ا').trim();

// ------------------------------------------------------------------ الصوت (من غير ملفات)
let actx = null;
let muted = (() => { try { return localStorage.getItem('tm_gm_mute') === '1'; } catch (e) { return false; } })();
function tone(freqs, dur = 0.12, type = 'sine', gap = 0.09) {
    if (muted) return;
    try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        let t = actx.currentTime;
        for (const f of freqs) {
            const o = actx.createOscillator(); const g = actx.createGain();
            o.type = type; o.frequency.value = f;
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
            t += gap;
        }
    } catch (e) { /* مفيش صوت */ }
}
const sfx = {
    good: () => tone([660, 880], 0.14),
    bad: () => tone([220, 180], 0.18, 'square', 0.12),
    win: () => tone([523, 659, 784, 1046], 0.16, 'triangle', 0.11),
    tick: () => tone([440], 0.05)
};

// ------------------------------------------------------------------ CSS (بيتحقن مرة واحدة)
let cssDone = false;
function ensureCss() {
    if (cssDone) return; cssDone = true;
    const s = document.createElement('style');
    s.textContent = `
.gm{position:fixed;inset:0;z-index:9600;display:flex;flex-direction:column;background:radial-gradient(circle at 20% 0%,#3B2D4A,#1E1726 70%);color:#fff;font-family:'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif;direction:rtl}
.gm *{box-sizing:border-box}
.gm-top{display:flex;align-items:center;gap:.5rem;padding:.6rem .8rem;padding-top:calc(.6rem + env(safe-area-inset-top,0px));flex-wrap:wrap}
.gm-title{flex:1 1 160px;min-width:0;font-weight:800;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:.55rem}
.gm-title>span{min-width:0;overflow:hidden;text-overflow:ellipsis}.gm-title svg{flex-shrink:0}
.gm-btn svg{display:block}.gm-btn{display:inline-flex;align-items:center;justify-content:center;gap:.35rem}
.gm-pill{display:inline-flex;align-items:center;gap:.3rem}.gi.gold{color:#F2C14E}.gi.dim{color:rgba(255,255,255,.35)}
.gm-dot{display:inline-block;width:12px;height:12px;border-radius:50%}.gm-dot.b{background:#4C8BD9}.gm-dot.r{background:#E0605E}
.gm-starrow{display:flex;justify-content:center;gap:.4rem;margin-top:.6rem}
.gm-fb-ic{display:inline-flex;width:110px;height:110px;border-radius:50%;align-items:center;justify-content:center;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.gm-fb-ic.ok{background:radial-gradient(circle at 30% 30%,#7BE0A6,#1F8A5B)}.gm-fb-ic.no{background:radial-gradient(circle at 30% 30%,#F59A8E,#B3261E)}
.gm-title small{display:block;font-weight:500;font-size:.75rem;opacity:.7}
.gm-btn{min-height:42px;min-width:42px;padding:0 .8rem;border:0;border-radius:12px;background:rgba(255,255,255,.12);color:#fff;font:inherit;font-weight:700;font-size:.88rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:.35rem}
.gm-btn:hover{background:rgba(255,255,255,.2)}.gm-btn:focus-visible{outline:3px solid #F2C14E;outline-offset:2px}
.gm-btn.pri{background:#F2C14E;color:#2B2433}.gm-btn.pri:hover{background:#FFD36A}
.gm-btn[disabled]{opacity:.4;cursor:default}
.gm-score{display:flex;gap:.4rem;align-items:center}
.gm-pill{background:rgba(255,255,255,.12);border-radius:999px;padding:.35rem .8rem;font-weight:800;font-size:.9rem;white-space:nowrap}
.gm-pill.team{cursor:pointer;border:2px solid transparent}.gm-pill.team.on{border-color:#F2C14E;background:rgba(242,193,78,.18)}
.gm-pill.timer.low{background:#B3261E}
.gm-bar{height:6px;background:rgba(255,255,255,.1)}.gm-bar i{display:block;height:100%;background:#F2C14E;transition:width .3s}
.gm-stage{flex:1;overflow:auto;display:flex;flex-direction:column;align-items:center;padding:1rem .8rem 1.4rem;gap:1rem}
.gm-q{font-size:clamp(1.25rem,3.4vw,2.1rem);font-weight:800;text-align:center;line-height:1.8;max-width:900px}
.gm-q.quran,.gm .quran{font-family:'Amiri Quran','Amiri','Traditional Arabic','IBM Plex Sans Arabic',serif;font-weight:400;line-height:2.3}
.gm-sub{opacity:.75;font-size:.95rem;text-align:center}
.gm-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:.7rem;width:100%;max-width:900px}
.gm-opt{min-height:64px;padding:.7rem 1rem;border:0;border-radius:16px;background:#fff;color:#2B2433;font:inherit;font-size:clamp(1rem,2.4vw,1.35rem);font-weight:700;cursor:pointer;text-align:center;line-height:1.7;box-shadow:0 4px 0 rgba(0,0,0,.25);transition:transform .08s}
.gm-opt:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.25)}
.gm-opt.quran{font-weight:400}
.gm-opt:nth-child(4n+1){background:#FFE8A8}.gm-opt:nth-child(4n+2){background:#CDEBFF}.gm-opt:nth-child(4n+3){background:#D8F5D0}.gm-opt:nth-child(4n+4){background:#FBD3E0}
.gm-opt.ok{background:#2E7D32!important;color:#fff}.gm-opt.no{background:#B3261E!important;color:#fff;animation:gmShake .35s}
.gm-opt.dim{opacity:.45}
.gm-opt.sel{outline:4px solid #F2C14E;outline-offset:2px}
.gm-big2{display:grid;grid-template-columns:1fr 1fr;gap:1rem;width:100%;max-width:640px}
.gm-big2 .gm-opt{min-height:110px;font-size:2rem}
.gm-cols{display:grid;grid-template-columns:1fr 1fr;gap:1rem;width:100%;max-width:900px}
.gm-col{display:flex;flex-direction:column;gap:.6rem}
.gm-chip{min-height:52px;padding:.5rem .9rem;border:0;border-radius:14px;background:#fff;color:#2B2433;font:inherit;font-weight:700;font-size:clamp(1rem,2.2vw,1.3rem);cursor:pointer;line-height:1.7;box-shadow:0 3px 0 rgba(0,0,0,.25)}
.gm-chip.quran{font-weight:400;font-size:clamp(1.15rem,2.6vw,1.6rem)}
.gm-chip.sel{outline:4px solid #F2C14E;outline-offset:2px}
.gm-chip.ok{background:#2E7D32;color:#fff}.gm-chip.no{background:#B3261E;color:#fff;animation:gmShake .35s}
.gm-chip.done{opacity:.35;pointer-events:none}
.gm-line{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;min-height:70px;width:100%;max-width:1000px;padding:.8rem;border:2px dashed rgba(255,255,255,.35);border-radius:18px}
.gm-pool{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;width:100%;max-width:1000px}
.gm-line,.gm-pool{flex-shrink:0}
.gm-line.vert,.gm-pool.vert{flex-direction:column;flex-wrap:nowrap;align-items:stretch}
.gm-chip{white-space:normal;overflow-wrap:anywhere;max-width:100%;text-align:center}
.gm-line.vert .gm-chip,.gm-pool.vert .gm-chip{width:100%;text-align:start;padding:.6rem .9rem}
.gm-chip .gm-no{display:inline-flex;align-items:center;justify-content:center;min-width:1.7em;height:1.7em;margin-inline-end:.5em;border-radius:50%;background:#F2C14E;color:#2B2433;font:800 .8rem 'IBM Plex Sans Arabic',Tahoma,sans-serif;vertical-align:middle}
.gm-card{width:min(92vw,560px);min-height:230px;border-radius:24px;background:#fff;color:#2B2433;display:flex;align-items:center;justify-content:center;text-align:center;padding:1.5rem;font-size:clamp(1.4rem,4vw,2.4rem);font-weight:800;line-height:1.8;cursor:pointer;box-shadow:0 10px 0 rgba(0,0,0,.25);user-select:none}
.gm-card.back{background:#FFE8A8}
.gm-card.quran{font-weight:400}
.gm-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:.7rem;width:100%;max-width:1000px}
.gm-group{min-height:90px;border:0;border-radius:18px;font:inherit;font-weight:800;font-size:1.15rem;cursor:pointer;color:#2B2433;padding:.6rem;box-shadow:0 4px 0 rgba(0,0,0,.25)}
.gm-group small{display:block;font-weight:600;font-size:.8rem;opacity:.75;margin-top:.3rem}
.gm-mem{display:grid;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));gap:.6rem;width:100%;max-width:820px}
.gm-mc{aspect-ratio:4/3;border:0;border-radius:16px;background:linear-gradient(135deg,#7B5FA0,#4B3A5A);color:#fff;font:inherit;font-weight:800;font-size:clamp(.9rem,2.4vw,1.35rem);cursor:pointer;padding:.4rem;line-height:1.5;box-shadow:0 4px 0 rgba(0,0,0,.3)}
.gm-mc.up{background:#fff;color:#2B2433}.gm-mc.got{background:#2E7D32;color:#fff;pointer-events:none}
.gm-mc .q{font-size:1.6rem;opacity:.6}
.gm-text{max-width:1000px;font-size:clamp(1.2rem,3vw,1.9rem);line-height:2.4;text-align:center}
.gm-blank{display:inline-block;min-width:4.5em;margin:0 .2em;padding:0 .4em;border:0;border-bottom:3px solid #F2C14E;background:rgba(255,255,255,.08);color:#F2C14E;border-radius:8px 8px 0 0;font:inherit;cursor:pointer;line-height:1.6;vertical-align:baseline}
.gm-blank.sel{background:rgba(242,193,78,.25)}.gm-blank.ok{color:#9BE7A0;border-color:#9BE7A0}.gm-blank.no{color:#FF9C94;border-color:#FF9C94}
.gm-wheel{position:relative;width:min(86vw,62vh,520px);aspect-ratio:1}
.gm-wheel canvas{width:100%;height:100%;border-radius:50%;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.gm-wheel::after{content:'';position:absolute;top:-6px;left:50%;transform:translateX(-50%);border:16px solid transparent;border-top:28px solid #F2C14E;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))}
.gm-res{font-size:clamp(1.6rem,5vw,3rem);font-weight:900;color:#F2C14E;text-align:center;min-height:1.6em}
.gm-foot{display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;padding:.6rem .8rem calc(.8rem + env(safe-area-inset-bottom,0px))}
.gm-end{text-align:center;display:flex;flex-direction:column;align-items:center;gap:.8rem;margin:auto}
.gm-stars{display:flex;flex-direction:column;align-items:center}
.gm-end h2{margin:0;font-size:2rem}
.gm-fb{position:fixed;left:50%;top:22%;transform:translate(-50%,-50%) scale(.6);font-size:5rem;opacity:0;pointer-events:none;transition:all .25s;z-index:9700}
.gm-fb.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.gm-conf{position:fixed;inset:0;pointer-events:none;z-index:9700}
@keyframes gmShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
@media (max-width:600px){.gm-cols{gap:.5rem}.gm-mem{--cols:3!important}.gm-btn span.t{display:none}}
@media (prefers-reduced-motion:reduce){.gm *{animation:none!important;transition:none!important}}`;
    document.head.appendChild(s);
}
let quranFontDone = false;
function ensureQuranFont() {
    if (quranFontDone) return; quranFontDone = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Amiri+Quran&display=swap';
    document.head.appendChild(l);
}

// ------------------------------------------------------------------ اللاعب
/**
 * @param {{title:string, template:string, content:object, subject?:string}} game
 * @param {{onClose?:Function, onFinish?:Function, teams?:boolean, embedded?:boolean}} opts
 */
export function openGame(game, opts = {}) {
    ensureCss();
    const quran = game.subject === 'quran' || (game.content && game.content.quran);
    if (quran) ensureQuranFont();
    const qc = quran ? 'quran' : '';
    const root = document.createElement('div');
    root.className = 'gm';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', game.title || 'لعبة');
    const t = templateOf(game.template);
    root.innerHTML = `
        <div class="gm-top">
            ${opts.embedded ? '' : `<button type="button" class="gm-btn" data-g="close" aria-label="قفل اللعبة">${gi('close', { tile: false, size: 20 })}</button>`}
            <div class="gm-title">${gi(t.id, { size: 34 })}<span>${esc(game.title || t.name)}<small>${esc(t.name)}</small></span></div>
            <div class="gm-score" data-g="score"></div>
            <button type="button" class="gm-btn" data-g="teams" title="فريقين (للمجموعات)">${gi('teams', { tile: false, size: 20 })} <span class="t">فريقين</span></button>
            <button type="button" class="gm-btn" data-g="mute" aria-label="الصوت">${gi(muted ? 'mute' : 'sound', { tile: false, size: 20 })}</button>
            <button type="button" class="gm-btn" data-g="full" aria-label="ملء الشاشة">${gi('full', { tile: false, size: 20 })}</button>
        </div>
        <div class="gm-bar"><i style="width:0%"></i></div>
        <div class="gm-stage" data-g="stage"></div>
        <div class="gm-foot" data-g="foot"></div>
        <div class="gm-fb" data-g="fb"></div>`;
    document.body.appendChild(root);
    const $ = (s) => root.querySelector(`[data-g="${s}"]`);
    const stage = $('stage'), foot = $('foot');
    const state = { score: 0, total: 0, wrong: 0, teams: !!opts.teams, team: 0, teamScore: [0, 0], timer: null };
    let destroyed = false;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = () => {
        if (destroyed) return; destroyed = true;
        clearInterval(state.timer);
        document.removeEventListener('keydown', onKey);
        if (document.fullscreenElement === root) document.exitFullscreen().catch(() => {});
        root.remove();
        document.body.style.overflow = prevOverflow;
        if (opts.onClose) opts.onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) close(); };
    document.addEventListener('keydown', onKey);
    if ($('close')) $('close').addEventListener('click', close);
    $('mute').addEventListener('click', () => { muted = !muted; $('mute').innerHTML = gi(muted ? 'mute' : 'sound', { tile: false, size: 20 }); try { localStorage.setItem('tm_gm_mute', muted ? '1' : '0'); } catch (e) { /* تجاهل */ } });
    $('full').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (root.requestFullscreen) root.requestFullscreen().catch(() => {}); });
    $('teams').addEventListener('click', () => { state.teams = !state.teams; state.teamScore = [0, 0]; state.team = 0; renderScore(); });
    if (t.id === 'wheel' || t.id === 'flash') $('teams').hidden = true;

    function renderScore() {
        const sc = $('score');
        if (t.id === 'wheel') { sc.innerHTML = ''; return; }
        if (state.teams) {
            sc.innerHTML = `<span class="gm-pill team ${state.team === 0 ? 'on' : ''}" data-team="0"><i class="gm-dot b"></i> ${state.teamScore[0]}</span><span class="gm-pill team ${state.team === 1 ? 'on' : ''}" data-team="1"><i class="gm-dot r"></i> ${state.teamScore[1]}</span>`;
            sc.querySelectorAll('[data-team]').forEach((p) => p.addEventListener('click', () => { state.team = Number(p.dataset.team); renderScore(); }));
        } else sc.innerHTML = `<span class="gm-pill">${gi('star', { tile: false, size: 16, cls: 'gold' })} ${state.score}${state.total ? ` / ${state.total}` : ''}</span>`;
        $('teams').style.background = state.teams ? 'rgba(242,193,78,.3)' : '';
    }
    const progress = (i, n) => { root.querySelector('.gm-bar i').style.width = `${n ? Math.round((i / n) * 100) : 0}%`; };
    function feedback(ok) {
        const fb = $('fb');
        fb.innerHTML = ok ? `<span class="gm-fb-ic ok">${gi(['star', 'check', 'sparkle'][Math.floor(Math.random() * 3)], { tile: false, size: 64 })}</span>` : `<span class="gm-fb-ic no">${gi('cross', { tile: false, size: 56 })}</span>`;
        fb.classList.add('show');
        setTimeout(() => fb.classList.remove('show'), 650);
        if (ok) { sfx.good(); if (state.teams) state.teamScore[state.team] += 1; else state.score += 1; }
        else { sfx.bad(); state.wrong += 1; }
        renderScore();
    }
    const nextTurn = () => { if (state.teams) { state.team = 1 - state.team; renderScore(); } };
    function footer(btns) {
        foot.innerHTML = btns.map((b) => `<button type="button" class="gm-btn ${b.pri ? 'pri' : ''}" data-f="${b.id}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('');
        btns.forEach((b) => { const el = foot.querySelector(`[data-f="${b.id}"]`); if (el && b.on) el.addEventListener('click', b.on); });
    }
    function confetti() {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const c = document.createElement('canvas'); c.className = 'gm-conf'; root.appendChild(c);
        const ctx = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
        const colors = ['#F2C14E', '#7FD4FF', '#9BE7A0', '#FF9CBB', '#fff'];
        const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5, r: 4 + Math.random() * 5, vy: 2 + Math.random() * 3, vx: -1.5 + Math.random() * 3, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6 }));
        let f = 0;
        (function draw() {
            if (destroyed) return;
            ctx.clearRect(0, 0, c.width, c.height);
            ps.forEach((p) => { p.y += p.vy; p.x += p.vx; p.a += 0.1; ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); });
            if (++f < 200) requestAnimationFrame(draw); else c.remove();
        })();
    }
    function finish(restart) {
        clearInterval(state.timer);
        progress(1, 1);
        sfx.win(); confetti();
        const ratio = state.total ? state.score / state.total : (state.wrong === 0 ? 1 : Math.max(0, 1 - state.wrong / 8));
        const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
        let msg = '';
        if (state.teams) {
            const [a, b] = state.teamScore;
            msg = a === b ? `تعادل! ${a} - ${b}` : `فاز ${a > b ? 'الفريق الأزرق' : 'الفريق الأحمر'} (${Math.max(a, b)} - ${Math.min(a, b)})`;
        } else msg = state.total ? `جاوبت ${state.score} من ${state.total}` : (state.wrong ? `خلصت بـ ${state.wrong} غلطة` : 'من غير ولا غلطة!');
        stage.innerHTML = `<div class="gm-end"><div class="gm-stars" aria-label="${stars} نجوم">${gi('trophy', { size: 72 })}<span class="gm-starrow">${[0, 1, 2].map((k) => gi(k < stars ? 'star' : 'starEmpty', { tile: false, size: 40, cls: k < stars ? 'gold' : 'dim' })).join('')}</span></div>
            <h2>${stars === 3 ? 'ممتاز! ما شاء الله' : stars === 2 ? 'برافو!' : 'كويس، نجرّب تاني؟'}</h2><p class="gm-sub">${msg}</p></div>`;
        footer([{ id: 'again', label: `${gi('replay', { tile: false, size: 18 })} العب تاني`, pri: true, on: () => { state.score = 0; state.total = 0; state.wrong = 0; state.teamScore = [0, 0]; renderScore(); restart(); } }, ...(opts.embedded ? [] : [{ id: 'x', label: 'خروج', on: close }])]);
        if (opts.onFinish) try { opts.onFinish({ score: state.score, total: state.total, wrong: state.wrong }); } catch (e) { /* تجاهل */ }
    }

    const C = game.content || {};
    const RUN = {
        // ------------------------------------------------ اختيار من متعدد / صح ولا غلط
        quiz() {
            const qs = shuffle((C.questions || []).filter((q) => q && q.q && Array.isArray(q.options) && q.options.length >= 2));
            if (!qs.length) return empty();
            let i = 0;
            state.total = qs.length; renderScore();
            const timerSec = Number(C.timer) || 0;
            const show = () => {
                clearInterval(state.timer);
                if (i >= qs.length) return finish(RUN.quiz);
                progress(i, qs.length);
                const q = qs[i];
                const opts2 = shuffle(q.options.map((o, k) => ({ o, ok: k === (Number(q.answer) || 0) })));
                stage.innerHTML = `<p class="gm-sub">سؤال ${i + 1} من ${qs.length}${state.teams ? ` · دور ${state.team === 0 ? 'الأزرق 🔵' : 'الأحمر 🔴'}` : ''}</p>
                    <div class="gm-q ${q.quran || C.quran ? 'quran' : ''}">${esc(q.q)}</div>
                    <div class="gm-opts">${opts2.map((x, k) => `<button type="button" class="gm-opt ${q.quran || C.quran ? 'quran' : ''}" data-k="${k}">${esc(x.o)}</button>`).join('')}</div>`;
                let answered = false;
                const answer = (k) => {
                    if (answered) return; answered = true; clearInterval(state.timer);
                    const btns = stage.querySelectorAll('.gm-opt');
                    btns.forEach((b, j) => { if (opts2[j].ok) b.classList.add('ok'); else if (j === k) b.classList.add('no'); else b.classList.add('dim'); });
                    feedback(k >= 0 && opts2[k].ok);
                    footer([{ id: 'next', label: i + 1 < qs.length ? 'اللي بعده ←' : `النتيجة ${gi('trophy', { tile: false, size: 18 })}`, pri: true, on: () => { i += 1; nextTurn(); show(); } }]);
                };
                stage.querySelectorAll('.gm-opt').forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.k))));
                footer([{ id: 'skip', label: 'عدّي', on: () => { answer(-1); } }]);
                if (timerSec) {
                    let left = timerSec;
                    const sc = $('score');
                    const pill = document.createElement('span'); pill.className = 'gm-pill timer'; sc.appendChild(pill);
                    const draw = () => { pill.textContent = `⏱ ${left}`; pill.classList.toggle('low', left <= 5); };
                    draw();
                    state.timer = setInterval(() => { left -= 1; draw(); if (left <= 5 && left > 0) sfx.tick(); if (left <= 0) answer(-1); }, 1000);
                }
            };
            show();
        },
        truefalse() {
            const items = shuffle((C.items || []).filter((x) => x && x.q));
            if (!items.length) return empty();
            let i = 0;
            state.total = items.length; renderScore();
            const show = () => {
                if (i >= items.length) return finish(RUN.truefalse);
                progress(i, items.length);
                const it = items[i];
                stage.innerHTML = `<p class="gm-sub">${i + 1} من ${items.length}</p><div class="gm-q ${C.quran ? 'quran' : ''}">${esc(it.q)}</div>
                    <div class="gm-big2"><button type="button" class="gm-opt" data-v="1" style="background:#D8F5D0">${gi('check', { tile: false, size: 26 })} صح</button><button type="button" class="gm-opt" data-v="0" style="background:#FBD3E0">${gi('cross', { tile: false, size: 26 })} غلط</button></div>
                    ${it.note ? `<p class="gm-sub" data-note hidden>${gi('hint', { tile: false, size: 16 })} ${esc(it.note)}</p>` : ''}`;
                let done = false;
                stage.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
                    if (done) return; done = true;
                    const ok = (b.dataset.v === '1') === !!it.a;
                    b.classList.add(ok ? 'ok' : 'no');
                    const n = stage.querySelector('[data-note]'); if (n) n.hidden = false;
                    feedback(ok);
                    footer([{ id: 'next', label: i + 1 < items.length ? 'اللي بعده ←' : `النتيجة ${gi('trophy', { tile: false, size: 18 })}`, pri: true, on: () => { i += 1; nextTurn(); show(); } }]);
                }));
                footer([]);
            };
            show();
        },
        // ------------------------------------------------ وصّل
        match() {
            const all = (C.pairs || []).filter((p) => p && p[0] && p[1]);
            if (!all.length) return empty();
            const rounds = [];
            for (let k = 0; k < all.length; k += 6) rounds.push(all.slice(k, k + 6));
            let r = 0;
            const show = () => {
                if (r >= rounds.length) return finish(RUN.match);
                progress(r, rounds.length);
                const pairs = rounds[r].map((p, k) => ({ a: p[0], b: p[1], k }));
                const L = shuffle(pairs), R = shuffle(pairs);
                stage.innerHTML = `<p class="gm-sub">اضغط على كلمة من اليمين وبعدين اللي يناسبها من الشمال${rounds.length > 1 ? ` · جولة ${r + 1} من ${rounds.length}` : ''}</p>
                    <div class="gm-cols"><div class="gm-col">${L.map((p) => `<button type="button" class="gm-chip ${qc}" data-l="${p.k}">${esc(p.a)}</button>`).join('')}</div>
                    <div class="gm-col">${R.map((p) => `<button type="button" class="gm-chip ${qc}" data-r="${p.k}">${esc(p.b)}</button>`).join('')}</div></div>`;
                let sel = null, left = pairs.length;
                stage.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => { stage.querySelectorAll('[data-l]').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); sel = b; }));
                stage.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
                    if (!sel) { b.classList.add('no'); setTimeout(() => b.classList.remove('no'), 400); return; }
                    if (sel.dataset.l === b.dataset.r) {
                        sel.classList.remove('sel'); sel.classList.add('ok', 'done'); b.classList.add('ok', 'done'); feedback(true); sel = null; left -= 1;
                        if (!left) footer([{ id: 'next', label: r + 1 < rounds.length ? 'الجولة الجاية ←' : `النتيجة ${gi('trophy', { tile: false, size: 18 })}`, pri: true, on: () => { r += 1; show(); } }]);
                    } else { b.classList.add('no'); sel.classList.add('no'); const s2 = sel; setTimeout(() => { b.classList.remove('no'); s2.classList.remove('no'); }, 450); feedback(false); nextTurn(); }
                }));
                footer([]);
            };
            show();
        },
        // ------------------------------------------------ رتّب (بجولات)
        order() {
            const rounds = (Array.isArray(C.rounds) && C.rounds.length ? C.rounds : [{ prompt: C.prompt, items: C.items }]).filter((x) => x && Array.isArray(x.items) && x.items.length >= 2);
            if (!rounds.length) return empty();
            let r = 0;
            const show = () => {
                if (r >= rounds.length) return finish(RUN.order);
                progress(r, rounds.length);
                const rd = rounds[r];
                const items = rd.items.map((txt, k) => ({ txt, k }));
                let pool = shuffle(items);
                if (pool.every((p, k) => p.k === k) && pool.length > 1) pool = pool.reverse();
                const vert = rd.vertical || items.some((x) => String(x.txt).length > 38);
                let line = [];
                const draw = () => {
                    stage.innerHTML = `<p class="gm-sub">${esc(rd.prompt || 'رتّب بالترتيب الصح')}${rounds.length > 1 ? ` · ${r + 1} من ${rounds.length}` : ''}</p>
                        <div class="gm-line ${vert ? 'vert' : ''}" data-line>${line.map((p, k) => `<button type="button" class="gm-chip ${qc}" data-back="${k}">${vert ? `<span class="gm-no">${k + 1}</span>` : ''}${esc(p.txt)}</button>`).join('') || `<span class="gm-sub">${vert ? 'اضغط على الآيات بالترتيب ↓' : 'اضغط على الكلمات بالترتيب ↓'}</span>`}</div>
                        <div class="gm-pool ${vert ? 'vert' : ''}">${pool.map((p, k) => `<button type="button" class="gm-chip ${qc}" data-take="${k}">${esc(p.txt)}</button>`).join('')}</div>`;
                    stage.querySelectorAll('[data-take]').forEach((b) => b.addEventListener('click', () => { line.push(pool.splice(Number(b.dataset.take), 1)[0]); draw(); }));
                    stage.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { pool.push(line.splice(Number(b.dataset.back), 1)[0]); draw(); }));
                    footer([{ id: 'check', label: `تحقق ${gi('check', { tile: false, size: 18 })}`, pri: true, disabled: pool.length > 0, on: check }, { id: 'reset', label: 'من الأول', on: () => { pool = shuffle(items); line = []; draw(); } }]);
                };
                const check = () => {
                    const chips = stage.querySelectorAll('[data-back]');
                    let ok = true;
                    line.forEach((p, k) => { const good = plain(p.txt) === plain(items[k].txt); if (!good) ok = false; chips[k].classList.add(good ? 'ok' : 'no'); });
                    feedback(ok);
                    if (ok) footer([{ id: 'next', label: r + 1 < rounds.length ? 'اللي بعده ←' : `النتيجة ${gi('trophy', { tile: false, size: 18 })}`, pri: true, on: () => { r += 1; nextTurn(); show(); } }]);
                    else footer([{ id: 'retry', label: 'صحّح الغلط', pri: true, on: () => { const keep = []; for (let k = 0; k < line.length; k++) { if (plain(line[k].txt) === plain(items[k].txt) && keep.length === k) keep.push(line[k]); else break; } pool = shuffle(items.filter((x) => !keep.includes(x))); line = keep; nextTurn(); draw(); } },
                        { id: 'show', label: 'وريني الحل', on: () => { line = items.slice(); pool = []; draw(); foot.innerHTML = ''; footer([{ id: 'next', label: r + 1 < rounds.length ? 'اللي بعده ←' : `النتيجة ${gi('trophy', { tile: false, size: 18 })}`, pri: true, on: () => { r += 1; nextTurn(); show(); } }]); } }]);
                };
                draw();
            };
            show();
        },
        // ------------------------------------------------ صنّف
        sort() {
            const groups = (C.groups || []).filter((g) => g && g.name && Array.isArray(g.items));
            const items = shuffle(groups.flatMap((g, gi) => g.items.filter(Boolean).map((txt) => ({ txt, gi }))));
            if (groups.length < 2 || !items.length) return empty();
            const colors = ['#FFE8A8', '#CDEBFF', '#D8F5D0', '#FBD3E0', '#E6DBFF', '#FFD9C2'];
            let i = 0;
            state.total = items.length; renderScore();
            const show = () => {
                if (i >= items.length) return finish(RUN.sort);
                progress(i, items.length);
                const it = items[i];
                stage.innerHTML = `<p class="gm-sub">${esc(C.prompt || 'الكلمة دي تبع أنهي مجموعة؟')} · ${i + 1} من ${items.length}</p>
                    <div class="gm-card ${qc}" style="cursor:default">${esc(it.txt)}</div>
                    <div class="gm-groups">${groups.map((g, k) => `<button type="button" class="gm-group" data-gi="${k}" style="background:${colors[k % colors.length]}">${esc(g.name)}${g.hint ? `<small>${esc(g.hint)}</small>` : ''}</button>`).join('')}</div>`;
                let done = false;
                stage.querySelectorAll('[data-gi]').forEach((b) => b.addEventListener('click', () => {
                    if (done) return; done = true;
                    const ok = Number(b.dataset.gi) === it.gi;
                    b.classList.add(ok ? 'ok' : 'no');
                    if (!ok) stage.querySelector(`[data-gi="${it.gi}"]`).style.outline = '4px solid #9BE7A0';
                    feedback(ok);
                    setTimeout(() => { i += 1; nextTurn(); show(); }, ok ? 650 : 1300);
                }));
                footer([]);
            };
            show();
        },
        // ------------------------------------------------ بطاقات الذاكرة
        memory() {
            const pairs = (C.pairs || []).filter((p) => p && p[0] && p[1]).slice(0, 10);
            if (pairs.length < 2) return empty();
            const run = () => {
                const cards = shuffle(pairs.flatMap((p, k) => [{ t: p[0], k }, { t: p[1], k }]));
                const cols = cards.length <= 8 ? 4 : cards.length <= 12 ? 4 : 5;
                stage.innerHTML = `<p class="gm-sub">اقلب كارتين… لو بيكمّلوا بعض يفضلوا مفتوحين</p>
                    <div class="gm-mem" style="--cols:${cols}">${cards.map((c, i) => `<button type="button" class="gm-mc ${qc}" data-i="${i}" aria-label="كارت ${i + 1}"><span class="q">؟</span></button>`).join('')}</div>`;
                let open = [], got = 0, busy = false;
                progress(0, pairs.length);
                stage.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
                    const i = Number(b.dataset.i);
                    if (busy || b.classList.contains('up') || b.classList.contains('got')) return;
                    b.classList.add('up'); b.textContent = cards[i].t; open.push(i);
                    if (open.length < 2) return;
                    const [x, y] = open; open = [];
                    const bx = stage.querySelector(`[data-i="${x}"]`), by = stage.querySelector(`[data-i="${y}"]`);
                    if (cards[x].k === cards[y].k) {
                        bx.classList.add('got'); by.classList.add('got'); got += 1; feedback(true); progress(got, pairs.length);
                        if (got === pairs.length) setTimeout(() => finish(run), 600);
                    } else {
                        busy = true; feedback(false); nextTurn();
                        setTimeout(() => { [bx, by].forEach((el) => { el.classList.remove('up'); el.innerHTML = '<span class="q">؟</span>'; }); busy = false; }, 1100);
                    }
                }));
                footer([]);
            };
            run();
        },
        // ------------------------------------------------ أكمل الفراغ
        fill() {
            const raw = String(C.text || '').trim();
            if (!raw) return empty();
            const run = () => {
                // [كلمة] = مخفية. لو مفيش أقواس: بنخفي كلمات عشوائية حسب الصعوبة
                const tokens = [];
                const re = /\[([^\]]+)\]|(\S+)/g;
                let m, explicit = /\[[^\]]+\]/.test(raw);
                while ((m = re.exec(raw))) tokens.push(m[1] ? { w: m[1], hide: true } : { w: m[2], hide: false });
                if (!explicit) {
                    const every = { easy: 6, medium: 4, hard: 3 }[C.level || 'medium'] || 4;
                    const cands = tokens.map((tk, i) => i).filter((i) => plain(tokens[i].w).length >= 2 && !/^[﴿﴾()0-9٠-٩.,،:؛!؟«»-]+$/.test(tokens[i].w));
                    shuffle(cands).slice(0, Math.max(1, Math.round(cands.length / every))).forEach((i) => { tokens[i].hide = true; });
                }
                const blanks = tokens.map((tk, i) => (tk.hide ? i : -1)).filter((i) => i >= 0);
                state.total = blanks.length; state.score = 0; renderScore();
                const reveal = C.mode === 'reveal';
                const bank = shuffle(blanks.map((i) => ({ w: tokens[i].w, i })));
                const filled = {};
                let selBlank = blanks[0];
                const draw = () => {
                    stage.innerHTML = `<p class="gm-sub">${reveal ? 'الطالب يقول الكلمة الناقصة… واضغط عليها تظهر' : 'اضغط على الفراغ وبعدين الكلمة المناسبة (أو الكلمة على طول)'}</p>
                        <div class="gm-text ${qc}">${tokens.map((tk, i) => tk.hide
                            ? `<button type="button" class="gm-blank ${filled[i] ? (filled[i].ok ? 'ok' : 'no') : ''} ${selBlank === i && !filled[i] ? 'sel' : ''}" data-b="${i}">${filled[i] ? esc(filled[i].w) : '&nbsp;'}</button>`
                            : esc(tk.w)).join(' ')}</div>
                        ${reveal ? '' : `<div class="gm-pool">${bank.map((b, k) => `<button type="button" class="gm-chip ${qc} ${b.used ? 'done' : ''}" data-w="${k}">${esc(b.w)}</button>`).join('')}</div>`}`;
                    stage.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => {
                        const i = Number(b.dataset.b);
                        if (filled[i] && filled[i].ok) return;
                        if (reveal) { filled[i] = { w: tokens[i].w, ok: true }; state.score += 1; renderScore(); sfx.good(); draw(); checkEnd(); return; }
                        if (filled[i] && !filled[i].ok) { const bk = bank.find((x) => x === filled[i].from); if (bk) bk.used = false; delete filled[i]; }
                        selBlank = i; draw();
                    }));
                    stage.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => {
                        const bk = bank[Number(b.dataset.w)];
                        let target = selBlank;
                        if (target == null || filled[target]) target = blanks.find((i) => !filled[i]);
                        if (target == null) return;
                        const ok = plain(bk.w) === plain(tokens[target].w);
                        filled[target] = { w: bk.w, ok, from: bk }; bk.used = true;
                        feedback(ok);
                        if (!ok) { state.total = state.total; setTimeout(() => { delete filled[target]; bk.used = false; draw(); }, 900); }
                        selBlank = blanks.find((i) => !filled[i]);
                        draw(); checkEnd();
                    }));
                    footer([{ id: 'reveal', label: 'وريني الكل', on: () => { blanks.forEach((i) => { if (!filled[i]) filled[i] = { w: tokens[i].w, ok: true, shown: true }; }); draw(); checkEnd(); } }, { id: 'again', label: `${gi('shuffle', { tile: false, size: 18 })} فراغات تانية`, on: run }]);
                };
                const checkEnd = () => { if (blanks.every((i) => filled[i] && filled[i].ok)) setTimeout(() => finish(run), 700); };
                draw();
            };
            run();
        },
        // ------------------------------------------------ بطاقات التسميع
        flash() {
            const cards = (C.cards || []).filter((c) => c && c[0]);
            if (!cards.length) return empty();
            let deck = cards.slice(), i = 0, back = false;
            const draw = () => {
                progress(i, deck.length);
                const c = deck[i];
                stage.innerHTML = `<p class="gm-sub">${i + 1} من ${deck.length} · اضغط على الكارت يتقلب</p>
                    <div class="gm-card ${back ? 'back' : ''} ${qc}" data-card role="button" tabindex="0">${esc(back ? (c[1] || c[0]) : c[0])}</div>`;
                const card = stage.querySelector('[data-card]');
                const flip = () => { back = !back; draw(); };
                card.addEventListener('click', flip);
                card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
                footer([{ id: 'prev', label: '→ اللي قبله', disabled: i === 0, on: () => { i -= 1; back = false; draw(); } },
                    { id: 'next', label: i + 1 < deck.length ? 'اللي بعده ←' : 'خلصنا', pri: true, on: () => { if (i + 1 >= deck.length) { finish(() => { i = 0; back = false; draw(); }); return; } i += 1; back = false; draw(); } },
                    { id: 'sh', label: `${gi('shuffle', { tile: false, size: 18 })} لخبط`, on: () => { deck = shuffle(deck); i = 0; back = false; draw(); } }]);
            };
            draw();
        },
        // ------------------------------------------------ كوّن الكلمة
        letters() {
            const words = shuffle((C.words || []).map((w) => String(w || '').trim()).filter((w) => plain(w).length >= 2));
            if (!words.length) return empty();
            let i = 0;
            state.total = words.length; renderScore();
            const show = () => {
                if (i >= words.length) return finish(RUN.letters);
                progress(i, words.length);
                const word = words[i];
                const letters = [...plain(word).replace(/\s+/g, '')];
                let pool = shuffle(letters.map((ch, k) => ({ ch, k })));
                if (pool.length > 1 && pool.every((p, k) => p.k === k)) pool.reverse();
                let line = [];
                let tries = 0;
                const draw = () => {
                    stage.innerHTML = `<p class="gm-sub">كوّن الكلمة من الحروف · ${i + 1} من ${words.length}</p>
                        ${C.hints && C.hints[word] ? `<div class="gm-q">${esc(C.hints[word])}</div>` : ''}
                        <div class="gm-line" style="direction:rtl">${line.map((p, k) => `<button type="button" class="gm-chip" data-back="${k}" style="min-width:52px;font-size:1.6rem">${esc(p.ch)}</button>`).join('') || '<span class="gm-sub">↓ اضغط الحروف بالترتيب</span>'}</div>
                        <div class="gm-pool">${pool.map((p, k) => `<button type="button" class="gm-chip" data-take="${k}" style="min-width:52px;font-size:1.6rem">${esc(p.ch)}</button>`).join('')}</div>
                        ${line.length ? `<div class="gm-q" style="font-size:2.2rem">${esc(line.map((p) => p.ch).join(''))}</div>` : ''}`;
                    stage.querySelectorAll('[data-take]').forEach((b) => b.addEventListener('click', () => { line.push(pool.splice(Number(b.dataset.take), 1)[0]); draw(); if (!pool.length) check(); }));
                    stage.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { pool.push(line.splice(Number(b.dataset.back), 1)[0]); draw(); }));
                    footer([{ id: 'hint', label: `${gi('hint', { tile: false, size: 18 })} أول حرف`, on: () => { if (line.length) return; const k = pool.findIndex((p) => p.ch === letters[0]); if (k >= 0) { line.push(pool.splice(k, 1)[0]); draw(); } } }, { id: 'skip', label: 'عدّي', on: () => { stage.insertAdjacentHTML('beforeend', `<div class="gm-res">${esc(word)}</div>`); setTimeout(() => { i += 1; nextTurn(); show(); }, 1200); } }]);
                };
                const check = () => {
                    const ok = line.map((p) => p.ch).join('') === letters.join('');
                    tries += 1;
                    if (ok) { if (tries === 1) feedback(true); else { sfx.good(); } stage.insertAdjacentHTML('beforeend', `<div class="gm-res">${gi('check', { tile: false, size: 22 })} ${esc(word)}</div>`); setTimeout(() => { i += 1; nextTurn(); show(); }, 1100); }
                    else { feedback(false); setTimeout(() => { pool = shuffle(letters.map((ch, k) => ({ ch, k }))); line = []; draw(); }, 800); }
                };
                draw();
            };
            show();
        },
        // ------------------------------------------------ العجلة
        wheel() {
            let items = (C.items || []).map((x) => String(x || '').trim()).filter(Boolean);
            if (items.length < 2) return empty();
            const all = items.slice();
            const colors = ['#F2C14E', '#7FD4FF', '#9BE7A0', '#FF9CBB', '#C9B6FF', '#FFB38A', '#8EE3D6', '#F6E27F'];
            let angle = 0, spinning = false, removeAfter = C.remove !== false;
            stage.innerHTML = `<div class="gm-wheel"><canvas width="640" height="640"></canvas></div><div class="gm-res" data-res aria-live="polite"></div>`;
            const cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
            const draw = () => {
                const n = items.length, R = 320, a = (Math.PI * 2) / n;
                ctx.clearRect(0, 0, 640, 640);
                for (let k = 0; k < n; k++) {
                    ctx.beginPath(); ctx.moveTo(R, R); ctx.arc(R, R, R, angle + k * a, angle + (k + 1) * a); ctx.closePath();
                    ctx.fillStyle = colors[k % colors.length]; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.stroke();
                    ctx.save(); ctx.translate(R, R); ctx.rotate(angle + (k + 0.5) * a); ctx.textAlign = 'right'; ctx.fillStyle = '#2B2433';
                    ctx.font = `bold ${n > 14 ? 20 : n > 8 ? 26 : 32}px 'IBM Plex Sans Arabic',Tahoma,sans-serif`;
                    const label = items[k].length > 16 ? items[k].slice(0, 15) + '…' : items[k];
                    ctx.fillText(label, R - 24, 10); ctx.restore();
                }
                ctx.beginPath(); ctx.arc(R, R, 34, 0, Math.PI * 2); ctx.fillStyle = '#2B2433'; ctx.fill();
            };
            draw();
            const spin = () => {
                if (spinning || items.length < 1) return;
                spinning = true; stage.querySelector('[data-res]').textContent = '';
                const start = angle, total = Math.PI * 2 * (5 + Math.random() * 3) + Math.random() * Math.PI * 2, dur = 3800, t0 = performance.now();
                let lastTick = 0;
                const step = (now) => {
                    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
                    angle = start + total * e; draw();
                    if (now - lastTick > 90 && p < 0.85) { sfx.tick(); lastTick = now; }
                    if (p < 1 && !destroyed) requestAnimationFrame(step);
                    else {
                        spinning = false;
                        const n = items.length, a = (Math.PI * 2) / n;
                        const pointer = -Math.PI / 2;
                        let rel = ((pointer - angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                        const k = Math.floor(rel / a) % n;
                        const won = items[k];
                        stage.querySelector('[data-res]').innerHTML = `${gi('sparkle', { tile: false, size: 22, cls: 'gold' })} ${esc(won)}`;
                        sfx.win();
                        if (removeAfter && items.length > 1) { items = items.filter((_, j) => j !== k); setTimeout(draw, 1200); }
                        foot.querySelector('[data-f="spin"]').disabled = false;
                    }
                };
                foot.querySelector('[data-f="spin"]').disabled = true;
                requestAnimationFrame(step);
            };
            footer([{ id: 'spin', label: `${gi('wheel', { tile: false, size: 18 })} لف العجلة`, pri: true, on: spin },
                { id: 'rm', label: removeAfter ? 'شيل اللي يطلع: أيوه' : 'شيل اللي يطلع: لأ', on: (e) => { removeAfter = !removeAfter; e.currentTarget.textContent = removeAfter ? 'شيل اللي يطلع: أيوه' : 'شيل اللي يطلع: لأ'; } },
                { id: 'reset', label: '↺ رجّع الكل', on: () => { items = all.slice(); draw(); stage.querySelector('[data-res]').textContent = ''; } }]);
            cv.addEventListener('click', spin);
        }
    };
    function empty() {
        stage.innerHTML = '<div class="gm-end"><h2>اللعبة فاضية 🤔</h2><p class="gm-sub">ضيف محتوى للعبة الأول من "تعديل".</p></div>';
        footer(opts.embedded ? [] : [{ id: 'x', label: 'رجوع', pri: true, on: close }]);
    }
    renderScore();
    (RUN[t.id] || empty)();
    try { if (opts.onStart) opts.onStart(); } catch (e) { /* تجاهل */ }
    return { close, root };
}
