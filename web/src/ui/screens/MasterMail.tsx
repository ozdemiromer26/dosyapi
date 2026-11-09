import { st } from "../styles";
import React from "react";
import { Btn, Card, Field, Row, Select } from "../parts";
import type { Vals } from "../../vm/types";

export function MasterMail({ v }: { v: Vals }) {
  const T = v.T, c = v.smtp;
  return (
    <Card title={T.epostaSunucusu} note={T.epostaSunucusuNot}>
      <div key={v.smtpKey} style={st.stack11}>
        <Row>
          <Field label={T.smtpSunucu} name="mhHost" value={c.host} placeholder="smtp.sirket.com" onChange={v.onField} />
          <Field label={T.smtpPort} name="mhPort" type="number" value={c.port} onChange={v.onField} />
        </Row>
        <Row>
          <Field label={T.smtpKullanici} name="mhUser" value={c.username} onChange={v.onField} />
          <Field label={c.hasPassword ? T.smtpSifreKayitli : T.smtpSifre} name="mhPass" type="password" onChange={v.onField} />
        </Row>
        <Row>
          <Field label={T.smtpGonderen} name="mhFrom" type="email" value={c.from} placeholder="bildirim@sirket.com" onChange={v.onField} />
          <Select label={T.smtpBaglanti} name="mhTls" value={c.tls} options={[{ id: "starttls", label: "STARTTLS (587)" }, { id: "tls", label: "TLS (465)" }]} onChange={v.onField} />
        </Row>
      </div>
      <Row>
        <Btn kind="primary" onClick={v.smtpSave}>{T.kaydet}</Btn>
        <Field label={T.testAlicisi} name="mhTest" type="email" onChange={v.onField} />
        <Btn onClick={v.smtpTest}>{T.testGonder}</Btn>
      </Row>
    </Card>
  );
}
