/**
 * billing.js — تبويب "الاشتراكات" في لوحة المتابعة
 * - تفعيل اشتراك لأي مدرس (بحث بالاسم أو الإيميل أو الموبايل) واختيار الخطة والمدة
 * - المشتركين والإيرادات والتجديدات وسجل المدفوعات
 * بيكلّم workflow "owner-billing" ← دالة owner_billing_api (DB_billing.sql)
 */
(() => {
'use strict';
const D = window.TMD;
if (!D) { console.error('billing.js لازم يتحمّل بعد index.html'); return; }
const { $, $$, esc, nf, call, toast, lineChart, hbars, src, waLink } = D;
const CFG = window.TM_DASH_CONFIG || {};
const PLANS = CFG.PLANS || {
    starter: { name: 'البداية', students: 10, monthly: 99, semiannual: 594, annual: 1188 },
    pro: { name: 'الاحترافية', students: null, monthly: 150, semiannual: 900, annual: 1800 }
};
const METHODS = CFG.PAY_METHODS || ['فودافون كاش', 'إنستاباي', 'تحويل بنكي', 'كاش', 'تاني'];
const PERIODS = { monthly: ['شهر', 1], semiannual: ['6 شهور', 6], annual: ['سنة', 12], custom: ['مدة تانية', 0] };
const KINDS = { payment: 'دفعة', gift: 'هدية', adjust: 'تعديل يدوي' };
const STATES = { paid: ['مشترك', 'good'], trial: ['فترة مجانية', 'info'], expired: ['منتهي', 'bad'], none: ['من غير اشتراك', 'mute'] };
const planName = (p) => (PLANS[p] && PLANS[p].name) || (p ? p : '—');
const money = (v) => `${nf(Math.round(Number(v) * 100) / 100)} ج`;

// ============================================================ تواريخ (بتوقيت مصر)
const TZ = 'Africa/Cairo';
const ymd = (t) => { if (!t) return ''; try { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)); } catch (e) { return ''; } };
const today = () => ymd(new Date());
const dLong = (t) => t ? new Date(t).toLocaleDateString('ar-EG', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }) : '—';
const dShort = (t) => t ? new Date(t).toLocaleDateString('ar-EG', { timeZone: TZ, day: 'numeric', month: 'short', year: '2-digit' }) : '—';
const ymdLong = (s) => s ? new Date(s + 'T12:00:00Z').toLocaleDateString('ar-EG', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }) : '—';
const daysTo = (t) => t ? Math.ceil((new Date(t).getTime() - Date.now()) / 864e5) : null;
/** نفس حساب Postgres: 31 يناير + شهر = 28 فبراير */
function addPeriod(ymdStr, months, days) {
    const [y, m, d] = ymdStr.split('-').map(Number);
    const tm = m - 1 + months; const ny = y + Math.floor(tm / 12); const nm = ((tm % 12) + 12) % 12;
    const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    const dt = new Date(Date.UTC(ny, nm, Math.min(d, last)));
    dt.setUTCDate(dt.getUTCDate() + (days || 0));
    return dt.toISOString().slice(0, 10);
}
function untilLabel(t) {
    if (t.state === 'paid') { const n = daysTo(t.paid_until); return t.paid_until ? `لحد ${dLong(t.paid_until)} (${n <= 0 ? 'النهارده' : `فاضل ${nf(n)} يوم`})` : 'من غير تاريخ نهاية'; }
    if (t.state === 'trial') return t.trial_ends_at ? `الفترة المجانية لحد ${dLong(t.trial_ends_at)}` : 'فترة مجانية';
    if (t.state === 'expired') { const e = t.status === 'trial' ? t.trial_ends_at : t.paid_until; return e ? `خلص ${dLong(e)}` : 'منتهي'; }
    return 'لسه ماعندوش اشتراك';
}
const stateTag = (t) => { const s = STATES[t.state] || [t.state, 'mute']; return `<span class="tag ${s[1]}">${esc(s[0])}${t.state === 'paid' && t.plan ? ' · ' + esc(planName(t.plan)) : ''}</span>`; };

// ============================================================ البحث (عربي/إنجليزي/أرقام)
const AR_DIGITS = (s) => String(s || '').replace(/[٠-٩]/g, (c) => c.charCodeAt(0) - 1632).replace(/[۰-۹]/g, (c) => c.charCodeAt(0) - 1776);
const norm = (s) => AR_DIGITS(s).toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
const digits = (s) => AR_DIGITS(s).replace(/\D/g, '');
function matches(t, q) {
    const nq = norm(q); if (!nq) return true;
    const dq = digits(q);
    if (dq.length >= 4) {
        const dp = digits(t.phone);
        if (dp && (dp.includes(dq) || dp.slice(-9).includes(dq.slice(-9)))) return true;
    }
    return nq.split(' ').every((w) => norm(t.name).includes(w) || norm(t.email).includes(w) || digits(t.phone).includes(digits(w) || '#'));
}

// ============================================================ الحالة
const B = {
    ov: null, teachers: null, payments: null, loading: null, err: null,
    sel: null, f: null, lastResult: null, tool: null,
    tFilter: 'all', tSearch: '', pFilter: 'all', pSearch: ''
};
const api = (section, extra) => call(section, extra || {}, CFG.BILLING_ENDPOINT);
const byId = (id) => (B.teachers || []).find((t) => String(t.id) === String(id));

async function loadAll(force) {
    if (B.loading && !force) return B.loading;
    B.err = null;
    B.loading = Promise.all([api('billing_overview'), api('billing_teachers'), api('billing_payments')])
        .then(([ov, t, p]) => { B.ov = ov; B.teachers = t.teachers || []; B.payments = p.payments || []; updateBadge(); })
        .catch((e) => { B.err = e; throw e; })
        .finally(() => { B.loading = null; });
    return B.loading;
}
function updateBadge() {
    const el = $('#cnt-bill'); if (!el || !B.ov) return;
    const c = B.ov.counts || {}; const n = (Number(c.expiring_7d) || 0) + (Number(c.expired_30d) || 0);
    el.hidden = !n; el.textContent = nf(n);
}
const panel = () => $('#p-billing');
const isOpen = () => panel() && panel().classList.contains('active');

