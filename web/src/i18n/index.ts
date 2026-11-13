import { EN } from "./strings";

let lang: "tr" | "en" = "tr";

export function setLang(value: string) {
  lang = value === "en" ? "en" : "tr";
}

/** Sunucudan gelen, içinde süre geçen iletiler: birebir tabloyla değil kalıpla çevrilir. */
const unit = (n: string, u: string) => n + " " + (u === "saat" ? (n === "1" ? "hour" : "hours") : (n === "1" ? "minute" : "minutes"));
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Master şifre hatalı\. (\d+) deneme hakkınız kaldı\.$/, (m) => "Wrong master password. " + m[1] + (m[1] === "1" ? " attempt" : " attempts") + " left."],
  [/^Yedekte (\d+) dosya eksik\.$/, (m) => m[1] + (m[1] === "1" ? " file is" : " files are") + " missing from the backup."],
  [/^Art arda hatalı şifre girildiği için hesabınız kilitlendi\. Kalan süre: (\d+) (dakika|saat)\.$/, (m) => "Your account is locked after repeated wrong passwords. Time left: " + unit(m[1], m[2]) + "."],
  [/^Hesabınız sistem yöneticisi tarafından kilitlendi\. Kalan süre: (\d+) (dakika|saat)\.$/, (m) => "Your account was locked by the system administrator. Time left: " + unit(m[1], m[2]) + "."],
];

export const tx = (s: string): string => {
  if (lang !== "en") return s;
  if (EN[s] !== undefined) return EN[s];
  for (const [re, f] of PATTERNS) { const m = s.match(re); if (m) return f(m); }
  return s;
};
export const LOC = () => (lang === "en" ? "en-GB" : "tr-TR");
