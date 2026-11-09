import { EN } from "./strings";

let lang: "tr" | "en" = "tr";

export function setLang(value: string) {
  lang = value === "en" ? "en" : "tr";
}

export const tx = (s: string): string => (lang === "en" && EN[s] !== undefined ? EN[s] : s);
export const LOC = () => (lang === "en" ? "en-GB" : "tr-TR");
