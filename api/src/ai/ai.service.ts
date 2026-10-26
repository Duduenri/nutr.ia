import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type {
  ResponseInputContent,
  ResponseInputItem,
} from 'openai/resources/responses/responses';
import * as z from 'zod';
import { requireEnv } from '../common/env';

const FoodItemSchema = z.object({
  name: z
    .string()
    .describe('Nome do alimento em português, ex.: "Arroz branco cozido"'),
  grams: z.number().describe('Porção estimada em gramas (ou ml para bebidas)'),
  kcal: z.number(),
  protein: z.number().describe('Proteínas em gramas'),
  carbs: z.number().describe('Carboidratos em gramas'),
  fat: z.number().describe('Gorduras totais em gramas'),
  fiber: z.number().describe('Fibras em gramas'),
  micros: z.object({
    sodioMg: z.number(),
    calcioMg: z.number(),
    ferroMg: z.number(),
    potassioMg: z.number(),
    vitaminaCMg: z.number(),
  }),
});

const FoodAnalysisSchema = z.object({
  recognized: z
    .boolean()
    .describe('false se não houver comida identificável na entrada'),
  items: z.array(FoodItemSchema),
  suggestedMeal: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  confidence: z.enum(['alta', 'media', 'baixa']),
  comment: z
    .string()
    .describe('Comentário curto e simpático sobre a refeição, 1 frase'),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;
export type FoodAnalysis = z.infer<typeof FoodAnalysisSchema>;

const FOOD_SYSTEM = `Você é um nutricionista brasileiro especialista em estimar porções e composição nutricional de refeições.
Use como referência a Tabela TACO (alimentos brasileiros) e rótulos de produtos comuns no Brasil.
Separe a refeição em itens individuais (ex.: arroz, feijão, frango grelhado, salada), cada um com sua porção em gramas.

A descrição escrita pela pessoa tem prioridade sobre qualquer estimativa:
- Quantidades informadas ("100 g de massa folhada", "2 ovos", "1 fatia de queijo") devem ser usadas exatamente. Nunca as altere.
- Converta medidas caseiras para gramas com valores típicos brasileiros (ex.: fatia de queijo muçarela ~20 g, fatia de pão de forma ~25 g, pão francês ~50 g, ovo ~50 g, colher de sopa de arroz ~25 g, concha de feijão ~140 g, colher de sopa de azeite ~13 g).
- Ingredientes citados que não aparecem na foto (recheio, molho, óleo) devem entrar como itens.
- Use o modo de preparo informado: air fryer, grelhado ou assado sem óleo não adicionam gordura; frito por imersão absorve óleo.
- Para o que não tiver quantidade informada, estime pela foto ou, sem foto, use uma porção típica de adulto brasileiro.

Para estimar porções em fotos, use referências visuais: tamanho do prato (~26 cm), talheres, copos, mãos.
Valores nutricionais são do item na porção indicada, não por 100 g.
Se a entrada não tiver comida, retorne recognized=false e items vazio.`;

const RecipeSchema = z.object({
  title: z.string(),
  emoji: z.string().describe('Um único emoji que represente o prato'),
  meal: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  prepMinutes: z.number().describe('Tempo total de preparo em minutos'),
  servings: z.number().describe('Quantas porções a receita rende'),
  servingG: z.number().describe('Peso aproximado de 1 porção pronta em gramas'),
  perServing: z.object({
    kcal: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
  }),
  ingredients: z.array(
    z.object({
      item: z.string(),
      quantity: z
        .string()
        .describe('Ex.: "120 g", "2 colheres de sopa", "1 unidade"'),
    }),
  ),
  steps: z.array(z.string()),
  tip: z
    .string()
    .describe('Dica curta: substituição, variação ou como guardar'),
});

const RecipeBatchSchema = z.object({ recipes: z.array(RecipeSchema) });

export type GeneratedRecipe = z.infer<typeof RecipeSchema>;

export interface RecipeRequest {
  meal?: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  request?: string;
  avoid: string[];
}

const MEAL_PT = {
  BREAKFAST: 'café da manhã',
  LUNCH: 'almoço',
  DINNER: 'jantar',
  SNACK: 'lanche',
};

const PlanQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z
        .array(z.string())
        .describe(
          '2 a 6 respostas curtas para tocar; vazio se for pergunta aberta',
        ),
      multiple: z.boolean().describe('true se pode marcar várias opções'),
    }),
  ),
});

