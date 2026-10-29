-- =====================================================================
-- DB_billing.sql — إدارة الاشتراكات من لوحة المتابعة
-- شغّليه مرة واحدة في Supabase ← SQL Editor
-- * إضافة بس: جدول جديد subscription_payments + دوال للوحة.
-- * مفيش أي تعديل على بيانات المدرسين أو الطلاب أو الحصص.
-- * الدوال مقفولة على n8n بس (مش متاحة للمتصفح)، وبتتأكد إنك أدمن من app_admins.
-- =====================================================================

-- 1) سجل كل دفعة / هدية / تعديل يدوي
create table if not exists teachers_manager.subscription_payments (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null,                       -- المدرس (من غير FK عشان سجل الفلوس يفضل حتى لو الحساب اتحذف)
    teacher_name    text,                                -- اسم المدرس وقت الدفع
    kind            text not null default 'payment' check (kind in ('payment', 'gift', 'adjust')),
    plan            text check (plan is null or plan in ('starter', 'pro')),
    period          text check (period is null or period in ('monthly', 'semiannual', 'annual', 'custom')),
    months          integer not null default 0 check (months between 0 and 60),
    extra_days      integer not null default 0 check (extra_days between 0 and 3650),
    amount          numeric not null default 0 check (amount >= 0 and amount <= 1000000),
    method          text check (method is null or char_length(method) <= 40),
    note            text check (note is null or char_length(note) <= 500),
    paid_at         timestamptz not null default now(),
    starts_at       timestamptz,
    ends_at         timestamptz,
    -- حالة الاشتراك قبل العملية (عشان "تراجع" يرجّعها زي ما كانت بالظبط)
    prev_status     text,
    prev_plan       text,
    prev_paid_until timestamptz,
    prev_trial_ends_at timestamptz,
    created_by      uuid,
    created_at      timestamptz not null default now(),
    cancelled_at    timestamptz,
    cancelled_by    uuid,
    cancel_reason   text check (cancel_reason is null or char_length(cancel_reason) <= 300)
);
create index if not exists subscription_payments_user_idx on teachers_manager.subscription_payments (user_id, created_at desc);
create index if not exists subscription_payments_paid_idx on teachers_manager.subscription_payments (paid_at) where cancelled_at is null;

alter table teachers_manager.subscription_payments enable row level security;   -- مفيش policies = المتصفح مايشوفش حاجة
revoke all on teachers_manager.subscription_payments from public;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on teachers_manager.subscription_payments from anon'; end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on teachers_manager.subscription_payments from authenticated'; end if;
end $$;

-- 2) الحالة المفهومة لكل مدرس: paid / trial / expired / none
create or replace function teachers_manager.billing_state(s teachers_manager.subscriptions)
returns text language sql stable as $$
    select case
        when s.user_id is null or s.status = 'none' then 'none'
        when s.status = 'active' and (s.paid_until is null or s.paid_until > now()) then 'paid'
        when s.status = 'trial' and (s.trial_ends_at is null or s.trial_ends_at > now()) then 'trial'
        else 'expired'
    end
$$;

-- الاشتراك الجديد بيبدأ من إمتى لو ماحددتيش: بعد آخر يوم مدفوع، أو بعد الفترة المجانية، أو من النهارده
create or replace function teachers_manager.billing_default_start(s teachers_manager.subscriptions)
returns timestamptz language sql stable as $$
    select greatest(
        now(),
        case when s.status = 'active' then s.paid_until end,
        case when s.status = 'trial' then s.trial_ends_at end
    )
$$;

-- تاريخ (YYYY-MM-DD) بتوقيت مصر ← أول اليوم / آخر اليوم
create or replace function teachers_manager.billing_day_start(d text)
returns timestamptz language sql immutable as $$ select (d::date)::timestamp at time zone 'Africa/Cairo' $$;
create or replace function teachers_manager.billing_day_end(d text)
returns timestamptz language sql immutable as $$ select ((d::date + 1)::timestamp at time zone 'Africa/Cairo') - interval '1 second' $$;

