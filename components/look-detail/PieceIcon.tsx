import { Footprints, Shirt } from "lucide-react";
import type { LookPiece } from "@/lib/looks";

// В lucide нет куртки и джинсов — рисуем свои в том же стиле (24×24, линия).
function CustomIcon({ paths }: { paths: string[] }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export default function PieceIcon({ kind }: { kind: LookPiece["kind"] }) {
  switch (kind) {
    case "tshirt":
      return <Shirt size={22} strokeWidth={1.25} className="text-muted" />;
    case "shoes":
      return <Footprints size={22} strokeWidth={1.25} className="text-muted" />;
    case "jacket":
      return (
        <CustomIcon
          paths={[
            "M8.5 3 4.5 5 2.5 12l2.5 1 1-3v11h12V10l1 3 2.5-1-2-7-4-2L12 6.5z",
            "M12 6.5V21",
          ]}
        />
      );
    case "jeans":
      return (
        <CustomIcon
          paths={["M6.5 2.5h11l1.5 19h-4.5L12 10l-2.5 11.5H5z", "M6.3 6h11.4"]}
        />
      );
  }
}
