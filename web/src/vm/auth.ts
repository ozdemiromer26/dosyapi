// Görünüm modeli: auth
import type { Ctx, Vals } from "./types";
import { tx } from "../i18n";
/*IMPORTS*/

export function buildAuth(c: Ctx): () => Vals {
  const app = c.app;
  /*TOP*/

  return () => {
    const { s, tabStyle } = c; /*LATE*/
    return {
      pPri: s.palette.pri, pAcc: s.palette.acc,
      isAuth: s.mode === "auth", isMaster: s.mode === "master", isApp: s.mode === "app",
      isLogin: s.authMode === "login", isRegister: s.authMode === "register",
      authError: s.authError, authInfo: s.authInfo,
      loginTabStyle: tabStyle(s.authMode !== "register"), registerTabStyle: tabStyle(s.authMode === "register"),
      showLogin: () => { app.fd = {}; app.setState({ authMode: "login", authError: "", authInfo: "", mailPreview: null, resetTok: null }); },
      onEnterSubmit: (e) => {
        if (e.key !== "Enter" || e.shiftKey || (e.target && e.target.tagName === "TEXTAREA")) return;
        const box = e.currentTarget, b = box && box.querySelector("[data-submit]");
        if (b) { e.preventDefault(); b.click(); }
      },
      isForgot: s.authMode === "forgot", isReset: s.authMode === "reset",
      showForgot: () => { app.fd = {}; app.setState({ authMode: "forgot", authError: "", authInfo: "", mailPreview: null }); },
      sendForgot: () => app.forgot(),
      resetForLabel: tx("Yeni şifrenizi belirleyin."),
      doResetPass: () => app.resetPassword(),
      showRegister: () => { app.fd = {}; app.setState({ authMode: "register", authError: "", authInfo: "" }); },
      onField: (e) => { app.fd[e.target.name] = e.target.value; },
      onSearch: (e) => app.setState({ q: e.target.value }),
      onProjFilter: (e) => app.setState({ projFilter: e.target.value, selAuthors: [] }),

      doLogin: () => app.login(),
      doRegister: () => app.register(),
      logout: () => app.logout(),

    };
  };
}