-- 3) صف المدرس كامل (بيرجع في القايمة وبعد كل عملية)
create or replace function teachers_manager.billing_teacher_row(p_tid uuid)
returns jsonb language sql stable security definer set search_path = teachers_manager, public as $$
    select jsonb_build_object(
        'id', p.id, 'name', p.name, 'email', p.email, 'phone', p.phone, 'subject', p.subject,
        'created_at', p.created_at, 'deleting', p.deletion_requested_at is not null,
        'status', coalesce(s.status, 'none'), 'plan', s.plan, 'trial_ends_at', s.trial_ends_at, 'paid_until', s.paid_until,
        'state', teachers_manager.billing_state(s),
        'default_start', teachers_manager.billing_default_start(s),
        'students', (select count(*) from students st where st.teacher_id = p.id and coalesce(st.status, 'active') <> 'archived'),
        'total_paid', coalesce((select sum(amount) from subscription_payments sp where sp.user_id = p.id and sp.kind = 'payment' and sp.cancelled_at is null), 0),
        'payments', (select count(*) from subscription_payments sp where sp.user_id = p.id and sp.kind = 'payment' and sp.cancelled_at is null),
        'last_paid_at', (select max(paid_at) from subscription_payments sp where sp.user_id = p.id and sp.kind = 'payment' and sp.cancelled_at is null)
    )
    from profiles p left join subscriptions s on s.user_id = p.id
    where p.id = p_tid
$$;

-- 4) نظرة عامة: المشتركين والفلوس والتجديدات
create or replace function teachers_manager.billing_overview()
returns jsonb language plpgsql stable security definer set search_path = teachers_manager, public as $$
declare
    v_month date := date_trunc('month', now() at time zone 'Africa/Cairo')::date;
    r jsonb;
begin
    with t as (
        select p.id, p.name, p.phone, p.email, s.plan, s.paid_until, s.trial_ends_at, s.status,
               teachers_manager.billing_state(s) as state
        from profiles p left join subscriptions s on s.user_id = p.id
    ),
    pay as (
        select *, (paid_at at time zone 'Africa/Cairo') as paid_local
        from subscription_payments where kind = 'payment' and cancelled_at is null
    ),
    months as (
        select (v_month - make_interval(months => g))::date as m from generate_series(0, 11) g
    )
    select jsonb_build_object(
        'now', now(),
        'counts', jsonb_build_object(
            'teachers', (select count(*) from t),
            'paid', (select count(*) from t where state = 'paid'),
            'paid_pro', (select count(*) from t where state = 'paid' and plan = 'pro'),
            'paid_starter', (select count(*) from t where state = 'paid' and coalesce(plan, 'starter') <> 'pro'),
            'trial', (select count(*) from t where state = 'trial'),
            'expired', (select count(*) from t where state = 'expired'),
            'none', (select count(*) from t where state = 'none'),
            'expiring_7d', (select count(*) from t where state = 'paid' and paid_until <= now() + interval '7 days'),
            'expired_30d', (select count(*) from t where status = 'active' and paid_until <= now() and paid_until > now() - interval '30 days'),
            'ever_paid', (select count(distinct user_id) from pay),
            'renewed', (select count(*) from (select user_id from pay group by user_id having count(*) > 1) x),
            'upcoming', (select count(distinct user_id) from pay where starts_at > now())
        ),
        'trial_ends_at', (select mode() within group (order by trial_ends_at) from t where state = 'trial'),
        'revenue', jsonb_build_object(
            'total', (select coalesce(sum(amount), 0) from pay),
            'this_month', (select coalesce(sum(amount), 0) from pay where paid_local >= v_month),
            'last_month', (select coalesce(sum(amount), 0) from pay where paid_local >= (v_month - interval '1 month') and paid_local < v_month),
            'this_year', (select coalesce(sum(amount), 0) from pay where paid_local >= date_trunc('year', now() at time zone 'Africa/Cairo')),
            'payments_this_month', (select count(*) from pay where paid_local >= v_month),
            -- الإيراد الشهري المتكرر: كل اشتراك شغال دلوقتي مقسوم على عدد شهوره
            'mrr', (select coalesce(round(sum(amount / greatest(months, 1)), 2), 0) from pay where starts_at <= now() and ends_at > now()),
            'avg_payment', (select coalesce(round(avg(amount), 2), 0) from pay)
        ),
        'by_month', (select coalesce(jsonb_agg(jsonb_build_object(
                'month', to_char(m.m, 'YYYY-MM-DD'),
                'amount', coalesce((select sum(amount) from pay where date_trunc('month', paid_local)::date = m.m), 0),
                'payments', (select count(*) from pay where date_trunc('month', paid_local)::date = m.m),
                'new_teachers', (select count(*) from (select user_id, min(paid_local) f from pay group by user_id) x where date_trunc('month', x.f)::date = m.m)
            ) order by m.m), '[]'::jsonb) from months m),
        'by_plan', (select coalesce(jsonb_agg(jsonb_build_object('plan', plan, 'amount', a, 'payments', c) order by a desc), '[]'::jsonb)
                    from (select coalesce(plan, 'starter') plan, sum(amount) a, count(*) c from pay group by 1) x),
        'by_period', (select coalesce(jsonb_agg(jsonb_build_object('period', period, 'amount', a, 'payments', c) order by a desc), '[]'::jsonb)
                    from (select coalesce(period, 'custom') period, sum(amount) a, count(*) c from pay group by 1) x),
        'by_method', (select coalesce(jsonb_agg(jsonb_build_object('method', method, 'amount', a, 'payments', c) order by a desc), '[]'::jsonb)
                    from (select coalesce(nullif(method, ''), 'غير محدد') method, sum(amount) a, count(*) c from pay group by 1) x),
        -- اللي هيخلصوا خلال 14 يوم + اللي خلصوا آخر 30 يوم ومجدّدوش
        'renewals', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'phone', phone, 'email', email, 'plan', plan, 'paid_until', paid_until, 'state', state) order by paid_until), '[]'::jsonb)
                    from t where status = 'active' and paid_until is not null
                      and paid_until <= now() + interval '14 days' and paid_until > now() - interval '30 days')
    ) into r;
    return r;
