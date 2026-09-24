export default function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <h1 className="font-serif text-4xl font-medium tracking-tight">
        {children}
      </h1>
    </div>
  );
}
