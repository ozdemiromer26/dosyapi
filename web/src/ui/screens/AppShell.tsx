import { st } from "../styles";
import React from "react";
import { css } from "../css";
import type { Vals } from "../../vm/types";
import { HomeScreen } from "./HomeScreen";
import { ProjectsScreen } from "./ProjectsScreen";
import { DetailScreen } from "./DetailScreen";
import { TasksScreen } from "./TasksScreen";
import { MessagesScreen } from "./MessagesScreen";
import { RecordsScreen } from "./RecordsScreen";
import { ApprovalsScreen } from "./ApprovalsScreen";
import { ProfileScreen } from "./ProfileScreen";
import { TemplatesScreen } from "./TemplatesScreen";
import { CompanyScreen } from "./CompanyScreen";
import { AboutCard } from "./MasterAbout";

/** Üst çubuğun gerçek yüksekliğini `--hdr-h` olarak yayınlar; yapışkan araç çubukları
 *  bu değerin hemen altına oturur. `data-stickbar` taşıyan öğe yapıştığında
 *  `data-stuck` alır ve köşe yuvarlaması kalkar; altından kayan içerik görünmez. */
function useStickyHeader(ref: React.RefObject<HTMLDivElement | null>) {
  React.useLayoutEffect(() => {
    const head = ref.current;
    if (!head) return;
    const root = document.documentElement;
    let hdr = 0;
    const mark = () => {
      document.querySelectorAll<HTMLElement>("[data-stickbar]").forEach((el) => {
        const top = el.getBoundingClientRect().top;
        const parentTop = el.parentElement ? el.parentElement.getBoundingClientRect().top : top;
        const stuck = top <= hdr + 0.5 && parentTop < top - 0.5;
        if (stuck) el.setAttribute("data-stuck", ""); else el.removeAttribute("data-stuck");
      });
    };
    const measure = () => {
      hdr = Math.round(head.getBoundingClientRect().height);
      root.style.setProperty("--hdr-h", hdr + "px");
      mark();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(head);
    document.addEventListener("scroll", mark, { capture: true, passive: true });
    window.addEventListener("resize", mark);
    return () => {
      ro.disconnect();
      document.removeEventListener("scroll", mark, { capture: true });
      window.removeEventListener("resize", mark);
    };
  }, [ref]);
}

export function AppShell({ v }: { v: Vals }) {
  const headRef = React.useRef<HTMLDivElement>(null);
  useStickyHeader(headRef);
  return (
    <>
    <div style={css(v.appShellStyle)}>

      {v.isDesktop ? (<>
        <div style={css("width:240px;flex:none;position:sticky;top:0;height:100vh;background:var(--card);border-right:1px solid var(--line);display:flex;flex-direction:column;gap:4px;padding:14px 12px")}>
          <div style={css("display:flex;align-items:center;gap:10px;padding:4px 6px 14px")}>
            {v.hasLogo ? (<>
              <img src={v.logoUrl} alt="Logo" style={css("width:34px;height:34px;border-radius:9px;object-fit:cover;flex:none")} />
            </>) : null}
            {v.noLogo ? (<>
              <div style={css("width:34px;height:34px;border-radius:9px;background:var(--pri,#2a3180);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex:none")}>{v.companyMonogram}</div>
            </>) : null}
            <div style={css("min-width:0")}>
              <div style={css("font-size:14px;font-weight:800;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.companyName}</div>
            </div>
          </div>
          {(v.navItems || []).map((n: any, i14: number) => (<React.Fragment key={n?.id ?? n?.key ?? i14}>
            <button onClick={n.onClick} style={css(n.sideStyle)}>
              {n.icon}
              <span>{n.label}</span>
              {n.hasBadge ? (<>
                <span style={css(n.badgeStyle)}>{n.badgeText}</span>
              </>) : null}
            </button>
          </React.Fragment>))}
          <div style={css("margin-top:auto;display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line2);padding-top:10px")}>
            <button onClick={v.logout} style={css("height:40px;border-radius:9px;border:1px solid var(--errline);background:var(--err);font-size:13px;font-weight:800;color:var(--errtext);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px")}>{v.logoutIcon}{v.T.cikis}</button>
            <div style={css("display:flex;align-items:center;gap:6px;padding:4px 4px 0")}>
              <span style={css("font-size:11px;font-weight:500;color:var(--faint)")}>powered by</span>
              {v.brandMarkXs}
              <span style={css("font-size:13px;font-weight:700;letter-spacing:-.3px;line-height:1;color:var(--logo-a)")}>dos<span style={css("color:var(--logo-b)")}>yapı</span></span>
            </div>
          </div>
        </div>
      </>) : null}

      <div style={css("flex:1;min-width:0;display:flex;flex-direction:column")}>
      <div ref={headRef} style={css("position:sticky;top:0;z-index:12;background:var(--card);border-bottom:1px solid var(--line)")}>
        <div style={css("max-width:1440px;margin:0 auto;padding:11px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
          {v.isMobile ? (<>
            {v.hasLogo ? (<>
              <img src={v.logoUrl} alt="Logo" style={css("width:34px;height:34px;border-radius:9px;object-fit:cover;flex:none")} />
            </>) : null}
            {v.noLogo ? (<>
              <div style={css("width:34px;height:34px;border-radius:9px;background:var(--pri,#2a3180);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex:none")}>{v.companyMonogram}</div>
            </>) : null}
          </>) : null}
          <div style={css("flex:1;min-width:110px")}>
            <div style={css("font-size:14px;font-weight:800;letter-spacing:-.2px")}>{v.screenTitle}</div>
            <div style={css("font-size:11px;color:var(--muted);font-weight:700")}>{v.companyName}</div>
          </div>
          <div style={css("position:relative;display:flex")}>
            {v.badgeCount ? (<>
              <button onClick={v.toggleNotif} style={css("height:36px;padding:0 11px;border-radius:9px;border:1px solid var(--line);background:var(--card);font-size:12px;font-weight:700;color:var(--brandink);cursor:pointer;white-space:nowrap")}>● {v.badgeCount} {v.T.yeniBildirim}</button>
            </>) : null}
            {v.notifOpen ? (<>
              <div style={css("position:absolute;top:42px;right:0;width:320px;max-width:86vw;background:var(--card);border:1px solid var(--line);border-radius:13px;box-shadow:0 14px 34px rgba(0,0,0,.16);padding:12px;display:flex;flex-direction:column;gap:10px;z-index:40;animation:popIn .16s ease")}>
                {v.hasNotifApprovals ? (<>
                  <div style={st.stack6}>
                    <div style={st.overline}>{v.T.bekleyenOnaylar}</div>
                    {(v.notifApprovals || []).map((n: any, i15: number) => (<React.Fragment key={n?.id ?? n?.key ?? i15}>
                      <button onClick={v.goApprovals} style={css("text-align:left;border:none;background:var(--soft2);border-radius:9px;padding:9px 10px;cursor:pointer;display:flex;flex-direction:column;gap:2px")}>
                        <span style={css("font-size:13px;font-weight:700;color:var(--ink)")}>{n.title}</span>
                        <span style={st.caption}>{n.meta}</span>
                      </button>
                    </React.Fragment>))}
                  </div>
                </>) : null}
                {v.hasNotifTasks ? (<>
                  <div style={st.stack6}>
                    <div style={st.overline}>{v.T.bekleyenGorevler}</div>
                    {(v.notifTasks || []).map((n: any, i16: number) => (<React.Fragment key={n?.id ?? n?.key ?? i16}>
                      <button onClick={v.goTasks} style={css("text-align:left;border:none;background:var(--soft2);border-radius:9px;padding:9px 10px;cursor:pointer;display:flex;flex-direction:column;gap:2px")}>
                        <span style={css("font-size:13px;font-weight:700;color:var(--ink)")}>{n.title}</span>
                        <span style={st.caption}>{n.meta}</span>
                      </button>
                    </React.Fragment>))}
                  </div>
                </>) : null}
                {v.hasNotifDocs ? (<>
                  <div style={st.stack6}>
                    <div style={st.overline}>{v.T.bekleyenBelgeler}</div>
                    {(v.notifDocs || []).map((n: any, i17: number) => (<React.Fragment key={n?.id ?? n?.key ?? i17}>
                      <button onClick={n.onOpen} style={css("text-align:left;border:none;background:var(--err);border-radius:9px;padding:9px 10px;cursor:pointer;display:flex;flex-direction:column;gap:2px")}>
                        <span style={css("font-size:13px;font-weight:700;color:var(--ink)")}>{n.title}</span>
                        <span style={css("font-size:11px;font-weight:600;color:var(--errtext)")}>{n.meta}</span>
                      </button>
                    </React.Fragment>))}
                  </div>
                </>) : null}
                <button onClick={v.closeNotif} style={css("height:36px;border:1px solid var(--line);background:var(--soft);border-radius:9px;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer")}>{v.T.kapat}</button>
              </div>
            </>) : null}
          </div>
          {v.isDesktop ? (<>
            <button onClick={v.toggleLang} aria-label={v.T.dil} style={css(v.langBtnStyle)}>{v.langLabel}</button>
            <button onClick={v.toggleTheme} aria-label={v.T.karanlikMod2} style={css(v.themeIconBtnStyle)}>{v.themeIcon}</button>
          </>) : null}
          {v.isDesktop ? (<>
          <div style={css("position:relative;display:flex")}>
            <button onClick={v.toggleProfileMenu} style={css("height:36px;padding:0 6px 0 10px;border-radius:9px;border:1px solid var(--line);background:var(--card);display:flex;align-items:center;gap:9px;cursor:pointer")}>
              <span style={css("text-align:right")}>
                <span style={css("display:block;font-size:12px;font-weight:800;color:var(--ink)")}>{v.meName}</span>
                <span style={css("display:block;font-size:11px;font-weight:700;color:var(--muted)")}>{v.meRoleLabel}</span>
              </span>
              <span style={css("width:26px;height:26px;border-radius:50%;background:var(--soft3);color:var(--brandink);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center")}>{v.meInitials}</span>
            </button>
            {v.profileMenuOpen ? (<>
              <div style={css("position:absolute;top:42px;right:0;width:270px;max-width:86vw;background:var(--card);border:1px solid var(--line);border-radius:13px;box-shadow:0 14px 34px rgba(0,0,0,.16);padding:13px;display:flex;flex-direction:column;gap:11px;z-index:45;animation:popIn .16s ease")}>
                <div style={css("display:flex;align-items:center;gap:11px")}>
                  <span style={css("width:40px;height:40px;flex:none;border-radius:50%;background:var(--soft3);color:var(--brandink);font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center")}>{v.meInitials}</span>
                  <div style={css("min-width:0")}>
                    <div style={css("font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.meName}</div>
                    <div style={css("font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{v.meEmail}</div>
                  </div>
                </div>
                <div style={css("display:flex;gap:7px;flex-wrap:wrap")}>
                  <span style={css("font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;background:var(--tint);color:var(--brandink)")}>{v.meRoleLabel} {v.T.k2}{v.meLevel}</span>
                  <span style={css("font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;background:var(--soft3);color:var(--muted)")}>{v.myOpenTaskLabel}</span>
                </div>
                <div style={css("display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--line2);padding-top:9px")}>
                  <button onClick={v.goProfile} style={css("height:40px;border:none;background:var(--soft2);border-radius:9px;font-size:13px;font-weight:700;color:var(--ink);cursor:pointer;text-align:left;padding:0 11px")}>{v.T.profilAyarlari}</button>
                  <button onClick={v.logout} style={css("height:40px;border:1px solid var(--errline);background:var(--err);border-radius:9px;font-size:13px;font-weight:800;color:var(--errtext);cursor:pointer;text-align:left;padding:0 11px;display:flex;align-items:center;gap:8px")}>{v.logoutIcon}{v.T.cikisYap}</button>
                </div>
              </div>
            </>) : null}
          </div>
          </>) : null}
        </div>
      </div>

      <div style={css(v.contentStyle)}>

        {v.isHome ? <HomeScreen v={v} /> : null}

        {v.isProjects ? <ProjectsScreen v={v} /> : null}

        {v.isDetail ? <DetailScreen v={v} /> : null}

        {v.isTasks ? <TasksScreen v={v} /> : null}
        {v.isMessages ? <MessagesScreen v={v} /> : null}

        {v.isRecords ? <RecordsScreen v={v} /> : null}

        {v.isApprovals ? <ApprovalsScreen v={v} /> : null}

        {v.isProfile ? <ProfileScreen v={v} /> : null}

        {v.isTemplates ? <TemplatesScreen v={v} /> : null}

        {v.isCompany ? <CompanyScreen v={v} /> : null}
        {v.isAbout ? <div style={css("max-width:640px")}><AboutCard v={v} /></div> : null}
      </div>

      {v.isMobile ? (<>
        <div style={css("position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--card);border-top:1px solid var(--line);display:flex;gap:2px;padding:4px 4px 8px")}>
          {(v.bottomNav || []).map((n: any, i88: number) => (<React.Fragment key={n?.id ?? n?.key ?? i88}>
            <button onClick={n.onClick} style={css(n.botStyle)} aria-label={n.hasBadge ? n.label + " (" + n.badgeText + ")" : undefined}>
              <span style={css("position:relative;display:inline-flex")}>
                {n.icon}
                {n.hasBadge ? <span aria-hidden="true" style={css("position:absolute;top:-5px;right:-9px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--pri,#2a3180);color:#fff;font-size:10px;font-weight:800;line-height:16px;text-align:center;box-shadow:0 0 0 2px var(--card)")}>{n.badgeText}</span> : null}
              </span>
              <span style={css("font-size:11px;font-weight:700;white-space:nowrap")}>{n.label}</span>
            </button>
          </React.Fragment>))}
        </div>
      </>) : null}
      </div>
    </div>
  </>
  );
}
