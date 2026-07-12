
// ---------------------------
//            calc
// ---------------------------

export function xor(a,b) {
  if ( a&&!b || (!a)&&b ) return true;
  return false;
}

export function xnor(a,b) {
  if ( a&&b || (!a)&&(!b) ) return true;
  return false;
}

export function clamp(num, min, max) {
  return Math.min(Math.max(min, num), max);
}

/**
 * 小数点第n位で四捨五入する関数
 * @param {number} num 元の数値
 * @param {int} digit 四捨五入する桁数
 * @returns {number}
 */
export function floatRound(num, digit=0) {
  const levarage = Math.pow(10,digit);
  return Math.round(num*levarage)/levarage;
}

export function rgb2hex (rgb) {
  if (!rgb)  return undefined;
  if (!/\d+\D+\d+\D+\d/.test(rgb)) return undefined;
  return '#' + rgb.match(/\d+/g).map(x => Number(x).toString(16).padStart(2,'0')).join('');
}

export function applyAdjustment(val, adjustment) {
  if (!adjustment) return val;
  if (!isNaN(parseFloat(adjustment))) return val + parseFloat(adjustment);
  if (/^[*×][\d\.\-]+$/.test(adjustment)) {
    const magnification = parseFloat(adjustment.substring(1));
    // const magnification = parseFloat(adjustment.match(/^[*×]([\d\.\-]+)$/)[1]);
    return val * magnification;
  }
  if (/^[\/÷][\d\.\-]+$/.test(adjustment)) {
    const magnification = parseFloat(adjustment.substring(1));
    // const magnification = parseFloat(adjustment.match(/^[\/÷]([\d\.\-]+)$/)[1]);
    return val / magnification;
  }
  console.log('adjustment text is out of format.');
  return val;
}
