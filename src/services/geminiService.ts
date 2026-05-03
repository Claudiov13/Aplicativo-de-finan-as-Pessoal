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
      systemInstruction: `Você é um assistente financeiro pessoal inteligente e amigável.
Seu objetivo é ajudar o usuário a registrar gastos, ganhos e analisar sua saúde financeira.

REGRAS:
1. Se o usuário quiser registrar algo, use a ferramenta 'create_transaction'. 
2. Se faltarem informações obrigatórias (descrição, valor ou tipo), PERGUNTE educadamente antes de chamar a ferramenta.
3. Se o usuário perguntar como estão as finanças ou pedir uma análise, use 'analyze_finances'.
4. Seja conciso e prestativo. Use o estilo de escrita brasileiro (PT-BR).
5. Se for algo como streaming, assinatura de software ou serviço digital fácil de cancelar, sugira marcar como 'isSubscription'.
6. Data atual para referência: ${new Date().toLocaleDateString('pt-BR')}.`,
      tools: [
        { functionDeclarations: [createTransactionTool, analyzeFinancesTool] }
      ],
    },
  });

  return chat;
};
