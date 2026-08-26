function isEmail(str) {
    return typeof str === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function isDate(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const d = new Date(str + 'T00:00:00');
    return !isNaN(d.getTime());
}

function isTime(str) {
    return typeof str === 'string' && /^\d{2}:\d{2}$/.test(str);
}

function isIn(str, allowed) {
    return allowed.includes(str);
}

function isInt(val, min = -Infinity, max = Infinity) {
    const n = Number(val);
    return Number.isInteger(n) && n >= min && n <= max;
}

function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/<[^>]*>/g, '');
}

module.exports = { isEmail, isDate, isTime, isIn, isInt, sanitize };
