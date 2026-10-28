type Shape = { e: [number, number, number, number, number?] } | { p: string };

const SILHOUETTE: Shape[] = [
  { e: [100, 30, 17, 20] },
  { p: "M92 46 h16 v12 h-16 z" },
  { p: "M62 62 Q100 52 138 62 L134 150 Q130 170 126 178 H74 Q70 170 66 150 Z" },
  { p: "M58 66 Q46 70 46 90 L42 170 Q42 180 50 182 Q56 180 56 170 L64 100 Z" },
  {
    p: "M142 66 Q154 70 154 90 L158 170 Q158 180 150 182 Q144 180 144 170 L136 100 Z",
  },
  {
    p: "M74 176 H126 L122 260 L118 350 Q116 362 106 362 L102 262 H98 L94 362 Q84 362 82 350 L78 260 Z",
  },
];

const FRONT: Record<string, Shape[]> = {
  Ombros: [{ e: [66, 74, 12, 11] }, { e: [134, 74, 12, 11] }],
  Peito: [{ e: [86, 90, 15, 11] }, { e: [114, 90, 15, 11] }],
  Bíceps: [{ e: [56, 108, 7, 16, -6] }, { e: [144, 108, 7, 16, 6] }],
  Antebraço: [{ e: [49, 148, 6, 18, -4] }, { e: [151, 148, 6, 18, 4] }],
  Abdômen: [{ p: "M88 106 H112 Q114 140 110 168 H90 Q86 140 88 106 Z" }],
  Quadríceps: [{ e: [89, 214, 11, 32, 3] }, { e: [111, 214, 11, 32, -3] }],
  Panturrilha: [{ e: [89, 300, 6, 24] }, { e: [111, 300, 6, 24] }],
};

const BACK: Record<string, Shape[]> = {
  Ombros: [{ e: [66, 74, 12, 11] }, { e: [134, 74, 12, 11] }],
  Costas: [
    { p: "M86 60 L100 54 L114 60 L108 84 L100 90 L92 84 Z" },
    { p: "M78 84 Q90 92 98 96 L96 140 Q84 132 74 112 Z" },
    { p: "M122 84 Q110 92 102 96 L104 140 Q116 132 126 112 Z" },
    { p: "M90 142 H110 V170 H90 Z" },
  ],
  Tríceps: [{ e: [56, 106, 7, 16, -6] }, { e: [144, 106, 7, 16, 6] }],
  Antebraço: [{ e: [49, 148, 6, 18, -4] }, { e: [151, 148, 6, 18, 4] }],
  Glúteos: [{ e: [89, 188, 12, 13] }, { e: [111, 188, 12, 13] }],
  Posterior: [{ e: [89, 232, 10, 28, 3] }, { e: [111, 232, 10, 28, -3] }],
  Panturrilha: [{ e: [89, 298, 8, 24] }, { e: [111, 298, 8, 24] }],
};

const BASE = "#d7dde7";
const LEVELS = ["#c9eee2", "#7fd6bb", "#2fb38f"];

function draw(shape: Shape, fill: string, extra: Record<string, unknown> = {}) {
  if ("e" in shape) {
    const [cx, cy, rx, ry, rot = 0] = shape.e;
    return (
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}
        fill={fill}
        {...extra}
      />
    );
  }
  return <path d={shape.p} fill={fill} {...extra} />;
}

export function BodyMap({
  level,
  selected,
  onSelect,
}: {
  level: (muscle: string) => 0 | 1 | 2 | 3;
  selected: string | null;
  onSelect: (muscle: string) => void;
}) {
  const view = (title: string, muscles: Record<string, Shape[]>) => (
    <figure className="flex-1 text-center">
      <svg viewBox="30 0 140 370" className="mx-auto h-56 w-full">
        <g pointerEvents="none">
          {SILHOUETTE.map((s, i) => (
            <g key={i}>{draw(s, "#eceff4")}</g>
          ))}
        </g>
        {Object.entries(muscles).map(([muscle, shapes]) => {
          const l = level(muscle);
          const fill = l ? LEVELS[l - 1] : BASE;
          const on = selected === muscle;
          return (
            <g
              key={muscle}
              onClick={() => onSelect(muscle)}
              className="cursor-pointer"
              role="button"
              aria-label={muscle}
            >
              {shapes.map((s, i) => (
                <g key={i}>
                  {draw(s, fill, {
                    stroke: on ? "#24324a" : "#ffffff",
                    strokeWidth: on ? 2.5 : 1.5,
                  })}
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs font-bold text-ink/50">{title}</figcaption>
    </figure>
  );
  return (
    <div className="flex gap-2">
      {view("Frente", FRONT)}
      {view("Costas", BACK)}
    </div>
  );
}

export function BodyLegend({ items }: { items: [string, number][] }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 text-[11px] font-bold text-ink/60">
      {items.map(([label, l]) => (
        <span key={label} className="flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: l ? LEVELS[l - 1] : BASE }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