export type PlanQuestions = z.infer<typeof PlanQuestionsSchema>;

export const LAB_CATEGORIES = [
  'Vitaminas',
  'Ferro e anemia',
  'Minerais',
  'Hemograma',
  'Proteínas',
  'Glicemia',
  'Lipídios',
  'Fígado',
  'Rins',
  'Tireoide',
  'Hormônios',
  'Outros',
] as const;

const LabExtractionSchema = z.object({
  collectedAt: z.string().describe('Data da coleta no formato AAAA-MM-DD'),
  results: z.array(
    z.object({
      code: z
        .string()
        .describe(
          'Identificador em snake_case sem acento. Use exatamente estes quando aplicável: ferritina, ferro_serico, transferrina, saturacao_transferrina, hemoglobina, hematocrito, eritrocitos, vcm, hcm, chcm, rdw, leucocitos, neutrofilos, linfocitos, plaquetas, vitamina_b12, acido_folico, vitamina_d, vitamina_a, vitamina_b1, zinco, cobre, magnesio, calcio, calcio_ionico, fosforo, pth, albumina, proteinas_totais, glicose, hemoglobina_glicada, insulina, colesterol_total, hdl, ldl, triglicerides, tgo, tgp, ggt, fosfatase_alcalina, bilirrubina_total, ureia, creatinina, sodio, potassio, tsh, t4_livre',
        ),
      name: z
        .string()
        .describe('Nome amigável em português, ex.: "Vitamina D"'),
      category: z.enum(LAB_CATEGORIES),
      value: z.number(),
      unit: z.string(),
      refLow: z
        .number()
        .nullable()
        .describe(
          'Limite inferior da faixa de referência aplicável a esta pessoa',
        ),
      refHigh: z
        .number()
        .nullable()
        .describe(
          'Limite superior da faixa de referência aplicável a esta pessoa',
        ),
      refText: z
        .string()
        .describe('Faixa de referência como está no laudo, resumida'),
      status: z.enum(['LOW', 'NORMAL', 'HIGH', 'UNKNOWN']),
      history: z
        .array(z.object({ date: z.string(), value: z.number() }))
        .describe(
          'Resultados anteriores listados no laudo (AAAA-MM-DD), sem incluir o atual',
        ),
    }),
  ),
});

export type LabExtraction = z.infer<typeof LabExtractionSchema>;

export interface LabContext {
  age: number | null;
  sex: string | null;
  bariatric: boolean;
  surgeryType: string | null;
}

const PrescriptionSchema = z.object({
  items: z.array(
    z.object({
      name: z
        .string()
        .describe('Nome curto, ex.: "Ferro quelato", "Vitamina D3"'),
      emoji: z
        .string()
        .describe(
          'Um emoji: 💊 cápsulas, 🥤 pós/shakes, ☀️ vitamina D, 🦴 cálcio, 🩸 ferro, 💉 injeção',
        ),
      dose: z
        .string()
        .describe(
          'Dose por tomada, ex.: "1 cápsula", "2.000 UI", "1 scoop (30 g)"',
        ),
      times: z
        .array(z.string())
        .describe('Horários HH:MM, um por tomada diária'),
      proteinG: z
        .number()
        .nullable()
        .describe(
          'Proteína por tomada em gramas, só para suplementos proteicos',
        ),
      kcal: z.number().nullable(),
      note: z
        .string()
        .describe(
          'Orientação curta da receita (ex.: "em jejum", "longe do cálcio"), ou vazio',
        ),
      daily: z
        .boolean()
        .describe(
          'false se não for de uso diário (semanal, mensal, injetável)',
        ),
    }),
  ),
});

export type Prescription = z.infer<typeof PrescriptionSchema>;