end $$;

-- 5) قايمة كل المدرسين واشتراكاتهم
create or replace function teachers_manager.billing_teachers()
returns jsonb language sql stable security definer set search_path = teachers_manager, public as $$
    with pay as (
        select user_id, sum(amount) total, count(*) n, max(paid_at) last_at
        from subscription_payments where kind = 'payment' and cancelled_at is null group by user_id
    ), st as (
        select teacher_id, count(*) n from students where coalesce(status, 'active') <> 'archived' group by teacher_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'email', p.email, 'phone', p.phone, 'subject', p.subject,
        'created_at', p.created_at, 'deleting', p.deletion_requested_at is not null,
        'status', coalesce(s.status, 'none'), 'plan', s.plan, 'trial_ends_at', s.trial_ends_at, 'paid_until', s.paid_until,
        'state', teachers_manager.billing_state(s), 'default_start', teachers_manager.billing_default_start(s),
        'students', coalesce(st.n, 0), 'total_paid', coalesce(pay.total, 0), 'payments', coalesce(pay.n, 0), 'last_paid_at', pay.last_at
    ) order by p.created_at desc), '[]'::jsonb)
    from profiles p
    left join subscriptions s on s.user_id = p.id
    left join pay on pay.user_id = p.id
    left join st on st.teacher_id = p.id
$$;

-- 6) سجل المدفوعات (لمدرس واحد أو للكل)
create or replace function teachers_manager.billing_payments(p_tid uuid, p_limit integer default 1000)
returns jsonb language sql stable security definer set search_path = teachers_manager, public as $$
    with x as (
        select sp.*, p.name as current_name, p.phone,
               (sp.cancelled_at is null and sp.created_at = max(sp.created_at) filter (where sp.cancelled_at is null) over (partition by sp.user_id)) as is_latest
        from subscription_payments sp left join profiles p on p.id = sp.user_id
        where p_tid is null or sp.user_id = p_tid
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'user_id', user_id, 'name', coalesce(current_name, teacher_name, 'حساب محذوف'), 'phone', phone,
        'kind', kind, 'plan', plan, 'period', period, 'months', months, 'extra_days', extra_days, 'amount', amount,
        'method', method, 'note', note, 'paid_at', paid_at, 'starts_at', starts_at, 'ends_at', ends_at,
        'created_at', created_at, 'cancelled_at', cancelled_at, 'cancel_reason', cancel_reason, 'can_undo', is_latest
    ) order by created_at desc), '[]'::jsonb)
    from (select * from x order by created_at desc limit greatest(1, least(p_limit, 5000))) y
