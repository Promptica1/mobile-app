import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  loading: boolean;
  children: React.ReactNode;
};

export default function SubmitButton({ loading, children }: Props) {
  return (
    <Button variant="lime" type="submit" disabled={loading} aria-busy={loading}>
      {loading && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
      {children}
    </Button>
  );
}
