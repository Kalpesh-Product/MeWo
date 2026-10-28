"use client";
/* eslint-disable @next/next/no-img-element -- Original local assets retain their natural dimensions. */
import Link from "next/link";
import { Icon } from "@/components/icon";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import content from "@/lib/content.json";
import motion from "./motion.module.css";
export const navigation = [
  ["Home", "/"],
  ["About", "/about.html"],
  ["Membership", "/membership.html"],
  ["Gallery", "/gallery.html"],
  ["Press", "/press.html"],
  ["Startup Support", "/startup.html"],
  ["Contact", "/contact.html"],
];
export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 0);
    handle();
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);
  const home = pathname === "/" || pathname === "/index.html";
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 max-md:absolute max-md:py-[25px] ${home ? "max-md:bg-transparent" : "max-md:bg-white"} ${scrolled ? "bg-ink py-[15px]" : `py-[25px] ${home ? "bg-transparent" : "bg-white lg:bg-ink"}`}`}
    >
      <div className="site-container flex min-h-[70px] items-start justify-between lg:min-h-[78.67px]">
        <Link href="/" aria-label="MeWo home">
          <img
            src="/assets/img/mewologo.webp"
            width="80"
            height="68"
            alt="MeWo"
            className="h-auto w-[60px] py-[6px] md:w-[70px] lg:w-20"
          />
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden flex-1 justify-center lg:flex"
        >
          <ul className="flex gap-[3.85px]">
            {navigation.map(([label, url]) => (
              <li key={url}>
                <Link
                  aria-current={pathname === url ? "page" : undefined}
                  href={url}
                  className={`${motion.navLink} block px-[15px] py-[15px] text-[14px] font-bold text-white`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <button
          className="mt-[15px] block h-9 w-[38px] rounded-[3px] bg-brand px-2 pt-2 pb-[6px] font-[Arial,Helvetica,sans-serif] text-[18px] leading-[22px] font-bold text-white lg:hidden"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-controls="mobile-navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "X" : <>
            <span className="mt-[3px] block h-[3px] w-[22px] bg-white" />
            <span className="mt-[3px] block h-[3px] w-[22px] bg-white" />
            <span className="mt-[3px] block h-[3px] w-[22px] bg-white" />
          </>}
        </button>
      </div>
      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        className={`site-container lg:hidden ${motion.mobileMenu}`}
        data-open={open}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="max-h-[calc(100svh-120px)] overflow-y-auto bg-[#0c1923]">
            {navigation.map(([label, url]) => (
              <li key={url} className="border-t border-white/50 first:border-t-0">
                <Link
                  href={url}
                  onClick={() => setOpen(false)}
                  className="block px-[5%] py-[7px] text-[14px] leading-[25.2px] font-normal text-white uppercase hover:bg-white/10"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
function Subscribe() {
  const [message, setMessage] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setMessage("Submitting…");
        try {
          const response = await fetch("/api/inquiry", {
            method: "POST",
            body: new FormData(form),
          });
          const data = await response.json();
          setMessage(data.message);
          if (response.ok) form.reset();
        } catch {
          setMessage("Please email response@biznest.co.in to subscribe.");
        }
      }}
    >
      <div className="flex items-start gap-[3.85px]">
        <input
            className="min-w-0 w-[78%] shrink-0 rounded-l-[5px] bg-[#012738] p-[15px] text-[14px] tracking-normal text-white placeholder:text-[#757575] placeholder:opacity-100"
          type="email"
          name="email"
          placeholder="Email"
          aria-label="Subscription email"
          required
        />
        <input type="hidden" name="kind" value="subscription" />
        <button
          className="w-1/5 shrink-0 rounded-r-[3px] bg-[#012738] py-[14px] text-white transition-colors duration-300 hover:bg-[#365c80] hover:text-ink"
          aria-label="Subscribe"
        >
          {<Icon name="send" />}
        </button>
      </div>
      <p role="status" className={`mt-3 text-xs text-white/70 ${message ? "" : "max-md:hidden"}`}>
        {message}
      </p>
    </form>
  );
}
export function Footer() {
  const pathname = usePathname();
  const heading =
      "relative mb-[17.5px] pb-5 text-[24px] leading-[45.5px] max-md:text-[20px] max-md:leading-[31.5px] font-normal text-white after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-5 after:bg-white max-md:after:h-0 max-md:after:border-b-2 max-md:after:border-white";
  return (
    <footer className="bg-ink text-[14px] text-white">
        <div className="site-container grid gap-[30px] py-[100px] max-md:gap-y-[50px] max-md:py-20 md:grid-cols-2 lg:grid-cols-4">
        <section>
          <h2 className={heading}>About us</h2>
          <p className="text-white/70">{content.intro}</p>
        </section>
        <section>
          <h2 className={heading}>Get in Touch</h2>
          <div className="space-y-[10px] text-white/70">
            <p>
              MeWo - Meetings &amp; Co-Working, Dempo Trade Center, 002, 004
              Ground Floor &amp; 706 7th Floor,
              <br />
              Patto, Panjim, Goa - 403001
            </p>
            <p>
              Email :{" "}
              <a href="mailto:response@biznest.co.in">response@biznest.co.in</a>
            </p>
            <p>
              Call : <a href="tel:+918007126444">+91 80071 26444</a> /<br />
              <a className="pl-[35px]" href="tel:+918104564129">
                +91 81045 64129
              </a>
            </p>
          </div>
        </section>
        <section>
          <h2 className={heading}>Pages</h2>
          <ul className="space-y-[10px] text-white/70">
            {navigation.map(([label, url]) => (
              <li key={url} className="relative pl-5">
                <Link href={url} className="hover:text-white">
                  <span
                    aria-hidden="true"
                    className="solid-icon absolute top-0 left-0"
                  >
                    &#xf105;
                  </span>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="max-md:mb-[50px]">
          <h2 className={heading}>Subscribe</h2>
          <p className="mb-5 text-white/70 lg:mb-[17.5px]">
            {pathname === "/" || pathname === "/index.html"
              ? "Subscribe to to hear from us about our co-working & community promotions and events."
              : "Subscribe to our mailing list to get the latest updates."}
          </p>
          <Subscribe />
        </section>
      </div>
      <div className="border-t border-[#232a35]">
        <div className="site-container grid gap-x-[30px] lg:grid-cols-2">
          <p className="py-4 text-center text-[15px] leading-[1.8] text-white opacity-70 max-md:pb-0 lg:text-left">
            Copyright © 2024-26 DEMPO BIZ Nest LLP - All Rights Reserved.
            Privacy Policy l Terms &amp; Conditions Powered by{" "}
            <a
              href="https://www.wono.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#0aa9ef]"
            >
              WoNo
            </a>
          </p>
          <div className="flex items-start justify-center gap-[3.85px] lg:justify-end">
            {[
              ["Facebook", "https://www.facebook.com/MeWoWorkNest", "f"],
              ["Twitter", "https://twitter.com/MeWoWorkNest", "𝕏"],
              ["Instagram", "https://www.instagram.com/mewoworknest/", "◎"],
              [
                "LinkedIn",
                "https://www.linkedin.com/company/mewo-meetings-coworkings/",
                "in",
              ],
            ].map(([name, url], i) => (
              <a
                key={name}
                href={url}
                aria-label={name}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-[10px] py-4 text-[16px] leading-[1.8] text-white opacity-70 transition-colors duration-300 hover:text-[#365c80]"
              >
                <Icon
                  name={
                    (["facebook", "twitter", "instagram", "linkedin"] as const)[
                      i
                    ]
                  }
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
