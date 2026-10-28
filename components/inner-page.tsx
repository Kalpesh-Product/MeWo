/* eslint-disable @next/next/no-img-element -- Original local photography retains its native proportions. */
import { notFound } from "next/navigation";
import content from "@/lib/content.json";
import {
  Gallery,
  InquiryForm,
  MembershipCards,
} from "@/components/interactive";
import { Icon } from "@/components/icon";
const pages: Record<string, string> = {
  about: "About",
  membership: "Membership",
  gallery: "Gallery",
  press: "Press",
  startup: "Startup Support",
  contact: "Contact",
  index: "Home",
};
function About() {
  return (
    <>
      <section className="mb-[180px] text-[15px] text-[#555] md:mb-[230px]">
        <h2 className="mb-[17.5px] pb-[15px] text-[28px] leading-[31.5px] font-bold text-brand max-[576px]:text-[24.5px] max-[576px]:leading-[28px]">
          MeWo - Meetings &amp; CoWorking
        </h2>
        <p className="mb-20">{content.intro}</p>
        <h3 className="mb-[17.5px] pb-[15px] text-[24px] leading-[21px] font-normal text-brand">
          MeWo&apos;s Primary Goal:
        </h3>
        <ul className="mb-[50px] list-disc pl-10 md:mb-20">
          {content.goals.map((goal) => (
            <li key={goal} className="mt-[10px]">
              {goal}
            </li>
          ))}
        </ul>
        <p>{content.aboutParagraphs[1]}</p>
      </section>
      <section className="space-y-[50px] md:space-y-20">
        {["Co-Working Zone", "Hybrid Cafe Zone", "Meetings Zone"].map(
          (zone, i) => (
            <article
              key={zone}
              className="grid items-start gap-x-[30px] lg:grid-cols-2"
            >
              <div className={i === 1 ? "" : "mb-20"}>
                <h3 className="mb-[17.5px] pb-[15px] text-[24px] leading-[21px] font-normal text-brand">
                  {zone}:
                </h3>
                <p className="text-[15px] tracking-[.42px] text-[#555]">
                  {content.aboutParagraphs[i === 2 ? 4 : i + 2]}
                </p>
                {i === 1 && (
                  <p className="mt-[10px] text-[15px] text-[#555]">
                    • One of its kind Café experience in Patto, Panjim.
                    <br />• In-house Menu: Exclusive menu and most affordable
                    rates.
                    <br />• Hourly Space Solution: Book Space yourself for as
                    low as an HOUR from anywhere in Goa on What’s App at +91
                    81045 64129.
                    <br />• Configurations: 1-6 Open Desks, Private &amp;
                    Conference rooms.
                  </p>
                )}
              </div>
              <img
                src={`/assets/img/about/${zone}/1.webp`}
                alt={zone}
                width="900"
                height="600"
                className="w-full"
                loading="lazy"
              />
            </article>
          ),
        )}
      </section>
    </>
  );
}
function Contact() {
  return (
    <div className="grid items-start gap-[30px] max-lg:gap-y-[41.6px] lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="mb-[17.5px] text-[25px] leading-[45.5px] max-md:text-[20px] max-md:leading-[31.5px] font-bold text-brand">
          Have you any question?
        </h2>
        <p className="mb-[25px] text-[15px] leading-[27px]">
          Better yet, see us in person!
          <br />
          We love our customers and love making new friends, so feel free to
          visit us for a cup of coffee!
        </p>
        <InquiryForm />
      </div>
      <aside className="rounded-[5px] bg-[#fbfbfb] px-[30px] py-[55px] [&_a]:text-[#007bff] [&_a:hover]:text-[#0056b3] [&_a:hover]:underline">
        {[
          [
            "ADDRESS :",
            <Icon key="location-icon" name="location" />,
            <span key="address">
              MeWo - Meetings &amp; Co-Working,
              <br />
              Dempo Trade Center, 002, 004
              <br />
              Ground Floor &amp; 706 7th Floor, Patto,
              <br />
              Panjim, Goa - 403001
            </span>,
          ],
          [
            "EMAIL :",
            <Icon key="email-icon" name="email" />,
            <a key="email" href="mailto:response@biznest.co.in">
              response@biznest.co.in
            </a>,
          ],
          [
            "CALL :",
            <Icon key="phone-icon" name="phone" />,
            <span key="call">
              <a href="tel:+918007126444">+91 80071 26444</a> /<br />
              <a href="tel:+918104564129" className="pl-[35px]">+91 81045 64129</a>
            </span>,
          ],
          [
            "WORKING HOURS :",
            <Icon key="clock-icon" name="clock" />,
            "9:00 AM to 9:00 PM",
          ],
        ].map(([title, icon, value], i) => (
          <div key={i} className={`relative pl-10 last:mb-0 ${i === 1 ? "mb-[17.5px]" : "mb-[30px]"}`}>
            <span
              className={`absolute top-[2px] left-[7.5px] text-[20px] leading-[20px] text-brand ${i === 2 ? "rotate-90" : ""}`}
              aria-hidden="true"
            >
              {icon}
            </span>
            <h3 className="mb-[10px] text-[20px] leading-[24.5px] max-md:leading-[21px] font-bold text-brand">
              {title}
            </h3>
            <p className="text-[14px] opacity-80">{value}</p>
          </div>
        ))}
      </aside>
    </div>
  );
}
export function InnerPage({ page: key }: { page: keyof typeof pages }) {
  if (!pages[key]) notFound();
  return (
    <main id="main-content">
      <div
        className={`inner-page ${key === "gallery" ? "w-full" : "site-container"} ${key === "membership" ? "max-md:pb-[130px]" : ""}`}
      >
        <h1 className="page-heading max-md:mb-[50px]">{pages[key].toUpperCase()}</h1>
        {key === "about" && <About />}
        {key === "membership" && <MembershipCards />}
        {key === "gallery" && <Gallery />}
        {key === "press" && (
          <div className="grid items-start gap-x-[30px] gap-y-20 pt-20 min-[576px]:grid-cols-2 md:grid-cols-3">
            {content.press.map((quote, i) => (
              <figure
                key={i}
                className={i === content.press.length - 1 ? "md:col-start-2" : undefined}
              >
                <img
                  className="mx-auto mb-5 w-full"
                  src={`/assets/img/press/press_${i + 1}.webp`}
                  alt={`MeWo press feature ${i + 1}`}
                  width="600"
                  height="400"
                  loading="lazy"
                />
                <figcaption className="text-center text-[17px] leading-[1.8] text-[#999] italic max-md:mx-auto max-md:max-w-[285px] max-md:text-[15px]">
                  {quote}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        {key === "startup" && (
          <>
            <p className="mb-20 pt-[10px] text-[15px] leading-[27px] tracking-[1px] text-[#555]">
              We are constructing an energetic and sustainable Startup Ecosystem
              in Goa and we welcome any Individual or Startup to reach out to us
              for any support.
            </p>
            <InquiryForm startup />
          </>
        )}
        {key === "contact" && <Contact />}
      </div>
      {key === "contact" && (
        <>
          <div className="bg-brand py-[95px] text-center text-[30px] font-semibold text-white max-md:text-[20px] md:text-[40px]">
            <Icon name="location" /> Find Our Location
          </div>
          <iframe
            title="MeWo location in Panjim, Goa"
            src="https://maps.google.com/maps?q=MeWo%20Meetings%20Co-Working%20Dempo%20Trade%20Center%20Patto%20Panjim%20Goa&z=14&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-[600px] w-full border-0 max-xl:aspect-[7/3] max-xl:h-auto"
          />
        </>
      )}
    </main>
  );
}
