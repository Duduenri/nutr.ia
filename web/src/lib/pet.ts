const INK = "#1d2433";

interface SlotItem {
  id: string;
  slot: string;
}

export const PET_COLORS: Record<string, string> = {
  color_pink: "#ff9e9e",
  color_mint: "#8fdcc6",
  color_peach: "#ffb38a",
  color_lilac: "#c7a8f0",
  color_yellow: "#ffd86b",
  color_sky: "#9fd0f5",
};

function sprout(level: number): string {
  const h = Math.min(30 + level * 6, 70);
  const top = 112 - h;
  const leaf = Math.min(0.8 + level * 0.12, 1.6);
  let out = `<path d="M100 114 C ${100 - 4} ${114 - h / 2} ${100 + 6} ${top + 10} 100 ${top}" stroke="#5aa832" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  out += `<g transform="translate(100 ${top + 14}) scale(${leaf})"><path d="M0 0 C -14 -16 -34 -12 -40 -2 C -30 8 -10 8 0 0 Z" fill="#7cc242"/><path d="M0 0 C -14 -4 -26 -4 -36 -2" stroke="#5aa832" stroke-width="1.5" fill="none"/></g>`;
  out += `<g transform="translate(100 ${top + 6}) scale(${leaf})"><path d="M0 0 C 12 -22 36 -24 44 -14 C 36 0 14 6 0 0 Z" fill="#9bd65a"/><path d="M0 0 C 14 -8 28 -12 40 -13" stroke="#5aa832" stroke-width="1.5" fill="none"/></g>`;
  if (level >= 4) {
    const petals = level >= 5 ? 6 : 0;
    if (petals) {
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2;
        out += `<circle cx="${100 + Math.cos(a) * 9}" cy="${top - 4 + Math.sin(a) * 9}" r="7" fill="${level >= 7 ? "#ffd86b" : "#ff8fb1"}"/>`;
      }
      out += `<circle cx="100" cy="${top - 4}" r="6" fill="#ffd23f"/>`;
    } else {
      out += `<ellipse cx="100" cy="${top - 4}" rx="7" ry="9" fill="#ff8fb1"/>`;
    }
  }
  return out;
}

