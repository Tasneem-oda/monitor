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
    LIVE_REFRESH_SECONDS: 30
};
