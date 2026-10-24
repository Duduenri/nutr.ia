export function Svg({
  markup,
  className = "",
}: {
  markup: string;
  className?: string;
}) {
  return (
    <div
      className={`[&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
