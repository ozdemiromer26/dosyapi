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
        <Row>
          <Btn kind="primary" onClick={v.createBackup} disabled={v.backupBusy}>{v.backupBusy ? T.yedekAliniyor : T.yedekAl}</Btn>
        </Row>

        <div style={css("display:flex;flex-direction:column;gap:9px;border:1px solid var(--mline);border-radius:12px;padding:12px;background:var(--mcard2)")}>
          <button onClick={v.onSchedToggle} style={css("display:flex;align-items:center;gap:10px;height:40px;padding:0;border:none;background:transparent;text-align:left;cursor:pointer")}>
            <span style={css("flex:1;font-size:13px;font-weight:700;color:var(--mink)")}>{T.otomatikYedek}</span>
            <span style={css(v.schedTrack)}><span style={css(v.schedKnob)}></span></span>
          </button>
          {v.schedOn ? (
            <Row key={v.schedKey}>
              <Select label={T.yedekSikligi} name="bkEvery" value={v.schedEvery} options={v.schedEveryOptions} onChange={v.onSchedEvery} />
              <Select label={T.saklanacakYedek} name="bkKeep" value={v.schedKeep} options={v.schedKeepOptions} onChange={v.onSchedKeep} />
            </Row>
          ) : null}
          <div style={css("font-size:12px;color:var(--mmuted);line-height:1.55")}>{T.otomatikYedekNot}</div>
        </div>

        {(v.backupRows || []).map((b: any) => (
          <div key={b.name} style={css("display:flex;flex-direction:column;gap:8px;border:1px solid var(--mline);border-radius:10px;padding:10px 12px;background:var(--mcard2)")}>
            <div style={css("display:flex;gap:10px;align-items:center;flex-wrap:wrap")}>
              <div style={css("flex:1;min-width:200px;display:flex;flex-direction:column;gap:3px")}>
                <span style={css("font-family:var(--mono);font-size:12px;color:var(--mtext);word-break:break-all")}>{b.name}</span>
                <span style={css("font-size:12px;color:var(--mmuted);font-weight:600")}>{b.labelText} · {b.meta}</span>
              </div>
              <div style={css("display:flex;gap:8px;flex-wrap:wrap")}>
              <a href={b.href} download={b.name} style={css("height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--mline2);background:var(--mbtn);color:var(--mtext);font-size:12px;font-weight:700;display:inline-flex;align-items:center;text-decoration:none")}>{T.yedekIndir}</a>
              <button onClick={b.onVerify} disabled={b.verifying} style={css("height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--mline2);background:var(--mbtn);color:var(--mtext);font-size:12px;font-weight:700;cursor:pointer" + (b.verifying ? ";opacity:.6" : ""))}>{b.verifyLabel}</button>
              <button onClick={b.onDelete} style={css("height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--merrline);background:var(--merr);color:var(--merrtext);font-size:12px;font-weight:700;cursor:pointer")}>{b.delLabel}</button>
              </div>
            </div>
            {b.foreign ? <Note tone="warn">{b.foreignText}</Note> : null}
            {b.hasCheck ? <Note tone={b.checkTone}>{b.checkText}</Note> : null}
          </div>
        ))}
        {v.noBackups ? <div style={css("font-size:13px;color:var(--mmuted)")}>{T.yedekYok}</div> : null}

        <div style={css("display:flex;flex-direction:column;gap:9px;border-top:1px solid var(--mline);padding-top:12px")}>
          <div style={css("font-size:13px;font-weight:800;color:var(--mink)")}>{T.anahtarDosyasi}</div>
          <div style={css("font-size:12px;color:var(--mmuted);line-height:1.55")}>{T.anahtarDosyasiNot}</div>
          <Row>
            <Field label={T.masterSifre} name="bkPass" type="password" onChange={v.onField} />
            <Btn onClick={v.downloadKey}>{T.anahtariIndir}</Btn>
          </Row>
        </div>
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
