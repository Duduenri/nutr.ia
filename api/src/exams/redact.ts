const DROP_LINE =
  /CPF|RG:|CIP |Solicitante|Telefone|Assinado|Sob a responsabilidade|Data da Gera|Laborat[oó]rio registrado|Licensed to|CRM|CRF|e-?mail/i;
const HEX_HASH = /\b[0-9a-f]{32,}\b/gi;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;

export function redactLabText(text: string, patientName: string): string {
  const nameParts = patientName
    .split(/\s+/)
    .filter((p) => p.length >= 3)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const nameRe = nameParts.length
    ? new RegExp(`\\b(${nameParts.join('|')})\\b`, 'gi')
    : null;
  return text
    .split('\n')
    .filter((line) => !DROP_LINE.test(line))
    .map((line) => {
      const demo = line.match(/(\d{1,3}) Anos?\).*SEXO:\s*(\w+)/i);
      if (demo) return `Paciente: ${demo[1]} anos, sexo ${demo[2]}`;
      let out = line.replace(HEX_HASH, '').replace(CPF, '').replace(EMAIL, '');
      if (nameRe) out = out.replace(nameRe, '');
      return out;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function cleanDocumentText(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/Licensed to/i.test(line))
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
