import { st } from "../styles";
import React from "react";
import { css } from "../css";
import { Btn, Card, Field, Note, Row, Select } from "../parts";
import type { Vals } from "../../vm/types";

const STATE: Record<string, string> = {
  ok: "background:var(--ok);color:var(--oktext)",
  missing: "background:var(--merr);color:var(--merrtext)",
  mismatch: "background:var(--mwarn);color:var(--mwarntext)",
};

export function MasterDns({ v }: { v: Vals }) {
  const T = v.T, c = v.dnsConfig;
  return (
    <>
      <Card title={T.alanAdiBaslik} note={T.alanAdiNot}>
        <div key={v.dnsKey} style={st.stack11}>
          <Row>
            <Field label={T.alanAdiEtiket} name="dDomain" value={c.domain} placeholder="dosya.sirket.com" onChange={v.onField} />
            <Field label={T.dnsBolgesi} name="dZone" value={c.zone} placeholder="sirket.com" onChange={v.onField} />
          </Row>
          <Row>
            <Field label={T.sunucuIpv4} name="dIpv4" value={c.ipv4} placeholder="203.0.113.10" onChange={v.onField} />
            <Field label={T.sunucuIpv6} name="dIpv6" value={c.ipv6} placeholder="2001:db8::10" onChange={v.onField} />
          </Row>
          <Row>
            <Select label={T.dnsSaglayici} name="dProvider" value={c.provider || "manual"} options={v.dnsProviders} onChange={v.onField} />
            <Field label={v.dnsHasToken ? T.apiBelirteciKayitli : T.apiBelirteci} name="dToken" type="password" onChange={v.onField} />
          </Row>
          <button onClick={v.dnsToggleAcme} style={css("display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;border:1px solid var(--mline2);background:var(--minput);border-radius:9px;cursor:pointer;text-align:left")}>
            <span style={css("flex:1;font-size:13px;font-weight:700;color:var(--mink)")}>{T.otomatikSertifika}</span>
            <span style={css(v.dnsAcmeTrack)}><span style={css(v.dnsAcmeKnob)}></span></span>
          </button>
          {v.dnsAcmeOn ? <Field label={T.sertifikaEposta} name="dAcmeEmail" value={c.acmeEmail} type="email" onChange={v.onField} /> : null}
        </div>
        <Row>
          <Btn kind="primary" onClick={v.dnsSave}>{T.kaydet}</Btn>
          <Btn onClick={v.dnsCheck} disabled={v.busy === "dns"}>{T.dnsDogrula}</Btn>
          {v.dnsCanPush ? <Btn onClick={v.dnsPush}>{T.saglayiciyaYaz}</Btn> : null}
        </Row>
      </Card>
      <Card title={T.dnsKayitlari} note={T.dnsKayitlariNot}>
        {v.noDnsChecks ? <div style={css("font-size:13px;color:var(--mmuted)")}>{T.dnsHenuzKontrolYok}</div> : null}
        {(v.dnsChecks || []).map((r: any) => (
          <div key={r.recordType + r.name} style={css("border:1px solid var(--mline);border-radius:10px;padding:10px 12px;background:var(--mcard2);display:flex;flex-direction:column;gap:5px")}>
            <div style={st.rowCenter8}>
              <span style={css("font-family:var(--mono);font-size:12px;font-weight:600;color:var(--mink)")}>{r.recordType}</span>
              <span style={css("flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--mtext);word-break:break-all")}>{r.name}</span>
              <span style={css("flex:none;font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;" + STATE[r.state])}>{r.stateLabel}</span>
            </div>
            <div style={css("font-family:var(--mono);font-size:12px;color:var(--mmuted);word-break:break-all")}>{r.expected}</div>
            <div style={css("font-size:12px;color:var(--mmuted);line-height:1.5")}>{r.purpose}</div>
            {r.found.length && r.state !== "ok" ? <div style={css("font-size:12px;color:var(--mwarntext);word-break:break-all")}>{T.bulunan}: {r.found.join(", ")}</div> : null}
          </div>
        ))}
      </Card>
    </>
  );
}