function face(level: number): string {
  let out = `<ellipse cx="86" cy="150" rx="5" ry="7" fill="${INK}"/><ellipse cx="114" cy="150" rx="5" ry="7" fill="${INK}"/><circle cx="88" cy="147" r="1.8" fill="#fff"/><circle cx="116" cy="147" r="1.8" fill="#fff"/>`;
  if (level >= 2) {
    out += `<ellipse cx="72" cy="162" rx="7" ry="4" fill="#ff6f8b" opacity="0.35"/><ellipse cx="128" cy="162" rx="7" ry="4" fill="#ff6f8b" opacity="0.35"/>`;
  }
  if (level >= 3) {
    out += `<path d="M93 163 Q100 170 107 163" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
  return out;
}

const HATS: Record<string, string> = {
  hat_cap: `<path d="M66 122 Q100 80 134 122 Z" fill="#e8693a"/><path d="M100 84 Q118 92 126 112" stroke="#f6a07c" stroke-width="3" fill="none"/><rect x="104" y="117" width="46" height="8" rx="4" fill="#c4532a"/>`,
  hat_bow: `<g transform="translate(130 116) rotate(-15)"><path d="M0 0 L-18 -12 L-18 12 Z" fill="#ff8fb1"/><path d="M0 0 L18 -12 L18 12 Z" fill="#ff8fb1"/><circle r="5" fill="#ff5c8a"/></g>`,
  hat_flower: `<g transform="translate(130 114)">${[0, 1, 2, 3, 4]
    .map((i) => {
      const a = (i / 5) * Math.PI * 2;
      return `<circle cx="${Math.cos(a) * 8}" cy="${Math.sin(a) * 8}" r="7" fill="#ffb38a"/>`;
    })
    .join("")}<circle r="5.5" fill="#ffd23f"/></g>`,
  hat_party: `<path d="M80 122 L100 66 L120 122 Z" fill="#f6a07c"/><path d="M86 106 L114 106 M92 90 L108 90" stroke="#ffd86b" stroke-width="5"/><circle cx="100" cy="66" r="6" fill="#ffd86b"/>`,
  hat_beach: `<ellipse cx="100" cy="120" rx="54" ry="9" fill="#ffc9d6"/><path d="M72 120 Q74 92 100 90 Q126 92 128 120 Z" fill="#ffd6e0"/><rect x="73" y="110" width="54" height="6" fill="#7cc242"/><circle cx="80" cy="113" r="4" fill="#fff"/>`,
  hat_beanie: `<path d="M64 124 Q66 82 100 80 Q134 82 136 124 Z" fill="#6f9ce8"/><rect x="62" y="116" width="76" height="12" rx="6" fill="#4f7fd0"/><circle cx="100" cy="78" r="8" fill="#fff"/>`,
  hat_chef: `<rect x="76" y="104" width="48" height="18" rx="4" fill="#fff" stroke="#e5e7eb" stroke-width="2"/><circle cx="82" cy="94" r="14" fill="#fff"/><circle cx="100" cy="86" r="16" fill="#fff"/><circle cx="118" cy="94" r="14" fill="#fff"/>`,
  hat_crown: `<path d="M70 124 L72 92 L86 108 L100 86 L114 108 L128 92 L130 124 Z" fill="#ffc83d" stroke="#e0a800" stroke-width="2"/><circle cx="100" cy="112" r="5" fill="#ff5c8a"/><circle cx="82" cy="116" r="3.5" fill="#6fd3c0"/><circle cx="118" cy="116" r="3.5" fill="#6fd3c0"/>`,
};

const GLASSES: Record<string, string> = {
  glasses_round: `<circle cx="86" cy="150" r="12" fill="#fff" fill-opacity="0.25" stroke="${INK}" stroke-width="3"/><circle cx="114" cy="150" r="12" fill="#fff" fill-opacity="0.25" stroke="${INK}" stroke-width="3"/><path d="M98 150 L102 150" stroke="${INK}" stroke-width="3"/>`,
  glasses_sun: `<rect x="72" y="141" width="26" height="18" rx="8" fill="${INK}" opacity="0.92"/><rect x="102" y="141" width="26" height="18" rx="8" fill="${INK}" opacity="0.92"/><path d="M98 148 L102 148" stroke="${INK}" stroke-width="3"/><path d="M77 145 L86 145" stroke="#fff" stroke-width="2" opacity="0.6"/>`,
  glasses_cat: `<path d="M70 142 Q86 136 98 146 Q94 160 82 160 Q70 158 70 142 Z" fill="#fff" fill-opacity="0.3" stroke="${INK}" stroke-width="3"/><path d="M130 142 Q114 136 102 146 Q106 160 118 160 Q130 158 130 142 Z" fill="#fff" fill-opacity="0.3" stroke="${INK}" stroke-width="3"/>`,
  glasses_heart: `<path d="M86 162 L73 149 Q68 141 76 138 Q82 136 86 142 Q90 136 96 138 Q104 141 99 149 Z" fill="#ff5c8a" opacity="0.9"/><path d="M114 162 L101 149 Q96 141 104 138 Q110 136 114 142 Q118 136 124 138 Q132 141 127 149 Z" fill="#ff5c8a" opacity="0.9"/>`,
};

export function petGroup(level: number, equipped: string[]): string {
  const color =
    PET_COLORS[equipped.find((id) => id in PET_COLORS) ?? "color_pink"];
  const hat = equipped.find((id) => id in HATS);
  const glasses = equipped.find((id) => id in GLASSES);
  return [
    `<ellipse cx="100" cy="188" rx="44" ry="6" fill="#000" opacity="0.08"/>`,
    `<ellipse cx="100" cy="150" rx="52" ry="38" fill="${color}"/>`,
    `<ellipse cx="82" cy="132" rx="14" ry="7" fill="#fff" opacity="0.25"/>`,
    face(level),
    glasses ? GLASSES[glasses] : "",
    hat ? HATS[hat] : "",
    sprout(level),
  ].join("");
}

export function petSvg(level: number, equipped: string[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 30 160 165">${petGroup(level, equipped)}</svg>`;
}

const GARDEN: Record<string, { x: number; y: number; svg: string }> = {
  garden_tree: {
    x: 52,
    y: 250,
    svg: `<rect x="-6" y="-10" width="12" height="40" rx="4" fill="#9a6b3f"/><circle cx="0" cy="-30" r="30" fill="#6dbb4a"/><circle cx="-18" cy="-14" r="18" fill="#7cc242"/><circle cx="18" cy="-16" r="20" fill="#86cc4c"/><circle cx="8" cy="-40" r="5" fill="#ff6f6f"/><circle cx="-14" cy="-24" r="5" fill="#ff6f6f"/>`,
  },
  garden_pot: {
    x: 62,
    y: 352,
    svg: `<path d="M-18 0 L18 0 L13 28 L-13 28 Z" fill="#d9774a"/><rect x="-21" y="-6" width="42" height="9" rx="3" fill="#c4632f"/><path d="M0 -6 L0 -30" stroke="#5aa832" stroke-width="3"/><circle cx="0" cy="-36" r="9" fill="#ff8fb1"/><circle cx="0" cy="-36" r="4" fill="#ffd23f"/><path d="M0 -16 Q-12 -22 -14 -12 Q-6 -10 0 -16" fill="#7cc242"/>`,
  },
  garden_mushroom: {
    x: 330,
    y: 362,
    svg: `<rect x="-7" y="-6" width="14" height="22" rx="5" fill="#fff4e0"/><path d="M-24 -4 Q0 -36 24 -4 Z" fill="#ff5c5c"/><circle cx="-9" cy="-14" r="3.5" fill="#fff"/><circle cx="7" cy="-19" r="3" fill="#fff"/><circle cx="12" cy="-9" r="2.5" fill="#fff"/>`,
  },
  garden_daisies: {
    x: 195,
    y: 405,
    svg: [
      [-150, 0],
      [-110, 12],
      [110, 8],
      [150, -6],
      [-40, 14],
    ]
      .map(
        ([dx, dy]) =>
          `<g transform="translate(${dx} ${dy})">${[0, 1, 2, 3, 4, 5]
            .map((i) => {
              const a = (i / 6) * Math.PI * 2;
              return `<ellipse cx="${Math.cos(a) * 6}" cy="${Math.sin(a) * 6}" rx="4" ry="4" fill="#fff"/>`;
            })
            .join("")}<circle r="3.5" fill="#ffd23f"/></g>`,
      )
      .join(""),
  },
  garden_butterflies: {
    x: 195,
    y: 170,
    svg: [
      [-110, 0, "#c7a8f0"],
      [100, 30, "#ffb38a"],
    ]
      .map(
        ([dx, dy, c]) =>
          `<g transform="translate(${dx} ${dy})"><ellipse cx="-7" cy="-4" rx="8" ry="6" fill="${c}"/><ellipse cx="7" cy="-4" rx="8" ry="6" fill="${c}"/><ellipse cx="-5" cy="5" rx="5" ry="4" fill="${c}"/><ellipse cx="5" cy="5" rx="5" ry="4" fill="${c}"/><rect x="-1.2" y="-8" width="2.4" height="16" rx="1.2" fill="${INK}"/></g>`,
      )
      .join(""),
  },
  garden_pond: {
    x: 300,
    y: 410,
    svg: `<ellipse cx="0" cy="0" rx="52" ry="14" fill="#7cc4ef"/><ellipse cx="-10" cy="-3" rx="26" ry="5" fill="#a8dcf7"/><ellipse cx="22" cy="2" rx="9" ry="4" fill="#5aa832"/><circle cx="24" cy="-2" r="3" fill="#ff8fb1"/>`,
  },
};

export function gardenItemSvg(id: string): string {
  const g = GARDEN[id];
  if (!g) return "";
  const wide = id === "garden_daisies" || id === "garden_butterflies";
  const vb = wide ? "-170 -30 340 60" : "-60 -75 120 110";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${g.svg}</svg>`;
}

export function sceneSvg(level: number, equipped: string[]): string {
  const garden = equipped.filter((id) => id in GARDEN);
  const back = garden.filter((id) =>
    ["garden_tree", "garden_butterflies"].includes(id),
  );
  const front = garden.filter((id) => !back.includes(id));
  const place = (id: string) =>
    `<g transform="translate(${GARDEN[id].x} ${GARDEN[id].y})">${GARDEN[id].svg}</g>`;
  const fence = Array.from({ length: 14 })
    .map(
      (_, i) =>
        `<rect x="${i * 30 - 4}" y="226" width="16" height="40" rx="8" fill="#fff"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 440" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8d8f5"/><stop offset="1" stop-color="#e3f3fb"/></linearGradient></defs>
<rect width="390" height="440" fill="url(#sky)"/>
<circle cx="300" cy="80" r="26" fill="#ffd23f" opacity="0.25"/><circle cx="300" cy="80" r="17" fill="#ffd86b"/>
<g fill="#fff"><ellipse cx="70" cy="110" rx="26" ry="10"/><ellipse cx="82" cy="102" rx="14" ry="10"/><ellipse cx="250" cy="150" rx="22" ry="8"/><ellipse cx="260" cy="143" rx="12" ry="8"/></g>
<path d="M0 230 Q110 190 220 220 T390 210 L390 440 L0 440 Z" fill="#eef5c8"/>
${back.map(place).join("")}
<rect x="0" y="244" width="390" height="8" fill="#fff"/>${fence}
<rect x="0" y="262" width="390" height="178" fill="#d8e38c"/>
<g fill="#b9cf55"><ellipse cx="60" cy="300" rx="16" ry="4"/><ellipse cx="320" cy="290" rx="14" ry="4"/><ellipse cx="250" cy="390" rx="18" ry="4"/></g>
${front.map(place).join("")}
<g transform="translate(115 200) scale(0.8)">${petGroup(level, equipped)}</g>
</svg>`;
}

export function withItem(equipped: string[], item: SlotItem, all: SlotItem[]) {
  if (item.slot === "garden") return [...new Set([...equipped, item.id])];
  const sameSlot = new Set(
    all.filter((i) => i.slot === item.slot).map((i) => i.id),
  );
  return [...equipped.filter((id) => !sameSlot.has(id)), item.id];
}
