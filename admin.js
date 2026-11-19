/**
 * admin.js — v33: تبويبين جداد في لوحة المتابعة
 *   📣 الإشعارات: ابعتي إشعار لكل المدرسين (أو جزء منهم) يظهر نافذة في التطبيق + الجرس + إشعار الموبايل بلون مميز
 *   📚 مراجعة الكتب: الكتب اللي المدرسين عايزين ينشروها للعامة (توافقي أو ترفضي)
 *   + الرسايل التلقائية (رحلة المدرس): ظهرت لكام مدرس واتعمل بيها إيه
 * بيكلّم workflow "owner-admin" ← دالة owner_admin_api (DB_v33.sql)
 */
(() => {
'use strict';
const D = window.TMD;
if (!D) { console.error('admin.js لازم يتحمّل بعد index.html'); return; }
const { $, $$, esc, nf, ago, call, toast, errBox } = D;
const CFG = window.TM_DASH_CONFIG || {};
const EP = CFG.ADMIN_ENDPOINT || String(CFG.ENDPOINT || '').replace(/owner-dashboard$/, 'owner-admin');
const APP = (CFG.APP_URL || 'https://teachers-manager.online').replace(/\/$/, '');
const api = (action, extra = {}) => call('admin', { action, ...extra }, EP);

const COLORS = { violet: ['#5B3F7A', '#8C6FA3', 'بنفسجي'], green: ['#1F6B4F', '#3E9A73', 'أخضر'], red: ['#A12A2A', '#D9534F', 'أحمر'], orange: ['#B5651D', '#E08E3C', 'برتقالي'], blue: ['#1F5AA6', '#4C8BD9', 'أزرق'], gold: ['#8C6A12', '#D4A62A', 'دهبي'], pink: ['#B23A67', '#E77A9B', 'وردي'], teal: ['#0F6E6A', '#2FA79F', 'تركواز'] };
const EMOJIS = ['📣', '🎉', '🎮', '📚', '🆕', '⭐', '🎁', '⚠️', '💡', '🌙', '🕌', '❤️', '🔥', '✅'];
const SEGMENTS = [
    ['all', 'كل المدرسين'], ['active', 'اللي فتحوا البرنامج آخر 7 أيام'], ['inactive', 'اللي مافتحوش من أسبوع'], ['new', 'اللي سجّلوا آخر 7 أيام'],
    ['trial', 'في الفترة المجانية'], ['paid', 'المشتركين'], ['no_students', 'لسه ماضافوش طلاب'], ['no_schedules', 'عندهم طلاب من غير مواعيد'],
    ['no_lessons', 'لسه ماسجّلوش حصة'], ['has_lessons', 'سجّلوا حصص'], ['quran', 'مدرسين القرآن'], ['arabic', 'مدرسين اللغة العربية'], ['teachers', 'مدرسين بالاسم']
];
const MEDIA = { image: ['🖼️', 'صورة'], youtube: ['▶️', 'فيديو يوتيوب'], video: ['🎬', 'فيديو (ملف)'], link: ['🔗', 'لينك'], file: ['📎', 'ملف (PDF…)'], whatsapp: ['💬', 'واتساب'] };
const QUICK_BTN = [['', 'من غير زرار'], ['games.html', '🎮 صفحة ألعاب الحصة'], ['books.html', '📚 المكتبة'], ['books.html?tab=public', '🌍 المكتبة العامة'], ['subscription.html', '⭐ الاشتراك'], ['settings.html', '⚙️ الإعدادات'], ['custom', '🔗 رابط تاني']];
const CATS = { quran: '📖 القرآن الكريم', tajweed: '🎙️ التجويد', noorania: '🔤 تأسيس وقراءة', arabic: '✍️ اللغة العربية', tafsir: '💡 تفسير ومعاني', islamic: '🕌 تربية إسلامية', kids: '🧸 أطفال وقصص', worksheets: '📝 أوراق عمل وامتحانات', other: '📚 أخرى' };
const NUDGE_NAMES = { community: '🤝 انضم لمجموعة المدرسين', first_student: '👤 ضيف أول طالب', first_schedule: '🗓️ حدد المواعيد', first_lesson: '▶️ سجّل أول حصة', try_games: '🎮 جرّب الألعاب', try_books: '📚 افتح كتابك في الحصة' };

// ------------------------------------------------------------------ CSS
const st = document.createElement('style');
st.textContent = `
.nt-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}
.nt-f{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}.nt-f>label{font-weight:700;font-size:13.5px}
.nt-f input[type=text],.nt-f input[type=url],.nt-f textarea,.nt-f select{border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:#fff;width:100%}
.nt-f textarea{min-height:110px;resize:vertical;line-height:1.8}
.nt-sw{display:flex;gap:6px;flex-wrap:wrap}.nt-sw button{width:36px;height:36px;border-radius:10px;border:2px solid transparent;cursor:pointer;font-size:18px;background:var(--soft)}
.nt-sw button.on{border-color:var(--ink);box-shadow:0 0 0 2px #fff inset}
.nt-media{display:flex;flex-direction:column;gap:6px}.nt-mrow{display:grid;grid-template-columns:auto 1fr 1fr auto;gap:6px;align-items:center;background:var(--soft);padding:6px;border-radius:10px}
.nt-mrow input{border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:#fff;min-width:0}
.nt-mrow .ic{font-size:18px;padding:0 4px}.nt-x{border:0;background:transparent;cursor:pointer;font-size:16px;color:var(--ink3)}
.nt-add{display:flex;gap:6px;flex-wrap:wrap}
.nt-ch{display:flex;flex-direction:column;gap:6px}.nt-ch label{display:flex;gap:8px;align-items:center;font-size:14px;cursor:pointer}
.nt-count{font-size:13px;color:var(--ink2);margin-top:2px}
.nt-pv{position:sticky;top:76px;display:flex;flex-direction:column;gap:14px}
.nt-phone{background:#1d1b20;border-radius:22px;padding:14px 12px;color:#fff}
.nt-push{background:#2b2930;border-radius:16px;overflow:hidden}
.nt-push .h{display:flex;gap:10px;padding:10px 12px;align-items:flex-start}
.nt-push .h img{width:40px;height:40px;border-radius:50%}
.nt-push .h b{display:block;font-size:14px}.nt-push .h span{font-size:12.5px;opacity:.85;display:block;line-height:1.6}
.nt-push .h small{font-size:11px;opacity:.6}
.nt-push>img{width:100%;display:block;aspect-ratio:2/1;object-fit:cover}
.nt-app{border-radius:18px;overflow:hidden;box-shadow:var(--shadow);background:#fff;border:1px solid var(--line)}
.nt-app .hd{padding:14px 16px;color:#fff}.nt-app .hd .em{font-size:28px;display:block}.nt-app .hd b{font-size:17px;line-height:1.6}
.nt-app .bd{padding:12px 16px 16px}.nt-app .bd p{white-space:pre-wrap;margin:0 0 10px;line-height:1.8;font-size:14px}
.nt-app .bd .m{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}.nt-app .bd .m img{width:100%;border-radius:10px}
.nt-app .bd .m .lk{background:var(--soft);border-radius:10px;padding:8px 10px;font-size:13px}
.nt-app .bd .cta{display:block;text-align:center;color:#fff;border-radius:10px;padding:10px;font-weight:700}
.nt-hist .it{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line)}
.nt-hist .it:last-child{border-bottom:0}.nt-hist .em{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:20px;color:#fff;flex-shrink:0}
.nt-hist .t{flex:1;min-width:0}.nt-hist .t b{display:block}.nt-hist .t small{color:var(--ink2);font-size:12.5px}
.nt-stats{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.nt-hist .ac{display:flex;gap:4px;flex-wrap:wrap}
.bk-it{display:grid;grid-template-columns:1fr auto;gap:10px;padding:14px 0;border-bottom:1px solid var(--line)}
.bk-it:last-child{border-bottom:0}.bk-it b{font-size:15.5px}.bk-it .meta{color:var(--ink2);font-size:12.5px;margin-top:3px}
.bk-it textarea,.bk-it input,.bk-it select{border:1px solid var(--line);border-radius:8px;padding:6px 8px;width:100%;background:#fff;margin-top:6px}
.bk-it .ac{display:flex;flex-direction:column;gap:6px;min-width:150px}
.tp-list{max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:10px;margin-top:6px}
.tp-list label{display:flex;gap:8px;padding:6px 10px;border-bottom:1px solid var(--soft);font-size:13.5px;cursor:pointer}
.jr-bars .r{display:grid;grid-template-columns:200px 1fr 60px;gap:10px;align-items:center;padding:5px 0;font-size:13.5px}
.jr-bars .b{height:10px;border-radius:999px;background:var(--soft);overflow:hidden}.jr-bars .b i{display:block;height:100%;background:var(--primary)}
@media (max-width:900px){.nt-grid{grid-template-columns:1fr}.nt-pv{position:static}.nt-mrow{grid-template-columns:auto 1fr auto}.nt-mrow input.lb{display:none}.bk-it{grid-template-columns:1fr}.jr-bars .r{grid-template-columns:130px 1fr 44px}}`;
document.head.appendChild(st);

// ============================================================ 📣 الإشعارات
const blank = () => ({ id: null, title: '', body: '', emoji: '📣', color: 'violet', media: [], button_label: '', button_url: '', image_url: '', audience: { segment: 'all', teacher_ids: [] }, include_future: true, show_in_app: true, add_to_bell: true, send_push: true, ends: '7' });
let draft = blank();
let hist = null;
let teachers = null;
let countTimer = null;

function previewHtml() {
    const [c1, c2] = COLORS[draft.color] || COLORS.violet;
    const img = draft.image_url || `${APP}/assets/notify/${draft.color}-banner.png`;
    const media = draft.media.filter((m) => m.url).map((m) => m.type === 'image' ? `<img src="${esc(m.url)}" alt="">`
        : m.type === 'youtube' ? `<div class="lk">▶️ فيديو يوتيوب ${esc(m.label || '')}</div>` : `<div class="lk">${MEDIA[m.type][0]} ${esc(m.label || m.url)}</div>`).join('');
    return `
        <div class="card"><div class="section-title" style="margin:0 0 8px">📱 على الموبايل (برّه التطبيق)</div>
            <div class="nt-phone"><div class="nt-push">
                <div class="h"><img src="${APP}/assets/notify/${draft.color}-icon.png" alt=""><div><small>Teachers Manager · دلوقتي</small><b>${esc((draft.emoji ? draft.emoji + ' ' : '') + (draft.title || 'عنوان الإشعار'))}</b><span>${esc((draft.body || '').replace(/\s+/g, ' ').slice(0, 120) || 'نص الإشعار')}</span></div></div>
                ${draft.send_push ? `<img src="${esc(img)}" alt="">` : ''}
            </div></div>
            <p class="note" style="margin:8px 0 0">${draft.send_push ? 'الأيقونة والصورة الكبيرة بلون الإشعار عشان يبان وسط باقي الإشعارات (أندرويد وويندوز). الآيفون بيعرض الأيقونة العادية.' : 'إشعار الموبايل مقفول للرسالة دي.'}</p></div>
        <div class="card"><div class="section-title" style="margin:0 0 8px">🪟 جوه التطبيق (أول ما يفتحه)</div>
            <div class="nt-app"><div class="hd" style="background:linear-gradient(135deg,${c1},${c2})">${draft.emoji ? `<span class="em">${esc(draft.emoji)}</span>` : ''}<b>${esc(draft.title || 'عنوان الإشعار')}</b></div>
            <div class="bd">${draft.body ? `<p>${esc(draft.body)}</p>` : ''}${media ? `<div class="m">${media}</div>` : ''}
            ${draft.button_url ? `<span class="cta" style="background:linear-gradient(135deg,${c1},${c2})">${esc(draft.button_label || 'افتح')}</span>` : ''}</div></div></div>`;
}

function composerHtml() {
    const d = draft;
    const seg = d.audience.segment;
    return `
    <div class="nt-grid">
        <div class="card">
            <div class="section-title" style="margin-top:0">✍️ إشعار جديد${d.id ? ' <span class="tag info">مسودة</span>' : ''}</div>
            <div class="nt-f"><label>الأيقونة</label><div class="nt-sw" data-sw="emoji">${EMOJIS.map((e) => `<button type="button" data-v="${e}" class="${d.emoji === e ? 'on' : ''}">${e}</button>`).join('')}<button type="button" data-v="" class="${!d.emoji ? 'on' : ''}" title="من غير">∅</button></div></div>
            <div class="nt-f"><label for="nt-title">العنوان *</label><input type="text" id="nt-title" maxlength="140" value="${esc(d.title)}" placeholder="مثلًا: جديد! ألعاب للطلاب جوه الحصة 🎮"></div>
            <div class="nt-f"><label for="nt-body">الرسالة</label><textarea id="nt-body" maxlength="4000" placeholder="اكتبي التفاصيل… أي لينك هيبقى قابل للضغط">${esc(d.body)}</textarea></div>
            <div class="nt-f"><label>لون الإشعار (عشان يبان وسط الإشعارات)</label><div class="nt-sw" data-sw="color">${Object.entries(COLORS).map(([k, c]) => `<button type="button" data-v="${k}" class="${d.color === k ? 'on' : ''}" style="background:linear-gradient(135deg,${c[0]},${c[1]})" title="${c[2]}"></button>`).join('')}</div></div>
            <div class="nt-f"><label>وسائط (صور، فيديو، لينكات، ملفات)</label>
                <div class="nt-media" id="nt-media">${d.media.map((m, i) => `<div class="nt-mrow" data-mi="${i}"><span class="ic">${MEDIA[m.type][0]}</span><input type="url" data-mf="url" value="${esc(m.url)}" placeholder="${m.type === 'youtube' ? 'لينك اليوتيوب' : 'الرابط'}"><input class="lb" type="text" data-mf="label" value="${esc(m.label || '')}" placeholder="اسم يظهر (اختياري)"><button type="button" class="nt-x" data-mdel aria-label="مسح">✕</button></div>`).join('')}</div>
                <div class="nt-add">${Object.entries(MEDIA).map(([k, [ic, n]]) => `<button type="button" class="btn sm" data-madd="${k}">${ic} ${n}</button>`).join('')}</div>
                <input type="file" id="nt-file" hidden></div>
            <div class="nt-f"><label for="nt-btn">زرار في الآخر</label>
                <select id="nt-btn">${QUICK_BTN.map(([v, l]) => `<option value="${v}" ${(v === d.button_url || (v === 'custom' && d.button_url && !QUICK_BTN.some((q) => q[0] === d.button_url))) ? 'selected' : ''}>${l}</option>`).join('')}</select>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px" ${d.button_url ? '' : 'hidden'} id="nt-btnrow"><input type="text" id="nt-btnlabel" maxlength="60" value="${esc(d.button_label)}" placeholder="كلام الزرار (مثلًا: جرّب دلوقتي)"><input type="url" id="nt-btnurl" value="${esc(d.button_url)}" placeholder="https://…" ${QUICK_BTN.some((q) => q[0] === d.button_url && q[0] !== 'custom') ? 'readonly' : ''}></div></div>
            <div class="nt-f"><label for="nt-seg">مين يوصله؟</label>
                <select id="nt-seg">${SEGMENTS.map(([v, l]) => `<option value="${v}" ${seg === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
                <div id="nt-tp" ${seg === 'teachers' ? '' : 'hidden'}><input type="text" id="nt-tpq" placeholder="دوّري بالاسم أو الموبايل…" style="margin-top:6px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;width:100%"><div class="tp-list" id="nt-tpl"></div></div>
                <div class="nt-count" id="nt-count">…</div></div>
            <div class="nt-f"><label>يظهر فين؟</label><div class="nt-ch">
                <label><input type="checkbox" id="nt-app" ${d.show_in_app ? 'checked' : ''}> 🪟 نافذة أول ما المدرس يفتح التطبيق (+ شريط في الرئيسية)</label>
                <label><input type="checkbox" id="nt-bell" ${d.add_to_bell ? 'checked' : ''}> 🔔 جرس الإشعارات جوه التطبيق</label>
                <label><input type="checkbox" id="nt-push" ${d.send_push ? 'checked' : ''}> 📱 إشعار على الموبايل (برّه التطبيق)</label>
                <label><input type="checkbox" id="nt-future" ${d.include_future ? 'checked' : ''}> 🆕 اللي هيسجّل بعد كده يشوفه برضه (لـ"كل المدرسين" بس، لمدة 30 يوم)</label></div></div>
            <div class="nt-f" ${d.send_push ? '' : 'hidden'} id="nt-imgf"><label>صورة كبيرة في إشعار الموبايل <small style="font-weight:500;color:var(--ink2)">(اختياري — لو فاضية هتظهر صورة بلون الإشعار)</small></label>
                <div style="display:flex;gap:6px"><input type="url" id="nt-img" value="${esc(d.image_url)}" placeholder="https://… (مقاس 2:1)"><button type="button" class="btn sm" id="nt-imgup">⬆️ ارفعي</button></div></div>
            <div class="nt-f"><label for="nt-ends">يختفي من التطبيق بعد</label><select id="nt-ends">${[['3', '3 أيام'], ['7', 'أسبوع'], ['14', 'أسبوعين'], ['30', 'شهر'], ['', 'مايختفيش']].map(([v, l]) => `<option value="${v}" ${d.ends === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
                <button type="button" class="btn solid" id="nt-send">🚀 ابعتي دلوقتي</button>
                <button type="button" class="btn" id="nt-save">💾 احفظي مسودة</button>
                <button type="button" class="btn" id="nt-new">جديد</button>
            </div>
        </div>
        <div class="nt-pv" id="nt-pv">${previewHtml()}</div>
    </div>`;
}

function histHtml() {
    if (!hist) return '<div class="loading">جاري التحميل…</div>';
    if (!hist.length) return '<div class="empty">لسه مابعتيش إشعارات.</div>';
    return hist.map((a) => {
        const [c1, c2] = COLORS[a.color] || COLORS.violet;
        const tag = a.status === 'sent' ? '<span class="tag good">اتبعت</span>' : a.status === 'stopped' ? '<span class="tag mute">اتوقف</span>' : '<span class="tag info">مسودة</span>';
        const pr = a.push_result || null;
        const seenPct = a.reached ? Math.round((a.seen / a.reached) * 100) : 0;
        return `<div class="it" data-aid="${a.id}"><span class="em" style="background:linear-gradient(135deg,${c1},${c2})">${esc(a.emoji || '📣')}</span>
            <div class="t"><b>${esc(a.title)}</b><small>${tag} ${a.sent_at ? `اتبعت ${esc(ago(a.sent_at))}` : `اتعملت ${esc(ago(a.created_at))}`} · ${esc((SEGMENTS.find((s) => s[0] === (a.audience && a.audience.segment)) || [, 'كل المدرسين'])[1])}</small>
            ${a.status !== 'draft' ? `<div class="nt-stats"><span class="pill">👥 وصل لـ ${nf(a.reached)}</span><span class="pill">👀 شافوه ${nf(a.seen)} (${seenPct}%)</span><span class="pill">👆 ضغطوا ${nf(a.clicked)}</span>
                ${a.send_push ? `<span class="pill">📱 ${pr ? (pr.failed_batches ? `<span style="color:var(--bad)">فيه مشكلة: ${esc((pr.errors || [])[0] || '')}</span>` : `اتبعت${pr.not_subscribed ? ` · ${nf(pr.not_subscribed)} مش مشتركين` : ''}`) : '…'}</span>` : ''}</div>` : ''}</div>
            <div class="ac">${a.status === 'draft' ? '<button type="button" class="btn sm" data-ha="edit">✎ كمّلي</button>' : '<button type="button" class="btn sm" data-ha="copy">📄 نسخة</button>'}
                ${a.status === 'sent' ? '<button type="button" class="btn sm" data-ha="stop">⏹ وقّفيه</button>' : ''}<button type="button" class="btn sm" data-ha="del">🗑</button></div></div>`;
    }).join('');
}

async function journeyHtml() {
    try {
        const j = await api('journey_stats');
        const f = j.funnel || {};
        const steps = [['signed_up', 'سجّلوا'], ['opened', 'فتحوا التطبيق (بعد التحديث)'], ['students', 'ضافوا طالب'], ['schedules', 'حددوا مواعيد'], ['lessons', 'سجّلوا حصة'], ['returned_2', 'رجعوا تاني (زيارتين+)'], ['returned_5', 'بيستخدموه بانتظام (5 زيارات+)'], ['books', 'رفعوا كتاب'], ['games', 'عملوا لعبة']];
        const max = Math.max(1, Number(f.signed_up) || 1);
        const nudges = j.nudges || {};
        return `<div class="card"><div class="section-title" style="margin-top:0">🧭 رحلة المدرسين</div>
            <div class="jr-bars">${steps.map(([k, l]) => `<div class="r"><span>${l}</span><div class="b"><i style="width:${Math.round(((Number(f[k]) || 0) / max) * 100)}%"></i></div><b>${nf(f[k])}</b></div>`).join('')}</div>
            <div class="section-title">🤖 الرسايل التلقائية (بتظهر لوحدها حسب اللي المدرس عمله)</div>
            <div class="table-wrap"><table><thead><tr><th>الرسالة</th><th>ظهرت لـ</th><th>ضغطوا</th><th>قالوا "عندي بالفعل"</th></tr></thead><tbody>
            ${Object.entries(NUDGE_NAMES).map(([k, n]) => { const s = nudges[k] || {}; return `<tr><td>${n}</td><td>${nf(s.shown || 0)}</td><td>${nf(s.done || 0)}</td><td>${nf(s.never || 0)}</td></tr>`; }).join('')}
            </tbody></table></div>
            <p class="note">رسالة "انضم لمجموعة المدرسين" بتظهر تاني زيارة بعد أول حصة يسجّلها المدرس. كل رسالة بتظهر 3 مرات بالكتير، ولو داس "بعدين" بتستنى 3 أيام. لينك المجموعة في <code>js/config.js</code> (COMMUNITY_URL) في ريبو التطبيق.</p></div>`;
    } catch (e) { return e.message === 'AUTH' ? '' : `<div class="card">${errBox(e.message)}</div>`; }
}

function readForm() {
    draft.title = $('#nt-title').value;
    draft.body = $('#nt-body').value;
    draft.button_label = $('#nt-btnlabel').value;
    draft.button_url = $('#nt-btnurl').value.trim();
    draft.image_url = $('#nt-img') ? $('#nt-img').value.trim() : '';
    draft.show_in_app = $('#nt-app').checked; draft.add_to_bell = $('#nt-bell').checked; draft.send_push = $('#nt-push').checked;
    draft.include_future = $('#nt-future').checked;
    draft.ends = $('#nt-ends').value;
    $$('#nt-media [data-mi]').forEach((r) => { const m = draft.media[Number(r.dataset.mi)]; if (m) { m.url = r.querySelector('[data-mf="url"]').value.trim(); m.label = r.querySelector('[data-mf="label"]').value.trim(); } });
}
const refreshPreview = () => { readForm(); $('#nt-pv').innerHTML = previewHtml(); };
function payload() {
    readForm();
    const ends = draft.ends ? new Date(Date.now() + Number(draft.ends) * 864e5).toISOString() : '';
    return { id: draft.id || undefined, title: draft.title.trim(), body: draft.body, emoji: draft.emoji, color: draft.color, media: draft.media.filter((m) => m.url),
        button_label: draft.button_url ? (draft.button_label || 'افتح') : '', button_url: draft.button_url, image_url: draft.image_url, audience: draft.audience,
        include_future: draft.include_future, show_in_app: draft.show_in_app, add_to_bell: draft.add_to_bell, send_push: draft.send_push, ends_at: ends };
}

async function updateCount() {
    clearTimeout(countTimer);
    countTimer = setTimeout(async () => {
        const el = $('#nt-count'); if (!el) return;
        if (draft.audience.segment === 'teachers' && !draft.audience.teacher_ids.length) { el.textContent = 'اختاري المدرسين من القايمة'; return; }
        el.textContent = 'بنحسب…';
        try { const r = await api('ann_count', { audience: draft.audience }); el.innerHTML = `هيوصل لـ <b>${nf(r.count)}</b> مدرس`; draft._count = r.count; }
        catch (e) { el.textContent = e.message === 'AUTH' ? '' : e.message; }
    }, 300);
}

async function renderTeacherPicker() {
    const box = $('#nt-tpl'); if (!box) return;
    if (!teachers) {
        box.innerHTML = '<div class="loading" style="padding:8px">…</div>';
        try { teachers = (await call('teachers')).teachers || []; } catch (e) { box.innerHTML = errBox(e.message); return; }
    }
    const q = String(($('#nt-tpq') || {}).value || '').trim().toLowerCase();
    const sel = new Set(draft.audience.teacher_ids);
    const list = teachers.filter((t) => !q || `${t.name || ''} ${t.phone || ''} ${t.email || ''}`.toLowerCase().includes(q)).slice(0, 200);
    box.innerHTML = list.map((t) => `<label><input type="checkbox" value="${esc(t.id || t.teacher_id)}" ${sel.has(t.id || t.teacher_id) ? 'checked' : ''}> ${esc(t.name || 'مدرس')} <small style="color:var(--ink3)">${esc(t.phone || t.email || '')}</small></label>`).join('') || '<div class="empty" style="padding:8px">مفيش</div>';
}

async function upload(file, folder) {
    const sb = D.sb;
    if (!sb) throw new Error('الرفع مش متاح');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from('app-media').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw new Error(/row-level|policy|security/i.test(error.message) ? 'الحساب ده مش متسجل أدمن في التخزين. اتأكدي إن DB_v33.sql اتشغّل.' : error.message);
    return sb.storage.from('app-media').getPublicUrl(path).data.publicUrl;
}

function bindComposer() {
    const P = $('#p-notify');
    P.querySelectorAll('[data-sw]').forEach((g) => g.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        draft[g.dataset.sw] = b.dataset.v; refreshPreview();
    }));
    ['#nt-title', '#nt-body', '#nt-btnlabel', '#nt-btnurl', '#nt-img'].forEach((s) => { const el = $(s); if (el) el.addEventListener('input', refreshPreview); });
    $('#nt-media').addEventListener('input', refreshPreview);
    $('#nt-media').addEventListener('click', (e) => { const d = e.target.closest('[data-mdel]'); if (!d) return; readForm(); draft.media.splice(Number(d.closest('[data-mi]').dataset.mi), 1); renderNotify(); });
    let pendingType = null;
    P.querySelectorAll('[data-madd]').forEach((b) => b.addEventListener('click', () => {
        readForm();
        const type = b.dataset.madd;
        if (draft.media.length >= 12) { toast('12 وسيط بالكتير'); return; }
        if (type === 'image' || type === 'file' || type === 'video') {
            pendingType = type;
            const f = $('#nt-file'); f.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/mp4,video/webm' : '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*';
            if (confirm(`ترفعي ${MEDIA[type][1]} من جهازك؟\n(لو عندك لينك جاهز دوسي "إلغاء" والصقيه)`)) { f.value = ''; f.click(); return; }
        }
        draft.media.push({ type, url: type === 'whatsapp' ? (CFG.COMMUNITY_URL || '') : '', label: type === 'whatsapp' ? 'مجموعة المدرسين' : '' });
        renderNotify();
    }));
    $('#nt-file').addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f || !pendingType) return;
        if (f.size > 25 * 1048576) { toast('الملف أكبر من 25 ميجا'); return; }
        toast('جاري الرفع…');
        try { const url = await upload(f, 'ann'); readForm(); draft.media.push({ type: pendingType, url, label: pendingType === 'file' ? f.name.slice(0, 60) : '' }); renderNotify(); toast('اترفع ✓'); }
        catch (er) { toast(er.message); }
    });
    $('#nt-btn').addEventListener('change', (e) => {
        readForm();
        const v = e.target.value;
        draft.button_url = v === 'custom' ? '' : v;
        if (v && v !== 'custom' && !draft.button_label) draft.button_label = { 'games.html': 'جرّب الألعاب', 'books.html': 'افتح المكتبة', 'books.html?tab=public': 'شوف المكتبة العامة', 'subscription.html': 'اشترك دلوقتي', 'settings.html': 'افتح الإعدادات' }[v] || 'افتح';
        renderNotify();
        if (v === 'custom') { $('#nt-btnrow').hidden = false; $('#nt-btnurl').readOnly = false; $('#nt-btnurl').focus(); }
    });
    $('#nt-seg').addEventListener('change', (e) => { draft.audience.segment = e.target.value; $('#nt-tp').hidden = e.target.value !== 'teachers'; if (e.target.value === 'teachers') renderTeacherPicker(); updateCount(); });
    if ($('#nt-tpq')) $('#nt-tpq').addEventListener('input', renderTeacherPicker);
    if ($('#nt-tpl')) $('#nt-tpl').addEventListener('change', (e) => {
        const c = e.target.closest('input[type=checkbox]'); if (!c) return;
        const s = new Set(draft.audience.teacher_ids); if (c.checked) s.add(c.value); else s.delete(c.value);
        draft.audience.teacher_ids = [...s]; updateCount();
    });
    $('#nt-push').addEventListener('change', () => { $('#nt-imgf').hidden = !$('#nt-push').checked; refreshPreview(); });
    ['#nt-app', '#nt-bell', '#nt-future'].forEach((s) => $(s).addEventListener('change', refreshPreview));
    $('#nt-imgup').addEventListener('click', () => {
        const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
        f.onchange = async () => { const file = f.files[0]; if (!file) return; toast('جاري الرفع…'); try { $('#nt-img').value = await upload(file, 'push'); refreshPreview(); toast('اترفعت ✓'); } catch (er) { toast(er.message); } };
        f.click();
    });
    $('#nt-new').addEventListener('click', () => { draft = blank(); renderNotify(); });
    $('#nt-save').addEventListener('click', async (e) => {
        const p = payload(); if (!p.title) { toast('اكتبي العنوان'); $('#nt-title').focus(); return; }
        e.currentTarget.disabled = true;
        try { const r = await api('ann_save', p); draft.id = r.id; toast('اتحفظت المسودة ✓'); hist = null; loadHist(); }
        catch (er) { if (er.message !== 'AUTH') toast(er.message); } finally { e.currentTarget.disabled = false; }
    });
    $('#nt-send').addEventListener('click', async (e) => {
        const p = payload(); if (!p.title) { toast('اكتبي العنوان'); $('#nt-title').focus(); return; }
        if (!p.show_in_app && !p.add_to_bell && !p.send_push) { toast('اختاري مكان واحد على الأقل يظهر فيه'); return; }
        if (p.audience.segment === 'teachers' && !p.audience.teacher_ids.length) { toast('اختاري المدرسين'); return; }
        const n = draft._count != null ? nf(draft._count) : 'كل';
        if (!confirm(`هتبعتي "${p.title}" لـ ${n} مدرس.\n${p.send_push ? '📱 هيوصلهم إشعار على الموبايل كمان.\n' : ''}مايتلغيش بعد الإرسال (ممكن توقّفيه من التطبيق بس). نبعت؟`)) return;
        const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'جاري الإرسال…';
        try {
            const r = await api('ann_send', p);
            const pr = r.push_result;
            toast(`اتبعت لـ ${nf(r.target_count)} مدرس ✓${pr ? (pr.failed_batches ? ' — بس إشعار الموبايل فيه مشكلة' : '') : ''}`);
            draft = blank(); hist = null; renderNotify();
        } catch (er) { if (er.message !== 'AUTH') toast(er.message); btn.disabled = false; btn.textContent = '🚀 ابعتي دلوقتي'; }
    });
}