// ============================================================ الرسم الرئيسي
function render() {
    const root = panel(); if (!root) return;
    if (!B.ov) { root.innerHTML = '<div class="loading">جاري التحميل…</div>'; return; }
    const c = B.ov.counts || {}; const r = B.ov.revenue || {};
    const diff = Number(r.this_month) - Number(r.last_month);
    const trialEnd = B.ov.trial_ends_at;
    const tiles = [
        { l: 'مشتركين دلوقتي', v: nf(c.paid), h: `الاحترافية ${nf(c.paid_pro)} · البداية ${nf(c.paid_starter)}`, go: 'paid' },
        { l: 'إيراد الشهر ده', v: money(r.this_month), h: `${nf(r.payments_this_month)} دفعة · ${diff >= 0 ? '▲' : '▼'} ${money(Math.abs(diff))} عن الشهر اللي فات` },
        { l: 'إجمالي الإيرادات', v: money(r.total), h: `السنة دي ${money(r.this_year)}` },
        { l: 'الإيراد الشهري المتكرر', v: money(r.mrr), h: 'الاشتراكات الشغالة مقسومة على شهورها' },
        { l: 'بيخلصوا خلال 7 أيام', v: nf(c.expiring_7d), h: `و${nf(c.expired_30d)} خلصوا آخر 30 يوم`, cls: (Number(c.expiring_7d) || Number(c.expired_30d)) ? 'alert' : '', go: 'renew' },
        { l: 'في الفترة المجانية', v: nf(c.trial), h: trialEnd ? `لحد ${dLong(trialEnd)}` : '', go: 'trial' },
        { l: 'منتهي', v: nf(c.expired), h: `دفعوا قبل كده: ${nf(c.ever_paid)} · جدّدوا: ${nf(c.renewed)}`, go: 'expired' }
    ];
    const months = (B.ov.by_month || []).map((m) => ({
        l: new Date(m.month + 'T12:00:00Z').toLocaleDateString('ar-EG', { month: 'short', timeZone: 'UTC' }),
        full: `${new Date(m.month + 'T12:00:00Z').toLocaleDateString('ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' })} · ${nf(m.payments)} دفعة · ${nf(m.new_teachers)} مشترك جديد`,
        v: Number(m.amount) || 0
    }));
    const daysLeftTrial = trialEnd ? daysTo(trialEnd) : null;
    root.innerHTML = `
        <div class="grid g-kpi">${tiles.map((t) => `<div class="card kpi ${t.cls || ''}" ${t.go ? `data-bgo="${t.go}"` : ''}>
            <div class="lbl">${t.l}</div><div class="num">${t.v}</div><div class="hint">${esc(t.h)}</div></div>`).join('')}</div>
        ${daysLeftTrial !== null && daysLeftTrial > 0 && Number(c.trial) ? `<div class="note" style="margin-top:14px">🎁 الفترة المجانية بتخلص <b>${dLong(trialEnd)}</b> (فاضل ${nf(daysLeftTrial)} يوم)، و<b>${nf(c.trial)}</b> مدرس لسه فيها.
            أي اشتراك تسجّليه لمدرس في الفترة المجانية <b>بيبدأ تلقائي بعد ما تخلص</b>، فمحدش بيخسر أيامه المجانية.${Number(c.upcoming) ? ` (${nf(c.upcoming)} مدرس حجزوا فعلًا)` : ''}</div>` : ''}

        <div class="grid bl-top" style="margin-top:14px">
            <div class="card" id="bl-act"></div>
            <div class="card" id="bl-renew"></div>
        </div>

        <div class="grid g-2" style="margin-top:14px">
            <div class="card"><h3>الإيرادات كل شهر</h3><p class="sub">آخر 12 شهر، حسب تاريخ الدفع</p>
                ${lineChart(months, { label: 'جنيه', bars: true, color: 'var(--chart-2)' })}
                ${src('<code>subscription_payments</code>: الدفعات بس (من غير الهدايا والتعديلات والملغي)')}</div>
            <div class="card"><h3>الفلوس جاية منين</h3>
                <p class="sub" style="margin-bottom:4px">حسب الخطة</p>${hbars((B.ov.by_plan || []).map((x) => ({ n: esc(planName(x.plan)), v: Number(x.amount) || 0, extra: `· ${nf(x.payments)} دفعة` })), { fmt: money })}
                <p class="sub" style="margin:12px 0 4px">حسب المدة</p>${hbars((B.ov.by_period || []).map((x) => ({ n: esc((PERIODS[x.period] || [x.period])[0]), v: Number(x.amount) || 0, extra: `· ${nf(x.payments)}` })), { fmt: money })}
                <p class="sub" style="margin:12px 0 4px">حسب طريقة الدفع</p>${hbars((B.ov.by_method || []).map((x) => ({ n: esc(x.method), v: Number(x.amount) || 0, extra: `· ${nf(x.payments)}` })), { fmt: money })}
                <div class="pill" style="margin-top:10px">متوسط الدفعة ${money(r.avg_payment)}</div></div>
        </div>

        <div class="section-title" id="bl-teachers-title"><h2>كل المدرسين واشتراكاتهم</h2><p>اضغطي على أي مدرس عشان تفعّلي له أو تعدّلي اشتراكه</p></div>
        <div class="filters" id="bl-tf"></div>
        <div id="bl-tl"></div>

        <div class="section-title"><h2>سجل المدفوعات</h2><p>كل دفعة وهدية وتعديل. "تراجع" بيرجّع الاشتراك زي ما كان بالظبط</p></div>
        <div class="filters" id="bl-pf"></div>
        <div id="bl-pl"></div>`;
    $$('[data-bgo]', root).forEach((el) => el.addEventListener('click', () => {
        const g = el.dataset.bgo;
        if (g === 'renew') { $('#bl-renew').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        B.tFilter = g; renderTeachers(); $('#bl-teachers-title').scrollIntoView({ behavior: 'smooth' });
    }));
    renderActivate(); renderRenewals(); renderTeachers(); renderPayments();
}

// ============================================================ تفعيل اشتراك
function freshForm(t, plan) {
    const p = plan || (t && t.plan) || 'pro';
    return { kind: 'payment', plan: p, period: 'monthly', months: 2, extra_days: 0, amount: String(PLANS[p] ? PLANS[p].monthly : ''), amountDirty: false,
        method: METHODS[0], starts_at: '', startsDirty: false, paid_at: today(), note: '', busy: false, err: '' };
}
function priceFor(f) {
    const pl = PLANS[f.plan]; if (!pl) return '';
    if (f.period === 'custom') return String(Math.round((pl.monthly || 0) * (Number(f.months) || 0) + ((pl.monthly || 0) / 30) * (Number(f.extra_days) || 0)));
    return String(pl[f.period] != null ? pl[f.period] : (pl.monthly || 0) * PERIODS[f.period][1]);
}
function select(id, opts = {}) {
    const t = byId(id); if (!t) return;
    B.sel = t.id; B.f = freshForm(t, opts.plan); B.lastResult = null; B.tool = null;
    if (opts.period) { B.f.period = opts.period; B.f.amount = priceFor(B.f); }
    renderActivate();
    if (opts.scroll !== false) $('#bl-act').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderActivate() {
    const box = $('#bl-act'); if (!box) return;
    const t = B.sel ? byId(B.sel) : null;
    if (!t) {
        box.innerHTML = `<h3>✅ فعّلي اشتراك</h3><p class="sub">اكتبي اسم المدرس أو إيميله أو رقم موبايله، واختاريه من القايمة</p>
            <div class="bl-search"><input class="search bl-q" id="bl-q" type="search" autocomplete="off" placeholder="مثلًا: منى، أو mona@gmail.com، أو 0101…" aria-label="بحث عن مدرس">
            <div class="bl-res" id="bl-res" hidden></div></div>
            <p class="bl-tip">💡 أو اضغطي على أي مدرس في الجدول تحت، أو "جدّدي" من قايمة التجديدات.</p>`;
        const q = $('#bl-q'); const res = $('#bl-res');
        const show = () => {
            const v = q.value.trim();
            if (!v) { res.hidden = true; return; }
            const list = (B.teachers || []).filter((x) => matches(x, v)).slice(0, 8);
            res.hidden = false;
            res.innerHTML = !list.length ? '<div class="empty" style="padding:14px">مفيش مدرس بالبيانات دي</div>'
                : list.map((x) => `<button type="button" class="bl-ri" data-id="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>${esc([x.email, x.phone].filter(Boolean).join(' · '))}</small></span>${stateTag(x)}</button>`).join('');
            $$('.bl-ri', res).forEach((b) => b.addEventListener('click', () => select(b.dataset.id, { scroll: false })));
        };
        q.addEventListener('input', show);
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = $('.bl-ri', res); if (first) first.click(); } });
        return;
    }
    const f = B.f;
    const startYmd = f.startsDirty && f.starts_at ? f.starts_at : ymd(t.default_start || new Date());
    const months = f.period === 'custom' ? (Number(f.months) || 0) : PERIODS[f.period][1];
    const extra = Number(f.extra_days) || 0;
    const endYmd = startYmd ? addPeriod(startYmd, months, extra) : '';
    const tooMany = f.plan === 'starter' && PLANS.starter.students && Number(t.students) > PLANS.starter.students;
    const startsLater = !f.startsDirty && t.default_start && new Date(t.default_start).getTime() > Date.now() + 864e5;
    const hist = (B.payments || []).filter((p) => String(p.user_id) === String(t.id));
    const r = B.lastResult;
    const waOk = r && waLink(t.phone, `أهلًا يا ${String(t.name || '').split(' ')[0]} 🌷 تم تفعيل اشتراكك في Teachers Manager ✅\nالباقة: ${planName(r.plan)}\nلحد: ${dLong(r.paid_until)}\nشكرًا لثقتك 🙏`);
    box.innerHTML = `
        <div class="bl-head"><h3 style="margin:0">✅ فعّلي اشتراك</h3><button class="btn sm" data-clear type="button">✕ مدرس تاني</button></div>
        <div class="bl-who">
            <div><b style="font-size:16px">${esc(t.name)}</b> ${stateTag(t)}${t.deleting ? ' <span class="tag bad">طالب حذف حسابه</span>' : ''}
                <div class="bl-meta">${esc([t.email, t.phone].filter(Boolean).join(' · ') || '—')}</div>
                <div class="bl-meta">${esc(untilLabel(t))} · ${nf(t.students)} طالب · دفع ${money(t.total_paid)}${Number(t.payments) ? ` في ${nf(t.payments)} مرة` : ''}</div></div>
        </div>
        ${r ? `<div class="bl-ok">🎉 <b>اتفعّل!</b> ${esc(t.name)} مشترك في <b>${esc(planName(r.plan))}</b> لحد <b>${dLong(r.paid_until)}</b>.
            <div class="bl-row" style="margin-top:8px">${waOk ? `<a class="btn sm wa" href="${waOk}" target="_blank" rel="noopener">ابعتيله تأكيد على واتساب</a>` : ''}
            <button class="btn sm" data-undo-last type="button">↶ تراجع (اتسجلت غلط)</button>
            <button class="btn sm solid" data-clear type="button">مدرس تاني</button></div></div>` : ''}

        <div class="bl-form" ${r ? 'hidden' : ''}>
            <div class="bl-lbl">النوع</div>
            <div class="seg" data-seg="kind">${[['payment', '💵 دفع فلوس'], ['gift', '🎁 هدية من غير فلوس']].map(([k, l]) => `<button type="button" data-v="${k}" class="${f.kind === k ? 'on' : ''}">${l}</button>`).join('')}</div>

            <div class="bl-lbl">الخطة</div>
            <div class="bl-plans" data-seg="plan">${Object.entries(PLANS).map(([k, p]) => `<button type="button" data-v="${k}" class="bl-plan ${f.plan === k ? 'on' : ''}">
                <b>${esc(p.name)}</b><span>${nf(p.monthly)} ج / شهر</span><small>${p.students ? `لحد ${nf(p.students)} طلاب` : 'طلاب بلا حد'}</small></button>`).join('')}</div>
            ${tooMany ? `<div class="bl-warn">⚠️ ${esc(t.name)} عنده ${nf(t.students)} طالب، وخطة البداية لحد ${nf(PLANS.starter.students)} بس.</div>` : ''}

            <div class="bl-lbl">المدة</div>
            <div class="seg" data-seg="period">${Object.entries(PERIODS).map(([k, [l]]) => `<button type="button" data-v="${k}" class="${f.period === k ? 'on' : ''}">${l}</button>`).join('')}</div>
            ${f.period === 'custom' ? `<div class="bl-row" style="margin-top:8px"><label class="bl-inl">عدد الشهور <input class="inp" type="number" min="0" max="36" data-in="months" value="${esc(f.months)}" style="width:80px"></label>
                <label class="bl-inl">+ أيام <input class="inp" type="number" min="0" max="365" data-in="extra_days" value="${esc(f.extra_days)}" style="width:80px"></label></div>` : ''}

            ${f.kind === 'payment' ? `<div class="bl-row" style="margin-top:12px;align-items:flex-end">
                <label class="bl-field"><span>المبلغ اللي اتدفع (جنيه)</span><input class="inp" type="text" inputmode="decimal" data-in="amount" value="${esc(f.amount)}"></label>
                <label class="bl-field"><span>اتدفع إزاي</span><select class="inp" data-in="method">${METHODS.map((m) => `<option ${m === f.method ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label></div>
                ${f.amountDirty && f.amount !== priceFor(f) ? `<div class="bl-tip">السعر العادي للمدة دي ${money(priceFor(f))} <button class="linkbtn" data-reprice type="button">رجّعيه</button></div>` : ''}` : ''}

            <details class="bl-more" ${f.startsDirty || f.paid_at !== today() || f.note ? 'open' : ''}><summary>خيارات أكتر (تاريخ البداية · تاريخ الدفع · ملاحظة)</summary>
                <div class="bl-row" style="margin-top:8px">
                    <label class="bl-field"><span>يبدأ من</span><input class="inp" type="date" data-in="starts_at" value="${esc(startYmd)}"></label>
                    ${f.kind === 'payment' ? `<label class="bl-field"><span>اتدفع يوم</span><input class="inp" type="date" data-in="paid_at" max="${today()}" value="${esc(f.paid_at)}"></label>` : ''}
                </div>
                <label class="bl-field" style="margin-top:8px"><span>ملاحظة (ليكي بس)</span><input class="inp" type="text" maxlength="300" data-in="note" value="${esc(f.note)}" placeholder="مثلًا: رقم التحويل، أو خصم لأنها من أول المشتركين"></label>
                <div class="bl-tip">لو بتسجّلي دفعة قديمة، غيّري "اتدفع يوم" عشان تتحسب في شهرها الصح.</div>
            </details>

            <div class="bl-sum">هيتفعّل لـ <b>${esc(t.name)}</b>: الباقة <b>${esc(planName(f.plan))}</b> · ${esc(f.period === 'custom' ? `${nf(months)} شهر${extra ? ` و${nf(extra)} يوم` : ''}` : PERIODS[f.period][0])}<br>
                من <b>${ymdLong(startYmd)}</b> لحد <b>${ymdLong(endYmd)}</b>${f.kind === 'payment' ? ` · <b>${money(Number(AR_DIGITS(f.amount).replace(/[^\d.]/g, '')) || 0)}</b>` : ' · <b>هدية</b>'}
                ${startsLater ? '<br><small>📌 بيبدأ بعد آخر يوم في اشتراكه أو فترته المجانية، فمش هيخسر ولا يوم.</small>' : ''}</div>
            ${f.err ? `<div class="err" style="margin-top:10px">${esc(f.err)}</div>` : ''}
            <button class="btn solid bl-go" data-go type="button" ${f.busy ? 'disabled' : ''}>${f.busy ? 'جاري التفعيل…' : (f.kind === 'gift' ? '🎁 فعّلي الهدية' : '✓ فعّلي الاشتراك')}</button>
        </div>

        <details class="bl-more" style="margin-top:14px"><summary>تعديل يدوي (تغيير الخطة · تاريخ النهاية · إيقاف · الفترة المجانية)</summary>
            <div class="bl-row" style="margin-top:10px">${[['change_plan', 'غيّري الخطة بس'], ['set_end', 'غيّري تاريخ النهاية'], ['trial_until', 'مدّدي الفترة المجانية'], ['stop', 'أوقفي الاشتراك']].map(([k, l]) => `<button type="button" class="btn sm ${B.tool === k ? 'solid' : ''}" data-tool="${k}">${l}</button>`).join('')}</div>
            ${toolForm(t)}
        </details>

        ${hist.length ? `<div class="bl-lbl" style="margin-top:14px">اللي اتسجّل للمدرس ده</div>
            <div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الخطة</th><th>الفترة</th><th>المبلغ</th><th></th></tr></thead><tbody>
            ${hist.map((p) => `<tr class="${p.cancelled_at ? 'bl-x' : ''}"><td>${dShort(p.paid_at)}</td><td>${esc(KINDS[p.kind] || p.kind)}${p.cancelled_at ? ' <span class="tag mute">اتلغت</span>' : ''}</td><td>${esc(planName(p.plan))}</td>
                <td>${p.starts_at ? `${dShort(p.starts_at)} ← ` : ''}${dShort(p.ends_at)}</td><td class="num">${p.kind === 'payment' ? money(p.amount) : '—'}</td>
                <td>${p.can_undo && !p.cancelled_at ? `<button class="btn sm" data-undo="${esc(p.id)}" type="button">↶ تراجع</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}`;

    // الأحداث
    $$('[data-clear]', box).forEach((b) => b.addEventListener('click', () => { B.sel = null; B.f = null; B.lastResult = null; renderActivate(); setTimeout(() => { const q = $('#bl-q'); if (q) q.focus(); }, 30); }));
    $$('[data-seg] button', box).forEach((b) => b.addEventListener('click', () => {
        const k = b.closest('[data-seg]').dataset.seg; f[k] = b.dataset.v; f.err = '';
        if ((k === 'plan' || k === 'period') && !f.amountDirty) f.amount = priceFor(f);
        renderActivate();
    }));
    $$('[data-in]', box).forEach((inp) => {
        const k = inp.dataset.in;
        const ev = (inp.tagName === 'SELECT' || inp.type === 'date') ? 'change' : 'input';
        inp.addEventListener(ev, () => {
            f[k] = inp.value; f.err = '';
            if (k === 'amount') f.amountDirty = true;
            if (k === 'starts_at') f.startsDirty = true;
            if ((k === 'months' || k === 'extra_days') && !f.amountDirty) f.amount = priceFor(f);
            if (k === 'amount' || k === 'note' || k === 'method') { refreshSummary(); return; }   // من غير ما نعيد الرسم ونضيّع مكان الكتابة
            const pos = inp.selectionStart; renderActivate();
            const n = $(`[data-in="${k}"]`, $('#bl-act'));
            if (n) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch (e) { /* date */ } }
        });
    });
    const rp = $('[data-reprice]', box); if (rp) rp.addEventListener('click', () => { f.amount = priceFor(f); f.amountDirty = false; renderActivate(); });
    const go = $('[data-go]', box); if (go) go.addEventListener('click', activate);
    $$('[data-tool]', box).forEach((b) => b.addEventListener('click', () => { B.tool = B.tool === b.dataset.tool ? null : b.dataset.tool; renderActivate(); const d = $('#bl-act details.bl-more:last-of-type'); if (d) d.open = true; }));
    const ta = $('[data-tool-go]', box); if (ta) ta.addEventListener('click', () => adjust(t));
    const ul = $('[data-undo-last]', box); if (ul) ul.addEventListener('click', () => undo(B.lastResult.payment_id));
    $$('[data-undo]', box).forEach((b) => b.addEventListener('click', () => undo(b.dataset.undo)));
    // آخر details (التعديل اليدوي) يفضل مفتوح لو فيه أداة مختارة
    if (B.tool) { const ds = $$('details.bl-more', box); if (ds.length) ds[ds.length - 1].open = true; }
}
function refreshSummary() {
    // تحديث سطر الملخص بس (المبلغ)
    const f = B.f; const sum = $('#bl-act .bl-sum b:last-of-type');
    if (sum && f.kind === 'payment') sum.textContent = money(Number(AR_DIGITS(f.amount).replace(/[^\d.]/g, '')) || 0);
}
function toolForm(t) {
    if (!B.tool) return '';
    const curEnd = t.state === 'paid' ? ymd(t.paid_until) : '';
    const body = {
        change_plan: `<label class="bl-field"><span>الخطة الجديدة (التاريخ زي ما هو)</span><select class="inp" data-tool-plan>${Object.entries(PLANS).map(([k, p]) => `<option value="${k}" ${k === t.plan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`,
        set_end: `<div class="bl-row"><label class="bl-field"><span>آخر يوم في الاشتراك</span><input class="inp" type="date" data-tool-date min="${today()}" value="${esc(curEnd)}"></label>
            <label class="bl-field"><span>الخطة</span><select class="inp" data-tool-plan>${Object.entries(PLANS).map(([k, p]) => `<option value="${k}" ${k === (t.plan || 'pro') ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
            <div class="bl-tip">من غير ما يتسجل فلوس. للدفع استخدمي "فعّلي اشتراك" فوق.</div>`,
        trial_until: `<label class="bl-field"><span>الفترة المجانية لحد</span><input class="inp" type="date" data-tool-date min="${today()}" value="${esc(ymd(t.trial_ends_at))}"></label>`,
        stop: `<div class="bl-warn">الاشتراك هيتقفل من دلوقتي والبرنامج هيطلب من المدرس يجدّد. بياناته كلها بتفضل زي ما هي. (تقدري تتراجعي بعدها)</div>`
    }[B.tool];
    return `<div class="bl-tool">${body}<label class="bl-field" style="margin-top:8px"><span>السبب (اختياري)</span><input class="inp" type="text" maxlength="300" data-tool-note></label>
        <button class="btn sm ${B.tool === 'stop' ? '' : 'solid'}" data-tool-go type="button" style="margin-top:10px">${B.tool === 'stop' ? '⛔ أوقفي الاشتراك' : 'احفظي'}</button></div>`;
}

// ============================================================ العمليات
function replaceTeacher(row) {
    if (!row) return;
    const i = (B.teachers || []).findIndex((x) => String(x.id) === String(row.id));
    if (i >= 0) B.teachers[i] = row; else (B.teachers = B.teachers || []).unshift(row);
}
async function refreshAfter() {
    try {
        const [ov, p] = await Promise.all([api('billing_overview'), api('billing_payments')]);
        B.ov = ov; B.payments = p.payments || []; updateBadge();
    } catch (e) { /* الصف نفسه اتحدّث، الأرقام هتتحدّث مع أول تحديث */ }
    if (isOpen()) {
        const y = window.scrollY; render(); window.scrollTo(0, y);
    }
    if (D.onBillingChanged) D.onBillingChanged();
}
async function activate() {
    const t = byId(B.sel); const f = B.f; if (!t || !f || f.busy) return;
    const amount = AR_DIGITS(f.amount).replace(/[^\d.]/g, '');
    if (f.kind === 'payment' && !(Number(amount) > 0)) { f.err = 'اكتبي المبلغ اللي اتدفع (أو اختاري "هدية").'; renderActivate(); return; }
    if (f.period === 'custom' && !(Number(f.months) > 0) && !(Number(f.extra_days) > 0)) { f.err = 'اكتبي عدد الشهور أو الأيام.'; renderActivate(); return; }
    f.busy = true; f.err = ''; renderActivate();
    const body = { teacher_id: t.id, plan: f.plan, period: f.period, kind: f.kind };
    if (f.period === 'custom') { body.months = f.months; body.extra_days = f.extra_days; }
    if (f.kind === 'payment') { body.amount = amount; body.method = f.method; if (f.paid_at && f.paid_at !== today()) body.paid_at = f.paid_at; }
    if (f.startsDirty && f.starts_at) body.starts_at = f.starts_at;
    if (f.note) body.note = f.note;
    try {
        const r = await api('billing_activate', body);
        replaceTeacher(r.teacher);
        B.lastResult = { payment_id: r.payment_id, plan: f.plan, paid_until: r.paid_until };
        toast('اتفعّل ✓');
        await refreshAfter();
    } catch (e) {
        if (e.message === 'AUTH') return;
        f.busy = false; f.err = e.message; renderActivate();
    }
}
async function adjust(t) {
    const box = $('#bl-act');
    const body = { teacher_id: t.id, action: B.tool };
    const pl = $('[data-tool-plan]', box); const dt = $('[data-tool-date]', box); const nt = $('[data-tool-note]', box);
    if (pl) body.plan = pl.value;
    if (dt) { if (!dt.value) { toast('اختاري التاريخ'); return; } body.date = dt.value; }
    if (nt && nt.value.trim()) body.note = nt.value.trim();
    const btn = $('[data-tool-go]', box); btn.disabled = true;
    try {
        const r = await api('billing_adjust', body);
        replaceTeacher(r.teacher); B.tool = null; B.lastResult = null;
        toast('اتحفظ ✓');
        await refreshAfter();
    } catch (e) { if (e.message !== 'AUTH') toast(e.message); btn.disabled = false; }
}
async function undo(id) {
    if (!id) return;
    const p = (B.payments || []).find((x) => String(x.id) === String(id));
    const reason = window.prompt(`هتلغي ${p ? `${KINDS[p.kind] || 'العملية'} ${p.kind === 'payment' ? money(p.amount) + ' ' : ''}لـ ${p.name}` : 'العملية دي'} والاشتراك يرجع زي ما كان قبلها.\nالسبب (اختياري):`, '');
    if (reason === null) return;
    try {
        const r = await api('billing_undo', { id, reason });
        replaceTeacher(r.teacher); B.lastResult = null;
        toast('اتلغت ورجع زي ما كان ✓');
        await refreshAfter();
    } catch (e) { if (e.message !== 'AUTH') toast(e.message); }
}

// ============================================================ التجديدات
function renderRenewals() {
    const box = $('#bl-renew'); if (!box) return;
    const list = (B.ov && B.ov.renewals) || [];
    box.innerHTML = `<h3>🔔 محتاجين تجديد</h3><p class="sub">بيخلصوا خلال 14 يوم، أو خلصوا آخر 30 يوم ومجدّدوش</p>
        ${!list.length ? '<div class="empty">مفيش حد محتاج تجديد دلوقتي 🎉</div>' : `<div class="bl-rl">${list.map((x) => {
            const n = daysTo(x.paid_until); const expired = n <= 0;
            const first = String(x.name || '').split(' ')[0];
            const msg = expired
                ? `أهلًا يا ${first} 🌷 اشتراكك في Teachers Manager (الباقة ${planName(x.plan)}) خلص يوم ${dLong(x.paid_until)}. تحبي نجدده عشان تكملي من غير ما حاجة تقف؟ 🙏`
                : `أهلًا يا ${first} 🌷 اشتراكك في Teachers Manager (الباقة ${planName(x.plan)}) بيخلص يوم ${dLong(x.paid_until)}. تحبي نجدده؟ 🙏`;
            const wa = waLink(x.phone, msg);
            return `<div class="bl-ren ${expired ? 'bad' : n <= 3 ? 'warn' : ''}">
                <div><b>${esc(x.name)}</b> <span class="tag mute">${esc(planName(x.plan))}</span>
                    <div class="bl-meta">${expired ? `خلص من ${nf(-n)} يوم (${dShort(x.paid_until)})` : n === 0 ? 'بيخلص النهارده' : `فاضل ${nf(n)} يوم (${dShort(x.paid_until)})`}</div></div>
                <div class="bl-row">${wa ? `<a class="btn sm wa" href="${wa}" target="_blank" rel="noopener">فكّريه</a>` : ''}<button class="btn sm solid" data-renew="${esc(x.id)}" data-plan="${esc(x.plan || '')}" type="button">جدّدي</button></div></div>`;
        }).join('')}</div>`}`;
    $$('[data-renew]', box).forEach((b) => b.addEventListener('click', () => select(b.dataset.renew, { plan: b.dataset.plan || undefined })));
}

// ============================================================ جدول المدرسين
const T_FILTERS = [
    ['all', 'الكل', () => true],
    ['paid', 'مشتركين', (t) => t.state === 'paid'],
    ['pro', 'الاحترافية', (t) => t.state === 'paid' && t.plan === 'pro'],
    ['starter', 'البداية', (t) => t.state === 'paid' && t.plan !== 'pro'],
    ['trial', 'فترة مجانية', (t) => t.state === 'trial'],
    ['expired', 'منتهي', (t) => t.state === 'expired' || t.state === 'none'],
    ['never', 'عمرهم ما دفعوا', (t) => !Number(t.payments)],
    ['over', 'البداية وعندهم أكتر من 10 طلاب', (t) => t.state === 'paid' && t.plan === 'starter' && PLANS.starter.students && Number(t.students) > PLANS.starter.students]
];
function renderTeachers() {
    const list = B.teachers; const fbox = $('#bl-tf'); const lbox = $('#bl-tl'); if (!list || !fbox) return;
    fbox.innerHTML = T_FILTERS.map(([k, l, fn]) => { const n = list.filter(fn).length; return (k === 'over' && !n) ? '' : `<button class="chip ${B.tFilter === k ? 'active' : ''}" data-f="${k}">${l}<span class="c">${nf(n)}</span></button>`; }).join('')
        + `<input class="search" id="bl-ts" type="search" placeholder="ابحثي بالاسم أو الإيميل أو الرقم…" value="${esc(B.tSearch)}">`;
    const fn = (T_FILTERS.find(([k]) => k === B.tFilter) || T_FILTERS[0])[2];
    const rows = list.filter(fn).filter((t) => matches(t, B.tSearch)).sort((a, b) => {
        // المشتركين بالأقرب للنهاية، الباقي بالأحدث تسجيلًا
        if (a.state === 'paid' && b.state === 'paid') return new Date(a.paid_until || 8.64e15) - new Date(b.paid_until || 8.64e15);
        return 0;
    });
    lbox.innerHTML = !rows.length ? '<div class="card empty">مفيش مدرسين هنا</div>' : `<div class="table-wrap" style="max-height:560px"><table><thead><tr>
        <th>المدرس</th><th>الموبايل</th><th>الحالة</th><th>لحد</th><th>طلاب</th><th>دفع إجمالي</th><th>آخر دفعة</th><th></th></tr></thead><tbody>
        ${rows.map((t) => {
            const end = t.state === 'trial' ? t.trial_ends_at : t.paid_until; const n = daysTo(end);
            return `<tr class="click" data-id="${esc(t.id)}"><td><b>${esc(t.name)}</b>${t.deleting ? ' <span class="tag bad">حذف</span>' : ''}<br><small style="color:var(--ink3);direction:ltr;unicode-bidi:isolate">${esc(t.email || '')}</small></td>
                <td style="direction:ltr;unicode-bidi:isolate;text-align:end">${esc(t.phone || '—')}</td>
                <td>${stateTag(t)}</td>
                <td>${end ? `${dShort(end)}${t.state === 'paid' && n <= 7 ? ` <span class="tag ${n <= 0 ? 'bad' : 'warn'}">${n <= 0 ? 'خلص' : `${nf(n)} يوم`}</span>` : ''}` : '—'}</td>
                <td class="num">${nf(t.students)}${t.plan === 'starter' && t.state === 'paid' && Number(t.students) > (PLANS.starter.students || 1e9) ? ' ⚠️' : ''}</td>
                <td class="num">${Number(t.total_paid) ? money(t.total_paid) : '—'}</td>
                <td>${t.last_paid_at ? dShort(t.last_paid_at) : '—'}</td>
                <td><button class="btn sm" data-pick="${esc(t.id)}" type="button">${t.state === 'paid' ? 'جدّدي / عدّلي' : 'فعّلي'}</button></td></tr>`;
        }).join('')}</tbody></table></div>
        ${src(`${nf(rows.length)} مدرس · <code>profiles</code> + <code>subscriptions</code> + <code>subscription_payments</code>`)}`;
    $$('.chip', fbox).forEach((b) => b.addEventListener('click', () => { B.tFilter = b.dataset.f; renderTeachers(); }));
    const s = $('#bl-ts');
    s.addEventListener('input', () => { B.tSearch = s.value; const pos = s.selectionStart; renderTeachers(); const n = $('#bl-ts'); n.focus(); n.setSelectionRange(pos, pos); });
    $$('tr.click', lbox).forEach((tr) => tr.addEventListener('click', () => select(tr.dataset.id)));
}

// ============================================================ سجل المدفوعات
const P_FILTERS = [
    ['all', 'الكل', (p) => !p.cancelled_at],
    ['payment', 'دفعات', (p) => !p.cancelled_at && p.kind === 'payment'],
    ['other', 'هدايا وتعديلات', (p) => !p.cancelled_at && p.kind !== 'payment'],
    ['cancelled', 'اتلغت', (p) => !!p.cancelled_at]
];
function visiblePayments() {
    const fn = (P_FILTERS.find(([k]) => k === B.pFilter) || P_FILTERS[0])[2];
    return (B.payments || []).filter(fn).filter((p) => matches({ name: p.name, phone: p.phone, email: '' }, B.pSearch));
}
function renderPayments() {
    const list = B.payments; const fbox = $('#bl-pf'); const lbox = $('#bl-pl'); if (!list || !fbox) return;
    fbox.innerHTML = P_FILTERS.map(([k, l, fn]) => `<button class="chip ${B.pFilter === k ? 'active' : ''}" data-f="${k}">${l}<span class="c">${nf(list.filter(fn).length)}</span></button>`).join('')
        + `<input class="search" id="bl-ps" type="search" placeholder="ابحثي باسم المدرس…" value="${esc(B.pSearch)}">
           <button class="btn sm" id="bl-csv" type="button">⬇ نزّلي Excel</button>`;
    const rows = visiblePayments();
    const total = rows.filter((p) => p.kind === 'payment' && !p.cancelled_at).reduce((a, p) => a + Number(p.amount || 0), 0);
    lbox.innerHTML = !rows.length ? '<div class="card empty">لسه مفيش مدفوعات متسجلة. أول ما تفعّلي اشتراك هيظهر هنا.</div>' : `<div class="table-wrap" style="max-height:560px"><table><thead><tr>
        <th>اتدفع يوم</th><th>المدرس</th><th>النوع</th><th>الخطة</th><th>المدة</th><th>المبلغ</th><th>الطريقة</th><th>الفترة</th><th>ملاحظة</th><th></th></tr></thead><tbody>
        ${rows.map((p) => `<tr class="${p.cancelled_at ? 'bl-x' : ''}"><td>${dShort(p.paid_at)}</td>
            <td><a href="#" data-sel="${esc(p.user_id)}">${esc(p.name)}</a></td>
            <td>${esc(KINDS[p.kind] || p.kind)}${p.cancelled_at ? ` <span class="tag mute" title="${esc(p.cancel_reason || '')}">اتلغت</span>` : ''}</td>
            <td>${esc(planName(p.plan))}</td>
            <td>${p.kind === 'adjust' ? '—' : esc(p.period === 'custom' ? `${nf(p.months)} شهر${Number(p.extra_days) ? ` + ${nf(p.extra_days)} يوم` : ''}` : (PERIODS[p.period] || ['—'])[0])}</td>
            <td class="num"><b>${p.kind === 'payment' ? money(p.amount) : '—'}</b></td>
            <td>${esc(p.method || '—')}</td>
            <td>${p.starts_at ? `${dShort(p.starts_at)} ← ` : ''}${dShort(p.ends_at)}</td>
            <td class="wrap-cell" style="min-width:140px">${esc(p.note || '')}</td>
            <td>${p.can_undo && !p.cancelled_at ? `<button class="btn sm" data-undo="${esc(p.id)}" type="button">↶ تراجع</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
        ${src(`${nf(rows.length)} عملية · إجمالي الدفعات في القايمة دي <b>${money(total)}</b>`)}`;
    $$('.chip', fbox).forEach((b) => b.addEventListener('click', () => { B.pFilter = b.dataset.f; renderPayments(); }));
    const s = $('#bl-ps');
    s.addEventListener('input', () => { B.pSearch = s.value; const pos = s.selectionStart; renderPayments(); const n = $('#bl-ps'); n.focus(); n.setSelectionRange(pos, pos); });
    $('#bl-csv').addEventListener('click', exportCsv);
    $$('[data-undo]', lbox).forEach((b) => b.addEventListener('click', () => undo(b.dataset.undo)));
    $$('[data-sel]', lbox).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); select(a.dataset.sel); }));
}
function exportCsv() {
    const rows = visiblePayments();
    const head = ['اتدفع يوم', 'المدرس', 'الموبايل', 'النوع', 'الخطة', 'المدة', 'الشهور', 'أيام زيادة', 'المبلغ', 'طريقة الدفع', 'من', 'لحد', 'ملاحظة', 'اتلغت', 'سبب الإلغاء'];
    const cell = (v) => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [head.join(',')].concat(rows.map((p) => [ymd(p.paid_at), p.name, p.phone ? `'${p.phone}` : '', KINDS[p.kind] || p.kind, planName(p.plan),
        (PERIODS[p.period] || [''])[0], p.months, p.extra_days, p.kind === 'payment' ? p.amount : 0, p.method || '', ymd(p.starts_at), ymd(p.ends_at),
        p.note || '', p.cancelled_at ? ymd(p.cancelled_at) : '', p.cancel_reason || ''].map(cell).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `مدفوعات-Teachers-Manager-${today()}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ============================================================ كروت في "نظرة عامة"
function mountOverview(el) {
    if (!el) return;
    const draw = () => {
        if (!B.ov) { el.innerHTML = ''; return; }
        const c = B.ov.counts || {}; const r = B.ov.revenue || {};
        el.innerHTML = `<div class="grid g-kpi" style="margin-top:14px">
            <div class="card kpi" data-ov-bill><div class="lbl">💳 مشتركين دلوقتي</div><div class="num">${nf(c.paid)}</div><div class="hint">الاحترافية ${nf(c.paid_pro)} · البداية ${nf(c.paid_starter)}</div></div>
            <div class="card kpi" data-ov-bill><div class="lbl">💰 إيراد الشهر ده</div><div class="num">${money(r.this_month)}</div><div class="hint">الإجمالي ${money(r.total)}</div></div>
            <div class="card kpi ${(Number(c.expiring_7d) || Number(c.expired_30d)) ? 'alert' : ''}" data-ov-bill><div class="lbl">🔔 محتاجين تجديد</div><div class="num">${nf((Number(c.expiring_7d) || 0) + (Number(c.expired_30d) || 0))}</div><div class="hint">بيخلصوا خلال 7 أيام أو خلصوا قريب</div></div>
        </div>`;
        $$('[data-ov-bill]', el).forEach((k) => k.addEventListener('click', () => D.switchTab('billing')));
    };
    if (B.ov) draw();
    else loadAll().then(draw).catch(() => { el.innerHTML = ''; });   // لو تبويب الاشتراكات لسه ماتركّبش، الكروت مابتظهرش وخلاص
}

// ============================================================ الواجهة اللي index.html بيستخدمها
window.TMBilling = {
    async show() {
        if (!CFG.BILLING_ENDPOINT) { panel().innerHTML = D.errBox('ضيفي BILLING_ENDPOINT في config.js (رابط workflow owner-billing).'); return; }
        if (B.ov) { render(); return; }
        render();
        try { await loadAll(); render(); }
        catch (e) {
            if (e.message === 'AUTH') return;
            panel().innerHTML = `<div class="card"><div class="err" style="margin:0">⚠️ ${esc(e.message)}</div>
                <p class="sub" style="margin-top:10px">لو أول مرة: شغّلي <b>DB_billing.sql</b> في Supabase، واعملي Import لـ <b>owner-billing.json</b> في n8n واختاري الـ Postgres credential وفعّليه.</p></div>`;
        }
    },
    reset() { B.ov = B.teachers = B.payments = null; },
    mountOverview
};

// ============================================================ التنسيق
const css = document.createElement('style');
css.textContent = `
.bl-top { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); align-items: start; }
@media (max-width: 960px) { .bl-top { grid-template-columns: 1fr; } }
.bl-search { position: relative; }
.bl-q { width: 100%; max-width: none; font-size: 15px; padding: 10px 14px; }
.bl-res { position: absolute; inset-inline: 0; top: calc(100% + 4px); background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 10px 30px rgba(41,37,45,.12); z-index: 20; max-height: 360px; overflow-y: auto; }
.bl-ri { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 0; border-bottom: 1px solid var(--line); background: none; cursor: pointer; text-align: start; }
.bl-ri:last-child { border-bottom: 0; }
.bl-ri:hover, .bl-ri:focus { background: var(--soft); outline: none; }
.bl-ri small { display: block; color: var(--ink3); font-size: 12px; direction: ltr; unicode-bidi: plaintext; text-align: start; }
.bl-tip { font-size: 12.5px; color: var(--ink2); margin: 8px 0 0; }
.linkbtn { border: 0; background: none; color: var(--primary); text-decoration: underline; cursor: pointer; padding: 0; font-size: inherit; }
.bl-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.bl-who { background: var(--soft); border-radius: 12px; padding: 12px; }
.bl-meta { font-size: 12.5px; color: var(--ink2); margin-top: 3px; }
.bl-lbl { font-weight: 700; font-size: 13px; margin: 14px 0 6px; color: var(--ink); }
.seg { display: flex; flex-wrap: wrap; gap: 6px; }
.seg button { border: 1px solid var(--line); background: var(--card); border-radius: 10px; padding: 8px 14px; font-weight: 600; font-size: 13.5px; cursor: pointer; color: var(--ink2); }
.seg button.on { background: var(--primary); border-color: var(--primary); color: #fff; }
.bl-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.bl-plan { border: 2px solid var(--line); background: var(--card); border-radius: 12px; padding: 10px 12px; cursor: pointer; text-align: start; display: grid; gap: 2px; }
.bl-plan b { font-size: 15px; } .bl-plan span { font-weight: 600; color: var(--primary); } .bl-plan small { color: var(--ink2); font-size: 12px; }
.bl-plan.on { border-color: var(--primary); background: #F5F1F8; box-shadow: 0 0 0 3px rgba(75,58,90,.08); }
.bl-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.bl-field { display: grid; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--ink2); flex: 1 1 160px; }
.bl-field .inp { font-size: 15px; padding: 8px 10px; width: 100%; color: var(--ink); }
.bl-inl { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink2); }
.bl-more { margin-top: 12px; font-size: 13.5px; }
.bl-more summary { cursor: pointer; color: var(--primary); font-weight: 600; }
.bl-sum { margin-top: 14px; background: var(--gold-soft); border: 1px solid #EBD5A6; border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.8; }
.bl-sum small { color: var(--warn); }
.bl-go { width: 100%; justify-content: center; margin-top: 12px; padding: 12px; font-size: 15.5px; }
.bl-ok { background: var(--good-soft); color: #1F5C3A; border-radius: 12px; padding: 12px 14px; margin-top: 12px; font-size: 14px; }
.bl-warn { background: var(--warn-soft); color: var(--warn); border-radius: 10px; padding: 8px 12px; font-size: 13px; margin-top: 8px; }
.bl-tool { margin-top: 10px; background: var(--soft); border-radius: 12px; padding: 12px; }
.bl-rl { display: grid; gap: 6px; max-height: 520px; overflow-y: auto; }
.bl-ren { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 10px 12px; border-radius: 12px; background: var(--soft); border-inline-start: 4px solid var(--line); }
.bl-ren.warn { border-inline-start-color: var(--gold); background: var(--gold-soft); }
.bl-ren.bad { border-inline-start-color: var(--bad); background: var(--bad-soft); }
tr.bl-x td { color: var(--ink3); text-decoration: line-through; }
tr.bl-x td .tag, tr.bl-x td .btn { text-decoration: none; }
`;
document.head.appendChild(css);
})();