$$;

-- 7) تفعيل اشتراك (دفعة أو هدية)
create or replace function teachers_manager.billing_activate(p_admin uuid, p_req jsonb)
returns jsonb language plpgsql security definer set search_path = teachers_manager, public as $$
declare
    v_tid uuid; v_plan text; v_kind text; v_period text; v_months int; v_extra int; v_amount numeric;
    v_start timestamptz; v_end timestamptz; v_paid_at timestamptz; v_until timestamptz;
    s subscriptions; v_name text; v_pid uuid;
begin
    begin v_tid := (p_req->>'teacher_id')::uuid; exception when others then v_tid := null; end;
    select name into v_name from profiles where id = v_tid;
    if v_tid is null or v_name is null then return jsonb_build_object('error', 'INVALID', 'message', 'المدرس ده مش موجود.'); end if;

    v_plan := p_req->>'plan';
    if v_plan not in ('starter', 'pro') or v_plan is null then return jsonb_build_object('error', 'INVALID', 'message', 'اختاري الخطة.'); end if;
    v_kind := coalesce(nullif(p_req->>'kind', ''), 'payment');
    if v_kind not in ('payment', 'gift') then v_kind := 'payment'; end if;
    v_period := coalesce(nullif(p_req->>'period', ''), 'monthly');
    if v_period not in ('monthly', 'semiannual', 'annual', 'custom') then return jsonb_build_object('error', 'INVALID', 'message', 'اختاري المدة.'); end if;
    v_months := case v_period when 'monthly' then 1 when 'semiannual' then 6 when 'annual' then 12
                else least(greatest(coalesce(nullif(p_req->>'months', '')::int, 0), 0), 36) end;
    v_extra := least(greatest(coalesce(nullif(p_req->>'extra_days', '')::int, 0), 0), 365);
    if v_months = 0 and v_extra = 0 then return jsonb_build_object('error', 'INVALID', 'message', 'المدة لازم تبقى شهر أو يوم على الأقل.'); end if;
    v_amount := case when v_kind = 'gift' then 0 else coalesce(nullif(p_req->>'amount', '')::numeric, 0) end;
    if v_kind = 'payment' and v_amount <= 0 then return jsonb_build_object('error', 'INVALID', 'message', 'اكتبي المبلغ اللي اتدفع (أو اختاري "هدية").'); end if;
    if v_amount > 1000000 then return jsonb_build_object('error', 'INVALID', 'message', 'المبلغ كبير أوي، راجعيه.'); end if;

    insert into subscriptions (user_id, status) values (v_tid, 'none') on conflict (user_id) do nothing;
    select * into s from subscriptions where user_id = v_tid for update;

    if nullif(p_req->>'starts_at', '') is not null then
        begin v_start := teachers_manager.billing_day_start(p_req->>'starts_at'); exception when others then
            return jsonb_build_object('error', 'INVALID', 'message', 'تاريخ البداية مش مظبوط.'); end;
    else
        v_start := teachers_manager.billing_default_start(s);
    end if;
    v_end := v_start + make_interval(months => v_months, days => v_extra);
    if v_end <= now() then return jsonb_build_object('error', 'INVALID', 'message', 'الاشتراك ده هيكون خلص قبل النهارده. راجعي تاريخ البداية.'); end if;

    v_paid_at := now();
    if nullif(p_req->>'paid_at', '') is not null then
        begin v_paid_at := teachers_manager.billing_day_start(p_req->>'paid_at') + interval '12 hours'; exception when others then v_paid_at := now(); end;
        if v_paid_at > now() then v_paid_at := now(); end if;
    end if;

    -- لو فيه اشتراك شغال لحد تاريخ أبعد، مانقصّروش
    v_until := case when s.status = 'active' and s.paid_until is not null and s.paid_until > v_end then s.paid_until else v_end end;

    insert into subscription_payments (user_id, teacher_name, kind, plan, period, months, extra_days, amount, method, note, paid_at,
                                       starts_at, ends_at, prev_status, prev_plan, prev_paid_until, prev_trial_ends_at, created_by)
    values (v_tid, v_name, v_kind, v_plan, v_period, v_months, v_extra, v_amount,
            nullif(left(coalesce(p_req->>'method', ''), 40), ''), nullif(left(coalesce(p_req->>'note', ''), 500), ''), v_paid_at,
            v_start, v_end, s.status, s.plan, s.paid_until, s.trial_ends_at, p_admin)
    returning id into v_pid;

    update subscriptions set status = 'active', plan = v_plan, paid_until = v_until, updated_at = now() where user_id = v_tid;

    return jsonb_build_object('ok', true, 'payment_id', v_pid, 'starts_at', v_start, 'ends_at', v_end, 'paid_until', v_until,
                              'teacher', teachers_manager.billing_teacher_row(v_tid));