async function loadHist() {
    const box = $('#nt-hist'); if (!box) return;
    if (!hist) { try { hist = (await api('ann_list')).items || []; } catch (e) { if (e.message !== 'AUTH') box.innerHTML = errBox(e.message); return; } }
    box.innerHTML = histHtml();
}

function renderNotify() {
    const P = $('#p-notify');
    P.innerHTML = `${composerHtml()}
        <div class="card nt-hist" style="margin-top:14px"><div class="section-title" style="margin-top:0">🕘 اللي اتبعت قبل كده</div><div id="nt-hist">${histHtml()}</div></div>
        <div id="nt-journey" style="margin-top:14px"></div>`;
    bindComposer();
    updateCount();
    if (draft.audience.segment === 'teachers') renderTeacherPicker();
    loadHist();
    journeyHtml().then((h) => { const j = $('#nt-journey'); if (j) j.innerHTML = h; });
    $('#nt-hist').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-ha]'); if (!b) return;
        const a = (hist || []).find((x) => x.id === b.closest('[data-aid]').dataset.aid); if (!a) return;
        const act = b.dataset.ha;
        if (act === 'edit' || act === 'copy') {
            draft = { ...blank(), ...a, id: act === 'edit' ? a.id : null, media: (a.media || []).map((m) => ({ ...m })), audience: { segment: 'all', teacher_ids: [], ...(a.audience || {}) }, emoji: a.emoji || '', ends: '7' };
            renderNotify(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
        }
        if (act === 'stop' && !confirm('توقّفي الإشعار؟ هيختفي من التطبيق (اللي وصل على الموبايل بيفضل).')) return;
        if (act === 'del' && !confirm('تمسحي الإشعار ده نهائي؟')) return;
        try { await api(act === 'stop' ? 'ann_stop' : 'ann_delete', { id: a.id }); hist = null; loadHist(); toast('تم ✓'); } catch (er) { if (er.message !== 'AUTH') toast(er.message); }
    });
}

