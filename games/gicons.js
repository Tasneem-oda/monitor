/**
 * games/gicons.js — v34: أيقونات ألعاب الحصة (مرسومة مخصوص للبرنامج بدل إيموجي الكيبورد)
 *
 * gi(name)                  ← أيقونة "بلاطة" ملوّنة (تدرّج لكل لعبة + رسمة بيضا)
 * gi(name, { tile: false }) ← الرسمة لوحدها بلون النص (للأزرار جوه اللعبة)
 */

const G = {
    // ---------------------------------------------------------------- قوالب الألعاب
    quiz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.4"/><circle cx="12" cy="16.9" r=".9" fill="currentColor" stroke="none"/>',
    truefalse: '<path d="M3.5 12.5l2.8 2.8 4.7-5.8"/><path d="M14.5 9.5l5 5M19.5 9.5l-5 5"/><path d="M12 4v16" opacity=".45"/>',
    match: '<circle cx="5.5" cy="6.5" r="2.4"/><circle cx="18.5" cy="17.5" r="2.4"/><circle cx="18.5" cy="6.5" r="2.4" opacity=".5"/><circle cx="5.5" cy="17.5" r="2.4" opacity=".5"/><path d="M7.7 7.6l8.6 8.8"/>',
    order: '<rect x="3" y="14" width="5" height="6.5" rx="1.2"/><rect x="9.5" y="9.5" width="5" height="11" rx="1.2"/><rect x="16" y="4.5" width="5" height="16" rx="1.2"/>',
    sort: '<path d="M3.5 11h7.5l-1 8.5H4.5z"/><path d="M13 11h7.5l-1 8.5h-5.5z"/><path d="M7.2 3.5v4.2M5.3 5.9l1.9 1.9 1.9-1.9M16.8 3.5v4.2M14.9 5.9l1.9 1.9 1.9-1.9"/>',
    memory: '<rect x="3" y="6.5" width="9.5" height="13" rx="2"/><rect x="11.5" y="4" width="9.5" height="13" rx="2" fill="currentColor" fill-opacity=".18"/><path d="M16.25 8.2v4.6M13.95 10.5h4.6"/>',
    fill: '<path d="M3.5 6.5h17M3.5 12h4.5M16 12h4.5M3.5 17.5h11"/><rect x="9.3" y="9.8" width="5.4" height="4.4" rx="1.1" stroke-dasharray="2 1.6"/>',
    flash: '<rect x="5" y="3.5" width="14" height="17" rx="2.2"/><path d="M8.8 10a3.3 3.3 0 0 1 5.9-1.6M15.2 14a3.3 3.3 0 0 1-5.9 1.6"/><path d="M14.9 6.2v2.3h-2.3M9.1 17.8v-2.3h2.3"/>',
    letters: '<rect x="2.5" y="6.5" width="9" height="11" rx="2"/><rect x="12.5" y="6.5" width="9" height="11" rx="2"/><text x="7" y="15.4" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" stroke="none" font-family="Tahoma,Arial">ب</text><text x="17" y="15.4" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" stroke="none" font-family="Tahoma,Arial">أ</text>',
    wheel: '<circle cx="12" cy="13" r="8"/><path d="M12 5v16M4 13h16M6.35 7.35l11.3 11.3M17.65 7.35 6.35 18.65" opacity=".7"/><circle cx="12" cy="13" r="1.8" fill="currentColor"/><path d="M10 1.8h4L12 4.6z" fill="currentColor"/>',
    // ---------------------------------------------------------------- ألعاب القرآن
    complete: '<path d="M3.5 19.5h7"/><path d="M14.4 4.6l4.9 4.9-8.6 8.6H5.8v-4.9z"/><path d="M12.5 6.5l4.9 4.9"/>',
    recite: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.8 21h6.4"/>',
    words: '<rect x="2.5" y="3.5" width="9" height="5" rx="1.6"/><rect x="12.5" y="9.5" width="9" height="5" rx="1.6"/><rect x="5" y="15.5" width="9.5" height="5" rx="1.6"/><path d="M14 6h4.5l-1.2-1.2M18.5 6l-1.2 1.2" opacity=".7"/>',
    ayahs: '<circle cx="5.5" cy="6.5" r="2"/><circle cx="5.5" cy="12" r="2"/><circle cx="5.5" cy="17.5" r="2"/><path d="M10 6.5h10.5M10 12h10.5M10 17.5h7"/>',
    next: '<path d="M19.5 12h-14M11 5.5 4.5 12l6.5 6.5"/><path d="M20.5 6v12" opacity=".5"/>',
    halves: '<rect x="2.5" y="7.5" width="7.5" height="9" rx="1.8"/><rect x="14" y="7.5" width="7.5" height="9" rx="1.8"/><path d="M10 12h4"/><circle cx="10" cy="12" r="1" fill="currentColor"/><circle cx="14" cy="12" r="1" fill="currentColor"/>',
    cards: '<rect x="6.5" y="3" width="12" height="15.5" rx="2" fill="currentColor" fill-opacity=".18"/><rect x="4" y="5.5" width="12" height="15.5" rx="2"/><path d="M7 10h6M7 13.5h6M7 17h3.5"/>',
    surahs: '<path d="M3 20.5h18"/><rect x="4" y="5" width="3.5" height="15.5" rx=".8"/><rect x="8.5" y="7.5" width="3.5" height="13" rx=".8"/><path d="M13.6 8.3l3.3-.9 3.4 12.6-3.3.9z"/>',
    // ---------------------------------------------------------------- أزرار وحالات
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    teams: '<circle cx="8.5" cy="8" r="3.2"/><path d="M2.8 19.5a5.7 5.7 0 0 1 11.4 0"/><circle cx="16.8" cy="9" r="2.6"/><path d="M15.6 14.3a4.8 4.8 0 0 1 5.9 4.7"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.2 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" fill="currentColor"/>',
    starEmpty: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/>',
    trophy: '<path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 14v3.5M8.5 20.5h7M9.5 17.5h5"/>',
    replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4.3h4.3"/>',
    shuffle: '<path d="M3.5 7h3.2c4.6 0 5.6 10 10.6 10h3.2M3.5 17h3.2c1.6 0 2.7-1.2 3.6-2.8M14.5 9.2c.8-1.3 1.8-2.2 2.8-2.2h3.2"/><path d="M18.2 4.6 20.5 7l-2.3 2.4M18.2 14.6l2.3 2.4-2.3 2.4"/>',
    hint: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.5.9 1.2.9 2v1.5h5V16c0-.8.3-1.5.9-2A5.8 5.8 0 0 0 12 3.5z"/>',
    play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    edit: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
    check: '<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>',
    cross: '<path d="M6 6l12 12M18 6 6 18"/>',
    quran: '<path d="M12 6.5c-2-1.6-4.8-2-8-1.6v13.6c3.2-.4 6 0 8 1.6 2-1.6 4.8-2 8-1.6V4.9c-3.2-.4-6 0-8 1.6z"/><path d="M12 6.5v13.6"/><path d="M15.5 9.8l.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2z" fill="currentColor" stroke="none"/>',
    gift: '<rect x="3.5" y="9" width="17" height="4" rx="1"/><path d="M5 13v7.5h14V13M12 9v11.5"/><path d="M12 9c-1.5-3.5-5.5-4.3-5.5-1.6C6.5 9 9.5 9 12 9zM12 9c1.5-3.5 5.5-4.3 5.5-1.6C17.5 9 14.5 9 12 9z"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>',
    gamepad: '<path d="M7 7.5h10a4.5 4.5 0 0 1 4.4 5.4l-.9 4.4a2.4 2.4 0 0 1-4.1 1.2L14 16h-4l-2.4 2.5a2.4 2.4 0 0 1-4.1-1.2l-.9-4.4A4.5 4.5 0 0 1 7 7.5z"/><path d="M8 10.5v3M6.5 12h3"/><circle cx="15.5" cy="11" r=".9" fill="currentColor"/><circle cx="17.3" cy="13" r=".9" fill="currentColor"/>',
    books: '<path d="M4 19.5V5.5a1.5 1.5 0 0 1 1.5-1.5H9v15.5zM9 19.5V7h4.5v12.5zM14.6 7.7l3.5-1 3.4 12.4-3.5 1z"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5z"/>',
    sparkle: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" fill="currentColor"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="currentColor"/>',
    oops: '<circle cx="12" cy="12" r="8.5"/><path d="M8.6 9.4h.01M15.4 9.4h.01"/><path d="M8.5 16c1-1.1 2.2-1.6 3.5-1.6s2.5.5 3.5 1.6"/>',
    handshake: '<path d="M2.5 11.5l3-3 4 1.5 2.5-2 3.5 1 3-1.5 3 3"/><path d="M5.5 8.5l-1 7 4.5 4 2-1.5 2 1.5 4.5-4-1-7"/>',
    arrowNext: '<path d="M19 12H5M11 6l-6 6 6 6"/>'
};

