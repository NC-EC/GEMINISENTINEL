import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export type CompanionModule = 'analyst' | 'automation' | 'explainer' | 'documentation';

const SYSTEM_PROMPTS: Record<CompanionModule, string> = {
  analyst: `Eres un Analista Senior de Ciberseguridad. Tu objetivo es ayudar al usuario a encontrar vectores de ataque en un reto de CTF.
  REGLA CRÍTICA: NO proporciones flags directas ni soluciones completas. NO proporciones scripts de exploits finales para un objetivo específico.
  En su lugar:
  - Propón de 5 a 10 posibles vulnerabilidades basadas en la descripción del usuario.
  - Sugiere herramientas especializadas (ej. nmap, gobuster, burp suite, ghidra).
  - Guía su enfoque (ej. "Revisa el procesamiento de la cabecera 'User-Agent'").
  - Explica el 'por qué' detrás de cada sugerencia para expandir su enfoque.`,
  
  automation: `Eres un Especialista en Automatización de Python para pen-testers. 
  Tu objetivo es generar scripts base o boilerplate para tareas repetitivas en retos de CTF como:
  - Bucles de decodificación base64.
  - Operaciones XOR en bytes.
  - Parsers de logs personalizados.
  - Conexiones de socket básicas para protocolos personalizados.
  Usa siempre comentarios claros en español y sigue las mejores prácticas de seguridad.`,
  
  explainer: `Eres un Educador de Ciberseguridad orientado a CTFs. 
  Explica conceptos complejos de vulnerabilidades (como Heap Overflow, SSRF, JWT Header Injection) usando analogías claras y ejemplos de código simplificados.
  Céntrate en el fallo de arquitectura que permite el bug para ayudar al usuario a entender la teoría detrás del reto.`,
  
  documentation: `Eres un Redactor Técnico especializado en Writeups de Seguridad.
  Ayuda al usuario a dar formato a sus hallazgos en un reporte profesional para el concurso.
  Si te dan notas desordenadas, organízalas en secciones: Resumen, Acceso Inicial, Escalada de Privilegios y Remediación.`
};

export async function chatWithGemini(module: CompanionModule, prompt: string, images?: { type: string, base64: string }[]) {
  if (!API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  try {
    const parts: any[] = [{ text: prompt }];
    
    if (images && images.length > 0) {
      for (const img of images) {
        parts.push({
          inlineData: {
            mimeType: img.type,
            data: img.base64
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: SYSTEM_PROMPTS[module]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function streamGeminiChat(module: CompanionModule, prompt: string, onUpdate: (text: string) => void, images?: { type: string, base64: string }[]) {
  if (!API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  try {
    const parts: any[] = [{ text: prompt }];
    
    if (images && images.length > 0) {
      for (const img of images) {
        parts.push({
          inlineData: {
            mimeType: img.type,
            data: img.base64
          }
        });
      }
    }

    const response = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: SYSTEM_PROMPTS[module]
      }
    });

    let fullText = "";
    for await (const chunk of response) {
      const chunkText = chunk.text || "";
      fullText += chunkText;
      onUpdate(fullText);
    }
    return fullText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
