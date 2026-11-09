/**
 * Gizli çerçevede yazdırma. Yeni pencereye satır içi betik yazmak CSP ile engellenir;
 * bu yüzden hazırlık üst pencereden yapılır.
 */
export function printFrame(html: string, prepare?: (doc: Document) => void) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
  frame.srcdoc = html;
  frame.onload = () => {
    const win = frame.contentWindow!;
    if (prepare) prepare(frame.contentDocument!);
    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(() => frame.remove(), 60000);
    }, 350);
  };
  document.body.appendChild(frame);
}

/** Üst ve alt bilgi yüksekliğini her sayfaya yansıtır. */
export function alignPrintBands(doc: Document) {
  const header = doc.getElementById("H");
  const footer = doc.getElementById("F");
  const top = header ? header.offsetHeight + 10 : 0;
  const bottom = footer ? footer.offsetHeight + 10 : 0;
  doc.querySelectorAll<HTMLElement>(".sh").forEach((e) => (e.style.height = top + "px"));
  doc.querySelectorAll<HTMLElement>(".sf").forEach((e) => (e.style.height = bottom + "px"));
}
