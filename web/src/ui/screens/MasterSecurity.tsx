import { st } from "../styles";
import { css } from "../css";
import { Btn, Card, Field, Note, Row } from "../parts";
import type { Vals } from "../../vm/types";
import { qrSrc } from "./ProfileSecurity";

export function MasterSecurity({ v }: { v: Vals }) {
  const T = v.T, setup = v.masterTotpSetup;
  return (
    <>
      <Card title={T.masterSifre2}>
        <div key={v.masterPassKey} style={st.stack11}>
          <Field label={T.mevcutMasterSifre} name="mOld" type="password" onChange={v.onField} />
          <Field label={T.yeniMasterSifreEn} name="mNew" type="password" onChange={v.onField} />
          <Field label={T.yeniSifreOnayi} name="mNew2" type="password" onChange={v.onField} />
        </div>
        <Row><Btn onClick={v.saveMasterPass}>{T.sifreyiGuncelle}</Btn></Row>
      </Card>

      <Card title={T.ikiAdim} note={T.ikiAdimNot}>
        {v.masterTotpOn ? (
          <>
            <Note tone="ok">{T.ikiAdimAcik}</Note>
            <Row>
              <Field label={T.masterSifre} name="mtPass" type="password" onChange={v.onField} />
              <Btn onClick={v.masterTotpDisable}>{T.ikiAdimKapat}</Btn>
            </Row>
          </>
        ) : setup ? (
          <>
            <Note tone="info">
              {T.ikiAdimQr}
              {setup.qr ? <img src={qrSrc(setup.qr)} alt={T.ikiAdimQrAlt} width={196} height={196} style={css("display:block;margin-top:8px;width:196px;height:196px;background:#fff;border:1px solid var(--mline);border-radius:12px;padding:6px;box-sizing:border-box")} /> : null}
              <div style={css("margin-top:8px")}>{T.ikiAdimElle}</div>
              <div style={css("font-family:var(--mono);margin-top:4px;word-break:break-all;user-select:all")}>{setup.secret}</div>
            </Note>
            <Row>
              <Field label={T.dogrulamaKodu} name="mtCode" onChange={v.onField} />
              <Btn kind="primary" onClick={v.masterTotpConfirm}>{T.dogrula}</Btn>
              <Btn onClick={v.masterTotpCancel}>{T.vazgec}</Btn>
            </Row>
          </>
        ) : <Row><Btn onClick={v.masterTotpBegin}>{T.ikiAdimAc}</Btn></Row>}
      </Card>

      <Card title={T.denetimGunlugu} note={T.denetimNot}>
        <Row><Btn onClick={v.auditVerify}>{T.zinciriDogrula}</Btn></Row>
        {v.auditOk === true ? <Note tone="ok">{T.zincirSaglam}</Note> : null}
        {v.auditOk === false ? <Note tone="err">{T.zincirBozuk}</Note> : null}
        <div style={css("display:flex;flex-direction:column;gap:4px;max-height:420px;overflow:auto")}>
          {(v.auditRows || []).map((a: any) => (
            <div key={a.seq} style={css("display:grid;grid-template-columns:minmax(120px,auto) 1fr;gap:10px;padding:7px 9px;border-bottom:1px solid var(--mline);font-size:12px")}>
              <span style={css("font-family:var(--mono);color:var(--mmuted)")}>{a.when}</span>
              <span style={css("color:var(--mtext);font-weight:600;word-break:break-all")}>{a.action} <span style={css("color:var(--mmuted);font-weight:500")}>{a.actorKind}{a.ip ? " · " + a.ip : ""}</span></span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