const ActivityEstimateSchema = z.object({
  kcal: z.number().describe('Gasto calórico total da sessão, em kcal'),
  intensity: z.enum(['LIGHT', 'MODERATE', 'VIGOROUS']),
  summary: z
    .string()
    .describe(
      'Uma ou duas frases curtas explicando a conta, ex.: "Musculação moderada (~5 MET) × 62 kg × 1 h ≈ 310 kcal"',
    ),
});

export type ActivityEstimate = z.infer<typeof ActivityEstimateSchema>;

export interface ActivityInput {
  name: string;
  minutes: number;
  intensity?: 'LIGHT' | 'MODERATE' | 'VIGOROUS';
  details?: string;
  weightKg: number | null;
  sex: 'FEMALE' | 'MALE' | null;
  age: number | null;
}

export interface CoachContext {
  profile: string;
  today: string;
  history: string;
  exams?: string;
  material?: string;
}

function coachSystem(context: CoachContext): string {
  return `Você é a Nutri, coach de nutrição e treino de um app pessoal. Fale em português do Brasil, tom carinhoso, direto e motivador, sem julgamentos.
Responda de forma curta e prática (é lido no celular). Use listas curtas quando ajudar. Pode usar emojis com moderação.
Baseie-se nos dados reais da usuária abaixo. Quando sugerir refeições, dê quantidades e macros aproximados.
Você não substitui nutricionista ou médico: para condições de saúde, gestação, transtornos alimentares ou medicamentos, recomende acompanhamento profissional.
Nunca sugira dietas abaixo de 1200 kcal nem perda de peso acima de 1 kg por semana.
Se ela fez cirurgia bariátrica: foque em bater a proteína primeiro em cada refeição, porções pequenas, mastigar bem, líquidos longe das refeições e lembrar da reposição de vitaminas/proteína; as metas e fases da dieta são definidas pela equipe dela (nutricionista e cirurgião), então não contradiga essas orientações.
Se ela mandar foto do que está comendo, identifique os alimentos, estime as porções e dê kcal e proteína aproximadas, depois responda à pergunta dela considerando o que ainda falta no dia. Avise que a estimativa por foto é aproximada só se a dúvida for sobre números exatos.
Se ela comer além da meta ou algo menos saudável, não incentive compensar com jejum prolongado, ficar só na água ou pular refeições: acolha sem culpa, sugira voltar ao plano na próxima refeição e, se ela quiser, atividade física moderada (caminhada, bicicleta, esteira) com o tempo aproximado.

## Perfil
${context.profile}

## Hoje
${context.today}

## Últimos dias
${context.history}${
    context.exams
      ? `

## Exames de sangue mais recentes
${context.exams}
Comente exames só quando for útil; valores fora da faixa devem ser levados à equipe dela, sem diagnosticar.`
      : ''
  }${
    context.material
      ? `

## Material de referência da nutricionista dela (use como base, sem citar páginas)
${context.material}`
      : ''
  }`;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client = new OpenAI({
    apiKey: requireEnv('OPENAI_API_KEY'),
  });
  private readonly model = requireEnv('OPENAI_MODEL');

  analyzePhoto(imageBase64: string, description?: string) {
    return this.analyzeFood([
      {
        type: 'input_image',
        image_url: `data:image/jpeg;base64,${imageBase64}`,
        detail: 'auto',
      },
      {
        type: 'input_text',
        text: description
          ? `Analise a refeição da foto. Descrição de quem comeu (pode ter vindo de ditado por voz): "${description}"`
          : 'Analise a refeição da foto.',
      },
    ]);
  }

  analyzeText(text: string) {
    return this.analyzeFood([
      {
        type: 'input_text',
        text: `Descrição do que foi comido (pode ter vindo de ditado por voz, com erros de transcrição): "${text}"`,
      },
    ]);
  }

  async chat(context: CoachContext, history: ChatTurn[]): Promise<string> {
    const response = await this.call(() =>
      this.client.responses.create({
        model: this.model,
        reasoning: { effort: 'low' },
        instructions: coachSystem(context),
        input: history.map((turn): ResponseInputItem =>
          turn.role === 'user' && turn.imageBase64
            ? {
                role: 'user',
                content: [
                  {
                    type: 'input_image',
                    image_url: `data:image/jpeg;base64,${turn.imageBase64}`,
                    detail: 'auto',
                  },
                  {
                    type: 'input_text',
                    text: turn.content || 'O que acha disso que vou comer?',
                  },
                ],
              }
            : { role: turn.role, content: turn.content },
        ),
      }),
    );
    const text = response.output_text.trim();
    if (!text) {
      throw new UnprocessableEntityException(
        'Não consegui responder isso. Tente reformular.',
      );
    }
    return text;
  }

  async recipes(
    context: CoachContext,
    req: RecipeRequest,
  ): Promise<GeneratedRecipe[]> {
    const ask = [
      'Sugira 4 receitas equilibradas para mim, variadas entre si, com ingredientes fáceis de achar no Brasil.',
      req.meal
        ? `Todas para ${MEAL_PT[req.meal]}.`
        : 'Distribua entre refeições diferentes, priorizando a próxima refeição do dia.',
      'Considere minhas metas e o que ainda falta comer hoje: cada porção deve caber no restante do dia e ajudar a bater a proteína.',
      req.request && `Pedido específico: "${req.request}"`,
      req.avoid.length &&
        `Não repita estas receitas que já sugeriu: ${req.avoid.join('; ')}.`,
      'Os macros são por porção e devem ser coerentes com os ingredientes e quantidades.',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await this.call(() =>
      this.client.responses.parse({
        model: this.model,
        reasoning: { effort: 'low' },
        instructions: coachSystem(context),
        input: ask,
        text: { format: zodTextFormat(RecipeBatchSchema, 'recipes') },
      }),
    );
    if (!response.output_parsed) {
      this.logger.warn(`Recipes failed: status=${response.status}`);
      throw new UnprocessableEntityException(
        'Não consegui gerar receitas agora. Tente de novo.',
      );
    }
    return response.output_parsed.recipes;
  }

  async parseRecipe(text: string): Promise<GeneratedRecipe> {
    const response = await this.call(() =>
      this.client.responses.parse({
        model: this.model,
        reasoning: { effort: 'low' },
        instructions: `Você é nutricionista brasileira e organiza receitas enviadas pela usuária.
Mantenha exatamente os ingredientes, quantidades e passos que ela escreveu; só organize e complete o que faltar.
Se ela não disser quantas porções rende ou o tempo de preparo, estime de forma realista.
Calcule calorias e macros POR PORÇÃO com base na Tabela TACO e nos rótulos comuns no Brasil, coerentes com as quantidades.
Se o texto não for uma receita, devolva o melhor que conseguir com o que foi enviado.`,
        input: text,
        text: { format: zodTextFormat(RecipeSchema, 'recipe') },
      }),
    );
    if (!response.output_parsed) {
      this.logger.warn(`Recipe parse failed: status=${response.status}`);
      throw new UnprocessableEntityException(
        'Não consegui organizar essa receita. Tente escrever de outro jeito.',
      );
    }
    return response.output_parsed;
  }

  async planQuestions(
    context: CoachContext,
    kind: 'diet' | 'workout',
  ): Promise<PlanQuestions> {
    const topic =
      kind === 'diet'
        ? 'um plano alimentar: o que ela tem em casa agora (pergunta aberta, sempre a primeira), alimentos que não come ou não gosta, quantas refeições faz e horários, tempo para cozinhar, orçamento'
        : 'um plano de treino: onde treina (casa, academia, ao ar livre), equipamentos disponíveis, quantos dias por semana, quanto tempo por treino, dores ou limitações, o que gosta de fazer';
    const response = await this.call(() =>
      this.client.responses.parse({
        model: this.model,
        reasoning: { effort: 'low' },
        instructions: coachSystem(context),
        input: `Antes de montar ${topic}, faça de 3 a 5 perguntas curtas e diretas para personalizar. Não pergunte o que já está no perfil. Dê opções de resposta curtas quando fizer sentido.`,
        text: { format: zodTextFormat(PlanQuestionsSchema, 'plan_questions') },
      }),
    );
    if (!response.output_parsed) {
      throw new UnprocessableEntityException(
        'Não consegui preparar as perguntas. Tente de novo.',
      );
    }
    return response.output_parsed;
  }

  revisePlan(
    context: CoachContext,
    plan: string,
    request: string,
  ): Promise<string> {
    return this.chat(context, [
      {
        role: 'user',
        content: `Este é o meu plano atual:\n\n${plan}\n\nAjuste o plano assim: "${request}". Devolva o plano completo já ajustado, no mesmo formato, mantendo o que não precisa mudar.`,
      },
    ]);
  }

  async extractLabs(
    input: { text: string } | { imageBase64: string },
    ctx: LabContext,
  ): Promise<LabExtraction> {
    const who = [
      ctx.age ? `${ctx.age} anos` : null,
      ctx.sex === 'FEMALE'
        ? 'sexo feminino'
        : ctx.sex === 'MALE'
          ? 'sexo masculino'
          : null,
      ctx.bariatric
        ? `pós-cirurgia bariátrica${ctx.surgeryType ? ` (${ctx.surgeryType})` : ''} — considere grupo de risco quando o laudo tiver faixas diferentes por grupo`
        : null,
    ]
      .filter(Boolean)
      .join(', ');
    const instructions = `Você extrai resultados de exames laboratoriais brasileiros para um app pessoal de saúde.
Inclua somente resultados numéricos (ignore textos como "ausente"/"negativo" e campos sem valor).
Para hemograma com valor percentual e absoluto, use o absoluto (/µL) para leucócitos e suas frações.
Escolha a faixa de referência que se aplica a esta pessoa: ${who || 'dados não informados'}.
Se o laudo der várias faixas (por idade, sexo ou grupo de risco), preencha refLow/refHigh com a faixa aplicável; se não houver números, deixe null e defina status pela interpretação do laudo.
Inclua o histórico de resultados anteriores quando o laudo trouxer.
Nunca invente valores.`;
    const content: ResponseInputContent[] =
      'text' in input
        ? [{ type: 'input_text', text: input.text }]
        : [
            {
              type: 'input_image',
              image_url: `data:image/jpeg;base64,${input.imageBase64}`,
              detail: 'high',
            },
            { type: 'input_text', text: 'Extraia os resultados deste laudo.' },
          ];
    const response = await this.call(() =>
      this.client.responses.parse({
        model: this.model,
        reasoning: { effort: 'low' },
        instructions,
        input: [{ role: 'user', content }],
        text: { format: zodTextFormat(LabExtractionSchema, 'lab_results') },
      }),
    );
    if (!response.output_parsed || !response.output_parsed.results.length) {
      throw new UnprocessableEntityException(
        'Não encontrei resultados de exame nesse arquivo.',
      );
    }
    return response.output_parsed;
  }

  async extractPrescription(
    input: { text: string } | { imageBase64: string },
  ): Promise<Prescription> {
    const instructions = `Você lê receitas de suplementos e vitaminas (comuns após cirurgia bariátrica) para cadastrar lembretes.
Liste cada item prescrito com dose por tomada e horários diários no formato HH:MM.
Se a receita disser os horários, use exatamente. Se só disser a frequência, sugira horários práticos respeitando:
ferro em jejum ou longe de leite/café/chá e pelo menos 2 h longe do cálcio; cálcio dividido em tomadas de até 500–600 mg;
vitamina D e polivitamínico junto de uma refeição; B12 pela manhã.
Polivitamínicos costumam ter cálcio: deixe pelo menos 2 h entre ele e o ferro. Se a receita der opção de frequência (ex.: 2x ou 3x), escolha a que permite respeitar essas distâncias.
Antes de responder, confira se todos os horários sugeridos respeitam as distâncias acima.
Itens não diários (semanais, mensais, injetáveis) entram com daily=false e times vazio.
Nunca invente itens que não estejam na receita.`;
    const content: ResponseInputContent[] =
      'text' in input
        ? [{ type: 'input_text', text: input.text }]
        : [
            {
              type: 'input_image',
              image_url: `data:image/jpeg;base64,${input.imageBase64}`,
              detail: 'high',
            },
            { type: 'input_text', text: 'Leia esta receita.' },
          ];
    const response = await this.call(() =>
      this.client.responses.parse({
        model: this.model,
        reasoning: { effort: 'low' },
        instructions,
        input: [{ role: 'user', content }],
        text: { format: zodTextFormat(PrescriptionSchema, 'prescription') },
      }),
    );
    if (!response.output_parsed?.items.length) {
      throw new UnprocessableEntityException(
        'Não encontrei suplementos nessa receita.',
      );
    }
    return response.output_parsed;
  }

  private async analyzeFood(
    content: ResponseInputContent[],
  ): Promise<FoodAnalysis> {
    const response = await this.call(() =>
      this.client.responses.parse({
        model: this.model,
        reasoning: { effort: 'low' },
        instructions: FOOD_SYSTEM,
        input: [{ role: 'user', content }],
        text: { format: zodTextFormat(FoodAnalysisSchema, 'food_analysis') },
      }),
    );
    if (!response.output_parsed) {
      this.logger.warn(`Food analysis failed: status=${response.status}`);
      throw new UnprocessableEntityException(
        'Não consegui analisar. Tente outra foto ou descreva em texto.',
      );
    }
    return response.output_parsed;
  }

  async estimateActivity(input: ActivityInput): Promise<ActivityEstimate> {
    const instructions = `Você estima o gasto calórico de atividades físicas.
Use METs do Compendium of Physical Activities: kcal = MET × peso (kg) × horas. Se o peso não for informado, use 65 kg.
Escolha o MET pela atividade e pelos detalhes: em musculação considere volume, cargas, descanso entre séries e se foi circuito; em corrida/bike considere ritmo, velocidade ou distância se houver; em aulas considere o estilo.
Se a pessoa disser a intensidade, respeite-a, mas ajuste se os detalhes indicarem claramente outra.
Seja conservadora: apps e relógios costumam superestimar. Arredonde para inteiro.`;
    const ask = [
      `Atividade: ${input.name}`,
      `Duração: ${input.minutes} min`,
      input.intensity && `Intensidade dita: ${input.intensity}`,
      input.details && `O que foi feito: ${input.details}`,
      `Peso: ${input.weightKg ? `${input.weightKg} kg` : 'não informado'}`,
      input.sex && `Sexo: ${input.sex === 'FEMALE' ? 'feminino' : 'masculino'}`,
      input.age && `Idade: ${input.age} anos`,
    ]
      .filter(Boolean)
      .join('\n');
    const response = await this.call(() =>
      this.client.responses.parse({
        model: this.model,
        reasoning: { effort: 'low' },
        instructions,
        input: ask,
        text: {
          format: zodTextFormat(ActivityEstimateSchema, 'activity'),
        },
      }),
    );
    if (!response.output_parsed) {
      throw new UnprocessableEntityException(
        'Não consegui estimar essa atividade. Tente descrever de outro jeito.',
      );
    }
    return {
      ...response.output_parsed,
      kcal: Math.max(0, Math.round(response.output_parsed.kcal)),
    };
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof OpenAI.AuthenticationError) {
        this.logger.error('OpenAI API key inválida');
        throw new ServiceUnavailableException(
          'IA indisponível (chave inválida)',
        );
      }
      if (error instanceof OpenAI.RateLimitError) {
        if (error.code === 'insufficient_quota') {
          this.logger.error('OpenAI sem créditos');
          throw new ServiceUnavailableException(
            'Os créditos da IA acabaram. Recarregue na OpenAI.',
          );
        }
        throw new ServiceUnavailableException(
          'IA ocupada agora, tente em instantes',
        );
      }
      if (error instanceof OpenAI.APIError) {
        this.logger.error(`OpenAI error ${error.status}: ${error.message}`);
        throw new BadGatewayException('Falha ao falar com a IA');
      }
      throw error;
    }
  }
}
