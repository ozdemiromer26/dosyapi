import { css } from "../css";
import { Btn, Card, Field, Note, Row, Select } from "../parts";
import type { Vals } from "../../vm/types";

export function MasterSystem({ v }: { v: Vals }) {
  const T = v.T, u = v.updateInfo;
  return (
    <>
      <Card title={T.guncellemeBaslik} note={T.guncellemeNot}>
        <Row>
          <div style={css("flex:1;min-width:130px;background:var(--minput);border:1px solid var(--mline);border-radius:8px;padding:9px 11px")}>
            <div style={css("font-size:11px;color:var(--mmuted);font-weight:700")}>{T.surum}</div>
            <div style={css("font-size:14px;color:var(--mink);font-weight:800")}>{v.sysVersion}</div>
          </div>
          <Select label={T.guncellemeKanali} name="sChannel" value={v.sysChannel} options={v.channelOptions} onChange={v.onChannel} />
        </Row>
        <Row>
          <Btn onClick={v.checkUpdate} disabled={v.busy === "update"}>{T.guncellemeDenetle}</Btn>
        </Row>
        {u && !u.available ? <Note tone="ok">{T.sistemGuncel} ({u.current})</Note> : null}
        {u && u.available ? (
          <>
            <Note tone={u.blockedReason ? "warn" : "info"}>
              {T.yeniSurum}: {u.latest}{u.releasedAt ? " · " + u.releasedAt : ""}
              {u.notes ? <div style={css("font-weight:600;margin-top:4px;white-space:pre-wrap")}>{u.notes}</div> : null}
              {u.blockedReason ? <div style={css("margin-top:4px")}>{u.blockedReason}</div> : null}
              {!u.installerSupported ? <div style={css("margin-top:4px")}>{T.elleGuncelleme}</div> : null}
            </Note>
            {!u.blockedReason && u.installerSupported ? (
              <Row>
                <Field label={T.masterSifre} name="uPass" type="password" onChange={v.onField} />
                <Btn kind="primary" onClick={v.applyUpdate} disabled={v.busy === "apply"}>{T.guncellemeyiKur}</Btn>
              </Row>
            ) : null}
          </>
        ) : null}
        {v.updateStatus ? <Note tone={v.updateStatus.state === "done" ? "ok" : v.updateStatus.state === "installing" ? "info" : "err"}>{v.updateStatus.message}</Note> : null}
      </Card>

      <Card title={T.yedekler} note={T.yedeklerNot}>
        <Row><Btn onClick={v.createBackup}>{T.yedekAl}</Btn></Row>
        {(v.backupRows || []).map((b: any) => (
          <div key={b.name} style={css("display:flex;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid var(--mline);border-radius:10px;padding:9px 12px;background:var(--mcard2)")}>
            <span style={css("flex:1;min-width:180px;font-family:var(--mono);font-size:12px;color:var(--mtext);word-break:break-all")}>{b.name}</span>
            <span style={css("font-size:12px;color:var(--mmuted);font-weight:600")}>{b.meta}</span>
          </div>
        ))}
        {v.noBackups ? <div style={css("font-size:13px;color:var(--mmuted)")}>{T.yedekYok}</div> : null}
      </Card>

      <Card title={T.fabrikaAyarlarinaDon} note={T.fabrikaNot}>
        <Row>
          <Field label={T.masterSifre} name="frPass" type="password" onChange={v.onField} />
          <Field label={T.fabrikaOnay} name="frConfirm" onChange={v.onField} />
        </Row>
        <Row><Btn kind="danger" onClick={v.factoryReset}>{T.fabrikaAyarlarinaDon}</Btn></Row>
      </Card>
    </>
  );
}
