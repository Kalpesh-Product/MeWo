"use client";
/* eslint-disable @next/next/no-img-element -- Local reference photography uses explicit layout sizing. */
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useCallback, useEffect, useRef, useState } from "react";
import content from "@/lib/content.json";
import motion from "./motion.module.css";

export const memberTitles = [
  "EXCLUSIVE PRIVATE OFFICE",
  "PRIVATE OPEN DESK",
  "FLEXIBLE OPEN DESK",
  "EXCLUSIVE MEETING SPACES",
  "HOUR / DAY PASS",
  "VIRTUAL OFFICES",
];
export function Hero() {
  // One clone before and two after the real slides preserve the original looping motion.
  const [position, setPosition] = useState(1);
  const [animated, setAnimated] = useState(true);
  const [moving, setMoving] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [paused, setPaused] = useState(false);
  const [twoVisible, setTwoVisible] = useState(false);
  const busy = useRef(false);
  const reducedMotion = useRef(false);
  const move = useCallback((direction: number) => {
    if (busy.current) return;
    setHasMoved(true);
    busy.current = !reducedMotion.current;
    setMoving(!reducedMotion.current);
    setPosition((current) =>
      reducedMotion.current
        ? ((current - 1 + direction + 3) % 3) + 1
        : current + direction,
    );
  }, []);
  useEffect(() => {
    const tablet = window.matchMedia(
      "(min-width: 600px) and (max-width: 999px)",
    );
    const update = () => setTwoVisible(tablet.matches);
    update();
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    tablet.addEventListener("change", update);
    return () => tablet.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paused || reducedMotion.current) return;
    const timer = setInterval(() => move(1), 5000);
    return () => clearInterval(timer);
  }, [paused, move]);
  useEffect(() => {
    if (animated) return;
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, [animated]);
  const titles = ["CO-WORKING", "MEETINGS & KAFFE", "VIRTUAL OFFICE"];
  const bookings = [
    "Book A Co-Working Space",
    "Book A Meeting Room",
    "Book A Vrtual Office",
  ];
  return (
    <section
      aria-label="Our workspaces"
      aria-roledescription="carousel"
      className="relative h-screen overflow-hidden bg-ink text-white"
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
    >
      <div
        className={`hero-track flex h-full [--hero-step:100%] min-[600px]:max-[1000px]:[--hero-step:50%] ${animated ? "transition-transform duration-[2000ms] ease-[ease]" : ""}`}
        style={{
          transform: `translate3d(calc(var(--hero-step) * ${-position}),0,0)`,
        }}
        onTransitionEnd={(event) => {
          if (event.target !== event.currentTarget) return;
          if (position === 0 || position === 4) {
            setAnimated(false);
            setPosition(position === 0 ? 3 : 1);
          }
          busy.current = false;
          setMoving(false);
        }}
      >
        {[2, 0, 1, 2, 0, 1].map((i, slot) => {
          const active =
            slot === position || (twoVisible && slot === position + 1);
          return (
            <div
              key={slot}
              aria-hidden={!active}
              inert={!active}
              className="hero-slide relative h-full basis-full shrink-0 min-[600px]:max-[1000px]:basis-1/2 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(#0519224d,#0519224d),url(/assets/img/hero/hero-bg-${i + 1}.webp)`,
              }}
            >
              <div className="site-container h-full">
                <div className="-mx-[15px] h-full">
                  <div
                    className={`h-full px-[15px] lg:ml-[8.333333%] lg:w-5/6 ${i === 0 ? "xl:ml-0" : ""}`}
                  >
                    <div className="table h-full w-full">
                      <div
                        className={`table-cell align-middle md:max-lg:px-[70px] max-md:text-center ${i === 1 ? "text-center" : i === 2 ? "text-right" : "text-left"}`}
                      >
                        <div
                          className={motion.heroCaption}
                          data-phase={
                            moving ? "moving" : hasMoved ? "enter" : "idle"
                          }
                        >
                          <p className="mt-[420px] mb-[17.5px] text-[15px] leading-[1.8] font-bold tracking-[7px] uppercase max-md:mt-0 max-md:text-[13px] max-md:tracking-[4px]">
                            MeWo - Meetings &amp; Co-Working
                          </p>
                          <h1 className="mb-[17.5px] text-[74px] leading-[1.3] font-bold max-xl:text-[45px] max-lg:text-[40px] max-md:text-[28px]">
                            {titles[i]}
                          </h1>
                          <div className="hero-actions mt-[15px]">
                            <Link
                              href="/membership.html"
                              className="primary-button max-md:mx-[16%] max-md:my-[5%] max-md:block"
                            >
                              {bookings[i]}
                            </Link>{" "}
                            <Link
                              href="/contact.html"
                              className="max-md:mx-[16%] max-md:block ml-[15px] inline-block rounded-full border-2 border-white bg-white px-5 py-[7px] text-[14px] text-brand"
                            >
                              Contact Us
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => move(-1)}
        aria-label="Previous slide"
        className="absolute top-1/2 left-[60px] z-10 -mt-[30px] hidden text-[48px] leading-[1.8] font-normal transition-opacity hover:opacity-70 min-[600px]:block"
      >
        <Icon name="angle-left" className="inline-block leading-none" />
      </button>
      <button
        onClick={() => move(1)}
        aria-label="Next slide"
        className="absolute top-1/2 right-[60px] z-10 -mt-[30px] hidden text-[48px] leading-[1.8] font-normal transition-opacity hover:opacity-70 min-[600px]:block"
      >
        <Icon name="angle-right" className="inline-block leading-none" />
      </button>
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:bottom-4 focus:left-4 focus:z-10 focus:bg-ink focus:p-2"
        onClick={() => setPaused(!paused)}
      >
        {paused ? "Play slideshow" : "Pause slideshow"}
      </button>
    </section>
  );
}

export function MembershipCards({ home = false }: { home?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const show = (i: number) => {
    setSelected(i);
    dialog.current?.showModal();
  };
  return (
    <>
      <div
          className={`grid gap-[30px] md:grid-cols-4 lg:grid-cols-3 ${home ? "items-stretch max-lg:items-start" : "items-start"}`}
      >
        {memberTitles.slice(0, home ? 3 : 6).map((title, i) => (
          <article
            key={title}
            className={`group overflow-hidden rounded-[10px] shadow-[0_0_20px_#ddd] transition-shadow duration-300 hover:shadow-[0_0_20px_#959595] md:col-span-2 lg:col-span-1 md:max-lg:[&:nth-child(3n)]:col-start-2 ${home ? "flex h-full flex-col max-lg:h-auto" : ""}`}
          >
            <button
              onClick={() => show(i)}
              className="block w-full shrink-0"
              aria-label={`View ${title.toLowerCase()}`}
            >
              <img
                src={`/assets/img/membership/membership_${i + 1}.webp`}
                alt={title.toLowerCase()}
                width="600"
                height="400"
                className="h-[200px] w-full object-cover transition-opacity duration-300 group-hover:opacity-80"
              />
            </button>
            <div
              className={`p-5 pb-[30px] ${home ? "flex flex-1 flex-col" : ""}`}
            >
              <h2
                  className="mb-[17.5px] text-[20px] leading-[1.25] max-md:leading-[1.5] font-bold"
              >
                <button className="text-left" onClick={() => show(i)}>
                  {title}
                </button>
              </h2>
              <p
                  className={`mb-[17.5px] text-[14px] leading-[1.8] text-[#555] ${home ? "min-h-[50.4px] flex-1" : ""} ${i > 0 && i < 3 ? "tracking-normal" : ""}`}
              >
                  {i === 0 ? (
                  <>
                    Accommodating Big &amp; Small Teams.
                    <br />
                    Fully Furnished &amp; Serviced.
                  </>
                ) : (
                  content.members[i]
                )}
              </p>
                <div className={`flex justify-between gap-2 ${home ? "items-center" : "h-[40.2px] items-start"}`}>
                <button
                  className={`text-[14px] leading-[1.8] hover:text-brand ${home ? "font-normal" : "mt-[15px] font-bold"}`}
                  onClick={() => show(i)}
                >
                  {home ? "read more" : "view more"}{" "}
                  <span
                    aria-hidden="true"
                    className="solid-icon inline-block leading-none"
                  >
                    &#xf105;
                  </span>
                </button>
                {!home && (
                  <Link
                    href="/contact.html"
                    className="primary-button whitespace-nowrap"
                  >
                    Book a Tour
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      <dialog
        ref={dialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        className={`${motion.membershipDialog} max-h-[90vh] w-[calc(100%-32px)] max-w-[800px] overflow-y-auto rounded bg-white p-0 text-ink`}
        aria-labelledby="membership-title"
      >
        {selected !== null && (
          <>
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h2 id="membership-title" className="font-medium text-brand">
                {memberTitles[selected]}
              </h2>
              <button
                autoFocus
                className="px-2 text-3xl text-gray-500"
                aria-label="Close membership details"
                onClick={() => dialog.current?.close()}
              >
                ×
              </button>
            </div>
            <div className="grid gap-[30px] p-6 md:grid-cols-2">
              <img
                src={`/assets/img/membership/membership_${selected + 1}.webp`}
                alt={memberTitles[selected].toLowerCase()}
                width="600"
                height="400"
                className="w-full"
              />
              <div>
                <h3 className="mb-4 font-bold text-brand">WHAT YOU GET:</h3>
                <ul className="list-disc pl-5 text-[14px]">
                  {content.benefits[selected].map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-200 p-4 text-center">
              <Link
                className="primary-button"
                href="/contact.html"
                onClick={() => dialog.current?.close()}
              >
                Book A Tour
              </Link>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
export function Gallery() {
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!viewerOpen) return;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [viewerOpen]);
  return (
    <>
      <div className="mx-auto grid grid-cols-1 min-[576px]:max-w-[540px] md:max-w-[720px] md:grid-cols-3 lg:max-w-[960px] lg:grid-cols-4 xl:max-w-none">
        {content.gallery.map((src, i) => (
          <button
            key={src}
            className="self-start"
            aria-label={`View workspace photo ${i + 1}`}
            onClick={() => {
              setIndex(i);
              setViewerOpen(true);
              dialog.current?.showModal();
            }}
          >
            <img
              src={src}
              alt={`MeWo workspace ${i + 1}`}
              width="600"
              height="400"
              loading="lazy"
              className="h-auto w-full transition-opacity hover:opacity-80"
            />
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        aria-label="Workspace photo viewer"
        onClose={() => setViewerOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight")
            setIndex((index + 1) % content.gallery.length);
          if (e.key === "ArrowLeft")
            setIndex(
              (index + content.gallery.length - 1) % content.gallery.length,
            );
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        className={motion.galleryDialog}
      >
        <figure className={motion.galleryFigure}>
        <button
          autoFocus
          className={motion.galleryClose}
          aria-label="Close photo viewer"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        <img
          className={motion.galleryImage}
          src={content.gallery[index]}
          alt={`MeWo workspace ${index + 1}`}
          onClick={() => setIndex((index + 1) % content.gallery.length)}
        />
        <figcaption className={motion.galleryCounter}>
          {index + 1} of {content.gallery.length}
        </figcaption>
        </figure>
          <button
            className={`${motion.galleryArrow} ${motion.galleryArrowLeft}`}
            aria-label="Previous photo"
            onClick={() =>
              setIndex(
                (index + content.gallery.length - 1) % content.gallery.length,
              )
            }
          >
            <span className="sr-only">Previous photo</span>
          </button>
          <button
            className={`${motion.galleryArrow} ${motion.galleryArrowRight}`}
            aria-label="Next photo"
            onClick={() => setIndex((index + 1) % content.gallery.length)}
          >
            <span className="sr-only">Next photo</span>
          </button>
      </dialog>
    </>
  );
}
export function InquiryForm({ startup = false }: { startup?: boolean }) {
  const [status, setStatus] = useState("");
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState(false);
  const fields = startup
    ? [
        ["Name", "text"],
        ["Email", "email"],
        ["Phone", "tel"],
        ["Startup Name", "text"],
        ["Website URL", "url"],
        ["Linkedin Profile URL", "url"],
      ]
    : [
        ["Name", "text"],
        ["Email", "email"],
        ["Phone", "tel"],
        ["Subject", "text"],
      ];
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setStatus("");
        const form = e.currentTarget;
        try {
          const response = await fetch("/api/inquiry", {
            method: "POST",
            body: new FormData(form),
          });
          const result = await response.json();
          setStatus(result.message);
          if (response.ok) {
            form.reset();
            setFileName("");
          }
        } catch {
          setStatus(
            "Unable to send. Please email response@biznest.co.in or call +91 80071 26444.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <input
        type="hidden"
        name="kind"
        value={startup ? "startup" : "contact"}
      />
      <div className={`mb-[17.5px] grid gap-y-[17.5px] max-md:[&>input:nth-child(even)]:-mt-[2.5px] ${startup ? "md:max-xl:grid-cols-2 md:max-xl:gap-x-[18.85px] xl:grid-cols-[49%_49%] xl:gap-x-[18.85px]" : "xl:grid-cols-[49%_49%] xl:gap-x-[13.85px]"}`}>
        {fields.map(([name, type]) => (
          <input
            key={name}
            type={type}
            name={name.toLowerCase().replaceAll(" ", "_")}
            placeholder={name}
            aria-label={name}
            required={["Name", "Email", "Phone"].includes(name)}
            maxLength={200}
            className="form-field tracking-normal text-black"
          />
        ))}
      </div>
      {startup && (
        <label className="mb-[17.5px] flex items-center gap-[3.85px] text-[12px] leading-[21.6px] tracking-normal text-[#777]">
          <span className="relative shrink-0 overflow-hidden rounded-[3px] bg-[#44709c] px-[10px] py-[5px] font-[Arial,sans-serif] text-[13px] leading-[19.5px] tracking-[0.1px] text-white">
            BROWSE
            <input
              aria-label="Attach Corporate Presentation"
              name="presentation"
              type="file"
              accept=".pdf,.ppt,.pptx"
              className="absolute inset-0 w-full cursor-pointer opacity-0"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
            />
          </span>
          <span>{fileName || "Attach Corporate Presentation"}</span>
        </label>
      )}
      <textarea
        name="message"
        aria-label={startup ? "Personal Note" : "Message"}
        placeholder={startup ? "Personal Note" : "Message"}
        rows={10}
        required
        maxLength={10000}
        className="form-field block h-[200px] resize-none tracking-normal text-black"
      />
      <div className={`text-center ${startup ? "mt-[88.4px]" : "mt-[25.9px]"}`}>
        <button
          className="primary-button border-2 border-black [border-style:outset] tracking-normal hover:bg-brand disabled:cursor-wait disabled:opacity-60"
          type="submit"
          disabled={pending}
        >
          {pending ? "Submitting…" : "Submit"}
        </button>
      </div>
      <p role="status" className={`text-center text-[14px] text-brand ${status ? "" : "hidden"}`}>
        {status}
      </p>
    </form>
  );
}

export function PressStrip() {
  // Keep a complete copy on either side so dragging can loop in both directions.
  const [position, setPosition] = useState(8);
  const [animated, setAnimated] = useState(true);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [settling, setSettling] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    step: number;
    baseOffset: number;
    limit: number;
    horizontal: boolean;
  } | null>(null);

  const finishTransition = useCallback(() => {
    if (position < 8 || position >= 16) {
      setAnimated(false);
      setPosition(8 + ((((position - 8) % 8) + 8) % 8));
    }
    setSettling(false);
  }, [position]);

  useEffect(() => {
    if (
      paused ||
      dragging ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(() => {
      setPosition((current) => current + 1);
      setSettling(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [paused, dragging]);

  useEffect(() => {
    if (animated) return;
    let secondFrame = 0;
    const frame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setAnimated(true));
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(secondFrame);
    };
  }, [animated]);

  useEffect(() => {
    if (!settling) return;
    // Also settle when reduced motion disables transitionend, or the pointer did not move.
    const timer = setTimeout(finishTransition, 300);
    return () => clearTimeout(timer);
  }, [settling, position, finishTransition]);

  const endDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    pointer.current = null;
    const offset = Math.max(
      -start.limit,
      Math.min(start.limit, event.clientX - start.x + start.baseOffset),
    );
    let steps = 0;
    if (!cancelled && start.horizontal && Math.abs(offset) > 10) {
      steps = Math.round(-offset / start.step) || Math.sign(-offset);
    }
    setAnimated(true);
    setPosition((current) => current + steps);
    setDragOffset(0);
    setDragging(false);
    setSettling(true);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      className={`site-container overflow-hidden ${motion.pressViewport}`}
      data-dragging={dragging}
      onFocusCapture={() => {
        if (!pointer.current) setPaused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
      onDragStart={(event) => event.preventDefault()}
      onClickCapture={(event) => {
        if (suppressClick.current && event.detail > 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onPointerDown={(event) => {
        if (
          event.button !== 0 ||
          !event.isPrimary ||
          !track.current?.firstElementChild
        )
          return;
        const step =
          track.current.firstElementChild.getBoundingClientRect().width + 30;
        const translateX = new DOMMatrixReadOnly(
          getComputedStyle(track.current).transform,
        ).m41;
        const baseOffset = translateX + position * step;
        pointer.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          step,
          baseOffset,
          limit:
            step * Math.max(1, Math.round(track.current.clientWidth / step)),
          horizontal: false,
        };
        suppressClick.current = false;
        setPaused(false);
        setSettling(false);
        setDragOffset(baseOffset);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const start = pointer.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!start.horizontal) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 5) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            endDrag(event, true);
            return;
          }
          start.horizontal = true;
          suppressClick.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        event.preventDefault();
        setDragOffset(
          Math.max(-start.limit, Math.min(start.limit, dx + start.baseOffset)),
        );
      }}
      onPointerUp={(event) => endDrag(event)}
      onPointerCancel={(event) => endDrag(event, true)}
      onLostPointerCapture={(event) => endDrag(event, true)}
      onPointerLeave={(event) => {
        if (pointer.current && !pointer.current.horizontal)
          endDrag(event, true);
      }}
    >
      <div
        ref={track}
        className={motion.pressTrack}
        data-instant={!animated || dragging}
        style={{
          transform: `translate3d(calc(var(--logo-step) * ${-position} + ${dragOffset}px),0,0)`,
        }}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget) finishTransition();
        }}
      >
        {Array.from({ length: 24 }, (_, slot) => (
          <Link
            href="/press.html"
            key={slot}
            draggable={false}
            aria-hidden={slot < 8 || slot >= 16}
            inert={slot < 8 || slot >= 16}
            className={motion.pressItem}
          >
            <img
              width="180"
              height="100"
              draggable={false}
              src={`/assets/img/press/press_${(slot % 8) + 1}.webp`}
              alt={`Press coverage ${(slot % 8) + 1}`}
              className="mx-auto max-h-[130px] w-full object-contain"
              loading="lazy"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
