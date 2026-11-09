"""Test istemcisi: çerez ve CSRF başlığını yöneten küçük HTTP sarmalayıcı (yalnızca standart kütüphane)."""
import http.client
import json
import urllib.parse


class Response:
    def __init__(self, status, headers, body):
        self.status, self.headers, self.body = status, headers, body

    def header(self, name):
        return self.headers.get(name.lower())

    def json(self):
        try:
            return json.loads(self.body.decode("utf-8"))
        except ValueError:
            return None

    @property
    def text(self):
        return self.body.decode("utf-8", "replace")


class Client:
    def __init__(self, host="127.0.0.1", port=8080):
        self.host, self.port = host, port
        self.cookies, self.csrf = {}, ""

    def request(self, method, path, body=None, headers=None, raw=None, csrf=True):
        conn = http.client.HTTPConnection(self.host, self.port, timeout=60)
        h = dict(headers or {})
        if self.cookies and "Cookie" not in h:
            h["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.cookies.items())
        if csrf and self.csrf and method not in ("GET", "HEAD"):
            h.setdefault("X-CSRF-Token", self.csrf)
        payload = raw
        if body is not None:
            payload = json.dumps(body)
            h.setdefault("Content-Type", "application/json")
        conn.request(method, path, payload, h)
        res = conn.getresponse()
        data = res.read()
        out = {}
        for k, v in res.getheaders():
            k = k.lower()
            out[k] = (out[k] + "\n" + v) if k in out else v
            if k == "set-cookie":
                name, _, value = v.split(";")[0].partition("=")
                if value:
                    self.cookies[name] = value
                else:
                    self.cookies.pop(name, None)
        conn.close()
        return Response(res.status, out, data)

    def get(self, path, **kw):
        return self.request("GET", "/api/v1" + path, **kw)

    def post(self, path, body=None, **kw):
        return self.request("POST", "/api/v1" + path, body if body is not None else {}, **kw)

    def put(self, path, body=None, **kw):
        return self.request("PUT", "/api/v1" + path, body if body is not None else {}, **kw)

    def delete(self, path, **kw):
        return self.request("DELETE", "/api/v1" + path, **kw)

    def login(self, email, password):
        r = self.post("/auth/login", {"email": email, "password": password})
        assert r.status == 200, (r.status, r.text)
        self.refresh()
        return self

    def refresh(self):
        boot = self.get("/bootstrap").json()
        self.csrf = boot["csrf"]
        return boot

    def master_login(self, password):
        r = self.post("/master/login", {"password": password})
        assert r.status == 200, (r.status, r.text)
        self.csrf = self.get("/master/state").json()["csrf"]
        return self


def q(value):
    return urllib.parse.quote(value, safe="")
