import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="site-container inner-page text-center">
      <h1 className="page-heading">Page not found</h1>
      <Link className="primary-button" href="/">
        Back to Home
      </Link>
    </main>
  );
}