// لون كل لعبة (تدرّج) — متناسق مع ألوان البرنامج
const C = {
    quiz: ['#6D4AA8', '#9B7BD1'], truefalse: ['#1F8A5B', '#3CC08A'], match: ['#1F6FB5', '#4FA3E8'], order: ['#C46A1A', '#F0A04B'],
    sort: ['#0F7C78', '#36B3AC'], memory: ['#B23A67', '#E66F98'], fill: ['#8C6A12', '#D4A62A'], flash: ['#3B4A9C', '#6E7FD6'],
    letters: ['#A33B2B', '#E0705E'], wheel: ['#8A3FA0', '#C977DE'],
    complete: ['#1F6B4F', '#3E9A73'], recite: ['#0F6E6A', '#2FA79F'], words: ['#5B3F7A', '#8C6FA3'], ayahs: ['#8C6A12', '#D4A62A'],
    next: ['#1F5AA6', '#4C8BD9'], halves: ['#B5651D', '#E08E3C'], cards: ['#3B4A9C', '#6E7FD6'], surahs: ['#6B3A2A', '#A8674F'],
    quran: ['#1F6B4F', '#3E9A73'], gift: ['#B23A67', '#E66F98'], dice: ['#5B3F7A', '#8C6FA3'], gamepad: ['#5B3F7A', '#8C6FA3'],
    star: ['#C79A1E', '#F2C14E'], trophy: ['#C79A1E', '#F2C14E'], books: ['#6B3A2A', '#A8674F'], globe: ['#1F5AA6', '#4C8BD9']
};

let uid = 0;
export function gi(name, { size = 40, tile = true, title = '', cls = '' } = {}) {
    const g = G[name] || G.gamepad;
    const lab = title ? ` role="img" aria-label="${title}"` : ' aria-hidden="true"';
    if (!tile) {
        return `<svg class="gi ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${lab}>${g}</svg>`;
    }
    const [a, b] = C[name] || C.gamepad;
    const id = `gig${++uid}`;
    return `<svg class="gi gi-tile ${cls}" width="${size}" height="${size}" viewBox="0 0 40 40"${lab}>
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="40" height="40" rx="11" fill="url(#${id})"/><path d="M0 11a11 11 0 0 1 11-11h18a11 11 0 0 1 11 11v4C27 21 13 9 0 17z" fill="#fff" opacity=".12"/>
<g transform="translate(8 8)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" color="#fff">${g}</g></svg>`;
}
export const hasGi = (name) => !!G[name];
