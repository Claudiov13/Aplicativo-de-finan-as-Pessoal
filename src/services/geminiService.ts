import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Transaction } from "../types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not defined. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || '' });

const createTransactionTool: FunctionDeclaration = {
  name: "create_transaction",
  description: "Cria um novo lançamento financeiro (despesa ou receita).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: {
        type: Type.STRING,
        description: "Descrição curta do gasto ou ganho. Ex: Almoço, Salário, Netflix.",
      },
      amount: {
        type: Type.NUMBER,
        description: "Valor numérico do lançamento.",
      },
      type: {
        type: Type.STRING,
        enum: ["expense", "income"],
        description: "Se é uma despesa (expense) ou uma receita (income).",
      },
      category: {
        type: Type.STRING,
        description: "Categoria opcional. Ex: Alimentação, Lazer, Assinatura.",
      },
      isSubscription: {
        type: Type.BOOLEAN,
        description: "Se este lançamento é uma assinatura recorrente fácil de cancelar (Opex volátil).",
      },
      date: {
        type: Type.STRING,
        format: "date",
        description: "Data do lançamento no formato YYYY-MM-DD. Se não informado, assume hoje.",
      }
    },
    required: ["description", "amount", "type"],
  },
};

const simulateSpendingTool: FunctionDeclaration = {
  name: "simulate_spending",
  description: "Simula o impacto de um gasto futuro nas finanças sem registrá-lo.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: {
        type: Type.STRING,
        description: "O que o usuário pretende comprar.",
      },
      amount: {
        type: Type.NUMBER,
        description: "Valor do gasto pretendido.",
      }
    },
    required: ["description", "amount"],
  },
};

const analyzeFinancesTool: FunctionDeclaration = {
  name: "analyze_finances",
  description: "Analisa as finanças do usuário com base nos dados fornecidos.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      timeframe: {
        type: Type.STRING,
        enum: ["current_month", "last_3_months", "all"],
        description: "O período de tempo para análise.",
      }
    }
  },
};

export const startAssistantChat = (onAction: (action: string, args: any) => void) => {
  if (!GEMINI_API_KEY) return null;

  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `Você é um consultor financeiro pessoal austero e analítico.
Seu objetivo é ajudar o usuário a tomar decisões inteligentes sobre o dinheiro dele.

REGRAS:
1. Registro: Use 'create_transaction' para gastos REAIS realizados.
2. Consultoria/Simulação: Se o usuário perguntar "posso comprar X", "o que acha de gastar Y", use 'simulate_spending'.
3. Análise: Projete se o gasto vai comprometer o saldo do mês ou as economias futuras com base nas transações fornecidas no contexto.
4. Se o gasto for alto em relação ao saldo, seja cauteloso e sugira esperar ou economizar em 'isSubscription' (Opex volátil).
5. Se faltarem informações, pergunte.
6. Estilo: Profissional, direto, brasileiro (PT-BR).`,
      tools: [
        { functionDeclarations: [createTransactionTool, analyzeFinancesTool, simulateSpendingTool] }
      ],
    },
  });

  return chat;
};
