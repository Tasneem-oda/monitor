/**
 * config.js — إعدادات لوحة المتابعة
 * القيم دي مش سرية (نفس اللي في البرنامج الأساسي). الحماية الحقيقية في n8n وقاعدة البيانات:
 * أي حد يفتح الصفحة لازم يدخل بحساب، والحساب لازم يكون في جدول app_admins.
 */
window.TM_DASH_CONFIG = {
    // Supabase (نفس مشروع البرنامج)
    SUPABASE_URL: 'https://qdpnupgqvjxlrmwwgmij.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkcG51cGdxdmp4bHJtd3dnbWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjczMjUsImV4cCI6MjA4NTU0MzMyNX0.gaWPEgrhIQJzZLVoo7x1hnS-63ZJPZN96Xb3WpqApik',

    // n8n: الـ webhook بتاع workflow "owner-dashboard"
    ENDPOINT: 'https://vmi3639126.contaboserver.net/webhook/owner-dashboard',

    // n8n: الـ webhook بتاع workflow "owner-billing" (تبويب الاشتراكات)
    BILLING_ENDPOINT: 'https://vmi3639126.contaboserver.net/webhook/owner-billing',

    // الأسعار اللي بتتكتب تلقائي في خانة المبلغ (تقدري تغيّري المبلغ وقت التفعيل لو فيه خصم)
    // لو عملتي سعر مخفّض للـ 6 شهور أو السنة غيّريه هنا
    PLANS: {
        starter: { name: 'البداية', students: 10, monthly: 99, semiannual: 594, annual: 1188 },
        pro: { name: 'الاحترافية', students: null, monthly: 150, semiannual: 900, annual: 1800 }
    },

    // طرق الدفع اللي بتظهر في القايمة
    PAY_METHODS: ['فودافون كاش', 'إنستاباي', 'تحويل بنكي', 'كاش', 'أورانج كاش', 'اتصالات كاش', 'تاني'],

    // رابط البرنامج نفسه (للزرار "افتح البرنامج")
    APP_URL: 'https://teachers-manager.online',

    // تحديث تلقائي للبث المباشر (بالثواني)
    LIVE_REFRESH_SECONDS: 30,

    // ================= الهدف (تبويب 🎯 الهدف والشريط اللي فوق) =================
    // كل الأرقام دي تقدري تغيّريها من هنا من غير ما تلمسي الكود
    GOAL: {
        paid: 100,                    // عدد المدرسين اللي دفعوا فعلًا
        paidDeadline: '2027-01-31',   // آخر يوم للهدف
        activeDeadline: '2026-12-31', // آخر يوم في الفترة المجانية: لازم يكون عندنا فعّالين كفاية قبله
        weeklySignups: 65,            // المطلوب من التسجيلات الجديدة كل أسبوع
        conversion: 0.4,              // افتراض: كام من الفعّالين هيدفعوا (0.4 = 40%). عدّليه لما يبان الرقم الحقيقي
        fallbackActivation: 0.2,      // نسبة تفعيل افتراضية لو لسه مفيش بيانات كفاية
        // تعريف "المدرس الفعّال" (المرشح للدفع)
        active: { minStudents: 3, minLessons30d: 2, minActiveDays30d: 3 },
        // الخطة أسبوع بأسبوع: [التاريخ، الرقم المطلوب في اليوم ده]
        milestones: {
            active: [['2026-11-01', 20], ['2026-11-07', 40], ['2026-11-14', 70], ['2026-11-21', 100], ['2026-11-28', 130],
                     ['2026-12-05', 165], ['2026-12-12', 200], ['2026-12-19', 240], ['2026-12-26', 275], ['2026-12-31', 300]],
            paid: [['2026-12-15', 0], ['2026-12-31', 30], ['2027-01-15', 70], ['2027-01-31', 100]]
        }
    }
};