end $$;

-- 8) تعديل يدوي: تغيير الخطة / تاريخ النهاية / إيقاف / تمديد الفترة المجانية
create or replace function teachers_manager.billing_adjust(p_admin uuid, p_req jsonb)
returns jsonb language plpgsql security definer set search_path = teachers_manager, public as $$
declare
    v_tid uuid; v_action text := p_req->>'action'; v_plan text := nullif(p_req->>'plan', ''); v_date timestamptz;
    s subscriptions; v_name text; v_note text;
begin
    begin v_tid := (p_req->>'teacher_id')::uuid; exception when others then v_tid := null; end;
    select name into v_name from profiles where id = v_tid;
    if v_tid is null or v_name is null then return jsonb_build_object('error', 'INVALID', 'message', 'المدرس ده مش موجود.'); end if;
    if v_plan is not null and v_plan not in ('starter', 'pro') then return jsonb_build_object('error', 'INVALID', 'message', 'خطة غير معروفة.'); end if;
    if nullif(p_req->>'date', '') is not null then
        begin v_date := teachers_manager.billing_day_end(p_req->>'date'); exception when others then
            return jsonb_build_object('error', 'INVALID', 'message', 'التاريخ مش مظبوط.'); end;
    end if;

    insert into subscriptions (user_id, status) values (v_tid, 'none') on conflict (user_id) do nothing;
    select * into s from subscriptions where user_id = v_tid for update;

    if v_action = 'change_plan' then
        if v_plan is null then return jsonb_build_object('error', 'INVALID', 'message', 'اختاري الخطة.'); end if;
        update subscriptions set plan = v_plan, updated_at = now() where user_id = v_tid;
        v_note := 'تغيير الخطة';
    elsif v_action = 'set_end' then
        if v_date is null or v_date <= now() then return jsonb_build_object('error', 'INVALID', 'message', 'اختاري تاريخ نهاية بعد النهارده.'); end if;
        update subscriptions set status = 'active', paid_until = v_date, plan = coalesce(v_plan, s.plan, 'pro'), updated_at = now() where user_id = v_tid;
        v_note := 'تعديل تاريخ النهاية';
    elsif v_action = 'stop' then
        update subscriptions set status = 'expired', paid_until = least(coalesce(s.paid_until, now()), now()), updated_at = now() where user_id = v_tid;
        v_note := 'إيقاف الاشتراك';
    elsif v_action = 'trial_until' then
        if v_date is null or v_date <= now() then return jsonb_build_object('error', 'INVALID', 'message', 'اختاري تاريخ بعد النهارده.'); end if;
        if teachers_manager.billing_state(s) = 'paid' then return jsonb_build_object('error', 'INVALID', 'message', 'المدرس ده مشترك فعلًا. عدّلي تاريخ نهاية الاشتراك بدل الفترة المجانية.'); end if;
        update subscriptions set status = 'trial', trial_ends_at = v_date, updated_at = now() where user_id = v_tid;
        v_note := 'تمديد الفترة المجانية';
    else
        return jsonb_build_object('error', 'INVALID', 'message', 'طلب غير معروف.');
    end if;

    insert into subscription_payments (user_id, teacher_name, kind, plan, amount, note, starts_at, ends_at,
                                       prev_status, prev_plan, prev_paid_until, prev_trial_ends_at, created_by)
    select v_tid, v_name, 'adjust', n.plan, 0, v_note || coalesce(' — ' || nullif(left(p_req->>'note', 400), ''), ''), null,
           case when n.status = 'trial' then n.trial_ends_at else n.paid_until end,
           s.status, s.plan, s.paid_until, s.trial_ends_at, p_admin
    from subscriptions n where n.user_id = v_tid;

    return jsonb_build_object('ok', true, 'teacher', teachers_manager.billing_teacher_row(v_tid));
