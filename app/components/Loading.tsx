import CutoutTitle from "./CutoutTitle";

/**
 * Full-screen loading state for every page: "LOADING" in magazine letters,
 * hopping one by one, on the site navy. Covers everything else (including the
 * mini player) until the page is ready.
 */
export default function Loading() {
  return (
    <div
      role="status"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#172029] px-4"
    >
      <CutoutTitle text="Loading" as="p" jump maxHeight="4.5rem" minHeight="2.5rem" fitWidth="60vw" />
    </div>
  );
}