// ============================================================ 📚 مراجعة الكتب العامة
let books = null;
let bFilter = 'pending';
function renderBooks() {
    const P = $('#p-books');
    const counts = { pending: 0, approved: 0, rejected: 0 };
    (books || []).forEach((b) => { counts[b.status] = (counts[b.status] || 0) + 1; });
    const list = (books || []).filter((b) => b.status === bFilter);
    const cnt = $('#cnt-books'); if (cnt) { cnt.hidden = !counts.pending; cnt.textContent = counts.pending; }
    P.innerHTML = `<div class="card">
        <div class="filters" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${[['pending', '⏳ مستنية مراجعة'], ['approved', '✅ منشورة'], ['rejected', '❌ اترفضت']].map(([k, l]) => `<button type="button" class="btn sm ${bFilter === k ? 'solid' : ''}" data-bf="${k}">${l} (${counts[k] || 0})</button>`).join('')}</div>
        <p class="note" style="margin:0 0 6px">افتحي الملف واتأكدي إنه مناسب ومفيهوش حقوق نشر. لما توافقي بيظهر لكل المدرسين في "المكتبة العامة"، والمدرس اللي رفعه بيوصله إشعار بالقرار.</p>
        ${books == null ? '<div class="loading">جاري التحميل…</div>' : !list.length ? `<div class="empty">${bFilter === 'pending' ? 'مفيش كتب مستنية مراجعة 👌' : 'مفيش'}</div>` : list.map((b) => `
            <div class="bk-it" data-bid="${b.id}">
                <div>
                    <b>${esc(b.title)}</b>
                    <div class="meta">${esc(b.teacher_name || 'مدرس')} ${b.teacher_phone ? `· <a href="https://wa.me/${esc(String(b.teacher_phone).replace(/\D/g, '').replace(/^0/, '20'))}" target="_blank" rel="noopener">${esc(b.teacher_phone)}</a>` : ''} · ${esc(String(b.file_type || '').toUpperCase())}${b.page_count ? ` · ${nf(b.page_count)} صفحة` : ''} · ${esc(ago(b.created_at))}${b.downloads ? ` · ⬇ ${nf(b.downloads)}` : ''}${b.show_name ? '' : ' · (من غير اسم المدرس)'}</div>
                    <input type="text" data-bf-title value="${esc(b.title)}" maxlength="200" aria-label="الاسم">
                    <select data-bf-cat aria-label="التصنيف">${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${b.category === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
                    <textarea data-bf-desc rows="2" maxlength="600" placeholder="وصف (اختياري)">${esc(b.description || '')}</textarea>
                    ${b.review_note ? `<div class="meta">ملاحظتك: ${esc(b.review_note)}</div>` : ''}
                </div>
                <div class="ac">
                    <button type="button" class="btn" data-ba="open">👁 افتحي الملف</button>
                    ${b.status !== 'approved' ? '<button type="button" class="btn solid" data-ba="approve">✅ وافقي وانشري</button>' : '<button type="button" class="btn" data-ba="save">💾 احفظي التعديل</button>'}
                    ${b.status === 'pending' ? '<button type="button" class="btn" data-ba="reject">❌ ارفضي</button>' : ''}
                    ${b.status === 'approved' ? '<button type="button" class="btn" data-ba="remove">🗑 شيليه من العامة</button>' : ''}
                </div>
            </div>`).join('')}</div>`;
    P.querySelectorAll('[data-bf]').forEach((b) => b.addEventListener('click', () => { bFilter = b.dataset.bf; renderBooks(); }));
    P.querySelectorAll('[data-ba]').forEach((btn) => btn.addEventListener('click', async () => {
        const row = btn.closest('[data-bid]');
        const b = books.find((x) => x.id === row.dataset.bid); if (!b) return;
        const act = btn.dataset.ba;
        if (act === 'open') {
            try {
                const { data, error } = await D.sb.storage.from('teacher-books').createSignedUrl(b.storage_path, 900);
                if (error) throw error;
                window.open(data.signedUrl, '_blank', 'noopener');
            } catch (e) { toast('مقدرناش نفتح الملف: ' + (e.message || '') + ' (اتأكدي إن DB_v33.sql اتشغّل)'); }
            return;
        }
        let note = '';
        if (act === 'reject') { note = prompt('سبب الرفض (هيوصل للمدرس):', 'الكتاب عليه حقوق نشر') ; if (note === null) return; }
        if (act === 'remove' && !confirm('تشيلي الكتاب من المكتبة العامة؟ المدرسين اللي ضافوه هيفضل عندهم.')) return;
        btn.disabled = true;
        try {
            await api('book_decide', { id: b.id, decision: act === 'save' ? 'approve' : act, note,
                title: row.querySelector('[data-bf-title]').value, category: row.querySelector('[data-bf-cat]').value, description: row.querySelector('[data-bf-desc]').value });
            toast(act === 'approve' ? 'اتنشر ✓ والمدرس وصله إشعار' : 'تم ✓');
            books = null; loadBooks();
        } catch (e) { btn.disabled = false; if (e.message !== 'AUTH') toast(e.message); }
    }));
}
async function loadBooks() {
    renderBooks();
    try { books = (await api('books_review')).items || []; } catch (e) { if (e.message !== 'AUTH') $('#p-books').innerHTML = errBox(e.message); return; }
    renderBooks();
}

const NUDGE_STATE = { done: 'ضغط ✓', never: 'قال عنده بالفعل' };
async function journeyCard(id) {
    try {
        const j = await api('teacher_journey', { teacher_id: id });
        const jr = j.journey || {};
        const shown = jr.shown || {};
        const dt = (t) => (t ? new Date(t).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) : '—');
        const step = (ok, label, when) => `<div style="display:flex;gap:8px;align-items:center;padding:3px 0"><span>${ok ? '✅' : '⬜'}</span><span style="flex:1">${label}</span><small style="color:var(--ink2)">${ok ? esc(when || '') : ''}</small></div>`;
        return `<div class="card"><h3>🧭 رحلته في البرنامج</h3>
            ${step(true, 'سجّل', dt(j.signup_at))}
            ${step(Number(j.students) > 0, `ضاف طلاب (${nf(j.students)})`, dt(j.first_student))}
            ${step(Number(j.schedules) > 0, `حدد مواعيد (${nf(j.schedules)})`, '')}
            ${step(Number(j.lessons) > 0, `سجّل حصص (${nf(j.lessons)})`, `أول حصة ${dt(j.first_lesson)}`)}
            ${step(Number(j.books) > 0, `رفع كتب (${nf(j.books)})`, '')}
            ${step(Number(j.games) > 0, `عمل ألعاب (${nf(j.games)})`, '')}
            <p class="sub" style="margin:8px 0 4px">${jr.visits ? `فتح البرنامج ${nf(jr.visits)} مرة · آخر مرة ${esc(ago(jr.last_visit_at))}` : 'لسه مافتحش البرنامج بعد التحديث'} · شاف ${nf(j.announcements)} من إشعاراتك</p>
            ${Object.keys(shown).length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${Object.entries(shown).map(([k, v]) => `<span class="pill">${esc(NUDGE_NAMES[k] || k)} · ${nf(v.n || 0)} مرة${v.done ? ` · ${NUDGE_STATE[v.done] || ''}` : ''}</span>`).join('')}</div>` : ''}</div>`;
    } catch (e) { return ''; }
}

window.TMAdmin = {
    journeyCard,
    showNotify() { renderNotify(); },
    showBooks() { loadBooks(); },
    reset() { hist = null; books = null; teachers = null; },
    // رقم الكتب المستنية على التبويب (بيتنادى بعد الدخول)
    async badge() { try { const r = await api('books_review', { status: 'pending' }); const c = $('#cnt-books'); if (c) { const n = (r.items || []).length; c.hidden = !n; c.textContent = n; } } catch (e) { /* تجاهل */ } }
};
})();
