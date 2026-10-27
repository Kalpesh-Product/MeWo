export function Icon({
  name,
  className = "",
}: {
  name:
    | "facebook"
    | "twitter"
    | "instagram"
    | "linkedin"
    | "location"
    | "email"
    | "phone"
    | "clock"
    | "send"
    | "angle-left"
    | "angle-right";
  className?: string;
}) {
  const codes = {
    facebook: "\uf39e",
    twitter: "\uf099",
    instagram: "\uf16d",
    linkedin: "\uf08c",
    location: "\uf3c5",
    email: "\uf0e0",
    phone: "\uf095",
    clock: "\uf017",
    send: "\uf1d8",
    "angle-left": "\uf104",
    "angle-right": "\uf105",
  };
  const brand = ["facebook", "twitter", "instagram", "linkedin"].includes(name);
  return (
    <span
      aria-hidden="true"
      className={`${brand ? "brand-icon" : "solid-icon"} ${className}`}
    >
      {name === "angle-left" || name === "angle-right" ? (
        <>
          <svg width="0" height="0" className="absolute" focusable="false">
            <defs>
              <filter id={`mewo-thin-${name}`}>
                <feMorphology
                  in="SourceGraphic"
                  operator="erode"
                  radius="0.5"
                />
              </filter>
            </defs>
          </svg>
          <span
            className="inline-block"
            style={{ filter: `url(#mewo-thin-${name})` }}
          >
            {codes[name]}
          </span>
        </>
      ) : (
        codes[name]
      )}
    </span>
  );
}
