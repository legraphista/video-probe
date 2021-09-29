import {pad} from "highcharts";

export const Bits = 1;
export const KBits = 2 ** 10;
export const MBits = 2 ** 20;
export const GBits = 2 ** 30;

export function bitsToString(value: number): string {
  if (value > GBits) {
    return (value / GBits).toFixed(2) + " GBit/s";
  } else if (value > MBits) {
    return (value / MBits).toFixed(2) + " MBit/s";
  } else if (value > KBits) {
    return (value / KBits).toFixed(2) + " KBit/s";
  } else {
    return (value) + " Bit/s";
  }
}

export const second = 1;
export const minute = second * 60;
export const hour = minute * 60;
export const day = hour * 24;

export function secondsToTime(value: number): string {
  const seconds = value % 60;
  const minutes = Math.floor(value / minute) % 60;
  const hours = Math.floor(value / hour) % 24;
  const days = Math.floor(value / day);

  return [
    days ? `${days}s ` : '',
    hours ? `${pad(hours, 2, '0')}:` : '',
    `${pad(minutes, 2, '0')}:`,
    `${pad(seconds, 2, '0')}`
  ].join('');
}