end $$;

-- 9) تراجع عن آخر عملية لمدرس (لو اتسجلت غلط) — بيرجّع الاشتراك زي ما كان بالظبط
create or replace function teachers_manager.billing_undo(p_admin uuid, p_req jsonb)
returns jsonb language plpgsql security definer set search_path = teachers_manager, public as $$
declare v_id uuid; p subscription_payments; v_latest uuid;
begin
    begin v_id := (p_req->>'id')::uuid; exception when others then v_id := null; end;
    select * into p from subscription_payments where id = v_id for update;
    if p.id is null then return jsonb_build_object('error', 'INVALID', 'message', 'العملية دي مش موجودة.'); end if;
    if p.cancelled_at is not null then return jsonb_build_object('error', 'INVALID', 'message', 'العملية دي اتلغت قبل كده.'); end if;
    perform 1 from subscriptions where user_id = p.user_id for update;
    select id into v_latest from subscription_payments where user_id = p.user_id and cancelled_at is null order by created_at desc limit 1;
    if v_latest <> p.id then return jsonb_build_object('error', 'INVALID', 'message', 'تقدري تلغي آخر عملية للمدرس بس. ألغي اللي بعدها الأول.'); end if;

    update subscriptions set status = coalesce(p.prev_status, 'none'), plan = p.prev_plan, paid_until = p.prev_paid_until,
                             trial_ends_at = p.prev_trial_ends_at, updated_at = now()
    where user_id = p.user_id;
    update subscription_payments set cancelled_at = now(), cancelled_by = p_admin,
           cancel_reason = nullif(left(coalesce(p_req->>'reason', ''), 300), '')
    where id = p.id;
    return jsonb_build_object('ok', true, 'teacher', teachers_manager.billing_teacher_row(p.user_id));
end $$;

-- 10) نقطة الدخول الوحيدة من n8n (workflow: owner-billing)
create or replace function teachers_manager.owner_billing_api(p_uid uuid, p_req jsonb)
returns jsonb language plpgsql security definer set search_path = teachers_manager, public as $$
declare v_section text := coalesce(p_req->>'section', 'billing_overview'); v_tid uuid;
begin
    if p_uid is null or not exists (select 1 from app_admins where teacher_id = p_uid) then
        return jsonb_build_object('error', 'FORBIDDEN');
    end if;
    begin v_tid := nullif(p_req->>'teacher_id', '')::uuid; exception when others then v_tid := null; end;
    return case v_section
        when 'billing_overview' then teachers_manager.billing_overview()
        when 'billing_teachers' then jsonb_build_object('teachers', teachers_manager.billing_teachers())
        when 'billing_payments' then jsonb_build_object('payments', teachers_manager.billing_payments(v_tid, 2000))
        when 'billing_activate' then teachers_manager.billing_activate(p_uid, p_req)
        when 'billing_adjust'   then teachers_manager.billing_adjust(p_uid, p_req)
        when 'billing_undo'     then teachers_manager.billing_undo(p_uid, p_req)
        else jsonb_build_object('error', 'INVALID', 'message', 'طلب غير معروف.')
    end;
end $$;

-- الدوال دي لـ n8n بس: مقفولة على المتصفح (anon / authenticated)
do $$
declare f text;
begin
    foreach f in array array[
        'teachers_manager.billing_teacher_row(uuid)', 'teachers_manager.billing_overview()', 'teachers_manager.billing_teachers()',
        'teachers_manager.billing_payments(uuid, integer)', 'teachers_manager.billing_activate(uuid, jsonb)',
        'teachers_manager.billing_adjust(uuid, jsonb)', 'teachers_manager.billing_undo(uuid, jsonb)',
        'teachers_manager.owner_billing_api(uuid, jsonb)'
    ] loop
        execute 'revoke all on function ' || f || ' from public';
        if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on function ' || f || ' from anon'; end if;
        if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on function ' || f || ' from authenticated'; end if;
    end loop;
end $$;

-- للتأكد: لازم يطلع صف فيه عدد المدرسين وعدد المشتركين
select (teachers_manager.billing_overview()->'counts') as "تم ✓";
