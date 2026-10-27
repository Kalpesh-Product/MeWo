/* eslint-disable @next/next/no-img-element -- Original local artwork displayed at its reference size. */
import { Hero, MembershipCards, PressStrip } from "@/components/interactive";
import Link from "next/link";
const amenities = [
  "Furnished Office",
  "High Speed Internet",
  "Free Beverages",
  "Great First Experience",
  "Meeting Rooms",
  "Audio Video Conferencing",
  "In House Premium Cafe",
  "Security",
  "Gaming Zone",
  "MeWo Community",
  "MeWo Events",
  "Color Printing",
  "Free Lounge Access",
  "Secure Private Access",
  "Housekeeping",
  "Stationery",
  "Library",
  "Parking",
];
export default function Home() {
  return (
    <main id="main-content">
      <Hero />
      <section className="site-container py-[100px]">
        <div className="mb-20 text-center">
          <h2 className="mb-[15px] text-[32px] leading-tight font-bold text-brand md:text-[40px]">
            Our Amenities
          </h2>
          <p className="text-[15px] text-[#555]">
            A FULLY SERVICED PREMIER WORK NEST
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-[30px] gap-y-20 md:grid-cols-4 lg:grid-cols-6">
          {amenities.map((title, i) => (
            <div key={title} className="text-center tracking-[.5px]">
              <img
                className="mx-auto h-[65px] w-[65px]"
                width="65"
                height="65"
                src={`/assets/img/amenities/Amenities${i + 1}.webp`}
                alt=""
                loading="lazy"
              />
              <h3 className="mt-[10px] text-[16px] leading-[22px] font-bold text-brand">
                {title}
              </h3>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-[#f5f5f5] py-[100px]">
        <div className="site-container">
          <div className="mb-20 text-center">
            <h2 className="mb-[15px] text-[32px] leading-tight font-bold text-brand md:text-[40px]">
              Our Membership
            </h2>
            <p className="mx-auto max-w-[530px] text-[15px] text-[#555]">
              EXCLUSIVE CO-WORKING MEMBERSHIPS FOR STARTUPS &amp; CORPORATES!
            </p>
          </div>
          <MembershipCards home />
          <div className="mt-[70px] text-center">
            <Link className="primary-button" href="/membership.html">
              Show More
            </Link>
          </div>
        </div>
      </section>
      <section
        aria-label="Featured in the press"
        className="bg-white py-[50px]"
      >
        <PressStrip />
      </section>
    </main>
  );
}
